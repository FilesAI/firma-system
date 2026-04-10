/**
 * Firma Skill Plugin Type Definitions
 *
 * Defines the interfaces for DeFi skill plugins that can be registered
 * with the SkillRegistry and discovered by the DiscoveryEngine.
 * Each skill represents a specific DeFi capability (swap, lend, bridge, etc.)
 * that Firma agents can autonomously execute.
 */

// ====== Enums & Literals ======

/** Risk classification for opportunities and skills */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Categories of DeFi skills */
export type SkillCategory =
  | "swap"
  | "aggregator"
  | "lend"
  | "borrow"
  | "yield-farm"
  | "stake"
  | "bridge"
  | "arbitrage"
  | "payments";

/** Status of a skill plugin */
export type SkillStatus = "active" | "inactive" | "error" | "initializing" | "degraded" | "offline";

/** Status of an active position */
export type PositionStatus = "open" | "closing" | "closed" | "liquidated";

// ====== Metadata & Health ======

/** Metadata describing a skill plugin's capabilities */
export interface SkillMetadata {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the skill does */
  description: string;
  /** Version string (semver) */
  version: string;
  /** Protocol identifier (e.g., "uniswap-v3", "aave", "okx-bridge") */
  protocol?: string;
  /** DeFi categories this skill covers */
  categories: SkillCategory[];
  /** Alias for categories, used by SkillRegistry for capability lookups */
  capabilities?: SkillCategory[];
  /** Supported chain IDs */
  supportedChains: number[];
  /** Default risk level for this skill's operations */
  riskLevel: RiskLevel;
  /** Whether the skill is ready for production use */
  isActive: boolean;
  /** Required contract addresses or API endpoints */
  requiredConfig: string[];
}

/** Health status returned by skill health checks */
export interface SkillHealth {
  /** Whether the skill is operational */
  healthy: boolean;
  /** Current status */
  status: SkillStatus;
  /** Human-readable status message */
  message: string;
  /** Timestamp of the health check */
  timestamp: number;
  /** Optional details about the health state */
  details?: Record<string, unknown>;
}

// ====== Opportunities ======

/** An opportunity discovered by a skill plugin */
export interface Opportunity {
  /** Unique identifier for this opportunity */
  id: string;
  /** Which skill discovered it */
  skillId: string;
  /** Type of opportunity */
  category: SkillCategory;
  /** Human-readable description */
  description: string;
  /** Estimated return as a percentage (e.g., 0.05 = 5%) */
  estimatedReturn: number;
  /** Risk assessment */
  riskLevel: RiskLevel;
  /** Required input amount in USDT */
  requiredAmount: number;
  /** Token addresses involved */
  tokens: string[];
  /** When this opportunity was discovered */
  discoveredAt: number;
  /** When this opportunity expires (0 = no expiry) */
  expiresAt: number;
  /** Protocol-specific data needed for execution */
  executionData: Record<string, unknown>;
  /** Confidence score 0-1 */
  confidence: number;
}

// ====== Execution ======

/** Result of executing an opportunity or exiting a position */
export interface ExecutionResult {
  /** Whether the execution succeeded */
  success: boolean;
  /** Transaction hash (if on-chain) */
  txHash?: string;
  /** Actual amount received/output */
  amountOut?: string;
  /** Gas cost in native token */
  gasCost?: string;
  /** Error message if failed */
  error?: string;
  /** Additional execution details */
  details?: Record<string, unknown>;
  /** Timestamp of execution */
  executedAt: number;
}

// ====== Positions ======

/** An active position managed by a skill */
export interface ActivePosition {
  /** Unique position identifier */
  id: string;
  /** Which skill manages this position */
  skillId: string;
  /** Category of the position */
  category: SkillCategory;
  /** Position status */
  status: PositionStatus;
  /** Token addresses involved */
  tokens: string[];
  /** Amount invested (in USDT equivalent) */
  investedAmount: number;
  /** Current value (in USDT equivalent) */
  currentValue: number;
  /** Unrealized PnL */
  unrealizedPnl: number;
  /** When the position was opened */
  openedAt: number;
  /** Protocol-specific position data */
  positionData: Record<string, unknown>;
}

// ====== Skill Plugin Interface ======

/**
 * Core interface that all DeFi skill plugins must implement.
 *
 * Skills are autonomous DeFi capabilities that can:
 * 1. Discover opportunities in the market
 * 2. Evaluate those opportunities for risk/reward
 * 3. Execute profitable operations
 * 4. Manage active positions
 */
export interface ISkillPlugin {
  /** Skill metadata and capabilities */
  readonly metadata: SkillMetadata;

  /** Initialize the skill (connect to contracts, validate config, etc.) */
  initialize(): Promise<void>;

  /** Gracefully shut down the skill */
  shutdown(): Promise<void>;

  /** Check if the skill is healthy and operational */
  healthCheck(): Promise<SkillHealth>;

  /** Scan for new opportunities */
  discover(): Promise<Opportunity[]>;

  /** Evaluate a specific opportunity for execution worthiness */
  evaluate(opportunity: Opportunity): Promise<{
    score: number;
    recommendation: "execute" | "skip" | "monitor";
    reasoning: string;
    adjustedReturn?: number;
    adjustedRisk?: RiskLevel;
  }>;

  /** Execute an opportunity */
  execute(opportunity: Opportunity): Promise<ExecutionResult>;

  /** Get all active positions managed by this skill */
  getActivePositions(): Promise<ActivePosition[]>;

  /** Exit/close a specific position */
  exitPosition(positionId: string): Promise<ExecutionResult>;
}

// ====== Discovery Config ======

/** Configuration for the DiscoveryEngine's opportunity scanning behavior */
export interface DiscoveryConfig {
  /** How frequently to scan for new opportunities (in milliseconds) */
  scanIntervalMs: number;
  /** Minimum confidence score to consider an opportunity (0-1) */
  minConfidence: number;
  /** Maximum capital to deploy per single opportunity (in USDT) */
  maxCapitalPerOpportunity: string;
  /** Maximum total capital deployed across all active positions (in USDT) */
  maxTotalCapitalDeployed: string;
  /** Maximum acceptable risk level */
  maxRiskLevel: RiskLevel;
  /** Whether to automatically execute opportunities that pass evaluation */
  autoExecute: boolean;
  /** Which skill categories to scan */
  enabledCategories: SkillCategory[];
}

// ====== Registry Entry ======

/** A registered skill entry in the SkillRegistry with tracking metadata */
export interface SkillRegistryEntry {
  /** The skill plugin instance */
  skill: ISkillPlugin;
  /** Skill metadata snapshot at registration time */
  metadata: SkillMetadata;
  /** Latest health check result */
  health: SkillHealth;
  /** ISO timestamp of when the skill was registered */
  registeredAt: string;
  /** Whether the skill is currently enabled */
  enabled: boolean;
  /** Total number of opportunities discovered */
  totalOpportunities: number;
  /** Total number of executions attempted */
  totalExecutions: number;
  /** Running success rate (0-1) */
  successRate: number;
  /** Total revenue generated in USDT */
  totalRevenue: string;
}
