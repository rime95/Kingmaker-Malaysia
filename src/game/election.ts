// A simulated polling day: turnout, noisy vote shares, winners and the order seats are called on Election Night.

import { ELECTION_NOISE, TURNOUT } from "./config";
import { Rng } from "./rng";
import { seatShares, topTwo, type VoterInputs } from "./voter";
import { COALITIONS, SEATS, STATES, candidateParty, type CoalitionId, type Seat } from "./world";

export interface SeatResult {
  seatIndex: number;
  turnout: number;
  votes: Partial<Record<CoalitionId, number>>;
  winner: CoalitionId;
  winnerParty: string;
  runnerUp: CoalitionId | null;
  majority: number;
  /** 0 = first seat called on the night. */
  callOrder: number;
}

export interface ElectionResult {
  seats: SeatResult[];
  totals: Record<CoalitionId, number>;
  popularVote: Record<CoalitionId, number>;
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-9);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A single-seat by-election: local noise only, lower turnout. */
/** Which party a coalition fields in a seat (defaults to the starting line-up). */
export type PartyOf = (seat: Seat, c: CoalitionId) => string;

export function runSeatElection(inputs: VoterInputs, seatIndex: number, rngState: number, partyOf: PartyOf = candidateParty): { result: SeatResult; rngState: number } {
  const rng = new Rng(rngState);
  const seat = SEATS[seatIndex];
  const noise = Object.fromEntries(COALITIONS.map((c) => [c, gaussian(rng) * (ELECTION_NOISE.seat + ELECTION_NOISE.state)]));
  const shares = seatShares(seat, inputs, (c) => noise[c]);
  const turnout = Math.min(TURNOUT.max, Math.max(TURNOUT.min, TURNOUT.base - 0.15 - seat.demo.youth * TURNOUT.youthPenalty + gaussian(rng) * TURNOUT.noise));
  const cast = Math.round(seat.electorate * turnout);
  const votes: Partial<Record<CoalitionId, number>> = {};
  for (const c of Object.keys(shares) as CoalitionId[]) if (shares[c]! > 0.001) votes[c] = Math.round(cast * shares[c]!);
  const [winner, v1, runnerUp, v2] = topTwo(votes);
  return {
    result: { seatIndex, turnout, votes, winner, winnerParty: partyOf(seat, winner), runnerUp, majority: v1 - v2, callOrder: 0 },
    rngState: rng.state,
  };
}

/** Runs one general election. Uses a fixed number of draws so results are reproducible from the seed. */
export function runElection(inputs: VoterInputs, rngState: number, partyOf: PartyOf = candidateParty): { result: ElectionResult; rngState: number } {
  const rng = new Rng(rngState);
  const national = Object.fromEntries(COALITIONS.map((c) => [c, gaussian(rng) * ELECTION_NOISE.national]));
  const byState: Record<string, Record<string, number>> = {};
  for (const st of STATES) byState[st.id] = Object.fromEntries(COALITIONS.map((c) => [c, gaussian(rng) * ELECTION_NOISE.state]));

  const totals = Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<CoalitionId, number>;
  const popularVote = { ...totals };
  const seats: (SeatResult & { sortKey: number })[] = SEATS.map((seat) => {
    const seatNoise = Object.fromEntries(COALITIONS.map((c) => [c, gaussian(rng) * ELECTION_NOISE.seat]));
    const shares = seatShares(seat, inputs, (c) => national[c] + byState[seat.state][c] + seatNoise[c]);
    const turnout = Math.min(TURNOUT.max, Math.max(TURNOUT.min, TURNOUT.base - seat.demo.youth * TURNOUT.youthPenalty + gaussian(rng) * TURNOUT.noise));
    const cast = Math.round(seat.electorate * turnout);
    const votes: Partial<Record<CoalitionId, number>> = {};
    for (const c of Object.keys(shares) as CoalitionId[]) {
      if (shares[c]! <= 0.001) continue;
      votes[c] = Math.round(cast * shares[c]!);
      popularVote[c] += votes[c]!;
    }
    const [winner, v1, runnerUp, v2] = topTwo(votes);
    totals[winner] += 1;
    return {
      seatIndex: seat.index,
      turnout,
      votes,
      winner,
      winnerParty: partyOf(seat, winner),
      runnerUp,
      majority: v1 - v2,
      callOrder: 0,
      // Small rural seats are counted first; big urban seats and close races come in late.
      sortKey: seat.electorate * (0.8 + rng.next() * 0.4) + (v1 - v2 < 2000 ? 60000 : 0),
    };
  });

  [...seats].sort((a, b) => a.sortKey - b.sortKey).forEach((s, i) => (s.callOrder = i));
  return {
    result: { seats: seats.map((s) => ({ ...s, sortKey: undefined })), totals, popularVote },
    rngState: rng.state,
  };
}
