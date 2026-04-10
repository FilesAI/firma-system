import { ethers } from "ethers";
import {
  giveFeedback,
  getReputation,
  getProvider,
  createLogger,
} from "@firma/core";

const log = createLogger("Reputation");

export class ReputationManager {
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
  }

  /**
   * Record on-chain ERC-8004 reputation feedback after a job evaluation.
   * +1 for accurate signal, -1 for inaccurate.
   */
  async recordFeedback(
    agentId: number,
    isAccurate: boolean,
    reason: string,
  ): Promise<string> {
    const score = isAccurate ? 1 : -1;

    log.info(
      `Recording feedback for agent #${agentId}: score=${score > 0 ? "+1" : "-1"}, reason="${reason}"`,
    );

    try {
      const txHash = await giveFeedback(this.signer, agentId, score, reason);
      log.info(`Feedback recorded for agent #${agentId}`, { txHash });
      return txHash;
    } catch (error) {
      log.error(`Failed to record feedback for agent #${agentId}`, error);
      throw error;
    }
  }

  /**
   * Read an agent's cumulative reputation from the on-chain registry.
   */
  async getAgentReputation(
    agentId: number,
  ): Promise<{ totalScore: bigint; feedbackCount: bigint }> {
    const provider = getProvider();
    const reputation = await getReputation(provider, agentId);

    log.info(
      `Agent #${agentId} reputation: score=${reputation.totalScore}, count=${reputation.feedbackCount}`,
    );

    return reputation;
  }
}
