// Proxy bootstrap (must be first — configures global fetch dispatcher)
export { initProxy } from "./proxy.js";

// Config
export * from "./config.js";

// Types
export * from "./types.js";

// Logger
export { createLogger } from "./logger.js";

// Wallet
export {
  getProvider,
  getSigner,
  getAgentSigner,
  getUsdtContract,
  getOkbBalance,
  getUsdtBalance,
  approveUsdt,
  transferUsdt,
  printWalletStatus,
} from "./wallet.js";

// OnchaiosSigner (TEE-based signing via onchainos CLI)
export { OnchaiosSigner, createOnchaiosSigner } from "./onchainos-signer.js";

// FirmaCompany
export {
  getFirmaCompanyContract,
  registerAgent,
  hireAgent,
  fireAgent,
  rehireAgent,
  updateBudget,
  logDecision,
  pauseTreasury,
  anchorOpsReport,
  getAgent,
  getAgentCount,
  isAgentActive,
  isTreasuryActive,
  FIRMA_COMPANY_ABI,
} from "./firma-company.js";

// Civilis
export {
  getIdentityRegistry,
  registerIdentity,
  getReputationRegistry,
  giveFeedback,
  getReputation,
  getACPV2,
  createJob,
  setProvider,
  claimRefund,
  submitJob,
  completeJob,
  rejectJob,
  getJob,
} from "./civilis.js";

// Onchain OS
export {
  getPoolData,
  getRecentSwaps,
  executeSwap,
  payViaX402,
  getWalletBalances,
  type PoolData,
  type SwapEvent,
} from "./onchainos.js";

// Resilience (graceful degradation)
export {
  getCompanyHealth,
  shouldExecute,
  logDegradation,
  formatHealthReport,
  type CompanyHealth,
  type AgentOperationalStatus,
} from "./resilience.js";

// Skills Plugin System
export * from "./skills/index.js";

// Agent Marketplace
export * from "./marketplace/index.js";

// LLM Brain (AI decision engine)
export {
  treasuryDecision,
  researchSignal,
  opsReport,
  type LLMDecision,
  type AgentPerformance,
  type TradeSignal,
} from "./llm-brain.js";

// Uniswap AI Skills (Trading API, route optimization, swap planning)
export {
  getUniswapQuote,
  compareRoutes,
  planSwapWithAI,
  getPoolAnalysis,
  type UniswapQuote,
  type RouteComparison,
  type SwapPlan,
  type PoolAnalysis,
} from "./uniswap-ai.js";

// Onchain OS Skills (centralized wrappers for all onchainos CLI calls)
export {
  swapViaOnchainos,
  broadcastTransaction,
  getTransactionStatus,
  estimateGas,
  findYieldOpportunities,
  depositToProtocol,
  getDefiPositions,
  fetchAggregatedBuySignals,
  getTokenHolderDistribution,
  getTokenKline,
  getWalletPortfolio,
  signX402Payment,
  getDefiPortfolioPositions,
  scanDappSecurity,
  getGasPrice,
} from "./onchainos-skills.js";
