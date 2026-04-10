import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process for onchainos CLI calls
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

// Mock fetch for Uniswap Trading API
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { execSync } from "child_process";
const mockExecSync = vi.mocked(execSync);

import {
  getUniswapQuote,
  compareRoutes,
  planSwapWithAI,
  getPoolAnalysis,
} from "../uniswap-ai.js";

describe("uniswap-ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockExecSync.mockReset();
  });

  describe("getUniswapQuote", () => {
    it("should fetch quote from Uniswap Trading API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          quote: {
            output: { amount: "1500000000000000000" },
          },
          routing: "CLASSIC",
        }),
      });

      const quote = await getUniswapQuote(
        "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
        "1.0",
      );

      expect(quote).toBeDefined();
      expect(quote.source).toBe("uniswap-api");
    });

    it("should fallback to onchainos CLI when API fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      mockExecSync.mockReturnValue(JSON.stringify({
        amountOut: "1.5",
        route: "USDT->WOKB",
        priceImpact: "0.1",
      }));

      const quote = await getUniswapQuote(
        "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
        "1.0",
      );

      expect(quote).toBeDefined();
      expect(quote.source).toBe("onchainos-cli");
    });

    it("should return fallback quote when everything fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      mockExecSync.mockImplementation(() => { throw new Error("CLI not found"); });

      const quote = await getUniswapQuote("0xin", "0xout", "1.0");

      expect(quote.source).toBe("fallback");
      expect(quote.amountOut).toBe("0");
    });
  });

  describe("compareRoutes", () => {
    it("should compare Uniswap and OKX routes", async () => {
      // Mock both fetches (Uniswap API for both calls)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            quote: { output: { amount: "1500000000000000000" } },
            routing: "CLASSIC",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            quote: { output: { amount: "1400000000000000000" } },
            routing: "CLASSIC",
          }),
        });

      // OKX DEX quote via onchainos
      mockExecSync.mockReturnValue(JSON.stringify({
        amountOut: "1.48",
        route: "USDT->WOKB",
        priceImpact: "0.2",
      }));

      const comparison = await compareRoutes("0xin", "0xout", "1.0");

      expect(comparison).toBeDefined();
      expect(comparison.winner).toBeDefined();
      expect(typeof comparison.differencePercent).toBe("string");
    });
  });

  describe("getPoolAnalysis", () => {
    it("should return pool analysis from onchainos CLI", async () => {
      mockExecSync.mockReturnValue(JSON.stringify({
        poolAddress: "0xpool",
        token0: "0xt0",
        token1: "0xt1",
        feeTier: 3000,
        totalLiquidityUsd: "500000",
        tickRanges: [],
        currentTick: 100,
        impermanentLossEstimate: "0.02",
      }));

      const analysis = await getPoolAnalysis("0xpool");

      expect(analysis.poolAddress).toBe("0xpool");
      expect(analysis.feeTier).toBe(3000);
      expect(analysis.totalLiquidityUsd).toBe("500000");
    });

    it("should return fallback analysis on failure", async () => {
      mockExecSync.mockImplementation(() => { throw new Error("fail"); });
      // Also mock the fetch fallback
      mockFetch.mockRejectedValue(new Error("fail"));

      const analysis = await getPoolAnalysis("0xpool");

      expect(analysis.source).toBe("fallback");
      expect(analysis.totalLiquidityUsd).toBe("0");
    });
  });

  describe("planSwapWithAI", () => {
    it("should return a swap plan", async () => {
      // Mock getPoolAnalysis (onchainos CLI)
      mockExecSync.mockReturnValue(JSON.stringify({
        poolAddress: "0xpool",
        token0: "0xt0",
        token1: "0xt1",
        feeTier: 3000,
        totalLiquidityUsd: "500000",
        tickRanges: [{ tickLower: -100, tickUpper: 100, liquidityUsd: "400000" }],
        currentTick: 0,
        impermanentLossEstimate: "0.02",
      }));

      // Mock compareRoutes (fetch for Uniswap API)
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          quote: { output: { amount: "1500000000000000000" } },
          routing: "CLASSIC",
        }),
      });

      const plan = await planSwapWithAI({
        tokenIn: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        tokenOut: "0xe538905cf8410324e03a5a23c1c177a474d59b2b",
        amountIn: "10",
        urgency: "medium",
      });

      expect(plan).toBeDefined();
      expect(plan.routeSource).toBeDefined();
      expect(typeof plan.slippage).toBe("number");
      expect(plan.slippage).toBeGreaterThan(0);
      expect(plan.slippage).toBeLessThan(10);
    });
  });
});
