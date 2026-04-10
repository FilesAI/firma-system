/**
 * Firma Agent Marketplace
 *
 * An open marketplace where:
 * 1. Anyone can register an AI agent with specific capabilities
 * 2. The Treasury agent evaluates and hires agents based on performance
 * 3. Agents earn USDT through ERC-8183 jobs
 * 4. Reputation is tracked via ERC-8004
 * 5. All settlements are on-chain via X Layer
 */

// Agent capability descriptors
export type AgentCapability =
  | "research"          // Market research & signal generation
  | "trading"           // Trade execution
  | "governance"        // Treasury management & HR
  | "operations"        // Reporting & auditing
  | "risk-management"   // Risk monitoring & hedging
  | "data-analysis"     // On-chain data analytics
  | "portfolio"         // Portfolio optimization
  | "compliance"        // Regulatory compliance
  | "custom";

// Agent template for the marketplace
export interface AgentTemplate {
  // Identity
  name: string;
  version: string;
  description: string;
  author: string;

  // Capabilities
  capabilities: AgentCapability[];
  primaryCapability: AgentCapability;

  // Requirements
  requiredSkills: string[];       // Skill plugin names this agent needs
  minimumBudget: string;          // Minimum USDT to operate

  // Performance specs
  expectedAccuracy: number;       // 0-1
  expectedThroughput: number;     // Jobs per hour

  // On-chain identity
  walletAddress?: string;
  erc8004Id?: number;             // Civilis identity ID

  // Pricing
  costPerJob: string;             // USDT
  revenueShare: number;           // Percentage of profits shared with Firma

  // Code
  entrypoint: string;             // Module path
  configSchema?: Record<string, unknown>;
}

// Marketplace listing
export interface MarketplaceListing {
  id: string;
  template: AgentTemplate;
  status: "available" | "hired" | "suspended" | "retired";

  // Performance metrics (updated live)
  metrics: AgentMetrics;

  // History
  listedAt: string;
  hiredAt?: string;
  firedAt?: string;

  // Reputation (from ERC-8004)
  reputationScore: number;
  feedbackCount: number;
}

// Agent performance metrics
export interface AgentMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  accuracy: number;

  totalEarned: string;          // USDT
  totalSpent: string;           // USDT
  netProfit: string;            // USDT

  avgResponseTime: number;      // Milliseconds
  uptime: number;               // Percentage

  lastActiveAt: string;
}

// Marketplace events for the event bus
export type MarketplaceEvent =
  | { type: "agent:listed"; listing: MarketplaceListing }
  | { type: "agent:hired"; listing: MarketplaceListing }
  | { type: "agent:fired"; listing: MarketplaceListing; reason: string }
  | { type: "agent:performance"; listing: MarketplaceListing; metrics: AgentMetrics }
  | { type: "agent:upgraded"; listing: MarketplaceListing; fromVersion: string };

// Marketplace configuration
export interface MarketplaceConfig {
  // Auto-hire agents that meet minimum requirements
  autoHire: boolean;

  // Minimum reputation score to be hireable
  minReputationScore: number;

  // Maximum number of agents
  maxAgents: number;

  // Performance review interval
  reviewIntervalMs: number;

  // Minimum accuracy before firing
  minAccuracy: number;
}
