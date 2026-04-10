import {
  initProxy,
  AGENT_WALLETS,
  OPERATION_CONFIG,
  createLogger,
  printWalletStatus,
  shouldExecute,
  logDegradation,
} from "@firma/core";
import type { Signal } from "@firma/core";
import { JobClient } from "./job-client.js";
import { fetchSignal } from "./x402-client.js";
import { Trader } from "./trader.js";
import { TradeReporter } from "./reporter.js";

const log = createLogger("Executor");

const SIGNAL_ENDPOINT = process.env.SIGNAL_ENDPOINT || "http://localhost:3001/signal";
const INTERVAL_MS = Number(process.env.EXECUTOR_INTERVAL_MS) || OPERATION_CONFIG.monitorIntervalMs;

let running = true;
let lastSignal: Signal | null = null;
let consecutiveSignalFailures = 0;
let wasFired = false;

async function runCycle(
  jobClient: JobClient,
  trader: Trader,
  reporter: TradeReporter,
): Promise<void> {
  try {
    // Pre-check: Is this agent still active on-chain?
    const status = await shouldExecute(
      AGENT_WALLETS.executor.agentId,
      "Executor",
    );

    if (!status.active) {
      wasFired = true;
      logDegradation("Executor", "paused",
        "Agent is fired — trade execution paused. Signals are still being monitored.");
      // Still fetch signal to track market, but don't trade
      try {
        const signal = await fetchSignal(SIGNAL_ENDPOINT);
        if (signal) {
          lastSignal = signal;
          log.info(`[OBSERVATION] Signal received: ${signal.direction} (${(signal.confidence * 100).toFixed(0)}%) — not executing (fired)`);
        }
      } catch { /* ignore signal fetch errors in degraded mode */ }
      return;
    }

    // If we were fired and got rehired, log the recovery
    if (wasFired) {
      wasFired = false;
      log.info("Executor Agent REHIRED — resuming trade execution");
    }

    // Step 1: Create and fund an ACPV2 job for the signal
    log.info("Creating ACPV2 job for signal purchase...");
    const jobId = await jobClient.createAndFundJob();
    log.info(`Job #${jobId} created and funded`);

    // Step 2: Fetch signal from Research Agent
    log.info("Fetching signal from Research Agent...");
    const signal = await fetchSignal(SIGNAL_ENDPOINT);

    if (!signal) {
      consecutiveSignalFailures++;

      // Graceful degradation: if Research Agent is down, use last known signal
      if (lastSignal && consecutiveSignalFailures <= 3) {
        log.warn(
          `No signal received (attempt ${consecutiveSignalFailures}/3). ` +
          `Using last known signal: ${lastSignal.direction} from ${lastSignal.timestamp}`
        );
        // Don't trade on stale signals, just log
        log.info("[DEGRADED] Skipping trade — signal is stale. Waiting for Research Agent recovery.");
        return;
      }

      log.warn("No signal received, skipping cycle");
      return;
    }

    // Reset failure counter on successful signal
    consecutiveSignalFailures = 0;
    lastSignal = signal;

    // Step 3: Execute trade based on signal
    const result = await trader.executeTrade(signal);

    if (!result) {
      log.info("Trade skipped (below confidence threshold)");
      return;
    }

    if (result.success) {
      // Step 4: Record the trade
      const entryPrice = signal.confidence; // Placeholder; real price from pool data
      reporter.recordTrade(signal, result.txHash, entryPrice);

      const accuracy = reporter.getAccuracy();
      const totalTrades = reporter.getTradeHistory().length;
      log.info(`Trade complete. Total trades: ${totalTrades}, Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    } else {
      log.warn("Trade failed, not recording");
    }
  } catch (error) {
    log.error("Cycle failed", error);
  }
}

async function main(): Promise<void> {
  await initProxy();
  log.info("=== Executor Agent Starting ===");
  log.info(`Signal endpoint: ${SIGNAL_ENDPOINT}`);
  log.info(`Cycle interval: ${INTERVAL_MS}ms`);

  await printWalletStatus("Executor", AGENT_WALLETS.executor.address);

  const jobClient = new JobClient();
  const trader = new Trader();
  const reporter = new TradeReporter();

  // Run first cycle immediately
  await runCycle(jobClient, trader, reporter);

  // Schedule subsequent cycles
  const interval = setInterval(async () => {
    if (!running) return;
    await runCycle(jobClient, trader, reporter);
  }, INTERVAL_MS);

  // Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down...");
    running = false;
    clearInterval(interval);

    const history = reporter.getTradeHistory();
    const accuracy = reporter.getAccuracy();
    log.info(`Final stats: ${history.length} trades, ${(accuracy * 100).toFixed(1)}% accuracy`);

    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  log.error("Fatal error", error);
  process.exit(1);
});
