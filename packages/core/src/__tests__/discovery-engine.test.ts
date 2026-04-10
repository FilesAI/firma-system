import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscoveryEngine } from "../skills/discovery-engine.js";
import { SkillRegistry } from "../skills/skill-registry.js";

describe("DiscoveryEngine", () => {
  let registry: SkillRegistry;
  let engine: DiscoveryEngine;

  beforeEach(() => {
    registry = new SkillRegistry();
    engine = new DiscoveryEngine(registry);
  });

  it("should initialize with default config", () => {
    const stats = engine.getStats();
    expect(stats.totalScans).toBe(0);
    expect(stats.totalExecutions).toBe(0);
    expect(stats.queueLength).toBe(0);
  });

  it("should return empty on scan with no skills", async () => {
    const opportunities = await engine.scan();
    expect(opportunities).toEqual([]);
  });

  it("should update config", () => {
    engine.updateConfig({ minConfidence: 0.8 });
    // Engine should not crash
    expect(engine.getStats().totalScans).toBe(0);
  });

  it("should track scan count", async () => {
    await engine.scan();
    await engine.scan();
    expect(engine.getStats().totalScans).toBe(2);
  });

  it("should start and stop without errors", () => {
    engine.start();
    engine.stop();
    // Should not throw
  });

  it("should maintain empty queue initially", () => {
    expect(engine.getQueue()).toEqual([]);
    expect(engine.getHistory()).toEqual([]);
  });

  it("should clear queue", async () => {
    engine.clearQueue();
    expect(engine.getQueue()).toEqual([]);
  });

  it("should set callbacks without error", () => {
    engine.onOpportunity(() => {});
    engine.onExecution(() => {});
    // Should not throw
  });
});
