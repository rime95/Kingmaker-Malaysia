"use client";

import { useGame } from "@/store/gameStore";
import { projectAllFor } from "@/game/state";
import type { Projection } from "@/game/voter";
export { fmtRM } from "@/game/money";
import { COALITION_INFO, PARTIES, SEATS, type CoalitionId } from "@/game/world";
import { useMemo } from "react";

export const coalColor = (c: CoalitionId) => `var(--c-${c})`;

/** Fixed chart order: government partners, then opposition. Others is the neutral bucket. */
export const CHART_ORDER: CoalitionId[] = ["PH", "BN", "GPS", "GRS", "OTHERS", "WARISAN", "MUDA", "PN"];

export function useProjections(): Projection[] {
  const game = useGame((s) => s.game);
  return useMemo(() => (game ? projectAllFor(game) : []), [game]);
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
      {COALITION_INFO[c].short}
    </span>
  );
}

export const seatByIndex = (i: number) => SEATS[i];
