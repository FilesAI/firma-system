import { ethers } from "ethers";
import {
  AGENT_WALLETS,
  OPERATION_CONFIG,
  createLogger,
  getAgentSigner,
  createJob,
} from "@firma/core";

const log = createLogger("JobClient");

export class JobClient {
  private signer: ethers.Signer;
  private provider: string;
  private evaluator: string;
  private amount: string;

  constructor(amount: string = OPERATION_CONFIG.jobAmountUsdt) {
    this.signer = getAgentSigner(AGENT_WALLETS.executor.accountId, AGENT_WALLETS.executor.address);
    this.provider = AGENT_WALLETS.research.address;
    this.evaluator = AGENT_WALLETS.treasury.address;
    this.amount = amount;
  }

  async createAndFundJob(): Promise<number> {
    log.info(`Creating job: provider=${this.provider}, evaluator=${this.evaluator}, amount=${this.amount} USDT`);

    const { jobId } = await createJob(
      this.signer,
      this.provider,
      this.evaluator,
      undefined,
      `Firma signal analysis: ${this.amount} USDT`,
    );

    if (jobId === undefined) {
      throw new Error("Failed to parse jobId from createJob transaction");
    }

    log.info(`Job #${jobId} created on ACPV2`);
    return jobId;
  }
}
