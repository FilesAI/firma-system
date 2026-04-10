import {
  initProxy,
  createLogger,
  getAgentSigner,
  AGENT_WALLETS,
  OPERATION_CONFIG,
  shouldExecute,
  logDegradation,
  SkillRegistry,
  DiscoveryEngine,
  UniswapV3Skill,
  DexAggregatorSkill,
  LendingSkill,
  YieldFarmingSkill,
  BridgeSkill,
} from "@firma/core";

import { JobEvaluator } from "./evaluator.js";
import { ReputationManager } from "./reputation.js";
import { GovernanceEngine } from "./hire-fire.js";
import { ProfitAllocator } from "./allocator.js";
import { RiskGuard } from "./guard.js";
import { scanTokenSecurity } from "./security-scanner.js";
import {
  findYieldOpportunities,
  getDefiPositions,
  getWalletPortfolio,
  getTransactionStatus,
} from "@firma/core";

const log = createLogger("Treasury");

// ====== Bootstrap ======

const treasuryWallet = AGENT_WALLETS.treasury;
const signer = getAgentSigner(treasuryWallet.accountId, treasuryWallet.address);

const evaluator = new JobEvaluator();
const reputation = new ReputationManager(signer);
const governance = new GovernanceEngine(signer);
const allocator = new ProfitAllocator();
const guard = new RiskGuard(signer, treasuryWallet.address);

// ====== Skills Discovery System ======
const skillRegistry = new SkillRegistry();
let discoveryEngine: DiscoveryEngine | null = null;

// ====== Exports for other agents to call ======

export { evaluator, reputation, governance, allocator, guard, skillRegistry, discoveryEngine };
export { JobEvaluator } from "./evaluator.js";
export { ReputationManager } from "./reputation.js";
export { GovernanceEngine } from "./hire-fire.js";
export { ProfitAllocator } from "./allocator.js";
export { RiskGuard } from "./guard.js";

// ====== Governance Loop ======

let governanceTimer: ReturnType<typeof setInterval> | null = null;
let treasuryWasFired = false;

async function runGovernanceCycle(): Promise<void> {
  const researchAgentId = AGENT_WALLETS.research.agentId;

  try {
    // 0. Check if Treasury itself is still active
    const selfStatus = await shouldExecute(
      AGENT_WALLETS.treasury.agentId,
      "Treasury",
    );

    if (!selfStatus.active) {
      if (!treasuryWasFired) {
        treasuryWasFired = true;
        logDegradation("Treasury", "auto-renew",
          "Treasury agent fired — all agents auto-renewed. " +
          "No governance decisions until Treasury is rehired.");
      }
      // In auto-renew mode: just log, no on-chain actions
      return;
    }

    // If we were fired and got rehired, log the recovery
    if (treasuryWasFired) {
      treasuryWasFired = false;
      log.info("Treasury Agent REHIRED — resuming governance decisions");
    }

    // 1. Check risk guard
    const riskStatus = await guard.checkBalance();
    if (riskStatus.paused) {
      log.warn("Treasury paused — skipping governance cycle");
      return;
    }

    // 2. Get current accuracy from evaluator history
    const currentAccuracy = evaluator.getAccuracy();
    const evalCount = evaluator.getEvaluationCount();

    if (evalCount === 0) {
      log.info("No evaluations yet — skipping governance cycle");
      return;
    }

    log.info(
      `Governance cycle: accuracy=${(currentAccuracy * 100).toFixed(1)}% over ${evalCount} evaluations`,
    );

    // 3. Run governance evaluation
    const decision = governance.evaluate(currentAccuracy);

    // 4. Execute governance decision on-chain
    await governance.execute(decision, researchAgentId);

    const status = governance.getStatus();
    log.info("Governance state", status);

    // 5. Review queued skill opportunities (from DiscoveryEngine)
    if (discoveryEngine) {
      const queue = discoveryEngine.getQueue();
      if (queue.length > 0) {
        log.info(`Reviewing ${queue.length} skill opportunities...`);

        for (const opp of queue) {
          // Treasury approves high-confidence, low-risk opportunities
          if (opp.confidence >= OPERATION_CONFIG.signalConfidenceThreshold) {
            // Security scan via OnchainOS before execution
            if (opp.tokens.length > 0) {
              let blocked = false;
              for (const tokenAddr of opp.tokens) {
                const secScan = await scanTokenSecurity(tokenAddr);
                if (!secScan.safe) {
                  log.warn(
                    `BLOCKED opportunity ${opp.description} — security risk on ${tokenAddr.slice(0, 10)}...: ${secScan.details}`,
                  );
                  blocked = true;
                  break;
                }
                log.info(`Security scan passed for ${tokenAddr.slice(0, 10)}... (${secScan.riskLevel})`);
              }
              if (blocked) continue;
            }

            log.info(
              `Approving opportunity: ${opp.description} ` +
                `(${opp.skillId}, confidence: ${(opp.confidence * 100).toFixed(0)}%, ` +
                `risk: ${opp.riskLevel}, est. return: ${opp.estimatedReturn.toFixed(4)})`,
            );
            const result = await discoveryEngine.executeOpportunity(opp);
            if (result.success) {
              const revenue = result.amountOut ? parseFloat(result.amountOut) : 0;
              allocator.recordRevenue(
                AGENT_WALLETS.treasury.agentId,
                revenue,
                `skill:${opp.skillId}`,
              );
              log.info(`Skill execution succeeded: tx=${result.txHash}`);
            } else {
              log.warn(`Skill execution failed: ${result.error}`);
            }
          } else {
            log.info(
              `Skipping low-confidence opportunity: ${opp.description} ` +
                `(${(opp.confidence * 100).toFixed(0)}%)`,
            );
          }
        }

        // Clear processed queue
        discoveryEngine.clearQueue();
      }

      // Log discovery stats
      const discoveryStats = discoveryEngine.getStats();
      if (discoveryStats.totalScans > 0) {
        log.info("Discovery stats", discoveryStats);
      }
    }
    // 6. Check idle fund yield opportunities (okx-defi-invest skill)
    try {
      const usdtAddress = process.env.USDT_ADDRESS || "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
      const yieldOpps = findYieldOpportunities(usdtAddress);
      if (yieldOpps.length > 0) {
        const bestOpp = yieldOpps.reduce((best, o) =>
          parseFloat(o.apy) > parseFloat(best.apy) ? o : best,
        );
        log.info(
          `[okx-defi-invest] Best yield: ${bestOpp.protocol} ` +
          `APY=${bestOpp.apy}% (pool: ${bestOpp.pool})`,
        );
      }
    } catch {
      log.warn("[okx-defi-invest] Yield scan unavailable (non-fatal)");
    }

    // 7. Portfolio check via OnchainOS (okx-wallet-portfolio skill)
    try {
      const portfolio = getWalletPortfolio(treasuryWallet.address);
      if (portfolio.totalValueUsd !== "0") {
        log.info(
          `[okx-wallet-portfolio] Treasury: $${portfolio.totalValueUsd} ` +
          `(${portfolio.balances.length} tokens)`,
        );
      }
    } catch {
      log.warn("[okx-wallet-portfolio] Portfolio query unavailable (non-fatal)");
    }
  } catch (error) {
    log.error("Governance cycle failed", error);
  }
}

// ====== Main ======

async function main(): Promise<void> {
  await initProxy();
  log.info("Treasury Agent starting...");
  log.info(`Wallet: ${treasuryWallet.address}`);
  log.info(`Agent ID: ${treasuryWallet.agentId}`);
  log.info(
    `Evaluation interval: ${OPERATION_CONFIG.evaluationIntervalMs / 1000}s`,
  );

  // Initial risk check
  await guard.checkBalance();

  // ====== Initialize Skills Discovery ======
  log.info("Initializing Skills Discovery System...");
  try {
    // Register all available DeFi skills
    await skillRegistry.register(new UniswapV3Skill());
    await skillRegistry.register(new DexAggregatorSkill());
    await skillRegistry.register(new LendingSkill());
    await skillRegistry.register(new YieldFarmingSkill());
    await skillRegistry.register(new BridgeSkill());

    const summary = skillRegistry.getSummary();
    log.info(
      `Skills registered: ${summary.total} total, ${summary.active} active, ` +
        `${summary.offline} offline`,
    );

    // Create and start the discovery engine
    discoveryEngine = new DiscoveryEngine(skillRegistry, {
      scanIntervalMs: OPERATION_CONFIG.monitorIntervalMs,
      minConfidence: 0.3,
      maxCapitalPerOpportunity: "1.0",
      maxTotalCapitalDeployed: "10.0",
      maxRiskLevel: "high",
      autoExecute: false, // Treasury reviews all opportunities
      enabledCategories: ["swap", "aggregator", "lend", "borrow", "yield-farm", "bridge"],
    });

    discoveryEngine.onOpportunity((opp) => {
      log.info(
        `[Discovery] New opportunity: ${opp.description} ` +
          `(${opp.skillId}, confidence: ${(opp.confidence * 100).toFixed(0)}%, ` +
          `est. return: ${opp.estimatedReturn.toFixed(4)})`,
      );
    });

    discoveryEngine.onExecution((result) => {
      if (result.success) {
        log.info(`[Discovery] Execution succeeded: tx=${result.txHash}`);
      } else {
        log.warn(`[Discovery] Execution failed: ${result.error}`);
      }
    });

    discoveryEngine.start();
    skillRegistry.startHealthMonitoring();
    log.info("Skills Discovery Engine started — scanning for DeFi opportunities");
  } catch (error) {
    log.error("Failed to initialize Skills Discovery (non-fatal)", error);
  }

  // Start governance loop (every hour)
  governanceTimer = setInterval(
    () => void runGovernanceCycle(),
    OPERATION_CONFIG.evaluationIntervalMs,
  );

  log.info("Treasury Agent running. Job evaluations handled per-job.");
}

// ====== Graceful Shutdown ======

function shutdown(): void {
  log.info("Shutting down Treasury Agent...");

  if (governanceTimer) {
    clearInterval(governanceTimer);
    governanceTimer = null;
  }

  // Stop skills discovery
  if (discoveryEngine) {
    discoveryEngine.stop();
    const discoveryStats = discoveryEngine.getStats();
    log.info("Final discovery stats", discoveryStats);
  }
  skillRegistry.stopHealthMonitoring();
  skillRegistry.shutdown().catch(() => {});

  const pnl = allocator.getCompanyPnL();
  log.info("Final P&L", pnl);

  const status = governance.getStatus();
  log.info("Final governance state", status);

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  log.error("Fatal error", error);
  process.exit(1);
});
