import { ethers } from "ethers";
import type { Signal } from "@firma/core";
import {
  AGENT_WALLETS,
  USDT_ADDRESS,
  OPERATION_CONFIG,
  createLogger,
  getAgentSigner,
  executeSwap,
  planSwapWithAI,
  swapViaOnchainos,
} from "@firma/core";

const log = createLogger("Trader");

export interface TradeResult {
  txHash: string;
  signal: Signal;
  success: boolean;
}

export class Trader {
  private signer: ethers.Signer;
  private confidenceThreshold: number;

  constructor(confidenceThreshold: number = OPERATION_CONFIG.signalConfidenceThreshold) {
    this.signer = getAgentSigner(AGENT_WALLETS.executor.accountId, AGENT_WALLETS.executor.address);
    this.confidenceThreshold = confidenceThreshold;
  }

  async executeTrade(signal: Signal): Promise<TradeResult | null> {
    if (signal.confidence < this.confidenceThreshold) {
      log.info(
        `Skipping trade: confidence ${signal.confidence} below threshold ${this.confidenceThreshold}`,
      );
      return null;
    }

    log.info(`Executing trade: ${signal.direction} on pool ${signal.pool} (confidence: ${signal.confidence})`);

    try {
      // Determine the non-USDT token from the pool's token pair
      const targetToken =
        signal.token0 && signal.token1
          ? signal.token0.toLowerCase() === USDT_ADDRESS.toLowerCase()
            ? signal.token1
            : signal.token0
          : null;

      if (!targetToken) {
        log.error(`Cannot determine target token for pool ${signal.pool} — missing token0/token1`);
        return { txHash: "", signal, success: false };
      }

      // LONG = buy the target token (swap USDT -> token)
      // SHORT = sell the target token (swap token -> USDT)
      const tokenIn = signal.direction === "LONG" ? USDT_ADDRESS : targetToken;
      const tokenOut = signal.direction === "LONG" ? targetToken : USDT_ADDRESS;

      // --- Uniswap AI: Plan optimal swap (uniswap-trading + uniswap-driver skills) ---
      let swapSlippage = 50; // default 0.5% = 50bps
      try {
        const plan = await planSwapWithAI({
          tokenIn,
          tokenOut,
          amountIn: OPERATION_CONFIG.jobAmountUsdt,
          urgency: signal.confidence >= 0.8 ? "high" : "medium",
        });
        swapSlippage = Math.round(plan.slippage * 100); // percent -> bps
        log.info(
          `[uniswap-trading] Swap plan: route=${plan.routeSource}, ` +
          `slippage=${plan.slippage}%, estimated=${plan.estimatedOutput}`,
        );
      } catch {
        log.info("[uniswap-trading] AI swap planning unavailable, using defaults");
      }

      // --- Try onchainos swap first (okx-dex-swap skill), fallback to direct Uniswap ---
      let txHash: string;
      const onchainosResult = swapViaOnchainos({
        tokenIn,
        tokenOut,
        amount: OPERATION_CONFIG.jobAmountUsdt,
        chain: "xlayer",
      });

      if (onchainosResult.txHash) {
        txHash = onchainosResult.txHash;
        log.info(`[okx-dex-swap] Trade via onchainos: ${txHash} (route: ${onchainosResult.route.join(" -> ")})`);
      } else {
        // Fallback: direct Uniswap V3 SwapRouter
        log.info("[okx-dex-swap] Onchainos swap unavailable, falling back to direct Uniswap V3");
        const result = await executeSwap(this.signer, {
          tokenIn,
          tokenOut,
          amountIn: OPERATION_CONFIG.jobAmountUsdt,
          slippageBps: swapSlippage,
        });
        txHash = result.txHash;
      }

      log.info(`Trade executed: ${signal.direction} -> tx ${txHash}`);

      return {
        txHash,
        signal,
        success: true,
      };
    } catch (error) {
      log.error("Trade execution failed", error);
      return {
        txHash: "",
        signal,
        success: false,
      };
    }
  }
}
