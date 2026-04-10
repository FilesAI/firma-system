import { useAgents, useReportCount, FIRMA_COMPANY_ADDRESS } from "../hooks/useContract";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

const HR_COLORS: Record<string, string> = {
  ACTIVE: "text-firma-green",
  FIRED: "text-firma-red",
};

const HR_DOT_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500",
  FIRED: "bg-red-500",
};

const HR_BG_COLORS: Record<string, string> = {
  ACTIVE: "bg-firma-green/8",
  FIRED: "bg-firma-red/8",
};

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function OpsReport() {
  const { agents, loading } = useAgents();
  const reportCount = useReportCount();
  const isPulsing = useLivePulse(agents);

  const activeCount = agents.filter((a) => a.active).length;
  const firedCount = agents.filter((a) => !a.active && a.registered).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-firma-muted text-sm animate-pulse">
          Loading operations data from X Layer...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Report meta */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-firma-accent text-sm font-mono font-semibold bg-firma-accent/10 px-3 py-1.5 rounded-lg">
          Ops Report · Live
        </span>
        <LiveBadge isPulsing={isPulsing} />
        <span className="text-firma-muted text-sm">
          {agents.length} agents registered &middot; {reportCount} reports anchored
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-firma-green font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-firma-green animate-pulse" />
          On-Chain
        </span>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agent Overview */}
        <div className="bg-firma-card border border-firma-border rounded-2xl p-6 hover-lift">
          <h3 className="text-firma-muted text-xs uppercase tracking-wider font-medium mb-6">
            Agent Roster
          </h3>
          <div className="space-y-6">
            <div>
              <div className="text-firma-muted text-xs mb-1">Total Agents</div>
              <div className="text-firma-text-bright text-2xl font-bold">
                {agents.length}
              </div>
            </div>
            <div>
              <div className="text-firma-muted text-xs mb-1">Active</div>
              <div className="text-firma-green text-2xl font-bold">
                {activeCount}
              </div>
            </div>
            <div className="pt-4 border-t border-firma-border/50">
              <div className="text-firma-muted text-xs mb-1">Fired</div>
              <div className={`text-2xl font-bold ${firedCount > 0 ? "text-firma-red" : "text-firma-muted-dark"}`}>
                {firedCount}
              </div>
            </div>
          </div>
        </div>

        {/* Roles & Wallets */}
        <div className="bg-firma-card border border-firma-border rounded-2xl p-6 hover-lift">
          <h3 className="text-firma-muted text-xs uppercase tracking-wider font-medium mb-6">
            Role Distribution
          </h3>
          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.agentId} className="flex items-center justify-between">
                <div>
                  <div className="text-firma-text text-sm font-medium">{agent.roleName}</div>
                  <div className="text-firma-muted text-xs font-mono">{truncAddr(agent.wallet)}</div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    agent.active
                      ? "bg-firma-green/12 text-firma-green"
                      : "bg-firma-red/12 text-firma-red"
                  }`}
                >
                  {agent.active ? "active" : "fired"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* HR Decisions (current state) */}
        <div className="bg-firma-card border border-firma-border rounded-2xl p-6 hover-lift">
          <h3 className="text-firma-muted text-xs uppercase tracking-wider font-medium mb-6">
            HR Status
          </h3>
          <div className="space-y-3">
            {agents.map((agent) => {
              const status = agent.active ? "ACTIVE" : "FIRED";
              return (
                <div
                  key={agent.agentId}
                  className={`flex items-center gap-3 ${HR_BG_COLORS[status]} rounded-xl px-4 py-3`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${HR_DOT_COLORS[status]} shrink-0`}
                  />
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${HR_COLORS[status]}`}
                  >
                    {status}
                  </span>
                  <span className="text-firma-text text-sm flex-1">
                    {agent.roleName} (#{agent.agentId})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* On-Chain Verification */}
      <div className="bg-firma-card border border-firma-border rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-firma-muted text-xs">Contract</span>
            <span className="text-firma-accent text-xs font-mono">
              {truncAddr(FIRMA_COMPANY_ADDRESS)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-firma-muted text-xs">Reports Anchored</span>
            <span className="text-firma-text-bright text-xs font-mono font-bold">
              {reportCount}
            </span>
          </div>
          <a
            href={`https://www.okx.com/web3/explorer/xlayer/address/${FIRMA_COMPANY_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-firma-accent hover:text-firma-accent-soft text-xs font-medium transition-colors"
          >
            Verify on Explorer &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
