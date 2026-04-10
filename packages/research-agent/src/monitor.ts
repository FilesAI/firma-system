import { EventEmitter } from "events";
import {
  getPoolData,
  getRecentSwaps,
  createLogger,
  OPERATION_CONFIG,
} from "@firma/core";
import type { PoolData, SwapEvent } from "@firma/core";

const log = createLogger("PoolMonitor");

const LP_CHANGE_THRESHOLD = 0.05; // 5%
const LARGE_SWAP_THRESHOLD = 100; // 100 USDT

export interface PoolSnapshot {
  poolAddress: string;
  poolData: PoolData | null;
  recentSwaps: SwapEvent[];
  previousLiquidity: string | null;
  fetchedAt: number;
}

export class PoolMonitor extends EventEmitter {
  private pools: string[];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private snapshots: Map<string, PoolSnapshot> = new Map();

  constructor(poolAddresses: string[]) {
    super();
    this.pools = poolAddresses;
  }

  async start(): Promise<void> {
    log.info(`Starting pool monitor for ${this.pools.length} pool(s)`);

    // Initial fetch
    await this.poll();

    this.intervalId = setInterval(
      () => this.poll(),
      OPERATION_CONFIG.monitorIntervalMs,
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info("Pool monitor stopped");
  }

  getLatestData(): Map<string, PoolSnapshot> {
    return new Map(this.snapshots);
  }

  private async poll(): Promise<void> {
    for (const poolAddress of this.pools) {
      try {
        const poolData = await getPoolData(poolAddress);
        const recentSwaps = await getRecentSwaps(poolAddress, 20);
        const previous = this.snapshots.get(poolAddress);

        const snapshot: PoolSnapshot = {
          poolAddress,
          poolData,
          recentSwaps,
          previousLiquidity: previous?.poolData?.totalLiquidity ?? null,
          fetchedAt: Date.now(),
        };

        this.snapshots.set(poolAddress, snapshot);

        // Detect significant LP changes
        if (poolData && previous?.poolData) {
          const currentLiq = parseFloat(poolData.totalLiquidity);
          const prevLiq = parseFloat(previous.poolData.totalLiquidity);

          if (prevLiq > 0) {
            const change = Math.abs(currentLiq - prevLiq) / prevLiq;
            if (change >= LP_CHANGE_THRESHOLD) {
              const direction = currentLiq > prevLiq ? "addition" : "withdrawal";
              log.info(
                `Significant LP ${direction} detected on ${poolAddress}: ${(change * 100).toFixed(1)}%`,
              );
              this.emit("lp-change", {
                poolAddress,
                changePercent: change * 100,
                direction,
                snapshot,
              });
            }
          }
        }

        // Detect large swaps
        for (const swap of recentSwaps) {
          const amountIn = parseFloat(swap.amountIn);
          if (amountIn >= LARGE_SWAP_THRESHOLD) {
            log.info(
              `Large swap detected on ${poolAddress}: ${amountIn} ${swap.tokenIn} -> ${swap.tokenOut}`,
            );
            this.emit("large-swap", {
              poolAddress,
              swap,
              snapshot,
            });
          }
        }

        log.debug(`Polled pool ${poolAddress}`, {
          liquidity: poolData?.totalLiquidity,
          swapCount: recentSwaps.length,
        });
      } catch (error) {
        log.error(`Error polling pool ${poolAddress}`, error);
      }
    }
  }
}
