// The morning after: what happened at a general election and why. Built at the count from the state just before
// polling day (your effort, polls, projection) and the result, then kept for the analysis screen and the swing lens.

import type { ElectionResult } from "../election";
import { projectAll, type VoterInputs } from "../voter";
import { cshort, SEATS, STATES, STATE_BY_ID, type Bloc, type CoalitionId } from "../world";
import type { GameState } from "../state";
import { seatBreakdown } from "../state";
import { resultView } from "./results";
import { standsAside } from "./pacts";

export interface SeatNote {
  i: number;
  /** Your share before and after, and your margin now (+ ahead / − behind the winner). */
  before: number;
  after: number;
  margin: number;
  /** Votes you were short by (losses and near misses). */
  short?: number;
  /** Your pull in the seat by source on polling day. */
  why: { label: string; value: number }[];
}

export interface GroupShift {
  group: string;
  before: number;
  after: number;
}

export interface StateShift {
  state: string;
  name: string;
  before: number;
  after: number;
  voteBefore: number;
  voteAfter: number;
}

export interface Analysis {
  label: string;
  week: number;
  player: CoalitionId;
  seats: { before: number; after: number; projected: number; polled: number | null };
  vote: { before: number; after: number; polled: number | null };
  turnout: number;
  /** Your change in vote share in every seat (null where you stood neither time). */
  swing: (number | null)[];
  gains: SeatNote[];
  losses: SeatNote[];
  nearMisses: SeatNote[];
  best: SeatNote[];
  deposits: number[];
  groups: GroupShift[];
  states: StateShift[];
  /** Seats won where the pact partner stood aside. */
  pactSeats: number;
  pundits: string[];
}

const GROUPS: { id: Bloc | "urban" | "rural" | "youth"; label: string; w: (i: number) => number }[] = [
  { id: "malay", label: "Malay voters", w: (i) => SEATS[i].demo.ethnic.malay },
  { id: "chinese", label: "Chinese voters", w: (i) => SEATS[i].demo.ethnic.chinese },
  { id: "indian", label: "Indian voters", w: (i) => SEATS[i].demo.ethnic.indian },
  { id: "sabah", label: "Sabah bumiputera", w: (i) => SEATS[i].demo.ethnic.sabah },
  { id: "sarawak", label: "Sarawak bumiputera", w: (i) => SEATS[i].demo.ethnic.sarawak },
  { id: "urban", label: "Urban seats", w: (i) => SEATS[i].demo.urbanity },
  { id: "rural", label: "Rural seats", w: (i) => 1 - SEATS[i].demo.urbanity },
  { id: "youth", label: "Young voters", w: (i) => SEATS[i].demo.youth / 0.3 },
];

const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;

/** Your vote share in a seat from a record of votes (0 if you didn't stand). */
function shareIn(votes: Partial<Record<CoalitionId, number>>, c: CoalitionId) {
  const total = Object.values(votes).reduce((a, b) => a + (b ?? 0), 0);
  return total ? (votes[c] ?? 0) / total : 0;
}

/** Everything the analysis screen shows, from the state at the count and the result. */
export function buildAnalysis(s: GameState, inputs: VoterInputs, result: ElectionResult, label: string): Analysis {
  const me = s.player;
  const prev = SEATS.map((_, i) => {
    const r = resultView(s.seatResults, i);
    return { votes: Object.fromEntries(r.candidates.map((c) => [c.coalition, c.votes])) as Partial<Record<CoalitionId, number>>, valid: r.valid, stood: r.candidates.some((c) => c.coalition === me) };
  });
  const before = prev.map((p) => shareIn(p.votes, me));
  const after = result.seats.map((r) => shareIn(r.votes, me));
  const stoodNow = result.seats.map((r) => r.votes[me] !== undefined);
  const swing = SEATS.map((_, i) => (prev[i].stood || stoodNow[i] ? after[i] - before[i] : null));
  const marginOf = (i: number) => {
    const r = result.seats[i];
    const total = Object.values(r.votes).reduce((a, b) => a + (b ?? 0), 0) || 1;
    const best = Math.max(0, ...(Object.entries(r.votes) as [CoalitionId, number][]).filter(([c]) => c !== me).map(([, v]) => v));
    return { margin: ((r.votes[me] ?? 0) - best) / total, votes: (r.votes[me] ?? 0) - best };
  };
  const note = (i: number): SeatNote => {
    const m = marginOf(i);
    return {
      i,
      before: before[i],
      after: after[i],
      margin: m.margin,
      short: m.votes < 0 ? Math.floor(-m.votes / 2) + 1 : undefined,
      why: seatBreakdown(s, i)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 4),
    };
  };
  const wonNow = result.seats.map((r) => r.winner === me);
  const heldBefore = s.holders.map((h) => h === me);
  const gains = SEATS.map((x) => x.index).filter((i) => wonNow[i] && !heldBefore[i]);
  const losses = SEATS.map((x) => x.index).filter((i) => !wonNow[i] && heldBefore[i]);
  const near = SEATS.map((x) => x.index)
    .filter((i) => !wonNow[i] && stoodNow[i] && marginOf(i).margin > -0.05)
    .sort((a, b) => marginOf(b).margin - marginOf(a).margin);
  const best = SEATS.map((x) => x.index)
    .filter((i) => swing[i] !== null && stoodNow[i])
    .sort((a, b) => swing[b]! - swing[a]!)
    .slice(0, 5);
  const deposits = SEATS.map((x) => x.index).filter((i) => stoodNow[i] && after[i] < 0.125);

  // National vote and turnout.
  const sum = (f: (i: number) => number) => SEATS.reduce((a, x) => a + f(x.index), 0);
  const validNow = result.seats.map((r) => Object.values(r.votes).reduce((a, b) => a + (b ?? 0), 0));
  const voteAfter = sum((i) => result.seats[i].votes[me] ?? 0) / Math.max(1, sum((i) => validNow[i]));
  const voteBefore = sum((i) => prev[i].votes[me] ?? 0) / Math.max(1, sum((i) => prev[i].valid));
  const turnout = sum((i) => validNow[i]) / Math.max(1, sum((i) => SEATS[i].electorate));

  // Groups: an estimate, weighting each seat's result by how many of the group live there.
  const groups = GROUPS.map((g) => {
    const w = (i: number) => g.w(i) * SEATS[i].electorate;
    const W = sum(w) || 1;
    return { group: g.label, before: sum((i) => w(i) * before[i]) / W, after: sum((i) => w(i) * after[i]) / W };
  }).filter((g) => g.before > 0.005 || g.after > 0.005);

  const states = STATES.map((st) => {
    const idx = SEATS.filter((x) => x.state === st.id).map((x) => x.index);
    const v = (arr: number[], valid: (i: number) => number) => idx.reduce((a, i) => a + arr[i] * valid(i), 0) / Math.max(1, idx.reduce((a, i) => a + valid(i), 0));
    return {
      state: st.id,
      name: st.name,
      before: idx.filter((i) => heldBefore[i]).length,
      after: idx.filter((i) => wonNow[i]).length,
      voteBefore: v(before, (i) => prev[i].valid),
      voteAfter: v(after, (i) => validNow[i]),
    };
  }).filter((x) => x.before || x.after || x.voteAfter > 0.02);

  const poll = s.polls.national[0];
  const projected = projectAll(inputs).filter((p) => p.leader === me).length;
  const pactSeats = s.pacts.length ? SEATS.filter((x) => wonNow[x.index] && s.pacts.some((p) => standsAside(s, x.index, p.with))).length : 0;
  const seatsBefore = heldBefore.filter(Boolean).length;
  const seatsAfter = result.totals[me] ?? 0;

  // What the pundits say.
  const pundits: string[] = [];
  const d = seatsAfter - seatsBefore;
  pundits.push(`${cshort(me)} ${d > 0 ? `gained ${d}` : d < 0 ? `lost ${-d}` : "held steady at"} seat${Math.abs(d) === 1 ? "" : "s"}${d ? `, to ${seatsAfter}` : ` ${seatsAfter}`}, on a national vote of ${(voteAfter * 100).toFixed(1)}% (${pts(voteAfter - voteBefore)} points).`);
  // The story of the night: the biggest shift among groups where you have a real following.
  const g = groups.filter((x) => Math.max(x.before, x.after) >= 0.08).sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))[0];
  if (g && Math.abs(g.after - g.before) > 0.01) pundits.push(`The story of the night: ${g.group.toLowerCase()} ${g.after > g.before ? "swung towards" : "turned away from"} you (${pts(g.after - g.before)} points).`);
  const st = [...states].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))[0];
  if (st && st.after !== st.before) pundits.push(`${st.name} decided it: ${st.after > st.before ? `${st.after - st.before} gains` : `${st.before - st.after} losses`} there.`);
  if (poll) {
    const err = seatsAfter - (poll.seats[me] ?? 0);
    if (Math.abs(err) >= 3) pundits.push(`The final polls ${err > 0 ? "underestimated" : "overestimated"} you by ${Math.abs(err)} seats.`);
  }
  const close = near.filter((i) => (marginOf(i).votes ?? 0) > -1000).length;
  if (close) pundits.push(`${close} seat${close === 1 ? " was" : "s were"} lost by fewer than 1,000 votes. Another push would have flipped ${close === 1 ? "it" : "them"}.`);
  if (pactSeats) pundits.push(`Your seat pacts delivered: ${pactSeats} seats won in one-on-one fights.`);
  if (deposits.length) pundits.push(`${deposits.length} candidate${deposits.length === 1 ? "" : "s"} lost their deposit (under 12.5% of the vote), mostly where your voters hardly live.`);
  if (gains.length) {
    const top = gains
      .map((i) => note(i))
      .flatMap((n) => n.why)
      .reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.label]: (acc[w.label] ?? 0) + w.value }), {});
    const k = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
    if (k) pundits.push(`Where you gained, it was mostly ${k[0].split(" (")[0].toLowerCase()}.`);
  }

  return {
    label,
    week: s.week,
    player: me,
    seats: { before: seatsBefore, after: seatsAfter, projected, polled: poll ? (poll.seats[me] ?? 0) : null },
    vote: { before: voteBefore, after: voteAfter, polled: poll ? (poll.vote[me] ?? 0) : null },
    turnout,
    swing,
    gains: gains.map(note),
    losses: losses.map(note),
    nearMisses: near.slice(0, 8).map(note),
    best: best.map(note),
    deposits,
    groups,
    states,
    pactSeats,
    pundits,
  };
}

export const stateName = (id: string) => STATE_BY_ID[id]?.name ?? id;
