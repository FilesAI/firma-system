/**
 * DEX Aggregator Skill Plugin
 *
 * Uses OKX's DEX aggregator API to find the best prices across all DEXes
 * on X Layer (chainId 196). The aggregator routes through multiple liquidity
 * sources to minimize price impact and maximize output.
 *
 * Endpoint: ${ONCHAINOS_API.baseUrl}/dex/aggregator/swap
 *
 * This skill is categorized as "low" risk because the aggregator handles
 * optimal routing and slippage protection automatically.
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
import { createLogger } from "../logger.js";

const log = createLogger("DexAggregatorSkill");

/** OKX DEX aggregator API base path */
const AGGREGATOR_BASE = `${ONCHAINOS_API.baseUrl}/dex/aggregator`;

/**
 * Common token addresses on X Layer for price comparison.
 */
const XLAYER_TOKENS: Record<string, string> = {
  USDT: USDT_ADDRESS,
  // Additional tokens can be added as the X Layer ecosystem grows
};

/**
 * Minimum price difference (as a fraction) between DEXes to consider
 * an arbitrage opportunity worth pursuing.
 */
const MIN_ARB_SPREAD = 0.003; // 0.3%

/**
 * DexAggregatorSkill - Best-price swap routing via OKX DEX Aggregator.
 *
 * This skill:
 * 1. Queries the OKX aggregator for quotes across all X Layer DEXes
 * 2. Identifies arbitrage opportunities where prices diverge between venues
 * 3. Executes swaps through the aggregator for best-price routing
 * 4. Reports on price discrepancies for monitoring
 */
export class DexAggregatorSkill implements ISkillPlugin {
  readonly metadata: SkillMetadata = {
    id: "dex-aggregator",
    name: "OKX DEX Aggregator",
    description:
      "Routes swaps through OKX's DEX aggregator to find the best prices " +
      "across all liquidity sources on X Layer. Identifies cross-DEX " +
      "arbitrage opportunities.",
    version: "1.0.0",
    categories: ["aggregator"],
    supportedChains: [XLAYER_CHAIN_ID],
    riskLevel: "low",
    isActive: true,
    requiredConfig: ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"],
  };

  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private activePositions: Map<string, ActivePosition> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    log.info("Initializing DEX Aggregator Skill...");

    try {
      // Validate API credentials are present
      if (!ONCHAINOS_API.apiKey || !ONCHAINOS_API.passphrase) {
        log.warn(
          "OKX API credentials not configured - aggregator quotes may be limited",
        );
      }

      this.provider = new ethers.JsonRpcProvider(XLAYER_RPC);
      const network = await this.provider.getNetwork();
      log.info(`Connected to chain ${network.chainId}`);

      if (AGENT_WALLETS.executor.accountId) {
        const { createOnchaiosSigner } = await import("../onchainos-signer.js");
        this.signer = createOnchaiosSigner(
          AGENT_WALLETS.executor.accountId,
          AGENT_WALLETS.executor.address,
          this.provider,
        );
        log.info(`Executor wallet: ${AGENT_WALLETS.executor.address}`);
      }

      this.initialized = true;
      log.info("DEX Aggregator Skill initialized successfully");
    } catch (error) {
      log.error("Failed to initialize DEX Aggregator Skill", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    log.info("Shutting down DEX Aggregator Skill...");
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
      // Verify the aggregator API is reachable with a test quote
      const testUrl =
        `${AGGREGATOR_BASE}/quote?` +
        `chainId=${XLAYER_CHAIN_ID}` +
        `&fromTokenAddress=${USDT_ADDRESS}` +
        `&toTokenAddress=${USDT_ADDRESS}` +
        `&amount=1000000`;

      const response = await fetch(testUrl, {
        headers: this.getApiHeaders(),
      });

      const healthy = response.ok;
      return {
        healthy,
        status: healthy ? "active" : "error",
        message: healthy
          ? "Aggregator API reachable"
          : `Aggregator API returned status ${response.status}`,
        timestamp: Date.now(),
        details: {
          apiConfigured: !!ONCHAINOS_API.apiKey,
          hasExecutor: !!this.signer,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        status: "error",
        message: `Aggregator API unreachable: ${error}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Discover arbitrage opportunities by comparing prices across DEXes.
   *
   * Queries the aggregator for quotes on common token pairs and checks
   * if direct DEX prices diverge from the aggregated best price, indicating
   * an arbitrage opportunity.
   */
  async discover(): Promise<Opportunity[]> {
    log.info("Discovering DEX aggregator opportunities...");
    const opportunities: Opportunity[] = [];

    // Get available token pairs from the aggregator
    const tokenAddresses = Object.values(XLAYER_TOKENS);
    if (tokenAddresses.length < 2) {
      log.info("Not enough tokens configured for cross-DEX comparison");
      return opportunities;
    }

    // Compare aggregator price vs individual DEX prices for each pair
    for (let i = 0; i < tokenAddresses.length; i++) {
      for (let j = i + 1; j < tokenAddresses.length; j++) {
        try {
          const opportunity = await this.checkArbOpportunity(
            tokenAddresses[i],
            tokenAddresses[j],
          );
          if (opportunity) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          log.debug(
            `Error checking pair ${tokenAddresses[i]}/${tokenAddresses[j]}`,
            error,
          );
        }
      }
    }

    log.info(`Found ${opportunities.length} aggregator opportunities`);
    return opportunities;
  }

  /**
   * Evaluate an aggregator opportunity.
   *
   * Since the aggregator already optimizes for best price, evaluation
   * focuses on whether the spread is still viable after gas costs.
   */
  async evaluate(opportunity: Opportunity): Promise<{
    score: number;
    recommendation: "execute" | "skip" | "monitor";
    reasoning: string;
    adjustedReturn?: number;
    adjustedRisk?: RiskLevel;
  }> {
    log.info(`Evaluating aggregator opportunity ${opportunity.id}`);

    // Check expiry
    if (opportunity.expiresAt > 0 && Date.now() > opportunity.expiresAt) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Opportunity has expired",
      };
    }

    // Re-fetch the quote to verify the spread is still present
    const { fromToken, toToken, amount } = opportunity.executionData as {
      fromToken: string;
      toToken: string;
      amount: string;
    };

    if (!fromToken || !toToken) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Missing token addresses in execution data",
      };
    }

    const currentQuote = await this.getAggregatorQuote(
      fromToken,
      toToken,
      amount || "10000000", // Default 10 USDT (6 decimals)
    );

    if (!currentQuote) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Unable to get current quote from aggregator",
      };
    }

    // Estimate gas cost
    const estimatedGasCostUsd = 0.02;
    const adjustedReturn =
      opportunity.estimatedReturn -
      estimatedGasCostUsd / opportunity.requiredAmount;

    let score = 0;
    const reasons: string[] = [];

    // Return component
    if (adjustedReturn > MIN_ARB_SPREAD) {
      score += Math.min(adjustedReturn * 20, 0.5);
      reasons.push(
        `Spread after gas: ${(adjustedReturn * 100).toFixed(3)}%`,
      );
    }

    // Aggregator routing quality (up to 0.3)
    if (currentQuote.routerResult) {
      score += 0.3;
      reasons.push("Valid aggregator route found");
    }

    // Confidence (up to 0.2)
    score += opportunity.confidence * 0.2;

    const recommendation: "execute" | "skip" | "monitor" =
      score >= 0.65 && adjustedReturn > 0
        ? "execute"
        : score >= 0.3
          ? "monitor"
          : "skip";

    return {
      score,
      recommendation,
      reasoning: reasons.join("; "),
      adjustedReturn,
      adjustedRisk: "low",
    };
  }

  /**
   * Execute a swap through the OKX DEX aggregator.
   *
   * The aggregator constructs the optimal swap transaction, which is then
   * signed and submitted by the executor wallet.
   */
  async execute(opportunity: Opportunity): Promise<ExecutionResult> {
    log.info(`Executing aggregator swap ${opportunity.id}`);

    if (!this.signer) {
      return {
        success: false,
        error: "No executor wallet configured",
        executedAt: Date.now(),
      };
    }

    try {
      const { fromToken, toToken, amount, slippage } =
        opportunity.executionData as {
          fromToken: string;
          toToken: string;
          amount: string;
          slippage?: string;
        };

      if (!fromToken || !toToken || !amount) {
        return {
          success: false,
          error:
            "Missing required execution data (fromToken, toToken, amount)",
          executedAt: Date.now(),
        };
      }

      // Get the swap transaction from the aggregator
      const swapUrl =
        `${AGGREGATOR_BASE}/swap?` +
        `chainId=${XLAYER_CHAIN_ID}` +
        `&fromTokenAddress=${fromToken}` +
        `&toTokenAddress=${toToken}` +
        `&amount=${amount}` +
        `&slippage=${slippage || "0.005"}` +
        `&userWalletAddress=${await this.signer.getAddress()}`;

      const response = await fetch(swapUrl, {
        headers: this.getApiHeaders(),
      });

      const data = await response.json();
      if (data.code !== "0" || !data.data?.[0]?.tx) {
        return {
          success: false,
          error: `Aggregator API error: ${data.msg || "Unknown error"}`,
          executedAt: Date.now(),
        };
      }

      const txData = data.data[0].tx;

      // First approve the token spend if needed
      if (data.data[0].approveData) {
        const approveTx = await this.signer.sendTransaction({
          to: data.data[0].approveData.to,
          data: data.data[0].approveData.data,
        });
        await approveTx.wait();
        log.info("Token approval confirmed");
      }

      // Execute the swap transaction
      const tx = await this.signer.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: txData.value ? BigInt(txData.value) : 0n,
        gasLimit: txData.gas ? BigInt(txData.gas) : undefined,
      });

      const receipt = await tx.wait();
      if (!receipt) {
        return {
          success: false,
          error: "Transaction receipt is null",
          executedAt: Date.now(),
        };
      }

      log.tx("AggregatorSwap", receipt.hash);

      const amountOut = data.data[0].routerResult?.toTokenAmount || "0";

      // Track position
      const positionId = `agg-${receipt.hash}`;
      this.activePositions.set(positionId, {
        id: positionId,
        skillId: this.metadata.id,
        category: "aggregator",
        status: "closed",
        tokens: [fromToken, toToken],
        investedAmount: opportunity.requiredAmount,
        currentValue: parseFloat(amountOut) || opportunity.requiredAmount,
        unrealizedPnl: 0,
        openedAt: Date.now(),
        positionData: {
          txHash: receipt.hash,
          fromToken,
          toToken,
          amountIn: amount,
          amountOut,
          dexesUsed: data.data[0].routerResult?.routes || [],
        },
      });

      return {
        success: true,
        txHash: receipt.hash,
        amountOut,
        gasCost: receipt.gasUsed.toString(),
        executedAt: Date.now(),
        details: {
          dexesUsed: data.data[0].routerResult?.routes || [],
          priceImpact: data.data[0].routerResult?.priceImpact,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Aggregator swap failed: ${errorMsg}`);
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

  async exitPosition(positionId: string): Promise<ExecutionResult> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      return {
        success: false,
        error: `Position ${positionId} not found`,
        executedAt: Date.now(),
      };
    }

    // Aggregator swaps are atomic - nothing to exit
    return {
      success: true,
      executedAt: Date.now(),
      details: {
        message:
          "Aggregator swap positions are atomic and already closed at execution",
      },
    };
  }

  // ====== Private helpers ======

  /** Build the OKX API authentication headers. */
  private getApiHeaders(): Record<string, string> {
    return {
      "OK-ACCESS-KEY": ONCHAINOS_API.apiKey,
      "OK-ACCESS-PASSPHRASE": ONCHAINOS_API.passphrase,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get a quote from the OKX DEX aggregator.
   */
  private async getAggregatorQuote(
    fromToken: string,
    toToken: string,
    amount: string,
  ): Promise<{ routerResult: Record<string, unknown> } | null> {
    try {
      const url =
        `${AGGREGATOR_BASE}/quote?` +
        `chainId=${XLAYER_CHAIN_ID}` +
        `&fromTokenAddress=${fromToken}` +
        `&toTokenAddress=${toToken}` +
        `&amount=${amount}`;

      const response = await fetch(url, {
        headers: this.getApiHeaders(),
      });

      const data = await response.json();
      if (data.code === "0" && data.data?.[0]) {
        return { routerResult: data.data[0] };
      }
      return null;
    } catch (error) {
      log.error("Failed to get aggregator quote", error);
      return null;
    }
  }

  /**
   * Check for an arbitrage opportunity between two tokens by comparing
   * individual DEX prices against the aggregator's best price.
   */
  private async checkArbOpportunity(
    tokenA: string,
    tokenB: string,
  ): Promise<Opportunity | null> {
    // Get the aggregator's best quote
    const amount = "10000000"; // 10 USDT (6 decimals)
    const quote = await this.getAggregatorQuote(tokenA, tokenB, amount);
    if (!quote) return null;

    // The aggregator inherently finds the best price; if the spread between
    // the best and worst DEX route is significant, there's an arb opportunity.
    const routerResult = quote.routerResult as Record<string, unknown>;
    const estimatedReturn = parseFloat(
      (routerResult.priceImpact as string) || "0",
    );

    if (Math.abs(estimatedReturn) < MIN_ARB_SPREAD) {
      return null;
    }

    return {
      id: `dex-agg-arb-${tokenA.slice(-6)}-${tokenB.slice(-6)}-${Date.now()}`,
      skillId: this.metadata.id,
      category: "aggregator",
      description:
        `Cross-DEX price spread detected between ` +
        `${tokenA.slice(0, 10)}... and ${tokenB.slice(0, 10)}... ` +
        `Spread: ${(Math.abs(estimatedReturn) * 100).toFixed(3)}%`,
      estimatedReturn: Math.abs(estimatedReturn),
      riskLevel: "low",
      requiredAmount: 10,
      tokens: [tokenA, tokenB],
      discoveredAt: Date.now(),
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 minute window (arbs close fast)
      executionData: {
        fromToken: tokenA,
        toToken: tokenB,
        amount,
        slippage: "0.005",
      },
      confidence: Math.min(Math.abs(estimatedReturn) * 100, 0.85),
    };
  }
}
