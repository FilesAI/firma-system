/**
 * wallet-intel.ts — OKX OnchainOS wallet portfolio integration for Ops Agent.
 *
 * Uses onchainos CLI to query real wallet balances for all agents,
 * enriching ops reports with actual on-chain asset data.
 */

import { execSync } from "child_process";
import { createLogger, AGENT_WALLETS } from "@firma/core";

const log = createLogger("WalletIntel");

export interface AgentBalance {
  agent: string;
  address: string;
  totalValueUsd: string;
  tokens: Array<{ symbol: string; balance: string; valueUsd: string }>;
  error?: string;
}

function runPortfolioCommand(args: string): unknown | null {
  try {
    const result = execSync(`npx onchainos portfolio ${args}`, {
      timeout: 15_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message.substring(0, 80) : String(err);
    log.warn(`Portfolio query failed: ${msg}`);
    return null;
  }
}

/**
 * Fetch portfolio balances for all agent wallets on X Layer.
 */
export async function fetchAgentPortfolios(): Promise<AgentBalance[]> {
  log.info("Fetching agent wallet portfolios via OnchainOS...");

  const agents = [
    { name: "Research", address: AGENT_WALLETS.research.address },
    { name: "Executor", address: AGENT_WALLETS.executor.address },
    { name: "Treasury", address: AGENT_WALLETS.treasury.address },
    { name: "Ops", address: AGENT_WALLETS.ops.address },
  ];

  const results: AgentBalance[] = [];

  for (const agent of agents) {
    const data = runPortfolioCommand(
      `all-balances --address ${agent.address} --chains "xlayer"`,
    ) as {
      ok?: boolean;
      data?: Array<{
        symbol?: string;
        balance?: string;
        tokenPrice?: string;
      }>;
    } | null;

    if (!data || !data.data) {
      results.push({
        agent: agent.name,
        address: agent.address,
        totalValueUsd: "0",
        tokens: [],
        error: "Query failed",
      });
      continue;
    }

    const tokens = Array.isArray(data.data)
      ? data.data.map((t) => ({
          symbol: t.symbol || "???",
          balance: t.balance || "0",
          valueUsd: String(
            parseFloat(t.balance || "0") * parseFloat(t.tokenPrice || "0"),
          ),
        }))
      : [];

    const totalValue = tokens.reduce(
      (sum, t) => sum + parseFloat(t.valueUsd || "0"),
      0,
    );

    results.push({
      agent: agent.name,
      address: agent.address,
      totalValueUsd: totalValue.toFixed(2),
      tokens,
    });

    log.info(`${agent.name}: $${totalValue.toFixed(2)} (${tokens.length} tokens)`);
  }

  return results;
}

/**
 * Generate a summary string of agent portfolios for report inclusion.
 */
export function formatPortfolioSummary(portfolios: AgentBalance[]): string {
  const lines = portfolios.map((p) => {
    if (p.error) return `  ${p.agent} (${p.address.slice(0, 6)}...): query failed`;
    const tokenList = p.tokens
      .filter((t) => parseFloat(t.balance) > 0)
      .map((t) => `${t.balance} ${t.symbol}`)
      .join(", ");
    return `  ${p.agent} (${p.address.slice(0, 6)}...): $${p.totalValueUsd} [${tokenList || "no tokens"}]`;
  });

  return "Agent Wallet Balances:\n" + lines.join("\n");
}
