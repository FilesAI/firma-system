import { initProxy, createLogger, AGENT_WALLETS, shouldExecute, logDegradation } from "@firma/core";
import type { Signal } from "@firma/core";
import { PoolMonitor } from "./monitor.js";
import { analyzePool, analyzePoolWithUniswapAI } from "./analyzer.js";
import { startX402Server } from "./x402-server.js";
import { JobProvider } from "./job-provider.js";
import { fetchSmartMoneySignals, fetchMarketData, fetchTokenRisk } from "./onchain-intel.js";
import { fetchAggregatedBuySignals, getTokenHolderDistribution, getTokenKline } from "@firma/core";

const log = createLogger("Research");

// Default monitored pools on X Layer (configurable via env)
const DEFAULT_POOLS = (
  process.env.MONITOR_POOLS ||
  "0x3c12765d3cFaC132dE161BC6083C886bB57FAB06"
).split(",");

let latestSignal: Signal | null = null;
let running = true;
let isFired = false;

async function main(): Promise<void> {
  await initProxy();
  log.info("=== Firma Research Agent ===");
  log.info(`Agent ID: ${AGENT_WALLETS.research.agentId}`);
  log.info(`Wallet: ${AGENT_WALLETS.research.address}`);
  log.info(`Monitoring ${DEFAULT_POOLS.length} pool(s)`);

  // Initialize components
  const monitor = new PoolMonitor(DEFAULT_POOLS);
  const jobProvider = new JobProvider();

  // Start x402 signal endpoint
  startX402Server(() => latestSignal);

  // Listen for pool events and generate signals
  // When fired (observation mode), we still monitor pools but don't update latestSignal
  monitor.on("lp-change", ({ snapshot }) => {
    if (!snapshot.poolData) return;
    const signal = analyzePool({
      poolData: snapshot.poolData,
      recentSwaps: snapshot.recentSwaps,
      previousLiquidity: snapshot.previousLiquidity,
    });
    if (signal && !isFired) {
      latestSignal = signal;
      log.info(`New signal: ${signal.direction} (${(signal.confidence * 100).toFixed(0)}%)`, {
        pool: signal.pool,
        reason: signal.reason,
      });
    }
  });

  monitor.on("large-swap", ({ snapshot }) => {
    if (!snapshot.poolData) return;
    const signal = analyzePool({
      poolData: snapshot.poolData,
      recentSwaps: snapshot.recentSwaps,
      previousLiquidity: snapshot.previousLiquidity,
    });
    if (signal && !isFired) {
      latestSignal = signal;
      log.info(`New signal: ${signal.direction} (${(signal.confidence * 100).toFixed(0)}%)`, {
        pool: signal.pool,
        reason: signal.reason,
      });
    }
  });

  // Start monitoring
  await monitor.start();
  log.info("Pool monitor started");

  // Periodic signal generation from latest snapshots
  const analysisInterval = setInterval(async () => {
    if (!running) return;

    // Check if agent has been fired — if so, enter observation mode
    // (keep monitoring pools but mark signals as "observation only")
    const status = await shouldExecute(
      AGENT_WALLETS.research.agentId,
      "Research",
    );

    if (!status.active) {
      if (!isFired) {
        isFired = true;
        logDegradation("Research", "observation",
          "Agent fired — continuing pool monitoring in observation mode. " +
          "x402 endpoint still serves last known signal. Waiting for rehire.");
      }
      // Still monitor pools (data collection continues) but don't generate new signals
      return;
    }

    // If we were fired and got rehired, log the recovery
    if (isFired) {
      isFired = false;
      log.info("Research Agent REHIRED — resuming full signal generation");
    }

    // Enrich analysis with OnchainOS smart money signals
    try {
      const smartSignals = await fetchSmartMoneySignals();
      if (smartSignals.length > 0) {
        log.info(`OnchainOS: ${smartSignals.length} smart money signals detected`);
        for (const s of smartSignals.slice(0, 3)) {
          const risk = await fetchTokenRisk(s.tokenAddress);
          if (!risk.safe) {
            log.warn(`Skipping risky token ${s.tokenAddress.slice(0, 10)}... — ${risk.details}`);
            continue;
          }
          const market = await fetchMarketData(s.tokenAddress);
          if (market) {
            log.info(
              `Smart money ${s.action}: ${s.tokenAddress.slice(0, 10)}... ` +
              `price=$${market.price} vol=$${market.volume24h} liq=$${market.liquidity}`,
            );
          }
        }
      }
    } catch (err) {
      log.warn("OnchainOS intel fetch failed (non-fatal)", err);
    }

    // Enrich with aggregated buy signals from Onchain OS (okx-dex-signal skill)
    try {
      const aggSignals = fetchAggregatedBuySignals("xlayer");
      if (aggSignals.length > 0) {
        log.info(`[okx-dex-signal] ${aggSignals.length} aggregated buy signals on X Layer`);
      }
    } catch { /* non-fatal */ }

    // Analyze pools with Uniswap AI enrichment (uniswap-trading + uniswap-driver)
    for (const [, snapshot] of monitor.getLatestData()) {
      if (!snapshot.poolData) continue;

      // Use Uniswap AI-enhanced analysis when possible, fallback to base analysis
      const signal = await analyzePoolWithUniswapAI({
        poolData: snapshot.poolData,
        recentSwaps: snapshot.recentSwaps,
        previousLiquidity: snapshot.previousLiquidity,
      }) ?? analyzePool({
        poolData: snapshot.poolData,
        recentSwaps: snapshot.recentSwaps,
        previousLiquidity: snapshot.previousLiquidity,
      });

      if (signal) {
        latestSignal = signal;

        // Enrich with holder distribution (okx-dex-token skill)
        try {
          const holders = getTokenHolderDistribution(signal.token0 || "");
          if (holders.whalePercent > 0) {
            log.info(
              `[okx-dex-token] Holder distribution: whale=${holders.whalePercent.toFixed(1)}%, ` +
              `sniper=${holders.sniperPercent.toFixed(1)}%`,
            );
          }
        } catch { /* non-fatal */ }

        // Fetch K-line data (okx-dex-market skill)
        try {
          const kline = getTokenKline(signal.token0 || "", "1h");
          if (kline.length > 0) {
            const latest = kline[kline.length - 1];
            log.info(
              `[okx-dex-market] K-line: open=${latest.open} close=${latest.close} vol=${latest.volume}`,
            );
          }
        } catch { /* non-fatal */ }
      }
    }
  }, 60_000);

  // Graceful shutdown
  const shutdown = () => {
    log.info("Shutting down Research Agent...");
    running = false;
    monitor.stop();
    clearInterval(analysisInterval);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("Fatal error in Research Agent", err);
  process.exit(1);
});

export { PoolMonitor } from "./monitor.js";
export { analyzePool } from "./analyzer.js";
export { startX402Server } from "./x402-server.js";
export { JobProvider } from "./job-provider.js";
