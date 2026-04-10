/**
 * LiveBadge — Shows a pulsing green dot with "LIVE" or "UPDATED" label
 * when isPulsing is true. Otherwise shows a static dim indicator.
 */
export default function LiveBadge({ isPulsing, label }: { isPulsing: boolean; label?: string }) {
  if (isPulsing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400/90">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative rounded-full h-2 w-2 bg-green-400" />
        </span>
        {label || "Updated"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/20">
      <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
      {label || "Live"}
    </span>
  );
}
