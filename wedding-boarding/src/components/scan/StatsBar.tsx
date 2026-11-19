import type { Stats } from "@/app/actions/boarding";

export function StatsBar({ stats }: { stats: Stats }) {
  return (
    <div className="flex items-baseline justify-center gap-2 font-display text-lg text-foreground tabular-nums">
      <span className="text-primary">{stats.boardedGuests}</span>
      <span className="text-muted-foreground">/</span>
      <span>{stats.totalGuests}</span>
      <span className="ml-1 text-xs font-sans font-medium tracking-[0.15em] text-muted-foreground uppercase">
        boarded
      </span>
    </div>
  );
}
