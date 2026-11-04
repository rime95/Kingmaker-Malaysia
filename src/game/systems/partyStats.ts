// A party in the Dewan at a glance: for the hover card on the 2D and 3D chamber. Pure, from the game state.

import type { GameState } from "../state";
import { PARTIES, SEATS, TOTAL_SEATS, type CoalitionId } from "../world";
import { coalitionOf } from "./coalitions";
import { leaderOfParty } from "./people";
import { isWoman } from "./gender";
import type { Vote } from "./dewan";

export interface PartyStats {
  party: string;
  name: string;
  coalition: CoalitionId;
  side: "government" | "opposition";
  seats: number;
  /** Share of the whole House (0–1). */
  share: number;
  /** Seats won at the last general election (GE15 before the first one). */
  seatsAtGE: number;
  leader: string | null;
  /** Cabinet posts held (in government) or shadow posts (your party in opposition). */
  posts: number;
  women: number;
  /** How its MPs voted in a division, when one is given. */
  votes: Partial<Record<Vote, number>> | null;
}

/** Each seat's winning margin at the last general election, as a share of the votes cast (0–1). */
export function marginOf(s: Pick<GameState, "lastElection">, seat: number): number {
  const r = s.lastElection?.seats[seat];
  if (r) {
    const cast = Object.values(r.votes).reduce((a, b) => a + (b ?? 0), 0);
    return cast ? r.majority / cast : 0;
  }
  const g = SEATS[seat];
  return g.ge15Valid ? g.ge15Majority / g.ge15Valid : 0;
}

export function partyStats(s: GameState, party: string, votes?: Vote[]): PartyStats {
  const seatsHeld = SEATS.map((x) => x.index).filter((i) => s.holderParties[i] === party);
  const coalition = coalitionOf(s, party);
  const atGE = s.lastElection ? s.lastElection.seats.filter((r) => r.winnerParty === party).length : SEATS.filter((x) => x.ge15Party === party).length;
  const mps = s.people.filter((p) => p.seat !== null && p.party === party);
  const ids = new Set(mps.map((p) => p.id));
  const inGov = s.government.includes(coalition);
  const posts = inGov
    ? Object.values(s.cabinet).filter((id) => id !== undefined && ids.has(id)).length
    : Object.values(s.opp?.shadow ?? {}).filter((id) => id !== undefined && ids.has(id)).length;
  let tally: PartyStats["votes"] = null;
  if (votes) {
    tally = {};
    for (const i of seatsHeld) tally[votes[i]] = (tally[votes[i]] ?? 0) + 1;
  }
  return {
    party,
    name: PARTIES[party]?.name ?? party,
    coalition,
    side: inGov ? "government" : "opposition",
    seats: seatsHeld.length,
    share: seatsHeld.length / TOTAL_SEATS,
    seatsAtGE: atGE,
    leader: leaderOfParty(s, party)?.name ?? PARTIES[party]?.leader ?? null,
    posts,
    women: mps.filter(isWoman).length,
    votes: tally,
  };
}
