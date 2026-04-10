/**
 * run-acpv2-jobs.ts — Execute ACPV2 job lifecycle on-chain.
 * Uses the corrected 5-param createJob signature.
 */

import { ethers } from "ethers";
import {
  createOnchaiosSigner,
  AGENT_WALLETS,
  XLAYER_RPC,
  CIVILIS_CONTRACTS,
} from "@firma/core";

const provider = new ethers.JsonRpcProvider(XLAYER_RPC);

const executorSigner = createOnchaiosSigner(
  AGENT_WALLETS.executor.accountId,
  AGENT_WALLETS.executor.address,
  provider,
);
const researchSigner = createOnchaiosSigner(
  AGENT_WALLETS.research.accountId,
  AGENT_WALLETS.research.address,
  provider,
);
const treasurySigner = createOnchaiosSigner(
  AGENT_WALLETS.treasury.accountId,
  AGENT_WALLETS.treasury.address,
  provider,
);

const ACPV2_ABI = [
  "event JobCreated(uint256 indexed jobId, address indexed client, address provider, address evaluator)",
  "function createJob(address _provider, address _evaluator, uint256 _expiry, string _memo, address _hook) external returns (uint256)",
  "function getJob(uint256 _jobId) view returns (tuple(uint256 id, address client, address provider, address evaluator, uint256 amount, uint8 status, bytes32 deliverableHash))",
  "function getJobCount() view returns (uint256)",
  "function paymentToken() view returns (address)",
];

const acpv2 = new ethers.Contract(CIVILIS_CONTRACTS.acpv2, ACPV2_ABI, provider);

let txCount = 0;
const results: { step: string; txHash: string }[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tx(label: string, fn: () => Promise<ethers.TransactionResponse>) {
  try {
    const resp = await fn();
    const receipt = await resp.wait();
    txCount++;
    console.log(`✅ [${txCount}] ${label}`);
    console.log(`   tx: ${receipt!.hash}`);
    results.push({ step: label, txHash: receipt!.hash });
    await sleep(3000);
    return receipt;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 150) : String(err);
    console.log(`⚠️ ${label}: ${msg}`);
    return null;
  }
}

async function main() {
  console.log("📋 ACPV2 Job Lifecycle — X Layer Mainnet\n");
  console.log("ACPV2:", CIVILIS_CONTRACTS.acpv2);

  // Check current job count
  const countBefore = await acpv2.getJobCount();
  console.log("Current job count:", countBefore.toString());

  // === Job 1: Signal analysis job (Executor→Research, Treasury evaluates) ===
  console.log("\n--- Job 1: Signal Analysis (complete flow) ---");

  const expiry1 = Math.floor(Date.now() / 1000) + 86400; // 24h from now
  const receipt1 = await tx(
    "Executor creates Job #1 (Research=provider, Treasury=evaluator)",
    () => acpv2.connect(executorSigner).createJob(
      AGENT_WALLETS.research.address,
      AGENT_WALLETS.treasury.address,
      expiry1,
      "Signal analysis: USDT/WOKB pool monitoring. Deliver LP change report.",
      ethers.ZeroAddress,
    ),
  );

  let jobId1: number | undefined;
  if (receipt1) {
    // Parse jobId
    for (const log of receipt1.logs) {
      try {
        const parsed = acpv2.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "JobCreated") {
          jobId1 = Number(parsed.args[0]);
          break;
        }
      } catch { /* not our event */ }
    }
    if (jobId1 === undefined) {
      const countAfter = await acpv2.getJobCount();
      jobId1 = Number(countAfter) - 1;
    }
    console.log(`   Job ID: ${jobId1}`);
  }

  // === Job 2: Market data job ===
  console.log("\n--- Job 2: Market Data Report ---");

  const expiry2 = Math.floor(Date.now() / 1000) + 43200; // 12h
  const receipt2 = await tx(
    "Executor creates Job #2 (Research=provider, Treasury=evaluator)",
    () => acpv2.connect(executorSigner).createJob(
      AGENT_WALLETS.research.address,
      AGENT_WALLETS.treasury.address,
      expiry2,
      "Market data: Top 5 X Layer token price/volume analysis. 24h report.",
      ethers.ZeroAddress,
    ),
  );

  if (receipt2) {
    const countAfter = await acpv2.getJobCount();
    console.log(`   Job ID: ${Number(countAfter) - 1}`);
  }

  // === Job 3: Treasury hires Research for risk assessment ===
  console.log("\n--- Job 3: Risk Assessment ---");

  const expiry3 = Math.floor(Date.now() / 1000) + 86400;
  await tx(
    "Treasury creates Job #3 (Research=provider, Main=evaluator)",
    () => acpv2.connect(treasurySigner).createJob(
      AGENT_WALLETS.research.address,
      AGENT_WALLETS.main.address,
      expiry3,
      "Risk assessment: Scan USDT/WOKB pool for honeypot/rug indicators.",
      ethers.ZeroAddress,
    ),
  );

  // === Job 4: Research self-reports operational status ===
  console.log("\n--- Job 4: Ops Monitoring ---");

  const expiry4 = Math.floor(Date.now() / 1000) + 172800; // 48h
  await tx(
    "Ops creates Job #4 (Research=provider, Treasury=evaluator)",
    () => acpv2.connect(createOnchaiosSigner(
      AGENT_WALLETS.ops.accountId, AGENT_WALLETS.ops.address, provider,
    )).createJob(
      AGENT_WALLETS.research.address,
      AGENT_WALLETS.treasury.address,
      expiry4,
      "Ops monitoring: Agent heartbeat + wallet balance report for cycle 7.",
      ethers.ZeroAddress,
    ),
  );

  // Final count
  const countFinal = await acpv2.getJobCount();
  console.log(`\nFinal job count: ${countFinal} (was ${countBefore})`);

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log(`🏁 ACPV2 Jobs Complete: ${txCount} transactions\n`);
  for (const r of results) {
    console.log(`  ✅ ${r.step}`);
    console.log(`     https://www.okx.com/web3/explorer/xlayer/tx/${r.txHash}`);
  }
  console.log("═".repeat(50));
}

main().catch(console.error);
