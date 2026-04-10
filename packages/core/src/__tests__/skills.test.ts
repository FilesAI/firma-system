import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { SkillRegistry } from "../skills/skill-registry.js";
import type { ISkillPlugin, SkillMetadata, SkillHealth } from "../skills/types.js";

function createMockSkill(overrides?: Partial<SkillMetadata>): ISkillPlugin {
  const metadata: SkillMetadata = {
    id: "mock-skill",
    name: "Mock Skill",
    description: "A mock skill for testing",
    version: "1.0.0",
    protocol: "mock-protocol",
    categories: ["swap"],
    supportedChains: [196],
    riskLevel: "low",
    isActive: true,
    requiredConfig: [],
    ...overrides,
  };

  return {
    metadata,
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      status: "active",
      message: "OK",
      timestamp: Date.now(),
    } satisfies SkillHealth),
    discover: vi.fn().mockResolvedValue([]),
    evaluate: vi.fn().mockResolvedValue({
      score: 0.8,
      recommendation: "execute" as const,
      reasoning: "Looks good",
    }),
    execute: vi.fn().mockResolvedValue({
      success: true,
      txHash: "0xabc",
      executedAt: Date.now(),
    }),
    getActivePositions: vi.fn().mockResolvedValue([]),
    exitPosition: vi.fn().mockResolvedValue({
      success: true,
      executedAt: Date.now(),
    }),
  };
}

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it("should register and retrieve a skill", async () => {
    const skill = createMockSkill();
    await registry.register(skill);

    const retrieved = registry.getSkill("mock-skill");
    expect(retrieved).toBe(skill);
    expect(skill.initialize).toHaveBeenCalled();
  });

  it("should retrieve a skill by id (primary key)", async () => {
    const skill = createMockSkill({ id: "test-id", name: "Test Skill" });
    await registry.register(skill);

    // Primary lookup: by metadata.id
    const byId = registry.getSkill("test-id");
    expect(byId).toBe(skill);

    // Name lookup only works when slugified name matches the stored key
    // Since id="test-id" but slugified "Test Skill" = "test-skill", they don't match
    const byMismatchedName = registry.getSkill("Test Skill");
    expect(byMismatchedName).toBeNull();
  });

  it("should unregister a skill", async () => {
    const skill = createMockSkill();
    await registry.register(skill);
    expect(registry.getSkill("mock-skill")).toBe(skill);

    await registry.unregister("mock-skill");
    expect(registry.getSkill("mock-skill")).toBeNull();
    expect(skill.shutdown).toHaveBeenCalled();
  });

  it("should warn but not fail on duplicate registration", async () => {
    const skill1 = createMockSkill();
    const skill2 = createMockSkill();

    await registry.register(skill1);
    // Should not throw
    await registry.register(skill2);

    // The second registration overwrites
    const retrieved = registry.getSkill("mock-skill");
    expect(retrieved).toBe(skill2);
  });

  it("should record execution and update successRate", async () => {
    const skill = createMockSkill();
    await registry.register(skill);

    registry.recordExecution("mock-skill", true, 1.5);
    registry.recordExecution("mock-skill", true, 2.0);
    registry.recordExecution("mock-skill", false, 0);

    const entries = registry.getAllSkills();
    const entry = entries.find((e) => e.metadata.id === "mock-skill");
    expect(entry).toBeDefined();
    expect(entry!.totalExecutions).toBe(3);
    // 2 successes out of 3
    expect(entry!.successRate).toBeCloseTo(2 / 3, 2);
    expect(parseFloat(entry!.totalRevenue)).toBeCloseTo(3.5, 4);
  });

  it("should return correct summary counts", async () => {
    const skill1 = createMockSkill({ id: "skill-1", name: "Skill 1", categories: ["swap"] });
    const skill2 = createMockSkill({
      id: "skill-2",
      name: "Skill 2",
      categories: ["lend"],
    });
    // Make skill2 health check return degraded
    (skill2.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
      healthy: false,
      status: "degraded",
      message: "Degraded",
      timestamp: Date.now(),
    });

    await registry.register(skill1);
    await registry.register(skill2);

    const summary = registry.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.active).toBe(1);
    expect(summary.degraded).toBe(1);
    expect(summary.offline).toBe(0);
    expect(summary.byCategory).toHaveProperty("swap", 1);
    expect(summary.byCategory).toHaveProperty("lend", 1);
  });
});
