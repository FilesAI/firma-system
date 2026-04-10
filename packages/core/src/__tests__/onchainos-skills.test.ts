import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockExecSync = vi.mocked(execSync);

import {
  swapViaOnchainos,
  getTransactionStatus,
  estimateGas,
  findYieldOpportunities,
  getWalletPortfolio,
  fetchAggregatedBuySignals,
  getTokenHolderDistribution,
  getTokenKline,
} from "../onchainos-skills.js";

describe("onchainos-skills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("swapViaOnchainos", () => {
    it("should parse successful swap result", () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        txHash: "0xabc123",
        amountOut: "1.5",
        route: ["USDT", "WOKB"],
      }));

      const result = swapViaOnchainos({
        tokenIn: "0xtoken0",
        tokenOut: "0xtoken1",
        amount: "100",
      });

      expect(result.txHash).toBe("0xabc123");
      expect(result.amountOut).toBe("1.5");
      expect(result.route).toEqual(["USDT", "WOKB"]);
    });

    it("should return default on CLI failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("CLI not found"); });

      const result = swapViaOnchainos({
        tokenIn: "0xtoken0",
        tokenOut: "0xtoken1",
        amount: "100",
      });

      expect(result.txHash).toBe("");
      expect(result.amountOut).toBe("0");
      expect(result.route).toEqual([]);
    });
  });

  describe("getTransactionStatus", () => {
    it("should parse tx status", () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        txHash: "0xdef456",
        status: "confirmed",
        confirmations: 12,
        blockNumber: 999999,
      }));

      const result = getTransactionStatus("0xdef456");

      expect(result.txHash).toBe("0xdef456");
      expect(result.confirmations).toBe(12);
      expect(result.blockNumber).toBe(999999);
    });

    it("should return default on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("timeout"); });

      const result = getTransactionStatus("0xdef456");

      expect(result.txHash).toBe("0xdef456");
      expect(result.status).toBe("unknown");
      expect(result.confirmations).toBe(0);
    });
  });

  describe("estimateGas", () => {
    it("should return gas estimate", () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        gasLimit: "210000",
        gasPrice: "0.5",
        estimatedCost: "0.000105",
      }));

      const result = estimateGas({ to: "0xto", data: "0xcalldata" });

      expect(result.gasLimit).toBe("210000");
      expect(result.gasPrice).toBe("0.5");
    });

    it("should return defaults on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });

      const result = estimateGas({ to: "0xto", data: "0xcalldata" });

      expect(result.gasLimit).toBe("0");
      expect(result.gasPrice).toBe("0");
    });
  });

  describe("findYieldOpportunities", () => {
    it("should return opportunities array", () => {
      mockExecSync.mockReturnValue(JSON.stringify([
        { protocol: "Aave", pool: "USDT", apy: "5.2", tvl: "1000000", token: "0xusdt" },
        { protocol: "Compound", pool: "USDT", apy: "4.8", tvl: "800000", token: "0xusdt" },
      ]));

      const result = findYieldOpportunities("0xusdt");

      expect(result).toHaveLength(2);
      expect(result[0].protocol).toBe("Aave");
      expect(result[1].apy).toBe("4.8");
    });

    it("should return empty array on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });

      const result = findYieldOpportunities("0xusdt");

      expect(result).toEqual([]);
    });
  });

  describe("getWalletPortfolio", () => {
    it("should return portfolio with balances", () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        address: "0xwallet",
        totalValueUsd: "1250.50",
        balances: [
          { token: "0xusdt", symbol: "USDT", balance: "1000", valueUsd: "1000" },
          { token: "0xokb", symbol: "OKB", balance: "5", valueUsd: "250.50" },
        ],
      }));

      const result = getWalletPortfolio("0xwallet");

      expect(result.totalValueUsd).toBe("1250.50");
      expect(result.balances).toHaveLength(2);
      expect(result.balances[0].symbol).toBe("USDT");
    });

    it("should return zero portfolio on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });

      const result = getWalletPortfolio("0xwallet");

      expect(result.totalValueUsd).toBe("0");
      expect(result.balances).toEqual([]);
    });
  });

  describe("fetchAggregatedBuySignals", () => {
    it("should return signals array", () => {
      mockExecSync.mockReturnValue(JSON.stringify([
        { token: "0xtoken", symbol: "TOKEN", buyCount: 42, chain: "xlayer" },
      ]));

      const result = fetchAggregatedBuySignals("xlayer");

      expect(result).toHaveLength(1);
    });

    it("should return empty on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });

      const result = fetchAggregatedBuySignals("xlayer");

      expect(result).toEqual([]);
    });
  });

  describe("getTokenHolderDistribution", () => {
    it("should return holder percentages", () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        tokenAddress: "0xtoken",
        whalePercent: 25.5,
        retailPercent: 60.0,
        sniperPercent: 8.3,
        bundlerPercent: 6.2,
      }));

      const result = getTokenHolderDistribution("0xtoken");

      expect(result.whalePercent).toBe(25.5);
      expect(result.sniperPercent).toBe(8.3);
    });

    it("should return zeroed distribution on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });

      const result = getTokenHolderDistribution("0xtoken");

      expect(result.whalePercent).toBe(0);
      expect(result.retailPercent).toBe(0);
    });
  });

  describe("getTokenKline", () => {
    it("should return K-line data", () => {
      mockExecSync.mockReturnValue(JSON.stringify([
        { open: "1.0", high: "1.1", low: "0.9", close: "1.05", volume: "50000", timestamp: "2026-04-12T00:00:00Z" },
      ]));

      const result = getTokenKline("0xtoken", "1h");

      expect(result).toHaveLength(1);
      expect(result[0].close).toBe("1.05");
    });

    it("should return empty on failure", () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });

      const result = getTokenKline("0xtoken", "1h");

      expect(result).toEqual([]);
    });
  });
});
