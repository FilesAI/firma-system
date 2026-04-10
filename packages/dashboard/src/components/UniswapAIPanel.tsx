import { useState, useEffect } from "react";

interface UniswapSkill {
  id: string;
  name: string;
  skillId: string;
  agent: string;
  usage: string;
  status: "active" | "standby";
}

const UNISWAP_SKILLS: UniswapSkill[] = [
  { id: "1", name: "Swap Integration", skillId: "uniswap-swap-integration", agent: "Executor", usage: "Execute swaps via Trading API", status: "active" },
  { id: "2", name: "Swap Planner", skillId: "uniswap-swap-planner", agent: "Executor", usage: "AI-optimized slippage & routing", status: "active" },
  { id: "3", name: "Liquidity Planner", skillId: "uniswap-liquidity-planner", agent: "Research", usage: "Concentrated liquidity depth analysis", status: "active" },
  { id: "4", name: "V4 SDK Integration", skillId: "uniswap-v4-sdk-integration", agent: "Research", usage: "Pool analysis via V4 SDK", status: "active" },
  { id: "5", name: "Viem Integration", skillId: "uniswap-viem-integration", agent: "Core", usage: "On-chain reads via viem", status: "active" },
  { id: "6", name: "Pay With Any Token", skillId: "uniswap-pay-with-any-token", agent: "Executor", usage: "Gas abstraction (pay fees in any token)", status: "active" },
];

interface FlowStep {
  agent: string;
  action: string;
  skill: string;
  detail: string;
}

const RESEARCH_FLOW: FlowStep[] = [
  { agent: "Research", action: "Pool Analysis", skill: "uniswap-driver", detail: "Liquidity depth, fee tier, IL estimate" },
  { agent: "Research", action: "Route Compare", skill: "uniswap-trading", detail: "Uniswap vs OKX DEX price comparison" },
  { agent: "Research", action: "Signal Enrich", skill: "analyzer", detail: "Confidence boost for deep liquidity pools" },
];

const EXECUTOR_FLOW: FlowStep[] = [
  { agent: "Executor", action: "Plan Swap", skill: "uniswap-trading", detail: "Dynamic slippage from pool depth + urgency" },
  { agent: "Executor", action: "Compare Routes", skill: "uniswap-trading", detail: "Pick best: Uniswap API vs OKX DEX" },
  { agent: "Executor", action: "Execute", skill: "okx-dex-swap", detail: "OKX aggregator first, Uniswap V3 fallback" },
];

function AgentBadge({ agent }: { agent: string }) {
  const colors: Record<string, string> = {
    Research: "text-cyan-400/80 bg-cyan-400/10 border-cyan-400/20",
    Executor: "text-orange-400/80 bg-orange-400/10 border-orange-400/20",
    Core: "text-purple-400/80 bg-purple-400/10 border-purple-400/20",
    Treasury: "text-green-400/80 bg-green-400/10 border-green-400/20",
  };
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colors[agent] || "text-white/40 bg-white/5 border-white/10"}`}>
      {agent}
    </span>
  );
}

export default function UniswapAIPanel() {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 300); }, []);

  const activeCount = UNISWAP_SKILLS.filter(s => s.status === "active").length;

  return (
    <div className="glass-card p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <span className="text-white text-[9px] font-bold">U</span>
          </div>
          <div>
            <div className="text-white/80 text-sm font-medium">Uniswap AI Skills</div>
            <div className="text-white/25 text-[11px]">6 skills integrated &middot; {activeCount} active</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute h-full w-full rounded-full bg-pink-400 opacity-50" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-pink-400" />
          </span>
          <span className="text-pink-400/70 text-[10px] font-medium">Integrated</span>
        </div>
      </div>

      {/* Skills Grid */}
      <div>
        <div className="text-white/15 text-[9px] font-semibold uppercase tracking-widest mb-2">Installed Skills</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {UNISWAP_SKILLS.map((skill, i) => (
            <div
              key={skill.id}
              className={`flex items-center gap-2.5 py-2 px-3 rounded-lg border transition-all duration-500 ${
                skill.status === "active"
                  ? "border-pink-400/10 bg-pink-400/[0.03]"
                  : "border-white/[0.03] bg-white/[0.01]"
              }`}
              style={{ opacity: animated ? 1 : 0, transform: animated ? "translateY(0)" : "translateY(8px)", transitionDelay: `${i * 40}ms` }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${skill.status === "active" ? "bg-green-400" : "bg-white/15"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-white/70 text-[12px] font-medium truncate">{skill.name}</div>
                <div className="text-white/20 text-[10px] truncate">{skill.usage}</div>
              </div>
              <AgentBadge agent={skill.agent} />
            </div>
          ))}
        </div>
      </div>

      {/* AI Execution Flows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Research Flow */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <AgentBadge agent="Research" />
            <span className="text-white/30 text-[10px]">Signal Enrichment Pipeline</span>
          </div>
          <div className="space-y-1">
            {RESEARCH_FLOW.map((step, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <div className="flex flex-col items-center mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
                  {i < RESEARCH_FLOW.length - 1 && <span className="w-px h-6 bg-cyan-400/15" />}
                </div>
                <div>
                  <div className="text-white/60 text-[11px] font-medium">{step.action} <span className="text-white/20 font-normal">({step.skill})</span></div>
                  <div className="text-white/20 text-[10px]">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Executor Flow */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <AgentBadge agent="Executor" />
            <span className="text-white/30 text-[10px]">Intelligent Swap Pipeline</span>
          </div>
          <div className="space-y-1">
            {EXECUTOR_FLOW.map((step, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <div className="flex flex-col items-center mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
                  {i < EXECUTOR_FLOW.length - 1 && <span className="w-px h-6 bg-orange-400/15" />}
                </div>
                <div>
                  <div className="text-white/60 text-[11px] font-medium">{step.action} <span className="text-white/20 font-normal">({step.skill})</span></div>
                  <div className="text-white/20 text-[10px]">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
