import { execSync } from "node:child_process";
import { createLogger } from "./logger.js";

const log = createLogger("OnchainOS-Skills");

const DEFAULT_CHAIN = "xlayer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ExecOptions {
  timeout?: number;
}

function runSkill(command: string, opts: ExecOptions = {}): unknown {
  const timeout = opts.timeout ?? 15_000;
  try {
    const raw = execSync(command, {
      timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(raw.trim());
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    // The CLI may exit non-zero but still produce valid JSON on stdout.
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch {
        // fall through
      }
    }
    log.error(`onchainos command failed: ${command}`, error.stderr || error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. okx-dex-swap
// ---------------------------------------------------------------------------

export interface SwapViaOnchainosParams {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  chain?: string;
}

export interface SwapResult {
  txHash: string;
  amountOut: string;
  route: string[];
}

/**
 * Execute a token swap through the OKX DEX aggregator.
 *
 * **Onchain OS skill:** `okx-dex-swap`
 *
 * @param params - Swap parameters (tokenIn, tokenOut, amount, optional chain).
 * @returns The transaction hash, output amount, and route used.
 */
export function swapViaOnchainos(params: SwapViaOnchainosParams): SwapResult {
  const chain = params.chain ?? DEFAULT_CHAIN;
  const wallet = process.env.EXECUTOR_WALLET_ADDRESS || "";
  const cmd = `npx onchainos swap execute --from ${params.tokenIn} --to ${params.tokenOut} --readable-amount ${params.amount} --chain ${chain} --wallet ${wallet}`;
  log.info(`Swap: ${params.amount} ${params.tokenIn} -> ${params.tokenOut} on ${chain}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { txHash: "", amountOut: "0", route: [] };
  }

  return {
    txHash: (result.txHash as string) ?? "",
    amountOut: (result.amountOut as string) ?? "0",
    route: (result.route as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// 2. okx-onchain-gateway
// ---------------------------------------------------------------------------

export interface BroadcastResult {
  txHash: string;
  status: string;
}

/**
 * Broadcast a signed transaction via the OKX onchain gateway.
 *
 * **Onchain OS skill:** `okx-onchain-gateway`
 *
 * @param signedTx - The RLP-encoded signed transaction hex string.
 * @param chain    - Target chain (defaults to xlayer).
 * @returns The resulting transaction hash and broadcast status.
 */
export function broadcastTransaction(signedTx: string, chain = DEFAULT_CHAIN): BroadcastResult {
  const cmd = `npx onchainos gateway broadcast --signed-tx ${signedTx} --chain ${chain}`;
  log.info(`Broadcast TX on ${chain}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { txHash: "", status: "failed" };
  }

  return {
    txHash: (result.txHash as string) ?? "",
    status: (result.status as string) ?? "unknown",
  };
}

export interface TransactionStatus {
  txHash: string;
  status: string;
  confirmations: number;
  blockNumber: number;
}

/**
 * Check the status of a previously broadcast transaction.
 *
 * **Onchain OS skill:** `okx-onchain-gateway`
 *
 * @param txHash - The transaction hash to look up.
 * @param chain  - Target chain (defaults to xlayer).
 */
export function getTransactionStatus(txHash: string, chain = DEFAULT_CHAIN): TransactionStatus {
  const cmd = `npx onchainos gateway orders --chain ${chain}`;
  log.info(`Checking TX status: ${txHash}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { txHash, status: "unknown", confirmations: 0, blockNumber: 0 };
  }

  return {
    txHash: (result.txHash as string) ?? txHash,
    status: (result.status as string) ?? "unknown",
    confirmations: (result.confirmations as number) ?? 0,
    blockNumber: (result.blockNumber as number) ?? 0,
  };
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  estimatedCost: string;
}

/**
 * Estimate gas for a transaction via the onchain gateway.
 *
 * **Onchain OS skill:** `okx-onchain-gateway`
 *
 * @param params - Transaction parameters for estimation (to, data, value).
 * @param chain  - Target chain (defaults to xlayer).
 */
export function estimateGas(
  params: { to: string; data?: string; value?: string },
  chain = DEFAULT_CHAIN,
): GasEstimate {
  let cmd = `npx onchainos gateway gas-limit --to ${params.to} --chain ${chain}`;
  if (params.data) cmd += ` --data ${params.data}`;
  if (params.value) cmd += ` --value ${params.value}`;
  log.info(`Estimating gas for call to ${params.to}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { gasLimit: "0", gasPrice: "0", estimatedCost: "0" };
  }

  return {
    gasLimit: (result.gasLimit as string) ?? "0",
    gasPrice: (result.gasPrice as string) ?? "0",
    estimatedCost: (result.estimatedCost as string) ?? "0",
  };
}

// ---------------------------------------------------------------------------
// 3. okx-defi-invest
// ---------------------------------------------------------------------------

export interface YieldOpportunity {
  protocol: string;
  pool: string;
  apy: string;
  tvl: string;
  token: string;
}

/**
 * Search for DeFi yield opportunities for a given token.
 *
 * **Onchain OS skill:** `okx-defi-invest`
 *
 * @param tokenAddress - The token contract address to find yield for.
 * @param chain        - Target chain (defaults to xlayer).
 */
export function findYieldOpportunities(
  tokenAddress: string,
  chain = DEFAULT_CHAIN,
): YieldOpportunity[] {
  const cmd = `npx onchainos defi search --token ${tokenAddress} --chain ${chain}`;
  log.info(`Finding yield opportunities for ${tokenAddress}`);

  const result = runSkill(cmd) as YieldOpportunity[] | null;

  return Array.isArray(result) ? result : [];
}

export interface DepositResult {
  txHash: string;
  protocol: string;
  amount: string;
  status: string;
}

/**
 * Deposit tokens into a DeFi protocol.
 *
 * **Onchain OS skill:** `okx-defi-invest`
 *
 * @param protocol - The protocol identifier (e.g. "aave", "compound").
 * @param amount   - The amount to deposit (human-readable).
 * @param token    - The token address to deposit.
 * @param chain    - Target chain (defaults to xlayer).
 */
export function depositToProtocol(
  protocol: string,
  amount: string,
  token: string,
  chain = DEFAULT_CHAIN,
): DepositResult {
  const cmd = `npx onchainos defi invest --investment-id ${protocol} --address ${token} --token ${token} --amount ${amount} --chain ${chain}`;
  log.info(`Depositing ${amount} into ${protocol}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { txHash: "", protocol, amount, status: "failed" };
  }

  return {
    txHash: (result.txHash as string) ?? "",
    protocol: (result.protocol as string) ?? protocol,
    amount: (result.amount as string) ?? amount,
    status: (result.status as string) ?? "unknown",
  };
}

export interface DefiPosition {
  protocol: string;
  pool: string;
  balance: string;
  value: string;
  apy: string;
}

/**
 * Retrieve all DeFi positions for an address.
 *
 * **Onchain OS skill:** `okx-defi-invest`
 *
 * @param address - The wallet address to query.
 * @param chain   - Target chain (defaults to xlayer).
 */
export function getDefiPositions(address: string, chain = DEFAULT_CHAIN): DefiPosition[] {
  const cmd = `npx onchainos defi positions --address ${address} --chains ${chain}`;
  log.info(`Fetching DeFi positions for ${address}`);

  const result = runSkill(cmd) as DefiPosition[] | null;

  return Array.isArray(result) ? result : [];
}

// ---------------------------------------------------------------------------
// 4. okx-dex-signal (centralized)
// ---------------------------------------------------------------------------

export interface AggregatedBuySignal {
  token: string;
  symbol: string;
  signalStrength: number;
  buyVolume: string;
  source: string;
}

/**
 * Fetch aggregated buy signals from centralized exchange data.
 *
 * **Onchain OS skill:** `okx-dex-signal`
 *
 * @param chain - Target chain (defaults to xlayer).
 */
export function fetchAggregatedBuySignals(chain = DEFAULT_CHAIN): AggregatedBuySignal[] {
  const cmd = `npx onchainos signal list --chain ${chain} --wallet-type 1,3`;
  log.info(`Fetching aggregated buy signals for ${chain}`);

  const result = runSkill(cmd) as AggregatedBuySignal[] | null;

  return Array.isArray(result) ? result : [];
}

// ---------------------------------------------------------------------------
// 5. okx-dex-token (centralized)
// ---------------------------------------------------------------------------

export interface TokenHolderDistribution {
  totalHolders: number;
  whalePercent: number;
  sniperPercent: number;
  bundlerPercent: number;
  retailPercent: number;
  topHolders: Array<{ address: string; percent: number }>;
}

/**
 * Get the holder distribution breakdown for a token, including whale,
 * sniper, and bundler percentages.
 *
 * **Onchain OS skill:** `okx-dex-token`
 *
 * @param tokenAddress - The token contract address.
 */
export function getTokenHolderDistribution(tokenAddress: string): TokenHolderDistribution {
  const cmd = `npx onchainos token holders --address ${tokenAddress}`;
  log.info(`Fetching holder distribution for ${tokenAddress}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return {
      totalHolders: 0,
      whalePercent: 0,
      sniperPercent: 0,
      bundlerPercent: 0,
      retailPercent: 0,
      topHolders: [],
    };
  }

  return {
    totalHolders: (result.totalHolders as number) ?? 0,
    whalePercent: (result.whalePercent as number) ?? 0,
    sniperPercent: (result.sniperPercent as number) ?? 0,
    bundlerPercent: (result.bundlerPercent as number) ?? 0,
    retailPercent: (result.retailPercent as number) ?? 0,
    topHolders: (result.topHolders as Array<{ address: string; percent: number }>) ?? [],
  };
}

// ---------------------------------------------------------------------------
// 6. okx-dex-market (centralized)
// ---------------------------------------------------------------------------

export interface KlineDataPoint {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/**
 * Fetch K-line (candlestick) data for a token.
 *
 * **Onchain OS skill:** `okx-dex-market`
 *
 * @param tokenAddress - The token contract address.
 * @param interval     - Candle interval (e.g. "1m", "5m", "1h", "1d").
 */
export function getTokenKline(tokenAddress: string, interval: string): KlineDataPoint[] {
  const cmd = `npx onchainos market kline --address ${tokenAddress}`;
  log.info(`Fetching kline data for ${tokenAddress} (${interval})`);

  const result = runSkill(cmd) as KlineDataPoint[] | null;

  return Array.isArray(result) ? result : [];
}

// ---------------------------------------------------------------------------
// 7. okx-wallet-portfolio (centralized)
// ---------------------------------------------------------------------------

export interface PortfolioBalance {
  chain: string;
  token: string;
  symbol: string;
  balance: string;
  valueUsd: string;
}

export interface WalletPortfolio {
  address: string;
  totalValueUsd: string;
  balances: PortfolioBalance[];
}

/**
 * Get the full portfolio (all token balances) for a wallet address.
 *
 * **Onchain OS skill:** `okx-wallet-portfolio`
 *
 * @param address - The wallet address to query.
 * @param chains  - Comma-separated chain list (defaults to xlayer).
 */
export function getWalletPortfolio(address: string, chains = DEFAULT_CHAIN): WalletPortfolio {
  const cmd = `npx onchainos portfolio all-balances --address ${address} --chains ${chains}`;
  log.info(`Fetching wallet portfolio for ${address}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { address, totalValueUsd: "0", balances: [] };
  }

  return {
    address: (result.address as string) ?? address,
    totalValueUsd: (result.totalValueUsd as string) ?? "0",
    balances: (result.balances as PortfolioBalance[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// 8. okx-x402-payment — Native x402 payment signing via TEE
// ---------------------------------------------------------------------------

export interface X402PaymentResult {
  signature: string;
  authorization: Record<string, string>;
  sessionCert?: string;
}

/**
 * Sign an x402 payment via TEE using the native onchainos CLI.
 *
 * **Onchain OS skill:** `okx-x402-payment`
 *
 * @param accepts - The accepts array JSON from the 402 payload.
 * @param fromAddress - Optional payer address (defaults to active wallet).
 */
export function signX402Payment(
  accepts: string,
  fromAddress?: string,
): X402PaymentResult | null {
  let cmd = `npx onchainos payment x402-pay --accepts '${accepts}'`;
  if (fromAddress) cmd += ` --from ${fromAddress}`;
  log.info("Signing x402 payment via TEE");

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return null;
  }

  return {
    signature: (result.signature as string) ?? "",
    authorization: (result.authorization as Record<string, string>) ?? {},
    sessionCert: result.sessionCert as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// 9. okx-defi-portfolio — Cross-protocol DeFi position tracking
// ---------------------------------------------------------------------------

export interface DefiPortfolioPosition {
  platform: string;
  chainIndex: string;
  tokenSymbol: string;
  balance: string;
  valueUsd: string;
}

/**
 * Get all DeFi positions across protocols for an address.
 *
 * **Onchain OS skill:** `okx-defi-portfolio`
 *
 * @param address - The wallet address to query.
 * @param chains - Comma-separated chain list (defaults to xlayer).
 */
export function getDefiPortfolioPositions(
  address: string,
  chains = DEFAULT_CHAIN,
): DefiPortfolioPosition[] {
  const cmd = `npx onchainos defi positions --address ${address} --chains ${chains}`;
  log.info(`Fetching DeFi portfolio for ${address}`);

  const result = runSkill(cmd) as DefiPortfolioPosition[] | null;

  return Array.isArray(result) ? result : [];
}

// ---------------------------------------------------------------------------
// 10. okx-security — DApp phishing detection
// ---------------------------------------------------------------------------

export interface DappScanResult {
  safe: boolean;
  phishingRisk: string;
  details: string;
}

/**
 * Scan a DApp URL for phishing risks.
 *
 * **Onchain OS skill:** `okx-security`
 *
 * @param url - The URL to scan.
 */
export function scanDappSecurity(url: string): DappScanResult {
  const cmd = `npx onchainos security dapp-scan --url ${url}`;
  log.info(`Scanning DApp: ${url}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { safe: true, phishingRisk: "unknown", details: "Scan unavailable" };
  }

  const action = (result.action as string) || "";
  return {
    safe: action !== "block",
    phishingRisk: action || "none",
    details: (result.message as string) ?? "Scan complete",
  };
}

// ---------------------------------------------------------------------------
// 11. okx-onchain-gateway — Gas price query
// ---------------------------------------------------------------------------

export interface GasPrice {
  slow: string;
  average: string;
  fast: string;
}

/**
 * Get current gas prices for a chain.
 *
 * **Onchain OS skill:** `okx-onchain-gateway`
 *
 * @param chain - Target chain (defaults to xlayer).
 */
export function getGasPrice(chain = DEFAULT_CHAIN): GasPrice {
  const cmd = `npx onchainos gateway gas --chain ${chain}`;
  log.info(`Fetching gas prices for ${chain}`);

  const result = runSkill(cmd) as Record<string, unknown> | null;

  if (!result) {
    return { slow: "0", average: "0", fast: "0" };
  }

  return {
    slow: (result.slow as string) ?? "0",
    average: (result.average as string) ?? "0",
    fast: (result.fast as string) ?? "0",
  };
}
