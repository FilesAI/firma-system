import { createLogger } from "../logger.js";
import { SkillRegistry } from "./skill-registry.js";
import type {
  Opportunity,
  ExecutionResult,
  DiscoveryConfig,
  RiskLevel,
} from "./types.js";

const log = createLogger("DiscoveryEngine");

const RISK_SCORES: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_CONFIG: DiscoveryConfig = {
  scanIntervalMs: 60_000,
  minConfidence: 0.3,
  maxCapitalPerOpportunity: "1.0",
  maxTotalCapitalDeployed: "5.0",
  maxRiskLevel: "high",
  autoExecute: false,
  enabledCategories: ["swap", "lend", "yield-farm", "aggregator", "payments"],
};

/**
 * DiscoveryEngine — Autonomous opportunity discovery and evaluation.
 *
 * The engine continuously scans all registered skills for opportunities,
 * ranks them by expected risk-adjusted return, and either auto-executes
 * or queues them for Treasury agent approval.
 *
 * Flow:
 *   1. Scan all active skills → collect Opportunity[]
 *   2. Filter by risk tolerance & category
 *   3. Score & rank opportunities
 *   4. Execute top opportunities (if autoExecute) or queue for Treasury
 */
export class DiscoveryEngine {
  private registry: SkillRegistry;
  private config: DiscoveryConfig;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private opportunityQueue: Opportunity[] = [];
  private executionHistory: ExecutionResult[] = [];
  private totalCapitalDeployed = 0;
  private scanCount = 0;
  private onOpportunityFound?: (opportunity: Opportunity) => void;
  private onExecutionComplete?: (result: ExecutionResult) => void;

  constructor(registry: SkillRegistry, config?: Partial<DiscoveryConfig>) {
    this.registry = registry;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set callback for when a new opportunity is discovered.
   */
  onOpportunity(callback: (opportunity: Opportunity) => void): void {
    this.onOpportunityFound = callback;
  }

  /**
   * Set callback for when an execution completes.
   */
  onExecution(callback: (result: ExecutionResult) => void): void {
    this.onExecutionComplete = callback;
  }

  /**
   * Start the autonomous discovery loop.
   */
  start(): void {
    if (this.scanInterval) return;

    log.info("Discovery engine started");
    log.info(
      `Config: scan every ${this.config.scanIntervalMs}ms, ` +
        `min confidence ${this.config.minConfidence}, ` +
        `max risk ${this.config.maxRiskLevel}, ` +
        `auto-execute ${this.config.autoExecute}`,
    );

    // Initial scan
    this.scan().catch((e) => log.error("Initial scan failed", e));

    this.scanInterval = setInterval(() => {
      this.scan().catch((e) => log.error("Scan failed", e));
    }, this.config.scanIntervalMs);
  }

  /**
   * Stop the discovery loop.
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      log.info("Discovery engine stopped");
    }
  }

  /**
   * Run a single discovery scan across all registered skills.
   */
  async scan(): Promise<Opportunity[]> {
    this.scanCount++;
    const allSkills = this.registry.getAllSkills();
    const activeSkills = allSkills.filter(
      (e) => e.enabled && e.health.status !== "offline",
    );

    if (activeSkills.length === 0) {
      log.info("No active skills to scan");
      return [];
    }

    log.info(
      `Scanning ${activeSkills.length} active skills for opportunities...`,
    );

    const allOpportunities: Opportunity[] = [];

    // Discover opportunities from each skill in parallel
    const results = await Promise.allSettled(
      activeSkills.map(async (entry) => {
        try {
          const opportunities = await entry.skill.discover();
          entry.totalOpportunities += opportunities.length;
          return opportunities;
        } catch (error) {
          log.error(`Discovery failed for "${entry.metadata.name}"`, error);
          return [];
        }
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allOpportunities.push(...result.value);
      }
    }

    // Filter opportunities
    const filtered = this.filterOpportunities(allOpportunities);

    // Score and rank
    const ranked = this.rankOpportunities(filtered);

    if (ranked.length > 0) {
      log.info(
        `Found ${ranked.length} viable opportunities (from ${allOpportunities.length} total)`,
      );

      for (const opp of ranked) {
        this.onOpportunityFound?.(opp);
      }
    }

    // Queue or auto-execute
    if (this.config.autoExecute) {
      for (const opp of ranked) {
        if (this.canAllocateCapital(opp)) {
          await this.executeOpportunity(opp);
        }
      }
    } else {
      this.opportunityQueue.push(...ranked);
    }

    return ranked;
  }

  /**
   * Manually execute a queued opportunity (called by Treasury agent).
   */
  async executeOpportunity(opportunity: Opportunity): Promise<ExecutionResult> {
    const skill = this.registry.getSkill(opportunity.skillId);
    if (!skill) {
      return {
        success: false,
        executedAt: Date.now(),
        error: `Skill "${opportunity.skillId}" not found`,
      };
    }

    log.info(
      `Executing opportunity: ${opportunity.description} via ${opportunity.skillId}`,
    );

    try {
      // First, let the skill evaluate the opportunity
      const evaluation = await skill.evaluate(opportunity);

      if (evaluation.recommendation === "skip") {
        log.info(`Skill recommends skipping: ${evaluation.reasoning}`);
        return {
          success: false,
          executedAt: Date.now(),
          error: `Skipped: ${evaluation.reasoning}`,
        };
      }

      // Execute
      const result = await skill.execute(opportunity);

      // Track performance
      const revenue = result.amountOut ? parseFloat(result.amountOut) : 0;
      this.registry.recordExecution(opportunity.skillId, result.success, revenue);

      if (result.success) {
        this.totalCapitalDeployed += opportunity.requiredAmount;
      }

      this.executionHistory.push(result);
      this.onExecutionComplete?.(result);

      return result;
    } catch (error) {
      log.error(`Execution failed for ${opportunity.skillId}`, error);
      const result: ExecutionResult = {
        success: false,
        executedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      this.executionHistory.push(result);
      return result;
    }
  }

  /**
   * Get all queued opportunities (for Treasury review).
   */
  getQueue(): Opportunity[] {
    return [...this.opportunityQueue];
  }

  /**
   * Clear the opportunity queue.
   */
  clearQueue(): void {
    this.opportunityQueue = [];
  }

  /**
   * Get execution history.
   */
  getHistory(): ExecutionResult[] {
    return [...this.executionHistory];
  }

  /**
   * Get engine statistics.
   */
  getStats(): {
    totalScans: number;
    totalOpportunities: number;
    totalExecutions: number;
    successRate: number;
    totalCapitalDeployed: string;
    queueLength: number;
  } {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(
      (r) => r.success,
    ).length;

    return {
      totalScans: this.scanCount,
      totalOpportunities:
        this.opportunityQueue.length + this.executionHistory.length,
      totalExecutions,
      successRate:
        totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      totalCapitalDeployed: this.totalCapitalDeployed.toFixed(6),
      queueLength: this.opportunityQueue.length,
    };
  }

  /**
   * Update the discovery configuration.
   */
  updateConfig(config: Partial<DiscoveryConfig>): void {
    this.config = { ...this.config, ...config };
    log.info("Discovery config updated");

    // Restart if interval changed and engine is running
    if (config.scanIntervalMs && this.scanInterval) {
      this.stop();
      this.start();
    }
  }

  // ====== Private helpers ======

  private filterOpportunities(opportunities: Opportunity[]): Opportunity[] {
    const maxRiskScore = RISK_SCORES[this.config.maxRiskLevel];

    return opportunities.filter((opp) => {
      // Filter by confidence
      if (opp.confidence < this.config.minConfidence) return false;

      // Filter by risk
      if (RISK_SCORES[opp.riskLevel] > maxRiskScore) return false;

      // Filter by category
      if (!this.config.enabledCategories.includes(opp.category)) return false;

      // Filter by capital limit
      if (
        opp.requiredAmount > parseFloat(this.config.maxCapitalPerOpportunity)
      )
        return false;

      // Filter expired (0 means no expiry)
      if (opp.expiresAt > 0 && opp.expiresAt < Date.now()) return false;

      return true;
    });
  }

  private rankOpportunities(opportunities: Opportunity[]): Opportunity[] {
    return opportunities.sort((a, b) => {
      const scoreA = this.calculateScore(a);
      const scoreB = this.calculateScore(b);
      return scoreB - scoreA; // Descending
    });
  }

  private calculateScore(opp: Opportunity): number {
    // Sharpe-like ratio: return / risk * confidence
    const riskMultiplier = 1 / RISK_SCORES[opp.riskLevel];
    return opp.estimatedReturn * riskMultiplier * opp.confidence;
  }

  private canAllocateCapital(opportunity: Opportunity): boolean {
    const maxTotal = parseFloat(this.config.maxTotalCapitalDeployed);
    return this.totalCapitalDeployed + opportunity.requiredAmount <= maxTotal;
  }
}
