import { describe, it, expect } from "vitest";
import {
  XLAYER_CHAIN_ID,
  CIVILIS_CONTRACTS,
  X402_CONFIG,
  OPERATION_CONFIG,
} from "../config.js";

describe("config", () => {
  it("XLAYER_CHAIN_ID should be 196", () => {
    expect(XLAYER_CHAIN_ID).toBe(196);
  });

  it("CIVILIS_CONTRACTS should have all 4 contract addresses", () => {
    expect(CIVILIS_CONTRACTS).toHaveProperty("identityRegistry");
    expect(CIVILIS_CONTRACTS).toHaveProperty("reputationRegistry");
    expect(CIVILIS_CONTRACTS).toHaveProperty("validationRegistry");
    expect(CIVILIS_CONTRACTS).toHaveProperty("acpv2");

    // All addresses should be valid hex strings starting with 0x
    for (const addr of Object.values(CIVILIS_CONTRACTS)) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it("X402_CONFIG should have the correct network eip155:196", () => {
    expect(X402_CONFIG.network).toBe("eip155:196");
  });

  it("OPERATION_CONFIG should have sensible defaults", () => {
    expect(OPERATION_CONFIG.fireThreshold).toBeGreaterThan(0);
    expect(OPERATION_CONFIG.fireThreshold).toBeLessThanOrEqual(1);
    expect(OPERATION_CONFIG.fireConsecutiveCycles).toBeGreaterThan(0);
    expect(OPERATION_CONFIG.signalConfidenceThreshold).toBeGreaterThan(0);
    expect(OPERATION_CONFIG.monitorIntervalMs).toBeGreaterThan(0);
    expect(OPERATION_CONFIG.evaluationIntervalMs).toBeGreaterThan(0);
    expect(OPERATION_CONFIG.maxBudgetUsdt).toBeGreaterThan(0);
    expect(OPERATION_CONFIG.rehireThreshold).toBeGreaterThan(OPERATION_CONFIG.fireThreshold);
  });
});
