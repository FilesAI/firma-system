/**
 * x402 Signal Client — OKX x402 Payment Protocol
 *
 * Implements the buyer side of the x402 protocol using @okxweb3/x402-fetch.
 * When the signal endpoint returns HTTP 402, the client automatically:
 * 1. Parses payment requirements from the 402 response
 * 2. Signs an EIP-3009 transferWithAuthorization via a dedicated payment signer
 * 3. Retries the request with the X-PAYMENT header
 * 4. Returns the signal data
 *
 * Architecture note: Main agent operations use TEE-based Agentic Wallet (zero
 * private keys). x402 micropayments use a dedicated payment signer because
 * the onchainos CLI does not yet support EIP-712 typed data signing required
 * by the x402 protocol. The payment signer holds only a small USDT balance
 * for signal purchases ($0.01/signal).
 */
import type { Signal } from "@firma/core";
import {
  createLogger,
  AGENT_WALLETS,
  X402_CONFIG,
  XLAYER_RPC,
  XLAYER_CHAIN_ID,
} from "@firma/core";
import { wrapFetchWithPayment, x402Client } from "@okxweb3/x402-fetch";
import { registerExactEvmScheme } from "@okxweb3/x402-evm/exact/client";
import { toClientEvmSigner } from "@okxweb3/x402-evm";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const log = createLogger("x402Client");

// Lazily initialized x402-wrapped fetch
let _paidFetch: typeof fetch | null = null;

/**
 * Creates a fetch wrapper that automatically handles x402 (HTTP 402) payments.
 *
 * Uses a dedicated payment signer for EIP-3009 typed data signing.
 * Falls back to plain fetch if no payment key is configured.
 */
function getPaidFetch(): typeof fetch {
  if (_paidFetch) return _paidFetch;

  const paymentKey = process.env.X402_PAYMENT_PRIVATE_KEY;

  if (paymentKey) {
    // Production mode: x402 payments via dedicated payment signer
    try {
      const account = privateKeyToAccount(paymentKey as `0x${string}`);

      const publicClient = createPublicClient({
        chain: {
          id: XLAYER_CHAIN_ID,
          name: "X Layer",
          nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
          rpcUrls: { default: { http: [XLAYER_RPC] } },
        },
        transport: http(XLAYER_RPC),
      });

      const signer = toClientEvmSigner(account, publicClient);

      const client = new x402Client();
      registerExactEvmScheme(client, {
        signer,
        networks: [X402_CONFIG.network],
        schemeOptions: { rpcUrl: XLAYER_RPC },
      });

      _paidFetch = wrapFetchWithPayment(fetch, client);

      log.info(
        `x402 payment client initialized (signer: ${account.address.slice(0, 10)}...) — ` +
        `real payments enabled on ${X402_CONFIG.network}`,
      );
    } catch (err) {
      log.warn("Failed to initialize x402 payment signer, falling back to dev mode", err);
      _paidFetch = fetch;
    }
  } else {
    // Dev mode: no payment key configured
    log.info(
      "No X402_PAYMENT_PRIVATE_KEY configured — x402 payments in dev mode. " +
      "Set this env var with a funded wallet to enable real signal payments.",
    );
    _paidFetch = fetch;
  }

  return _paidFetch;
}

/**
 * Fetch a trading signal from the Research Agent's x402-protected endpoint.
 *
 * If the endpoint requires payment (HTTP 402), the wrapped fetch automatically
 * signs and submits an EIP-3009 USDT transfer on X Layer, then retries.
 */
export async function fetchSignal(endpoint: string): Promise<Signal | null> {
  try {
    log.info(`Fetching signal from ${endpoint} (x402-enabled)`);

    const paidFetch = getPaidFetch();

    const response = await paidFetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    // Check for payment response header (proof of payment)
    const paymentResponse = response.headers.get("PAYMENT-RESPONSE");
    if (paymentResponse) {
      log.info("x402 payment completed successfully — signal access granted");
    }

    if (response.status === 204) {
      log.info("No signal available (204)");
      return null;
    }

    if (!response.ok) {
      log.warn(
        `Signal endpoint returned ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    // The research server wraps the signal: { signal: {...}, explanation, meta }
    const src = data.signal ?? data;

    const signal: Signal = {
      pool: src.pool,
      direction: src.direction,
      confidence: src.confidence,
      reason: src.reason ?? data.explanation ?? "",
      timestamp: src.timestamp,
      token0: src.token0,
      token1: src.token1,
    };

    log.info(
      `Signal received: ${signal.direction} on ${signal.pool} ` +
        `(confidence: ${(signal.confidence * 100).toFixed(0)}%)` +
        (paymentResponse ? " [PAID via x402]" : " [FREE/dev mode]"),
    );

    return signal;
  } catch (error) {
    log.error("Failed to fetch signal", error);
    return null;
  }
}
