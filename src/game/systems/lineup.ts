// The candidates board: who is worth placing (your bench), which seats matter (key seats), what a candidate would do
// to your chances in a seat, and a suggested line-up. Pure, from the game state and the seat reads.

import type { GameState } from "../state";
import { SEATS, regionOf } from "../world";
import { winChance, type SeatRead } from "./polls";
import { divisionChief } from "./camps";
import { homeOf, type Person } from "./people";
import { candidateStrength, canStand, lineup, partySeats, yourParty } from "./nominations";

/** The person standing in a seat in your line-up today. */
export function pickIn(s: GameState, seat: number, picks = lineup(s)): Person | undefined {
  const id = picks[seat];
  return id === undefined ? undefined : s.people.find((p) => p.id === id);
}

/**
 * Your chance in a seat with this person as your candidate. Seat reads already count the named candidate once the
 * nominations are open, so the difference from today's pick is what moves the share (log-odds, near the share).
 */
export function chanceWith(s: GameState, read: SeatRead | undefined, seat: number, p: Person | undefined, picks = lineup(s)): number {
  if (!read) return 0;
  const mine = read.shares[s.player];
  if (mine === undefined) return 0;
  const counted = s.nominations ? candidateStrength(s, seat, pickIn(s, seat, picks)) : 0;
  const d = candidateStrength(s, seat, p) - counted;
  const shifted = Math.min(0.99, Math.max(0.01, mine + d * mine * (1 - mine)));
  return winChance({ ...read, shares: { ...read.shares, [s.player]: shifted } }, s.player, s.week) ?? 0;
}

/** The people worth placing: you, your party's leadership and ministers, recruited tokoh, and your best-known MPs. */
export function bench(s: GameState): Person[] {
  const party = yourParty(s);
  const ministers = new Set(Object.values(s.cabinet));
  const members = s.people.filter((p) => p.party === party && !p.retired && !p.chairman);
  const picked = new Map<number, Person>();
  const add = (p: Person) => picked.set(p.id, p);
  if (s.career.rung >= 6) members.filter((p) => p.id === s.youId).forEach(add);
  members.filter((p) => p.rank >= 2 || ministers.has(p.id) || p.tokoh).forEach(add);
  members
    .filter((p) => p.seat !== null)
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 12)
    .forEach(add);
  return [...picked.values()].sort((a, b) => Number(b.id === s.youId) - Number(a.id === s.youId) || b.influence - a.influence);
}

export type SeatGroup = "danger" | "battle" | "stretch" | "other";

export const GROUP_INFO: Record<SeatGroup, { name: string; text: string }> = {
  danger: { name: "In danger", text: "Seats you hold where your chance is under 60%" },
  battle: { name: "Battlegrounds", text: "Your chance is between 30% and 70%" },
  stretch: { name: "Stretch targets", text: "15–30%: a star candidate could flip them" },
  other: { name: "Other seats", text: "Safe or out of reach: the defaults are fine" },
};

/** Which group a seat is in, from your chance with today's pick. */
export function groupOf(s: GameState, seat: number, chance: number): SeatGroup {
  if (s.holders[seat] === s.player && chance < 0.6) return "danger";
  if (chance >= 0.3 && chance <= 0.7) return "battle";
  if (chance >= 0.15 && chance < 0.3) return "stretch";
  return "other";
}

/** The best seats for one person: where they would add the most to your chances (net of the seat they leave). */
export function bestSeatsFor(s: GameState, reads: SeatRead[], p: Person, n = 5): { seat: number; gain: number }[] {
  const picks = lineup(s);
  const from = Object.keys(picks).map(Number).find((k) => picks[k] === p.id);
  const loss = from !== undefined ? leavingCost(s, reads, from, p, picks) : 0;
  return partySeats(s)
    .filter((i) => i !== from && canStand(s, i, p))
    .map((i) => ({ seat: i, gain: chanceWith(s, reads[i], i, p, picks) - chanceWith(s, reads[i], i, pickIn(s, i, picks), picks) - loss }))
    .filter((x) => x.gain > 0.005)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, n);
}

/** What a seat loses when its candidate moves away: their chance there against the division chief's (or a newcomer's). */
function leavingCost(s: GameState, reads: SeatRead[], seat: number, p: Person, picks: Record<number, number>): number {
  const chief = divisionChief(s, seat);
  const fallback = chief && chief.id !== p.id && chief.seat === null ? chief : undefined;
  return Math.max(0, chanceWith(s, reads[seat], seat, p, picks) - chanceWith(s, reads[seat], seat, fallback, picks));
}

export interface Move {
  person: Person;
  from: number | undefined;
  to: number;
  /** Change in your chance of winning, net of the seat they leave (−1 to 1). */
  gain: number;
  /** Who stood in the seat they take. */
  displaced: Person | undefined;
}

/**
 * A suggested line-up: each bench member (not you) to the key seat where they add the most, greedily, each person and
 * each seat once. People from the seat's own state are preferred a little; sitting MPs only move if their own seat can
 * spare them.
 */
export function suggestPlacements(s: GameState, reads: SeatRead[]): Move[] {
  const picks = lineup(s);
  const key = new Set(partySeats(s).filter((i) => groupOf(s, i, chanceWith(s, reads[i], i, pickIn(s, i, picks), picks)) !== "other"));
  const usedSeats = new Set<number>();
  const usedPeople = new Set<number>();
  const options: Move[] = [];
  for (const p of bench(s)) {
    if (p.id === s.youId) continue;
    const from = Object.keys(picks).map(Number).find((k) => picks[k] === p.id);
    const loss = from !== undefined ? leavingCost(s, reads, from, p, picks) : 0;
    for (const i of key) {
      if (i === from || !canStand(s, i, p)) continue;
      const cur = pickIn(s, i, picks);
      if (cur?.id === s.youId) continue;
      const local = homeOf(p) === regionOf(SEATS[i].state) ? 0.01 : 0;
      const gain = chanceWith(s, reads[i], i, p, picks) - chanceWith(s, reads[i], i, cur, picks) - loss + local;
      if (gain > 0.03) options.push({ person: p, from, to: i, gain, displaced: cur });
    }
  }
  const out: Move[] = [];
  for (const m of options.sort((a, b) => b.gain - a.gain)) {
    if (usedPeople.has(m.person.id) || usedSeats.has(m.to) || (m.from !== undefined && usedSeats.has(m.from))) continue;
    // Someone already moved can't also be the one displaced.
    if (m.displaced && usedPeople.has(m.displaced.id)) continue;
    out.push(m);
    usedPeople.add(m.person.id);
    usedSeats.add(m.to);
    if (m.from !== undefined) usedSeats.add(m.from);
  }
  return out;
}
