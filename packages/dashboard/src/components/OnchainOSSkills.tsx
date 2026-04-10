import { useState, useEffect } from "react";

interface OnchainSkillCall {
  id: string;
  skill: string;
  command: string;
  agent: string;
  purpose: string;
  category: "dex" | "defi" | "wallet" | "security" | "gateway";
}

const SKILL_CALLS: OnchainSkillCall[] = [
  { id: "1", skill: "okx-dex-swap", command: "onchainos dex swap", agent: "Executor", purpose: "Token swaps via OKX DEX aggregator", category: "dex" },
  { id: "2", skill: "okx-dex-signal", command: "onchainos dex signal aggregated-buy", agent: "Research", purpose: "Aggregated buy signals on X Layer", category: "dex" },
  { id: "3", skill: "okx-dex-token", command: "onchainos dex token holder-distribution", agent: "Research", purpose: "Whale/sniper holder analysis", category: "dex" },
  { id: "4", skill: "okx-dex-market", command: "onchainos dex market kline", agent: "Research", purpose: "K-line OHLCV market data", category: "dex" },
  { id: "5", skill: "okx-defi-invest", command: "onchainos defi invest search", agent: "Treasury", purpose: "DeFi yield opportunity scanning", category: "defi" },
  { id: "6", skill: "okx-wallet-portfolio", command: "onchainos portfolio all-balances", agent: "Treasury", purpose: "Full wallet portfolio + USD values", category: "wallet" },
  { id: "7", skill: "okx-onchain-gateway", command: "onchainos gateway status", agent: "Ops", purpose: "Transaction confirmation verification", category: "gateway" },
  { id: "8", skill: "okx-onchain-gateway", command: "onchainos gateway broadcast", agent: "Core", purpose: "Broadcast signed transactions", category: "gateway" },
  { id: "9", skill: "okx-onchain-gateway", command: "onchainos gateway estimate-gas", agent: "Core", purpose: "Pre-flight gas estimation", category: "gateway" },
  { id: "10", skill: "okx-security", command: "onchainos security scan-token", agent: "Treasury", purpose: "Token security scan before execution", category: "security" },
  { id: "11", skill: "okx-agentic-wallet", command: "onchainos wallet contract-call", agent: "All", purpose: "TEE-secured transaction signing", category: "wallet" },
];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  dex: { label: "DEX", color: "text-blue-400/80 bg-blue-400/10 border-blue-400/20" },
  defi: { label: "DeFi", color: "text-green-400/80 bg-green-400/10 border-green-400/20" },
  wallet: { label: "Wallet", color: "text-purple-400/80 bg-purple-400/10 border-purple-400/20" },
  security: { label: "Security", color: "text-red-400/80 bg-red-400/10 border-red-400/20" },
  gateway: { label: "Gateway", color: "text-amber-400/80 bg-amber-400/10 border-amber-400/20" },
};

function AgentBadge({ agent }: { agent: string }) {
  const colors: Record<string, string> = {
    Research: "text-cyan-400/70",
    Executor: "text-orange-400/70",
    Treasury: "text-green-400/70",
    Ops: "text-indigo-400/70",
    Core: "text-purple-400/70",
    All: "text-white/50",
  };
  return <span className={`text-[10px] font-medium ${colors[agent] || "text-white/40"}`}>{agent}</span>;
}

export default function OnchainOSSkills() {
  const [animated, setAnimated] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  useEffect(() => { setTimeout(() => setAnimated(true), 200); }, []);

  const categories = [...new Set(SKILL_CALLS.map(s => s.category))];
  const filtered = filter ? SKILL_CALLS.filter(s => s.category === filter) : SKILL_CALLS;

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white text-[9px] font-bold">OS</span>
          </div>
          <div>
            <div className="text-white/80 text-sm font-medium">Onchain OS Skill Calls</div>
            <div className="text-white/25 text-[11px]">14 <code className="text-white/30">npx onchainos</code> CLI skill wrappers across 4 agents</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-50" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-blue-400" />
          </span>
          <span className="text-blue-400/70 text-[10px] font-medium">Live</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
            filter === null ? "text-white/70 bg-white/10 border-white/20" : "text-white/25 bg-transparent border-white/[0.05] hover:border-white/10"
          }`}
        >
          All ({SKILL_CALLS.length})
        </button>
        {categories.map(cat => {
          const meta = CATEGORY_META[cat];
          const count = SKILL_CALLS.filter(s => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(filter === cat ? null : cat)}
              className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                filter === cat ? meta.color : "text-white/25 bg-transparent border-white/[0.05] hover:border-white/10"
              }`}
            >
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Skill Rows */}
      <div>
        <div className="flex items-center gap-4 py-2 border-b border-white/[0.04] -mx-5 px-5">
          <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest flex-1">Skill</span>
          <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-20 hidden sm:block">Agent</span>
          <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-16 hidden sm:block">Type</span>
          <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest flex-1 hidden md:block">CLI Command</span>
        </div>

        {filtered.map((call, i) => {
          const meta = CATEGORY_META[call.category];
          return (
            <div
              key={call.id}
              className="flex items-center gap-4 py-3 border-b border-white/[0.03] last:border-0 group hover:bg-white/[0.01] -mx-5 px-5 transition-all duration-300"
              style={{ opacity: animated ? 1 : 0, transform: animated ? "translateY(0)" : "translateY(6px)", transitionDelay: `${i * 50}ms` }}
            >
              {/* Name + Purpose */}
              <div className="min-w-0 flex-1">
                <div className="text-white/70 text-[12px] font-medium">{call.skill}</div>
                <div className="text-white/20 text-[10px] truncate">{call.purpose}</div>
              </div>

              {/* Agent */}
              <div className="w-20 hidden sm:block">
                <AgentBadge agent={call.agent} />
              </div>

              {/* Category */}
              <div className="w-16 hidden sm:block">
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.color}`}>
                  {meta.label}
                </span>
              </div>

              {/* CLI Command */}
              <div className="flex-1 hidden md:block">
                <code className="text-white/25 text-[10px] font-mono bg-white/[0.02] px-2 py-0.5 rounded">{call.command}</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
