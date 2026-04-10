import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ethers to avoid needing real crypto
vi.mock("ethers", () => ({
  ethers: {
    keccak256: vi.fn().mockReturnValue("0xmockhash1234567890abcdef"),
    toUtf8Bytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  },
}));

vi.mock("../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock fetch globally to prevent network calls
const mockFetch = vi.fn().mockResolvedValue({ ok: false });
vi.stubGlobal("fetch", mockFetch);

import { treasuryDecision, researchSignal } from "../llm-brain.js";
import type { AgentPerformance, TradeSignal } from "../llm-brain.js";

describe("llm-brain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no API keys are set so fallback logic is used
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  describe("treasuryDecision (fallback rule-based)", () => {
    it("should return fire for low accuracy + declining trend", async () => {
      const perf: AgentPerformance = {
        agentId: 1,
        roleName: "research",
        accuracy: 40,
        totalSignals: 20,
        profitableSignals: 8,
        avgSlippage: 2.5,
        recentTrend: "declining",
        currentBalance: "100",
      };

      const result = await treasuryDecision(perf);
      expect(result.decision).toBe("fire");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoningHash).toBeTruthy();
      expect(result.model).toBe("fallback");
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it("should return warn for accuracy below 60%", async () => {
      const perf: AgentPerformance = {
        agentId: 2,
        roleName: "executor",
        accuracy: 55,
        totalSignals: 20,
        profitableSignals: 11,
        avgSlippage: 1.0,
        recentTrend: "stable",
        currentBalance: "200",
      };

      const result = await treasuryDecision(perf);
      expect(result.decision).toBe("warn");
      expect(result.model).toBe("fallback");
    });

    it("should return keep for good accuracy", async () => {
      const perf: AgentPerformance = {
        agentId: 3,
        roleName: "treasury",
        accuracy: 75,
        totalSignals: 50,
        profitableSignals: 38,
        avgSlippage: 0.5,
        recentTrend: "improving",
        currentBalance: "500",
      };

      const result = await treasuryDecision(perf);
      expect(result.decision).toBe("keep");
      expect(result.model).toBe("fallback");
    });

    it("should return a valid LLMDecision shape", async () => {
      const perf: AgentPerformance = {
        agentId: 1,
        roleName: "research",
        accuracy: 60,
        totalSignals: 10,
        profitableSignals: 6,
        avgSlippage: 1.0,
        recentTrend: "stable",
        currentBalance: "100",
      };

      const result = await treasuryDecision(perf);
      expect(result).toHaveProperty("decision");
      expect(result).toHaveProperty("reasoning");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("reasoningHash");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("timestamp");
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("researchSignal (fallback rule-based)", () => {
    it("should return LONG for significant LP inflow", async () => {
      const data: TradeSignal = {
        pool: "0xpool1",
        pair: "USDT/WETH",
        token0Reserve: "1000000",
        token1Reserve: "500",
        volume24h: "50000",
        priceChange24h: "2.5",
        lpFlowDirection: "inflow",
        lpFlowPercent: 10,
        largeSwapDetected: false,
      };

      const result = await researchSignal(data);
      expect(result.decision).toBe("LONG");
      expect(result.model).toBe("fallback");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should return SHORT for significant LP outflow", async () => {
      const data: TradeSignal = {
        pool: "0xpool2",
        pair: "USDT/OKB",
        token0Reserve: "500000",
        token1Reserve: "1000",
        volume24h: "30000",
        priceChange24h: "-3.0",
        lpFlowDirection: "outflow",
        lpFlowPercent: 8,
        largeSwapDetected: true,
      };

      const result = await researchSignal(data);
      expect(result.decision).toBe("SHORT");
      expect(result.model).toBe("fallback");
    });

    it("should return HOLD for neutral LP flow", async () => {
      const data: TradeSignal = {
        pool: "0xpool3",
        pair: "USDT/DAI",
        token0Reserve: "1000000",
        token1Reserve: "1000000",
        volume24h: "10000",
        priceChange24h: "0.1",
        lpFlowDirection: "neutral",
        lpFlowPercent: 1,
        largeSwapDetected: false,
      };

      const result = await researchSignal(data);
      expect(result.decision).toBe("HOLD");
      expect(result.model).toBe("fallback");
    });

    it("should return a valid LLMDecision shape", async () => {
      const data: TradeSignal = {
        pool: "0xpool1",
        pair: "USDT/WETH",
        token0Reserve: "1000000",
        token1Reserve: "500",
        volume24h: "50000",
        priceChange24h: "2.5",
        lpFlowDirection: "inflow",
        lpFlowPercent: 10,
        largeSwapDetected: false,
      };

      const result = await researchSignal(data);
      expect(["LONG", "SHORT", "HOLD"]).toContain(result.decision);
      expect(result).toHaveProperty("reasoning");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("reasoningHash");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("timestamp");
    });
  });
});
