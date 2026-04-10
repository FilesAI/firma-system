import { useContractEvents, type OnChainEvent } from "../hooks/useContractEvents";
import { useLivePulse } from "../hooks/useLivePulse";
import LiveBadge from "./LiveBadge";

type EventCategory = "genesis" | "registered" | "hired" | "fired" | "budget" | "decision" | "report" | "treasury-pause" | "treasury-resume";

const STYLES: Record<EventCategory, { label: string; color: string; dot: string }> = {
  genesis:          { label: "Genesis",    color: "text-purple-400/80",  dot: "bg-purple-400" },
  registered:       { label: "Registered", color: "text-indigo-400/80",  dot: "bg-indigo-400" },
  hired:            { label: "Hired",      color: "text-green-400/80",   dot: "bg-green-400" },
  fired:            { label: "Fired",      color: "text-red-400/80",     dot: "bg-red-400" },
  budget:           { label: "Budget",     color: "text-amber-400/80",   dot: "bg-amber-400" },
  decision:         { label: "Decision",   color: "text-blue-400/80",    dot: "bg-blue-400" },
  report:           { label: "Report",     color: "text-indigo-400/80",  dot: "bg-indigo-400" },
  "treasury-pause": { label: "Paused",     color: "text-red-400/80",     dot: "bg-red-400" },
  "treasury-resume":{ label: "Active",     color: "text-green-400/80",   dot: "bg-green-400" },
};

function categorize(type: string): EventCategory {
  const map: Record<string, EventCategory> = {
    Genesis: "genesis", AgentRegistered: "registered", AgentHired: "hired",
    AgentRehired: "hired", AgentFired: "fired", BudgetUpdated: "budget",
    DecisionLogged: "decision", OpsReportAnchored: "report",
    TreasuryPaused: "treasury-pause", TreasuryResumed: "treasury-resume",
  };
  return map[type] || "decision";
}

function relativeTime(ts?: number): string {
  if (!ts) return "";
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return "now";
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

function truncAddr(a: string) { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function isTxHash(h: string) { return h.startsWith("0x") && h.length === 66; }
function isAddr(h: string) { return h.startsWith("0x") && h.length === 42; }

function EventRow({ event }: { event: OnChainEvent }) {
  const cat = categorize(event.type);
  const s = STYLES[cat];
  const url = isTxHash(event.txHash)
    ? `https://www.okx.com/web3/explorer/xlayer/tx/${event.txHash}`
    : isAddr(event.txHash)
      ? `https://www.okx.com/web3/explorer/xlayer/address/${event.txHash}`
      : null;

  return (
    <div className="flex gap-3 py-3 group">
      <div className="flex flex-col items-center pt-1.5 shrink-0">
        <div className={`w-2 h-2 rounded-full ${s.dot} opacity-70 group-hover:opacity-100 transition-opacity`} />
        <div className="w-px flex-1 bg-white/[0.04] mt-1.5" />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${s.color}`}>{s.label}</span>
          {event.timestamp && <span className="text-white/15 text-[10px]">{relativeTime(event.timestamp)}</span>}
        </div>
        <p className="text-white/50 text-[13px] leading-relaxed">{event.detail}</p>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-white/15 hover:text-indigo-400/60 transition-colors mt-1 font-mono">
            {truncAddr(event.txHash)}
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

export default function OnChainFeed() {
  const { events, loading, error } = useContractEvents();
  const isPulsing = useLivePulse(events);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-sm font-medium">Activity</span>
          <LiveBadge isPulsing={isPulsing} />
          <span className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-40" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
          </span>
        </div>
        <span className="text-white/15 text-[10px] font-mono">{events.length} events</span>
      </div>

      {loading && events.length === 0 && (
        <div className="py-10 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton w-2 h-2 rounded-full mt-1.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton w-16 h-3" />
                <div className="skeleton w-full h-3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && events.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-red-400/60 text-sm">{error}</p>
        </div>
      )}

      {events.length === 0 && !loading && !error && (
        <div className="py-10 text-center">
          <p className="text-white/20 text-sm">No events</p>
        </div>
      )}

      {events.length > 0 && (
        <div className="max-h-[420px] overflow-y-auto pr-1 divide-y divide-white/[0.03]">
          {events.map((e) => <EventRow key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
