import { useState } from "react";

interface SignalResponse {
  pool: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  reasoning: string;
  timestamp: string;
  agentId: string;
  tokenId: number;
}

const MOCK_SIGNAL: SignalResponse = {
  pool: "OKB/USDT",
  direction: "SHORT",
  confidence: 74,
  reasoning:
    "LP withdrawal 12% in last 4h, sell pressure building. Token1 reserve declining faster than Token0. Net flow: -$48K. Volume spike 3.2x above 24h avg suggests distribution phase.",
  timestamp: new Date().toISOString(),
  agentId: "0x1a2b...3c4d",
  tokenId: 1,
};

interface TryItProps {
  endpoint: string;
}

function DirectionBadge({ direction }: { direction: "LONG" | "SHORT" }) {
  const isLong = direction === "LONG";
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded ${
        isLong ? "bg-green-500/10 text-firma-green" : "bg-red-500/10 text-firma-red"
      }`}
    >
      {direction} {isLong ? "\u2191" : "\u2193"}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? "bg-green-500"
      : value >= 50
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-firma-bg rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-firma-text text-sm font-bold w-10 text-right">{value}%</span>
    </div>
  );
}

export default function TryIt({ endpoint }: TryItProps) {
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  async function fetchSignal() {
    setLoading(true);
    setError(null);
    setSignal(null);

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSignal(data);
    } catch {
      // Endpoint unavailable — show simulation with clear label
      await new Promise((r) => setTimeout(r, 800));
      setSignal({ ...MOCK_SIGNAL, timestamp: new Date().toISOString() });
      setError("x402 server not running locally — showing example signal response. In production: Executor pays 0.01 USDT via EIP-3009 signed transfer → OKX Facilitator settles on-chain → Research returns signal data. See x402 Payment Flow below.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-firma-card border border-firma-border rounded-2xl p-6">
      {/* x402 protocol badge */}
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2 mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
          <span className="text-indigo-400 text-xs font-semibold">x402 Payment Protocol (OKX Standard)</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><span className="text-firma-muted">Network:</span> <span className="text-firma-text">X Layer (eip155:196)</span></div>
          <div><span className="text-firma-muted">Scheme:</span> <span className="text-firma-text">exact (EIP-3009)</span></div>
          <div><span className="text-firma-muted">Price:</span> <span className="text-firma-text">$0.01 USDT</span></div>
          <div><span className="text-firma-muted">SDK:</span> <span className="text-firma-text">@okxweb3/x402-express</span></div>
        </div>
      </div>

      {/* Endpoint display */}
      <div className="bg-firma-bg border border-firma-border rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
        <span className="text-firma-muted text-xs shrink-0">GET</span>
        <span className="text-firma-text text-xs font-mono truncate">{endpoint}</span>
        <span className="text-amber-400 text-xs shrink-0 ml-auto">HTTP 402</span>
      </div>

      {/* Local-only note */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 mb-4">
        <span className="text-white/30 text-[11px]">
          Requires the Research Agent running locally (<code className="text-white/40">pnpm -F @firma/research-agent start</code>).
          When offline, shows an example signal response to demonstrate the x402 flow.
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={fetchSignal}
        disabled={loading}
        className="bg-firma-accent hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-5"
      >
        {loading ? "Fetching Signal..." : "Try Signal Request"}
      </button>

      {/* Status */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Simulation Mode</span>
          </div>
          <span className="text-amber-300/80 text-sm">{error}</span>
        </div>
      )}

      {/* Signal result */}
      {signal && (
        <div className="space-y-4">
          {/* Human readable */}
          <div className="bg-firma-bg border border-firma-border rounded-lg p-4">
            <div className="text-firma-muted text-xs uppercase tracking-wide mb-3">
              Signal Response
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-firma-muted text-xs mb-1">Pool</div>
                <div className="text-firma-text text-sm font-semibold">{signal.pool}</div>
              </div>
              <div>
                <div className="text-firma-muted text-xs mb-1">Direction</div>
                <DirectionBadge direction={signal.direction} />
              </div>
            </div>

            <div className="mb-3">
              <div className="text-firma-muted text-xs mb-1">Confidence</div>
              <ConfidenceBar value={signal.confidence} />
            </div>

            <div>
              <div className="text-firma-muted text-xs mb-1">Reasoning</div>
              <p className="text-firma-text text-sm leading-relaxed">{signal.reasoning}</p>
            </div>
          </div>

          {/* Raw JSON toggle */}
          <div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-firma-accent text-xs font-medium hover:underline mb-2"
            >
              {showRaw ? "Hide" : "Show"} Raw JSON
            </button>
            {showRaw && (
              <pre className="bg-firma-bg border border-firma-border rounded-lg p-3 text-firma-text text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(signal, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* x402 Flow Diagram */}
      <div className="border-t border-firma-border mt-5 pt-4 mb-4">
        <div className="text-firma-muted text-xs uppercase tracking-wide mb-2">x402 Payment Flow</div>
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <span className="bg-firma-bg border border-firma-border rounded px-2 py-1 text-firma-text">1. GET /signal</span>
          <span className="text-firma-muted">&rarr;</span>
          <span className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1 text-amber-400">2. HTTP 402 + Requirements</span>
          <span className="text-firma-muted">&rarr;</span>
          <span className="bg-indigo-500/10 border border-indigo-500/30 rounded px-2 py-1 text-indigo-400">3. Sign EIP-3009</span>
          <span className="text-firma-muted">&rarr;</span>
          <span className="bg-green-500/10 border border-green-500/30 rounded px-2 py-1 text-firma-green">4. Retry + X-PAYMENT</span>
          <span className="text-firma-muted">&rarr;</span>
          <span className="bg-firma-bg border border-firma-border rounded px-2 py-1 text-firma-text">5. Signal Data</span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-firma-border pt-4 flex items-center justify-between">
        <span className="text-firma-muted text-xs">
          Powered by <span className="text-firma-accent font-medium">Onchain OS Payment + DEX API</span>
        </span>
        <span className="text-firma-muted text-xs">
          Agent Identity: <span className="text-firma-text font-medium">ERC-8004 #1</span>
        </span>
      </div>
    </div>
  );
}
