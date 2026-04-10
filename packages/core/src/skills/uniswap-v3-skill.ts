/**
 * Uniswap V3 Skill Plugin
 *
 * Wraps the existing Uniswap swap functionality from onchainos.ts into the
 * ISkillPlugin interface. This skill handles token swaps on Uniswap V3
 * deployed on X Layer (chainId 196).
 *
 * Uses:
 * - ONCHAINOS_API for pool data and swap history
 * - Uniswap V3 SwapRouter at 0x0a6513e40db6EB1b165753AD52E80663aeA50545
 * - USDT as the primary quote token
 */

import { ethers } from "ethers";
import type {
  ISkillPlugin,
  SkillMetadata,
  SkillHealth,
  Opportunity,
  ExecutionResult,
  ActivePosition,
  RiskLevel,
} from "./types.js";
import {
  ONCHAINOS_API,
  XLAYER_RPC,
  USDT_ADDRESS,
  XLAYER_CHAIN_ID,
  AGENT_WALLETS,
} from "../config.js";
import {
  executeSwap,
  getPoolData,
  getRecentSwaps,
  type PoolData,
} from "../onchainos.js";
import { createLogger } from "../logger.js";

const log = createLogger("UniswapV3Skill");

/** Uniswap V3 SwapRouter address on X Layer (official deployment) */
const UNISWAP_ROUTER = "0x7078c4537c04c2b2e52ddba06074dbdacf23ca15";

/**
 * Default pool addresses to monitor for swap opportunities.
 * These are the most liquid Uniswap V3 pools on X Layer.
 */
const DEFAULT_MONITORED_POOLS: string[] = [
  // Add pool addresses here as they are discovered on X Layer
];

/**
 * Minimum volume threshold (in USD) to consider a pool active enough
 * for swap opportunities.
 */
const MIN_VOLUME_THRESHOLD = 1000;

/**
 * Minimum price impact percentage that would signal an arbitrage opportunity.
 * A large swap causing >2% price impact may create a reversion opportunity.
 */
const PRICE_IMPACT_THRESHOLD = 0.02;

/**
 * UniswapV3Skill - Token swap skill using Uniswap V3 on X Layer.
 *
 * This skill monitors Uniswap V3 pools for swap opportunities, including:
 * - Large swaps that create temporary price dislocations
 * - Volume spikes indicating increased trading activity
 * - Price deviations from aggregator prices
 */
export class UniswapV3Skill implements ISkillPlugin {
  readonly metadata: SkillMetadata = {
    id: "uniswap-v3-swap",
    name: "Uniswap V3 Swap",
    description:
      "Token swaps on Uniswap V3 deployed on X Layer. Monitors pools for " +
      "price dislocations and executes swaps via the SwapRouter contract.",
    version: "1.0.0",
    categories: ["swap"],
    supportedChains: [XLAYER_CHAIN_ID],
    riskLevel: "low",
    isActive: true,
    requiredConfig: ["XLAYER_RPC", "OKX_API_KEY"],
  };

  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private monitoredPools: string[] = [...DEFAULT_MONITORED_POOLS];
  private activePositions: Map<string, ActivePosition> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    log.info("Initializing Uniswap V3 Skill...");

    try {
      this.provider = new ethers.JsonRpcProvider(XLAYER_RPC);
      const network = await this.provider.getNetwork();
      log.info(`Connected to chain ${network.chainId}`);

      // Set up executor signer for swaps (TEE-based via onchainos)
      if (AGENT_WALLETS.executor.accountId) {
        const { createOnchaiosSigner } = await import("../onchainos-signer.js");
        this.signer = createOnchaiosSigner(
          AGENT_WALLETS.executor.accountId,
          AGENT_WALLETS.executor.address,
          this.provider,
        );
        log.info(`Executor wallet: ${AGENT_WALLETS.executor.address}`);
      } else {
        log.warn("No executor wallet configured - skill will be read-only");
      }

      this.initialized = true;
      log.info("Uniswap V3 Skill initialized successfully");
    } catch (error) {
      log.error("Failed to initialize Uniswap V3 Skill", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    log.info("Shutting down Uniswap V3 Skill...");
    this.provider = null;
    this.signer = null;
    this.initialized = false;
  }

  async healthCheck(): Promise<SkillHealth> {
    if (!this.initialized || !this.provider) {
      return {
        healthy: false,
        status: "inactive",
        message: "Skill not initialized",
        timestamp: Date.now(),
      };
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      return {
        healthy: true,
        status: "active",
        message: `Connected to X Layer at block ${blockNumber}`,
        timestamp: Date.now(),
        details: {
          blockNumber,
          monitoredPools: this.monitoredPools.length,
          hasExecutor: !!this.signer,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        status: "error",
        message: `RPC connection failed: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Scan monitored Uniswap V3 pools for swap opportunities.
   *
   * Looks for:
   * 1. Pools with high volume relative to liquidity (potential price inefficiency)
   * 2. Recent large swaps that may have moved price away from fair value
   * 3. Pools where the on-chain price diverges from the aggregator price
   */
  async discover(): Promise<Opportunity[]> {
    log.info("Discovering Uniswap V3 swap opportunities...");
    const opportunities: Opportunity[] = [];

    for (const poolAddress of this.monitoredPools) {
      try {
        const poolData = await getPoolData(poolAddress);
        if (!poolData) continue;

        const recentSwaps = await getRecentSwaps(poolAddress, 20);
        const opportunity = this.analyzePool(poolData, recentSwaps);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      } catch (error) {
        log.error(`Error scanning pool ${poolAddress}`, error);
      }
    }

    log.info(`Found ${opportunities.length} swap opportunities`);
    return opportunities;
  }

  /**
   * Evaluate a swap opportunity for execution worthiness.
   *
   * Considers:
   * - Expected return after gas and slippage
   * - Current pool liquidity (can the swap be executed without excessive impact?)
   * - Time sensitivity (is the opportunity about to expire?)
   * - Risk of front-running
   */
  async evaluate(opportunity: Opportunity): Promise<{
    score: number;
    recommendation: "execute" | "skip" | "monitor";
    reasoning: string;
    adjustedReturn?: number;
    adjustedRisk?: RiskLevel;
  }> {
    log.info(`Evaluating opportunity ${opportunity.id}`);

    // Check if the opportunity has expired
    if (opportunity.expiresAt > 0 && Date.now() > opportunity.expiresAt) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Opportunity has expired",
      };
    }

    // Verify pool data is still current
    const poolAddress = opportunity.executionData.poolAddress as string;
    if (!poolAddress) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "No pool address in execution data",
      };
    }

    const currentPool = await getPoolData(poolAddress);
    if (!currentPool) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Pool data unavailable - pool may no longer exist",
      };
    }

    // Calculate adjusted return accounting for gas costs
    const estimatedGasCostUsd = 0.01; // Approximate gas cost on X Layer
    const adjustedReturn =
      opportunity.estimatedReturn -
      estimatedGasCostUsd / opportunity.requiredAmount;

    // Score the opportunity (0-1)
    let score = 0;
    const reasons: string[] = [];

    // Return component (up to 0.4)
    if (adjustedReturn > 0.01) {
      score += Math.min(adjustedReturn * 10, 0.4);
      reasons.push(`Adjusted return: ${(adjustedReturn * 100).toFixed(2)}%`);
    }

    // Liquidity component (up to 0.3)
    const liquidity = parseFloat(currentPool.totalLiquidity);
    if (liquidity > 10000) {
      score += 0.3;
      reasons.push("Adequate liquidity");
    } else if (liquidity > 1000) {
      score += 0.15;
      reasons.push("Moderate liquidity");
    }

    // Confidence component (up to 0.3)
    score += opportunity.confidence * 0.3;
    reasons.push(`Confidence: ${(opportunity.confidence * 100).toFixed(0)}%`);

    // Determine recommendation
    let recommendation: "execute" | "skip" | "monitor";
    if (score >= 0.7 && adjustedReturn > 0) {
      recommendation = "execute";
    } else if (score >= 0.4) {
      recommendation = "monitor";
    } else {
      recommendation = "skip";
    }

    return {
      score,
      recommendation,
      reasoning: reasons.join("; "),
      adjustedReturn,
      adjustedRisk: adjustedReturn < 0.005 ? "medium" : "low",
    };
  }

  /**
   * Execute a swap opportunity using the Uniswap V3 SwapRouter.
   *
   * Delegates to the existing executeSwap function from onchainos.ts,
   * which handles token approval and the exactInputSingle call.
   */
  async execute(opportunity: Opportunity): Promise<ExecutionResult> {
    log.info(`Executing swap opportunity ${opportunity.id}`);

    if (!this.signer) {
      return {
        success: false,
        error: "No executor wallet configured",
        executedAt: Date.now(),
      };
    }

    try {
      const { tokenIn, tokenOut, amountIn, fee } = opportunity.executionData as {
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        fee?: number;
      };

      if (!tokenIn || !tokenOut || !amountIn) {
        return {
          success: false,
          error: "Missing required execution data (tokenIn, tokenOut, amountIn)",
          executedAt: Date.now(),
        };
      }

      const result = await executeSwap(this.signer, {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        slippageBps: 50, // 0.5% slippage tolerance
      });

      log.tx("UniswapV3Swap", result.txHash);

      // Track the swap as a transient position
      const positionId = `swap-${result.txHash}`;
      this.activePositions.set(positionId, {
        id: positionId,
        skillId: this.metadata.id,
        category: "swap",
        status: "closed", // Swaps are instant, position is immediately closed
        tokens: [tokenIn, tokenOut],
        investedAmount: opportunity.requiredAmount,
        currentValue: parseFloat(result.amountOut) || opportunity.requiredAmount,
        unrealizedPnl: 0,
        openedAt: Date.now(),
        positionData: {
          txHash: result.txHash,
          amountIn,
          amountOut: result.amountOut,
        },
      });

      return {
        success: true,
        txHash: result.txHash,
        amountOut: result.amountOut,
        executedAt: Date.now(),
        details: {
          router: UNISWAP_ROUTER,
          tokenIn,
          tokenOut,
          fee: fee || 3000,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Swap execution failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        executedAt: Date.now(),
      };
    }
  }

  async getActivePositions(): Promise<ActivePosition[]> {
    return Array.from(this.activePositions.values());
  }

  /**
   * Swaps are atomic and don't maintain open positions in the traditional sense.
   * This method is included for interface compliance but will typically return
   * an error since swap positions are immediately closed.
   */
  async exitPosition(positionId: string): Promise<ExecutionResult> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      return {
        success: false,
        error: `Position ${positionId} not found`,
        executedAt: Date.now(),
      };
    }

    // Swaps are atomic - there's nothing to exit
    return {
      success: true,
      executedAt: Date.now(),
      details: {
        message: "Swap positions are atomic and already closed at execution",
      },
    };
  }

  // ====== Private helpers ======

  /**
   * Analyze a pool's data and recent swaps to identify trading opportunities.
   */
  private analyzePool(
    pool: PoolData,
    recentSwaps: { amountIn: string; amountOut: string; timestamp: number }[],
  ): Opportunity | null {
    const volume = parseFloat(pool.volume24h);
    const liquidity = parseFloat(pool.totalLiquidity);

    // Skip pools with insufficient activity
    if (volume < MIN_VOLUME_THRESHOLD || liquidity === 0) {
      return null;
    }

    // Check for volume/liquidity ratio indicating possible price inefficiency
    const volumeToLiquidityRatio = volume / liquidity;

    // Look for large recent swaps that may have moved the price
    const now = Date.now() / 1000;
    const recentLargeSwaps = recentSwaps.filter((swap) => {
      const swapSize = parseFloat(swap.amountIn);
      const timeDelta = now - swap.timestamp;
      // Large swap within the last 5 minutes
      return swapSize > liquidity * PRICE_IMPACT_THRESHOLD && timeDelta < 300;
    });

    if (recentLargeSwaps.length === 0 && volumeToLiquidityRatio < 0.5) {
      return null;
    }

    // Estimate return based on the price dislocation
    const estimatedReturn = Math.min(volumeToLiquidityRatio * 0.01, 0.05);

    return {
      id: `uniswap-v3-${pool.poolAddress}-${Date.now()}`,
      skillId: this.metadata.id,
      category: "swap",
      description: `Swap opportunity on pool ${pool.poolAddress} ` +
        `(${pool.token0}/${pool.token1}). ` +
        `Volume/Liquidity ratio: ${volumeToLiquidityRatio.toFixed(3)}`,
      estimatedReturn,
      riskLevel: "low",
      requiredAmount: parseFloat(pool.reserve0) > 0 ? 10 : 0,
      tokens: [pool.token0, pool.token1],
      discoveredAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute window
      executionData: {
        poolAddress: pool.poolAddress,
        tokenIn: pool.token0,
        tokenOut: pool.token1,
        amountIn: "10",
        fee: 3000,
        priceToken0InToken1: pool.priceToken0InToken1,
      },
      confidence: Math.min(volumeToLiquidityRatio, 0.9),
    };
  }
}
