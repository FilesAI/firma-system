import { initProxy, AGENT_WALLETS, createLogger, shouldExecute, logDegradation, getTransactionStatus } from "@firma/core";
import type { OpsReport } from "@firma/core";
import { ReportGenerator, type ReportDataProvider } from "./report-gen.js";
import { ReportAnchor } from "./anchor.js";
import { formatReportMarkdown } from "./templates.js";
import { fetchAgentPortfolios, formatPortfolioSummary } from "./wallet-intel.js";

const log = createLogger("Ops");

const DAY_MS = 24 * 60 * 60 * 1000;

// Default data provider — returns zeroed data; replace via constructor for real usage
const defaultDataProvider: ReportDataProvider = () => ({
  revenue: 0,
  expenses: 0,
  jobsCompleted: 0,
  jobsRejected: 0,
  signalAccuracy: 0,
  hrDecisions: [],
});

let generator: ReportGenerator;
let anchor: ReportAnchor;
let dailyTimer: ReturnType<typeof setInterval> | null = null;

export async function generateAndAnchor(
  dataProvider?: ReportDataProvider,
): Promise<OpsReport> {
  if (!generator) {
    generator = new ReportGenerator(dataProvider ?? defaultDataProvider);
  }
  if (!anchor) {
    anchor = new ReportAnchor();
  }

  const report = await generator.generateReport();
  log.info("Report generated", { reportId: report.reportId });

  // Enrich report with real wallet balances from OnchainOS
  try {
    const portfolios = await fetchAgentPortfolios();
    const portfolioSummary = formatPortfolioSummary(portfolios);
    log.info(portfolioSummary);
  } catch (err) {
    log.warn("Wallet portfolio fetch failed (non-fatal)", err);
  }

  log.info("\n" + formatReportMarkdown(report));

  const txHash = await anchor.anchor(report.contentHash);
  log.info(`Anchored report #${report.reportId} -> tx: ${txHash}`);

  // Verify anchoring tx via OnchainOS (okx-onchain-gateway skill)
  try {
    const txStatus = getTransactionStatus(txHash);
    if (txStatus.confirmations > 0) {
      log.info(`[okx-onchain-gateway] Anchor tx confirmed: block=${txStatus.blockNumber}, confirmations=${txStatus.confirmations}`);
    } else {
      log.info(`[okx-onchain-gateway] Anchor tx pending: status=${txStatus.status}`);
    }
  } catch {
    log.warn("[okx-onchain-gateway] Tx status check unavailable (non-fatal)");
  }

  const count = await anchor.getReportCount();
  log.info(`Total on-chain reports: ${count}`);

  return report;
}

async function main() {
  await initProxy();
  log.info("Ops Agent starting...");
  log.info(`Ops wallet: ${AGENT_WALLETS.ops.address}`);
  log.info(`Treasury signer: ${AGENT_WALLETS.treasury.address} (for anchoring)`);

  generator = new ReportGenerator(defaultDataProvider);
  anchor = new ReportAnchor();

  // Generate initial report
  try {
    await generateAndAnchor();
  } catch (err) {
    log.error("Failed to generate initial report", err);
  }

  let opsFired = false;

  // Schedule daily reports
  dailyTimer = setInterval(async () => {
    // Check if Ops agent is still active
    const status = await shouldExecute(AGENT_WALLETS.ops.agentId, "Ops");
    if (!status.active) {
      if (!opsFired) {
        opsFired = true;
        logDegradation("Ops", "paused",
          "Ops agent fired — daily reports paused. Economy cycle continues unaffected.");
      }
      return;
    }
    if (opsFired) {
      opsFired = false;
      log.info("Ops Agent REHIRED — resuming daily reports");
    }

    try {
      await generateAndAnchor();
    } catch (err) {
      log.error("Failed to generate daily report", err);
    }
  }, DAY_MS);

  log.info("Ops Agent running — daily reports scheduled");
}

// Graceful shutdown
function shutdown() {
  log.info("Shutting down Ops Agent...");
  if (dailyTimer) {
    clearInterval(dailyTimer);
    dailyTimer = null;
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  log.error("Fatal error", err);
  process.exit(1);
});

export { ReportGenerator } from "./report-gen.js";
export { ReportAnchor } from "./anchor.js";
export { formatReportMarkdown, formatXPost } from "./templates.js";
