import { useState } from "react";

/* ── TX Data ── */
const EXPLORER = "https://www.okx.com/web3/explorer/xlayer/tx/";

interface TxEntry {
  desc: string;
  hash?: string;
}

interface TxCategory {
  title: string;
  count: string;
  color: string;
  dot: string;
  txs: TxEntry[];
}

const CATEGORIES: TxCategory[] = [
  {
    title: "Contract Deployment",
    count: "1 tx",
    color: "text-purple-400/80",
    dot: "bg-purple-400",
    txs: [
      { desc: "FirmaCompany deployed via CREATE2 factory", hash: "0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722" },
    ],
  },
  {
    title: "Agent Registration & Hiring",
    count: "8 txs",
    color: "text-indigo-400/80",
    dot: "bg-indigo-400",
    txs: [
      { desc: "Research Agent #1 — registerAgent() + hireAgent()" },
      { desc: "Executor Agent #2 — registerAgent() + hireAgent()" },
      { desc: "Treasury Agent #3 — registerAgent() + hireAgent()" },
      { desc: "Ops Agent #4 — registerAgent() + hireAgent()" },
    ],
  },
  {
    title: "Governance Actions",
    count: "8 txs",
    color: "text-amber-400/80",
    dot: "bg-amber-400",
    txs: [
      { desc: "Performance Review — Research accuracy 68%", hash: "0xdc1ed7690962026b58d8d0fa07a4b2c23aa8b0e42ac276a245a19e2d5ec8d65d" },
      { desc: "Fire Agent — Research accuracy dropped to 38%", hash: "0x0cafc047061001361023940615ec089a8a6a751fe17f4fffd3d97c6dacaaf692" },
      { desc: "Rehire Agent — Research accuracy recovered to 72%", hash: "0xf8de9d724309d4cff8c2719a6be30244321e35ddd2d86a7b80b4791e032ae2b5" },
      { desc: "Signal Quality Audit — Sharpe ratio 1.4", hash: "0xdc1ed7690962026b58d8d0fa07a4b2c23aa8b0e42ac276a245a19e2d5ec8d65d" },
      { desc: "Execution Audit — slippage 0.3%, fill rate 98%", hash: "0xdd98127e82a25e888e5315acf20d53ca8ced4599c1a11528437a000689564979" },
      { desc: "Risk Assessment — exposure $18, risk LOW", hash: "0x445bb7382ecd1a1691d20d02a30be43bcf0d3ca61b573d3884de86193cca5dee" },
      { desc: "Ops Report Anchoring — 4 reports", hash: "0x3de9cb941ea3ea036d4f84efd67d952e4e4fcd336317e79b5f2348a05275b466" },
      { desc: "AI Decision: Keep Research #1 (accuracy 72%)", hash: "0x0dcd1d65a59d532dd0bf8b6be70d22b54e5534a094466d7e669eb92e11ff2065" },
    ],
  },
  {
    title: "ACPV2 Jobs (ERC-8183)",
    count: "4 jobs",
    color: "text-blue-400/80",
    dot: "bg-blue-400",
    txs: [
      { desc: "USDT Approval to ACPV2 escrow", hash: "0x4982abf6378962e090bc4532774d578edf7aadc6155417ae0d86f264b057f884" },
      { desc: "Job #1947 — Executor→Research: Signal analysis", hash: "0x5023ffd6549fc0e7c4cfea9af30f34036006cbbc019bb013d6d862f57d007d4c" },
      { desc: "Job #1948 — Executor→Research: Market data report", hash: "0xd54c5525fb40b61d948cd01e7412a0afb57a0946f1c2b492fa66878674a9985e" },
      { desc: "Job #1949 — Treasury→Research: Risk assessment", hash: "0x3b1faaecaea365e3677689c6eea16111c0e87c4470f842c3ad31adb24d90cd58" },
      { desc: "Job #1950 — Ops→Research: Agent monitoring", hash: "0x1732eb3b2eada6aa19286906bbb019c9142251b81583e48512547c9af57c09b8" },
    ],
  },
  {
    title: "Agent-to-Agent Payments",
    count: "5 txs",
    color: "text-green-400/80",
    dot: "bg-green-400",
    txs: [
      { desc: "Executor→Research 0.01 USDT — Signal access fee", hash: "0x630ffc8e4c1b696221fff74c3e819f659b70f0c1c41240c65b9c11576687ee09" },
      { desc: "Executor→Research 0.01 USDT — Signal purchase #2", hash: "0x28213f5e2fd2bd750ce39aab959d1866c0a3bf42846cc33fb39b0aa8f61dd90d" },
      { desc: "Main→Treasury 0.05 USDT — Budget distribution", hash: "0xba8529c481f1fe5ffccf55d9fe627d6a89c8051d786ed5e68d0c552ea61e7f32" },
      { desc: "Treasury→Ops 0.01 USDT — Report fee", hash: "0x3d76289099c17833d4809fe785ae4de4b0c357d2e3dd1f72df8c2d0ba49c2b6b" },
      { desc: "Executor→Treasury 0.05 USDT — Trade proceeds", hash: "0x44a904ae97769f9f48600c779e2b84dc048b80bfa4aa138107d9000d0905f279" },
    ],
  },
  {
    title: "Uniswap V3 Swaps",
    count: "3 txs",
    color: "text-cyan-400/80",
    dot: "bg-cyan-400",
    txs: [
      { desc: "USDT Approval to SwapRouter", hash: "0xc46121936e57bae2ce46eb4a88a9a74f0721fa106db7c2c038823e286189059a" },
      { desc: "Swap USDT→WOKB via exactInputSingle", hash: "0x6f413c4adab64b37f1643cf21cf852ad76b072b88ec141d435e9e911d5993549" },
      { desc: "Full-loop swap: 0.01 USDT→WOKB", hash: "0xcd4a2b4d3ecca2943ad730dda9d1d7eefc1ae52101482f96a027640c3b672288" },
    ],
  },
  {
    title: "Ops Report Anchoring",
    count: "5 txs",
    color: "text-indigo-400/80",
    dot: "bg-indigo-400",
    txs: [
      { desc: "Ops cycle #8 report anchored", hash: "0x8735ca2354bd8dd1aa8477ae8f6927c0dd38e64d5c8e59b56001e7b6e27843de" },
      { desc: "Full cycle report anchored", hash: "0x7fff2e9fe1749014d07878cb53654c2fa416f5c7d78cb6a677376ea23174e551" },
      { desc: "Research signal hash anchored", hash: "0x7bc086af0af9f915b8a7fb08dff85324b9c54f4f4bbfaa78ca5e6b8a9851cc75" },
      { desc: "AI LONG signal reasoning hash", hash: "0x646e748d39946e0034becad4721ca43fc63ad391908d1e1431a1c2f15726e394" },
      { desc: "Treasury evaluates trade outcome", hash: "0x08029f875943e41e38891223e6f6e93cbaf4e63acc48fb14186abb40cbb1ddc8" },
    ],
  },
  {
    title: "x402 Payment Setup",
    count: "2 txs",
    color: "text-rose-400/80",
    dot: "bg-rose-400",
    txs: [
      { desc: "Fund USDT — 0.10 USDT to x402 signer", hash: "0x394689bc2e191d7624973b34ae6056350f462492fb0c5893803caa551a72ad6c" },
      { desc: "Fund OKB — 0.001 OKB for gas", hash: "0x276b64580e266580467292e3321d4b670b23fc0309ad47893182f04eb18fdb55" },
    ],
  },
];

/* ── 7-Step Economic Loop ── */
const LOOP_STEPS = [
  { step: 1, label: "Signal anchored", hash: "0x7bc086af0af9f915b8a7fb08dff85324b9c54f4f4bbfaa78ca5e6b8a9851cc75" },
  { step: 2, label: "Signal purchased", hash: "0xeb81fa473da49eeb91a4d6db3dcb189d5f18a5debb491b151a1e31dc2a1506d0" },
  { step: 3, label: "USDT→WOKB swap", hash: "0xcd4a2b4d3ecca2943ad730dda9d1d7eefc1ae52101482f96a027640c3b672288" },
  { step: 4, label: "Trade evaluated", hash: "0x08029f875943e41e38891223e6f6e93cbaf4e63acc48fb14186abb40cbb1ddc8" },
  { step: 5, label: "Agent fired", hash: "0x0cafc047061001361023940615ec089a8a6a751fe17f4fffd3d97c6dacaaf692" },
  { step: 6, label: "Agent rehired", hash: "0xf8de9d724309d4cff8c2719a6be30244321e35ddd2d86a7b80b4791e032ae2b5" },
  { step: 7, label: "Cycle report", hash: "0x7fff2e9fe1749014d07878cb53654c2fa416f5c7d78cb6a677376ea23174e551" },
];

/* ── Helpers ── */
function truncHash(h: string) {
  return `${h.slice(0, 8)}...${h.slice(-6)}`;
}

/* ── Accordion Section ── */
function CategorySection({ cat }: { cat: TxCategory }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-firma-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className={`w-2 h-2 rounded-full ${cat.dot} shrink-0`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${cat.color} flex-1`}>
          {cat.title}
        </span>
        <span className="text-white/20 text-[10px] font-mono mr-2">{cat.count}</span>
        <svg
          className={`w-3.5 h-3.5 text-white/20 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-firma-border divide-y divide-white/[0.03]">
          {cat.txs.map((tx, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-[12px] leading-relaxed">{tx.desc}</p>
              </div>
              {tx.hash && (
                <a
                  href={
                    tx.hash.length === 42
                      ? `https://www.okx.com/web3/explorer/xlayer/address/${tx.hash}`
                      : `${EXPLORER}${tx.hash}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-white/15 hover:text-indigo-400/60 transition-colors font-mono shrink-0"
                >
                  {truncHash(tx.hash)}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function MainnetEvidence() {
  return (
    <div className="bg-firma-card border border-firma-border rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-firma-text text-lg font-semibold">77+ Verified Transactions</h2>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-firma-green font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-firma-green animate-pulse" />
          X Layer Mainnet
        </span>
      </div>
      <p className="text-firma-muted text-xs mb-5">
        All transactions on X Layer (Chain ID 196)
      </p>

      {/* 7-Step Economic Loop */}
      <div className="bg-firma-bg border border-firma-border rounded-lg p-4 mb-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-300/50 mb-3">
          Complete Economic Loop — 7 Steps Verified On-Chain
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {LOOP_STEPS.map((s, i) => (
            <div key={s.step} className="flex items-center gap-1">
              <a
                href={`${EXPLORER}${s.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300/80 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors"
              >
                <span className="text-indigo-400/50 text-[9px] font-bold">{s.step}</span>
                {s.label}
              </a>
              {i < LOOP_STEPS.length - 1 && (
                <svg className="w-3 h-3 text-white/10 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Category Accordion */}
      <div className="space-y-2">
        {CATEGORIES.map((cat) => (
          <CategorySection key={cat.title} cat={cat} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-firma-border/50 flex items-center justify-between">
        <span className="text-white/15 text-[10px] font-mono">
          {CATEGORIES.reduce((n, c) => n + c.txs.length, 0)} entries shown
        </span>
        <a
          href="https://www.okx.com/web3/explorer/xlayer/address/0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722"
          target="_blank"
          rel="noopener noreferrer"
          className="text-firma-accent hover:text-firma-accent-soft text-xs font-medium transition-colors"
        >
          View contract on Explorer &rarr;
        </a>
      </div>
    </div>
  );
}
