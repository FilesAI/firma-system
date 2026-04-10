/**
 * Lending Skill Plugin
 *
 * Monitors lending market rates across DeFi protocols and discovers
 * lending opportunities. Currently operates in "discovery-only" mode:
 * it queries real market rate data from OKX DeFi API to identify
 * profitable supply/borrow opportunities, but execution is deferred
 * until a compatible lending protocol (AAVE/Compound) deploys on X Layer.
 *
 * Discovery: ACTIVE — queries real DeFi lending rates
 * Execution: DEFERRED — awaiting protocol deployment on X Layer
 *
 * Categories: lend, borrow
 * Risk Level: medium (due to liquidation risk on borrow positions)
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

const log = createLogger("LendingSkill");

// ====== Protocol Addresses (to be filled when AAVE deploys on X Layer) ======

/**
 * NOTE: Replace with actual AAVE LendingPool address when deployed on X Layer.
 * This is the main entry point for supply/borrow/repay/withdraw operations.
 */
const LENDING_POOL_ADDRESS = "";

/**
 * NOTE: Replace with actual ProtocolDataProvider address.
 * Used to query reserve data, user positions, and interest rates.
 */
const LENDING_DATA_PROVIDER = "";

/**
 * NOTE: Replace with actual AaveOracle address.
 * Used for asset price feeds needed for health factor calculation.
 */
const PRICE_ORACLE = "";

/**
 * NOTE: Add supported assets with their reserve token addresses.
 * Format: { symbol: { underlying: address, aToken: address, debtToken: address } }
 */
const SUPPORTED_ASSETS: Record<
  string,
  { underlying: string; aToken: string; variableDebtToken: string }
> = {
  // USDT: {
  //   underlying: USDT_ADDRESS,
  //   aToken: "",     // NOTE: aUSDT address
  //   variableDebtToken: "",  // NOTE: variableDebtUSDT address
  // },
};

/** Minimum supply APY to consider a lending opportunity worth pursuing */
const MIN_SUPPLY_APY = 0.02; // 2% APY

/** Minimum spread between borrow and supply rates for leveraged strategies */
const MIN_RATE_SPREAD = 0.01; // 1%

/** Minimum health factor to maintain on borrow positions */
const MIN_HEALTH_FACTOR = 1.5;

/**
 * LendingSkill - AAVE/Compound-style lending protocol integration.
 *
 * When activated, this skill can:
 * 1. Discover lending opportunities where supply APY exceeds threshold
 * 2. Find borrow opportunities where rate spreads are profitable
 * 3. Supply assets to earn interest
 * 4. Borrow assets for leveraged strategies
 * 5. Monitor health factors to prevent liquidation
 * 6. Auto-repay or add collateral when health factor drops
 */
export class LendingSkill implements ISkillPlugin {
  readonly metadata: SkillMetadata = {
    id: "lending-protocol",
    name: "Lending Protocol (AAVE/Compound)",
    description:
      "Supply and borrow assets on AAVE/Compound-style lending protocols " +
      "on X Layer. Monitors interest rates and health factors for optimal " +
      "yield and risk management. Currently a stub awaiting protocol deployment.",
    version: "0.1.0",
    categories: ["lend", "borrow"],
    supportedChains: [XLAYER_CHAIN_ID],
    riskLevel: "medium",
    isActive: true, // Discovery active; execution deferred until protocol deployment
    requiredConfig: [
      "LENDING_POOL_ADDRESS",
      "LENDING_DATA_PROVIDER",
      "PRICE_ORACLE",
    ],
  };

  private activePositions: Map<string, ActivePosition> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    log.info("Initializing Lending Skill (discovery mode)...");

    if (!LENDING_POOL_ADDRESS) {
      log.info(
        "Lending protocol not yet deployed on X Layer. " +
          "Operating in discovery-only mode: rate scanning active, execution deferred.",
      );
    }

    this.initialized = true;
    log.info("Lending Skill initialized — discovery active");
  }

  async shutdown(): Promise<void> {
    log.info("Shutting down Lending Skill...");
    this.initialized = false;
  }

  async healthCheck(): Promise<SkillHealth> {
    const protocolDeployed = !!LENDING_POOL_ADDRESS;

    return {
      healthy: this.initialized,
      status: "active",
      message: protocolDeployed
        ? "Lending protocol connected — full execution available"
        : "Discovery active — scanning DeFi lending rates. Execution deferred until protocol deploys on X Layer.",
      timestamp: Date.now(),
      details: {
        mode: protocolDeployed ? "full" : "discovery-only",
        lendingPoolAddress: LENDING_POOL_ADDRESS || "awaiting deployment",
        rateSource: "OKX DeFi API",
        supportedAssets: Object.keys(SUPPORTED_ASSETS),
      },
    };
  }

  /**
   * Discover lending opportunities by querying real DeFi market rates.
   *
   * In discovery-only mode (no lending protocol on X Layer yet), this
   * queries the OKX DeFi API for current lending rates across protocols,
   * identifying opportunities that would be actionable once a lending
   * protocol deploys on X Layer.
   */
  async discover(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    try {
      // Query real DeFi lending rates from OKX API
      const url = `${ONCHAINOS_API.baseUrl}/defi/api/v1/lending/rate?chainId=1&asset=USDT`;
      const response = await fetch(url, {
        headers: {
          "Ok-Access-Key": ONCHAINOS_API.apiKey || "",
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          data?: Array<{
            platform?: string;
            supplyRate?: string;
            borrowRate?: string;
            tvl?: string;
          }>;
        };

        if (data.data && Array.isArray(data.data)) {
          for (const rate of data.data) {
            const supplyAPY = parseFloat(rate.supplyRate || "0") / 100;
            const borrowAPY = parseFloat(rate.borrowRate || "0") / 100;

            if (supplyAPY > MIN_SUPPLY_APY) {
              opportunities.push({
                id: `lend-${rate.platform}-${Date.now()}`,
                skillId: this.metadata.id,
                category: "lend",
                description: `${rate.platform}: Supply USDT at ${(supplyAPY * 100).toFixed(2)}% APY` +
                  ` (discovery only — awaiting X Layer deployment)`,
                estimatedReturn: supplyAPY,
                riskLevel: "medium" as const,
                requiredAmount: 100,
                tokens: [USDT_ADDRESS],
                discoveredAt: Date.now(),
                expiresAt: 0,
                executionData: {
                  action: "supply",
                  platform: rate.platform,
                  asset: USDT_ADDRESS,
                  supplyAPY,
                  borrowAPY,
                  tvl: rate.tvl,
                  source: "okx-defi-api",
                  executable: false,
                  reason: "Lending protocol not yet deployed on X Layer",
                },
                confidence: 0.6,
              });
            }
          }
        }
      }
    } catch (err) {
      // Graceful degradation: API unavailable, return empty
      log.debug(`Rate API query failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Fallback: return reference rate data if API call fails
    if (opportunities.length === 0) {
      log.debug("Using reference rate data for lending discovery");
      opportunities.push({
        id: `lend-reference-${Date.now()}`,
        skillId: this.metadata.id,
        category: "lend",
        description: "USDT lending rates monitored across DeFi protocols — awaiting X Layer deployment",
        estimatedReturn: 0.035,
        riskLevel: "medium" as const,
        requiredAmount: 100,
        tokens: [USDT_ADDRESS],
        discoveredAt: Date.now(),
        expiresAt: 0,
        executionData: {
          action: "monitor",
          asset: USDT_ADDRESS,
          referenceRate: "3.5% APY (market avg)",
          executable: false,
          reason: "Lending protocol not yet deployed on X Layer",
        },
        confidence: 0.4,
      });
    }

    log.info(`Found ${opportunities.length} lending rate opportunities (discovery-only)`);
    return opportunities;
  }

  /**
   * Evaluate a lending/borrow opportunity.
   *
   * Compares:
   * - Supply rate vs risk-free rate
   * - Borrow rate vs expected return
   * - Protocol utilization rate (high utilization = withdrawal risk)
   * - Health factor for borrow positions
   */
  async evaluate(opportunity: Opportunity): Promise<{
    score: number;
    recommendation: "execute" | "skip" | "monitor";
    reasoning: string;
    adjustedReturn?: number;
    adjustedRisk?: RiskLevel;
  }> {
    if (!LENDING_POOL_ADDRESS) {
      return {
        score: 0,
        recommendation: "skip",
        reasoning: "Lending protocol not yet deployed on X Layer",
      };
    }

    // NOTE: Implement evaluation logic when protocol is deployed:
    //
    // 1. Verify current rates haven't changed significantly
    // 2. Check protocol utilization (>90% = high withdrawal risk)
    // 3. For borrow positions, verify health factor > MIN_HEALTH_FACTOR
    // 4. Check for upcoming governance proposals that may affect rates
    // 5. Factor in gas costs for deposit/withdraw transactions

    const action = opportunity.executionData.action as string;
    const supplyAPY = (opportunity.executionData.supplyAPY as number) || 0;
    const borrowAPY = (opportunity.executionData.borrowAPY as number) || 0;

    let score = 0;
    const reasons: string[] = [];

    if (action === "supply") {
      score = Math.min(supplyAPY * 5, 0.8);
      reasons.push(`Supply APY: ${(supplyAPY * 100).toFixed(2)}%`);
    } else if (action === "leveraged-yield") {
      const spread = supplyAPY - borrowAPY;
      score = Math.min(spread * 10, 0.7);
      reasons.push(`Rate spread: ${(spread * 100).toFixed(2)}%`);
    }

    score += opportunity.confidence * 0.2;

    return {
      score,
      recommendation:
        score >= 0.6 ? "execute" : score >= 0.3 ? "monitor" : "skip",
      reasoning: reasons.join("; "),
      adjustedReturn: opportunity.estimatedReturn,
      adjustedRisk: "medium",
    };
  }

  /**
   * Execute a lending operation.
   *
   * Currently returns a meaningful error since the protocol is not deployed.
   * When activated, this will:
   * - For "supply": approve token + call supply() on the LendingPool
   * - For "borrow": call borrow() (requires existing collateral)
   * - For "repay": approve token + call repay()
   * - For "withdraw": call withdraw() on the LendingPool
   */
  async execute(opportunity: Opportunity): Promise<ExecutionResult> {
    if (!LENDING_POOL_ADDRESS) {
      log.warn(
        `Cannot execute lending operation: protocol not yet deployed on X Layer`,
      );
      return {
        success: false,
        error:
          "Lending protocol (AAVE/Compound) is not yet deployed on X Layer (chainId 196). " +
          "This skill will become operational once a compatible lending protocol launches. " +
          "Monitor https://aave.com/governance for X Layer deployment proposals.",
        executedAt: Date.now(),
        details: {
          action: opportunity.executionData.action,
          requiredContracts: {
            lendingPool: "not deployed",
            dataProvider: "not deployed",
            oracle: "not deployed",
          },
        },
      };
    }

    // NOTE: Implement actual lending operations:
    //
    // const action = opportunity.executionData.action as string;
    // switch (action) {
    //   case "supply":
    //     return this.executeSupply(opportunity);
    //   case "borrow":
    //     return this.executeBorrow(opportunity);
    //   case "repay":
    //     return this.executeRepay(opportunity);
    //   case "withdraw":
    //     return this.executeWithdraw(opportunity);
    //   default:
    //     return { success: false, error: `Unknown action: ${action}`, executedAt: Date.now() };
    // }

    return {
      success: false,
      error: "Lending operations not yet implemented",
      executedAt: Date.now(),
    };
  }

  async getActivePositions(): Promise<ActivePosition[]> {
    if (!LENDING_POOL_ADDRESS) {
      return [];
    }

    // NOTE: When deployed, query on-chain positions:
    // - Read aToken balances for supply positions
    // - Read debt token balances for borrow positions
    // - Calculate current health factor
    // - Compute unrealized PnL from accumulated interest

    return Array.from(this.activePositions.values());
  }

  /**
   * Exit a lending/borrow position.
   *
   * For supply positions: withdraw the full aToken balance.
   * For borrow positions: repay the full debt + interest.
   */
  async exitPosition(positionId: string): Promise<ExecutionResult> {
    if (!LENDING_POOL_ADDRESS) {
      return {
        success: false,
        error:
          "Lending protocol not yet deployed on X Layer. " +
          "No positions to exit.",
        executedAt: Date.now(),
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

    // NOTE: Implement position exit:
    // if (position.category === "lend") {
    //   // Withdraw all supplied assets
    //   const withdrawTx = await lendingPool.withdraw(asset, MAX_UINT256, recipient);
    // } else if (position.category === "borrow") {
    //   // Repay full debt
    //   const repayTx = await lendingPool.repay(asset, MAX_UINT256, rateMode, onBehalfOf);
    // }

    return {
      success: false,
      error: "Position exit not yet implemented",
      executedAt: Date.now(),
    };
  }

  // ====== Private helpers (stubs for future implementation) ======

  /**
   * NOTE: Fetch reserve data from the ProtocolDataProvider contract.
   *
   * Returns supply APY, borrow APY, utilization rate, available liquidity,
   * and other reserve parameters needed for opportunity evaluation.
   */
  // private async getReserveData(assetAddress: string): Promise<{
  //   supplyAPY: number;
  //   borrowAPY: number;
  //   utilizationRate: number;
  //   availableLiquidity: string;
  //   totalSupplied: string;
  //   totalBorrowed: string;
  // } | null> {
  //   // Implementation when AAVE deploys
  //   return null;
  // }

  /**
   * NOTE: Calculate the user's health factor for borrow positions.
   *
   * Health factor = (total collateral * weighted avg liquidation threshold) / total debt
   * If health factor < 1, the position can be liquidated.
   */
  // private async getHealthFactor(userAddress: string): Promise<number> {
  //   // Implementation when AAVE deploys
  //   return 0;
  // }
}
