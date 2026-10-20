"use client";

import { useState } from "react";
import { useGame } from "@/store/gameStore";
import { seatCounts } from "@/game/state";
import { cname, cshort, MAJORITY, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor } from "./common";

/** Stacked seat bars (holders now, the latest national poll, the last war-room simulation) with the 112 majority line. */
export function SeatBars() {
  const game = useGame((s) => s.game)!;
  const poll = game.polls.national[0];
  const rows: { label: string; counts: Record<CoalitionId, number> }[] = [{ label: "Dewan today", counts: seatCounts(game.holders) }];
  if (poll) rows.push({ label: "Latest poll", counts: poll.seats });
  if (game.lastElection) rows.push({ label: "War room", counts: game.lastElection.totals });

  return (
    <div className="panel p-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ink-2)" }}>
        {CHART_ORDER.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="swatch" style={{ background: coalColor(c) }} />
            {cshort(c)}
          </span>
        ))}
        <span className="ml-auto" style={{ color: "var(--muted)" }}>
          {MAJORITY} seats for a majority
        </span>
      </div>
      {rows.map((r) => (
        <Bar key={r.label} {...r} player={game.player} government={game.government} />
      ))}
    </div>
  );
}

function Bar({ label, counts, player, government }: { label: string; counts: Record<CoalitionId, number>; player: CoalitionId; government: CoalitionId[] }) {
  const [hover, setHover] = useState<CoalitionId | null>(null);
  const gov = CHART_ORDER.filter((c) => government.includes(c)).reduce((s, c) => s + counts[c], 0);
  return (
    <div className="grid grid-cols-[96px_1fr_auto] @md:grid-cols-[110px_1fr_160px] items-center gap-3">
      <span className="text-xs font-medium" style={{ color: "var(--ink-2)" }}>
        {label}
      </span>
      <div className="relative h-6">
        <div className="flex h-full gap-[2px] rounded overflow-hidden">
          {CHART_ORDER.filter((c) => counts[c] > 0).map((c) => (
            <div
              key={c}
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              style={{ width: `${(counts[c] / TOTAL_SEATS) * 100}%`, background: coalColor(c), opacity: hover && hover !== c ? 0.45 : 1 }}
              className="h-full flex items-center justify-center text-[11px] font-semibold text-white"
              title={`${cname(c)}: ${counts[c]} seats`}
            >
              {counts[c] >= 12 ? counts[c] : ""}
            </div>
          ))}
        </div>
        <div className="absolute -top-1 -bottom-1 w-[2px]" style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, background: "var(--ink)" }} />
      </div>
      <span className="text-xs tabular-nums text-right" style={{ color: "var(--ink-2)" }}>
        {hover ? `${cshort(hover)} ${counts[hover]}` : `You ${counts[player]} · Gov bloc ${gov}`}
      </span>
    </div>
  );
}
