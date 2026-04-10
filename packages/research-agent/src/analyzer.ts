import type { Signal, PoolData, SwapEvent } from "@firma/core";
import { getPoolAnalysis, compareRoutes, createLogger } from "@firma/core";

const log = createLogger("Analyzer");

const LP_WITHDRAWAL_THRESHOLD = 0.05; // 5%
const LP_ADDITION_THRESHOLD = 0.03; // 3%
const LARGE_SELL_THRESHOLD = 100; // 100 USDT equivalent

interface AnalysisInput {
  poolData: PoolData;
  recentSwaps: SwapEvent[];
  previousLiquidity: string | null;
}

export function analyzePool(input: AnalysisInput): Signal | null {
  const { poolData, recentSwaps, previousLiquidity } = input;
  const reasons: string[] = [];
  let score = 0; // positive = bullish, negative = bearish

  // --- LP analysis ---
  if (previousLiquidity) {
    const currentLiq = parseFloat(poolData.totalLiquidity);
    const prevLiq = parseFloat(previousLiquidity);

    if (prevLiq > 0) {
      const lpChange = (currentLiq - prevLiq) / prevLiq;

      if (lpChange <= -LP_WITHDRAWAL_THRESHOLD) {
        score -= 2;
        reasons.push(
          `LP withdrawal of ${(Math.abs(lpChange) * 100).toFixed(1)}% detected`,
        );
      } else if (lpChange >= LP_ADDITION_THRESHOLD) {
        score += 1;
        reasons.push(
          `LP addition of ${(lpChange * 100).toFixed(1)}% detected`,
        );
      }
    }
  }

  // --- Swap volume analysis ---
  if (recentSwaps.length > 0) {
    let sellVolume = 0;
    let buyVolume = 0;

    for (const swap of recentSwaps) {
      const amount = parseFloat(swap.amountIn);
      // If tokenIn is token0, it is a sell of token0 (bearish for token0)
      if (swap.tokenIn === poolData.token0) {
        sellVolume += amount;
      } else {
        buyVolume += amount;
      }
    }

    if (sellVolume > LARGE_SELL_THRESHOLD && sellVolume > buyVolume * 1.5) {
      score -= 1;
      reasons.push(
        `Heavy sell pressure: ${sellVolume.toFixed(2)} sell vs ${buyVolume.toFixed(2)} buy`,
      );
    } else if (buyVolume > LARGE_SELL_THRESHOLD && buyVolume > sellVolume * 1.5) {
      score += 1;
      reasons.push(
        `Strong buy pressure: ${buyVolume.toFixed(2)} buy vs ${sellVolume.toFixed(2)} sell`,
      );
    }
  }

  // --- Price trend (simple: compare volume to liquidity ratio) ---
  const volume24h = parseFloat(poolData.volume24h);
  const liquidity = parseFloat(poolData.totalLiquidity);

  if (liquidity > 0 && volume24h / liquidity > 0.5) {
    // High volume relative to liquidity indicates volatility
    reasons.push(
      `High volume/liquidity ratio: ${(volume24h / liquidity).toFixed(2)}`,
    );
    // Amplify existing signal
    if (score !== 0) {
      score += score > 0 ? 1 : -1;
    }
  }

  // --- Generate signal if we have a meaningful score ---
  if (score === 0) {
    return null;
  }

  const absScore = Math.abs(score);
  const maxScore = 5;
  const confidence = Math.min(absScore / maxScore, 1);

  return {
    pool: poolData.poolAddress,
    direction: score > 0 ? "LONG" : "SHORT",
    confidence: parseFloat(confidence.toFixed(2)),
    reason: reasons.join("; "),
    timestamp: new Date().toISOString(),
    token0: poolData.token0,
    token1: poolData.token1,
  };
}

/**
 * Enhanced signal generation using Uniswap AI Skills.
 * Uses uniswap-trading (route comparison) and uniswap-driver (pool analysis)
 * to enrich signals with deeper on-chain intelligence.
 */
export async function analyzePoolWithUniswapAI(
  input: AnalysisInput,
): Promise<Signal | null> {
  // Start with the base signal
  const baseSignal = analyzePool(input);
  if (!baseSignal) return null;

  try {
    // --- Uniswap AI: Pool liquidity analysis (uniswap-driver skill) ---
    const poolAnalysis = await getPoolAnalysis(input.poolData.poolAddress);
    const totalLiqUsd = parseFloat(poolAnalysis.totalLiquidityUsd || "0");
    if (totalLiqUsd > 0) {
      const poolLiq = parseFloat(input.poolData.totalLiquidity || "1");
      const depthRatio = totalLiqUsd / (poolLiq || 1);
      if (depthRatio > 0.8) {
        // High concentration = less slippage = stronger signal
        baseSignal.confidence = Math.min(baseSignal.confidence + 0.1, 1);
        baseSignal.reason += `; Uniswap AI: high liquidity depth (${(depthRatio * 100).toFixed(0)}% concentrated)`;
      }
      log.info(
        `[uniswap-driver] Pool ${input.poolData.poolAddress.slice(0, 10)}... ` +
        `liquidity=$${poolAnalysis.totalLiquidityUsd}, ` +
        `fee=${poolAnalysis.feeTier}, IL=${poolAnalysis.impermanentLossEstimate}`,
      );
    }

    // --- Uniswap AI: Route comparison (uniswap-trading skill) ---
    const routeComp = await compareRoutes(
      input.poolData.token0,
      input.poolData.token1,
      "0.01", // small test amount for route quality check
    );
    if (routeComp.winner !== "equal") {
      baseSignal.reason += `; Uniswap AI: best route via ${routeComp.winner} (saves ${routeComp.differencePercent}%)`;
      log.info(
        `[uniswap-trading] Route comparison: ${routeComp.winner} ` +
        `saves ${routeComp.differencePercent}% vs alternative`,
      );
    }
  } catch (err) {
    // Non-fatal: base signal is still valid without AI enrichment
    log.warn("Uniswap AI enrichment failed (non-fatal)", err);
  }

  return baseSignal;
}
