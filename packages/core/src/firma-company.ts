import { ethers } from "ethers";
import { FIRMA_CONTRACTS } from "./config.js";
import { createLogger } from "./logger.js";
import type { AgentOnChain } from "./types.js";

const log = createLogger("FirmaCompany");

const FIRMA_COMPANY_ABI = [
  // Agent Registration
  "function registerAgent(uint256 _agentId, uint8 _role, string _roleName, address _wallet) external",
  // Governance
  "function hireAgent(uint256 _agentId, string _reason) external",
  "function fireAgent(uint256 _agentId, string _reason) external",
  "function rehireAgent(uint256 _agentId, string _reason) external",
  "function updateBudget(uint256 _agentId, uint256 _newBudget, string _reason) external",
  "function logDecision(uint256 _agentId, string _decisionType, string _detail) external",
  // Treasury Control
  "function pauseTreasury(string _reason) external",
  "function resumeTreasury(string _reason) external",
  // Ops
  "function anchorOpsReport(bytes32 _contentHash) external",
  // View
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function getAgentCount() view returns (uint256)",
  "function isAgentActive(uint256 _agentId) view returns (bool)",
  "function treasuryActive() view returns (bool)",
  "function reportCount() view returns (uint256)",
  // Events
  "event AgentRegistered(uint256 indexed agentId, string role, address wallet)",
  "event AgentHired(uint256 indexed agentId, string reason)",
  "event AgentFired(uint256 indexed agentId, string reason)",
  "event AgentRehired(uint256 indexed agentId, string reason)",
  "event BudgetUpdated(uint256 indexed agentId, uint256 newBudget, string reason)",
  "event TreasuryPaused(string reason)",
  "event TreasuryResumed(string reason)",
  "event DecisionLogged(uint256 indexed agentId, string decisionType, string detail)",
  "event OpsReportAnchored(uint256 indexed reportId, bytes32 contentHash, uint256 timestamp)",
];

export function getFirmaCompanyContract(
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  if (!FIRMA_CONTRACTS.firmaCompany) {
    throw new Error("FIRMA_COMPANY_ADDRESS not set in environment");
  }
  return new ethers.Contract(
    FIRMA_CONTRACTS.firmaCompany,
    FIRMA_COMPANY_ABI,
    signerOrProvider,
  );
}

// ====== Admin Functions ======

export async function registerAgent(
  adminSigner: ethers.Signer,
  agentId: number,
  role: number,
  roleName: string,
  wallet: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(adminSigner);
  const tx = await contract.registerAgent(agentId, role, roleName, wallet);
  const receipt = await tx.wait();
  log.tx(`RegisterAgent #${agentId} (${roleName})`, receipt.hash);
  return receipt.hash;
}

// ====== Governance Functions (Treasury) ======

export async function hireAgent(
  treasurySigner: ethers.Signer,
  agentId: number,
  reason: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.hireAgent(agentId, reason);
  const receipt = await tx.wait();
  log.tx(`HireAgent #${agentId}`, receipt.hash);
  return receipt.hash;
}

export async function fireAgent(
  treasurySigner: ethers.Signer,
  agentId: number,
  reason: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.fireAgent(agentId, reason);
  const receipt = await tx.wait();
  log.tx(`FireAgent #${agentId}`, receipt.hash);
  return receipt.hash;
}

export async function rehireAgent(
  treasurySigner: ethers.Signer,
  agentId: number,
  reason: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.rehireAgent(agentId, reason);
  const receipt = await tx.wait();
  log.tx(`RehireAgent #${agentId}`, receipt.hash);
  return receipt.hash;
}

export async function updateBudget(
  treasurySigner: ethers.Signer,
  agentId: number,
  newBudget: bigint,
  reason: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.updateBudget(agentId, newBudget, reason);
  const receipt = await tx.wait();
  log.tx(`UpdateBudget #${agentId}`, receipt.hash);
  return receipt.hash;
}

export async function logDecision(
  treasurySigner: ethers.Signer,
  agentId: number,
  decisionType: string,
  detail: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.logDecision(agentId, decisionType, detail);
  const receipt = await tx.wait();
  log.tx(`LogDecision #${agentId} (${decisionType})`, receipt.hash);
  return receipt.hash;
}

export async function pauseTreasury(
  treasurySigner: ethers.Signer,
  reason: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.pauseTreasury(reason);
  const receipt = await tx.wait();
  log.tx("PauseTreasury", receipt.hash);
  return receipt.hash;
}

export async function anchorOpsReport(
  treasurySigner: ethers.Signer,
  contentHash: string,
): Promise<string> {
  const contract = getFirmaCompanyContract(treasurySigner);
  const tx = await contract.anchorOpsReport(contentHash);
  const receipt = await tx.wait();
  log.tx("AnchorOpsReport", receipt.hash);
  return receipt.hash;
}

// ====== View Functions ======

export async function getAgent(
  provider: ethers.Provider,
  agentId: number,
): Promise<AgentOnChain> {
  const contract = getFirmaCompanyContract(provider);
  const agent = await contract.getAgent(agentId);
  return {
    agentId: agent.agentId,
    role: agent.role,
    roleName: agent.roleName,
    wallet: agent.wallet,
    registered: agent.registered,
    active: agent.active,
    budget: agent.budget,
    registeredAt: agent.registeredAt,
    hiredAt: agent.hiredAt,
  };
}

export async function getAgentCount(
  provider: ethers.Provider,
): Promise<number> {
  const contract = getFirmaCompanyContract(provider);
  return Number(await contract.getAgentCount());
}

export async function isAgentActive(
  provider: ethers.Provider,
  agentId: number,
): Promise<boolean> {
  const contract = getFirmaCompanyContract(provider);
  return contract.isAgentActive(agentId);
}

export async function isTreasuryActive(
  provider: ethers.Provider,
): Promise<boolean> {
  const contract = getFirmaCompanyContract(provider);
  return contract.treasuryActive();
}

export { FIRMA_COMPANY_ABI };
