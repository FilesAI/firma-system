import { ethers } from "ethers";
import { createLogger, AGENT_WALLETS } from "@firma/core";
import type { Signal } from "@firma/core";

const log = createLogger("JobProvider");

export class JobProvider {
  async submitDeliverable(jobId: number, signal: Signal): Promise<string> {
    const payload = JSON.stringify(signal);
    const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes(payload));

    log.info(`Deliverable ready for job #${jobId}`, {
      direction: signal.direction,
      confidence: signal.confidence,
      hash: deliverableHash,
    });

    // Deliverable hash is recorded locally and can be verified against
    // the signal data. The ACPV2 contract uses createJob → setProvider →
    // claimRefund lifecycle; deliverable verification happens off-chain
    // in the Treasury agent's evaluation loop.

    return deliverableHash;
  }
}
