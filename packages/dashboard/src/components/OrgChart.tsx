import { useAgents, type AgentOnChain } from "../hooks/useContract";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

const ROLE_META: Record<string, { title: string; color: string; glow: string }> = {
  Research: { title: "Analyst", color: "text-indigo-400", glow: "shadow-indigo-500/10" },
  Executor: { title: "Trader", color: "text-emerald-400", glow: "shadow-emerald-500/10" },
  Treasury: { title: "CFO", color: "text-amber-400", glow: "shadow-amber-500/10" },
  Ops:      { title: "Manager", color: "text-slate-400", glow: "shadow-slate-500/10" },
};

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(ts: number): string {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AgentCard({ agent }: { agent: AgentOnChain }) {
  const meta = ROLE_META[agent.roleName] || { title: agent.roleName, color: "text-white/50", glow: "" };

  return (
    <div className={`glass-card p-5 hover:translate-y-[-2px] ${meta.glow}`}>
      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <span className={`text-sm font-bold ${meta.color}`}>{agent.roleName[0]}</span>
          </div>
          <div>
            <div className="text-white/85 text-sm font-semibold tracking-tight">{agent.roleName}</div>
            <div className="text-white/25 text-[11px]">{meta.title}</div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full ${
          agent.active
            ? "bg-green-500/10 text-green-400/80 border border-green-500/15"
            : "bg-red-500/10 text-red-400/80 border border-red-500/15"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${agent.active ? "bg-green-400" : "bg-red-400"}`} />
          {agent.active ? "Active" : "Fired"}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-white/20 text-[11px]">Wallet</span>
          <a
            href={`https://www.okx.com/web3/explorer/xlayer/address/${agent.wallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400/60 hover:text-indigo-400 text-[11px] font-mono transition-colors"
          >
            {truncAddr(agent.wallet)} &#8599;
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/20 text-[11px]">Hired</span>
          <span className="text-indigo-400/60 text-[11px] font-mono">{formatDate(agent.hiredAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function OrgChart() {
  const { agents, loading, error } = useAgents();

  // Safely serialize agents for pulse detection (BigInt not JSON-safe)
  const safeAgents = agents.map(a => ({ ...a, budget: a.budget?.toString() ?? "0" }));
  const isPulsing = useLivePulse(safeAgents);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="skeleton w-9 h-9 rounded-lg" />
              <div>
                <div className="skeleton w-16 h-4 mb-1" />
                <div className="skeleton w-10 h-3" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="skeleton w-full h-3" />
              <div className="skeleton w-2/3 h-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || agents.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-white/25 text-sm">{error || "No agents registered on-chain"}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <LiveBadge isPulsing={isPulsing} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.agentId} agent={agent} />
        ))}
      </div>
    </div>
  );
}
