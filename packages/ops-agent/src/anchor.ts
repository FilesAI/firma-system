import { ethers } from "ethers";
import {
  AGENT_WALLETS,
  getAgentSigner,
  getProvider,
  getFirmaCompanyContract,
  anchorOpsReport,
  createLogger,
} from "@firma/core";

const log = createLogger("Ops:Anchor");

export class ReportAnchor {
  private signer: ethers.Signer;

  constructor() {
    // Ops agent uses Treasury's signer for anchoring (Treasury has GOVERNANCE_ROLE)
    this.signer = getAgentSigner(AGENT_WALLETS.treasury.accountId, AGENT_WALLETS.treasury.address);
  }

  async anchor(contentHash: string): Promise<string> {
    log.info(`Anchoring report hash: ${contentHash}`);
    const txHash = await anchorOpsReport(this.signer, contentHash);
    log.info(`Report anchored on-chain`, { txHash });
    return txHash;
  }

  async getReportCount(): Promise<number> {
    const provider = getProvider();
    const contract = getFirmaCompanyContract(provider);
    return Number(await contract.reportCount());
  }
}
