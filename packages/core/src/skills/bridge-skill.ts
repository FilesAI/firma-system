/**
 * Cross-Chain Bridge Skill Plugin (Ready-to-Activate Stub)
 *
 * Enables cross-chain asset bridging via OKX Bridge API. This skill
 * discovers cross-chain arbitrage opportunities where the same token
 * trades at different prices on different chains, and executes bridges
 * to capture the spread.
 *
 * Uses: ONCHAINOS_API for bridge quotes and transaction construction
 *
 * Categories: bridge
 * Risk Level: high (bridge security risk, finality delays)
 *
 * NOTE: Activation checklist:
 * 1. Verify OKX Bridge API supports X Layer as source/destination
 * 2. Configure supported bridge routes (e.g., Ethereum <-> X Layer, BSC <-> X Layer)
 * 3. Set up cross-chain price monitoring for arbitrage detection
 * 4. Implement bridge transaction status tracking (pending, confirmed, failed)
 * 5. Add timeout handling for delayed bridges
 * 6. Configure minimum bridge amounts per route (some bridges have minimums)
 * 7. Set up destination chain wallet addresses
 * 8. Set `isActive: true` in the metadata
 * 9. Test with minimum bridge amounts on each supported route
 * 10. Monitor bridge relayer health and available liquidity
 */

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
} from "../config.js";
import { createLogger } from "../logger.js";

const log = createLogger("BridgeSkill");

/** OKX Bridge API base path */
const BRIDGE_BASE = `${ONCHAINOS_API.baseUrl}/dex/cross-chain`;

/**
 * Supported bridge routes: source chain -> destination chains.
 * Each route specifies the chain IDs and commonly bridged tokens.
 *
 * NOTE: Populate with actual supported routes when OKX Bridge
 * confirms X Layer support.
 */
const SUPPORTED_ROUTES: Array<{
  name: string;
  fromChainId: number;
  toChainId: number;
  tokens: string[];
}> = [
  // NOTE: Uncomment and configure when bridge routes are available
  // {
  //   name: "Ethereum -> X Layer",
  //   fromChainId: 1,
  //   toChainId: XLAYER_CHAIN_ID,
  //   tokens: ["USDT", "USDC", "ETH"],
  // },
  // {
  //   name: "X Layer -> Ethereum",
  //   fromChainId: XLAYER_CHAIN_ID,
  //   toChainId: 1,
  //   tokens: ["USDT", "USDC", "OKB"],
  // },
  // {
  //   name: "BSC -> X Layer",
  //   fromChainId: 56,
  //   toChainId: XLAYER_CHAIN_ID,
  //   tokens: ["USDT", "USDC"],
  // },
];

/** Minimum price difference across chains to consider a bridge arb worthwhile */
const MIN_BRIDGE_ARB_SPREAD = 0.005; // 0.5%

/** Maximum acceptable bridge time in seconds */
const MAX_BRIDGE_DURATION = 1800; // 30 minutes

/**
 * BridgeSkill - Cross-chain asset bridging via OKX Bridge API.
 *
 * When activated, this skill can:
 * 1. Monitor token prices across multiple chains for arbitrage
 * 2. Get bridge quotes with estimated fees and duration
 * 3. Execute cross-chain transfers through the OKX Bridge
 * 4. Track bridge transaction status until completion
 * 5. Handle failed or stuck bridge transactions
 */
export class BridgeSkill implements ISkillPlugin {
  readonly metadata: SkillMetadata = {
    id: "cross-chain-bridge",
    name: "Cross-Chain Bridge (OKX)",
    description:
      "Cross-chain asset bridging via OKX Bridge API. Discovers arbitrage " +
      "opportunities across chains and executes bridges to capture price " +
      "differentials. Currently a stub awaiting bridge route activation.",
    version: "0.1.0",
    categories: ["bridge"],
    supportedChains: [XLAYER_CHAIN_ID],
    riskLevel: "high",
    isActive: true, // Discovery is functional; execution requires security review
    requiredConfig: [
      "OKX_API_KEY",
      "OKX_SECRET_KEY",
      "OKX_PASSPHRASE",
    ],
  };

  private activePositions: Map<string, ActivePosition> = new Map();
  private pendingBridges: Map<
    string,
    { txHash: string; fromChain: number; toChain: number; startTime: number }
  > = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    log.info("Initializing Bridge Skill (discovery mode)...");

    if (!ONCHAINOS_API.apiKey) {
      log.warn(
        "OKX API credentials not configured - bridge quotes may be limited. " +
          "The public cross-chain quote endpoint will still be attempted.",
      );
    }

    this.initialized = true;
    log.info("Bridge Skill initialized - quote discovery active, execution disabled");
  }

  async shutdown(): Promise<void> {
    log.info("Shutting down Bridge Skill...");

    // Warn about any pending bridges
    if (this.pendingBridges.size > 0) {
      log.warn(
        `${this.pendingBridges.size} bridge(s) still pending at shutdown. ` +
          "These will need manual monitoring.",
      );
    }

    this.initialized = false;
  }

  async healthCheck(): Promise<SkillHealth> {
    const apiConfigured = !!ONCHAINOS_API.apiKey;

    return {
      healthy: this.initialized,
      status: "active",
      message: apiConfigured
        ? "Bridge quote discovery active via OKX cross-chain API (execution disabled)"
        : "Bridge quote discovery active (public API, no auth) - execution disabled",
      timestamp: Date.now(),
      details: {
        discoveryActive: true,
        executionEnabled: false,
        apiConfigured,
        quoteEndpoint: `${BRIDGE_BASE}/quote`,
        supportedDiscovery: ["Ethereum -> X Layer (USDT)"],
        configuredRoutes: SUPPORTED_ROUTES.map((r) => r.name),
        pendingBridges: this.pendingBridges.size,
      },
    };
  }

  /**
   * Discover cross-chain arbitrage opportunities.
   *
   * When activated, this will:
   * 1. Query token prices on X Layer
   * 2. Query same token prices on connected chains
   * 3. Calculate the spread minus bridge fees
   * 4. Return profitable bridge opportunities
   *
   * NOTE: Implement cross-chain price comparison:
   * - Use OKX market API to get prices across chains
   * - Factor in bridge fees, gas costs on both chains, and slippage
   * - Consider bridge duration (price may move during transit)
   * - Check bridge relayer liquidity for the required amount
   */
  async discover(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    try {
      // Query OKX cross-chain API for a real bridge quote: Ethereum USDT -> X Layer USDT
      const params = new URLSearchParams({
        fromChainId: "1",        // Ethereum
        toChainId: "196",        // X Layer
        fromTokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT on Ethereum
        toTokenAddress: USDT_ADDRESS, // USDT on X Layer
        amount: "1000000000",    // 1000 USDT (6 decimals)
      });
      const url = `${ONCHAINOS_API.baseUrl}/dex/cross-chain/quote?${params}`;

      log.info(`Querying cross-chain quote: ${url}`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Add API key headers if configured
      if (ONCHAINOS_API.apiKey) {
        headers["OK-ACCESS-KEY"] = ONCHAINOS_API.apiKey;
        headers["OK-ACCESS-PASSPHRASE"] = ONCHAINOS_API.passphrase;
      }

      const response = await fetch(url, { headers });
      const data = await response.json() as {
        code?: string;
        data?: Array<{
          fromTokenAmount?: string;
          toTokenAmount?: string;
          estimatedTime?: string;
          routerList?: Array<{
            router?: { bridgeName?: string };
            fromTokenAmount?: string;
            toTokenAmount?: string;
            estimatedTime?: string;
          }>;
        }>;
      };

      if (data.code === "0" && data.data && data.data.length > 0) {
        for (const quote of data.data) {
          const routerList = quote.routerList || [];
          for (const route of routerList) {
            const fromAmount = parseFloat(route.fromTokenAmount || "0") / 1e6;
            const toAmount = parseFloat(route.toTokenAmount || "0") / 1e6;
            const bridgeName = route.router?.bridgeName || "unknown";
            const estimatedDuration = parseInt(route.estimatedTime || "600", 10);

            // Calculate the effective fee as a fraction
            const feeAmount = fromAmount - toAmount;
            const feePercentage = fromAmount > 0 ? feeAmount / fromAmount : 0;

            log.info(
              `Bridge quote via ${bridgeName}: ${fromAmount} USDT -> ${toAmount} USDT, ` +
                `fee: ${(feePercentage * 100).toFixed(3)}%, est. time: ${estimatedDuration}s`,
            );

            opportunities.push({
              id: `bridge-eth-xlayer-usdt-${bridgeName}-${Date.now()}`,
              skillId: this.metadata.id,
              category: "bridge",
              description:
                `Bridge 1000 USDT from Ethereum to X Layer via ${bridgeName}. ` +
                `Receive ~${toAmount.toFixed(2)} USDT. ` +
                `Fee: ${(feePercentage * 100).toFixed(3)}%. ` +
                `Est. time: ${Math.round(estimatedDuration / 60)} min. ` +
                `Note: execution requires additional security review.`,
              estimatedReturn: -feePercentage, // Bridge has a cost, not a return
              riskLevel: "high",
              requiredAmount: fromAmount,
              tokens: ["USDT"],
              discoveredAt: Date.now(),
              expiresAt: Date.now() + 10 * 60 * 1000, // 10 min window
              executionData: {
                action: "bridge",
                fromChainId: 1,
                toChainId: XLAYER_CHAIN_ID,
                token: "USDT",
                fromTokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
                toTokenAddress: USDT_ADDRESS,
                amount: "1000000000",
                bridgeName,
                bridgeFee: feePercentage,
                receiveAmount: toAmount,
                estimatedDuration,
              },
              confidence: 0.4, // Lower confidence due to bridge risk
            });
          }
        }
      } else {
        log.warn(
          `Cross-chain quote returned no data. Code: ${data.code}`,
        );
      }
    } catch (error) {
      log.error("Failed to query OKX cross-chain quote API", error);
      // Return empty array on failure - discovery is best-effort
    }

    log.info(`Found ${opportunities.length} bridge opportunities`);
    return opportunities;
  }

  /**
   * Evaluate a bridge opportunity.
   *
   * Key considerations:
   * - Net spread after ALL costs (bridge fee, gas on both chains, slippage)
   * - Bridge duration vs spread volatility (price may converge during transit)
   * - Bridge relayer reliability and liquidity
   * - Historical success rate of the bridge route
   * - Smart contract risk of the bridge protocol
   */
  async evaluate(opportunity: Opportunity): Promise<{
    score: number;
    recommendation: "execute" | "skip" | "monitor";
    reasoning: string;
    adjustedReturn?: number;
    adjustedRisk?: RiskLevel;
  }> {
    if (SUPPORTED_ROUTES.length === 0) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Bridge routes not configured on X Layer",
      };
    }

    const estimatedDuration =
      (opportunity.executionData.estimatedDuration as number) || MAX_BRIDGE_DURATION;
    const bridgeFee = (opportunity.executionData.bridgeFee as number) || 0;

    let score = 0;
    const reasons: string[] = [];

    // Return component (up to 0.3)
    const netReturn = opportunity.estimatedReturn;
    if (netReturn > MIN_BRIDGE_ARB_SPREAD) {
      score += Math.min(netReturn * 20, 0.3);
      reasons.push(`Net spread: ${(netReturn * 100).toFixed(2)}%`);
    }

    // Speed component (up to 0.3) - faster bridges are safer
    if (estimatedDuration < 300) {
      score += 0.3; // < 5 min
      reasons.push("Fast bridge (<5 min)");
    } else if (estimatedDuration < MAX_BRIDGE_DURATION) {
      score += 0.15;
      reasons.push(
        `Bridge duration: ${Math.round(estimatedDuration / 60)} min`,
      );
    } else {
      reasons.push("SLOW bridge - high price movement risk");
    }

    // Bridge fee component (up to 0.2) - lower fees are better
    if (bridgeFee < 0.001) {
      score += 0.2;
    } else if (bridgeFee < 0.005) {
      score += 0.1;
    }

    // Confidence (up to 0.2)
    score += opportunity.confidence * 0.2;

    return {
      score,
      recommendation:
        score >= 0.6 ? "execute" : score >= 0.3 ? "monitor" : "skip",
      reasoning: reasons.join("; "),
      adjustedReturn: netReturn,
      adjustedRisk: "high",
    };
  }

  /**
   * Execute a cross-chain bridge operation.
   *
   * Currently returns a meaningful error since bridge routes are not configured.
   * When activated, this will:
   * 1. Get a fresh bridge quote from the OKX Bridge API
   * 2. Approve token spend on the source chain
   * 3. Submit the bridge transaction
   * 4. Track the bridge status until completion
   * 5. Verify receipt on the destination chain
   */
  async execute(opportunity: Opportunity): Promise<ExecutionResult> {
    log.warn("Cannot execute bridge: execution requires additional security review");
    return {
      success: false,
      error:
        "Bridge execution is disabled pending additional security review. " +
        "Cross-chain bridge operations involve significant security risk " +
        "(token approvals, relayer trust, finality delays) and require " +
        "thorough auditing before automation. Discovery of bridge quotes " +
        "IS functional via the OKX cross-chain API.",
      executedAt: Date.now(),
      details: {
        action: opportunity.executionData.action,
        bridgeName: opportunity.executionData.bridgeName,
        fromChainId: opportunity.executionData.fromChainId,
        toChainId: opportunity.executionData.toChainId,
        bridgeApiBase: BRIDGE_BASE,
      },
    };
  }

  async getActivePositions(): Promise<ActivePosition[]> {
    // Include pending bridges as active positions
    const positions = Array.from(this.activePositions.values());

    for (const [id, bridge] of this.pendingBridges) {
      positions.push({
        id,
        skillId: this.metadata.id,
        category: "bridge",
        status: "open",
        tokens: [],
        investedAmount: 0,
        currentValue: 0,
        unrealizedPnl: 0,
        openedAt: bridge.startTime,
        positionData: {
          txHash: bridge.txHash,
          fromChain: bridge.fromChain,
          toChain: bridge.toChain,
          status: "pending",
          elapsed: Math.round((Date.now() - bridge.startTime) / 1000),
        },
      });
    }

    return positions;
  }

  /**
   * Exit a bridge position.
   *
   * Bridge operations cannot be reversed once submitted. This method
   * can only update the tracking status of completed or failed bridges.
   */
  async exitPosition(positionId: string): Promise<ExecutionResult> {
    if (SUPPORTED_ROUTES.length === 0) {
      return {
        success: false,
        error:
          "Bridge routes not configured on X Layer. No positions to exit.",
        executedAt: Date.now(),
      };
    }

    const pending = this.pendingBridges.get(positionId);
    if (pending) {
      return {
        success: false,
        error:
          "Bridge transactions cannot be reversed once submitted. " +
          "This bridge is still pending completion.",
        executedAt: Date.now(),
        details: {
          txHash: pending.txHash,
          elapsed: Math.round((Date.now() - pending.startTime) / 1000),
        },
      };
    }

    const position = this.activePositions.get(positionId);
    if (!position) {
      return {
        success: false,
        error: `Position ${positionId} not found`,
        executedAt: Date.now(),
      };
    }

    return {
      success: false,
      error: "Bridge position exit not yet implemented",
      executedAt: Date.now(),
    };
  }

  // ====== Private helpers (stubs for future implementation) ======

  /** Build the OKX API authentication headers. */
  private getApiHeaders(): Record<string, string> {
    return {
      "OK-ACCESS-KEY": ONCHAINOS_API.apiKey,
      "OK-ACCESS-PASSPHRASE": ONCHAINOS_API.passphrase,
      "Content-Type": "application/json",
    };
  }

  /**
   * NOTE: Get a bridge quote from the OKX Bridge API.
   *
   * Returns the estimated bridge fee, duration, and available routes.
   */
  // private async getBridgeQuote(
  //   fromChainId: number,
  //   toChainId: number,
  //   token: string,
  //   amount: string,
  // ): Promise<{
  //   fee: number;
  //   feePercentage: number;
  //   estimatedDuration: number;
  //   routes: unknown[];
  // } | null> {
  //   try {
  //     const url = `${BRIDGE_BASE}/quote?` +
  //       `fromChainId=${fromChainId}&toChainId=${toChainId}` +
  //       `&fromTokenAddress=${token}&amount=${amount}`;
  //     const response = await fetch(url, { headers: this.getApiHeaders() });
  //     const data = await response.json();
  //     if (data.code === "0" && data.data?.[0]) {
  //       return data.data[0];
  //     }
  //     return null;
  //   } catch (error) {
  //     log.error("Failed to get bridge quote", error);
  //     return null;
  //   }
  // }

  /**
   * NOTE: Get token price on a specific chain.
   *
   * Used for cross-chain price comparison to detect arbitrage.
   */
  // private async getTokenPrice(
  //   chainId: number,
  //   token: string,
  // ): Promise<number | null> {
  //   try {
  //     const url = `${ONCHAINOS_API.baseUrl}/dex/aggregator/quote?` +
  //       `chainId=${chainId}&fromTokenAddress=${token}` +
  //       `&toTokenAddress=${USDT_ADDRESS}&amount=1000000`;
  //     const response = await fetch(url, { headers: this.getApiHeaders() });
  //     const data = await response.json();
  //     if (data.code === "0" && data.data?.[0]) {
  //       return parseFloat(data.data[0].toTokenAmount) / 1e6;
  //     }
  //     return null;
  //   } catch (error) {
  //     log.error(`Failed to get price for ${token} on chain ${chainId}`, error);
  //     return null;
  //   }
  // }
}
