/**
 * run-uniswap-swap.ts — Execute a real Uniswap V3 swap on X Layer Mainnet.
 *
 * Swaps USDT → WOKB via the official Uniswap V3 SwapRouter.
 *
 * Pool: WOKB/USDT (fee=3000) at 0x63d62734847e55a266fca4219a9ad0a02d5f6e02
 * SwapRouter: 0x7078c4537c04c2b2e52ddba06074dbdacf23ca15
 * Factory: 0x4b2ab38dbf28d31d467aa8993f6c2585981d6804
 */

import { ethers } from "ethers";
import {
  createOnchaiosSigner,
  AGENT_WALLETS,
  XLAYER_RPC,
} from "@firma/core";

const provider = new ethers.JsonRpcProvider(XLAYER_RPC);

// Official Uniswap V3 deployment on X Layer
const SWAP_ROUTER = "0x7078c4537c04c2b2e52ddba06074dbdacf23ca15";
const USDT = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const WOKB = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";
const POOL_FEE = 3000;

const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("🔄 Uniswap V3 Swap — X Layer Mainnet\n");
  console.log(`SwapRouter: ${SWAP_ROUTER}`);
  console.log(`Pool: USDT/WOKB (fee=${POOL_FEE})`);
  console.log(`Pool address: 0x63d62734847e55a266fca4219a9ad0a02d5f6e02\n`);

  const executorSigner = createOnchaiosSigner(
    AGENT_WALLETS.executor.accountId,
    AGENT_WALLETS.executor.address,
    provider,
  );

  const usdt = new ethers.Contract(USDT, ERC20_ABI, provider);
  const wokb = new ethers.Contract(WOKB, ERC20_ABI, provider);

  // Check balances before
  const usdtDecimals = await usdt.decimals();
  const wokbDecimals = await wokb.decimals();
  const usdtBalBefore = await usdt.balanceOf(AGENT_WALLETS.executor.address);
  const wokbBalBefore = await wokb.balanceOf(AGENT_WALLETS.executor.address);

  console.log("=== Before Swap ===");
  console.log(`  USDT: ${ethers.formatUnits(usdtBalBefore, usdtDecimals)}`);
  console.log(`  WOKB: ${ethers.formatUnits(wokbBalBefore, wokbDecimals)}`);

  // Swap 0.01 USDT → WOKB (small amount to minimize risk)
  const swapAmount = ethers.parseUnits("0.01", usdtDecimals);
  console.log(`\nSwapping ${ethers.formatUnits(swapAmount, usdtDecimals)} USDT → WOKB...`);

  // Step 1: Approve USDT to SwapRouter
  console.log("\n1. Approving USDT to SwapRouter...");
  const approveTx = await usdt.connect(executorSigner).approve(SWAP_ROUTER, swapAmount);
  const approveReceipt = await approveTx.wait();
  console.log(`   ✅ Approved: ${approveReceipt!.hash}`);
  console.log(`   https://www.okx.com/web3/explorer/xlayer/tx/${approveReceipt!.hash}`);
  await sleep(3000);

  // Step 2: Execute swap via exactInputSingle
  console.log("\n2. Executing swap...");
  const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, executorSigner);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

  const swapParams = {
    tokenIn: USDT,
    tokenOut: WOKB,
    fee: POOL_FEE,
    recipient: AGENT_WALLETS.executor.address,
    deadline,
    amountIn: swapAmount,
    amountOutMinimum: 0n, // Accept any amount (small test trade)
    sqrtPriceLimitX96: 0n,
  };

  const swapTx = await router.exactInputSingle(swapParams);
  const swapReceipt = await swapTx.wait();
  console.log(`   ✅ Swap executed: ${swapReceipt!.hash}`);
  console.log(`   https://www.okx.com/web3/explorer/xlayer/tx/${swapReceipt!.hash}`);
  await sleep(3000);

  // Check balances after
  const usdtBalAfter = await usdt.balanceOf(AGENT_WALLETS.executor.address);
  const wokbBalAfter = await wokb.balanceOf(AGENT_WALLETS.executor.address);

  console.log("\n=== After Swap ===");
  console.log(`  USDT: ${ethers.formatUnits(usdtBalAfter, usdtDecimals)} (was ${ethers.formatUnits(usdtBalBefore, usdtDecimals)})`);
  console.log(`  WOKB: ${ethers.formatUnits(wokbBalAfter, wokbDecimals)} (was ${ethers.formatUnits(wokbBalBefore, wokbDecimals)})`);

  const wokbReceived = wokbBalAfter - wokbBalBefore;
  console.log(`\n  WOKB received: ${ethers.formatUnits(wokbReceived, wokbDecimals)}`);

  console.log("\n" + "═".repeat(50));
  console.log("🏁 Uniswap V3 Swap Complete!");
  console.log("═".repeat(50));
}

main().catch((err) => {
  console.error("❌ Swap failed:", err.message);
  process.exit(1);
});
