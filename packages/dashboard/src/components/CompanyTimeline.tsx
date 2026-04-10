import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

type EventType =
  | "FOUNDED"
  | "HIRED"
  | "REGISTERED"
  | "REVENUE"
  | "WARNING"
  | "FIRED"
  | "REHIRED"
  | "MILESTONE"
  | "REPORT";

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: EventType;
  narrative: string;
  link?: { url: string; label: string };
  sortKey: number;
}

const CONTRACT_ADDRESS = "0x16660b4f71cb9e908ad672fdc4da1ac9be7e5722";
const RPC_URL = "https://rpc.xlayer.tech";

const CONTRACT_ABI = [
  "function getAgent(uint256 _agentId) view returns (tuple(uint256 agentId, uint8 role, string roleName, address wallet, bool registered, bool active, uint256 budget, uint256 registeredAt, uint256 hiredAt))",
  "function getAgentCount() view returns (uint256)",
  "function treasuryActive() view returns (bool)",
  "function reportCount() view returns (uint256)",
];

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EVENT_COLORS: Record<
  EventType,
  { bar: string; badge: string; badgeBg: string; label: string }
> = {
  FOUNDED: {
    bar: "bg-purple-500",
    badge: "text-purple-400",
    badgeBg: "bg-purple-400/12",
    label: "Founded",
  },
  REGISTERED: {
    bar: "bg-firma-accent",
    badge: "text-firma-accent",
    badgeBg: "bg-firma-accent/12",
    label: "Registered",
  },
  HIRED: {
    bar: "bg-firma-green",
    badge: "text-firma-green",
    badgeBg: "bg-firma-green/12",
    label: "Hired",
  },
  REVENUE: {
    bar: "bg-firma-green",
    badge: "text-firma-green",
    badgeBg: "bg-firma-green/12",
    label: "Revenue",
  },
  WARNING: {
    bar: "bg-amber-500",
    badge: "text-amber-400",
    badgeBg: "bg-amber-400/12",
    label: "Warning",
  },
  FIRED: {
    bar: "bg-firma-red",
    badge: "text-firma-red",
    badgeBg: "bg-firma-red/12",
    label: "Fired",
  },
  REHIRED: {
    bar: "bg-firma-green",
    badge: "text-firma-green",
    badgeBg: "bg-firma-green/12",
    label: "Rehired",
  },
  MILESTONE: {
    bar: "bg-firma-accent",
    badge: "text-firma-accent",
    badgeBg: "bg-firma-accent/12",
    label: "Milestone",
  },
  REPORT: {
    bar: "bg-firma-accent",
    badge: "text-firma-accent",
    badgeBg: "bg-firma-accent/12",
    label: "Report",
  },
};

export default function CompanyTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL, {
        chainId: 196,
        name: "xlayer",
      });
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider,
      );

      const count = Number(await contract.getAgentCount());
      const treasuryActive = await contract.treasuryActive();
      const reportCount = Number(await contract.reportCount());

      const timeline: TimelineEvent[] = [];

      // Company founding
      timeline.push({
        id: "genesis",
        timestamp: "",
        type: "FOUNDED",
        narrative:
          "Firma was born — an autonomous AI company deployed on X Layer mainnet. No human CEO, no board. Just code and conviction.",
        link: {
          url: `https://www.okx.com/web3/explorer/xlayer/address/${CONTRACT_ADDRESS}`,
          label: truncAddr(CONTRACT_ADDRESS),
        },
        sortKey: 0,
      });

      // Read each agent
      for (let i = 1; i <= count; i++) {
        const agent = await contract.getAgent(i);
        const roleName = agent.roleName as string;
        const wallet = agent.wallet as string;
        const registeredAt = Number(agent.registeredAt);
        const hiredAt = Number(agent.hiredAt);
        const active = agent.active as boolean;
        const agentId = Number(agent.agentId);
        const budget = agent.budget as bigint;

        // Registration
        if (registeredAt > 0) {
          timeline.push({
            id: `reg-${agentId}`,
            timestamp: formatTimestamp(registeredAt),
            type: "REGISTERED",
            narrative: `${roleName} Agent (#${agentId}) registered on-chain with wallet ${truncAddr(wallet)}.`,
            link: {
              url: `https://www.okx.com/web3/explorer/xlayer/address/${wallet}`,
              label: truncAddr(wallet),
            },
            sortKey: registeredAt,
          });
        }

        // Hiring
        if (hiredAt > 0) {
          timeline.push({
            id: `hire-${agentId}`,
            timestamp: formatTimestamp(hiredAt),
            type: "HIRED",
            narrative: `${roleName} Agent was hired and granted on-chain authority. The company grows.`,
            link: {
              url: `https://www.okx.com/web3/explorer/xlayer/address/${wallet}`,
              label: truncAddr(wallet),
            },
            sortKey: hiredAt,
          });
        }

        // If fired
        if (!active && registeredAt > 0) {
          timeline.push({
            id: `fire-${agentId}`,
            timestamp: hiredAt > 0 ? formatTimestamp(hiredAt + 3600) : "",
            type: "FIRED",
            narrative: `${roleName} Agent was fired. Now operating in observation mode — still watching, but powerless.`,
            sortKey: hiredAt + 3600,
          });
        }

        // Budget allocation
        if (budget > 0n) {
          const budgetStr = ethers.formatUnits(budget, 18);
          timeline.push({
            id: `budget-${agentId}`,
            timestamp: hiredAt > 0 ? formatTimestamp(hiredAt + 1) : "",
            type: "REVENUE",
            narrative: `${roleName} Agent allocated a budget of ${budgetStr} units for autonomous operations.`,
            sortKey: hiredAt + 1,
          });
        }
      }

      // Treasury status
      timeline.push({
        id: "treasury",
        timestamp: "",
        type: treasuryActive ? "MILESTONE" : "WARNING",
        narrative: treasuryActive
          ? "Treasury operating autonomously — the AI CFO controls spending, hiring, and firing."
          : "Treasury paused — emergency brake pulled. All autonomous spending halted.",
        sortKey: 1,
      });

      // Reports
      if (reportCount > 0) {
        timeline.push({
          id: "reports",
          timestamp: "",
          type: "REPORT",
          narrative: `${reportCount} operations report${reportCount > 1 ? "s" : ""} anchored on-chain. Every decision is verifiable.`,
          link: {
            url: `https://www.okx.com/web3/explorer/xlayer/address/${CONTRACT_ADDRESS}`,
            label: "View contract",
          },
          sortKey: 2,
        });
      }

      // All agents active milestone
      const allActive = count > 0;
      if (allActive) {
        timeline.push({
          id: "all-active",
          timestamp: "",
          type: "MILESTONE",
          narrative: `All ${count} agents are operational. The company runs itself — earning, spending, and governing autonomously.`,
          sortKey: Date.now() / 1000,
        });
      }

      // Sort by sortKey descending (newest first)
      timeline.sort((a, b) => b.sortKey - a.sortKey);
      setEvents(timeline);
    } catch (err) {
      console.error("Failed to fetch on-chain state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-firma-muted-dark text-sm animate-pulse">
          Reading company history from X Layer...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {events.length === 0 && (
          <div className="text-firma-muted-dark text-sm text-center py-8">
            No on-chain events found.
          </div>
        )}
        {events.map((event) => {
          const colors = EVENT_COLORS[event.type];

          return (
            <div key={event.id} className="flex gap-0 group">
              {/* Color bar */}
              <div
                className={`w-1 shrink-0 rounded-full ${colors.bar} opacity-60 group-hover:opacity-100 transition-opacity`}
              />

              {/* Event card */}
              <div className="flex-1 bg-firma-card border border-firma-border rounded-xl ml-4 p-5 hover:border-firma-border/80 transition-all">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${colors.badgeBg} ${colors.badge}`}
                  >
                    {colors.label}
                  </span>
                  {event.timestamp && (
                    <span className="text-firma-muted-dark text-xs">
                      {event.timestamp}
                    </span>
                  )}
                </div>

                <p className="text-firma-text text-sm leading-relaxed">
                  {event.narrative}
                </p>

                {event.link && (
                  <a
                    href={event.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 text-xs text-firma-accent hover:text-firma-accent-soft transition-colors"
                  >
                    <span className="text-firma-muted-dark font-mono">
                      {event.link.label}
                    </span>
                    <span className="font-medium">Verify &rarr;</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
