/**
 * llm-brain.ts — LLM-powered decision engine for Firma agents.
 *
 * Each agent can call the LLM to get intelligent decisions with reasoning.
 * The reasoning is hashed and anchored on-chain for auditable AI governance.
 *
 * Supports: Anthropic Claude, OpenAI GPT, or local fallback.
 */

import { ethers } from "ethers";
import { createLogger } from "./logger.js";

const log = createLogger("LLM-Brain");

export interface LLMDecision {
  decision: string;
  reasoning: string;
  confidence: number;
  reasoningHash: string;
  model: string;
  timestamp: number;
}

export interface AgentPerformance {
  agentId: number;
  roleName: string;
  accuracy: number;
  totalSignals: number;
  profitableSignals: number;
  avgSlippage: number;
  recentTrend: "improving" | "declining" | "stable";
  currentBalance: string;
}

export interface TradeSignal {
  pool: string;
  pair: string;
  token0Reserve: string;
  token1Reserve: string;
  volume24h: string;
  priceChange24h: string;
  lpFlowDirection: "inflow" | "outflow" | "neutral";
  lpFlowPercent: number;
  largeSwapDetected: boolean;
}

/**
 * Call LLM API to get a governance decision.
 * Falls back to rule-based logic if API is unavailable.
 */
async function callLLM(systemPrompt: string, userPrompt: string): Promise<{ content: string; model: string }> {
  // Try Anthropic Claude first
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (response.ok) {
        const data = await response.json() as { content: Array<{ text: string }>; model: string };
        return { content: data.content[0].text, model: data.model };
      }
    } catch (err) {
      log.warn(`Anthropic API failed: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`);
    }
  }

  // Try OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 512,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json() as { choices: Array<{ message: { content: string } }>; model: string };
        return { content: data.choices[0].message.content, model: data.model };
      }
    } catch (err) {
      log.warn(`OpenAI API failed: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}`);
    }
  }

  // Fallback: return empty to trigger rule-based logic
  return { content: "", model: "fallback" };
}

/**
 * Treasury Brain: Evaluate agent performance and decide hire/fire.
 */
export async function treasuryDecision(performance: AgentPerformance): Promise<LLMDecision> {
  const systemPrompt = `You are the Treasury AI of Firma, an autonomous company on X Layer blockchain.
Your job is to evaluate agent performance and make governance decisions.
You must respond in exactly this JSON format (no markdown, no extra text):
{"decision":"fire"|"keep"|"rehire"|"warn","reasoning":"one paragraph explanation","confidence":0.0-1.0}`;

  const userPrompt = `Evaluate this agent's performance and decide what action to take:

Agent: #${performance.agentId} (${performance.roleName})
Signal Accuracy: ${performance.accuracy}% (${performance.profitableSignals}/${performance.totalSignals} profitable)
Average Slippage: ${performance.avgSlippage}%
Recent Trend: ${performance.recentTrend}
Current Balance: ${performance.currentBalance}

Rules:
- Fire if accuracy < 50% AND trend is declining
- Warn if accuracy < 60% OR trend is declining
- Keep if accuracy >= 60% AND trend is stable or improving
- Rehire if previously fired AND accuracy has recovered above 65%

What is your governance decision?`;

  const { content, model } = await callLLM(systemPrompt, userPrompt);

  let decision: string;
  let reasoning: string;
  let confidence: number;

  if (content && model !== "fallback") {
    try {
      const parsed = JSON.parse(content);
      decision = parsed.decision || "keep";
      reasoning = parsed.reasoning || "LLM provided no reasoning";
      confidence = parsed.confidence || 0.5;
      log.info(`LLM (${model}) decision for #${performance.agentId}: ${decision} (conf=${confidence})`);
    } catch {
      // LLM returned non-JSON, extract what we can
      decision = content.toLowerCase().includes("fire") ? "fire" : "keep";
      reasoning = content.slice(0, 200);
      confidence = 0.5;
      log.warn(`LLM returned non-JSON, parsed heuristically: ${decision}`);
    }
  } else {
    // Rule-based fallback
    if (performance.accuracy < 50 && performance.recentTrend === "declining") {
      decision = "fire";
      reasoning = `Rule-based: Accuracy ${performance.accuracy}% is below 50% threshold and trend is declining. Firing to protect company resources.`;
      confidence = 0.85;
    } else if (performance.accuracy < 60) {
      decision = "warn";
      reasoning = `Rule-based: Accuracy ${performance.accuracy}% is below 60% warning threshold. Monitoring closely.`;
      confidence = 0.7;
    } else {
      decision = "keep";
      reasoning = `Rule-based: Accuracy ${performance.accuracy}% is acceptable. Trend is ${performance.recentTrend}. No action needed.`;
      confidence = 0.8;
    }
    log.info(`Fallback decision for #${performance.agentId}: ${decision}`);
  }

  const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

  return {
    decision,
    reasoning,
    confidence,
    reasoningHash,
    model,
    timestamp: Date.now(),
  };
}

/**
 * Research Brain: Analyze pool data and generate trading signal.
 */
export async function researchSignal(data: TradeSignal): Promise<LLMDecision> {
  const systemPrompt = `You are the Research AI of Firma, analyzing DeFi pools on X Layer.
Your job is to generate trading signals based on on-chain data.
You must respond in exactly this JSON format (no markdown, no extra text):
{"decision":"LONG"|"SHORT"|"HOLD","reasoning":"one paragraph analysis","confidence":0.0-1.0}`;

  const userPrompt = `Analyze this pool data and generate a trading signal:

Pool: ${data.pool}
Pair: ${data.pair}
Token0 Reserve: ${data.token0Reserve}
Token1 Reserve: ${data.token1Reserve}
24h Volume: ${data.volume24h}
24h Price Change: ${data.priceChange24h}
LP Flow: ${data.lpFlowDirection} (${data.lpFlowPercent}%)
Large Swap Detected: ${data.largeSwapDetected}

Generate a signal with direction, reasoning, and confidence.`;

  const { content, model } = await callLLM(systemPrompt, userPrompt);

  let decision: string;
  let reasoning: string;
  let confidence: number;

  if (content && model !== "fallback") {
    try {
      const parsed = JSON.parse(content);
      decision = parsed.decision || "HOLD";
      reasoning = parsed.reasoning || "LLM provided no reasoning";
      confidence = parsed.confidence || 0.5;
    } catch {
      decision = content.toLowerCase().includes("long") ? "LONG" :
                 content.toLowerCase().includes("short") ? "SHORT" : "HOLD";
      reasoning = content.slice(0, 200);
      confidence = 0.5;
    }
  } else {
    // Rule-based fallback
    if (data.lpFlowDirection === "inflow" && data.lpFlowPercent > 5) {
      decision = "LONG";
      reasoning = `Rule-based: LP inflow of ${data.lpFlowPercent}% detected. Positive liquidity trend suggests upward pressure.`;
      confidence = 0.65 + (data.lpFlowPercent / 100);
    } else if (data.lpFlowDirection === "outflow" && data.lpFlowPercent > 5) {
      decision = "SHORT";
      reasoning = `Rule-based: LP outflow of ${data.lpFlowPercent}% detected. Liquidity withdrawal suggests sell pressure building.`;
      confidence = 0.65 + (data.lpFlowPercent / 100);
    } else {
      decision = "HOLD";
      reasoning = `Rule-based: No significant LP flow detected (${data.lpFlowDirection} ${data.lpFlowPercent}%). Insufficient edge for a trade.`;
      confidence = 0.4;
    }
  }

  const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

  return {
    decision,
    reasoning,
    confidence,
    reasoningHash,
    model,
    timestamp: Date.now(),
  };
}

/**
 * Ops Brain: Generate natural language report from cycle data.
 */
export async function opsReport(cycleData: {
  cycleNumber: number;
  transactions: number;
  revenue: string;
  expenses: string;
  agentStatuses: Array<{ id: number; role: string; active: boolean; accuracy?: number }>;
  governanceActions: string[];
}): Promise<LLMDecision> {
  const systemPrompt = `You are the Ops AI of Firma, generating daily operational reports.
Summarize the company's performance in a concise, factual report.
You must respond in exactly this JSON format (no markdown, no extra text):
{"decision":"report","reasoning":"the full report text (2-3 paragraphs)","confidence":1.0}`;

  const userPrompt = `Generate an ops report for this cycle:

Cycle: #${cycleData.cycleNumber}
Transactions: ${cycleData.transactions}
Revenue: ${cycleData.revenue}
Expenses: ${cycleData.expenses}
Agent Statuses: ${JSON.stringify(cycleData.agentStatuses)}
Governance Actions: ${cycleData.governanceActions.join(", ")}

Write a concise operational report.`;

  const { content, model } = await callLLM(systemPrompt, userPrompt);

  let reasoning: string;

  if (content && model !== "fallback") {
    try {
      const parsed = JSON.parse(content);
      reasoning = parsed.reasoning || content;
    } catch {
      reasoning = content.slice(0, 500);
    }
  } else {
    reasoning = `Firma Ops Report — Cycle #${cycleData.cycleNumber}. ` +
      `${cycleData.transactions} on-chain transactions executed. ` +
      `Revenue: ${cycleData.revenue}, Expenses: ${cycleData.expenses}. ` +
      `${cycleData.agentStatuses.filter(a => a.active).length}/${cycleData.agentStatuses.length} agents active. ` +
      `Governance actions: ${cycleData.governanceActions.join(", ") || "none"}. ` +
      `All operations nominal.`;
  }

  const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(reasoning));

  return {
    decision: "report",
    reasoning,
    confidence: 1.0,
    reasoningHash,
    model,
    timestamp: Date.now(),
  };
}
