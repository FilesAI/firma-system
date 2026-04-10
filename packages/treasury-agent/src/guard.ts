import { ethers } from "ethers";
import {
  getWalletBalances,
  pauseTreasury,
  createLogger,
} from "@firma/core";

const log = createLogger("RiskGuard");

const MIN_USDT_BALANCE = 1.0; // 1 USDT minimum threshold

export interface RiskStatus {
  usdtBalance: number;
  okbBalance: number;
  belowThreshold: boolean;
  paused: boolean;
  checkedAt: string;
}

export class RiskGuard {
  private signer: ethers.Signer;
  private treasuryAddress: string;
  private paused = false;

  constructor(signer: ethers.Signer, treasuryAddress: string) {
    this.signer = signer;
    this.treasuryAddress = treasuryAddress;
  }

  /**
   * Check the treasury wallet balance and pause if below threshold.
   */
  async checkBalance(): Promise<RiskStatus> {
    const balances = await getWalletBalances(this.treasuryAddress);

    const usdtBalance = parseFloat(balances.usdt);
    const okbBalance = parseFloat(balances.okb);
    const belowThreshold = usdtBalance < MIN_USDT_BALANCE;

    log.info(
      `Treasury balance: ${usdtBalance.toFixed(4)} USDT, ${okbBalance.toFixed(4)} OKB` +
        (belowThreshold ? " [BELOW THRESHOLD]" : ""),
    );

    if (belowThreshold && !this.paused) {
      log.warn(
        `USDT balance ${usdtBalance.toFixed(4)} below minimum ${MIN_USDT_BALANCE} — pausing treasury`,
      );
      try {
        await pauseTreasury(
          this.signer,
          `Auto-pause: USDT balance ${usdtBalance.toFixed(4)} below minimum ${MIN_USDT_BALANCE}`,
        );
        this.paused = true;
      } catch (error) {
        log.error("Failed to pause treasury", error);
      }
    }

    return {
      usdtBalance,
      okbBalance,
      belowThreshold,
      paused: this.paused,
      checkedAt: new Date().toISOString(),
    };
  }

  shouldPause(): boolean {
    return this.paused;
  }
}
