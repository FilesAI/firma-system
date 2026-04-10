import { createLogger } from "@firma/core";
import type { Signal } from "@firma/core";

const log = createLogger("JobEvaluator");

export interface EvaluationRecord {
  jobId: number;
  signal: Signal;
  actualPriceChange: number;
  outcome: "complete" | "reject";
  evaluatedAt: string;
}

export class JobEvaluator {
  private history: EvaluationRecord[] = [];

  /**
   * Evaluate a job by comparing the signal direction with actual price movement.
   * If the signal was accurate, the outcome is "complete" (funds stay with provider).
   * If wrong, the outcome is "reject" (client can call ACPV2.claimRefund()).
   *
   * The evaluation decision is recorded locally; the Treasury agent anchors it
   * on-chain via FirmaCompany.logDecision() in its governance loop.
   */
  async evaluateJob(
    jobId: number,
    signal: Signal,
    actualPriceChange: number,
  ): Promise<"complete" | "reject"> {
    const signalExpectsUp = signal.direction === "LONG";
    const priceWentUp = actualPriceChange > 0;
    const isAccurate = signalExpectsUp === priceWentUp;
    const outcome: "complete" | "reject" = isAccurate ? "complete" : "reject";

    log.info(
      `Job #${jobId}: signal=${signal.direction}, actual=${actualPriceChange > 0 ? "UP" : "DOWN"} (${actualPriceChange.toFixed(4)}), outcome=${outcome}`,
    );

    // Evaluation recorded locally; the Treasury agent anchors the decision
    // on-chain via FirmaCompany.logDecision() in its governance loop.
    // For rejected jobs, client can call ACPV2.claimRefund() to recover funds.

    const record: EvaluationRecord = {
      jobId,
      signal,
      actualPriceChange,
      outcome,
      evaluatedAt: new Date().toISOString(),
    };
    this.history.push(record);

    return outcome;
  }

  /** Returns the accuracy as a ratio (0 to 1) across all evaluated jobs. */
  getAccuracy(): number {
    if (this.history.length === 0) return 0;
    const completed = this.history.filter((r) => r.outcome === "complete").length;
    return completed / this.history.length;
  }

  getHistory(): EvaluationRecord[] {
    return [...this.history];
  }

  getEvaluationCount(): number {
    return this.history.length;
  }
}
