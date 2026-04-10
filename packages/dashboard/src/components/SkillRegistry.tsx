import { useState, useEffect } from "react";

type SkillStatus = "active" | "stub" | "offline";

interface Skill {
  id: string;
  name: string;
  protocol: string;
  version: string;
  status: SkillStatus;
  category: string;
  risk: string;
  successRate: number | null;
  executions: number;
  revenue: string | null;
}

const SKILLS: Skill[] = [
  { id: "1", name: "Uniswap V3 Swap", protocol: "Uniswap", version: "v3.2.1", status: "active", category: "Swap", risk: "Low", successRate: 92, executions: 42, revenue: "0.84" },
  { id: "2", name: "OKX DEX Aggregator", protocol: "OKX", version: "v1.0.4", status: "active", category: "Aggregator", risk: "Low", successRate: 88, executions: 18, revenue: "0.36" },
  { id: "3", name: "Lending Rate Scanner", protocol: "OKX DeFi", version: "v0.2.0", status: "active", category: "Lend", risk: "Medium", successRate: null, executions: 5, revenue: null },
  { id: "4", name: "Yield Farm Discovery", protocol: "Uniswap V3", version: "v0.2.0", status: "active", category: "Yield", risk: "High", successRate: null, executions: 3, revenue: null },
  { id: "5", name: "Cross-Chain Bridge", protocol: "OKX Bridge", version: "v0.2.0", status: "active", category: "Bridge", risk: "High", successRate: null, executions: 2, revenue: null },
];

function StatusDot({ status }: { status: SkillStatus }) {
  const colors = { active: "bg-green-400", stub: "bg-amber-400", offline: "bg-red-400" };
  return (
    <span className={`w-1.5 h-1.5 rounded-full ${colors[status]} ${status === "active" ? "animate-pulse" : ""}`} />
  );
}

function SkillRow({ skill, animated }: { skill: Skill; animated: boolean }) {
  const isActive = skill.status === "active";
  const barColor = (skill.successRate || 0) >= 90 ? "bg-green-400" : (skill.successRate || 0) >= 70 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-white/[0.03] last:border-0 group hover:bg-white/[0.01] -mx-5 px-5 transition-colors">
      {/* Status + Name */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <StatusDot status={skill.status} />
        <div className="min-w-0">
          <div className="text-white/80 text-sm font-medium truncate">{skill.name}</div>
          <div className="text-white/20 text-[11px]">{skill.protocol} &middot; {skill.version}</div>
        </div>
      </div>

      {/* Category */}
      <span className="hidden sm:block text-white/25 text-[10px] font-medium uppercase tracking-wider w-20">{skill.category}</span>

      {/* Success Rate */}
      <div className="w-24 hidden md:block">
        {isActive && skill.successRate !== null ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: animated ? `${skill.successRate}%` : "0%" }} />
            </div>
            <span className="text-white/40 text-[11px] font-mono w-8 text-right">{skill.successRate}%</span>
          </div>
        ) : isActive ? (
          <span className="text-indigo-400/50 text-[10px]">Discovery</span>
        ) : (
          <span className="text-white/15 text-[11px]">--</span>
        )}
      </div>

      {/* Executions */}
      <span className={`w-10 text-right font-mono text-[12px] ${isActive ? "text-white/50" : "text-white/15"}`}>
        {skill.executions || "--"}
      </span>

      {/* Revenue */}
      <span className={`w-16 text-right font-mono text-[12px] ${isActive ? "text-green-400/70" : "text-white/15"}`}>
        {skill.revenue ? `${skill.revenue}` : "--"}
      </span>
    </div>
  );
}

export default function SkillRegistry() {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 200); }, []);

  const active = SKILLS.filter(s => s.status === "active").length;
  const totalRev = SKILLS.reduce((s, k) => s + parseFloat(k.revenue || "0"), 0);

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm font-medium">Skills</span>
          <span className="text-white/15 text-[10px] font-mono">{active} active</span>
          <span className="text-indigo-400/30 text-[9px] uppercase tracking-wider">5 Active</span>
        </div>
        <span className="text-green-400/50 text-[11px] font-mono">{totalRev.toFixed(2)} USDT</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-4 py-2 border-b border-white/[0.04] -mx-5 px-5 mb-1">
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest flex-1">Name</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-20 hidden sm:block">Type</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-24 hidden md:block">Success</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-10 text-right">Runs</span>
        <span className="text-white/15 text-[9px] font-semibold uppercase tracking-widest w-16 text-right">Rev</span>
      </div>

      {/* Rows */}
      {SKILLS.map(skill => (
        <SkillRow key={skill.id} skill={skill} animated={animated} />
      ))}
    </div>
  );
}
