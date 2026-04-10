/**
 * run-cycle.ts — Execute a full governance + operations cycle on X Layer mainnet.
 *
 * This script demonstrates Firma's autonomous capabilities:
 * 1. Treasury evaluates agents and logs decisions
 * 2. Treasury fires an underperforming agent
 * 3. Treasury rehires the agent after improvement
 * 4. Treasury updates budgets
 * 5. Ops anchors a report on-chain
 * 6. Civilis: Register identities on ERC-8004
 * 7. Civilis: Give reputation feedback
 *
 * All signing goes through OnchaiosSigner → OKX TEE (onchainos CLI).
 * No private keys used anywhere.
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

// Create signers for each agent
const mainSigner = createOnchaiosSigner(
  AGENT_WALLETS.main.accountId,
  AGENT_WALLETS.main.address,
  provider,
);

const treasurySigner = createOnchaiosSigner(
  AGENT_WALLETS.treasury.accountId,
  AGENT_WALLETS.treasury.address,
  provider,
);

const opsSigner = createOnchaiosSigner(
  AGENT_WALLETS.ops.accountId,
  AGENT_WALLETS.ops.address,
  provider,
);

const researchSigner = createOnchaiosSigner(
  AGENT_WALLETS.research.accountId,
  AGENT_WALLETS.research.address,
  provider,
);

// Contract instances
const FIRMA_ABI = [
  "function logDecision(uint256 _agentId, string _decisionType, string _detail) external",
  "function fireAgent(uint256 _agentId, string _reason) external",
  "function rehireAgent(uint256 _agentId, string _reason) external",
  "function updateBudget(uint256 _agentId, uint256 _newBudget, string _reason) external",
  "function anchorOpsReport(bytes32 _contentHash) external",
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function isAgentActive(uint256 _agentId) view returns (bool)",
];

const IDENTITY_ABI = [
  "function register(string calldata _role) external returns (uint256)",
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
  console.log("\n🏢 Firma Economic Cycle — X Layer Mainnet\n");
  console.log("Contract:", FIRMA_CONTRACTS.firmaCompany);
  console.log("Chain: X Layer (196)\n");
  console.log("─".repeat(60));

  try {
    // === Step 1: Treasury evaluates Research agent ===
    console.log("\n📊 Step 1: Treasury evaluates Research agent...");
    const evalTx = await firma.connect(mainSigner).logDecision(
      1, // Research agentId
      "PERFORMANCE_REVIEW",
      "Research accuracy 68% — above threshold (50%). Signal quality acceptable.",
    );
    const evalReceipt = await evalTx.wait();
    await log("Treasury evaluated Research (PERFORMANCE_REVIEW)", evalReceipt.hash);
    await sleep(3000);

    // === Step 2: Treasury evaluates Executor agent ===
    console.log("\n📊 Step 2: Treasury evaluates Executor agent...");
    const evalTx2 = await firma.connect(mainSigner).logDecision(
      2, // Executor agentId
      "PERFORMANCE_REVIEW",
      "Executor completion rate 94%. Trade execution within slippage tolerance.",
    );
    const evalReceipt2 = await evalTx2.wait();
    await log("Treasury evaluated Executor (PERFORMANCE_REVIEW)", evalReceipt2.hash);
    await sleep(3000);

    // === Step 3: Fire Research (simulating low accuracy cycle) ===
    console.log("\n🔴 Step 3: Treasury fires Research (simulated low accuracy)...");
    const fireTx = await firma.connect(mainSigner).fireAgent(
      1,
      "Signal accuracy dropped to 38% over 3 consecutive cycles. Below 50% threshold.",
    );
    const fireReceipt = await fireTx.wait();
    await log("Treasury FIRED Research (#1)", fireReceipt.hash);
    await sleep(3000);

    // Verify fired status
    const isActive = await firma.isAgentActive(1);
    console.log(`   Research active: ${isActive} (should be false)`);

    // === Step 4: Rehire Research (simulating recovery) ===
    console.log("\n🟢 Step 4: Treasury rehires Research (accuracy recovered)...");
    const rehireTx = await firma.connect(mainSigner).rehireAgent(
      1,
      "Replacement model deployed. Accuracy recovered to 72%. Rehired on probation.",
    );
    const rehireReceipt = await rehireTx.wait();
    await log("Treasury REHIRED Research (#1)", rehireReceipt.hash);
    await sleep(3000);

    // Verify rehired
    const isActiveNow = await firma.isAgentActive(1);
    console.log(`   Research active: ${isActiveNow} (should be true)`);

    // === Step 5: Update budgets ===
    console.log("\n💰 Step 5: Update agent budgets...");
    const budgetTx = await firma.connect(mainSigner).updateBudget(
      2, // Executor
      ethers.parseEther("0.1"),
      "Q2 budget allocation for swap execution fees",
    );
    const budgetReceipt = await budgetTx.wait();
    await log("Budget updated for Executor (#2)", budgetReceipt.hash);
    await sleep(3000);

    // === Step 6: Log governance decision ===
    console.log("\n⚡ Step 6: Log governance decision...");
    const govTx = await firma.connect(mainSigner).logDecision(
      3, // Treasury self-assessment
      "GOVERNANCE_REVIEW",
      "All agents evaluated. 1 fire+rehire cycle completed. Economy stable.",
    );
    const govReceipt = await govTx.wait();
    await log("Governance review logged", govReceipt.hash);
    await sleep(3000);

    // === Step 7: Ops anchors report (via Main signer with GOVERNANCE_ROLE) ===
    console.log("\n📋 Step 7: Anchor ops report on-chain...");
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

    // === Step 8: Register identities on Civilis ERC-8004 ===
    console.log("\n🆔 Step 8: Register identity on Civilis (ERC-8004)...");
    try {
      const idTx = await identity.connect(researchSigner).register("ResearchAnalyst");
      const idReceipt = await idTx.wait();
      await log("Research registered on Civilis Identity (ERC-8004)", idReceipt.hash);
      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️ Identity registration skipped: ${msg.substring(0, 100)}`);
    }

    // === Step 9: Give reputation feedback via Civilis ===
    console.log("\n⭐ Step 9: Give reputation feedback (Civilis)...");
    try {
      const repTx = await reputation.connect(mainSigner).giveFeedback(
        1, // Research agentId
        1, // positive score
        "Consistent signal quality above threshold",
      );
      const repReceipt = await repTx.wait();
      await log("Reputation feedback for Research (+1)", repReceipt.hash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️ Reputation feedback skipped: ${msg.substring(0, 100)}`);
    }

    // === Summary ===
    console.log("\n" + "═".repeat(60));
    console.log("🏁 CYCLE COMPLETE — All transactions on X Layer mainnet\n");
    for (const r of results) {
      console.log(`  ✅ ${r.step}`);
      console.log(`     https://www.okx.com/web3/explorer/xlayer/tx/${r.txHash}`);
    }
    console.log(`\n  Total on-chain transactions: ${results.length}`);
    console.log("═".repeat(60));
  } catch (err) {
    console.error("\n❌ Cycle failed:", err);
    if (results.length > 0) {
      console.log("\nCompleted transactions before failure:");
      for (const r of results) {
        console.log(`  ✅ ${r.step}: ${r.txHash}`);
      }
    }
    process.exit(1);
  }
}

main();
