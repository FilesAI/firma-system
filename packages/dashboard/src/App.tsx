import { useState, useEffect } from "react";
import { useAgents, useReportCount } from "./hooks/useContract";
import { useContractEvents } from "./hooks/useContractEvents";
import OrgChart from "./components/OrgChart.tsx";
import ActiveJobs from "./components/ActiveJobs.tsx";
import PaymentFlow from "./components/PaymentFlow.tsx";
import TreasuryDecisions from "./components/TreasuryDecisions.tsx";
import TryIt from "./components/TryIt.tsx";
import CompanyTimeline from "./components/CompanyTimeline.tsx";
import BeTheTreasury from "./components/BeTheTreasury.tsx";
import EconomyPulse from "./components/EconomyPulse.tsx";
import SkillRegistry from "./components/SkillRegistry.tsx";
import AgentMarketplace from "./components/AgentMarketplace.tsx";
import OnChainFeed from "./components/OnChainFeed.tsx";
import MainnetEvidence from "./components/MainnetEvidence.tsx";
import UniswapAIPanel from "./components/UniswapAIPanel.tsx";
import OnchainOSSkills from "./components/OnchainOSSkills.tsx";

const CONFIG = { x402Endpoint: "http://localhost:3001" };

/* ── Types ── */
type TabId = "overview" | "activity" | "economy" | "explore";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "economy", label: "Economy" },
  { id: "explore", label: "Explore" },
];

/* ── Bento Stat Card ── */
function BentoStat({ value, label, sub, featured, large }: {
  value: string; label: string; sub?: string; featured?: boolean; large?: boolean;
}) {
  return (
    <div className={featured ? "stat-card-featured" : "stat-card"}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-3">{label}</div>
      <div className={`font-bold tracking-tight text-white/90 ${large ? "text-4xl lg:text-5xl" : "text-2xl lg:text-3xl"}`}>
        {value === "..." ? <span className="skeleton inline-block w-12 h-8" /> : value}
      </div>
      {sub && <div className="text-[11px] text-white/20 mt-2">{sub}</div>}
    </div>
  );
}

/* ── Section Header ── */
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-white/90 tracking-tight">{title}</h3>
      {sub && <p className="text-white/30 text-sm mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Tab Contents ── */
function OverviewTab({ agents, events, reportCount }: {
  agents: { active: boolean }[]; events: unknown[]; reportCount: number;
}) {
  const active = agents.filter((a) => a.active).length;
  const total = agents.length;

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 row-span-2 lg:col-span-2 lg:row-span-2">
          <div className="stat-card-featured h-full flex flex-col justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300/50 mb-4">Agents Active</div>
            <div>
              <div className="text-6xl lg:text-7xl font-bold tracking-tighter text-white/95">
                {total > 0 ? (
                  <>
                    <span className="text-gradient-accent">{active}</span>
                    <span className="text-white/20">/{total}</span>
                  </>
                ) : <span className="skeleton inline-block w-24 h-16" />}
              </div>
              <div className="text-white/25 text-sm mt-3">Autonomous agents on X Layer mainnet</div>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <span className={`relative flex h-2 w-2`}>
                  <span className={`animate-ping absolute h-full w-full rounded-full ${active === total ? "bg-green-400" : "bg-amber-400"} opacity-50`} />
                  <span className={`relative rounded-full h-2 w-2 ${active === total ? "bg-green-400" : "bg-amber-400"}`} />
                </span>
                <span className={`text-xs font-medium ${active === total ? "text-green-400/70" : "text-amber-400/70"}`}>
                  {active === total ? `${active} active` : `${active} active, ${total - active} fired`}
                </span>
              </div>
            )}
          </div>
        </div>

        <BentoStat label="On-Chain Events" value={events.length > 0 ? `${events.length}` : "..."} sub="Contract interactions" />
        <BentoStat label="Ops Reports" value={reportCount > 0 ? `${reportCount}` : "0"} sub="Anchored on-chain" />
        <BentoStat label="Network" value="X Layer" sub="Chain ID 196" />
        <BentoStat label="Transactions" value="77+" sub="Verified on mainnet" />
      </div>

      {/* Agent Team */}
      <section>
        <SectionHead title="Agent Team" sub="TEE-based wallets, on-chain identity (ERC-8004)" />
        <OrgChart />
      </section>
    </div>
  );
}

function ActivityTab() {
  return (
    <div className="animate-fade-in-up space-y-8">
      <section>
        <SectionHead title="On-Chain Feed" sub="[Reconstructed] Derived from contract state queries, not raw event logs" />
        <OnChainFeed />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section>
          <SectionHead title="Governance Simulator" sub="[Live simulation] Same rule engine as the real Treasury Agent" />
          <BeTheTreasury />
        </section>
        <section>
          <SectionHead title="Treasury Decisions" sub="[Live on-chain] Agent status from getAgent() via X Layer RPC" />
          <TreasuryDecisions />
        </section>
      </div>

      <section>
        <SectionHead title="Company Timeline" sub="[Reconstructed] Narrative derived from on-chain agent state" />
        <CompanyTimeline />
      </section>

      <section>
        <SectionHead title="On-Chain Verification" sub="[Verified] Explorer links to 77+ transactions on X Layer mainnet" />
        <MainnetEvidence />
      </section>
    </div>
  );
}

function EconomyTab() {
  return (
    <div className="animate-fade-in-up space-y-8">
      <section>
        <SectionHead title="Economy Pulse" sub="[Live on-chain] Agent wallet balances via eth_getBalance" />
        <EconomyPulse />
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section>
          <SectionHead title="ACPV2 Jobs" sub="[Live on-chain] Job queries via getJob() on ERC-8183 contract" />
          <ActiveJobs />
        </section>
        <section>
          <SectionHead title="Payment Flows" sub="[Live on-chain] USDT Transfer events between agent wallets" />
          <PaymentFlow />
        </section>
      </div>
    </div>
  );
}

function ExploreTab() {
  return (
    <div className="animate-fade-in-up space-y-8">
      <section>
        <SectionHead title="Uniswap AI Integration" sub="6 Uniswap AI Skills — route optimization, liquidity analysis, dynamic slippage" />
        <UniswapAIPanel />
      </section>
      <section>
        <SectionHead title="Onchain OS Skills" sub="14 onchainos CLI skill wrappers — 11 active in agent loops" />
        <OnchainOSSkills />
      </section>
      <section>
        <SectionHead title="DeFi Skill Registry" sub="5 DeFi skills — 2 full execution, 3 discovery-only" />
        <SkillRegistry />
      </section>
      <section>
        <SectionHead title="Agent Marketplace" sub="Agent hiring ecosystem (design preview)" />
        <AgentMarketplace />
      </section>
      <section>
        <SectionHead title="Try x402 Signal" sub="[Local only] Requires Research Agent running locally — shows example signal when offline" />
        <div className="max-w-2xl">
          <TryIt endpoint={CONFIG.x402Endpoint} />
        </div>
      </section>
    </div>
  );
}

/* ── App Shell ── */
export default function App() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { agents } = useAgents();
  const reportCount = useReportCount();
  const { events } = useContractEvents();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tabContent = (() => {
    switch (activeTab) {
      case "overview": return <OverviewTab agents={agents} events={events} reportCount={reportCount} />;
      case "activity": return <ActivityTab />;
      case "economy": return <EconomyTab />;
      case "explore": return <ExploreTab />;
    }
  })();

  return (
    <div className="min-h-screen bg-[#07070d]">

      {/* ─── Header ─── */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#07070d]/80 backdrop-blur-2xl border-b border-white/[0.04] shadow-2xl shadow-black/20"
          : "bg-transparent border-b border-transparent"
      }`}>
        <div className="section-container px-5 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white text-[10px] font-bold">F</span>
            </div>
            <span className="text-sm font-semibold text-white/80 tracking-tight">Firma</span>
            <span className="hidden sm:block text-white/15 text-xs font-light ml-1">Autonomous AI Company</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-white/20 border border-white/[0.06] rounded-md px-2 py-1">
              X Layer
            </span>
            <span className={`flex items-center gap-1.5 text-[10px] font-medium ${agents.length > 0 ? "text-green-400/80" : "text-white/20"}`}>
              <span className="relative flex h-1.5 w-1.5">
                {agents.length > 0 && <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-50" />}
                <span className={`relative rounded-full h-1.5 w-1.5 ${agents.length > 0 ? "bg-green-400" : "bg-white/20"}`} />
              </span>
              {agents.length > 0 ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative section-container px-5 lg:px-8 pt-16 pb-10 lg:pt-20 lg:pb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-white/95 tracking-tight leading-[1.1] mb-3">
            4 AI Agents.{" "}
            <span className="text-gradient-accent">Real Money.</span>
            <br className="hidden sm:block" />
            {" "}On-Chain Governed.
          </h1>
          <p className="text-white/30 text-sm lg:text-[15px] max-w-md leading-relaxed">
            Autonomous company where agents earn, spend, hire, and fire each other — governed on X Layer mainnet.
          </p>
        </div>
      </section>

      {/* ─── Tabs ─── */}
      <nav className="sticky top-12 z-40 bg-[#07070d]/85 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="section-container px-5 lg:px-8 flex" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-10 px-4 text-[13px] font-medium transition-colors duration-200 ${
                  isActive ? "text-white/90" : "text-white/25 hover:text-white/45"
                }`}
              >
                {tab.label}
                {isActive && <span className="tab-active-line" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── Content ─── */}
      <main className="section-container px-5 lg:px-8 py-8">
        {tabContent}
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.03]">
        <div className="section-container px-5 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="text-white/20 text-xs">Firma &middot; AI Agent Company on X Layer</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["x402", "ERC-8183", "ERC-8004", "Uniswap V3", "Uniswap AI", "Onchain OS", "LLM Brain"].map((t) => (
              <span key={t} className="text-[9px] text-white/15 border border-white/[0.04] rounded px-2 py-0.5">{t}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
