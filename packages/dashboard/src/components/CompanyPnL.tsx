import { useAgents } from "../hooks/useContract";
import { useContractEvents } from "../hooks/useContractEvents";

interface Metric {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  trendValue: string;
}

function TrendIndicator({
  trend,
  trendValue,
}: {
  trend: Metric["trend"];
  trendValue: string;
}) {
  const color =
    trend === "up"
      ? "text-firma-green"
      : trend === "down"
        ? "text-firma-red"
        : "text-firma-muted";

  const arrow =
    trend === "up" ? "\u25B2" : trend === "down" ? "\u25BC" : "\u2014";

  return (
    <span className={`text-xs font-medium ${color} flex items-center gap-1`}>
      <span className="text-[10px]">{arrow}</span>
      {trendValue}
    </span>
  );
}

export default function CompanyPnL() {
  const { agents, loading } = useAgents();
  const { events } = useContractEvents();

  const activeCount = agents.filter((a) => a.active).length;
  const totalCount = agents.length;
  const hireEvents = events.filter((e) => e.type === "AgentHired").length;
  const registrationEvents = events.filter(
    (e) => e.type === "AgentRegistered",
  ).length;

  // Derive on-chain metrics
  const heroes = [
    {
      label: "Agents Active",
      value: loading ? "..." : `${activeCount}/${totalCount}`,
      trend: activeCount === totalCount ? ("up" as const) : ("down" as const),
      trendValue:
        activeCount === totalCount ? "All operational" : `${totalCount - activeCount} fired`,
      gradient: "from-firma-green/10 to-transparent",
      source: "on-chain",
    },
    {
      label: "On-Chain Events",
      value: loading ? "..." : `${events.length}`,
      trend: events.length > 0 ? ("up" as const) : ("flat" as const),
      trendValue: `${hireEvents} hires · ${registrationEvents} regs`,
      gradient: "from-firma-accent/10 to-transparent",
      source: "on-chain",
    },
    {
      label: "Treasury Status",
      value: loading ? "..." : "Active",
      trend: "up" as const,
      trendValue: "Autonomous",
      gradient: "from-amber-500/10 to-transparent",
      source: "on-chain",
    },
    {
      label: "Chain",
      value: "X Layer",
      trend: "up" as const,
      trendValue: "ID 196",
      gradient: "from-purple-500/8 to-transparent",
      source: "verified",
    },
  ];

  const secondary: Metric[] = [
    {
      label: "Registrations",
      value: registrationEvents.toString(),
      trend: "up",
      trendValue: "on-chain",
    },
    {
      label: "Governance Actions",
      value: hireEvents.toString(),
      trend: "up",
      trendValue: "verified",
    },
    {
      label: "Contract",
      value: "0x1666...5722",
      trend: "flat",
      trendValue: "mainnet",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {heroes.map((m) => (
          <div
            key={m.label}
            className={`relative overflow-hidden bg-gradient-to-br ${m.gradient} bg-firma-card border border-firma-border rounded-2xl p-6 hover-lift`}
          >
            <div className="flex items-start justify-between mb-4">
              <span className="text-firma-muted text-sm font-medium tracking-wide">
                {m.label}
              </span>
              <TrendIndicator trend={m.trend} trendValue={m.trendValue} />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-firma-text-bright text-3xl font-bold tracking-tight">
                {m.value}
              </span>
              <span className="text-[9px] text-firma-muted-dark uppercase tracking-wider font-medium bg-firma-bg/50 rounded px-1.5 py-0.5">
                {m.source}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary metrics as compact pills */}
      <div className="flex flex-wrap gap-4">
        {secondary.map((m) => (
          <div
            key={m.label}
            className="flex items-center gap-4 bg-firma-card border border-firma-border rounded-xl px-5 py-3"
          >
            <span className="text-firma-muted text-sm">{m.label}</span>
            <span className="text-firma-text-bright text-lg font-bold">
              {m.value}
            </span>
            <TrendIndicator trend={m.trend} trendValue={m.trendValue} />
          </div>
        ))}
      </div>
    </div>
  );
}
