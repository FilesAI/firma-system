// ====== Agent Types ======
export enum AgentRole {
  Research = 0,
  Executor = 1,
  Treasury = 2,
  Ops = 3,
}

export interface AgentConfig {
  agentId: number;
  role: AgentRole;
  roleName: string;
  walletAddress: string;
  privateKey: string;
}

export interface AgentOnChain {
  agentId: bigint;
  role: number;
  roleName: string;
  wallet: string;
  registered: boolean;
  active: boolean;
  budget: bigint;
  registeredAt: bigint;
  hiredAt: bigint;
}

// ====== Signal Types ======
export interface Signal {
  pool: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  reason: string;
  timestamp: string;
  /** ERC-20 token0 address from the pool (for swap routing) */
  token0?: string;
  /** ERC-20 token1 address from the pool (for swap routing) */
  token1?: string;
}

export interface SignalWithMeta extends Signal {
  agentId: number;
  poweredBy: string;
  verifyAt?: string;
}

// ====== Job Types (ERC-8183 ACPV2) ======
export enum JobStatus {
  Open = 0,
  Funded = 1,
  Submitted = 2,
  Completed = 3,
  Rejected = 4,
}

export interface Job {
  jobId: bigint;
  client: string;
  provider: string;
  evaluator: string;
  amount: bigint;
  status: JobStatus;
  deliverableHash: string;
}

// ====== Treasury Types ======
export type GovernanceDecision = "RENEW" | "FIRE" | "REHIRE";

export interface EvaluationResult {
  agentId: number;
  accuracy: number;
  decision: GovernanceDecision;
  reason: string;
  timestamp: string;
}

// ====== Ops Report ======
export interface OpsReport {
  reportId: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  jobsCompleted: number;
  jobsRejected: number;
  signalAccuracy: number;
  hrDecisions: string[];
  generatedAt: string;
  contentHash: string;
}

// ====== Dashboard Types ======
export interface HeartbeatStatus {
  agentId: number;
  roleName: string;
  lastSeen: number;
  status: "active" | "idle" | "offline";
}

export interface CompanyPnL {
  revenue: number;
  expenses: number;
  netProfit: number;
  runwayDays: number;
  jobsCompleted: number;
  jobsRejected: number;
  signalAccuracy: number;
}
