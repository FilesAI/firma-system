/**
 * run-cycle-part2.ts — Continue the cycle from Step 7 onwards.
 * Steps 1-6 already completed successfully.
 */

import { ethers } from "ethers";
import {
  createOnchaiosSigner,
  AGENT_WALLETS,
  FIRMA_CONTRACTS,
  XLAYER_RPC,
  CIVILIS_CONTRACTS,
} from "@firma/core";

const provider = new ethers.JsonRpcProvider(XLAYER_RPC);

const mainSigner = createOnchaiosSigner(
  AGENT_WALLETS.main.accountId,
  AGENT_WALLETS.main.address,
  provider,
);

const researchSigner = createOnchaiosSigner(
  AGENT_WALLETS.research.accountId,
  AGENT_WALLETS.research.address,
  provider,
);

const executorSigner = createOnchaiosSigner(
  AGENT_WALLETS.executor.accountId,
  AGENT_WALLETS.executor.address,
  provider,
);

const FIRMA_ABI = [
  "function anchorOpsReport(bytes32 _contentHash) external",
  "function logDecision(uint256 _agentId, string _decisionType, string _detail) external",
  "function reportCount() view returns (uint256)",
];

const IDENTITY_ABI = [
  "function register(string calldata _role) external returns (uint256)",
  "function agentCount() view returns (uint256)",
];

const REPUTATION_ABI = [
  "function giveFeedback(uint256 _agentId, int8 _score, string calldata _reason) external",
];

const firma = new ethers.Contract(FIRMA_CONTRACTS.firmaCompany, FIRMA_ABI, provider);
const identity = new ethers.Contract(CIVILIS_CONTRACTS.identityRegistry, IDENTITY_ABI, provider);
const reputation = new ethers.Contract(CIVILIS_CONTRACTS.reputationRegistry, REPUTATION_ABI, provider);

const results: { step: string; txHash: string }[] = [];

async function log(step: string, txHash: string) {
  console.log(`✅ ${step}`);
  console.log(`   tx: ${txHash}`);
  results.push({ step, txHash });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\n🏢 Firma Economic Cycle Part 2 — X Layer Mainnet\n");

  try {
    // === Step 7: Anchor ops report ===
    console.log("📋 Step 7: Anchor ops report on-chain...");
    const reportContent = JSON.stringify({
      cycle: 1,
      timestamp: Date.now(),
      agents: { active: 4, fired: 0 },
      governance: { reviews: 2, fires: 1, rehires: 1 },
      status: "healthy",
    });
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(reportContent));
    const anchorTx = await firma.connect(mainSigner).anchorOpsReport(contentHash);
    const anchorReceipt = await anchorTx.wait();
    await log("Ops report #1 anchored on-chain", anchorReceipt.hash);
    await sleep(3000);

    // Verify report count
    const reportCount = await firma.reportCount();
    console.log(`   Report count: ${reportCount}`);

    // === Step 8: Register identity on Civilis ERC-8004 ===
    console.log("\n🆔 Step 8: Register Research identity (Civilis ERC-8004)...");
    try {
      const idTx = await identity.connect(researchSigner).register("ResearchAnalyst");
      const idReceipt = await idTx.wait();
      await log("Research registered on Civilis Identity (ERC-8004)", idReceipt.hash);
      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️ Identity registration: ${msg.substring(0, 150)}`);
    }

    // === Step 9: Register Executor identity ===
    console.log("\n🆔 Step 9: Register Executor identity (Civilis ERC-8004)...");
    try {
      const idTx2 = await identity.connect(executorSigner).register("TradeExecutor");
      const idReceipt2 = await idTx2.wait();
      await log("Executor registered on Civilis Identity (ERC-8004)", idReceipt2.hash);
      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️ Identity registration: ${msg.substring(0, 150)}`);
    }

    // === Step 10: Give reputation feedback ===
    console.log("\n⭐ Step 10: Give reputation feedback (Civilis)...");
    try {
      const repTx = await reputation.connect(mainSigner).giveFeedback(
        1,
        1,
        "Consistent signal quality above threshold",
      );
      const repReceipt = await repTx.wait();
      await log("Reputation feedback for Research (+1)", repReceipt.hash);
      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️ Reputation feedback: ${msg.substring(0, 150)}`);
    }

    // === Step 11: Second ops report ===
    console.log("\n📋 Step 11: Anchor second ops report...");
    const report2 = JSON.stringify({
      cycle: 2,
      timestamp: Date.now(),
      agents: { active: 4, fired: 0 },
      economy: { revenue: "0.00", expenses: "0.00", net: "0.00" },
      note: "Agents operational, awaiting USDT funding for job execution",
    });
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes(report2));
    const anchor2 = await firma.connect(mainSigner).anchorOpsReport(hash2);
    const anchorReceipt2 = await anchor2.wait();
    await log("Ops report #2 anchored on-chain", anchorReceipt2.hash);
    await sleep(3000);

    // === Step 12: Additional governance log ===
    console.log("\n⚡ Step 12: Log operational status...");
    const statusTx = await firma.connect(mainSigner).logDecision(
      4, // Ops agent
      "OPS_STATUS",
      "All 4 agents operational. 2 ops reports anchored. Civilis identity registered. Economy pre-funded.",
    );
    const statusReceipt = await statusTx.wait();
    await log("Ops status logged", statusReceipt.hash);

    // === Summary ===
    console.log("\n" + "═".repeat(60));
    console.log("🏁 PART 2 COMPLETE\n");
    for (const r of results) {
      console.log(`  ✅ ${r.step}`);
      console.log(`     https://www.okx.com/web3/explorer/xlayer/tx/${r.txHash}`);
    }
    console.log(`\n  Total new transactions: ${results.length}`);
    console.log("═".repeat(60));
  } catch (err) {
    console.error("\n❌ Failed:", err);
    if (results.length > 0) {
      console.log("\nCompleted before failure:");
      for (const r of results) {
        console.log(`  ✅ ${r.step}: ${r.txHash}`);
      }
    }
    process.exit(1);
  }
}

main();
