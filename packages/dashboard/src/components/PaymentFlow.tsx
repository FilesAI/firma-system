import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

// -- Types --

interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
}

interface FlowEdge {
  from: string;
  to: string;
  amount: string;
  rawAmount: number;
  status: "completed" | "rejected" | "pending";
  label?: string;
  count: number;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  summary: {
    totalSent: string;
    totalReceived: string;
    txCount: number;
  };
}

// Agent wallet addresses (lowercase for comparison)
const AGENT_WALLETS: Record<string, { label: string; id: string; sublabel: string }> = {
  "0x59ba3a53944d0678721eed5ebab84c286c508184": { label: "Main", id: "main", sublabel: "0x59ba...0184" },
  "0x9efb80111171782ecda56bb5c571904444052d40": { label: "Research", id: "research", sublabel: "0x9efb...2d40" },
  "0xc720748924ee609d9b75b2aef69a251e24bf62a3": { label: "Executor", id: "executor", sublabel: "0xc720...62A3" },
  "0xd4012e171b258ced4be057160dc2adf8dde09560": { label: "Treasury", id: "treasury", sublabel: "0xd401...9560" },
  "0x481ae0b27669a0d852f2d06ccbdbf3275e50ab62": { label: "Ops", id: "ops", sublabel: "0x481a...ab62" },
};

const USDT_ADDRESS = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const RPC_URL = "https://rpc.xlayer.tech";
const TRANSFER_EVENT = "event Transfer(address indexed from, address indexed to, uint256 value)";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

// Known payment labels based on typical agent flows
function inferLabel(fromId: string, toId: string): string {
  const key = `${fromId}->${toId}`;
  const labels: Record<string, string> = {
    "executor->research": "Signal Fees",
    "main->treasury": "Budget Distribution",
    "executor->treasury": "Trade Proceeds",
    "treasury->ops": "Report Fees",
    "treasury->research": "Research Funding",
    "main->executor": "Execution Budget",
    "main->ops": "Ops Budget",
    "treasury->executor": "Execution Allocation",
  };
  return labels[key] || "Payment";
}

// Fallback data (snapshot from on-chain-activity.md)
const FALLBACK_FLOW: FlowData = {
  nodes: [
    { id: "executor", label: "Executor", sublabel: "0xc720...62A3" },
    { id: "research", label: "Research", sublabel: "0x9efb...2d40" },
    { id: "main", label: "Main", sublabel: "0x59ba...0184" },
    { id: "treasury", label: "Treasury", sublabel: "0xd401...9560" },
    { id: "ops", label: "Ops", sublabel: "0x481a...ab62" },
  ],
  edges: [
    { from: "executor", to: "research", amount: "0.02 USDT", rawAmount: 0.02, status: "completed", label: "Signal Fees (x2)", count: 2 },
    { from: "main", to: "treasury", amount: "0.05 USDT", rawAmount: 0.05, status: "completed", label: "Budget Distribution", count: 1 },
    { from: "executor", to: "treasury", amount: "0.05 USDT", rawAmount: 0.05, status: "completed", label: "Trade Proceeds", count: 1 },
    { from: "treasury", to: "ops", amount: "0.01 USDT", rawAmount: 0.01, status: "completed", label: "Report Fee", count: 1 },
  ],
  summary: {
    totalSent: "0.13 USDT",
    totalReceived: "0.13 USDT",
    txCount: 5,
  },
};

async function fetchLivePayments(): Promise<FlowData> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const walletAddresses = Object.keys(AGENT_WALLETS);

  // Query recent blocks — X Layer ~2s blocks, 100k blocks ≈ 2.3 days
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 100_000);

  // Fetch Transfer events from USDT contract
  const logs = await provider.getLogs({
    address: USDT_ADDRESS,
    topics: [TRANSFER_TOPIC],
    fromBlock,
    toBlock: "latest",
  });

  const iface = new ethers.Interface([TRANSFER_EVENT]);
  const edgeMap = new Map<string, { fromId: string; toId: string; total: number; count: number }>();
  const nodeSet = new Set<string>();

  for (const log of logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed) continue;

      const from = parsed.args[0].toLowerCase();
      const to = parsed.args[1].toLowerCase();

      // Only agent-to-agent transfers
      if (!walletAddresses.includes(from) || !walletAddresses.includes(to)) continue;

      const fromInfo = AGENT_WALLETS[from];
      const toInfo = AGENT_WALLETS[to];
      const amount = parseFloat(ethers.formatUnits(parsed.args[2], 6));
      const key = `${fromInfo.id}->${toInfo.id}`;

      nodeSet.add(from);
      nodeSet.add(to);

      const existing = edgeMap.get(key);
      if (existing) {
        existing.total += amount;
        existing.count += 1;
      } else {
        edgeMap.set(key, { fromId: fromInfo.id, toId: toInfo.id, total: amount, count: 1 });
      }
    } catch {
      continue;
    }
  }

  // If no events found, throw to trigger fallback
  if (edgeMap.size === 0) throw new Error("No transfer events found");

  // Build nodes
  const nodes: FlowNode[] = Array.from(nodeSet).map((addr) => ({
    id: AGENT_WALLETS[addr].id,
    label: AGENT_WALLETS[addr].label,
    sublabel: AGENT_WALLETS[addr].sublabel,
  }));

  // Build edges sorted by amount descending
  const edges: FlowEdge[] = Array.from(edgeMap.values())
    .sort((a, b) => b.total - a.total)
    .map((e) => ({
      from: e.fromId,
      to: e.toId,
      amount: `${e.total.toFixed(2)} USDT`,
      rawAmount: e.total,
      status: "completed" as const,
      label: inferLabel(e.fromId, e.toId) + (e.count > 1 ? ` (x${e.count})` : ""),
      count: e.count,
    }));

  const totalAmount = edges.reduce((s, e) => s + e.rawAmount, 0);
  const totalTxCount = edges.reduce((s, e) => s + e.count, 0);

  return {
    nodes,
    edges,
    summary: {
      totalSent: `${totalAmount.toFixed(2)} USDT`,
      totalReceived: `${totalAmount.toFixed(2)} USDT`,
      txCount: totalTxCount,
    },
  };
}

// -- Subcomponents --

function FlowBox({ node, highlight }: { node: FlowNode; highlight?: string }) {
  return (
    <div
      className={`bg-firma-bg border rounded-lg p-3 min-w-[120px] text-center ${
        highlight === "accent"
          ? "border-firma-accent"
          : highlight === "green"
            ? "border-firma-green"
            : "border-firma-border"
      }`}
    >
      <div className="text-firma-text text-sm font-semibold">{node.label}</div>
      {node.sublabel && (
        <div className="text-firma-muted text-xs mt-0.5">{node.sublabel}</div>
      )}
    </div>
  );
}

function FlowArrow({
  amount,
  label,
  status,
}: {
  amount: string;
  label?: string;
  status: "completed" | "rejected" | "pending";
}) {
  const statusColor =
    status === "completed"
      ? "text-firma-green"
      : status === "rejected"
        ? "text-firma-red"
        : "text-firma-yellow";

  return (
    <div className="flex flex-col items-center justify-center px-2 min-w-[100px]">
      <span className={`text-xs font-medium ${statusColor}`}>{amount}</span>
      <div className={`text-lg ${statusColor} leading-none my-0.5`}>
        <div className="flex items-center gap-0.5">
          <div className={`h-px w-8 ${status === "rejected" ? "bg-red-500" : "bg-green-500"}`} />
          <span>{"\u2192"}</span>
        </div>
      </div>
      {label && <span className="text-firma-muted text-[10px]">{label}</span>}
    </div>
  );
}

// -- Main Component --

export default function PaymentFlow() {
  const [flow, setFlow] = useState<FlowData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const isPulsing = useLivePulse(flow);

  useEffect(() => {
    async function loadPayments() {
      try {
        const liveData = await fetchLivePayments();
        setFlow(liveData);
        setIsLive(true);
      } catch {
        // Fallback to snapshot data
        setFlow(FALLBACK_FLOW);
        setIsLive(false);
      }
      setLoading(false);
    }
    loadPayments();
    // Refresh every 60 seconds
    const interval = setInterval(loadPayments, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-firma-card border border-firma-border rounded-xl p-5 h-full">
        <h2 className="text-firma-text text-lg font-semibold mb-4">Payment Flow</h2>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!flow) return null;

  // Build a node lookup
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

  // Determine highlight color per node based on role
  const highlightFor = (id: string) => {
    if (id === "executor") return "accent";
    if (id === "research") return "green";
    return undefined;
  };

  return (
    <div className="bg-firma-card border border-firma-border rounded-xl p-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <h2 className="text-firma-text text-lg font-semibold">Payment Flow</h2>
          {isLive ? (
            <LiveBadge isPulsing={isPulsing} label={isPulsing ? "Updated" : "Live"} />
          ) : (
            <span className="text-firma-muted-dark text-[9px] font-semibold uppercase tracking-wider bg-firma-bg border border-firma-border rounded px-1.5 py-0.5">
              Mainnet Snapshot
            </span>
          )}
        </div>
      </div>
      <p className="text-firma-muted text-xs mb-5">
        {isLive
          ? "Live USDT transfers between agent wallets on X Layer"
          : "USDT payment flows between agent wallets"}
      </p>

      {/* Dynamic edge rows */}
      <div className="space-y-4 mb-6">
        {flow.edges.map((edge, i) => {
          const fromNode = nodeMap.get(edge.from) || { id: edge.from, label: edge.from };
          const toNode = nodeMap.get(edge.to) || { id: edge.to, label: edge.to };
          return (
            <div key={i} className="flex items-center justify-center flex-wrap gap-y-3">
              <FlowBox node={fromNode} highlight={highlightFor(edge.from)} />
              <FlowArrow amount={edge.amount} label={edge.label} status={edge.status} />
              <FlowBox node={toNode} highlight={highlightFor(edge.to)} />
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="border-t border-firma-border pt-4 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-firma-muted text-xs uppercase tracking-wide">Total Sent</div>
          <div className="text-firma-text text-lg font-bold mt-1">{flow.summary.totalSent}</div>
        </div>
        <div className="text-center">
          <div className="text-firma-muted text-xs uppercase tracking-wide">Received</div>
          <div className="text-firma-green text-lg font-bold mt-1">{flow.summary.totalReceived}</div>
        </div>
        <div className="text-center">
          <div className="text-firma-muted text-xs uppercase tracking-wide">Transactions</div>
          <div className="text-firma-accent text-lg font-bold mt-1">{flow.summary.txCount}</div>
        </div>
      </div>
    </div>
  );
}
