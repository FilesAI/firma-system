/**
 * x402 Signal Server — OKX x402 Payment Protocol
 *
 * Implements the seller side of the x402 protocol using @okxweb3/x402-express.
 * The /signal endpoint is protected by a paywall: buyers must pay USDT via
 * the x402 protocol to access trading signals.
 *
 * Flow:
 * 1. Buyer sends GET /signal
 * 2. Middleware returns HTTP 402 with payment requirements
 * 3. Buyer signs payment (EIP-3009 transferWithAuthorization)
 * 4. Buyer retries with X-PAYMENT header containing signed payload
 * 5. Middleware verifies payment via OKX Facilitator
 * 6. Signal is returned to buyer
 * 7. Facilitator settles payment on-chain
 */
import express from "express";
import type { Signal } from "@firma/core";
import {
  createLogger,
  AGENT_WALLETS,
  ONCHAINOS_API,
  X402_CONFIG,
} from "@firma/core";
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

const log = createLogger("x402Server");

export function startX402Server(
  getLatestSignal: () => Signal | null,
): express.Express {
  const app = express();
  const port = X402_CONFIG.port;

  app.use(express.json());

  // ====== Health endpoint (free, no payment required) ======
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      agent: "Firma Research Agent",
      uptime: process.uptime(),
      x402: {
        enabled: true,
        network: X402_CONFIG.network,
        scheme: X402_CONFIG.scheme,
        signalPrice: X402_CONFIG.signalPrice,
        payTo: X402_CONFIG.payToAddress,
      },
    });
  });

  // ====== x402 Payment Middleware Setup ======
  const hasApiCredentials = !!(
    ONCHAINOS_API.apiKey &&
    ONCHAINOS_API.secretKey &&
    ONCHAINOS_API.passphrase
  );

  if (hasApiCredentials) {
    // Production mode: real x402 payment verification via OKX Facilitator
    log.info("Initializing x402 with OKX Facilitator (production mode)");

    const facilitatorClient = new OKXFacilitatorClient({
      apiKey: ONCHAINOS_API.apiKey,
      secretKey: ONCHAINOS_API.secretKey,
      passphrase: ONCHAINOS_API.passphrase,
      syncSettle: X402_CONFIG.syncSettle,
    });

    const resourceServer = new x402ResourceServer(facilitatorClient);
    resourceServer.register(X402_CONFIG.network, new ExactEvmScheme());

    // Protect the /signal endpoint with x402 payment
    app.use(
      paymentMiddleware(
        {
          "GET /signal": {
            accepts: {
              scheme: X402_CONFIG.scheme,
              network: X402_CONFIG.network,
              payTo: X402_CONFIG.payToAddress,
              price: X402_CONFIG.signalPrice,
              maxTimeoutSeconds: 60,
            },
            description:
              "Firma Research Agent — AI-generated DEX trading signal based on Uniswap V3 pool analysis on X Layer",
            mimeType: "application/json",
          },
        },
        resourceServer,
      ),
    );

    log.info(
      `x402 paywall active: GET /signal costs ${X402_CONFIG.signalPrice} USDT on ${X402_CONFIG.network}`,
    );
  } else {
    // Development mode: no payment required (log warning)
    log.warn(
      "OKX API credentials not configured — x402 paywall DISABLED (dev mode). " +
        "Set OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE to enable payments.",
    );
  }

  // ====== Signal endpoint (protected by x402 in production) ======
  app.get("/signal", (_req, res) => {
    const signal = getLatestSignal();

    if (!signal) {
      res.status(204).json({
        signal: null,
        explanation:
          "No signal available at this time. Pool data is being analyzed.",
        meta: {
          agent: "Firma Research Agent",
          agentId: AGENT_WALLETS.research.agentId,
          poweredBy: "Onchain OS DEX Data API",
          x402: true,
          network: X402_CONFIG.network,
        },
      });
      return;
    }

    const explanation = buildExplanation(signal);

    res.json({
      signal: {
        pool: signal.pool,
        direction: signal.direction,
        confidence: signal.confidence,
        timestamp: signal.timestamp,
        token0: signal.token0,
        token1: signal.token1,
      },
      explanation,
      meta: {
        agent: "Firma Research Agent",
        agentId: AGENT_WALLETS.research.agentId,
        poweredBy: "Onchain OS DEX Data API",
        x402: true,
        network: X402_CONFIG.network,
        paidEndpoint: true,
      },
    });
  });

  // ====== x402 Payment Info endpoint (free) ======
  app.get("/x402/info", (_req, res) => {
    res.json({
      protocol: "x402",
      version: 2,
      description:
        "Firma Research Agent trading signals, payable via x402 protocol on X Layer",
      endpoints: {
        signal: {
          method: "GET",
          path: "/signal",
          price: X402_CONFIG.signalPrice,
          scheme: X402_CONFIG.scheme,
          network: X402_CONFIG.network,
          payTo: X402_CONFIG.payToAddress,
          token: "USDT",
          tokenAddress: X402_CONFIG.paymentToken,
        },
        health: {
          method: "GET",
          path: "/health",
          price: "free",
        },
      },
      documentation: "https://web3.okx.com/zh-hans/onchainos/dev-docs/payments/x402-introduction",
    });
  });

  app.listen(port, () => {
    log.info(`x402 signal server listening on port ${port}`);
    log.info(`  Health (free):  GET http://localhost:${port}/health`);
    log.info(`  Signal (paid):  GET http://localhost:${port}/signal`);
    log.info(`  x402 Info:      GET http://localhost:${port}/x402/info`);
    log.info(`  Network: ${X402_CONFIG.network} | Pay to: ${X402_CONFIG.payToAddress}`);
  });

  return app;
}

function buildExplanation(signal: Signal): string {
  const directionLabel = signal.direction === "LONG" ? "bullish" : "bearish";
  const confidenceLabel =
    signal.confidence >= 0.7
      ? "high"
      : signal.confidence >= 0.4
        ? "moderate"
        : "low";

  return (
    `${directionLabel.charAt(0).toUpperCase() + directionLabel.slice(1)} signal ` +
    `with ${confidenceLabel} confidence (${(signal.confidence * 100).toFixed(0)}%) ` +
    `for pool ${signal.pool}. ${signal.reason}.`
  );
}
