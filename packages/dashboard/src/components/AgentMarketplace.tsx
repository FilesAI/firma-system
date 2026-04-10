import { useState, useEffect } from "react";

type AgentStatus = "hired" | "available" | "suspended";

interface AgentListing {
  id: string;
  name: string;
  version: string;
  author: string;
  status: AgentStatus;
  capability: string;
  accuracy: number | null;
  jobsCompleted: number;
  netProfit: number;
  reputation: number;
  costPerJob: number;
}

const AGENTS: AgentListing[] = [
  { id: "AGT-001", name: "Research Alpha", version: "v1.2", author: "firma-labs", status: "hired", capability: "Research", accuracy: 78, jobsCompleted: 42, netProfit: 0.18, reputation: 4.2, costPerJob: 0.01 },
  { id: "AGT-002", name: "Executor Prime", version: "v1.0", author: "firma-labs", status: "hired", capability: "Trading", accuracy: 92, jobsCompleted: 38, netProfit: 0.32, reputation: 4.8, costPerJob: 0.02 },
  { id: "AGT-003", name: "Treasury Guardian", version: "v1.1", author: "firma-labs", status: "hired", capability: "Governance", accuracy: 95, jobsCompleted: 12, netProfit: 0.0, reputation: 4.9, costPerJob: 0.005 },
  { id: "AGT-004", name: "Ops Reporter", version: "v1.0", author: "firma-labs", status: "hired", capability: "Operations", accuracy: 100, jobsCompleted: 8, netProfit: 0.0, reputation: 4.5, costPerJob: 0.005 },
  { id: "AGT-005", name: "Risk Monitor", version: "v0.5", author: "community", status: "available", capability: "Risk", accuracy: null, jobsCompleted: 0, netProfit: 0, reputation: 0, costPerJob: 0.01 },
  { id: "AGT-006", name: "Data Analyst", version: "v0.3", author: "community", status: "suspended", capability: "Analytics", accuracy: 35, jobsCompleted: 20, netProfit: -0.05, reputation: 1.2, costPerJob: 0.015 },
];

function StatusDot({ status }: { status: AgentStatus }) {
  const colors = { hired: "bg-green-400", available: "bg-indigo-400", suspended: "bg-red-400" };
  return (
    <span className={`w-1.5 h-1.5 rounded-full ${colors[status]} ${status === "hired" ? "animate-pulse" : ""}`} />
  );
}

function AgentRow({ agent, animated }: { agent: AgentListing; animated: boolean }) {
  const isHired = agent.status === "hired";
  const isSuspended = agent.status === "suspended";
  const barColor = (agent.accuracy || 0) >= 90 ? "bg-green-400" : (agent.accuracy || 0) >= 70 ? "bg-amber-400" : "bg-red-400";
  const profitColor = agent.netProfit > 0 ? "text-green-400/70" : agent.netProfit < 0 ? "text-red-400/70" : "text-white/15";

  return (
    <div className={`flex items-center gap-4 py-3.5 border-b border-white/[0.03] last:border-0 group hover:bg-white/[0.01] -mx-5 px-5 transition-colors ${isSuspended ? "opacity-50" : ""}`}>
      {/* Status + Name */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <StatusDot status={agent.status} />
        <div className="min-w-0">
          <div className="text-white/80 text-sm font-medium truncate">{agent.name}</div>
          <div className="text-white/20 text-[11px]">{agent.author} &middot; {agent.version}</div>
        </div>
      </div>

      {/* Capability */}
      <span className="hidden sm:block text-white/25 text-[10px] font-medium uppercase tracking-wider w-20">{agent.capability}</span>

      {/* Accuracy */}
      <div className="w-24 hidden md:block">
        {agent.accuracy !== null ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: animated ? `${agent.accuracy}%` : "0%" }} />
            </div>
            <span className="text-white/40 text-[11px] font-mono w-8 text-right">{agent.accuracy}%</span>
          </div>
        ) : (
          <span className="text-white/15 text-[11px]">--</span>
        )}
      </div>

      {/* Jobs */}
      <span className={`w-10 text-right font-mono text-[12px] ${isHired ? "text-white/50" : "text-white/15"}`}>
        {agent.jobsCompleted || "--"}
      </span>

      {/* P&L */}
      <span className={`w-16 text-right font-mono text-[12px] ${profitColor}`}>
        {agent.netProfit !== 0 ? `${agent.netProfit > 0 ? "+" : ""}${agent.netProfit.toFixed(2)}` : "--"}
      </span>
    </div>
  );
}

export default function AgentMarketplace() {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 300); }, []);

  const hired = AGENTS.filter(a => a.status === "hired").length;
  const totalProfit = AGENTS.reduce((s, a) => s + a.netProfit, 0);

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm font-medium">Agents</span>
          <span className="text-white/15 text-[10px] font-mono">{hired} hired</span>
          <span className="text-white/10 text-[9px] uppercase tracking-wider">Preview</span>
        </div>
        <span className={`text-[11px] font-mono ${totalProfit >= 0 ? "text-green-400/50" : "text-red-400/50"}`}>
          {totalProfit > 0 ? "+" : ""}{totalProfit.toFixed(2)} USDT
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-4 py-2 border-b border-white/[0.04] -mx-5 px-5 mb-1">
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest flex-1">Name</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-20 hidden sm:block">Role</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-24 hidden md:block">Accuracy</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-10 text-right">Jobs</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-16 text-right">P&L</span>
      </div>

      {/* Rows */}
      {AGENTS.map(agent => (
        <AgentRow key={agent.id} agent={agent} animated={animated} />
      ))}
    </div>
  );
}
