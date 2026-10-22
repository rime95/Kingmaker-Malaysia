// Running the party: the Youth and Wanita wings, the Supreme Council's meetings, and discipline.
// - Wings (0–100) drift down unless you fund them. A strong Youth wing wins young voters and gets the vote out; a
//   strong Wanita wing works every kampung and grows the membership.
// - The Supreme Council meets every eight weeks with one item on its agenda: a real choice with a cost either way.
// - Discipline: a show-cause letter brings a wavering MP into line; sacking one makes them an independent (the seat goes
//   with them) but shows who's in charge. Numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState } from "../state";
import { mpOf } from "./people";
import { segValue } from "./segments";
import { SEATS } from "../world";

export interface Wings {
  youth: number;
  women: number;
}

export const WINGS = { start: 50, rest: 40, drift: 0.01, fund: 12, cost: 300_000, ap: 1, youthPull: 0.0012, womenPull: 0.0006, womenMembers: 0.0004 };

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** The wings' pull in a seat (log-odds). */
export function wingsEffect(s: Pick<GameState, "wings">, i: number): number {
  return segValue(i, { youth: (s.wings.youth - 50) * WINGS.youthPull, all: (s.wings.women - 50) * WINGS.womenPull });
}

/** Weekly: wings drift towards rest; a strong Wanita wing signs up members. */
export function wingsWeek(s: GameState): GameState {
  const w = s.wings;
  const wings = { youth: w.youth + (WINGS.rest - w.youth) * WINGS.drift, women: w.women + (WINGS.rest - w.women) * WINGS.drift };
  const members = Math.round(s.me.members * (1 + Math.max(0, w.women - 50) * WINGS.womenMembers * 0.1));
  return { ...s, wings, me: { ...s.me, members } };
}

export function fundWing(s: GameState, wing: keyof Wings): { state: GameState; message: string } | { error: string } {
  if (s.me.ap < WINGS.ap) return { error: `Needs ${WINGS.ap} AP.` };
  if (s.me.funds < WINGS.cost) return { error: "Not enough money." };
  return {
    state: { ...s, me: { ...s.me, ap: s.me.ap - WINGS.ap, funds: s.me.funds - WINGS.cost }, wings: { ...s.wings, [wing]: clamp(s.wings[wing] + WINGS.fund) } },
    message: wing === "youth" ? "The Youth wing gets buses, a podcast studio and a futsal league." : "Wanita gets funds for kampung visits, kitchens and child-care drives.",
  };
}

// --- The Supreme Council ----------------------------------------------------------------------------

export const COUNCIL_EVERY = 8;

/** Which agenda item comes up at a meeting (drawn from the card's week). */
export const councilAgenda = (seed: number, week: number) => Math.floor(hash01("council", seed, week) * COUNCIL_ITEMS.length);

export const COUNCIL_ITEMS: { title: string; text: string }[] = [
  { title: "Divisions want their allocations", text: "Division chiefs say the grassroots are starving. They want RM 1M shared out before the next by-election." },
  { title: "The Youth wing wants a say on candidates", text: "The Youth chief demands a quota of winnable seats for young candidates at the next election." },
  { title: "A warlord defies the party line", text: "A powerful division chief has been feeding the press and running his own machine. The council wants him dealt with." },
  { title: "A membership drive", text: "The secretary-general proposes a national membership drive with free T-shirts and lucky draws." },
  { title: "Leaked minutes", text: "Someone is leaking council minutes to a news portal. The council wants a witch-hunt." },
];

// --- Discipline -------------------------------------------------------------------------------------

export const DISCIPLINE = { showCause: { capital: 3, loyalty: 12, unity: -1 }, sack: { unity: 3, capital: 5 } };

const yourMember = (s: GameState, id: number) => {
  const p = s.people.find((x) => x.id === id);
  return p && s.coalitions[s.player].members[0] === p.party && p.id !== s.youId ? p : undefined;
};

export function showCause(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const p = yourMember(s, id);
  if (!p) return { error: "Only members of your own party." };
  if (s.me.capital < DISCIPLINE.showCause.capital) return { error: `Needs ${DISCIPLINE.showCause.capital} political capital.` };
  return {
    state: {
      ...s,
      me: { ...s.me, capital: s.me.capital - DISCIPLINE.showCause.capital, unity: clamp(s.me.unity + DISCIPLINE.showCause.unity) },
      people: s.people.map((x) => (x.id === id ? { ...x, loyalty: clamp(x.loyalty + DISCIPLINE.showCause.loyalty), ambition: clamp(x.ambition - 5) } : x)),
    },
    message: `${p.name} gets a show-cause letter and falls into line, for now.`,
  };
}

/** Sack an MP from the party: they sit as an independent, and the seat goes with them. */
export function sackMember(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const p = yourMember(s, id);
  if (!p) return { error: "Only members of your own party." };
  if (p.rank >= 4) return { error: "The deputy and above can only be removed at an AGM." };
  if (s.me.capital < DISCIPLINE.sack.capital) return { error: `Needs ${DISCIPLINE.sack.capital} political capital.` };
  let holders = s.holders;
  let holderParties = s.holderParties;
  if (p.seat !== null && mpOf(s, p.seat)?.id === p.id) {
    holders = s.holders.map((h, i) => (i === p.seat ? "OTHERS" : h));
    holderParties = s.holderParties.map((h, i) => (i === p.seat ? "IND" : h));
  }
  return {
    state: {
      ...s,
      holders,
      holderParties,
      me: { ...s.me, capital: s.me.capital - DISCIPLINE.sack.capital, unity: clamp(s.me.unity + DISCIPLINE.sack.unity) },
      people: s.people.map((x) => (x.id === id ? { ...x, party: "IND", rank: 1, loyalty: 0 } : x)),
    },
    message: `${p.name} is sacked from the party${p.seat !== null ? ` and sits as an independent for ${SEATS[p.seat].name}` : ""}. Nobody else will cross you this month.`,
  };
}
