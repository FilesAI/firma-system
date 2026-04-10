import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the pure logic, not on-chain calls
describe("Civilis ACPV2 Integration", () => {
  it("should export createJob function", async () => {
    const { createJob } = await import("../civilis.js");
    expect(typeof createJob).toBe("function");
  });

  it("should export setProvider function", async () => {
    const { setProvider } = await import("../civilis.js");
    expect(typeof setProvider).toBe("function");
  });

  it("should export claimRefund function", async () => {
    const { claimRefund } = await import("../civilis.js");
    expect(typeof claimRefund).toBe("function");
  });

  it("should export identity registry functions", async () => {
    const { getIdentityRegistry, registerIdentity, getReputation } = await import("../civilis.js");
    expect(typeof getIdentityRegistry).toBe("function");
    expect(typeof registerIdentity).toBe("function");
    expect(typeof getReputation).toBe("function");
  });

  it("should export reputation functions", async () => {
    const { giveFeedback, getReputation } = await import("../civilis.js");
    expect(typeof giveFeedback).toBe("function");
    expect(typeof getReputation).toBe("function");
  });

  it("should have correct contract addresses", async () => {
    const { CIVILIS_CONTRACTS } = await import("../config.js");
    expect(CIVILIS_CONTRACTS.acpv2).toBe("0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e");
    expect(CIVILIS_CONTRACTS.identityRegistry).toBe("0xC9C992C0e2B8E1982DddB8750c15399D01CF907a");
    expect(CIVILIS_CONTRACTS.reputationRegistry).toBe("0xD8499b9A516743153EE65382f3E2C389EE693880");
  });
});
