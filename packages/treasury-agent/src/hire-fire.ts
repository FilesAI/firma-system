import { ethers } from "ethers";
import {
  hireAgent,
  fireAgent,
  rehireAgent,
  logDecision,
  createLogger,
  OPERATION_CONFIG,
} from "@firma/core";
import type { GovernanceDecision } from "@firma/core";

const log = createLogger("Governance");

export interface GovernanceState {
  status: "active" | "fired";
  consecutiveLowCycles: number;
  lastAccuracy: number;
  lastDecision: GovernanceDecision | null;
  lastEvaluatedAt: string | null;
}

export class GovernanceEngine {
  private signer: ethers.Signer;
  private state: GovernanceState = {
    status: "active",
    consecutiveLowCycles: 0,
    lastAccuracy: 0,
    lastDecision: null,
    lastEvaluatedAt: null,
  };

  constructor(signer: ethers.Signer) {
    this.signer = signer;
  }

  /**
   * Evaluate current accuracy and return the appropriate governance decision.
   *
   * - accuracy > 50% -> RENEW (log decision, keep agent active)
   * - accuracy < 50% for 3 consecutive cycles -> FIRE
   * - accuracy recovers > 60% after being fired -> REHIRE
   */
  evaluate(currentAccuracy: number): GovernanceDecision {
    this.state.lastAccuracy = currentAccuracy;
    this.state.lastEvaluatedAt = new Date().toISOString();

    // If agent was previously fired, check for rehire — do NOT return FIRE again
    if (this.state.status === "fired") {
      if (currentAccuracy > OPERATION_CONFIG.rehireThreshold) {
        log.info(
          `Accuracy recovered to ${(currentAccuracy * 100).toFixed(1)}% (>${OPERATION_CONFIG.rehireThreshold * 100}%) — recommending REHIRE`,
        );
        this.state.consecutiveLowCycles = 0;
        this.state.lastDecision = "REHIRE";
        return "REHIRE";
      }

      log.info(
        `Agent still fired. Accuracy ${(currentAccuracy * 100).toFixed(1)}% below rehire threshold ${OPERATION_CONFIG.rehireThreshold * 100}% — waiting for recovery`,
      );
      // Return RENEW as a no-op (just log, don't re-fire)
      this.state.lastDecision = "RENEW";
      return "RENEW";
    }

    // Agent is active — evaluate performance
    if (currentAccuracy >= OPERATION_CONFIG.fireThreshold) {
      // Performing well enough
      this.state.consecutiveLowCycles = 0;
      this.state.lastDecision = "RENEW";
      log.info(
        `Accuracy ${(currentAccuracy * 100).toFixed(1)}% — RENEW`,
      );
      return "RENEW";
    }

    // Below threshold
    this.state.consecutiveLowCycles += 1;
    log.warn(
      `Accuracy ${(currentAccuracy * 100).toFixed(1)}% below ${OPERATION_CONFIG.fireThreshold * 100}% — low cycle ${this.state.consecutiveLowCycles}/${OPERATION_CONFIG.fireConsecutiveCycles}`,
    );

    if (this.state.consecutiveLowCycles >= OPERATION_CONFIG.fireConsecutiveCycles) {
      this.state.lastDecision = "FIRE";
      log.warn(
        `${OPERATION_CONFIG.fireConsecutiveCycles} consecutive low-accuracy cycles — recommending FIRE`,
      );
      return "FIRE";
    }

    // Not enough consecutive failures yet — renew with warning
    this.state.lastDecision = "RENEW";
    return "RENEW";
  }

  /**
   * Execute the governance decision on-chain via the FirmaCompany contract.
   */
  async execute(decision: GovernanceDecision, agentId: number): Promise<string> {
    const accuracyPct = (this.state.lastAccuracy * 100).toFixed(1);

    switch (decision) {
      case "RENEW": {
        // If agent is fired, RENEW means "waiting for recovery" — skip on-chain call
        if (this.state.status === "fired") {
          log.info(`Agent #${agentId} is fired — skipping on-chain RENEW, waiting for accuracy recovery`);
          return "";
        }
        const detail = `Accuracy ${accuracyPct}% — renewed for next cycle`;
        const txHash = await logDecision(
          this.signer,
          agentId,
          "RENEW",
          detail,
        );
        log.info(`RENEW executed for agent #${agentId}`);
        return txHash;
      }

      case "FIRE": {
        const reason = `Accuracy ${accuracyPct}% below ${OPERATION_CONFIG.fireThreshold * 100}% for ${this.state.consecutiveLowCycles} consecutive cycles`;
        const txHash = await fireAgent(this.signer, agentId, reason);
        this.state.status = "fired";
        log.warn(`FIRE executed for agent #${agentId}: ${reason}`);
        return txHash;
      }

      case "REHIRE": {
        const reason = `Accuracy recovered to ${accuracyPct}% (>${OPERATION_CONFIG.rehireThreshold * 100}%)`;
        const txHash = await rehireAgent(this.signer, agentId, reason);
        this.state.status = "active";
        this.state.consecutiveLowCycles = 0;
        log.info(`REHIRE executed for agent #${agentId}: ${reason}`);
        return txHash;
      }
    }
  }

  getStatus(): GovernanceState {
    return { ...this.state };
  }
}
