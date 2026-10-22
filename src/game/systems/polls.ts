// What you can know about the race: opinion polls, not the model's true numbers.
// - A national poll every 4 weeks from a named pollster (house effect and ±3% error): vote shares and a seat estimate.
// - Constituency polls you commission in one seat (±4–7%, tighter where your machinery is strong).
// - Branch reports: free weekly reads (±8%) from seats where your machinery is at least 40.
// - Every read keeps the week it was taken and grows less certain as it ages.
// Noise comes from hash01, never the game RNG, so Skip 1 Month still equals four weeks. All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { Projection } from "../voter";
import { COALITIONS, SEATS, contestingIn, type CoalitionId, type Entries } from "../world";

export const POLLS = {
  nationalEvery: 4,
  nationalMoe: 0.03,
  /** A rough seat estimate from the national poll. */
  estimateMoe: 0.1,
  seatCost: 40_000,
  seatMoeMax: 0.065,
  seatMoeMin: 0.035,
  /** Machinery tightens a commissioned poll by this much per point. */
  seatMoePerMachinery: 0.0003,
  branchMachinery: 40,
  branchMoe: 0.08,
  /** Extra uncertainty per week of age. */
  agePerWeek: 0.006,
  /** What polling day itself adds to the margin (turnout, late swing, local noise). */
  electionSd: 0.045,
  keepNational: 8,
};

export const POLLSTERS = [
  { name: "Merdeka Center", house: 0 },
  { name: "Ilham Centre", house: 0.01 },
  { name: "O2 Research", house: -0.01 },
  { name: "Invoke Malaysia", house: 0.015 },
];

export type Shares = Partial<Record<CoalitionId, number>>;

export interface SeatRead {
  week: number;
  source: "poll" | "branch" | "estimate";
  pollster?: string;
  shares: Shares;
  /** Margin of error on each share (95%). */
  moe: number;
}

export interface NationalPoll {
  week: number;
  pollster: string;
  vote: Shares;
  seats: Record<CoalitionId, number>;
  /** Seats the poll calls within 5 points. */
  marginal: number;
  moe: number;
}

export interface Polls {
  national: NationalPoll[];
  seats: (SeatRead | null)[];
}

/** A standard normal draw from a hash (Box–Muller). */
function hashNormal(...key: (string | number)[]): number {
  const u = Math.max(hash01("pn1", ...key), 1e-9);
  const v = hash01("pn2", ...key);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** True shares plus sampling error (sd = moe / 1.96 per coalition), renormalised. */
function noisy(shares: Shares, moe: number, bias: number, ...key: (string | number)[]): Shares {
  const out: Shares = {};
  let total = 0;
  for (const c of Object.keys(shares) as CoalitionId[]) {
    const v = Math.max(0.002, shares[c]! + hashNormal(...key, c) * (moe / 1.96) + (c === COALITIONS[Math.floor(hash01("house", ...key) * 3)] ? bias : 0));
    out[c] = v;
    total += v;
  }
  for (const c of Object.keys(out) as CoalitionId[]) out[c]! /= total;
  return out;
}

const leaderOf = (shares: Shares): [CoalitionId, number] => {
  const sorted = (Object.entries(shares) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]);
  return [sorted[0][0], sorted[0][1] - (sorted[1]?.[1] ?? 0)];
};

export function nationalPoll(projections: Projection[], seed: number, week: number, errorMult: number): NationalPoll {
  const p = POLLSTERS[Math.floor(hash01("pollster", seed, week) * POLLSTERS.length)];
  const moe = POLLS.nationalMoe * errorMult;
  const vote: Shares = {};
  let total = 0;
  projections.forEach((pr, i) => {
    const w = SEATS[i].electorate;
    total += w;
    for (const c of Object.keys(pr.shares) as CoalitionId[]) vote[c] = (vote[c] ?? 0) + pr.shares[c]! * w;
  });
  for (const c of Object.keys(vote) as CoalitionId[]) vote[c]! /= total;
  const seats = Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<CoalitionId, number>;
  let marginal = 0;
  projections.forEach((pr, i) => {
    const [leader, margin] = leaderOf(noisy(pr.shares, POLLS.estimateMoe * errorMult * 0.6, p.house, "nseat", seed, week, i));
    seats[leader]++;
    if (margin < 0.05) marginal++;
  });
  return { week, pollster: p.name, vote: noisy(vote, moe, p.house, "nvote", seed, week), seats, marginal, moe };
}

export function commissionedRead(pr: Projection, seed: number, week: number, seat: number, machinery: number, errorMult: number): SeatRead {
  const moe = Math.max(POLLS.seatMoeMin, POLLS.seatMoeMax - machinery * POLLS.seatMoePerMachinery) * errorMult;
  const p = POLLSTERS[Math.floor(hash01("spollster", seed, week, seat) * POLLSTERS.length)];
  return { week, source: "poll", pollster: p.name, moe, shares: noisy(pr.shares, moe, p.house, "spoll", seed, week, seat) };
}

/** A rough guess for a seat with no recent read, from the latest national poll. */
export function estimateRead(pr: Projection, seed: number, pollWeek: number, seat: number, errorMult: number): SeatRead {
  const moe = POLLS.estimateMoe * errorMult;
  return { week: pollWeek, source: "estimate", moe, shares: noisy(pr.shares, moe, 0, "est", seed, pollWeek, seat) };
}

/** How uncertain a read is now. */
export function effectiveMoe(r: SeatRead, week: number): number {
  return r.moe + Math.max(0, week - r.week) * POLLS.agePerWeek;
}

/** Weekly: new national poll every 4 weeks, and branch reports where your machinery is strong. */
export function pollsWeek(polls: Polls, projections: Projection[], seed: number, week: number, player: CoalitionId, machinery: number[], errorMult: number, entries?: Entries): Polls {
  let national = polls.national;
  if (week % POLLS.nationalEvery === 0 && national[0]?.week !== week) national = [nationalPoll(projections, seed, week, errorMult), ...national].slice(0, POLLS.keepNational);
  const seats = polls.seats.map((old, i) => {
    if (machinery[i] < POLLS.branchMachinery || !contestingIn(SEATS[i], entries).includes(player)) return old;
    const moe = POLLS.branchMoe * errorMult * (1 - (machinery[i] - POLLS.branchMachinery) / 150);
    if (old && effectiveMoe(old, week) <= moe) return old;
    return { week, source: "branch" as const, moe, shares: noisy(projections[i].shares, moe, 0, "branch", seed, week, i) };
  });
  return { national, seats };
}

export function initPolls(projections: Projection[], seed: number, week: number, errorMult: number): Polls {
  return { national: [nationalPoll(projections, seed, week, errorMult)], seats: SEATS.map(() => null) };
}

/** Standard normal CDF. */
function phi(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Your chance of winning a seat, from a read: the polled margin against the poll's error, its age and polling-day noise. */
export function winChance(r: SeatRead, player: CoalitionId, week: number): number | null {
  const mine = r.shares[player];
  if (mine === undefined) return null;
  let best = 0;
  for (const c of Object.keys(r.shares) as CoalitionId[]) if (c !== player) best = Math.max(best, r.shares[c]!);
  const margin = mine - best;
  const sd = Math.sqrt(((effectiveMoe(r, week) / 1.96) * 1.4) ** 2 + POLLS.electionSd ** 2);
  return phi(margin / sd);
}

export type ChanceBand = "safe" | "likely" | "lean" | "tossup" | "leanLose" | "likelyLose" | "safeLose";
export const CHANCE_LABEL: Record<ChanceBand, string> = {
  safe: "Safe",
  likely: "Likely win",
  lean: "Leaning your way",
  tossup: "Toss-up",
  leanLose: "Leaning away",
  likelyLose: "Likely loss",
  safeLose: "Out of reach",
};

export function chanceBand(p: number): ChanceBand {
  if (p >= 0.9) return "safe";
  if (p >= 0.7) return "likely";
  if (p >= 0.56) return "lean";
  if (p > 0.44) return "tossup";
  if (p > 0.3) return "leanLose";
  if (p > 0.1) return "likelyLose";
  return "safeLose";
}

/** The best read you have for a seat: a poll or branch report, else a rough estimate from the national poll. */
export function bestRead(polls: Polls, projections: Projection[], seed: number, seat: number, week: number, errorMult: number): SeatRead {
  const r = polls.seats[seat];
  const n = polls.national[0];
  const est = estimateRead(projections[seat], seed, n?.week ?? week, seat, errorMult);
  if (!r) return est;
  return effectiveMoe(r, week) <= effectiveMoe(est, week) ? r : est;
}

export { leaderOf };
