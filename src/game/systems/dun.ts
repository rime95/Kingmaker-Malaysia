// State assembly (DUN) seats. Real DUN boundaries aren't in the game yet, so each state's assembly seats are
// generated inside its parliamentary seats (2–4 per seat, by electorate) and named after them ("Kangar 2").
// A DUN votes like its parliamentary seat plus a fixed local tilt. Starting holders are assigned to match each
// state's real seat split (config ASSEMBLY_START), then calibrated so the untouched world reproduces them.

import { ASSEMBLY_START, PRN } from "../config";
import { Rng, hash01 } from "../rng";
import { COALITION_INDEX, ZERO_SWING, seatShares, topTwo, type VoterInputs } from "../voter";
import { COALITIONS, SEATS, STATES, candidateParty, contestingIn, type CoalitionId } from "../world";

export interface DunSeat {
  index: number;
  /** "N.05" within its state. */
  code: string;
  name: string;
  state: string;
  parent: number;
  electorate: number;
  /** Fixed local tilt per coalition (log-odds), from the seat's own character. */
  tilt: number[];
}

function buildDuns(): DunSeat[] {
  const out: DunSeat[] = [];
  for (const st of STATES) {
    if (!st.dunSeats) continue;
    const parents = SEATS.filter((s) => s.state === st.id);
    const total = parents.reduce((sum, s) => sum + s.electorate, 0);
    // Largest-remainder split of the assembly's seats across parliamentary seats, at least one each.
    const exact = parents.map((s) => Math.max(1, (s.electorate / total) * st.dunSeats));
    const counts = exact.map(Math.floor);
    let left = st.dunSeats - counts.reduce((a, b) => a + b, 0);
    const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
    for (let k = 0; left > 0; k = (k + 1) % order.length, left--) counts[order[k].i]++;
    for (let k = 0; left < 0; k = (k + 1) % order.length) {
      const i = order[order.length - 1 - k].i;
      if (counts[i] > 1) {
        counts[i]--;
        left++;
      }
    }
    let n = 0;
    parents.forEach((p, pi) => {
      for (let j = 0; j < counts[pi]; j++) {
        n++;
        out.push({
          index: out.length,
          code: `N.${String(n).padStart(2, "0")}`,
          name: counts[pi] > 1 ? `${p.name} ${j + 1}` : p.name,
          state: st.id,
          parent: p.index,
          electorate: Math.round(p.electorate / counts[pi]),
          tilt: COALITIONS.map((c) => (hash01("tilt", out.length, c) - 0.5) * 0.4),
        });
      }
    });
  }
  return out;
}

export const DUNS: DunSeat[] = buildDuns();
export const DUNS_BY_STATE: Record<string, number[]> = Object.fromEntries(STATES.map((s) => [s.id, DUNS.filter((d) => d.state === s.id).map((d) => d.index)]));

function sharesFor(d: DunSeat, parentShares: Partial<Record<CoalitionId, number>>, adjust: (c: CoalitionId) => number) {
  const out: Partial<Record<CoalitionId, number>> = {};
  let total = 0;
  for (const c of Object.keys(parentShares) as CoalitionId[]) {
    const v = parentShares[c]! * Math.exp(d.tilt[COALITION_INDEX[c]] + adjust(c));
    out[c] = v;
    total += v;
  }
  for (const c of Object.keys(out) as CoalitionId[]) out[c]! /= total;
  return out;
}

// Starting holders and calibration, from the untouched (GE15-calibrated) world.
const ZERO_INPUTS: VoterInputs = { swing: ZERO_SWING(), seatOffsets: SEATS.map(() => COALITIONS.map(() => 0)) };
const BASE_PARENT = SEATS.map((s) => seatShares(s, ZERO_INPUTS));

function assignStart(): CoalitionId[] {
  const holders: (CoalitionId | null)[] = DUNS.map(() => null);
  for (const st of STATES) {
    const ids = DUNS_BY_STATE[st.id];
    if (!ids.length) continue;
    const quota = { ...ASSEMBLY_START[st.id] };
    const pairs: { d: number; c: CoalitionId; v: number }[] = [];
    for (const d of ids) {
      const sh = sharesFor(DUNS[d], BASE_PARENT[DUNS[d].parent], () => 0);
      for (const c of Object.keys(sh) as CoalitionId[]) pairs.push({ d, c, v: sh[c]! });
    }
    pairs.sort((a, b) => b.v - a.v);
    for (const p of pairs) {
      if (holders[p.d] || !(quota[p.c]! > 0)) continue;
      holders[p.d] = p.c;
      quota[p.c]!--;
    }
    // Quotas a coalition can't fill (it doesn't contest enough seats) go to the local leader.
    for (const d of ids) {
      if (holders[d]) continue;
      const sh = sharesFor(DUNS[d], BASE_PARENT[DUNS[d].parent], () => 0);
      holders[d] = topTwo(sh)[0];
    }
  }
  return holders as CoalitionId[];
}

export const DUN_START: CoalitionId[] = assignStart();

function calibrate(d: DunSeat, winner: CoalitionId): number[] {
  const cal = COALITIONS.map(() => 0);
  const target = 0.03 + hash01("dunmargin", d.index) * 0.15;
  for (let k = 0; k < 60; k++) {
    const sh = sharesFor(d, BASE_PARENT[d.parent], (c) => cal[COALITION_INDEX[c]]);
    let best = 0;
    for (const c of Object.keys(sh) as CoalitionId[]) if (c !== winner) best = Math.max(best, sh[c]!);
    const margin = (sh[winner] ?? 0) - best;
    if (Math.abs(margin - target) < 0.002) break;
    cal[COALITION_INDEX[winner]] += (target - margin) * 3;
  }
  return cal;
}

const DUN_CAL: number[][] = DUNS.map((d) => calibrate(d, DUN_START[d.index]));

export interface DunProjection {
  shares: Partial<Record<CoalitionId, number>>;
  leader: CoalitionId;
  margin: number;
}

/** Shares in every state seat today, from the same inputs as the parliamentary projection. */
export function projectDuns(inputs: VoterInputs, extra?: (d: DunSeat, c: CoalitionId) => number): DunProjection[] {
  const parent = SEATS.map((s) => seatShares(s, inputs));
  return DUNS.map((d) => {
    const sh = sharesFor(d, parent[d.parent], (c) => DUN_CAL[d.index][COALITION_INDEX[c]] + (extra ? extra(d, c) : 0));
    const [leader, v1, , v2] = topTwo(sh);
    return { shares: sh, leader, margin: v1 - v2 };
  });
}

export interface DunResult {
  dun: number;
  winner: CoalitionId;
  party: string;
  majority: number;
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-9);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** One state election. A fixed number of draws per state, so results are reproducible. */
export function runStateElection(inputs: VoterInputs, stateId: string, rngState: number): { results: DunResult[]; rngState: number } {
  const rng = new Rng(rngState);
  const stateNoise = Object.fromEntries(COALITIONS.map((c) => [c, gaussian(rng) * PRN.noise.state]));
  const ids = DUNS_BY_STATE[stateId];
  const seatNoise = ids.map(() => Object.fromEntries(COALITIONS.map((c) => [c, gaussian(rng) * PRN.noise.seat])));
  const all = projectDuns(inputs, (d, c) => {
    const k = ids.indexOf(d.index);
    return k < 0 ? 0 : stateNoise[c] + seatNoise[k][c];
  });
  const results = ids.map((d) => {
    const p = all[d];
    const cast = DUNS[d].electorate * 0.7;
    return { dun: d, winner: p.leader, party: candidateParty(SEATS[DUNS[d].parent], p.leader), majority: Math.round(p.margin * cast) };
  });
  return { results, rngState: rng.state };
}

/** Coalitions that field candidates in a state seat (same as its parliamentary seat). */
export function dunContesting(d: DunSeat): CoalitionId[] {
  return contestingIn(SEATS[d.parent]);
}
