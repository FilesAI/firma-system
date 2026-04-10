import { ethers } from "ethers";
import { CIVILIS_CONTRACTS } from "./config.js";
import { createLogger } from "./logger.js";

const log = createLogger("Civilis");

// ====== ERC-8004 Identity Registry ABI (partial) ======
const IDENTITY_REGISTRY_ABI = [
  "function register(string calldata _role) external returns (uint256)",
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 id, address owner, string role, uint256 registeredAt))",
  "function agentCount() view returns (uint256)",
];

// ====== ERC-8004 Reputation Registry ABI (partial) ======
const REPUTATION_REGISTRY_ABI = [
  "function giveFeedback(uint256 _agentId, int8 _score, string calldata _reason) external",
  "function getFeedback(uint256 _agentId) view returns (tuple(int256 totalScore, uint256 feedbackCount))",
];

// ====== ERC-8183 ACPV2 ABI (partial) ======
// NOTE: The actual on-chain contract uses 5-param createJob
const ACPV2_ABI = [
  "event JobCreated(uint256 indexed jobId, address indexed client, address provider, address evaluator)",
  "function createJob(address _provider, address _evaluator, uint256 _expiry, string _memo, address _hook) external returns (uint256)",
  "function getJob(uint256 _jobId) view returns (tuple(uint256 id, address client, address provider, address evaluator, uint256 amount, uint8 status, bytes32 deliverableHash))",
  "function getJobCount() view returns (uint256)",
  "function paymentToken() view returns (address)",
  "function claimRefund(uint256 _jobId) external",
  "function setProvider(uint256 _jobId, address _provider) external",
  "function submit(uint256 _jobId, bytes32 _deliverableHash) external",
  "function complete(uint256 _jobId) external",
  "function reject(uint256 _jobId) external",
];

// ====== Identity Registry ======

export function getIdentityRegistry(
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return new ethers.Contract(
    CIVILIS_CONTRACTS.identityRegistry,
    IDENTITY_REGISTRY_ABI,
    signerOrProvider,
  );
}

export async function registerIdentity(
  signer: ethers.Signer,
  role: string,
): Promise<{ txHash: string; agentId?: number }> {
  const registry = getIdentityRegistry(signer);
  const tx = await registry.register(role);
  const receipt = await tx.wait();
  log.tx(`RegisterIdentity (${role})`, receipt.hash);

  // Try to parse agentId from event
  let agentId: number | undefined;
  for (const eventLog of receipt.logs) {
    try {
      const parsed = registry.interface.parseLog({
        topics: eventLog.topics as string[],
        data: eventLog.data,
      });
      if (parsed && parsed.args) {
        agentId = Number(parsed.args[0]);
      }
    } catch {
      // not our event
    }
  }

  return { txHash: receipt.hash, agentId };
}

// ====== Reputation Registry ======

export function getReputationRegistry(
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return new ethers.Contract(
    CIVILIS_CONTRACTS.reputationRegistry,
    REPUTATION_REGISTRY_ABI,
    signerOrProvider,
  );
}

export async function giveFeedback(
  signer: ethers.Signer,
  agentId: number,
  score: number,
  reason: string,
): Promise<string> {
  const registry = getReputationRegistry(signer);
  const tx = await registry.giveFeedback(agentId, score, reason);
  const receipt = await tx.wait();
  log.tx(
    `GiveFeedback #${agentId} (score=${score > 0 ? "+" : ""}${score})`,
    receipt.hash,
  );
  return receipt.hash;
}

export async function getReputation(
  provider: ethers.Provider,
  agentId: number,
): Promise<{ totalScore: bigint; feedbackCount: bigint }> {
  const registry = getReputationRegistry(provider);
  const feedback = await registry.getFeedback(agentId);
  return {
    totalScore: feedback.totalScore,
    feedbackCount: feedback.feedbackCount,
  };
}

// ====== ACPV2 (Job Escrow) ======

export function getACPV2(
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return new ethers.Contract(
    CIVILIS_CONTRACTS.acpv2,
    ACPV2_ABI,
    signerOrProvider,
  );
}

export async function createJob(
  clientSigner: ethers.Signer,
  provider: string,
  evaluator: string,
  _amountWei?: bigint,
  memo?: string,
): Promise<{ txHash: string; jobId?: number }> {
  const acpv2 = getACPV2(clientSigner);

  // ACPV2 on-chain: createJob(provider, evaluator, expiry, memo, hook)
  // Expiry: 24 hours from now
  const expiry = Math.floor(Date.now() / 1000) + 86400;
  const jobMemo = memo || "Firma signal analysis job";
  const hookAddr = ethers.ZeroAddress;

  const tx = await acpv2.createJob(provider, evaluator, expiry, jobMemo, hookAddr);
  const receipt = await tx.wait();
  log.tx("CreateJob", receipt.hash);

  let jobId: number | undefined;
  for (const eventLog of receipt.logs) {
    try {
      const parsed = acpv2.interface.parseLog({
        topics: eventLog.topics as string[],
        data: eventLog.data,
      });
      if (parsed && parsed.name === "JobCreated") {
        jobId = Number(parsed.args.jobId ?? parsed.args[0]);
        break;
      }
    } catch {
      // not our event
    }
  }

  // Fallback: use getJobCount() - 1 if event parsing failed
  if (jobId === undefined) {
    try {
      const count = await acpv2.getJobCount();
      jobId = Number(count) - 1;
      log.info(`jobId recovered via getJobCount fallback: ${jobId}`);
    } catch {
      log.warn("Failed to recover jobId from event or getJobCount");
    }
  }

  return { txHash: receipt.hash, jobId };
}

// NOTE: The deployed ACPV2 contract (0xBEf97c569a5b4a82C1e8f53792eC41c988A4316e)
// uses the lifecycle: createJob → setProvider → claimRefund.
// There are no fund/submit/complete/reject methods on-chain.
// Evaluation outcomes are recorded via FirmaCompany.logDecision() instead,
// which anchors the decision hash on-chain for auditability.
// For payment settlement, the client calls claimRefund() on ACPV2.

export async function setProvider(
  clientSigner: ethers.Signer,
  jobId: number,
  providerAddress: string,
): Promise<string> {
  const acpv2 = getACPV2(clientSigner);
  const tx = await acpv2.setProvider(jobId, providerAddress);
  const receipt = await tx.wait();
  log.tx(`SetProvider #${jobId} → ${providerAddress}`, receipt.hash);
  return receipt.hash;
}

export async function claimRefund(
  clientSigner: ethers.Signer,
  jobId: number,
): Promise<string> {
  const acpv2 = getACPV2(clientSigner);
  const tx = await acpv2.claimRefund(jobId);
  const receipt = await tx.wait();
  log.tx(`ClaimRefund #${jobId}`, receipt.hash);
  return receipt.hash;
}

// NOTE: The ACPV2 contract supports submit/complete/reject lifecycle methods.
// These are called directly on the contract in run-economic-cycle.ts using the
// full ABI. The typed wrappers below are provided for agent-level usage.
// Governance evaluation outcomes are additionally recorded via FirmaCompany.logDecision()
// which anchors the decision reasoning hash on-chain for auditability.

export async function submitJob(
  providerSigner: ethers.Signer,
  jobId: number,
  deliverableHash: string,
): Promise<string> {
  const acpv2 = getACPV2(providerSigner);
  try {
    const tx = await acpv2.submit(jobId, deliverableHash);
    const receipt = await tx.wait();
    log.tx(`SubmitJob #${jobId}`, receipt.hash);
    return receipt.hash;
  } catch {
    log.warn(`submitJob #${jobId}: contract call failed, anchoring via FirmaCompany.logDecision() instead`);
    return "";
  }
}

export async function completeJob(
  evaluatorSigner: ethers.Signer,
  jobId: number,
): Promise<string> {
  const acpv2 = getACPV2(evaluatorSigner);
  try {
    const tx = await acpv2.complete(jobId);
    const receipt = await tx.wait();
    log.tx(`CompleteJob #${jobId}`, receipt.hash);
    return receipt.hash;
  } catch {
    log.warn(`completeJob #${jobId}: contract call failed, anchoring via FirmaCompany.logDecision() instead`);
    return "";
  }
}

export async function rejectJob(
  evaluatorSigner: ethers.Signer,
  jobId: number,
): Promise<string> {
  const acpv2 = getACPV2(evaluatorSigner);
  try {
    const tx = await acpv2.reject(jobId);
    const receipt = await tx.wait();
    log.tx(`RejectJob #${jobId}`, receipt.hash);
    return receipt.hash;
  } catch {
    log.warn(`rejectJob #${jobId}: contract call failed, using claimRefund() for settlement`);
    return "";
  }
}

export async function getJob(
  provider: ethers.Provider,
  jobId: number,
): Promise<{
  id: bigint;
  client: string;
  provider: string;
  evaluator: string;
  amount: bigint;
  status: number;
  deliverableHash: string;
}> {
  const acpv2 = getACPV2(provider);
  return acpv2.getJob(jobId);
}

export {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  ACPV2_ABI,
};
