/**
 * Test x402 Payment — Verifies the full x402 payment flow:
 * 1. Start Research Agent x402 server (seller)
 * 2. Initialize x402 client with payment signer (buyer)
 * 3. Fetch signal → get 402 → auto-pay → receive signal
 *
 * Requires:
 * - X402_PAYMENT_PRIVATE_KEY env var set
 * - Research Agent x402 server running on port 3001
 */
import { fetchSignal } from "../packages/executor-agent/src/x402-client.js";

async function main() {
  const endpoint = process.env.SIGNAL_ENDPOINT || "http://localhost:3001/signal";

  console.log("=== x402 Payment Test ===");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Payment key configured: ${!!process.env.X402_PAYMENT_PRIVATE_KEY}`);
  console.log("");

  if (!process.env.X402_PAYMENT_PRIVATE_KEY) {
    console.log("⚠ No X402_PAYMENT_PRIVATE_KEY set — will use dev mode (free)");
  }

  try {
    const signal = await fetchSignal(endpoint);
    if (signal) {
      console.log("\n✅ Signal received:");
      console.log(`  Direction: ${signal.direction}`);
      console.log(`  Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
      console.log(`  Pool: ${signal.pool}`);
      console.log(`  Reason: ${signal.reason}`);
    } else {
      console.log("\n⚠ No signal available (server may not have data yet)");
    }
  } catch (err) {
    console.error("\n❌ Failed:", err);
  }
}

main();
