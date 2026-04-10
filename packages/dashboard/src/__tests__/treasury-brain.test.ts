import { describe, it, expect } from "vitest";
import { evaluateAgent, evaluateSignal } from "../lib/treasury-brain";

describe("Treasury Brain - Agent Evaluation", () => {
  it("should fire agent with low accuracy and declining trend", () => {
    const result = evaluateAgent({
      agentId: 1,
      roleName: "Research",
      accuracy: 35,
      totalSignals: 20,
      profitableSignals: 7,
      recentTrend: "declining",
      currentBalance: "2.0 USDT",
    }, 3);
    expect(result.decision).toBe("fire");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.reasoningHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("should keep agent with good accuracy", () => {
    const result = evaluateAgent({
      agentId: 2,
      roleName: "Executor",
      accuracy: 78,
      totalSignals: 30,
      profitableSignals: 23,
      recentTrend: "stable",
      currentBalance: "5.0 USDT",
    });
    expect(result.decision).toBe("keep");
  });

  it("should warn agent with borderline accuracy", () => {
    const result = evaluateAgent({
      agentId: 1,
      roleName: "Research",
      accuracy: 55,
      totalSignals: 10,
      profitableSignals: 5,
      recentTrend: "stable",
      currentBalance: "1.0 USDT",
    });
    expect(result.decision).toBe("warn");
  });

  it("should rehire previously fired agent with recovered accuracy", () => {
    const result = evaluateAgent({
      agentId: 1,
      roleName: "Research",
      accuracy: 70,
      totalSignals: 15,
      profitableSignals: 10,
      recentTrend: "improving",
      currentBalance: "3.0 USDT",
    }, 0, true); // wasFired = true
    expect(result.decision).toBe("rehire");
  });

  it("should fire after consecutive low cycles even if trend is not declining", () => {
    const result = evaluateAgent({
      agentId: 1,
      roleName: "Research",
      accuracy: 40,
      totalSignals: 20,
      profitableSignals: 8,
      recentTrend: "stable",
      currentBalance: "1.0 USDT",
    }, 3);
    expect(result.decision).toBe("fire");
  });

  it("should include model identifier", () => {
    const result = evaluateAgent({
      agentId: 1,
      roleName: "Research",
      accuracy: 80,
      totalSignals: 10,
      profitableSignals: 8,
      recentTrend: "stable",
      currentBalance: "2.0 USDT",
    });
    expect(result.model).toBe("rule-based-v1");
  });

  it("should produce unique reasoning hashes for different decisions", () => {
    const fire = evaluateAgent({
      agentId: 1, roleName: "Research", accuracy: 30,
      totalSignals: 10, profitableSignals: 3, recentTrend: "declining",
      currentBalance: "1.0 USDT",
    });
    const keep = evaluateAgent({
      agentId: 1, roleName: "Research", accuracy: 80,
      totalSignals: 10, profitableSignals: 8, recentTrend: "stable",
      currentBalance: "1.0 USDT",
    });
    expect(fire.reasoningHash).not.toBe(keep.reasoningHash);
  });
});

describe("Treasury Brain - Signal Evaluation", () => {
  it("should complete correct LONG signal", () => {
    const result = evaluateSignal("LONG", 3.5, 0.8);
    expect(result.decision).toBe("complete");
    expect(result.factors.length).toBe(3);
  });

  it("should reject incorrect LONG signal", () => {
    const result = evaluateSignal("LONG", -2.0, 0.7);
    expect(result.decision).toBe("reject");
  });

  it("should complete correct SHORT signal", () => {
    const result = evaluateSignal("SHORT", -4.0, 0.85);
    expect(result.decision).toBe("complete");
  });

  it("should reject incorrect SHORT signal", () => {
    const result = evaluateSignal("SHORT", 1.5, 0.6);
    expect(result.decision).toBe("reject");
  });

  it("should produce valid reasoning hash", () => {
    const result = evaluateSignal("LONG", 2.0, 0.7);
    expect(result.reasoningHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
