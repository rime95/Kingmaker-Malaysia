"use client";

import { useGame } from "@/store/gameStore";
import { projectAllFor, type GameState } from "@/game/state";
import { pollError } from "@/game/systems/team";
import { bestRead, type SeatRead } from "@/game/systems/polls";
import type { Projection } from "@/game/voter";
export { fmtRM } from "@/game/money";
import { cshort, PARTIES, SEATS, type CoalitionId } from "@/game/world";
import { CoalitionFlag, PartyFlag } from "./flags";

export const coalColor = (c: CoalitionId) => `var(--c-${c})`;

/** Fixed chart order: government partners, then opposition. Others is the neutral bucket. */
export const CHART_ORDER: CoalitionId[] = ["PH", "BN", "GPS", "GRS", "OTHERS", "WARISAN", "MUDA", "BERSAMA", "PN"];

// Game states in the store never change once made, so every panel can share one projection (and one set of seat
// reads) per state instead of each running the voter model over all 222 seats.
const projectionCache = new WeakMap<GameState, Projection[]>();
const readCache = new WeakMap<GameState, SeatRead[]>();

export function projectionsOf(game: GameState): Projection[] {
  let p = projectionCache.get(game);
  if (!p) projectionCache.set(game, (p = projectAllFor(game)));
  return p;
}

export function readsOf(game: GameState): SeatRead[] {
  let r = readCache.get(game);
  if (!r) {
    const projections = projectionsOf(game);
    readCache.set(game, (r = SEATS.map((_, i) => bestRead(game.polls, projections, game.seed, i, game.week, pollError(game)))));
  }
  return r;
}

export function useProjections(): Projection[] {
  const game = useGame((s) => s.game);
  return game ? projectionsOf(game) : [];
}

/** Your best read of every seat: a poll or branch report, else an estimate from the national poll. */
export function useReads(): SeatRead[] {
  const game = useGame((s) => s.game);
  return game ? readsOf(game) : [];
}

export function pct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

/** A win chance: never a flat 0% or 100% (long shots happen). */
export function chancePct(v: number) {
  return v < 0.01 ? "<1%" : v > 0.99 ? ">99%" : pct(v);
}

export function fmt(n: number) {
  return n.toLocaleString("en-MY");
}

export function partyLabel(party: string) {
  return PARTIES[party]?.id ?? party;
}

export function CoalitionChip({ c }: { c: CoalitionId }) {
  const game = useGame((s) => s.game);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {game ? <CoalitionFlag game={game} c={c} size={11} /> : <PartyFlag id={c} size={11} />}
      {cshort(c)}
    </span>
  );
}

export const seatByIndex = (i: number) => SEATS[i];
