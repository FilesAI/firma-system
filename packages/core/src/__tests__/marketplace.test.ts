import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { AgentMarketplace } from "../marketplace/agent-marketplace.js";
import type { AgentTemplate } from "../marketplace/types.js";

function createTemplate(overrides?: Partial<AgentTemplate>): AgentTemplate {
  return {
    name: "Test Agent",
    version: "1.0.0",
    description: "A test agent",
    author: "test",
    capabilities: ["research"],
    primaryCapability: "research",
    requiredSkills: [],
    minimumBudget: "1.0",
    expectedAccuracy: 0.8,
    expectedThroughput: 10,
    costPerJob: "0.01",
    revenueShare: 10,
    entrypoint: "./test-agent.js",
    ...overrides,
  };
}

describe("AgentMarketplace", () => {
  let marketplace: AgentMarketplace;

  beforeEach(() => {
    marketplace = new AgentMarketplace();
  });

  it("should list a new agent", async () => {
    const template = createTemplate();
    const listing = await marketplace.listAgent(template);

    expect(listing.id).toContain("agent-test-agent-");
    expect(listing.status).toBe("available");
    expect(listing.template.name).toBe("Test Agent");
    expect(listing.metrics.totalJobs).toBe(0);
  });

  it("should hire an available agent", async () => {
    const listing = await marketplace.listAgent(createTemplate());
    const hired = await marketplace.hireAgent(listing.id);

    expect(hired).not.toBeNull();
    expect(hired!.status).toBe("hired");
    expect(hired!.hiredAt).toBeDefined();
  });

  it("should not hire an already hired agent", async () => {
    const listing = await marketplace.listAgent(createTemplate());
    await marketplace.hireAgent(listing.id);
    const second = await marketplace.hireAgent(listing.id);

    expect(second).toBeNull();
  });

  it("should fire an agent", async () => {
    const listing = await marketplace.listAgent(createTemplate());
    await marketplace.hireAgent(listing.id);
    await marketplace.fireAgent(listing.id, "Poor performance");

    const all = marketplace.getAllListings();
    const fired = all.find((l) => l.id === listing.id);
    expect(fired!.status).toBe("suspended");
    expect(fired!.firedAt).toBeDefined();
  });

  it("should update metrics and recalculate accuracy", () => {
    marketplace.listAgent(createTemplate()).then(async (listing) => {
      await marketplace.hireAgent(listing.id);

      marketplace.updateMetrics(listing.id, {
        totalJobs: 10,
        successfulJobs: 8,
        failedJobs: 2,
        totalEarned: "5.0",
        totalSpent: "1.0",
      });

      const all = marketplace.getAllListings();
      const updated = all.find((l) => l.id === listing.id)!;
      expect(updated.metrics.accuracy).toBe(0.8);
      expect(updated.metrics.netProfit).toBe("4.000000");
    });
  });

  it("should update metrics and recalculate accuracy (async)", async () => {
    const listing = await marketplace.listAgent(createTemplate());
    await marketplace.hireAgent(listing.id);

    marketplace.updateMetrics(listing.id, {
      totalJobs: 10,
      successfulJobs: 8,
      failedJobs: 2,
      totalEarned: "5.0",
      totalSpent: "1.0",
    });

    const all = marketplace.getAllListings();
    const updated = all.find((l) => l.id === listing.id)!;
    expect(updated.metrics.accuracy).toBe(0.8);
    expect(updated.metrics.netProfit).toBe("4.000000");
  });

  it("should find agents by capability", async () => {
    const researchAgent = await marketplace.listAgent(
      createTemplate({ name: "Research Bot", capabilities: ["research"] })
    );
    const tradingAgent = await marketplace.listAgent(
      createTemplate({ name: "Trading Bot", capabilities: ["trading"] })
    );

    await marketplace.hireAgent(researchAgent.id);
    await marketplace.hireAgent(tradingAgent.id);

    const researchers = marketplace.findByCapability("research");
    expect(researchers).toHaveLength(1);
    expect(researchers[0].template.name).toBe("Research Bot");

    const traders = marketplace.findByCapability("trading");
    expect(traders).toHaveLength(1);
    expect(traders[0].template.name).toBe("Trading Bot");
  });

  it("should return empty array when no agents match capability", async () => {
    const result = marketplace.findByCapability("compliance");
    expect(result).toHaveLength(0);
  });

  it("should return correct summary", async () => {
    const a1 = await marketplace.listAgent(createTemplate({ name: "Agent 1", capabilities: ["research"] }));
    const a2 = await marketplace.listAgent(createTemplate({ name: "Agent 2", capabilities: ["trading"] }));
    await marketplace.listAgent(createTemplate({ name: "Agent 3", capabilities: ["research"] }));

    await marketplace.hireAgent(a1.id);
    await marketplace.hireAgent(a2.id);

    const summary = marketplace.getSummary();
    expect(summary.totalListed).toBe(3);
    expect(summary.totalHired).toBe(2);
    expect(summary.totalSuspended).toBe(0);
  });
});
