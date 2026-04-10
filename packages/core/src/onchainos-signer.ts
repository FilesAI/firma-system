import { ethers } from "ethers";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "./logger.js";

const execFileAsync = promisify(execFile);
const log = createLogger("OnchaiosSigner");

const ONCHAINOS_BIN =
  process.env.ONCHAINOS_BIN || `${process.env.HOME}/.local/bin/onchainos`;

interface OnchainosResult {
  ok: boolean;
  data?: { txHash?: string; signature?: string };
  error?: string;
}

async function runOnchainos(args: string[]): Promise<OnchainosResult> {
  try {
    const { stdout } = await execFileAsync(ONCHAINOS_BIN, args, {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout.trim());
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    // onchainos may exit non-zero but still return JSON
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch {
        // fall through
      }
    }
    throw new Error(
      `onchainos failed: ${error.stderr || error.message || "unknown error"}`,
    );
  }
}

/**
 * Ethers v6 Signer that delegates all signing to onchainos CLI (TEE-based).
 * Private keys never leave the TEE — all signing happens server-side.
 */
export class OnchaiosSigner extends ethers.AbstractSigner {
  readonly accountId: string;
  readonly walletAddress: string;

  constructor(
    accountId: string,
    walletAddress: string,
    provider: ethers.Provider,
  ) {
    super(provider);
    this.accountId = accountId;
    this.walletAddress = walletAddress;
  }

  async getAddress(): Promise<string> {
    return this.walletAddress;
  }

  connect(provider: ethers.Provider): OnchaiosSigner {
    return new OnchaiosSigner(this.accountId, this.walletAddress, provider);
  }

  private async switchAccount(): Promise<void> {
    const result = await runOnchainos([
      "wallet",
      "switch",
      this.accountId,
    ]);
    if (!result.ok) {
      throw new Error(`Failed to switch to account ${this.accountId}: ${result.error}`);
    }
  }

  async sendTransaction(
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    await this.switchAccount();

    const to = (await ethers.resolveAddress(tx.to!, this.provider!)) as string;
    const data = (tx.data as string) || "0x";
    const value = tx.value ? ethers.formatEther(tx.value) : "0";

    const args = [
      "wallet",
      "contract-call",
      "--to",
      to,
      "--chain",
      "196",
      "--force",
    ];

    if (data && data !== "0x") {
      args.push("--input-data", data);
    }

    if (value !== "0") {
      args.push("--value", value);
    }

    if (tx.gasLimit) {
      args.push("--gas-limit", tx.gasLimit.toString());
    }

    log.info(`TX → ${to} (account: ${this.accountId.slice(0, 8)}...)`);

    const result = await runOnchainos(args);

    if (!result.ok || !result.data?.txHash) {
      throw new Error(
        `onchainos contract-call failed: ${result.error || "no txHash"}`,
      );
    }

    const txHash = result.data.txHash;
    log.info(`TX confirmed: ${txHash}`);

    // Wait for the transaction to be indexed and return a proper TransactionResponse
    const provider = this.provider as ethers.JsonRpcProvider;
    let response: ethers.TransactionResponse | null = null;
    for (let i = 0; i < 10; i++) {
      response = await provider.getTransaction(txHash);
      if (response) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!response) {
      // If we can't find it via provider (AA transactions may differ),
      // create a minimal response that supports .wait()
      return new OnchainosTransactionResponse(txHash, provider);
    }

    return response;
  }

  // onchainos handles signing — these are not called directly
  async signTransaction(_tx: ethers.TransactionLike): Promise<string> {
    throw new Error(
      "OnchaiosSigner: use sendTransaction() — TEE signs atomically",
    );
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    await this.switchAccount();
    const msgStr =
      typeof message === "string"
        ? message
        : ethers.hexlify(message);

    const result = await runOnchainos([
      "wallet",
      "sign-message",
      "--message",
      msgStr,
      "--chain",
      "196",
    ]);

    if (!result.ok || !result.data?.signature) {
      throw new Error(`sign-message failed: ${result.error}`);
    }

    return result.data.signature;
  }

  async signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, unknown>,
  ): Promise<string> {
    throw new Error(
      "OnchaiosSigner: signTypedData is not supported by TEE-based Agentic Wallet. " +
      "The onchainos CLI does not expose EIP-712 typed data signing. " +
      "For x402 payments (which require EIP-3009/EIP-712), use a dedicated " +
      "payment signer via X402_PAYMENT_PRIVATE_KEY instead.",
    );
  }
}

/**
 * Minimal TransactionResponse for AA transactions that may not appear
 * in the provider's normal transaction index (since the outer tx
 * goes through the EntryPoint contract).
 */
class OnchainosTransactionResponse extends ethers.TransactionResponse {
  constructor(hash: string, provider: ethers.JsonRpcProvider) {
    // Build a minimal TransactionLike for the super constructor
    super(
      {
        blockNumber: 0,
        blockHash: "",
        index: 0,
        hash,
        type: 0,
        to: null,
        from: "",
        nonce: 0,
        gasLimit: 0n,
        gasPrice: 0n,
        maxPriorityFeePerGas: null,
        maxFeePerGas: null,
        maxFeePerBlobGas: null,
        data: "0x",
        value: 0n,
        chainId: 196n,
        signature: ethers.Signature.from({
          r: "0x0000000000000000000000000000000000000000000000000000000000000000",
          s: "0x0000000000000000000000000000000000000000000000000000000000000000",
          v: 27,
        }),
        accessList: [],
        blobVersionedHashes: null,
        authorizationList: null,
      } as ethers.TransactionResponseParams,
      provider,
    );
  }

  override async wait(
    confirms?: number,
    _timeout?: number,
  ): Promise<ethers.TransactionReceipt | null> {
    // Poll for receipt since AA txs may be indexed with delay
    const provider = this.provider as ethers.JsonRpcProvider;
    for (let i = 0; i < 30; i++) {
      const receipt = await provider.getTransactionReceipt(this.hash);
      if (receipt) {
        if (confirms && confirms > 1) {
          await receipt.confirmations();
        }
        return receipt;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }
}

/**
 * Create an OnchaiosSigner for a given agent wallet config.
 */
export function createOnchaiosSigner(
  accountId: string,
  walletAddress: string,
  provider?: ethers.Provider,
): OnchaiosSigner {
  const p = provider || new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
  return new OnchaiosSigner(accountId, walletAddress, p);
}
