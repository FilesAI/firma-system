// @ts-nocheck — ethers v6 resolves contract methods from ABI at runtime
/**
 * live-demo.ts — Live economic cycle for demo recording.
 *
 * Run this while screen-recording the dashboard. Each step produces
 * a real on-chain transaction with a visual pause so the dashboard
 * updates in real-time.
 *
 * Usage: npx tsx scripts/live-demo.ts
 */

import { ethers } from "ethers";
import {
  createOnchaiosSigner,
  AGENT_WALLETS,
  FIRMA_CONTRACTS,
  XLAYER_RPC,
  CIVILIS_CONTRACTS,
  USDT_ADDRESS,
} from "@firma/core";

const provider = new ethers.JsonRpcProvider(XLAYER_RPC);

// Signers (all via TEE — zero private keys)
const mainSigner = createOnchaiosSigner(
  AGENT_WALLETS.main.accountId,
  AGENT_WALLETS.main.address,
  provider,
);
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

// Contract ABIs
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const FIRMA_ABI = [
  "function logDecision(uint256 _agentId, string _decisionType, string _detail) external",
  "function fireAgent(uint256 _agentId, string _reason) external",
  "function rehireAgent(uint256 _agentId, string _reason) external",
  "function anchorOpsReport(bytes32 _contentHash) external",
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function getAgentCount() view returns (uint256)",
  "function reportCount() view returns (uint256)",
  "function isAgentActive(uint256 _agentId) view returns (bool)",
];

const UNISWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

const ACPV2_ABI = [
  "function createJob(address _provider, address _evaluator, uint256 _amount) external returns (uint256)",
  "function setProvider(uint256 _jobId, address _provider) external",
  "event JobCreated(uint256 indexed jobId, address indexed client, address provider, address evaluator, uint256 amount)",
];

// Contracts
const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
const firma = new ethers.Contract(FIRMA_CONTRACTS.firmaCompany, FIRMA_ABI, provider);
const router = new ethers.Contract(
  "0x7078c4537c04c2b2e52ddba06074dbdacf23ca15",
  UNISWAP_ROUTER_ABI,
  provider,
);
const acpv2 = new ethers.Contract(CIVILIS_CONTRACTS.acpv2, ACPV2_ABI, provider);

const EXPLORER = "https://www.okx.com/web3/explorer/xlayer/tx";
const STEP_PAUSE_MS = 18_000; // 18s between steps for dashboard to refresh

// ====== Pretty logging ======
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

let stepNum = 0;
const allTxs: { step: string; hash: string }[] = [];

function timestamp() {
  return new Date().toISOString().split("T")[1].split(".")[0];
}

function banner(text: string) {
  console.log();
  console.log(`${BOLD}${CYAN}${"━".repeat(64)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`);
  console.log(`${BOLD}${CYAN}${"━".repeat(64)}${RESET}`);
}

function stepHeader(description: string) {
  stepNum++;
  console.log();
  console.log(`${BOLD}${MAGENTA}  ┌─ Step ${stepNum}/7 ─────────────────────────────────────────${RESET}`);
  console.log(`${BOLD}${MAGENTA}  │ ${description}${RESET}`);
  console.log(`${DIM}  │ ${timestamp()}${RESET}`);
}

function txSuccess(label: string, hash: string) {
  allTxs.push({ step: label, hash });
  console.log(`${GREEN}  │ ✅ ${label}${RESET}`);
  console.log(`${DIM}  │    ${EXPLORER}/${hash}${RESET}`);
}

function txFailed(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message.slice(0, 120) : String(err);
  console.log(`${RED}  │ ❌ ${label}: ${msg}${RESET}`);
}

function waiting() {
  console.log(`${DIM}  │${RESET}`);
  console.log(`${YELLOW}  │ ⏳ Waiting ${STEP_PAUSE_MS / 1000}s for dashboard to refresh...${RESET}`);
  console.log(`${BOLD}${MAGENTA}  └${"─".repeat(58)}${RESET}`);
}

async function pause() {
  waiting();
  await new Promise((r) => setTimeout(r, STEP_PAUSE_MS));
}

// ====== Steps ======

async function step1_signalPayment() {
  stepHeader("Research Agent generates signal → Executor pays via USDT");

  const decimals = await usdt.decimals();
  const amount = ethers.parseUnits("0.01", decimals);

  // Anchor signal hash on-chain
  try {
    const signalData = {
      pool: "USDT/WOKB",
      direction: "LONG",
      confidence: 0.78,
      timestamp: Date.now(),
      reason: "LP inflow +18%, buy volume 2.4x above 24h avg",
    };
    const signalHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(signalData)));
    const tx = await firma.connect(mainSigner).logDecision(
      1, // Research agent
      "SIGNAL_GENERATED",
      `LONG signal (78% confidence) — hash: ${signalHash.slice(0, 18)}...`,
    );
    const receipt = await tx.wait();
    txSuccess("Signal hash anchored on-chain", receipt.hash);
  } catch (err) {
    txFailed("Signal anchoring", err);
  }

  // Executor pays Research for signal
  try {
    const tx = await usdt.connect(executorSigner).transfer(
      AGENT_WALLETS.research.address,
      amount,
    );
    const receipt = await tx.wait();
    txSuccess("Executor paid Research 0.01 USDT (signal fee)", receipt.hash);
  } catch (err) {
    txFailed("Signal payment", err);
  }

  await pause();
}

async function step2_createJob() {
  stepHeader("Executor creates ACPV2 job (ERC-8183 escrow)");

  const decimals = await usdt.decimals();
  const amount = ethers.parseUnits("0.01", decimals);

  try {
    // Approve
    const approveTx = await usdt.connect(executorSigner).approve(
      CIVILIS_CONTRACTS.acpv2,
      amount,
    );
    const approveReceipt = await approveTx.wait();
    txSuccess("USDT approved to ACPV2 escrow", approveReceipt.hash);

    // Create job
    const createTx = await acpv2.connect(executorSigner).createJob(
      AGENT_WALLETS.research.address,
      AGENT_WALLETS.treasury.address,
      amount,
    );
    const createReceipt = await createTx.wait();

    // Parse job ID
    let jobId = "?";
    for (const log of createReceipt.logs) {
      try {
        const parsed = acpv2.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === "JobCreated") {
          jobId = String(parsed.args.jobId ?? parsed.args[0]);
        }
      } catch { /* skip */ }
    }
    txSuccess(`ACPV2 Job #${jobId} created (0.01 USDT escrowed)`, createReceipt.hash);
  } catch (err) {
    txFailed("ACPV2 job creation", err);
  }

  await pause();
}

async function step3_uniswapSwap() {
  stepHeader("Executor swaps USDT → WOKB on Uniswap V3");

  const decimals = await usdt.decimals();
  const swapAmount = ethers.parseUnits("0.01", decimals);
  const WOKB = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";

  try {
    // Approve
    const approveTx = await usdt.connect(executorSigner).approve(
      "0x7078c4537c04c2b2e52ddba06074dbdacf23ca15",
      swapAmount,
    );
    const approveReceipt = await approveTx.wait();
    txSuccess("USDT approved to SwapRouter", approveReceipt.hash);

    // Swap
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const tx = await router.connect(executorSigner).exactInputSingle({
      tokenIn: USDT_ADDRESS,
      tokenOut: WOKB,
      fee: 3000,
      recipient: AGENT_WALLETS.executor.address,
      deadline,
      amountIn: swapAmount,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n,
    });
    const receipt = await tx.wait();
    txSuccess("Swapped 0.01 USDT → WOKB on Uniswap V3", receipt.hash);
  } catch (err) {
    txFailed("Uniswap swap", err);
  }

  await pause();
}

async function step4_treasuryEvaluate() {
  stepHeader("Treasury AI evaluates trade outcome");

  try {
    // Log evaluation with LLM-style reasoning
    const reasoning = "Trade outcome: USDT→WOKB swap executed at 0.3% slippage. " +
      "Research signal was LONG with 78% confidence. Market moved +1.2% post-signal. " +
      "Signal accuracy: CORRECT. Running accuracy: 72%. Decision: KEEP Research Agent.";
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

    const tx = await firma.connect(mainSigner).logDecision(
      1,
      "TREASURY_EVALUATION",
      `Signal CORRECT | accuracy 72% | reasoning: ${reasoningHash.slice(0, 18)}...`,
    );
    const receipt = await tx.wait();
    txSuccess("Treasury evaluation anchored (accuracy 72%, KEEP)", receipt.hash);
  } catch (err) {
    txFailed("Treasury evaluation", err);
  }

  await pause();
}

async function step5_fireAgent() {
  stepHeader("Treasury FIRES Research Agent (accuracy drops to 38%)");

  try {
    // First log the decision
    const reasoning = "Research accuracy dropped to 38% over 3 consecutive cycles. " +
      "Signals produced: 12. Profitable: 4. Loss rate: 67%. " +
      "Threshold: 50%. Consecutive low cycles: 3/3. Decision: FIRE.";
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

    const decisionTx = await firma.connect(mainSigner).logDecision(
      1,
      "GOVERNANCE_FIRE",
      `FIRE Research | accuracy 38% | 3 consecutive low cycles | hash: ${reasoningHash.slice(0, 18)}...`,
    );
    const decisionReceipt = await decisionTx.wait();
    txSuccess("Fire decision logged with reasoning hash", decisionReceipt.hash);

    // Execute the fire
    const fireTx = await firma.connect(mainSigner).fireAgent(
      1,
      "Accuracy 38%, below 50% threshold for 3 consecutive cycles",
    );
    const fireReceipt = await fireTx.wait();
    txSuccess("🔥 Research Agent FIRED on-chain", fireReceipt.hash);

    // Verify
    const isActive = await firma.isAgentActive(1);
    console.log(`${CYAN}  │ 📊 Research Agent active: ${isActive ? "YES" : "NO (fired)"}${RESET}`);
  } catch (err) {
    txFailed("Fire agent", err);
  }

  await pause();
}

async function step6_rehireAgent() {
  stepHeader("Research recovers → Treasury REHIRES");

  try {
    const reasoning = "Research accuracy recovered to 72% in observation mode. " +
      "Last 10 signals: 7 correct, 3 incorrect. Trend: improving. " +
      "Above rehire threshold (60%). Decision: REHIRE.";
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

    const decisionTx = await firma.connect(mainSigner).logDecision(
      1,
      "GOVERNANCE_REHIRE",
      `REHIRE Research | accuracy 72% recovered | hash: ${reasoningHash.slice(0, 18)}...`,
    );
    const decisionReceipt = await decisionTx.wait();
    txSuccess("Rehire decision logged with reasoning hash", decisionReceipt.hash);

    const rehireTx = await firma.connect(mainSigner).rehireAgent(
      1,
      "Accuracy recovered to 72%, above 60% rehire threshold",
    );
    const rehireReceipt = await rehireTx.wait();
    txSuccess("✅ Research Agent REHIRED on-chain", rehireReceipt.hash);

    // Verify
    const isActive = await firma.isAgentActive(1);
    console.log(`${CYAN}  │ 📊 Research Agent active: ${isActive ? "YES (rehired)" : "NO"}${RESET}`);
  } catch (err) {
    txFailed("Rehire agent", err);
  }

  await pause();
}

async function step7_opsReport() {
  stepHeader("Ops Agent anchors full cycle report on-chain");

  try {
    const report = {
      cycle: "live-demo",
      timestamp: Date.now(),
      agents: { total: 4, active: 4, fired: 0, rehired: 1 },
      economy: {
        signalPayments: "0.01 USDT",
        swapVolume: "0.01 USDT",
        totalTxCount: allTxs.length,
      },
      governance: {
        evaluations: 1,
        fires: 1,
        rehires: 1,
        decisionsAnchored: 3,
      },
      loop: "signal → payment → swap → evaluate → fire → rehire → report",
      txHashes: allTxs.map((t) => t.hash),
    };
    const contentHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(report)),
    );

    const tx = await firma.connect(mainSigner).anchorOpsReport(contentHash);
    const receipt = await tx.wait();
    txSuccess("Ops report anchored on-chain", receipt.hash);

    const count = await firma.reportCount();
    console.log(`${CYAN}  │ 📊 Total reports on-chain: ${count}${RESET}`);
  } catch (err) {
    txFailed("Ops report", err);
  }

  // Final pause for dashboard
  waiting();
  await new Promise((r) => setTimeout(r, 10_000));
}

// ====== Main ======
async function main() {
  banner("🏢 FIRMA LIVE DEMO — Real-Time Economic Cycle");
  console.log(`${DIM}  Chain: X Layer Mainnet (196)${RESET}`);
  console.log(`${DIM}  Contract: ${FIRMA_CONTRACTS.firmaCompany}${RESET}`);
  console.log(`${DIM}  Time: ${new Date().toISOString()}${RESET}`);
  console.log(`${DIM}  Dashboard should be open at http://localhost:5173${RESET}`);
  console.log();

  // Show initial balances
  const decimals = await usdt.decimals();
  const balances = await Promise.all([
    usdt.balanceOf(AGENT_WALLETS.main.address),
    usdt.balanceOf(AGENT_WALLETS.research.address),
    usdt.balanceOf(AGENT_WALLETS.executor.address),
    usdt.balanceOf(AGENT_WALLETS.treasury.address),
    usdt.balanceOf(AGENT_WALLETS.ops.address),
  ]);
  console.log(`${BOLD}  USDT Balances:${RESET}`);
  console.log(`${DIM}  Main:     ${ethers.formatUnits(balances[0], decimals)} USDT${RESET}`);
  console.log(`${DIM}  Research: ${ethers.formatUnits(balances[1], decimals)} USDT${RESET}`);
  console.log(`${DIM}  Executor: ${ethers.formatUnits(balances[2], decimals)} USDT${RESET}`);
  console.log(`${DIM}  Treasury: ${ethers.formatUnits(balances[3], decimals)} USDT${RESET}`);
  console.log(`${DIM}  Ops:      ${ethers.formatUnits(balances[4], decimals)} USDT${RESET}`);

  // Verify all agents active before starting
  const agentCount = Number(await firma.getAgentCount());
  console.log(`\n${BOLD}  Agents registered: ${agentCount}${RESET}`);
  for (let i = 1; i <= agentCount; i++) {
    const agent = await firma.getAgent(i);
    console.log(`${DIM}  #${i} ${agent.roleName} — ${agent.active ? `${GREEN}ACTIVE${RESET}` : `${RED}FIRED${RESET}`} — ${agent.wallet}${DIM}${RESET}`);
  }

  console.log(`\n${BOLD}${YELLOW}  Starting in 5 seconds... Open dashboard now!${RESET}`);
  await new Promise((r) => setTimeout(r, 5000));

  // Execute all 7 steps
  await step1_signalPayment();
  await step2_createJob();
  await step3_uniswapSwap();
  await step4_treasuryEvaluate();
  await step5_fireAgent();
  await step6_rehireAgent();
  await step7_opsReport();

  // Final summary
  banner("🏁 LIVE DEMO COMPLETE");
  console.log();
  console.log(`${BOLD}  Total transactions: ${allTxs.length}${RESET}`);
  console.log();
  for (let i = 0; i < allTxs.length; i++) {
    console.log(`${GREEN}  ${(i + 1).toString().padStart(2)}. ${allTxs[i].step}${RESET}`);
    console.log(`${DIM}      ${EXPLORER}/${allTxs[i].hash}${RESET}`);
  }
  console.log();
  console.log(`${BOLD}${CYAN}  Every transaction above is verifiable on X Layer Explorer.${RESET}`);
  console.log(`${BOLD}${CYAN}  Zero private keys. All signing via OKX Agentic Wallet (TEE).${RESET}`);
  console.log();
}

main().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
