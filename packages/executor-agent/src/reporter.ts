import type { Signal } from "@firma/core";
import { createLogger } from "@firma/core";

const log = createLogger("TradeReporter");

export interface TradeRecord {
  signal: Signal;
  txHash: string;
  entryPrice: number;
  exitPrice?: number;
  profitable?: boolean;
  recordedAt: string;
}

export class TradeReporter {
  private trades: TradeRecord[] = [];

  recordTrade(signal: Signal, txHash: string, entryPrice: number): void {
    const record: TradeRecord = {
      signal,
      txHash,
      entryPrice,
      recordedAt: new Date().toISOString(),
    };
    this.trades.push(record);
    log.info(`Trade recorded: ${signal.direction} at ${entryPrice}, tx=${txHash}`);
  }

  updateTradeOutcome(index: number, exitPrice: number): void {
    const trade = this.trades[index];
    if (!trade) return;

    trade.exitPrice = exitPrice;
    // LONG is profitable if price went up, SHORT if price went down
    trade.profitable =
      trade.signal.direction === "LONG"
        ? exitPrice > trade.entryPrice
        : exitPrice < trade.entryPrice;

    log.info(
      `Trade #${index} outcome: entry=${trade.entryPrice}, exit=${exitPrice}, profitable=${trade.profitable}`,
    );
  }

  getAccuracy(): number {
    const evaluated = this.trades.filter((t) => t.profitable !== undefined);
    if (evaluated.length === 0) return 0;

    const profitable = evaluated.filter((t) => t.profitable === true).length;
    return profitable / evaluated.length;
  }

  getTradeHistory(): TradeRecord[] {
    return [...this.trades];
  }

  getRecentTrades(n: number): TradeRecord[] {
    return this.trades.slice(-n);
  }
}
