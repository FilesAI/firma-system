import { useAgents } from "../hooks/useContract";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

const ROLE_TITLES: Record<string, string> = {
  Research: "Analyst",
  Executor: "Trader",
  Treasury: "CFO",
  Ops: "Manager",
};

export default function HeartbeatStatus() {
  const { agents, loading } = useAgents();
  const isPulsing = useLivePulse(agents);

  if (loading) {
    return (
      <div className="bg-firma-card border border-firma-border rounded-2xl p-6">
        <div className="text-firma-muted text-sm animate-pulse text-center py-4">
          Loading agent heartbeats...
        </div>
      </div>
    );
  }

  const activeCount = agents.filter((a) => a.active).length;

  return (
    <div className="bg-firma-card border border-firma-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-firma-text text-base font-semibold">
            Agent Heartbeat
          </h2>
          <LiveBadge isPulsing={isPulsing} />
          <span className="text-firma-muted-dark text-xs">
            {activeCount}/{agents.length} active
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-firma-green font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-firma-green animate-pulse" />
          On-Chain
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {agents.map((agent) => {
          const isActive = agent.active;
          const role = agent.roleName;
          const title = ROLE_TITLES[role] || role;

          return (
            <div
              key={agent.agentId}
              className={`flex items-center gap-4 ${
                isActive ? "bg-firma-green/10" : "bg-firma-red/10"
              } border border-firma-border rounded-xl px-5 py-4 transition-all duration-200`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isActive ? "bg-firma-green animate-pulse-slow" : "bg-firma-red"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-firma-text text-sm font-semibold">
                    {role}
                  </span>
                  <span className="text-firma-muted-dark text-xs">
                    {title}
                  </span>
                </div>
                <span className="text-firma-muted text-xs font-mono">
                  {agent.wallet.slice(0, 6)}...{agent.wallet.slice(-4)}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  isActive
                    ? "bg-firma-green/15 text-firma-green"
                    : "bg-firma-red/15 text-firma-red"
                }`}
              >
                {isActive ? "Active" : "Fired"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
