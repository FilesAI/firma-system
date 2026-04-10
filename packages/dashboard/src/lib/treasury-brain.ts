/**
 * Treasury Brain — Client-side decision engine.
 *
 * This is the SAME rule-based logic that the real Treasury Agent uses
 * (from packages/core/src/llm-brain.ts) when no LLM API key is configured.
 * When ANTHROPIC_API_KEY or OPENAI_API_KEY is set on the server, the real
 * agents upgrade to LLM-powered decisions — but the rules here are the
 * baseline that the LLM must also follow.
 *
 * The reasoning text is hashed with keccak256, matching how the server
 * anchors decisions on-chain via FirmaCompany.logDecision().
 */

import { ethers } from "ethers";

export interface AgentPerformance {
  agentId: number;
  roleName: string;
  accuracy: number;
  totalSignals: number;
  profitableSignals: number;
  recentTrend: "improving" | "declining" | "stable";
  currentBalance: string;
}

export interface TreasuryDecision {
  decision: "fire" | "keep" | "rehire" | "warn";
  reasoning: string;
  confidence: number;
  reasoningHash: string;
  model: string;
  timestamp: number;
  factors: DecisionFactor[];
}

export interface DecisionFactor {
  name: string;
  value: string;
  weight: number;
  signal: "positive" | "negative" | "neutral";
}

export interface SignalEvaluation {
  decision: "complete" | "reject";
  reasoning: string;
  confidence: number;
  reasoningHash: string;
  factors: DecisionFactor[];
}

// ====== Governance Rules (same as packages/core/src/llm-brain.ts) ======

const FIRE_THRESHOLD = 0.5;       // 50% accuracy
const WARN_THRESHOLD = 0.6;       // 60% accuracy
const REHIRE_THRESHOLD = 0.65;    // 65% accuracy to rehire
const FIRE_CONSECUTIVE = 3;       // consecutive low cycles

/**
 * Evaluate agent performance using the Treasury's governance rules.
 * This is the same decision logic the real Treasury Agent runs on the server.
 */
export function evaluateAgent(
  performance: AgentPerformance,
  consecutiveLowCycles: number = 0,
  wasFired: boolean = false,
): TreasuryDecision {
  const factors: DecisionFactor[] = [];
  let decision: "fire" | "keep" | "rehire" | "warn";
  let reasoning: string;
  let confidence: number;

  // Factor 1: Accuracy
  const accuracyRatio = performance.accuracy / 100;
  factors.push({
    name: "Signal Accuracy",
    value: `${performance.accuracy}%`,
    weight: 0.4,
    signal: accuracyRatio >= WARN_THRESHOLD ? "positive" :
            accuracyRatio >= FIRE_THRESHOLD ? "neutral" : "negative",
  });

  // Factor 2: Trend
  factors.push({
    name: "Recent Trend",
    value: performance.recentTrend,
    weight: 0.25,
    signal: performance.recentTrend === "improving" ? "positive" :
            performance.recentTrend === "declining" ? "negative" : "neutral",
  });

  // Factor 3: Volume
  factors.push({
    name: "Signal Volume",
    value: `${performance.totalSignals} total`,
    weight: 0.15,
    signal: performance.totalSignals >= 10 ? "positive" :
            performance.totalSignals >= 3 ? "neutral" : "negative",
  });

  // Factor 4: Consecutive Low Cycles
  factors.push({
    name: "Consecutive Low Cycles",
    value: `${consecutiveLowCycles}`,
    weight: 0.2,
    signal: consecutiveLowCycles === 0 ? "positive" :
            consecutiveLowCycles < FIRE_CONSECUTIVE ? "neutral" : "negative",
  });

  // Decision logic (matches llm-brain.ts rule-based fallback)
  if (wasFired && accuracyRatio >= REHIRE_THRESHOLD && performance.recentTrend !== "declining") {
    decision = "rehire";
    reasoning = `Agent #${performance.agentId} (${performance.roleName}) has recovered. ` +
      `Accuracy ${performance.accuracy}% exceeds rehire threshold of ${REHIRE_THRESHOLD * 100}%. ` +
      `Trend is ${performance.recentTrend}. Recommending rehire to restore full operational capacity. ` +
      `The agent demonstrated ability to self-correct, which is a positive governance signal.`;
    confidence = 0.75;
  } else if (accuracyRatio < FIRE_THRESHOLD && performance.recentTrend === "declining") {
    decision = "fire";
    reasoning = `Agent #${performance.agentId} (${performance.roleName}) accuracy is ${performance.accuracy}%, ` +
      `below the ${FIRE_THRESHOLD * 100}% fire threshold. Trend is declining with ` +
      `${consecutiveLowCycles} consecutive low cycles. Firing to protect company resources. ` +
      `The agent will enter observation mode and can be rehired if accuracy recovers above ${REHIRE_THRESHOLD * 100}%.`;
    confidence = 0.85;
  } else if (accuracyRatio < FIRE_THRESHOLD && consecutiveLowCycles >= FIRE_CONSECUTIVE) {
    decision = "fire";
    reasoning = `Agent #${performance.agentId} (${performance.roleName}) has been underperforming ` +
      `for ${consecutiveLowCycles} consecutive cycles (threshold: ${FIRE_CONSECUTIVE}). ` +
      `Accuracy at ${performance.accuracy}% despite extended monitoring period. ` +
      `Automatic termination triggered per governance rules.`;
    confidence = 0.9;
  } else if (accuracyRatio < WARN_THRESHOLD) {
    decision = "warn";
    reasoning = `Agent #${performance.agentId} (${performance.roleName}) accuracy is ${performance.accuracy}%, ` +
      `below the ${WARN_THRESHOLD * 100}% warning threshold. Trend is ${performance.recentTrend}. ` +
      `Monitoring closely — ${FIRE_CONSECUTIVE - consecutiveLowCycles} more low cycles before automatic termination. ` +
      `No immediate action required but agent is on notice.`;
    confidence = 0.7;
  } else {
    decision = "keep";
    reasoning = `Agent #${performance.agentId} (${performance.roleName}) performance is acceptable. ` +
      `Accuracy at ${performance.accuracy}% (above ${WARN_THRESHOLD * 100}% threshold). ` +
      `Trend is ${performance.recentTrend}. ${performance.profitableSignals}/${performance.totalSignals} ` +
      `signals were profitable. No governance action needed.`;
    confidence = 0.8;
  }

  const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

  return {
    decision,
    reasoning,
    confidence,
    reasoningHash,
    model: "rule-based-v1",
    timestamp: Date.now(),
    factors,
  };
}

/**
 * Evaluate a trading signal's accuracy.
 * Called when the Treasury reviews whether a Research signal was correct.
 */
export function evaluateSignal(
  signalDirection: "LONG" | "SHORT" | "HOLD",
  actualPriceChange: number,
  signalConfidence: number,
): SignalEvaluation {
  const factors: DecisionFactor[] = [];

  // Factor 1: Direction accuracy
  const signalExpectsUp = signalDirection === "LONG";
  const priceWentUp = actualPriceChange > 0;
  const directionCorrect = signalDirection === "HOLD"
    ? Math.abs(actualPriceChange) < 0.5  // HOLD is correct if price barely moved
    : signalExpectsUp === priceWentUp;

  factors.push({
    name: "Direction Accuracy",
    value: directionCorrect ? "Correct" : "Incorrect",
    weight: 0.5,
    signal: directionCorrect ? "positive" : "negative",
  });

  // Factor 2: Magnitude
  const magnitude = Math.abs(actualPriceChange);
  factors.push({
    name: "Price Movement",
    value: `${actualPriceChange > 0 ? "+" : ""}${actualPriceChange.toFixed(2)}%`,
    weight: 0.25,
    signal: magnitude > 1 ? (directionCorrect ? "positive" : "negative") : "neutral",
  });

  // Factor 3: Confidence calibration
  const confidenceCalibrated = directionCorrect
    ? signalConfidence > 0.5
    : signalConfidence < 0.5;
  factors.push({
    name: "Confidence Calibration",
    value: `${(signalConfidence * 100).toFixed(0)}% confidence`,
    weight: 0.25,
    signal: confidenceCalibrated ? "positive" : "neutral",
  });

  const decision: "complete" | "reject" = directionCorrect ? "complete" : "reject";

  const reasoning = directionCorrect
    ? `Signal was ${signalDirection} with ${(signalConfidence * 100).toFixed(0)}% confidence. ` +
      `Actual price moved ${actualPriceChange > 0 ? "up" : "down"} ${magnitude.toFixed(2)}%. ` +
      `Direction was correct — releasing payment to Research agent.`
    : `Signal was ${signalDirection} with ${(signalConfidence * 100).toFixed(0)}% confidence. ` +
      `Actual price moved ${actualPriceChange > 0 ? "up" : "down"} ${magnitude.toFixed(2)}%. ` +
      `Direction was incorrect — refunding payment to Executor via ACPV2.claimRefund().`;

  const confidence = directionCorrect
    ? 0.8 + (magnitude > 2 ? 0.1 : 0)
    : 0.8 + (magnitude > 2 ? 0.1 : 0);

  const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

  return {
    decision,
    reasoning,
    confidence,
    reasoningHash,
    factors,
  };
}
