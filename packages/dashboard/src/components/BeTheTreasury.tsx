import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  evaluateAgent,
  evaluateSignal,
  type TreasuryDecision,
  type SignalEvaluation,
  type DecisionFactor,
} from "../lib/treasury-brain";

const XLAYER_RPC = "https://rpc.xlayer.tech";
const FIRMA_ADDRESS = "0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722";
const EXPLORER = "https://www.okx.com/web3/explorer/xlayer";

const ABI = [
  "function getAgent(uint256) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function isAgentActive(uint256) view returns (bool)",
  "function treasuryActive() view returns (bool)",
  "function getAgentCount() view returns (uint256)",
  "event AgentHired(uint256 indexed agentId, string reason)",
  "event AgentFired(uint256 indexed agentId, string reason)",
  "event AgentRehired(uint256 indexed agentId, string reason)",
  "event DecisionLogged(uint256 indexed agentId, string decisionType, string detail)",
];

interface LiveAgent {
  agentId: number;
  roleName: string;
  active: boolean;
  wallet: string;
  hiredAt: number;
}

interface GovernanceTx {
  type: string;
  agentId: number;
  reason: string;
  txHash: string;
  blockNumber: number;
}

type Phase = 1 | 2 | 3;

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ── Step Indicator ── */
function StepIndicator({ phase }: { phase: Phase }) {
  const steps = [
    { num: 1, label: "Signal Evaluation" },
    { num: 2, label: "Governance Decision" },
    { num: 3, label: "On-Chain Proof" },
  ];

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step.num === phase
                  ? "bg-firma-accent text-white"
                  : step.num < phase
                    ? "bg-green-500/20 text-firma-green"
                    : "bg-firma-bg text-firma-muted"
              }`}
            >
              {step.num < phase ? "\u2713" : step.num}
            </div>
            <span
              className={`text-xs font-medium truncate transition-colors ${
                step.num === phase ? "text-firma-text" : "text-firma-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px flex-1 min-w-4 transition-colors ${
                step.num < phase ? "bg-green-500/40" : "bg-firma-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Decision Factor Display ── */
function FactorList({ factors }: { factors: DecisionFactor[] }) {
  return (
    <div className="space-y-2">
      {factors.map((f) => (
        <div key={f.name} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              f.signal === "positive" ? "bg-firma-green" :
              f.signal === "negative" ? "bg-firma-red" : "bg-firma-yellow"
            }`} />
            <span className="text-firma-muted text-xs">{f.name}</span>
          </div>
          <span className={`text-xs font-medium ${
            f.signal === "positive" ? "text-firma-green" :
            f.signal === "negative" ? "text-firma-red" : "text-firma-yellow"
          }`}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── AI Reasoning Box ── */
function AIReasoningBox({ title, reasoning, hash, model, confidence }: {
  title: string;
  reasoning: string;
  hash: string;
  model: string;
  confidence: number;
}) {
  return (
    <div className="bg-firma-bg border border-firma-border rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-firma-accent text-[10px] font-semibold uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-firma-muted text-[10px]">{model}</span>
          <span className="text-firma-accent text-[10px] font-mono">{(confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-firma-text text-sm leading-relaxed mb-3">{reasoning}</p>
      <div className="flex items-center gap-2 pt-2 border-t border-firma-border">
        <span className="text-firma-muted text-[10px]">Reasoning Hash:</span>
        <code className="text-firma-accent text-[10px] font-mono">{hash.slice(0, 18)}...</code>
        <span className="text-firma-muted text-[9px]">(keccak256 — same hash anchored on-chain)</span>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function BeTheTreasury() {
  const [phase, setPhase] = useState<Phase>(1);
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [govTxs, setGovTxs] = useState<GovernanceTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<LiveAgent | null>(null);

  // AI decision state
  const [userSignalChoice, setUserSignalChoice] = useState<"complete" | "reject" | null>(null);
  const [aiSignalEval, setAiSignalEval] = useState<SignalEvaluation | null>(null);
  const [userGovChoice, setUserGovChoice] = useState<"fire" | "warn" | "keep" | null>(null);
  const [aiGovDecision, setAiGovDecision] = useState<TreasuryDecision | null>(null);

  // Simulated signal data (based on real pool observations)
  const signalData = {
    direction: "SHORT" as const,
    confidence: 0.74,
    actualPriceChange: -2.3,
    pool: "OKB/USDT",
    reason: "LP withdrawal 12% + large sell-side swap detected",
  };

  useEffect(() => {
    async function fetchLiveData() {
      try {
        const provider = new ethers.JsonRpcProvider(XLAYER_RPC);
        const contract = new ethers.Contract(FIRMA_ADDRESS, ABI, provider);

        const count = Number(await contract.getAgentCount());
        const agentList: LiveAgent[] = [];
        for (let i = 1; i <= count; i++) {
          const a = await contract.getAgent(i);
          agentList.push({
            agentId: Number(a.agentId),
            roleName: a.roleName,
            active: a.active,
            wallet: a.wallet,
            hiredAt: Number(a.hiredAt),
          });
        }
        setAgents(agentList);
        if (!selectedAgent && agentList.length > 0) {
          setSelectedAgent(agentList[0]);
        }

        // Fetch governance events
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);
        const eventTypes = ["AgentHired", "AgentFired", "AgentRehired", "DecisionLogged"];
        const allTxs: GovernanceTx[] = [];

        for (const eventName of eventTypes) {
          try {
            const filter = contract.filters[eventName]?.();
            if (!filter) continue;
            const logs = await contract.queryFilter(filter, fromBlock, currentBlock);
            for (const log of logs) {
              const parsed = contract.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });
              if (!parsed) continue;
              allTxs.push({
                type: eventName,
                agentId: Number(parsed.args[0]),
                reason: parsed.args[1] || "",
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            }
          } catch {
            // skip if filter fails
          }
        }

        allTxs.sort((a, b) => b.blockNumber - a.blockNumber);
        setGovTxs(allTxs);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }

    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30_000);
    return () => clearInterval(interval);
  }, []);

  function handleSignalChoice(choice: "complete" | "reject") {
    setUserSignalChoice(choice);
    // Run the REAL Treasury AI evaluation
    const evaluation = evaluateSignal(
      signalData.direction,
      signalData.actualPriceChange,
      signalData.confidence,
    );
    setAiSignalEval(evaluation);
  }

  function handleGovChoice(choice: "fire" | "warn" | "keep") {
    setUserGovChoice(choice);
    // Run the REAL Treasury AI governance decision
    if (selectedAgent) {
      const decision = evaluateAgent(
        {
          agentId: selectedAgent.agentId,
          roleName: selectedAgent.roleName,
          accuracy: 41,
          totalSignals: 15,
          profitableSignals: 6,
          recentTrend: "declining",
          currentBalance: "2.05 USDT",
        },
        3, // consecutive low cycles
        !selectedAgent.active,
      );
      setAiGovDecision(decision);
    }
  }

  function reset() {
    setPhase(1);
    setUserSignalChoice(null);
    setAiSignalEval(null);
    setUserGovChoice(null);
    setAiGovDecision(null);
  }

  // --- Phase 1: Signal Evaluation ---
  function renderPhase1() {
    if (loading) {
      return (
        <div className="text-firma-muted text-sm animate-pulse py-8 text-center">
          Reading agent status from X Layer...
        </div>
      );
    }

    return (
      <div>
        <h3 className="text-firma-text text-base font-semibold mb-2">
          Step 1: Evaluate a Trading Signal
        </h3>
        <p className="text-firma-muted text-xs mb-4">
          Select an agent and evaluate their signal. The Treasury AI will independently make the same decision.
        </p>

        {/* Agent selector */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {agents.map((agent) => (
            <button
              key={agent.agentId}
              onClick={() => setSelectedAgent(agent)}
              className={`text-left bg-firma-bg border rounded-lg p-3.5 transition-all ${
                selectedAgent?.agentId === agent.agentId
                  ? "border-firma-accent ring-1 ring-firma-accent/30"
                  : "border-firma-border hover:border-firma-muted"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-firma-text text-sm font-semibold">
                  {agent.roleName}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    agent.active
                      ? "bg-firma-green/15 text-firma-green"
                      : "bg-firma-red/15 text-firma-red"
                  }`}
                >
                  {agent.active ? "active" : "fired"}
                </span>
              </div>
              <code className="text-firma-muted text-xs font-mono">
                {truncAddr(agent.wallet)}
              </code>
            </button>
          ))}
        </div>

        {selectedAgent && (
          <>
            {/* Signal card */}
            <div className="bg-firma-bg border border-firma-border rounded-lg p-4 mb-4">
              <div className="text-firma-muted text-xs uppercase tracking-wide mb-3">
                Signal from {selectedAgent.roleName} Agent
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-firma-muted text-xs mb-1">Pool</div>
                  <div className="text-firma-text text-sm font-semibold">{signalData.pool}</div>
                </div>
                <div>
                  <div className="text-firma-muted text-xs mb-1">Direction</div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded bg-red-500/10 text-firma-red">
                    {signalData.direction} {"\u2193"}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-firma-muted text-xs mb-1">Confidence</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-firma-card rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${signalData.confidence * 100}%` }} />
                  </div>
                  <span className="text-firma-text text-sm font-bold w-10 text-right">
                    {(signalData.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div>
                <div className="text-firma-muted text-xs mb-1">Reason</div>
                <p className="text-firma-text text-sm">&ldquo;{signalData.reason}&rdquo;</p>
              </div>

              <div className="mt-3 pt-3 border-t border-firma-border">
                <div className="flex items-center justify-between">
                  <span className="text-firma-muted text-xs">Actual price change</span>
                  <span className="text-firma-green text-sm font-semibold">
                    {signalData.actualPriceChange}% (Signal was CORRECT)
                  </span>
                </div>
              </div>
            </div>

            {/* User choice */}
            {userSignalChoice === null && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleSignalChoice("complete")}
                  className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-firma-green font-medium px-6 py-3.5 rounded-lg w-full transition-colors text-sm"
                >
                  Complete Job &mdash; Release 0.01 USDT to {selectedAgent.roleName}
                </button>
                <button
                  onClick={() => handleSignalChoice("reject")}
                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-firma-red font-medium px-6 py-3.5 rounded-lg w-full transition-colors text-sm"
                >
                  Reject Job &mdash; Refund 0.01 USDT to Executor
                </button>
              </div>
            )}

            {/* AI evaluation result */}
            {aiSignalEval && (
              <>
                <div className={`border rounded-lg p-4 mt-4 text-sm ${
                  userSignalChoice === aiSignalEval.decision
                    ? "bg-green-500/10 border-green-500/30 text-firma-green"
                    : "bg-yellow-500/10 border-yellow-500/30 text-firma-yellow"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">
                      {userSignalChoice === aiSignalEval.decision ? "\u2705 Match!" : "\u274C Mismatch"}
                    </span>
                    <span className="text-xs opacity-70">
                      Treasury AI decided: <strong>{aiSignalEval.decision}</strong>
                    </span>
                  </div>
                  <FactorList factors={aiSignalEval.factors} />
                </div>

                <AIReasoningBox
                  title="Treasury AI Signal Evaluation"
                  reasoning={aiSignalEval.reasoning}
                  hash={aiSignalEval.reasoningHash}
                  model="rule-based-v1"
                  confidence={aiSignalEval.confidence}
                />

                <button
                  onClick={() => setPhase(2)}
                  className="bg-firma-accent hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg w-full transition-colors text-sm mt-4"
                >
                  Continue to Governance Decision &rarr;
                </button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // --- Phase 2: Governance Decision ---
  function renderPhase2() {
    return (
      <div>
        <h3 className="text-firma-text text-base font-semibold mb-2">
          Step 2: Make a Governance Decision
        </h3>
        <p className="text-firma-muted text-xs mb-4">
          {selectedAgent?.roleName || "Research"} accuracy dropped below threshold.
          The Treasury AI will evaluate the same data independently.
        </p>

        {/* Performance card */}
        <div className="bg-firma-bg border border-firma-border rounded-lg p-4 mb-4">
          <div className="text-firma-muted text-xs uppercase tracking-wide mb-3">
            {selectedAgent?.roleName || "Research"} Agent Performance Review
          </div>

          <div className="space-y-2 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-xs">Current Accuracy</span>
              <span className="text-firma-red text-sm font-bold">41%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-xs">Fire Threshold</span>
              <span className="text-firma-yellow text-sm font-bold">50%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-xs">Consecutive Low Cycles</span>
              <span className="text-firma-red text-sm font-bold">3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-xs">Recent Trend</span>
              <span className="text-firma-red text-sm font-bold">Declining</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-xs">On-Chain Status</span>
              <span className={`text-sm font-bold ${selectedAgent?.active ? "text-firma-green" : "text-firma-red"}`}>
                {selectedAgent?.active ? "ACTIVE" : "FIRED"}
              </span>
            </div>
          </div>
        </div>

        <p className="text-firma-text text-sm font-medium mb-3">What do you do?</p>

        {userGovChoice === null && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleGovChoice("fire")}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-firma-red font-medium px-6 py-3.5 rounded-lg w-full transition-colors text-sm"
            >
              Fire Agent &mdash; Stop all jobs, enter observation mode
            </button>
            <button
              onClick={() => handleGovChoice("warn")}
              className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-firma-yellow font-medium px-6 py-3.5 rounded-lg w-full transition-colors text-sm"
            >
              Give Warning &mdash; One more chance
            </button>
            <button
              onClick={() => handleGovChoice("keep")}
              className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-firma-green font-medium px-6 py-3.5 rounded-lg w-full transition-colors text-sm"
            >
              Keep &mdash; Accuracy might recover
            </button>
          </div>
        )}

        {aiGovDecision && (
          <>
            <div className={`border rounded-lg p-4 mt-4 text-sm ${
              userGovChoice === aiGovDecision.decision
                ? "bg-green-500/10 border-green-500/30 text-firma-green"
                : "bg-yellow-500/10 border-yellow-500/30 text-firma-yellow"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-semibold">
                  {userGovChoice === aiGovDecision.decision ? "\u2705 Match!" : "\u274C Mismatch"}
                </span>
                <span className="text-xs opacity-70">
                  Treasury AI decided: <strong>{aiGovDecision.decision.toUpperCase()}</strong>
                </span>
              </div>
              <FactorList factors={aiGovDecision.factors} />
            </div>

            <AIReasoningBox
              title="Treasury AI Governance Decision"
              reasoning={aiGovDecision.reasoning}
              hash={aiGovDecision.reasoningHash}
              model={aiGovDecision.model}
              confidence={aiGovDecision.confidence}
            />

            <button
              onClick={() => setPhase(3)}
              className="bg-firma-accent hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg w-full transition-colors text-sm mt-4"
            >
              See On-Chain Proof &rarr;
            </button>
          </>
        )}
      </div>
    );
  }

  // --- Phase 3: On-Chain Proof ---
  function renderPhase3() {
    const signalMatch = aiSignalEval ? userSignalChoice === aiSignalEval.decision : false;
    const govMatch = aiGovDecision ? userGovChoice === aiGovDecision.decision : false;

    return (
      <div>
        <h3 className="text-firma-text text-base font-semibold mb-2">
          Step 3: On-Chain Governance Record
        </h3>
        <p className="text-firma-muted text-xs mb-4">
          Every governance decision is permanently recorded on FirmaCompany contract.
          Here are the real transactions:
        </p>

        {/* Summary */}
        <div className="bg-firma-bg border border-firma-border rounded-lg p-5 mb-5">
          <div className="text-firma-text text-sm font-semibold mb-4">
            Your Decisions vs Treasury AI
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-sm">Signal Evaluation</span>
              <span className={`text-sm font-medium ${signalMatch ? "text-firma-green" : "text-firma-red"}`}>
                {signalMatch ? "\u2705 matched" : "\u274C didn't match"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-firma-muted text-sm">Governance Decision</span>
              <span className={`text-sm font-medium ${govMatch ? "text-firma-green" : "text-firma-red"}`}>
                {govMatch ? "\u2705 matched" : "\u274C didn't match"}
              </span>
            </div>
          </div>

          <div className="border-t border-firma-border pt-4 space-y-2">
            <p className="text-firma-text text-sm font-medium">
              Treasury AI makes these decisions autonomously using the same rule engine shown above.
            </p>
            <p className="text-firma-muted text-xs">
              Engine: rule-based-v1 (upgrades to LLM when ANTHROPIC_API_KEY is configured).
              Decision reasoning hashed with keccak256 and anchored on-chain via logDecision().
            </p>
          </div>
        </div>

        {/* Real governance TXs */}
        <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
          {govTxs.length === 0 ? (
            <div className="text-firma-muted text-xs text-center py-4">
              No governance transactions found in recent blocks.
            </div>
          ) : (
            govTxs.slice(0, 10).map((tx) => {
              const colors: Record<string, string> = {
                AgentHired: "bg-firma-green/12 text-firma-green",
                AgentFired: "bg-firma-red/12 text-firma-red",
                AgentRehired: "bg-firma-green/12 text-firma-green",
                DecisionLogged: "bg-firma-accent/12 text-firma-accent",
              };
              return (
                <div
                  key={tx.txHash + tx.blockNumber}
                  className="bg-firma-bg border border-firma-border rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${colors[tx.type] || "bg-firma-muted/12 text-firma-muted"}`}
                    >
                      {tx.type.replace("Agent", "")}
                    </span>
                    <span className="text-firma-text text-xs truncate">
                      Agent #{tx.agentId}: {tx.reason.slice(0, 50)}
                      {tx.reason.length > 50 ? "..." : ""}
                    </span>
                  </div>
                  <a
                    href={`${EXPLORER}/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-firma-accent text-xs hover:underline whitespace-nowrap shrink-0"
                  >
                    {tx.txHash.slice(0, 10)}...
                  </a>
                </div>
              );
            })
          )}
        </div>

        {/* Contract link */}
        <div className="bg-firma-bg border border-firma-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-firma-muted text-xs mb-1">FirmaCompany Contract</div>
              <code className="text-firma-accent text-xs font-mono">{truncAddr(FIRMA_ADDRESS)}</code>
            </div>
            <a
              href={`${EXPLORER}/address/${FIRMA_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-firma-accent/10 hover:bg-firma-accent/20 text-firma-accent text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              View on Explorer &rarr;
            </a>
          </div>
        </div>

        <button
          onClick={reset}
          className="bg-firma-accent hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-lg w-full transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-firma-card border border-firma-border rounded-xl p-5">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-firma-text text-lg font-semibold">Be the Treasury</h2>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-firma-green animate-pulse" />
          <span className="text-firma-muted text-xs">Live from X Layer</span>
        </div>
      </div>
      <p className="text-firma-muted text-xs mb-1">
        Make governance decisions using the same rule engine as the Treasury AI &mdash; then compare results and verify on-chain.
      </p>
      <p className="text-firma-muted-dark text-[10px] mb-5">
        Decision engine: rule-based-v1 (same logic as packages/core/llm-brain.ts)
      </p>

      <StepIndicator phase={phase} />

      {phase === 1 && renderPhase1()}
      {phase === 2 && renderPhase2()}
      {phase === 3 && renderPhase3()}
    </div>
  );
}
