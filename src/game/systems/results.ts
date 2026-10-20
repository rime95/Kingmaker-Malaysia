// The latest election result in each parliamentary seat: GE15 (real) until the game holds its own election there,
// then every simulated general election and by-election replaces it.

import { GE15_RESULTS } from "../data/ge15";
import type { SeatResult } from "../election";
import { COALITIONS, SEATS, type CoalitionId } from "../world";
import { makeName, recruitBloc } from "./names";

/** A simulated result, as saved: votes and ballot party per coalition. */
export interface SeatRecord {
  label: string;
  week: number;
  turnout: number;
  votes: Partial<Record<CoalitionId, number>>;
  parties: Partial<Record<CoalitionId, string>>;
  /** Who stood for each coalition. */
  names?: Partial<Record<CoalitionId, string>>;
}

export interface Candidate {
  name: string;
  party: string;
  coalition: CoalitionId;
  votes: number;
  share: number;
}

export interface ResultView {
  /** "GE15", "GE16", "By-election". */
  label: string;
  /** Null for GE15 (19 Nov 2022). */
  week: number | null;
  electors: number;
  valid: number;
  turnout: number;
  majority: number;
  /** Winner first. */
  candidates: Candidate[];
}

const KNOWN = new Set<string>(COALITIONS);

/** "PN-PAS" → coalition PN, party PAS; anything outside the game's coalitions counts as Others. */
export function splitLabel(label: string): { coalition: CoalitionId; party: string } {
  const [head, ...rest] = label.split("-");
  if (!rest.length) return { coalition: KNOWN.has(head) ? (head as CoalitionId) : "OTHERS", party: head };
  return { coalition: KNOWN.has(head) ? (head as CoalitionId) : "OTHERS", party: rest.join("-") };
}

/** GE15 candidates, indexed by seat. */
const GE15: Candidate[][] = GE15_RESULTS.map(([, , valid, cands]) =>
  cands.map(([name, label, votes]) => ({ name, ...splitLabel(label), votes, share: votes / valid })),
);

/** Who stood for a coalition in a seat at GE15 (real people stand again), if anyone did. */
export function ge15Candidate(seat: number, c: CoalitionId, party?: string): string | null {
  const hit = GE15[seat].find((x) => x.coalition === c && c !== "OTHERS" && (!party || x.party === party));
  return hit?.name ?? null;
}

export function recordFrom(r: SeatResult, label: string, week: number, parties: Partial<Record<CoalitionId, string>>, names?: Partial<Record<CoalitionId, string>>): SeatRecord {
  return { label, week, turnout: r.turnout, votes: r.votes, parties, names };
}

/** A losing candidate's name: whoever stood for that party here at GE15, else a local party member. */
export function standingName(seed: number, seat: number, c: CoalitionId, party: string, label: string): string {
  return ge15Candidate(seat, c, party) ?? makeName(recruitBloc(party, SEATS[seat].demo.ethnic, seed, seat, party, label), seed, seat, party, label);
}

export function resultView(records: (SeatRecord | null)[], i: number): ResultView {
  const rec = records[i];
  if (!rec) {
    const [, electors, valid] = GE15_RESULTS[i];
    const c = GE15[i];
    return { label: "GE15", week: null, electors, valid, turnout: valid / electors, majority: c[0].votes - (c[1]?.votes ?? 0), candidates: c };
  }
  const valid = Object.values(rec.votes).reduce((a, b) => a + (b ?? 0), 0);
  const candidates = (Object.entries(rec.votes) as [CoalitionId, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([c, votes]) => {
      const party = rec.parties[c] ?? c;
      return { name: rec.names?.[c] ?? ge15Candidate(i, c, party) ?? `${party} candidate`, party, coalition: c, votes, share: votes / Math.max(1, valid) };
    });
  return {
    label: rec.label,
    week: rec.week,
    electors: SEATS[i].electorate,
    valid,
    turnout: rec.turnout,
    majority: candidates[0].votes - (candidates[1]?.votes ?? 0),
    candidates,
  };
}
