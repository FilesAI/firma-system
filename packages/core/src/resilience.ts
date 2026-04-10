/**
 * Firma Resilience Module
 *
 * Ensures the autonomous company never fully stops, even when agents
 * are fired. Each role degrades gracefully rather than crashing.
 *
 * Degradation strategies:
 * - Research fired  → Executor enters "observation mode" (monitors, no trades)
 * - Executor fired  → Signals still generated, trades paused, revenue logged as 0
 * - Treasury fired  → Auto-renew all agents, skip governance decisions
 * - Ops fired       → Economy continues, reports paused
 */

import { createLogger } from "./logger.js";
import { isAgentActive, getAgent } from "./firma-company.js";
import { getProvider } from "./wallet.js";
import { AGENT_WALLETS, XLAYER_RPC } from "./config.js";
import type { AgentRole } from "./types.js";

const log = createLogger("Resilience");

// ====== Agent Status ======

export type AgentOperationalStatus =
  | "active"           // Normal operation
  | "degraded"         // Agent is fired, role running in degraded mode
  | "observation"      // Monitoring only, no execution
  | "auto-renew"       // Governance on autopilot
  | "paused";          // Completely paused

export interface CompanyHealth {
  overall: "healthy" | "degraded" | "critical";
  agents: {
    research: AgentOperationalStatus;
    executor: AgentOperationalStatus;
    treasury: AgentOperationalStatus;
    ops: AgentOperationalStatus;
  };
  activeCount: number;
  firedCount: number;
  degradedRoles: string[];
  economyCycleRunning: boolean;
  lastCheckedAt: string;
}

/**
 * Check the on-chain status of all agents and determine company health.
 */
export async function getCompanyHealth(): Promise<CompanyHealth> {
  const provider = getProvider();

  const agentIds = [
    { role: "research" as const, id: AGENT_WALLETS.research.agentId },
    { role: "executor" as const, id: AGENT_WALLETS.executor.agentId },
    { role: "treasury" as const, id: AGENT_WALLETS.treasury.agentId },
    { role: "ops" as const, id: AGENT_WALLETS.ops.agentId },
  ];

  const agents: CompanyHealth["agents"] = {
    research: "active",
    executor: "active",
    treasury: "active",
    ops: "active",
  };

  let activeCount = 0;
  let firedCount = 0;
  const degradedRoles: string[] = [];

  for (const { role, id } of agentIds) {
    try {
      const active = await isAgentActive(provider, id);
      if (active) {
        agents[role] = "active";
        activeCount++;
      } else {
        firedCount++;
        degradedRoles.push(role);

        // Determine degradation mode per role
        switch (role) {
          case "research":
            agents[role] = "observation";
            break;
          case "executor":
            agents[role] = "paused";
            break;
          case "treasury":
            agents[role] = "auto-renew";
            break;
          case "ops":
            agents[role] = "paused";
            break;
        }
      }
    } catch {
      // If we can't check (e.g., contract not deployed), assume active
      agents[role] = "active";
      activeCount++;
    }
  }

  // Economy cycle runs if at least Research OR Executor is active
  const economyCycleRunning =
    agents.research === "active" || agents.executor === "active";

  // Overall health
  let overall: CompanyHealth["overall"];
  if (firedCount === 0) {
    overall = "healthy";
  } else if (firedCount <= 2 && economyCycleRunning) {
    overall = "degraded";
  } else {
    overall = "critical";
  }

  return {
    overall,
    agents,
    activeCount,
    firedCount,
    degradedRoles,
    economyCycleRunning,
    lastCheckedAt: new Date().toISOString(),
  };
}

/**
 * Check if a specific agent role should execute its primary function.
 *
 * Returns true if the agent is active and should proceed normally.
 * Returns false if the agent is fired and should enter degraded mode.
 */
export async function shouldExecute(
  agentId: number,
  roleName: string,
): Promise<{ active: boolean; mode: AgentOperationalStatus; reason: string }> {
  try {
    const provider = getProvider();
    const active = await isAgentActive(provider, agentId);

    if (active) {
      return { active: true, mode: "active", reason: "Agent is active" };
    }

    log.warn(`Agent #${agentId} (${roleName}) is FIRED — entering degraded mode`);

    return {
      active: false,
      mode: "degraded",
      reason: `Agent #${agentId} (${roleName}) has been fired by Treasury. Operating in degraded mode until rehired.`,
    };
  } catch {
    // If we can't check (contract not deployed yet), default to active
    return { active: true, mode: "active", reason: "Status check unavailable, defaulting to active" };
  }
}

/**
 * Log a degradation event for monitoring.
 */
export function logDegradation(
  role: string,
  mode: AgentOperationalStatus,
  detail: string,
): void {
  switch (mode) {
    case "observation":
      log.warn(`[${role}] OBSERVATION MODE: ${detail}`);
      break;
    case "paused":
      log.warn(`[${role}] PAUSED: ${detail}`);
      break;
    case "auto-renew":
      log.warn(`[${role}] AUTO-RENEW MODE: ${detail}`);
      break;
    case "degraded":
      log.warn(`[${role}] DEGRADED: ${detail}`);
      break;
    default:
      log.info(`[${role}] ${mode}: ${detail}`);
  }
}

/**
 * Create a human-readable company health report.
 */
export function formatHealthReport(health: CompanyHealth): string {
  const lines: string[] = [
    `=== Firma Company Health Report ===`,
    `Overall: ${health.overall.toUpperCase()}`,
    `Active Agents: ${health.activeCount}/4`,
    `Economy Cycle: ${health.economyCycleRunning ? "RUNNING" : "STOPPED"}`,
    ``,
    `Agent Status:`,
    `  Research:  ${health.agents.research}`,
    `  Executor:  ${health.agents.executor}`,
    `  Treasury:  ${health.agents.treasury}`,
    `  Ops:       ${health.agents.ops}`,
  ];

  if (health.degradedRoles.length > 0) {
    lines.push(``, `Degraded Roles: ${health.degradedRoles.join(", ")}`);
  }

  lines.push(``, `Last Checked: ${health.lastCheckedAt}`);

  return lines.join("\n");
}
