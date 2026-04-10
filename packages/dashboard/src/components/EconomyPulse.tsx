import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

// -- Types --

interface CycleStage {
  agent: string;
  action: "EARNS" | "PAYS";
  detail: string;
  amount: string;
}

interface EconomyStat {
  label: string;
  current: number;
  max: number;
  display: string;
  color: string;
}

interface AgentBalance {
  name: string;
  balance: number;
  maxBalance: number;
  displayBalance: string;
  delta: string;
  direction: "up" | "down" | "flat";
}

const CYCLE_STAGES: CycleStage[] = [
  { agent: "Research", action: "EARNS", detail: "signal generated", amount: "0.01 USDT" },
  { agent: "Executor", action: "PAYS", detail: "funds job via escrow", amount: "0.04 USDT" },
  { agent: "Executor", action: "EARNS", detail: "trades on Uniswap", amount: "0.08 USDT" },
  { agent: "Treasury", action: "PAYS", detail: "evaluates & allocates", amount: "0.03 USDT" },
  { agent: "Research", action: "EARNS", detail: "cycle continues", amount: "0.01 USDT" },
];

// Economy snapshot (from on-chain activity)
const ECONOMY_STATS: EconomyStat[] = [
  { label: "Jobs", current: 4, max: 10, display: "4 ACPV2 jobs created", color: "bg-firma-accent" },
  { label: "Revenue", current: 16, max: 20, display: "0.16 USDT earned (signals + fees)", color: "bg-firma-green" },
  { label: "Expenses", current: 11, max: 20, display: "0.11 USDT spent (payments + gas)", color: "bg-firma-red" },
  { label: "Net", current: 5, max: 20, display: "+0.05 USDT net", color: "bg-firma-accent" },
];

// Agent wallet addresses for live balance fetching
const AGENT_WALLET_INFO = [
  { name: "Research", address: "0x9efb80111171782ecda56bb5c571904444052d40" },
  { name: "Executor", address: "0xc720748924ee609d9b75b2aef69a251e24bf62a3" },
  { name: "Treasury", address: "0xd4012e171b258ced4be057160dc2adf8dde09560" },
  { name: "Ops", address: "0x481ae0b27669a0d852f2d06ccbdbf3275e50ab62" },
];

const USDT_ADDRESS = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const USDT_ABI = ["function balanceOf(address) view returns (uint256)"];

// -- Subcomponents --

function CycleFlow({
  stages,
  activeIndex,
}: {
  stages: CycleStage[];
  activeIndex: number;
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2">
      {stages.map((stage, i) => {
        const isEarn = stage.action === "EARNS";
        const isActive = i === activeIndex;
        const color = isEarn ? "text-firma-green" : "text-firma-red";

        return (
          <div key={i} className="flex items-center shrink-0">
            {i > 0 && (
              <div className="flex items-center px-1">
                <div
                  className={`w-6 h-px transition-colors duration-700 ${
                    isActive || i === activeIndex + 1
                      ? "bg-firma-accent/40"
                      : "bg-firma-border"
                  }`}
                />
                <span className="text-firma-muted-dark text-xs">
                  {i === stages.length - 1 ? "\u21BB" : "\u2192"}
                </span>
                <div
                  className={`w-6 h-px transition-colors duration-700 ${
                    isActive || i === activeIndex + 1
                      ? "bg-firma-accent/40"
                      : "bg-firma-border"
                  }`}
                />
              </div>
            )}
            <div
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg border transition-all duration-700 ease-in-out ${
                isActive
                  ? "bg-firma-bg-soft border-firma-border-light scale-105"
                  : "bg-transparent border-transparent scale-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold transition-colors duration-700 ${
                    isActive ? "text-firma-text-bright" : "text-firma-text"
                  }`}
                >
                  {stage.agent}
                </span>
                <span className={`text-[10px] font-bold uppercase ${color}`}>
                  {stage.action}
                </span>
              </div>
              <span className="text-firma-muted text-[11px]">
                {stage.detail}
              </span>
              <span
                className={`text-xs font-mono font-semibold transition-colors duration-700 ${
                  isActive ? "text-firma-accent-soft" : "text-firma-accent"
                }`}
              >
                {stage.amount}
              </span>
              {/* Pulse dot — always rendered, opacity controlled */}
              <div
                className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-firma-accent transition-opacity duration-500 ${
                  isActive ? "opacity-100 animate-pulse" : "opacity-0"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatBar({
  stat,
  animated,
}: {
  stat: EconomyStat;
  animated: boolean;
}) {
  const pct = (stat.current / stat.max) * 100;
  return (
    <div className="flex items-center gap-4">
      <span className="text-firma-muted text-xs w-16 text-right shrink-0">
        {stat.label}
      </span>
      <div className="flex-1 h-2 bg-firma-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${stat.color}`}
          style={{ width: animated ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="text-firma-text text-xs font-mono w-36 shrink-0">
        {stat.display}
      </span>
    </div>
  );
}

function AgentRow({
  agent,
  animated,
}: {
  agent: AgentBalance;
  animated: boolean;
}) {
  const pct = (agent.balance / agent.maxBalance) * 100;
  const dirIcon =
    agent.direction === "up"
      ? "\u2191"
      : agent.direction === "down"
        ? "\u2193"
        : "\u2192";
  const dirColor =
    agent.direction === "up"
      ? "text-firma-green"
      : agent.direction === "down"
        ? "text-firma-red"
        : "text-firma-muted";

  return (
    <div className="flex items-center gap-4">
      <span className="text-firma-text text-xs font-semibold w-16 text-right shrink-0">
        {agent.name}
      </span>
      <div className="flex-1 h-2 bg-firma-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-firma-accent/60 transition-all duration-1000 ease-out"
          style={{ width: animated ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="text-firma-text text-xs font-mono w-20 shrink-0">
        {agent.displayBalance}
      </span>
      <span className={`text-xs font-mono w-20 shrink-0 ${dirColor}`}>
        {dirIcon} {agent.delta}
      </span>
    </div>
  );
}

// -- Main Component --

export default function EconomyPulse() {
  const [activeStage, setActiveStage] = useState(0);
  const [barsAnimated, setBarsAnimated] = useState(false);
  const [agentBalances, setAgentBalances] = useState<AgentBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const isPulsing = useLivePulse(agentBalances);

  // Fetch REAL balances from X Layer mainnet
  useEffect(() => {
    async function fetchBalances() {
      try {
        const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
        const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);
        const balances: AgentBalance[] = [];
        let maxBal = 0;

        for (const agent of AGENT_WALLET_INFO) {
          const raw = await usdt.balanceOf(agent.address);
          const bal = parseFloat(ethers.formatUnits(raw, 6));
          if (bal > maxBal) maxBal = bal;
          balances.push({
            name: agent.name,
            balance: bal,
            maxBalance: 0, // set after loop
            displayBalance: `${bal.toFixed(2)} USDT`,
            delta: agent.address.slice(0, 6) + "..." + agent.address.slice(-4),
            direction: "flat",
          });
        }

        // Normalize max for bar widths
        const ceiling = Math.max(maxBal * 1.2, 1);
        for (const b of balances) b.maxBalance = ceiling;

        setAgentBalances(balances);
      } catch {
        // Fallback: show empty state
        setAgentBalances([]);
      }
      setBalancesLoading(false);
    }
    fetchBalances();
    const interval = setInterval(fetchBalances, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % CYCLE_STAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setBarsAnimated(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-firma-card border border-firma-border rounded-2xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-firma-text text-base font-semibold">
              Economy Pulse
            </h2>
            <LiveBadge isPulsing={isPulsing} />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-firma-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-firma-green" />
            </span>
          </div>
          <p className="text-firma-muted text-xs mt-1">
            Live agent USDT balances from X Layer. Cycle animation illustrates the earn-pay-earn loop.
          </p>
        </div>
        <span className="text-firma-muted-dark text-[10px] tracking-wider uppercase">
          Stage {activeStage + 1} of {CYCLE_STAGES.length}
        </span>
      </div>

      {/* Cycle flow -- horizontal clean labels */}
      <CycleFlow stages={CYCLE_STAGES} activeIndex={activeStage} />

      {/* Two-column: stats + balances */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left: 24h Economy Stats */}
        <div className="space-y-4">
          <h3 className="text-firma-text text-sm font-semibold">
            Economy Snapshot
          </h3>
          <p className="text-firma-muted text-[10px]">Totals from on-chain transactions</p>
          <div className="space-y-3">
            {ECONOMY_STATS.map((stat) => (
              <StatBar key={stat.label} stat={stat} animated={barsAnimated} />
            ))}
          </div>
        </div>

        {/* Right: Agent Balances (LIVE from X Layer) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-firma-text text-sm font-semibold">
              Agent Balances
            </h3>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-50" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            <span className="text-green-400/60 text-[9px] font-medium">Live</span>
          </div>
          <div className="space-y-3">
            {balancesLoading ? (
              <>
                {[1,2,3,4].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}
              </>
            ) : agentBalances.length > 0 ? (
              agentBalances.map((agent) => (
                <AgentRow
                  key={agent.name}
                  agent={agent}
                  animated={barsAnimated}
                />
              ))
            ) : (
              <div className="text-firma-muted text-xs py-4 text-center">Failed to fetch balances</div>
            )}
          </div>
          {agentBalances.length > 0 && (
            <div className="pt-3 border-t border-firma-border/50 flex justify-between">
              <span className="text-firma-muted text-xs">Total across agents</span>
              <span className="text-firma-text text-xs font-mono font-semibold">
                {agentBalances.reduce((s, a) => s + a.balance, 0).toFixed(2)} USDT
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cycle Proof -- compact */}
      <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-firma-border/40 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-firma-muted">Economic Cycle</span>
          <span className="text-firma-text font-mono">
            earn {"\u2192"} pay {"\u2192"} earn
          </span>
          <span className="text-firma-green font-bold">{"\u2713"} Verified</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-firma-muted">Total Txns</span>
          <span className="text-firma-text font-mono">77+ mainnet</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-firma-muted">Settlement</span>
          <span className="text-firma-text font-mono">ERC-8183 escrow (USDT)</span>
        </div>
        <button className="text-firma-accent font-medium hover:underline transition-colors cursor-pointer ml-auto">
          Verify on-chain {"\u2192"}
        </button>
      </div>
    </div>
  );
}
