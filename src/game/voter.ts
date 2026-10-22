// Voter model: each seat's vote share per contesting coalition.
// share ∝ (Σ bloc size × bloc lean) × exp(calibration + national swing + seat offset)
// Calibration is fixed at load so the untouched world reproduces GE15; swing and offsets are what players change.

import { BLOC_LEAN, RATING_MARGIN } from "./config";
import { BLOCS, COALITIONS, SEATS, contestingIn, seatRegion, type CoalitionId, type Entries, type Seat } from "./world";

export type Swing = Record<CoalitionId, number>;
export const ZERO_SWING = (): Swing => Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Swing;
export const COALITION_INDEX: Record<CoalitionId, number> = Object.fromEntries(COALITIONS.map((c, i) => [c, i])) as Record<CoalitionId, number>;

export interface VoterInputs {
  swing: Swing;
  /** seatOffsets[seatIndex][coalitionIndex], log-odds. */
  seatOffsets: number[][];
  /** Seats coalitions have moved into during the game. */
  entries?: Entries;
}

/** A newcomer starts from at least this base (about 4% of the vote) and grows by campaigning. */
const NEWCOMER_BASE = 0.04;

function baseScore(seat: Seat, c: CoalitionId): number {
  const lean = BLOC_LEAN[seatRegion(seat)];
  let s = 0;
  for (const b of BLOCS) s += seat.demo.ethnic[b] * (lean[b][c] ?? 0);
  return s + 0.005;
}

const BASE: number[][] = SEATS.map((seat) => COALITIONS.map((c) => baseScore(seat, c)));

/** How naturally a coalition's voters live in a seat (bloc lean; under 0.05 means hardly any). */
export const naturalSupport = (seat: number, c: CoalitionId) => BASE[seat][COALITION_INDEX[c]];

function sharesFrom(seat: Seat, adjust: (c: CoalitionId) => number, entries?: Entries): Partial<Record<CoalitionId, number>> {
  const out: Partial<Record<CoalitionId, number>> = {};
  let total = 0;
  const newcomers = entries?.[seat.index] ?? [];
  for (const c of contestingIn(seat, entries)) {
    const base = BASE[seat.index][COALITION_INDEX[c]];
    const v = (newcomers.includes(c) ? Math.max(base, NEWCOMER_BASE) : base) * Math.exp(adjust(c));
    out[c] = v;
    total += v;
  }
  for (const c of Object.keys(out) as CoalitionId[]) out[c]! /= total;
  return out;
}

/** Expected margin of the GE15 winner, as a share of votes cast. */
export function ge15MarginShare(seat: Seat): number {
  return Math.min(0.8, Math.max(0.002, seat.ge15Majority / seat.ge15Valid));
}

function topTwo(shares: Partial<Record<CoalitionId, number>>): [CoalitionId, number, CoalitionId | null, number] {
  let w: CoalitionId | null = null;
  let r: CoalitionId | null = null;
  for (const c of Object.keys(shares) as CoalitionId[]) {
    if (w === null || shares[c]! > shares[w]!) {
      r = w;
      w = c;
    } else if (r === null || shares[c]! > shares[r]!) r = c;
  }
  return [w!, shares[w!]!, r, r ? shares[r]! : 0];
}

function calibrate(seat: Seat): number[] {
  const cal = COALITIONS.map(() => 0);
  const target = ge15MarginShare(seat);
  const winner = seat.ge15Coalition;
  for (let i = 0; i < 60; i++) {
    const shares = sharesFrom(seat, (c) => cal[COALITION_INDEX[c]]);
    let best = 0;
    for (const c of Object.keys(shares) as CoalitionId[]) if (c !== winner) best = Math.max(best, shares[c]!);
    const margin = shares[winner]! - best;
    if (Math.abs(margin - target) < 0.001) break;
    cal[COALITION_INDEX[winner]] += (target - margin) * 3;
  }
  return cal;
}

export const CALIBRATION: number[][] = SEATS.map(calibrate);

export function seatShares(seat: Seat, inputs: VoterInputs, extra?: (c: CoalitionId) => number): Partial<Record<CoalitionId, number>> {
  const cal = CALIBRATION[seat.index];
  const off = inputs.seatOffsets[seat.index];
  return sharesFrom(
    seat,
    (c) => {
      const i = COALITION_INDEX[c];
      return cal[i] + inputs.swing[c] + (off?.[i] ?? 0) + (extra ? extra(c) : 0);
    },
    inputs.entries,
  );
}

export type Rating = "safe" | "likely" | "lean" | "tossup";

export interface Projection {
  shares: Partial<Record<CoalitionId, number>>;
  leader: CoalitionId;
  runnerUp: CoalitionId | null;
  margin: number;
  rating: Rating;
}

export function ratingFor(margin: number): Rating {
  if (margin >= RATING_MARGIN.safe) return "safe";
  if (margin >= RATING_MARGIN.likely) return "likely";
  if (margin >= RATING_MARGIN.lean) return "lean";
  return "tossup";
}

export function projectSeat(seat: Seat, inputs: VoterInputs): Projection {
  const shares = seatShares(seat, inputs);
  const [leader, s1, runnerUp, s2] = topTwo(shares);
  const margin = s1 - s2;
  return { shares, leader, runnerUp, margin, rating: ratingFor(margin) };
}

export function projectAll(inputs: VoterInputs): Projection[] {
  return SEATS.map((s) => projectSeat(s, inputs));
}

export { topTwo };
