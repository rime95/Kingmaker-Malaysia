// Bringing people over: tokoh (well-known figures with no party) and members of other parties without a seat.
// - Courting costs AP, money and political capital and can be tried once every eight weeks per person. Each try warms
//   them up; whether they sign depends on that warmth, how close their politics are to yours, your momentum and your
//   name (a scandal puts them off). Members who hold a post in their party are harder to move than the sidelined.
// - Wooing a coalition partner's people works, but your partners notice (trust).
// - Anti-hopping laws bind MPs only: anyone without a seat can change party.
// - Tokoh are courted by rival parties too: now and then one signs with someone else.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, PARTIES, SEATS, cshort, regionOf, type CoalitionId } from "../world";
import { TOKOH } from "../data/tokoh";
import { AFFINITY } from "./formation";
import { coalitionOf } from "./coalitions";
import { patrons } from "./camps";
import { PRESIDENT_RANK, recruitPerson, type Person } from "./people";
import { yourParty } from "./nominations";

export const COURT = {
  every: 8,
  tokoh: { ap: 2, cost: 500_000, capital: 10, warmth: 22 },
  member: { ap: 1, cost: 150_000, capital: 3, warmth: 18 },
  senior: { ap: 2, cost: 500_000, capital: 8, warmth: 14 },
  /** Courting a partner's people. */
  partnerTrust: -4,
  /** A tokoh's arrival: national buzz per point of appeal, and buzz in each seat of their home state. */
  buzzPerAppeal: 0.12,
  homeBuzz: 6,
  /** A rival party signs one of the free tokoh in a month with this chance. */
  rivalMonthly: 0.1,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const fitOf = (from: CoalitionId, to: CoalitionId) => (from === to ? 1 : (AFFINITY[from]?.[to] ?? 0));

/** The free tokoh, as people (party IND), for a new game or an old save. */
export function makeTokoh(s: Pick<GameState, "seed" | "week" | "player" | "coalitions" | "people">, nextId: number): Person[] {
  const year = 2026 + Math.floor(s.week / 52);
  return TOKOH.filter((t) => !s.people.some((p) => p.name === t.name)).map((t, k) => {
    const base = recruitPerson(nextId + k, "IND", s.seed, s.week, s);
    const age = year - t.born;
    return {
      ...base,
      name: t.name,
      born: t.born,
      home: t.home,
      real: true,
      rank: 1,
      influence: t.appeal,
      competence: 55 + Math.round(hash01("tokohcomp", t.name) * 35),
      ambition: 40 + Math.round(hash01("tokohamb", t.name) * 40),
      loyalty: 30,
      tokoh: true,
      warmth: 0,
      // Real figures stay on: the very old for a few more years, the rest well into their eighties.
      retireAge: age >= 85 ? age + 3 + Math.floor(hash01("tokohret", t.name) * 4) : Math.max(age + 5 + Math.floor(hash01("tokohret", t.name) * 10), 82 + Math.floor(hash01("tokohret2", t.name) * 6)),
    };
  });
}

/** The data record behind a tokoh. */
export const tokohEntry = (p: Person) => TOKOH.find((t) => t.name === p.name);

/** Whose side someone is on now: a tokoh's leanings, or their party's coalition. */
const sideOf = (s: GameState, p: Person): CoalitionId => (p.party === "IND" ? (tokohEntry(p)?.lean ?? "OTHERS") : coalitionOf(s, p.party));

/** What courting this person costs. */
export function courtCost(p: Person) {
  return p.tokoh && p.party === "IND" ? COURT.tokoh : p.rank >= 3 ? COURT.senior : COURT.member;
}

/** Why you can't court this person (null when you can). */
export function courtBlocked(s: GameState, id: number): string | null {
  const p = s.people.find((x) => x.id === id);
  if (!p || p.retired) return "They're not available.";
  if (p.party === yourParty(s)) return "Already in your party.";
  const free = p.tokoh && p.party === "IND";
  if (!free) {
    if (p.party === "IND") return "Independents in the House are wooed across the floor instead.";
    if (p.seat !== null) return "An MP: woo them across the floor instead.";
    if (p.rank >= PRESIDENT_RANK || p.chairman) return "They lead their party.";
  }
  if (s.career.rung < 6) return "Only the party president can bring people over.";
  const c = courtCost(p);
  if ((p.courtWeek ?? -99) > s.week - COURT.every) return `You courted them recently: try again in ${p.courtWeek! + COURT.every - s.week} weeks.`;
  if (s.me.ap < c.ap) return `Needs ${c.ap} AP.`;
  if (s.me.funds < c.cost) return "Not enough money.";
  if (s.me.capital < c.capital) return `Needs ${c.capital} political capital.`;
  return null;
}

/** Their chance of saying yes this time (0–1), after this attempt's warmth. */
export function courtChance(s: GameState, p: Person, warmth = p.warmth ?? 0): number {
  const fit = fitOf(sideOf(s, p), s.player);
  // The sidelined move more easily than the powerful.
  const sidelined = p.tokoh ? 0.05 : p.rank <= 1 ? 0.1 : p.rank === 2 ? 0 : -0.1;
  const v = (warmth / 100) * 0.55 + fit * 0.25 + (s.me.momentum ?? 0) / 400 - s.me.scandal / 300 + sidelined + (p.loyalty - 40) / 300;
  return Math.max(0.02, Math.min(0.9, v));
}

/** Bring them into your party: rank 2 at most, in your camp, their old post left for their party to fill. */
function join(s: GameState, p: Person, lines: ReportLine[]): GameState {
  const party = yourParty(s);
  const yourCamp = patrons(s, party).some((x) => x.id === s.youId) ? s.youId : (p.camp ?? null);
  const from = p.party;
  const rank = p.tokoh ? 2 : Math.min(p.rank, 2);
  let state: GameState = { ...s, people: s.people.map((x) => (x.id === p.id ? { ...x, party, rank, since: s.week, loyalty: Math.max(x.loyalty, 60), camp: yourCamp, warmth: 0 } : x)) };
  if (p.tokoh) {
    const t = tokohEntry(p);
    const appeal = t?.appeal ?? p.influence;
    const buzz = [...state.me.buzz];
    if (t) SEATS.forEach((seat, i) => regionOf(seat.state) === t.home && (buzz[i] = buzz[i] + COURT.homeBuzz));
    state = { ...state, me: { ...state.me, buzz, nationalBuzz: clamp(state.me.nationalBuzz + appeal * COURT.buzzPerAppeal) } };
    lines.push({ text: `${p.name} joins ${party}. A coup: the news leads with it.`, tone: "good" });
  } else lines.push({ text: `${p.name} leaves ${from} for ${party}.`, tone: "good" });
  return state;
}

/** Court someone: tokoh, or a member of another party without a seat. They may say yes now, or warm to you for later. */
export function courtPerson(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = courtBlocked(s, id);
  if (why) return { error: why };
  const p = s.people.find((x) => x.id === id)!;
  const c = courtCost(p);
  const warmth = clamp((p.warmth ?? 0) + c.warmth);
  const chance = courtChance(s, p, warmth);
  const partner = p.party !== "IND" && s.coalitions[s.player].members.includes(p.party);
  let state: GameState = {
    ...s,
    me: { ...s.me, ap: s.me.ap - c.ap, funds: s.me.funds - c.cost, capital: s.me.capital - c.capital, trust: partner ? clamp(s.me.trust + COURT.partnerTrust) : s.me.trust },
    people: s.people.map((x) => (x.id === id ? { ...x, warmth, courtWeek: s.week, loyalty: clamp(x.loyalty + 4) } : x)),
  };
  if (hash01("court", s.seed, s.week, id) < chance) {
    const lines: ReportLine[] = [];
    state = join(state, state.people.find((x) => x.id === id)!, lines);
    return { state, message: lines[0].text };
  }
  return { state, message: `${p.name} listens, but isn't ready (warmth ${Math.round(warmth)}). Try again in ${COURT.every} weeks.${partner ? " Your partners noticed." : ""}` };
}

/** Monthly: now and then a rival party signs one of the free tokoh. */
export function tokohMonth(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (s.week % 4 !== 1 || hash01("tokohrival", s.seed, s.week) >= COURT.rivalMonthly) return { state: s, lines };
  const free = s.people.filter((p) => p.tokoh && p.party === "IND" && !p.retired);
  if (!free.length) return { state: s, lines };
  const p = free[Math.floor(hash01("tokohpick", s.seed, s.week) * free.length)];
  const lean = tokohEntry(p)?.lean ?? "OTHERS";
  // The rival coalition closest to them (never yours: that is your own courting).
  const best = COALITIONS.filter((c) => c !== s.player && c !== "OTHERS" && s.coalitions[c].members.length)
    .map((c) => ({ c, v: fitOf(lean, c) + hash01("tokohto", s.seed, s.week, c) * 0.3 }))
    .sort((a, b) => b.v - a.v)[0];
  if (!best || best.v < 0.3) return { state: s, lines };
  const party = s.coalitions[best.c].members[0];
  const people = s.people.map((x) => (x.id === p.id ? { ...x, party, rank: 2, since: s.week, warmth: 0 } : x));
  lines.push({ text: `${p.name} joins ${PARTIES[party]?.name ?? party} (${cshort(best.c)}): one fewer big name for you to win.`, tone: "bad" });
  return { state: { ...s, people }, lines };
}
