import type { OpsReport } from "@firma/core";

export function formatReportMarkdown(report: OpsReport): string {
  const lines = [
    `# Firma Daily Ops Report #${report.reportId}`,
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Revenue | $${report.revenue.toFixed(2)} |`,
    `| Expenses | $${report.expenses.toFixed(2)} |`,
    `| Net Profit | $${report.netProfit.toFixed(2)} |`,
    `| Jobs Completed | ${report.jobsCompleted} |`,
    `| Jobs Rejected | ${report.jobsRejected} |`,
    `| Signal Accuracy | ${(report.signalAccuracy * 100).toFixed(1)}% |`,
    "",
    "## HR Decisions",
    "",
  ];

  if (report.hrDecisions.length === 0) {
    lines.push("_No HR decisions this period._");
  } else {
    for (const decision of report.hrDecisions) {
      lines.push(`- ${decision}`);
    }
  }

  lines.push(
    "",
    "---",
    `Generated at: ${report.generatedAt}`,
    `Content Hash: \`${report.contentHash}\``,
  );

  return lines.join("\n");
}

export function formatXPost(report: OpsReport, dayNumber: number): string {
  const profitEmoji = report.netProfit >= 0 ? "+" : "";
  return [
    `Firma Day ${dayNumber} Ops Report`,
    `Revenue: $${report.revenue.toFixed(2)}`,
    `P&L: ${profitEmoji}$${report.netProfit.toFixed(2)}`,
    `Jobs: ${report.jobsCompleted} done, ${report.jobsRejected} rejected`,
    `Signal accuracy: ${(report.signalAccuracy * 100).toFixed(1)}%`,
    `HR: ${report.hrDecisions.length} decisions`,
    `On-chain hash: ${report.contentHash.slice(0, 10)}...`,
    `#XLayer #Firma`,
  ].join("\n");
}
