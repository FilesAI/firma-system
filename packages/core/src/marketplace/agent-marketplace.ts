import { createLogger } from "../logger.js";
import type {
  AgentTemplate,
  MarketplaceListing,
  AgentMetrics,
  MarketplaceEvent,
  MarketplaceConfig,
  AgentCapability,
} from "./types.js";

const log = createLogger("Marketplace");

const DEFAULT_CONFIG: MarketplaceConfig = {
  autoHire: false,
  minReputationScore: 0,
  maxAgents: 20,
  reviewIntervalMs: 3_600_000, // 1 hour
  minAccuracy: 0.5,
};

/**
 * AgentMarketplace — Open marketplace for AI agents.
 *
 * Extends Firma's 4-agent architecture to an open ecosystem where
 * any AI agent can register, be evaluated, and participate in the
 * autonomous company's operations.
 *
 * Integration points:
 * - ERC-8004 Identity Registry: Agent identity & reputation
 * - ERC-8183 ACPV2: Job escrow & settlement
 * - FirmaCompany.sol: Governance (hire/fire)
 * - Skill Registry: Agent capabilities
 */
export class AgentMarketplace {
  private listings: Map<string, MarketplaceListing> = new Map();
  private eventListeners: ((event: MarketplaceEvent) => void)[] = [];
  private config: MarketplaceConfig;
  private reviewInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<MarketplaceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // List a new agent in the marketplace
  async listAgent(template: AgentTemplate): Promise<MarketplaceListing> {
    const id = `agent-${template.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

    const listing: MarketplaceListing = {
      id,
      template,
      status: "available",
      metrics: {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        accuracy: 0,
        totalEarned: "0",
        totalSpent: "0",
        netProfit: "0",
        avgResponseTime: 0,
        uptime: 100,
        lastActiveAt: new Date().toISOString(),
      },
      listedAt: new Date().toISOString(),
      reputationScore: 0,
      feedbackCount: 0,
    };

    this.listings.set(id, listing);
    this.emit({ type: "agent:listed", listing });
    log.info(`Agent listed: ${template.name} (${id}) — capabilities: ${template.capabilities.join(", ")}`);

    // Auto-hire if enabled and meets requirements
    if (this.config.autoHire && this.canAutoHire(listing)) {
      await this.hireAgent(id);
    }

    return listing;
  }

  // Hire an agent from the marketplace
  async hireAgent(listingId: string): Promise<MarketplaceListing | null> {
    const listing = this.listings.get(listingId);
    if (!listing) {
      log.warn(`Listing not found: ${listingId}`);
      return null;
    }

    if (listing.status !== "available") {
      log.warn(`Agent ${listingId} is not available (status: ${listing.status})`);
      return null;
    }

    const hiredCount = Array.from(this.listings.values()).filter(l => l.status === "hired").length;
    if (hiredCount >= this.config.maxAgents) {
      log.warn(`Maximum agents reached (${this.config.maxAgents})`);
      return null;
    }

    listing.status = "hired";
    listing.hiredAt = new Date().toISOString();
    this.emit({ type: "agent:hired", listing });
    log.info(`Agent hired: ${listing.template.name} (${listingId})`);

    return listing;
  }

  // Fire an agent
  async fireAgent(listingId: string, reason: string): Promise<void> {
    const listing = this.listings.get(listingId);
    if (!listing) return;

    listing.status = "suspended";
    listing.firedAt = new Date().toISOString();
    this.emit({ type: "agent:fired", listing, reason });
    log.warn(`Agent fired: ${listing.template.name} — ${reason}`);
  }

  // Update agent metrics (called after each job)
  updateMetrics(listingId: string, update: Partial<AgentMetrics>): void {
    const listing = this.listings.get(listingId);
    if (!listing) return;

    Object.assign(listing.metrics, update);

    // Recalculate accuracy
    if (listing.metrics.totalJobs > 0) {
      listing.metrics.accuracy = listing.metrics.successfulJobs / listing.metrics.totalJobs;
    }

    // Recalculate net profit
    const earned = parseFloat(listing.metrics.totalEarned);
    const spent = parseFloat(listing.metrics.totalSpent);
    listing.metrics.netProfit = (earned - spent).toFixed(6);

    this.emit({ type: "agent:performance", listing, metrics: listing.metrics });
  }

  // Find agents by capability
  findByCapability(capability: AgentCapability): MarketplaceListing[] {
    return Array.from(this.listings.values()).filter(
      (l) => l.status === "hired" && l.template.capabilities.includes(capability)
    );
  }

  // Find the best agent for a specific capability
  findBestAgent(capability: AgentCapability): MarketplaceListing | null {
    const candidates = this.findByCapability(capability);
    if (candidates.length === 0) return null;

    // Sort by accuracy * reputation, descending
    return candidates.sort((a, b) => {
      const scoreA = a.metrics.accuracy * (a.reputationScore + 1);
      const scoreB = b.metrics.accuracy * (b.reputationScore + 1);
      return scoreB - scoreA;
    })[0];
  }

  // Get all listings
  getAllListings(): MarketplaceListing[] {
    return Array.from(this.listings.values());
  }

  // Get hired agents
  getHiredAgents(): MarketplaceListing[] {
    return Array.from(this.listings.values()).filter((l) => l.status === "hired");
  }

  // Get marketplace summary
  getSummary(): {
    totalListed: number;
    totalHired: number;
    totalSuspended: number;
    totalRevenue: string;
    byCapability: Record<string, number>;
  } {
    const listings = Array.from(this.listings.values());
    const byCapability: Record<string, number> = {};
    let totalRevenue = 0;

    for (const listing of listings) {
      if (listing.status === "hired") {
        totalRevenue += parseFloat(listing.metrics.totalEarned);
        for (const cap of listing.template.capabilities) {
          byCapability[cap] = (byCapability[cap] || 0) + 1;
        }
      }
    }

    return {
      totalListed: listings.length,
      totalHired: listings.filter((l) => l.status === "hired").length,
      totalSuspended: listings.filter((l) => l.status === "suspended").length,
      totalRevenue: totalRevenue.toFixed(6),
      byCapability,
    };
  }

  // Start periodic performance reviews
  startReviews(): void {
    if (this.reviewInterval) return;

    this.reviewInterval = setInterval(() => {
      this.performReview().catch((e) => log.error("Review failed", e));
    }, this.config.reviewIntervalMs);

    log.info("Performance reviews started");
  }

  // Stop reviews
  stopReviews(): void {
    if (this.reviewInterval) {
      clearInterval(this.reviewInterval);
      this.reviewInterval = null;
    }
  }

  // Subscribe to marketplace events
  addEventListener(listener: (event: MarketplaceEvent) => void): void {
    this.eventListeners.push(listener);
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.stopReviews();
    this.eventListeners = [];
    log.info("Marketplace shut down");
  }

  // ====== Private ======

  private async performReview(): Promise<void> {
    const hired = this.getHiredAgents();

    for (const listing of hired) {
      if (listing.metrics.totalJobs >= 10 && listing.metrics.accuracy < this.config.minAccuracy) {
        await this.fireAgent(listing.id,
          `Accuracy ${(listing.metrics.accuracy * 100).toFixed(1)}% below minimum ${this.config.minAccuracy * 100}%`
        );
      }
    }
  }

  private canAutoHire(listing: MarketplaceListing): boolean {
    return (
      listing.reputationScore >= this.config.minReputationScore &&
      listing.template.expectedAccuracy >= this.config.minAccuracy
    );
  }

  private emit(event: MarketplaceEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (e) {
        log.error("Event listener error", e);
      }
    }
  }
}

// Singleton
export const agentMarketplace = new AgentMarketplace();
