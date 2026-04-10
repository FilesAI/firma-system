/**
 * uniswap-ai.ts — Uniswap AI Skill Integration for Firma on X Layer
 *
 * Integrates two onchainos AI skills:
 *   - `uniswap-trading`: Route discovery and swap execution via the Uniswap Trading API.
 *   - `uniswap-driver`:  On-chain pool analytics, tick-range liquidity, and IL estimation.
 *
 * Primary path: direct fetch calls to the Uniswap Trading API (trade-api.gateway.uniswap.org).
 * Fallback path: onchainos CLI (`npx onchainos ...`) which wraps the same APIs with
 *                built-in key management and retry logic.
 *
 * All functions are async, exported, and designed for X Layer (chain ID 196).
 */

import { execSync } from "node:child_process";
import { ONCHAINOS_API, XLAYER_RPC } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("UniswapAI");

// ---------------------------------------------------------------------------
// Constants — X Layer addresses
// ---------------------------------------------------------------------------

/** USDT on X Layer (Uniswap-recognized wrapper) */
const USDT_XLAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736";

/** Wrapped OKB (WOKB) */
const WOKB = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";

/** Uniswap V3 SwapRouter deployed on X Layer */
const SWAP_ROUTER = "0x7078c4537c04c2b2e52ddba06074dbdacf23ca15";

/** Primary USDT/WOKB pool */
const PRIMARY_POOL = "0x63d62734847e55a266fca4219a9ad0a02d5f6e02";

/** X Layer chain ID */
const CHAIN_ID = 196;

/** Uniswap Trading API base URL */
const UNISWAP_API = "https://trade-api.gateway.uniswap.org/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UniswapQuote {
  /** Human-readable output amount */
  amountOut: string;
  /** Gas estimate in native token units */
  gasEstimate: string;
  /** Encoded route path returned by the API */
  route: string;
  /** Price impact as a percentage string, e.g. "0.12" */
  priceImpact: string;
  /** Where the quote came from */
  source: "uniswap-api" | "onchainos-cli" | "fallback";
}

export interface RouteComparison {
  uniswap: UniswapQuote | null;
  okxDex: UniswapQuote | null;
  /** "uniswap" | "okx" | "equal" */
  winner: string;
  /** Absolute difference in output amount */
  differenceAbsolute: string;
  /** Percentage improvement of winner over loser */
  differencePercent: string;
}

export interface SwapPlan {
  route: string;
  slippage: number;
  estimatedOutput: string;
  routeSource: "uniswap" | "okx" | "direct";
}

export interface TickRangeLiquidity {
  tickLower: number;
  tickUpper: number;
  liquidityUsd: string;
}

export interface PoolAnalysis {
  poolAddress: string;
  token0: string;
  token1: string;
  feeTier: number;
  totalLiquidityUsd: string;
  tickRanges: TickRangeLiquidity[];
  currentTick: number;
  impermanentLossEstimate: string;
  source: "uniswap-driver" | "onchainos-cli" | "fallback";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute an onchainos CLI command, parse JSON output.
 * Returns null on any failure so callers can fall back gracefully.
 */
function onchainosCli<T>(command: string): T | null {
  try {
    const raw = execSync(`npx onchainos ${command}`, {
      timeout: 30_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(raw.trim()) as T;
  } catch (err) {
    log.warn(`onchainos CLI failed: ${command}`, err);
    return null;
  }
}

/**
 * Fetch helper with timeout and JSON parsing.
 */
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      log.warn(`API response ${response.status} from ${url}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (err) {
    log.warn(`API fetch failed: ${url}`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. getUniswapQuote
// ---------------------------------------------------------------------------

/**
 * Get an optimal route quote for a token swap on X Layer.
 *
 * Strategy:
 *   1. Call the Uniswap Trading API directly (`/v1/quote`).
 *   2. If that fails, fall back to `npx onchainos uniswap-trading quote ...`.
 *   3. If both fail, return a sensible default with source = "fallback".
 *
 * @param tokenIn  - Address of the input token
 * @param tokenOut - Address of the output token
 * @param amountIn - Input amount as a decimal string (e.g. "100.0" USDT)
 */
export async function getUniswapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
): Promise<UniswapQuote> {
  log.info(`Fetching Uniswap quote: ${amountIn} ${tokenIn} -> ${tokenOut}`);

  // --- Primary: Uniswap Trading API ---
  const apiResult = await apiFetch<{
    quote: { amountOut: string; gasEstimate: string; route: string; priceImpact: string };
  }>(`${UNISWAP_API}/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.UNISWAP_API_KEY || "",
    },
    body: JSON.stringify({
      tokenIn,
      tokenOut,
      amount: amountIn,
      type: "EXACT_INPUT",
      chainId: CHAIN_ID,
      slippageTolerance: "0.5",
      swapper: SWAP_ROUTER,
    }),
  });

  if (apiResult?.quote) {
    log.info("Quote received from Uniswap Trading API");
    return {
      amountOut: apiResult.quote.amountOut,
      gasEstimate: apiResult.quote.gasEstimate,
      route: apiResult.quote.route,
      priceImpact: apiResult.quote.priceImpact,
      source: "uniswap-api",
    };
  }

  // --- Fallback: onchainos CLI (uniswap-trading skill) ---
  const cliResult = onchainosCli<{
    amountOut: string;
    gasEstimate: string;
    route: string;
    priceImpact: string;
  }>(
    `uniswap-trading quote --chain ${CHAIN_ID} --tokenIn ${tokenIn} --tokenOut ${tokenOut} --amount ${amountIn} --type EXACT_INPUT`,
  );

  if (cliResult) {
    log.info("Quote received from onchainos CLI (uniswap-trading)");
    return { ...cliResult, source: "onchainos-cli" };
  }

  // --- Last resort: return empty/default quote ---
  log.warn("All quote sources unavailable, returning fallback");
  return {
    amountOut: "0",
    gasEstimate: "0",
    route: "",
    priceImpact: "0",
    source: "fallback",
  };
}

// ---------------------------------------------------------------------------
// 2. compareRoutes
// ---------------------------------------------------------------------------

/**
 * Compare quotes from Uniswap Trading API and OKX DEX aggregator.
 *
 * Uses the OKX DEX aggregator endpoint (via ONCHAINOS_API) alongside the
 * Uniswap Trading API to determine the best execution venue.
 *
 * @returns RouteComparison with winner, absolute & percentage difference.
 */
export async function compareRoutes(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
): Promise<RouteComparison> {
  log.info(`Comparing routes: ${amountIn} ${tokenIn} -> ${tokenOut}`);

  // Fetch both quotes in parallel
  const [uniQuote, okxQuote] = await Promise.all([
    getUniswapQuote(tokenIn, tokenOut, amountIn),
    getOkxDexQuote(tokenIn, tokenOut, amountIn),
  ]);

  const uniOut = parseFloat(uniQuote.amountOut) || 0;
  const okxOut = parseFloat(okxQuote.amountOut) || 0;

  let winner: string;
  let diffAbs: number;
  let diffPct: number;

  if (uniOut > okxOut) {
    winner = "uniswap";
    diffAbs = uniOut - okxOut;
    diffPct = okxOut > 0 ? (diffAbs / okxOut) * 100 : 100;
  } else if (okxOut > uniOut) {
    winner = "okx";
    diffAbs = okxOut - uniOut;
    diffPct = uniOut > 0 ? (diffAbs / uniOut) * 100 : 100;
  } else {
    winner = "equal";
    diffAbs = 0;
    diffPct = 0;
  }

  log.info(`Route comparison winner: ${winner} (diff ${diffPct.toFixed(4)}%)`);

  return {
    uniswap: uniQuote.source !== "fallback" ? uniQuote : null,
    okxDex: okxQuote.source !== "fallback" ? okxQuote : null,
    winner,
    differenceAbsolute: diffAbs.toFixed(6),
    differencePercent: diffPct.toFixed(4),
  };
}

/**
 * Get a quote from the OKX DEX aggregator via the onchainos API.
 * Used internally by compareRoutes.
 */
async function getOkxDexQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
): Promise<UniswapQuote> {
  // --- Primary: OKX DEX Aggregator API ---
  const url =
    `${ONCHAINOS_API.baseUrl}/dex/aggregator/swap` +
    `?chainId=${CHAIN_ID}&fromTokenAddress=${tokenIn}&toTokenAddress=${tokenOut}&amount=${amountIn}&slippage=0.5`;

  const result = await apiFetch<{
    code: string;
    data: Array<{
      routerResult: {
        toTokenAmount: string;
        estimateGasFee: string;
        quoteCompareList?: Array<{ dexRouter: string; amountOut: string }>;
      };
    }>;
  }>(url, {
    headers: {
      "OK-ACCESS-KEY": ONCHAINOS_API.apiKey,
      "OK-ACCESS-PASSPHRASE": ONCHAINOS_API.passphrase,
    },
  });

  if (result?.code === "0" && result.data?.[0]) {
    const r = result.data[0].routerResult;
    return {
      amountOut: r.toTokenAmount,
      gasEstimate: r.estimateGasFee,
      route: JSON.stringify(r.quoteCompareList || []),
      priceImpact: "0",
      source: "uniswap-api", // tagged as okx but interface reused
    };
  }

  // --- Fallback: onchainos CLI ---
  const cliResult = onchainosCli<{
    toTokenAmount: string;
    estimateGasFee: string;
  }>(
    `dex-aggregator quote --chain ${CHAIN_ID} --from ${tokenIn} --to ${tokenOut} --amount ${amountIn}`,
  );

  if (cliResult) {
    return {
      amountOut: cliResult.toTokenAmount,
      gasEstimate: cliResult.estimateGasFee,
      route: "",
      priceImpact: "0",
      source: "onchainos-cli",
    };
  }

  return {
    amountOut: "0",
    gasEstimate: "0",
    route: "",
    priceImpact: "0",
    source: "fallback",
  };
}

// ---------------------------------------------------------------------------
// 3. planSwapWithAI
// ---------------------------------------------------------------------------

/**
 * Given a trading signal, plan the optimal swap execution.
 *
 * Determines:
 *   - Slippage tolerance based on pool liquidity depth
 *   - Best route (Uniswap vs OKX DEX)
 *   - Estimated output after fees and slippage
 *
 * @param signal - Trading signal object with at minimum { tokenIn, tokenOut, amountIn }
 */
export async function planSwapWithAI(signal: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  urgency?: "low" | "medium" | "high";
}): Promise<SwapPlan> {
  log.info("Planning swap with AI", signal);

  const { tokenIn, tokenOut, amountIn, urgency = "medium" } = signal;

  // Step 1: Analyse pool liquidity to determine slippage tolerance
  const poolAnalysis = await getPoolAnalysis(PRIMARY_POOL);
  const slippage = computeSlippage(poolAnalysis, parseFloat(amountIn), urgency);

  // Step 2: Compare routes to find best execution
  const comparison = await compareRoutes(tokenIn, tokenOut, amountIn);

  // Step 3: Pick the winning route
  let route: string;
  let estimatedOutput: string;
  let routeSource: SwapPlan["routeSource"];

  if (comparison.winner === "uniswap" && comparison.uniswap) {
    route = comparison.uniswap.route;
    estimatedOutput = comparison.uniswap.amountOut;
    routeSource = "uniswap";
  } else if (comparison.winner === "okx" && comparison.okxDex) {
    route = comparison.okxDex.route;
    estimatedOutput = comparison.okxDex.amountOut;
    routeSource = "okx";
  } else {
    // Both unavailable — attempt a direct swap via the SwapRouter
    route = SWAP_ROUTER;
    estimatedOutput = "0";
    routeSource = "direct";
  }

  log.info(`Swap plan: route=${routeSource}, slippage=${slippage}%, est=${estimatedOutput}`);

  return { route, slippage, estimatedOutput, routeSource };
}

/**
 * Compute dynamic slippage tolerance based on pool liquidity and trade urgency.
 *
 * Heuristic:
 *   - Deep liquidity (> $500k at active tick range): 0.1 - 0.3%
 *   - Moderate liquidity ($50k - $500k): 0.3 - 1.0%
 *   - Thin liquidity (< $50k): 1.0 - 3.0%
 *   - Urgency multiplier: low=0.8, medium=1.0, high=1.5
 */
function computeSlippage(
  pool: PoolAnalysis,
  tradeAmountUsd: number,
  urgency: "low" | "medium" | "high",
): number {
  const liquidityUsd = parseFloat(pool.totalLiquidityUsd) || 0;

  let baseSlippage: number;
  if (liquidityUsd > 500_000) {
    baseSlippage = 0.1;
  } else if (liquidityUsd > 50_000) {
    baseSlippage = 0.5;
  } else {
    baseSlippage = 1.5;
  }

  // Scale up if trade is large relative to pool
  const tradeRatio = liquidityUsd > 0 ? tradeAmountUsd / liquidityUsd : 1;
  if (tradeRatio > 0.1) {
    baseSlippage += 1.0;
  } else if (tradeRatio > 0.01) {
    baseSlippage += 0.3;
  }

  const urgencyMultiplier = { low: 0.8, medium: 1.0, high: 1.5 }[urgency];

  return Math.min(parseFloat((baseSlippage * urgencyMultiplier).toFixed(2)), 5.0);
}

// ---------------------------------------------------------------------------
// 4. getPoolAnalysis
// ---------------------------------------------------------------------------

/**
 * Analyse a Uniswap V3 style pool on X Layer.
 *
 * Returns:
 *   - Liquidity depth at different tick ranges
 *   - Fee tier analysis
 *   - Impermanent loss estimation (simplified model)
 *
 * Uses the `uniswap-driver` onchainos skill for on-chain tick data.
 *
 * @param poolAddress - The Uniswap V3 pool contract address
 */
export async function getPoolAnalysis(poolAddress: string): Promise<PoolAnalysis> {
  log.info(`Analysing pool: ${poolAddress}`);

  // --- Primary: onchainos CLI (uniswap-driver skill) ---
  const cliResult = onchainosCli<{
    token0: string;
    token1: string;
    feeTier: number;
    totalLiquidityUsd: string;
    currentTick: number;
    tickRanges: TickRangeLiquidity[];
  }>(`uniswap-driver pool-analysis --chain ${CHAIN_ID} --pool ${poolAddress}`);

  if (cliResult) {
    log.info("Pool analysis from onchainos CLI (uniswap-driver)");
    const ilEstimate = estimateImpermanentLoss(cliResult.currentTick, cliResult.tickRanges);
    return {
      poolAddress,
      token0: cliResult.token0,
      token1: cliResult.token1,
      feeTier: cliResult.feeTier,
      totalLiquidityUsd: cliResult.totalLiquidityUsd,
      tickRanges: cliResult.tickRanges,
      currentTick: cliResult.currentTick,
      impermanentLossEstimate: ilEstimate,
      source: "uniswap-driver",
    };
  }

  // --- Fallback: OKX DEX aggregator pool-info endpoint ---
  const poolUrl =
    `${ONCHAINOS_API.baseUrl}/dex/aggregator/pool-info?chainId=${CHAIN_ID}&poolAddress=${poolAddress}`;

  const apiResult = await apiFetch<{
    code: string;
    data: Array<{
      token0: string;
      token1: string;
      feeTier?: number;
      totalLiquidity: string;
    }>;
  }>(poolUrl, {
    headers: {
      "OK-ACCESS-KEY": ONCHAINOS_API.apiKey,
      "OK-ACCESS-PASSPHRASE": ONCHAINOS_API.passphrase,
    },
  });

  if (apiResult?.code === "0" && apiResult.data?.[0]) {
    const p = apiResult.data[0];
    log.info("Pool analysis from OKX DEX aggregator (fallback)");

    // Without tick data we synthesize a single range covering the entire price spectrum
    const syntheticRange: TickRangeLiquidity = {
      tickLower: -887220,
      tickUpper: 887220,
      liquidityUsd: p.totalLiquidity,
    };

    return {
      poolAddress,
      token0: p.token0,
      token1: p.token1,
      feeTier: p.feeTier ?? 3000,
      totalLiquidityUsd: p.totalLiquidity,
      tickRanges: [syntheticRange],
      currentTick: 0,
      impermanentLossEstimate: "unknown",
      source: "onchainos-cli",
    };
  }

  // --- Last resort: sensible defaults ---
  log.warn("Pool analysis unavailable, returning defaults");
  return {
    poolAddress,
    token0: USDT_XLAYER,
    token1: WOKB,
    feeTier: 3000,
    totalLiquidityUsd: "0",
    tickRanges: [],
    currentTick: 0,
    impermanentLossEstimate: "unknown",
    source: "fallback",
  };
}

/**
 * Simplified impermanent loss estimation.
 *
 * For concentrated liquidity positions, IL depends on how far price moves
 * relative to the position's tick range. We compute a rough percentage
 * based on the ratio of liquidity inside vs outside the active tick.
 *
 * This is a heuristic — production systems should use a proper IL model
 * (e.g. the Uniswap V3 IL formula: IL = 2*sqrt(p) / (1+p) - 1).
 */
function estimateImpermanentLoss(
  currentTick: number,
  tickRanges: TickRangeLiquidity[],
): string {
  if (tickRanges.length === 0) return "unknown";

  let inRangeLiquidity = 0;
  let totalLiquidity = 0;

  for (const range of tickRanges) {
    const liq = parseFloat(range.liquidityUsd) || 0;
    totalLiquidity += liq;
    if (currentTick >= range.tickLower && currentTick <= range.tickUpper) {
      inRangeLiquidity += liq;
    }
  }

  if (totalLiquidity === 0) return "unknown";

  // Higher concentration around current tick = lower IL risk (but higher if price moves)
  const concentrationRatio = inRangeLiquidity / totalLiquidity;

  // Rough heuristic: highly concentrated positions have higher IL exposure
  // because any price movement takes them out of range.
  let ilEstimate: number;
  if (concentrationRatio > 0.8) {
    ilEstimate = 5.0; // High concentration = high IL risk on movement
  } else if (concentrationRatio > 0.5) {
    ilEstimate = 2.5;
  } else {
    ilEstimate = 1.0; // Well-spread liquidity = lower IL risk
  }

  return `~${ilEstimate.toFixed(1)}%`;
}
