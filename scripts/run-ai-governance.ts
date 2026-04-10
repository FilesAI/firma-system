/**
 * run-ai-governance.ts — Demonstrate LLM-powered AI governance on X Layer.
 *
 * This script shows the "AI" in Firma's AI company:
 *   1. Research AI analyzes pool data → generates signal with LLM reasoning
 *   2. Treasury AI evaluates agent performance → LLM decides hire/fire
 *   3. Ops AI generates natural language report → LLM summarizes cycle
 *   4. All reasoning hashes anchored on-chain for auditable AI decisions
 *
 * Falls back to rule-based logic if no LLM API key is available.
 */

import { ethers } from "ethers";
import {
  createOnchaiosSigner,
  AGENT_WALLETS,
  FIRMA_CONTRACTS,
  XLAYER_RPC,
} from "@firma/core";
import {
  treasuryDecision,
  researchSignal,
  opsReport,
  type AgentPerformance,
  type TradeSignal,
} from "../packages/core/src/llm-brain.js";

const provider = new ethers.JsonRpcProvider(XLAYER_RPC);
const mainSigner = createOnchaiosSigner(AGENT_WALLETS.main.accountId, AGENT_WALLETS.main.address, provider);

const firma = new ethers.Contract(FIRMA_CONTRACTS.firmaCompany, [
  "function logDecision(uint256 _agentId, string _decisionType, string _detail) external",
  "function anchorOpsReport(bytes32 _contentHash) external",
  "function fireAgent(uint256 _agentId, string _reason) external",
  "function rehireAgent(uint256 _agentId, string _reason) external",
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
], provider);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const evidence: { phase: string; txHash: string; detail: string }[] = [];

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Firma — AI-Powered Governance (X Layer Mainnet)     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const hasLLM = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  console.log(`LLM Mode: ${hasLLM ? "API-powered" : "Rule-based fallback"}\n`);

  // ━━━ Phase 1: Research AI generates signal ━━━
  console.log("━━━ Phase 1: Research AI Signal Generation ━━━\n");

  const poolData: TradeSignal = {
    pool: "0x63d62734847e55a266fca4219a9ad0a02d5f6e02",
    pair: "USDT/WOKB",
    token0Reserve: "45000 USDT",
    token1Reserve: "530 WOKB",
    volume24h: "$12,500",
    priceChange24h: "+2.3%",
    lpFlowDirection: "inflow",
    lpFlowPercent: 8.5,
    largeSwapDetected: false,
  };

  const signal = await researchSignal(poolData);
  console.log(`  Signal: ${signal.decision}`);
  console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
  console.log(`  Model: ${signal.model}`);
  console.log(`  Reasoning: ${signal.reasoning.slice(0, 120)}...`);
  console.log(`  Hash: ${signal.reasoningHash.slice(0, 20)}...`);

  // Anchor signal reasoning on-chain
  const detail1 = `AI Signal: ${signal.decision} ${poolData.pair} (conf=${(signal.confidence * 100).toFixed(0)}%, model=${signal.model}). ReasoningHash: ${signal.reasoningHash.slice(0, 20)}`;
  const tx1 = await firma.connect(mainSigner).logDecision(1, "AI_SIGNAL", detail1.slice(0, 200));
  const r1 = await tx1.wait();
  evidence.push({ phase: "Research AI", txHash: r1!.hash, detail: `${signal.decision} signal, reasoning hash anchored` });
  console.log(`\n  ✅ On-chain: ${r1!.hash}`);
  await sleep(3000);

  // ━━━ Phase 2: Treasury AI evaluates agents ━━━
  console.log("\n━━━ Phase 2: Treasury AI Governance Decisions ━━━\n");

  const agents: AgentPerformance[] = [
    {
      agentId: 1, roleName: "Research",
      accuracy: 72, totalSignals: 25, profitableSignals: 18,
      avgSlippage: 0.0, recentTrend: "improving", currentBalance: "2.02 USDT",
    },
    {
      agentId: 2, roleName: "Executor",
      accuracy: 85, totalSignals: 20, profitableSignals: 17,
      avgSlippage: 0.3, recentTrend: "stable", currentBalance: "10.91 USDT",
    },
    {
      agentId: 3, roleName: "Treasury",
      accuracy: 90, totalSignals: 15, profitableSignals: 13,
      avgSlippage: 0.0, recentTrend: "stable", currentBalance: "2.10 USDT",
    },
  ];

  for (const agent of agents) {
    console.log(`  Evaluating ${agent.roleName} Agent #${agent.agentId}...`);
    const decision = await treasuryDecision(agent);
    console.log(`    Decision: ${decision.decision.toUpperCase()}`);
    console.log(`    Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    console.log(`    Model: ${decision.model}`);
    console.log(`    Reasoning: ${decision.reasoning.slice(0, 100)}...`);

    // Anchor governance decision on-chain
    const detail = `AI Governance: ${decision.decision.toUpperCase()} for ${agent.roleName} #${agent.agentId} (acc=${agent.accuracy}%, model=${decision.model}). Hash: ${decision.reasoningHash.slice(0, 20)}`;
    const tx = await firma.connect(mainSigner).logDecision(
      agent.agentId,
      "AI_GOVERNANCE",
      detail.slice(0, 200),
    );
    const receipt = await tx.wait();
    evidence.push({ phase: "Treasury AI", txHash: receipt!.hash, detail: `${decision.decision} decision for ${agent.roleName}` });
    console.log(`    ✅ On-chain: ${receipt!.hash}\n`);
    await sleep(3000);
  }

  // ━━━ Phase 3: Ops AI generates report ━━━
  console.log("━━━ Phase 3: Ops AI Report Generation ━━━\n");

  const report = await opsReport({
    cycleNumber: 8,
    transactions: 65,
    revenue: "0.16 USDT",
    expenses: "0.11 USDT",
    agentStatuses: [
      { id: 1, role: "Research", active: true, accuracy: 72 },
      { id: 2, role: "Executor", active: true, accuracy: 85 },
      { id: 3, role: "Treasury", active: true, accuracy: 90 },
      { id: 4, role: "Ops", active: true },
    ],
    governanceActions: ["AI evaluation of 3 agents", "signal generation", "trade evaluation"],
  });

  console.log(`  Model: ${report.model}`);
  console.log(`  Report:\n    ${report.reasoning.slice(0, 300).replace(/\n/g, "\n    ")}...`);

  // Anchor report on-chain
  const tx3 = await firma.connect(mainSigner).anchorOpsReport(report.reasoningHash);
  const r3 = await tx3.wait();
  evidence.push({ phase: "Ops AI", txHash: r3!.hash, detail: "AI-generated ops report anchored" });
  console.log(`\n  ✅ On-chain: ${r3!.hash}`);

  // ━━━ Summary ━━━
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║              AI GOVERNANCE EVIDENCE                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  for (const e of evidence) {
    console.log(`  [${e.phase}] ${e.detail}`);
    console.log(`    tx: ${e.txHash}`);
    console.log(`    🔗 https://www.okx.com/web3/explorer/xlayer/tx/${e.txHash}\n`);
  }

  console.log(`  Total AI decisions anchored: ${evidence.length}`);
  console.log(`  LLM mode: ${hasLLM ? "API-powered" : "Rule-based fallback"}`);
  console.log("\n══════════════════════════════════════════════════════════");
}

main().catch(console.error);
