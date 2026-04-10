import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies before importing the module
vi.mock("../firma-company.js", () => ({
  isAgentActive: vi.fn(),
  getAgent: vi.fn(),
}));

vi.mock("../wallet.js", () => ({
  getProvider: vi.fn().mockReturnValue({}),
}));

vi.mock("../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { logDegradation, shouldExecute } from "../resilience.js";
import { isAgentActive } from "../firma-company.js";

describe("resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logDegradation", () => {
    it("should not throw for observation mode", () => {
      expect(() => logDegradation("research", "observation", "Monitoring only")).not.toThrow();
    });

    it("should not throw for paused mode", () => {
      expect(() => logDegradation("executor", "paused", "Trades paused")).not.toThrow();
    });

    it("should not throw for auto-renew mode", () => {
      expect(() => logDegradation("treasury", "auto-renew", "Auto-renewing agents")).not.toThrow();
    });

    it("should not throw for degraded mode", () => {
      expect(() => logDegradation("ops", "degraded", "Reports delayed")).not.toThrow();
    });

    it("should not throw for active mode", () => {
      expect(() => logDegradation("ops", "active", "All good")).not.toThrow();
    });
  });

  describe("shouldExecute", () => {
    it("should return active status when agent is active on-chain", async () => {
      vi.mocked(isAgentActive).mockResolvedValue(true);

      const result = await shouldExecute(1, "research");
      expect(result.active).toBe(true);
      expect(result.mode).toBe("active");
    });

    it("should return degraded status when agent is fired on-chain", async () => {
      vi.mocked(isAgentActive).mockResolvedValue(false);

      const result = await shouldExecute(1, "research");
      expect(result.active).toBe(false);
      expect(result.mode).toBe("degraded");
      expect(result.reason).toContain("fired");
    });

    it("should default to active when contract check fails", async () => {
      vi.mocked(isAgentActive).mockRejectedValue(new Error("Contract not deployed"));

      const result = await shouldExecute(1, "research");
      expect(result.active).toBe(true);
      expect(result.mode).toBe("active");
    });
  });
});
