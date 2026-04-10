import { createLogger } from "../logger.js";
import type {
  ISkillPlugin,
  SkillRegistryEntry,
  SkillHealth,
  SkillCategory,
  SkillMetadata
} from "./types.js";

const log = createLogger("SkillRegistry");

/**
 * SkillRegistry — Central registry for all Firma skill plugins.
 *
 * Agents discover available skills through this registry.
 * Skills self-register with their capabilities, and the registry
 * tracks health and performance metrics.
 *
 * On-chain anchor: Each skill registration is recorded via ERC-8004
 * Identity Registry for verifiable skill provenance.
 */
export class SkillRegistry {
  private skills: Map<string, SkillRegistryEntry> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Register a new skill plugin.
   */
  async register(skill: ISkillPlugin): Promise<void> {
    const { id, name, version, protocol } = skill.metadata;
    const key = id ?? this.getKey(name);

    if (this.skills.has(key)) {
      log.warn(`Skill "${name}" already registered — updating`);
    }

    // Initialize the skill
    await skill.initialize();

    // Initial health check
    const health = await skill.healthCheck();

    const entry: SkillRegistryEntry = {
      skill,
      metadata: skill.metadata,
      health,
      registeredAt: new Date().toISOString(),
      enabled: true,
      totalOpportunities: 0,
      totalExecutions: 0,
      successRate: 0,
      totalRevenue: "0",
    };

    this.skills.set(key, entry);
    log.info(`Registered skill: ${name} v${version} (${protocol}) — ${health.status}`);
  }

  /**
   * Unregister a skill.
   */
  async unregister(name: string): Promise<void> {
    const key = this.skills.has(name) ? name : this.getKey(name);
    const entry = this.skills.get(key);
    if (entry) {
      await entry.skill.shutdown();
      this.skills.delete(key);
      log.info(`Unregistered skill: ${name}`);
    }
  }

  /**
   * Get a specific skill by name.
   */
  getSkill(nameOrId: string): ISkillPlugin | null {
    // Try direct id lookup first, then fall back to slugified name
    const entry = this.skills.get(nameOrId) ?? this.skills.get(this.getKey(nameOrId));
    return entry?.enabled ? entry.skill : null;
  }

  /**
   * Get all registered skills.
   */
  getAllSkills(): SkillRegistryEntry[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category.
   */
  getSkillsByCategory(category: SkillCategory): SkillRegistryEntry[] {
    return this.getAllSkills().filter(
      (entry) =>
        entry.enabled &&
        (entry.metadata.categories.includes(category) ||
          entry.metadata.capabilities?.includes(category))
    );
  }

  /**
   * Get skills by chain support.
   */
  getSkillsByChain(chainId: number): SkillRegistryEntry[] {
    return this.getAllSkills().filter(
      (entry) => entry.enabled && entry.metadata.supportedChains.includes(chainId)
    );
  }

  /**
   * Enable/disable a skill.
   */
  setEnabled(name: string, enabled: boolean): void {
    const entry = this.skills.get(name) ?? this.skills.get(this.getKey(name));
    if (entry) {
      entry.enabled = enabled;
      log.info(`Skill "${name}" ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /**
   * Update performance metrics for a skill.
   */
  recordExecution(name: string, success: boolean, revenue: number): void {
    const entry = this.skills.get(name) ?? this.skills.get(this.getKey(name));
    if (entry) {
      entry.totalExecutions++;
      const currentRevenue = parseFloat(entry.totalRevenue);
      entry.totalRevenue = (currentRevenue + revenue).toFixed(6);

      // Running average success rate
      entry.successRate =
        (entry.successRate * (entry.totalExecutions - 1) + (success ? 1 : 0)) /
        entry.totalExecutions;
    }
  }

  /**
   * Start periodic health checks for all skills.
   */
  startHealthMonitoring(intervalMs: number = 60_000): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      for (const [key, entry] of this.skills) {
        try {
          entry.health = await entry.skill.healthCheck();
          if (entry.health.status === "offline") {
            log.warn(`Skill "${entry.metadata.name}" is offline`);
          }
        } catch (error) {
          log.error(`Health check failed for "${entry.metadata.name}"`, error);
          entry.health.status = "offline";
        }
      }
    }, intervalMs);

    log.info(`Health monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop health monitoring.
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      log.info("Health monitoring stopped");
    }
  }

  /**
   * Get a summary of all registered skills.
   */
  getSummary(): {
    total: number;
    active: number;
    degraded: number;
    offline: number;
    byCategory: Record<string, number>;
    totalRevenue: string;
  } {
    const entries = this.getAllSkills();
    const byCategory: Record<string, number> = {};

    let totalRevenue = 0;
    let active = 0;
    let degraded = 0;
    let offline = 0;

    for (const entry of entries) {
      totalRevenue += parseFloat(entry.totalRevenue);

      switch (entry.health.status) {
        case "active": active++; break;
        case "degraded": degraded++; break;
        case "offline": offline++; break;
      }

      for (const cap of entry.metadata.categories) {
        byCategory[cap] = (byCategory[cap] || 0) + 1;
      }
    }

    return {
      total: entries.length,
      active,
      degraded,
      offline,
      byCategory,
      totalRevenue: totalRevenue.toFixed(6),
    };
  }

  /**
   * Shutdown all skills and clean up.
   */
  async shutdown(): Promise<void> {
    this.stopHealthMonitoring();
    for (const [_, entry] of this.skills) {
      await entry.skill.shutdown();
    }
    this.skills.clear();
    log.info("All skills shut down");
  }

  private getKey(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-");
  }
}

// Singleton instance
export const skillRegistry = new SkillRegistry();
