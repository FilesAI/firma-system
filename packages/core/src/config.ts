import dotenv from "dotenv";
import { resolve } from "path";

// Try loading .env from cwd, then from monorepo root (2 levels up from packages/*/dist/)
dotenv.config();
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

// ====== X Layer Mainnet ======
export const XLAYER_CHAIN_ID = 196;
export const XLAYER_RPC = process.env.XLAYER_RPC || "https://rpc.xlayer.tech";
export const XLAYER_EXPLORER = "https://www.okx.com/web3/explorer/xlayer";

// ====== Civilis Infrastructure (permissionless) ======
export const CIVILIS_CONTRACTS = {
  identityRegistry: "0xC9C992C0e2B8E1982DddB8750c15399D01CF907a",
  reputationRegistry: "0xD8499b9A516743153EE65382f3E2C389EE693880",
  validationRegistry: "0x0CC71B9488AA74A8162790b65592792Ba52119fB",
  acpv2: "0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e",
} as const;

// ====== Firma Governance ======
export const FIRMA_CONTRACTS = {
  firmaCompany: process.env.FIRMA_COMPANY_ADDRESS || "",
} as const;

// ====== USDT on X Layer ======
export const USDT_ADDRESS =
  process.env.USDT_ADDRESS || "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";

// ====== Agent Wallets (TEE-based via OKX Agentic Wallet) ======
// Private keys are managed by TEE — never exposed.
// All signing goes through onchainos CLI → OKX TEE.
export const AGENT_WALLETS = {
  main: {
    address: process.env.MAIN_WALLET_ADDRESS || "",
    accountId: process.env.MAIN_WALLET_ACCOUNT_ID || "",
  },
  research: {
    address: process.env.RESEARCH_WALLET_ADDRESS || "",
    accountId: process.env.RESEARCH_WALLET_ACCOUNT_ID || "",
    agentId: 1,
  },
  executor: {
    address: process.env.EXECUTOR_WALLET_ADDRESS || "",
    accountId: process.env.EXECUTOR_WALLET_ACCOUNT_ID || "",
    agentId: 2,
  },
  treasury: {
    address: process.env.TREASURY_WALLET_ADDRESS || "",
    accountId: process.env.TREASURY_WALLET_ACCOUNT_ID || "",
    agentId: 3,
  },
  ops: {
    address: process.env.OPS_WALLET_ADDRESS || "",
    accountId: process.env.OPS_WALLET_ACCOUNT_ID || "",
    agentId: 4,
  },
} as const;

// ====== Onchain OS API ======
export const ONCHAINOS_API = {
  baseUrl: process.env.ONCHAINOS_API_URL || "https://www.okx.com/api/v5",
  apiKey: process.env.OKX_API_KEY || "",
  secretKey: process.env.OKX_SECRET_KEY || "",
  passphrase: process.env.OKX_PASSPHRASE || "",
} as const;

// ====== x402 Payment Protocol (OKX Standard) ======
export const X402_CONFIG = {
  // X Layer network identifier (CAIP-2)
  network: "eip155:196" as const,
  // USDT on X Layer (x402-supported token)
  paymentToken: process.env.X402_PAYMENT_TOKEN || "0x779ded0c9e1022225f8e0630b35a9b54be713736",
  // Signal price in USDT
  signalPrice: process.env.X402_SIGNAL_PRICE || "$0.01",
  // Payment scheme: "exact" (single payment) or "aggr_deferred" (batch)
  scheme: (process.env.X402_SCHEME || "exact") as "exact" | "aggr_deferred",
  // Synchronous settlement (wait for on-chain confirmation)
  syncSettle: process.env.X402_SYNC_SETTLE === "true",
  // Research agent receives payment at this address
  payToAddress: process.env.RESEARCH_WALLET_ADDRESS || "",
  // x402 server port
  port: parseInt(process.env.X402_PORT || "3001", 10),
} as const;

// ====== Operational Config ======
export const OPERATION_CONFIG = {
  // Monitor & job cycle — use env to switch between fast (30s) and normal (60s)
  monitorIntervalMs: Number(process.env.MONITOR_INTERVAL_MS) || 60_000,
  // Evaluation cycle — use env to switch between fast (30min) and normal (1h)
  evaluationIntervalMs: Number(process.env.EVALUATION_INTERVAL_MS) || 3_600_000,
  maxBudgetUsdt: 10,
  jobAmountUsdt: "0.01",
  signalConfidenceThreshold: 0.5,
  fireThreshold: 0.5,
  fireConsecutiveCycles: 3,
  rehireThreshold: 0.6,
} as const;
