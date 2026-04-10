/**
 * security-scanner.ts — OKX OnchainOS security integration for Treasury Agent.
 *
 * Uses onchainos CLI to scan tokens and transactions for security risks
 * before Treasury approves them. This is a critical safety layer.
 */

import { execSync } from "child_process";
import { createLogger } from "@firma/core";

const log = createLogger("SecurityScanner");

export interface SecurityResult {
  safe: boolean;
  riskLevel: string;
  details: string;
}

function runSecurityCommand(args: string): unknown | null {
  try {
    const result = execSync(`npx onchainos security ${args}`, {
      timeout: 20_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message.substring(0, 100) : String(err);
    log.warn(`Security scan failed: ${msg}`);
    return null;
  }
}

/**
 * Scan a token contract for security risks.
 * Uses: onchainos security token-scan --address <address> --chain xlayer
 */
export async function scanTokenSecurity(tokenAddress: string): Promise<SecurityResult> {
  log.info(`Scanning token security: ${tokenAddress.slice(0, 10)}...`);

  const data = runSecurityCommand(
    `token-scan --address ${tokenAddress} --chain xlayer`,
  ) as {
    ok?: boolean;
    data?: {
      riskLevel?: string;
      isHoneypot?: boolean;
      isMintable?: boolean;
      hasTaxFunction?: boolean;
      isBlacklisted?: boolean;
    };
  } | null;

  if (!data || !data.data) {
    return {
      safe: true, // fail open — don't block if scan unavailable
      riskLevel: "unknown",
      details: "Security scan unavailable — proceeding with caution",
    };
  }

  const d = data.data;
  const risks: string[] = [];
  if (d.isHoneypot) risks.push("HONEYPOT");
  if (d.isMintable) risks.push("MINTABLE");
  if (d.hasTaxFunction) risks.push("TAX_FUNCTION");
  if (d.isBlacklisted) risks.push("BLACKLISTED");

  const riskLevel = d.riskLevel || (risks.length > 0 ? "high" : "low");
  const safe = risks.length === 0 && riskLevel !== "high";

  const result: SecurityResult = {
    safe,
    riskLevel,
    details: risks.length > 0
      ? `Risks detected: ${risks.join(", ")}`
      : "No risks detected",
  };

  log.info(`Token scan result: ${result.riskLevel} — ${result.details}`);
  return result;
}

/**
 * Scan a transaction for security issues.
 * Uses: onchainos security tx-scan --tx <txHash>
 */
export async function scanTransactionSecurity(txHash: string): Promise<SecurityResult> {
  log.info(`Scanning transaction: ${txHash.slice(0, 10)}...`);

  const data = runSecurityCommand(`tx-scan --tx ${txHash}`) as {
    ok?: boolean;
    data?: {
      safe?: boolean;
      riskLevel?: string;
      message?: string;
    };
  } | null;

  if (!data || !data.data) {
    return {
      safe: true,
      riskLevel: "unknown",
      details: "Transaction scan unavailable",
    };
  }

  return {
    safe: data.data.safe !== false,
    riskLevel: data.data.riskLevel || "unknown",
    details: data.data.message || "Scan complete",
  };
}
