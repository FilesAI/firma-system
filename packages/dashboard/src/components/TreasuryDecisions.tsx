import { useAgents, useTreasuryActive, FIRMA_COMPANY_ADDRESS } from "../hooks/useContract";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

const ROLE_TITLES: Record<string, string> = {
  Research: "Signal Provider",
  Executor: "Job Runner",
  Treasury: "Governor",
  Ops: "Anchor Manager",
};

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TreasuryDecisions() {
  const { agents, loading } = useAgents();
  const treasuryActive = useTreasuryActive();
  const isPulsing = useLivePulse(agents);

  const activeCount = agents.filter((a) => a.active).length;
  const firedCount = agents.filter((a) => !a.active && a.registered).length;

  if (loading) {
    return (
      <div className="bg-firma-card border border-firma-border rounded-xl p-5 h-full">
        <div className="text-firma-muted text-sm animate-pulse text-center py-8">
          Loading governance data...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-firma-card border border-firma-border rounded-xl p-5 h-full">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-firma-text text-lg font-semibold">Treasury Decisions</h2>
          <LiveBadge isPulsing={isPulsing} />
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-firma-green font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-firma-green animate-pulse" />
          On-Chain
        </span>
      </div>
      <p className="text-firma-muted text-xs mb-4">
        Governance decisions verified on X Layer
      </p>

      {/* Summary badges */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 bg-green-500/10 text-firma-green text-xs font-medium px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {activeCount} Active
        </div>
        {firedCount > 0 && (
          <div className="flex items-center gap-1.5 bg-red-500/10 text-firma-red text-xs font-medium px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {firedCount} Fired
          </div>
        )}
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
          treasuryActive
            ? "bg-amber-500/10 text-amber-400"
            : "bg-red-500/10 text-firma-red"
        }`}>
          <span className={`w-2 h-2 rounded-full inline-block ${
            treasuryActive ? "bg-amber-500" : "bg-red-500"
          }`} />
          Treasury {treasuryActive ? "Active" : "Paused"}
        </div>
      </div>

      {/* Agent governance timeline */}
      <div className="relative">
        {agents.map((agent) => {
          const isActive = agent.active;
          const role = agent.roleName;
          const title = ROLE_TITLES[role] || role;

          return (
            <div key={agent.agentId} className="relative flex gap-4">
              {/* Timeline line and dot */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                  isActive ? "bg-green-500" : "bg-red-500"
                }`} />
                <div className="w-px flex-1 bg-firma-border" />
              </div>

              {/* Content */}
              <div className="pb-6 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isActive
                          ? "bg-green-500/10 text-firma-green"
                          : "bg-red-500/10 text-firma-red"
                      }`}
                    >
                      {isActive ? "HIRED" : "FIRED"}
                    </span>
                    <span className="text-firma-text text-sm font-semibold">
                      {role} Agent
                    </span>
                    <span className="text-firma-muted text-xs">({title})</span>
                  </div>
                  <div className="text-firma-muted text-xs whitespace-nowrap shrink-0">
                    {formatDate(agent.hiredAt)}
                  </div>
                </div>

                {/* Agent details */}
                <div className="bg-firma-bg border border-firma-border rounded-lg p-3 mb-2">
                  <div className="text-firma-muted text-xs uppercase tracking-wide mb-1">
                    Agent #{agent.agentId}
                  </div>
                  <div className="text-firma-text text-sm">
                    {isActive
                      ? `${role} agent is active with on-chain authority. Wallet: ${truncAddr(agent.wallet)}`
                      : `${role} agent has been fired. Operating in observation mode only.`
                    }
                  </div>
                </div>

                {/* Wallet link */}
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-firma-muted font-mono">
                    {truncAddr(agent.wallet)}
                  </span>
                  <a
                    href={`https://www.okx.com/web3/explorer/xlayer/address/${agent.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-firma-accent hover:text-firma-accent-soft text-xs font-medium transition-colors"
                  >
                    Verify &rarr;
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contract link */}
      <div className="mt-2 pt-4 border-t border-firma-border/50">
        <a
          href={`https://www.okx.com/web3/explorer/xlayer/address/${FIRMA_COMPANY_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-firma-accent hover:text-firma-accent-soft text-xs font-medium transition-colors"
        >
          View full governance log on Explorer &rarr;
        </a>
      </div>
    </div>
  );
}
