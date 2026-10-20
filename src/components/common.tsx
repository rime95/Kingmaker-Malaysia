"use client";

import { useGame } from "@/store/gameStore";
import { projectAllFor } from "@/game/state";
import { DIFFICULTY } from "@/game/config";
import { bestRead, type SeatRead } from "@/game/systems/polls";
import type { Projection } from "@/game/voter";
export { fmtRM } from "@/game/money";
import { cshort, PARTIES, SEATS, type CoalitionId } from "@/game/world";
import { useMemo } from "react";

export const coalColor = (c: CoalitionId) => `var(--c-${c})`;

/** Fixed chart order: government partners, then opposition. Others is the neutral bucket. */
export const CHART_ORDER: CoalitionId[] = ["PH", "BN", "GPS", "GRS", "OTHERS", "WARISAN", "MUDA", "PN"];

export function useProjections(): Projection[] {
  const game = useGame((s) => s.game);
  return useMemo(() => (game ? projectAllFor(game) : []), [game]);
}

/** Your best read of every seat: a poll or branch report, else an estimate from the national poll. */
export function useReads(): SeatRead[] {
  const game = useGame((s) => s.game);
  const projections = useProjections();
  return useMemo(
    () => (game ? SEATS.map((_, i) => bestRead(game.polls, projections, game.seed, i, game.week, DIFFICULTY[game.settings.difficulty].pollError)) : []),
    [game, projections],
  );
}

export function pct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmt(n: number) {
  return n.toLocaleString("en-MY");
}

export function partyLabel(party: string) {
  return PARTIES[party]?.id ?? party;
}

export function CoalitionChip({ c }: { c: CoalitionId }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="swatch" style={{ background: coalColor(c) }} />
      {cshort(c)}
    </span>
  );
}

export const seatByIndex = (i: number) => SEATS[i];
