// How a small party gets to power (any party can use these):
// - Roots: where you win a real share of the vote, part of it becomes loyal for good. Growth compounds across elections
//   instead of starting from your thin natural base every time.
// - Recruiting: invite an unhappy party to join your coalition, MPs and all. Invite a small coalition's lead party and
//   the whole coalition merges into yours.
// - The compromise Prime Minister: in a hung parliament, the kingmaker can demand the top job as the price of its seats
//   (as Bersatu's ~30 seats did in 2020). The big bloc agrees if it can't get there any other way and doesn't hate you.
// All draws are hash01. Numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, MAJORITY, PARTIES, cshort, type CoalitionId } from "../world";
import { AFFINITY } from "./formation";
import { naturalSupport } from "../voter";
import { edgeOf } from "../config";
import { coalitionOf, moveParty } from "./coalitions";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

// --- The underdog ---------------------------------------------------------------------------------

/** 1 for a one-seat party, fading to 0 by 40 seats: big parties ignore you, and a rising newcomer gets a hearing. */
export const underdog = (seats: number) => Math.max(0, Math.min(1, (UNDERDOG.seats - seats) / UNDERDOG.seats));
export const UNDERDOG = { seats: 40, rivalCut: 0.5, recruit: 0.2, compromise: 0.2, momentum: 2, volunteers: 0.5, crowdfund: 40_000 };

// --- Converts -------------------------------------------------------------------------------------

export const CONVERT = {
  /** Weekly share of a seat's voters won over at full buzz and service above base, and the most you can hold. */
  rate: 0.0012,
  max: 0.3,
  /** Weekly fade when you stop working a seat. */
  fade: 0.004,
};

/** Weekly: in seats you work hard, some voters become yours for good; neglected seats slowly drift back. */
export function convertsWeek(s: GameState, contested: number[], serviceBase: (i: number) => number): number[] {
  const out = [...(s.converts ?? [])];
  for (let i = 0; i < out.length; i++) {
    if (!contested.includes(i)) {
      out[i] *= 1 - CONVERT.fade;
      continue;
    }
    const work = Math.min(1, s.me.buzz[i] / 100) * 0.5 + Math.min(1, Math.max(0, s.me.service[i] - serviceBase(i)) / 80) * 0.5;
    // Converting voters is how small parties grow; big ones mostly hold who they have.
    const pace = CONVERT.rate * edgeOf(s) * (0.1 + 0.9 * underdog(s.holders.filter((h) => h === s.player).length));
    out[i] = work > 0.25 ? Math.min(CONVERT.max, out[i] + pace * work * (1 - out[i] / CONVERT.max)) : out[i] * (1 - CONVERT.fade);
  }
  return out;
}

// --- Roots ----------------------------------------------------------------------------------------

export const ROOTS = {
  /** A seat's vote share above this starts to put down roots. */
  from: 0.12,
  /** Log-odds gained per election for each point of share above `from`, and the caps. */
  per: 0.01,
  perElection: 0.25,
  max: 0.8,
  /** Where you collapse, roots wither by this share. */
  wither: 0.3,
};

/** After a general election: roots grow where you beat your natural base, and wither where you collapsed. */
export function growRoots(roots: number[], shares: number[], c: CoalitionId, seats: number): number[] {
  // Putting down new roots is how small parties grow; a big one mostly holds its ground.
  const pace = 0.2 + 0.8 * underdog(seats);
  return roots.map((r, i) => {
    const sh = shares[i];
    // Votes you'd get anyway (your bloc lean) don't count: only the voters you won over.
    const floor = Math.max(ROOTS.from, naturalSupport(i, c));
    if (sh >= floor) return Math.min(ROOTS.max, r + Math.min(ROOTS.perElection, (sh - floor) * 100 * ROOTS.per) * pace);
    if (sh < ROOTS.from / 2) return r * (1 - ROOTS.wither);
    return r;
  });
}

// --- Recruiting parties ---------------------------------------------------------------------------

export const RECRUIT = { ap: 2, capital: 15, perMp: 400_000, minCost: 500_000, cooldown: 26, threshold: 0.35, smallSeats: 30, smallBonus: 0.15, dominantPenalty: 0.4 };

const seatsOf = (s: GameState, c: CoalitionId) => s.holders.filter((h) => h === c).length;

/** What it costs to bring a party over: posts, allocations and sweeteners for each of its MPs (a whole coalition for a lead party). */
export function recruitCost(s: GameState, party: string): number {
  const from = coalitionOf(s, party);
  const parties = s.coalitions[from].members[0] === party ? s.coalitions[from].members : [party];
  const mps = s.holderParties.filter((p) => parties.includes(p)).length;
  return Math.max(RECRUIT.minCost, mps * RECRUIT.perMp);
}

/** Parties you could invite: anyone outside your coalition (a coalition's lead party brings the whole coalition). */
export function recruitTargets(s: GameState): string[] {
  return COALITIONS.filter((c) => c !== s.player && c !== "OTHERS").flatMap((c) => s.coalitions[c].members);
}

/** How willing a party is to join you (above the threshold, they say yes). */
export function recruitWillingness(s: GameState, party: string): number {
  const from = coalitionOf(s, party);
  const lead = s.coalitions[from].members[0] === party;
  const sat = lead ? 50 + (s.government.includes(from) ? 10 : -5) : (s.partySat[party] ?? 55);
  const mine = Math.max(1, seatsOf(s, s.player));
  const theirs = Math.max(1, seatsOf(s, from));
  // Parties leave because they're unhappy where they are; liking you and your momentum help them decide.
  let w = (50 - sat) / 30 + (AFFINITY[from]?.[s.player] ?? 0) * 0.5 + (s.me.momentum ?? 0) / 500;
  // In a small, rising coalition a newcomer gets the big posts; in a dominant one it gets swallowed.
  if (mine < RECRUIT.smallSeats) w += RECRUIT.smallBonus;
  w += underdog(mine) * UNDERDOG.recruit + (edgeOf(s) - 1) * 0.4;
  if (mine > MAJORITY) w -= RECRUIT.dominantPenalty + (mine - MAJORITY) / 40;
  if (lead) w -= 0.25 + Math.max(0, theirs - Math.max(mine, RECRUIT.smallSeats)) / 40; // A whole coalition merging is a big ask.
  return w;
}

export function recruitBlocked(s: GameState, party: string): string | null {
  if (s.career.rung < 6) return "Only the party president does this.";
  if (!recruitTargets(s).includes(party)) return "They're already with you.";
  if (s.me.ap < RECRUIT.ap) return `Needs ${RECRUIT.ap} AP.`;
  if (s.me.capital < RECRUIT.capital) return `Needs ${RECRUIT.capital} political capital.`;
  if (s.me.funds < recruitCost(s, party)) return `Needs ${(recruitCost(s, party) / 1e6).toFixed(1)}M.`;
  if ((s.cardLast[`recruit:${party}`] ?? -99) > s.week - RECRUIT.cooldown) return "They said no recently.";
  return null;
}

/** Invite a party (or, through its lead party, a whole coalition) to join yours. */
export function recruitParty(s: GameState, party: string): { state: GameState; message: string } | { error: string } {
  const why = recruitBlocked(s, party);
  if (why) return { error: why };
  const from = coalitionOf(s, party);
  const lead = s.coalitions[from].members[0] === party;
  const paid: GameState = { ...s, me: { ...s.me, ap: s.me.ap - RECRUIT.ap, capital: s.me.capital - RECRUIT.capital, funds: s.me.funds - recruitCost(s, party) }, cardLast: { ...s.cardLast, [`recruit:${party}`]: s.week } };
  const w = recruitWillingness(s, party) + (hash01("recruit", s.seed, s.week, party) - 0.5) * 0.2;
  if (w < RECRUIT.threshold) return { state: paid, message: `${PARTIES[party]?.name ?? party} turns you down, for now.` };
  let state = paid;
  const moving = lead ? [...s.coalitions[from].members] : [party];
  for (const p of moving) state = moveParty(state, p, s.player);
  const gained = state.holders.filter((h) => h === s.player).length - seatsOf(s, s.player);
  const people = state.people.map((x) => (moving.includes(x.party) ? { ...x, loyalty: clamp(x.loyalty + 15) } : x));
  return {
    state: { ...state, people, me: { ...state.me, nationalBuzz: clamp(state.me.nationalBuzz + 6) } },
    message: lead
      ? `${cshort(from)} merges into your coalition: ${moving.join(", ")} join you with ${gained} MPs.`
      : `${PARTIES[party]?.name ?? party} leaves ${cshort(from)} and joins you with ${gained} MPs.`,
  };
}

// --- The compromise Prime Minister ----------------------------------------------------------------

/** Will a candidate accept you as Prime Minister in return for your seats? Needs you to be decisive. */
export function compromiseOdds(s: GameState, seats: Record<CoalitionId, number>, committed: Partial<Record<CoalitionId, CoalitionId>>, leader: CoalitionId): number {
  const theirs = (Object.entries(committed) as [CoalitionId, CoalitionId][]).filter(([c, l]) => l === leader && c !== s.player).reduce((a, [c]) => a + seats[c], 0);
  const mine = seats[s.player] ?? 0;
  if (theirs >= MAJORITY || theirs + mine < MAJORITY - 8) return 0;
  const aff = AFFINITY[leader]?.[s.player] ?? 0;
  // Being decisive, being liked and being a real force all help; asking a party far bigger than you is hard.
  // Big blocs also like a weak Prime Minister they think they can control.
  return clamp(0.35 + aff * 0.5 + Math.min(0.25, mine / 120) - Math.max(0, seats[leader] - mine * 3) / 400 + underdog(mine) * UNDERDOG.compromise + (edgeOf(s) - 1) * 0.6, 0, 0.95);
}

export const compromiseLine = (leader: CoalitionId, ok: boolean): ReportLine =>
  ok
    ? { text: `${cshort(leader)} accepts your price: you become Prime Minister at the head of a compromise government.`, tone: "good" }
    : { text: `${cshort(leader)} refuses to serve under you. Without your seats, they look elsewhere.`, tone: "bad" };

