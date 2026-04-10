import { ethers } from "ethers";
import { ONCHAINOS_API, XLAYER_RPC } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("OnchainOS");

// ====== DEX Data API ======

export interface PoolData {
  poolAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  totalLiquidity: string;
  volume24h: string;
  priceToken0InToken1: string;
}

export interface SwapEvent {
  txHash: string;
  sender: string;
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  timestamp: number;
}

export async function getPoolData(poolAddress: string): Promise<PoolData | null> {
  try {
    const url = `${ONCHAINOS_API.baseUrl}/dex/aggregator/pool-info?chainId=196&poolAddress=${poolAddress}`;
    const response = await fetch(url, {
      headers: {
        "OK-ACCESS-KEY": ONCHAINOS_API.apiKey,
        "OK-ACCESS-PASSPHRASE": ONCHAINOS_API.passphrase,
      },
    });
    const data = await response.json();
    if (data.code === "0" && data.data?.length > 0) {
      return data.data[0] as PoolData;
    }
    return null;
  } catch (error) {
    log.error("Failed to fetch pool data", error);
    return null;
  }
}

export async function getRecentSwaps(
  poolAddress: string,
  limit = 10,
): Promise<SwapEvent[]> {
  try {
    const url = `${ONCHAINOS_API.baseUrl}/dex/aggregator/swap-history?chainId=196&poolAddress=${poolAddress}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        "OK-ACCESS-KEY": ONCHAINOS_API.apiKey,
        "OK-ACCESS-PASSPHRASE": ONCHAINOS_API.passphrase,
      },
    });
    const data = await response.json();
    if (data.code === "0" && data.data) {
      return data.data as SwapEvent[];
    }
    return [];
  } catch (error) {
    log.error("Failed to fetch recent swaps", error);
    return [];
  }
}

// ====== Uniswap Skill ======

const UNISWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function exactOutputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
];

// Uniswap V3 SwapRouter on X Layer
const UNISWAP_ROUTER_ADDRESS =
  process.env.UNISWAP_ROUTER || "0x0a6513e40db6EB1b165753AD52E80663aeA50545";

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  fee?: number;
  slippageBps?: number;
}

export async function executeSwap(
  signer: ethers.Signer,
  params: SwapParams,
): Promise<{ txHash: string; amountOut: string }> {
  const router = new ethers.Contract(
    UNISWAP_ROUTER_ADDRESS,
    UNISWAP_ROUTER_ABI,
    signer,
  );

  const fee = params.fee || 3000;

  // Get decimals for proper formatting
  const tokenInContract = new ethers.Contract(
    params.tokenIn,
    ["function decimals() view returns (uint8)"],
    signer.provider,
  );
  const decimalsIn = await tokenInContract.decimals();
  const amountInWei = ethers.parseUnits(params.amountIn, decimalsIn);

  // Approve router
  const tokenContract = new ethers.Contract(
    params.tokenIn,
    ["function approve(address, uint256) returns (bool)"],
    signer,
  );
  const approveTx = await tokenContract.approve(
    UNISWAP_ROUTER_ADDRESS,
    amountInWei,
  );
  await approveTx.wait();

  // For cross-token swaps amountOutMinimum must be in output-token units.
  // Without an on-chain quoter we cannot derive the exact expected output,
  // so we use 0 (accept any amount) for small-sized trades.
  // Production code should call the Quoter contract first.
  const amountOutMin = 0n;

  const swapParams = {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    fee: fee,
    recipient: await signer.getAddress(),
    amountIn: amountInWei,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0n,
  };

  const tx = await router.exactInputSingle(swapParams);
  const receipt = await tx.wait();
  log.tx("UniswapSwap", receipt.hash);

  return { txHash: receipt.hash, amountOut: "0" };
}

// ====== x402 Payment (OKX Standard) ======
//
// The x402 protocol is implemented at the HTTP layer:
// - Seller: @okxweb3/x402-express middleware (see research-agent/x402-server.ts)
// - Buyer:  @okxweb3/x402-fetch wrapper (see executor-agent/x402-client.ts)
//
// The protocol flow is:
// 1. Client sends GET request to a paid endpoint
// 2. Server returns HTTP 402 with payment requirements (scheme, network, amount, payTo)
// 3. Client signs an EIP-3009 transferWithAuthorization for USDT on X Layer
// 4. Client retries with X-PAYMENT header containing the signed payload
// 5. Server verifies payment via OKX Facilitator API
// 6. OKX Facilitator settles on-chain (sync or async)
// 7. Server returns the protected resource
//
// This replaces the old payViaX402() which incorrectly sent raw ETH.
// Payment is now handled transparently by the x402 SDK wrappers.

export interface X402PaymentConfig {
  /** The x402-protected endpoint URL */
  endpoint: string;
  /** Payment amount in USDT (for display/logging only; actual amount from 402 response) */
  amount: string;
  /** Token symbol (for display/logging only) */
  token: string;
}

/**
 * @deprecated Use @okxweb3/x402-fetch wrapFetchWithPaymentFromConfig() instead.
 * x402 payments are now handled at the HTTP layer by the SDK.
 * This function is kept for backward compatibility but simply makes
 * a fetch request to the endpoint — the x402 payment wrapper handles the rest.
 */
export async function payViaX402(
  _signer: ethers.Wallet,
  config: X402PaymentConfig,
): Promise<{ txHash: string; response: unknown }> {
  log.info(
    `x402 payment: ${config.amount} ${config.token} → ${config.endpoint}`,
  );
  log.info(
    "Note: x402 payments are now handled by @okxweb3/x402-fetch at the HTTP layer. " +
      "Use wrapFetchWithPaymentFromConfig() for automatic 402 handling.",
  );

  // Make a plain request — if x402-fetch is wrapping this, payment is automatic
  const response = await fetch(config.endpoint, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await response.json().catch(() => null);

  return {
    txHash: response.headers.get("PAYMENT-RESPONSE") ?? "x402-handled-by-sdk",
    response: data,
  };
}

// ====== Wallet Balance (Onchain OS Wallet API) ======

export async function getWalletBalances(
  address: string,
): Promise<{ okb: string; usdt: string }> {
  const provider = new ethers.JsonRpcProvider(XLAYER_RPC);
  const okbBalance = await provider.getBalance(address);

  const usdtContract = new ethers.Contract(
    process.env.USDT_ADDRESS || "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ],
    provider,
  );
  const usdtDecimals = await usdtContract.decimals();
  const usdtBalance = await usdtContract.balanceOf(address);

  return {
    okb: ethers.formatEther(okbBalance),
    usdt: ethers.formatUnits(usdtBalance, usdtDecimals),
  };
}
