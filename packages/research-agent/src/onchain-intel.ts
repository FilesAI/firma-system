/**
 * onchain-intel.ts — OKX OnchainOS integration for Research Agent.
 *
 * Uses onchainos CLI to fetch smart money signals, market data, and token info.
 * These enrich the Research Agent's signal generation beyond simple pool monitoring.
 */

import { execSync } from "child_process";
import { createLogger } from "@firma/core";

const log = createLogger("OnchainIntel");

export interface SmartMoneySignal {
  tokenAddress: string;
  action: string;
  amount: string;
  walletType: string;
  timestamp?: number;
}

export interface MarketData {
  price: string;
  volume24h: string;
  liquidity: string;
  priceChange24h: string;
}

export interface TokenRisk {
  riskLevel: string;
  safe: boolean;
  details: string;
}

function runOnchainosCommand(args: string): unknown | null {
  try {
    const result = execSync(`npx onchainos ${args}`, {
      timeout: 15_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message.substring(0, 100) : String(err);
    log.warn(`onchainos command failed: ${args.split(" ")[0]} — ${msg}`);
    return null;
  }
}

/**
 * Fetch smart money and whale signals from OKX OnchainOS.
 * Uses: onchainos signal list --chain xlayer --wallet-type 1,3
 */
export async function fetchSmartMoneySignals(): Promise<SmartMoneySignal[]> {
  log.info("Fetching smart money signals via OnchainOS...");

  const data = runOnchainosCommand("signal list --chain xlayer --wallet-type 1,3") as {
    ok?: boolean;
    data?: Array<{
      tokenAddress?: string;
      action?: string;
      amount?: string;
      walletType?: string;
      timestamp?: number;
    }>;
  } | null;

  if (!data || !data.data || !Array.isArray(data.data)) {
    log.info("No smart money signals available for X Layer");
    return [];
  }

  const signals: SmartMoneySignal[] = data.data.map((s) => ({
    tokenAddress: s.tokenAddress || "",
    action: s.action || "unknown",
    amount: s.amount || "0",
    walletType: s.walletType || "unknown",
    timestamp: s.timestamp,
  }));

  log.info(`Fetched ${signals.length} smart money signals`);
  return signals;
}

/**
 * Fetch token market data from OKX OnchainOS.
 * Uses: onchainos market price --address <token>
 */
export async function fetchMarketData(tokenAddress: string): Promise<MarketData | null> {
  log.info(`Fetching market data for ${tokenAddress.slice(0, 10)}...`);

  const data = runOnchainosCommand(`market price --address ${tokenAddress}`) as {
    ok?: boolean;
    data?: {
      price?: string;
      volume24h?: string;
      liquidity?: string;
      priceChange24h?: string;
    };
  } | null;

  if (!data || !data.data) {
    return null;
  }

  return {
    price: data.data.price || "0",
    volume24h: data.data.volume24h || "0",
    liquidity: data.data.liquidity || "0",
    priceChange24h: data.data.priceChange24h || "0",
  };
}

/**
 * Fetch token risk/info from OKX OnchainOS.
 * Uses: onchainos token info --address <token>
 */
export async function fetchTokenRisk(tokenAddress: string): Promise<TokenRisk> {
  log.info(`Checking token risk for ${tokenAddress.slice(0, 10)}...`);

  const data = runOnchainosCommand(`token info --address ${tokenAddress}`) as {
    ok?: boolean;
    data?: {
      riskControlLevel?: string;
      tokenTags?: string[];
    };
  } | null;

  if (!data || !data.data) {
    return { riskLevel: "unknown", safe: true, details: "Unable to fetch risk data" };
  }

  const risk = data.data.riskControlLevel || "low";
  const safe = risk !== "high" && risk !== "critical";
  const tags = data.data.tokenTags?.join(", ") || "none";

  return {
    riskLevel: risk,
    safe,
    details: `Risk: ${risk}, Tags: ${tags}`,
  };
}
