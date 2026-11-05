// Party polls: every party elects its deputy, its vice presidents and the elected seats of its supreme council at the
// June AGM, once a term (data/structures.ts). The window opens four weeks before, with the party elections race.
// - Who stands: the incumbents, a slate (yours, as president; elsewhere the leader's), and the rival camps' people.
// - Who votes: the delegates. In your party, every division chief (camps.ts); elsewhere the party's leaders and MPs.
//   A delegate leans to candidates from their own camp, to the stronger names, and (in your party) to your slate if
//   they're loyal to you and you worked the divisions.
// - The top vote-getters take the posts. Incumbents who lose drop back to the ranks.
// All numbers TEMPORARY.

import { weekDate } from "../bases";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { FIRST_POLLS } from "../data/structures";
import { HIERARCHY_PARTIES, PRESIDENT_RANK, structure, type Person } from "./people";
import { patrons } from "./camps";
import { RACE, raceOpens } from "./partyrace";
import { yourParty } from "./nominations";

export interface Slate {
  deputy?: number;
  vps: number[];
  council: number[];
}

export interface PollResult {
  post: "deputy" | "vp" | "council";
  id: number;
  votes: number;
  won: boolean;
  /** On your slate. */
  slate: boolean;
  incumbent: boolean;
}

export interface PartyPolls {
  year: number;
  voteWeek: number;
  slate: Slate;
  /** Your campaigning for the slate. */
  effort: number;
  /** Your party's count, once the delegates have voted. */
  result: PollResult[] | null;
}

export const POLLS = {
  tour: { ap: 1, cost: 300_000, effort: 10 },
  posts: { ap: 1, capital: 8, effort: 12, unity: -2 },
  money: { cost: 1_000_000, effort: 18, risk: 12, integrity: -4 },
};

/** Is this a party poll year (2027 and every third year)? */
export const pollYear = (year: number) => year >= FIRST_POLLS && (year - FIRST_POLLS) % 3 === 0;

const active = (p: Person, party: string) => p.party === party && !p.retired && !p.chairman;

/** Your slate to start with: the incumbents in your camp (or loyal to you), seat by seat. */
export function defaultSlate(s: GameState): Slate {
  const party = yourParty(s);
  const mine = (p: Person) => p.camp === s.youId || p.loyalty >= 60;
  const ppl = s.people.filter((p) => active(p, party) && p.id !== s.youId);
  const st = structure(party);
  const deputy = ppl.find((p) => p.rank === 4 && mine(p))?.id;
  const vps = ppl.filter((p) => p.rank === 3 && mine(p)).slice(0, st.vps).map((p) => p.id);
  const council = ppl.filter((p) => p.rank === 2 && p.council !== "appointed" && mine(p)).slice(0, st.elected).map((p) => p.id);
  return { deputy, vps, council };
}

/** Opens the window in a poll year (mid-May): the vote is at the AGM four weeks on. */
export function openPolls(s: GameState): GameState {
  return { ...s, partyPolls: { year: weekDate(s.week).getFullYear(), voteWeek: s.week + RACE.weeks, slate: defaultSlate(s), effort: 0, result: null } };
}

/** The delegates of a party, as people (your party: its division chiefs; elsewhere its leaders and MPs). */
function delegates(s: GameState, party: string): Person[] {
  if (party === yourParty(s) && Object.keys(s.divisions ?? {}).length) {
    const ids = new Set(Object.values(s.divisions));
    return s.people.filter((p) => ids.has(p.id));
  }
  return s.people.filter((p) => active(p, party) && p.rank >= 1);
}

/** One party's count: candidates for each post, then the top vote-getters. `slate`: the leader's (or your) picks. */
export function countParty(s: GameState, party: string, slate: Slate, effort: number, slateCamp: number | null): PollResult[] {
  const st = structure(party);
  const ppl = s.people.filter((p) => active(p, party) && p.rank < PRESIDENT_RANK && p.id !== s.youId);
  const rivals = patrons(s, party).filter((p) => p.id !== slateCamp);
  const dels = delegates(s, party);
  const onSlate = new Set([slate.deputy, ...slate.vps, ...slate.council].filter((x): x is number => x !== undefined));
  const mine = party === yourParty(s);
  const score = (c: Person, post: string) =>
    dels.reduce((sum, d, k) => {
      if (d.id === c.id) return sum + 1;
      let p = 0.15 + (c.influence / 100) * 0.35;
      if (d.camp != null && d.camp === c.camp) p += 0.4;
      if (onSlate.has(c.id)) {
        if (d.camp != null && d.camp === slateCamp) p += 0.25;
        else if (d.camp != null && rivals.some((r) => r.id === d.camp)) p -= 0.2;
        if (mine) p += (d.loyalty - 50) / 250 + effort / 250;
      }
      return sum + Math.max(0, Math.min(1, p)) * (0.75 + hash01("pp", s.seed, s.week, party, post, c.id, k) * 0.5);
    }, 0);
  const out: PollResult[] = [];
  const used = new Set<number>();
  const contest = (post: PollResult["post"], seats: number, field: Person[]) => {
    const uniq = [...new Map(field.filter((p) => !used.has(p.id)).map((p) => [p.id, p])).values()];
    const ranked = uniq.map((p) => ({ p, v: score(p, post) })).sort((a, b) => b.v - a.v);
    ranked.forEach(({ p, v }, i) => {
      const won = i < seats;
      if (won) used.add(p.id);
      out.push({ post, id: p.id, votes: Math.round(v), won, slate: onSlate.has(p.id), incumbent: post === "deputy" ? p.rank === 4 : post === "vp" ? p.rank === 3 : p.rank === 2 && p.council !== "appointed" });
    });
  };
  const byId = (id: number | undefined) => (id === undefined ? undefined : ppl.find((p) => p.id === id));
  // Rival camps field their patrons and strongest followers.
  const campPicks = (n: number, minRank: number) => rivals.flatMap((r) => [r, ...ppl.filter((p) => p.camp === r.id && p.id !== r.id && p.rank >= minRank).sort((a, b) => b.influence - a.influence)].slice(0, n));
  contest("deputy", 1, [byId(slate.deputy), ...ppl.filter((p) => p.rank === 4), ...rivals.slice(0, 1)].filter((p): p is Person => !!p));
  contest("vp", st.vps, [...slate.vps.map(byId), ...ppl.filter((p) => p.rank === 3), ...campPicks(2, 2)].filter((p): p is Person => !!p));
  contest("council", st.elected, [...slate.council.map(byId), ...ppl.filter((p) => p.rank === 2 && p.council !== "appointed"), ...campPicks(4, 1)].filter((p): p is Person => !!p));
  return out;
}

/** The new top table: winners take their posts; incumbents who lost drop back to the ranks. */
export function applyPolls(s: GameState, party: string, results: PollResult[]): GameState {
  const won = new Map(results.filter((r) => r.won).map((r) => [r.id, r.post]));
  const lost = new Set(results.filter((r) => !r.won && r.incumbent && !won.has(r.id)).map((r) => r.id));
  return {
    ...s,
    people: s.people.map((p) => {
      if (p.party !== party) return p;
      const post = won.get(p.id);
      if (post) return { ...p, rank: post === "deputy" ? 4 : post === "vp" ? 3 : 2, council: post === "council" ? ("elected" as const) : undefined, since: p.since };
      if (lost.has(p.id)) return { ...p, rank: 1, council: undefined, loyalty: Math.max(0, p.loyalty - 8) };
      return p;
    }),
  };
}

/** Weekly: open the window in a poll year; on AGM week every party votes. */
export function partyPollsWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  const year = weekDate(s.week).getFullYear();
  if (!s.partyPolls && pollYear(year) && raceOpens(s.week)) {
    lines.push({ text: `Party polls in ${RACE.weeks} weeks: the deputy, the vice presidents and the council are up. Back your slate (Party → Leadership).`, tone: "info" });
    return { state: openPolls(s), lines };
  }
  const pp = s.partyPolls;
  if (!pp || pp.result || s.week < pp.voteWeek) return { state: s, lines };
  let state = s;
  const party = yourParty(s);
  const yourCamp = patrons(s, party).some((p) => p.id === s.youId) ? s.youId : (patrons(s, party)[0]?.id ?? null);
  const mine = countParty(state, party, pp.slate, pp.effort, yourCamp);
  state = applyPolls(state, party, mine);
  // Everyone else votes too: each leader's camp runs a slate of its own people.
  for (const other of HIERARCHY_PARTIES) {
    if (other === party) continue;
    const lead = patrons(state, other)[0];
    if (!lead) continue;
    const theirs = state.people.filter((p) => active(p, other) && p.camp === lead.id);
    const slate: Slate = { deputy: theirs.find((p) => p.rank === 4)?.id, vps: theirs.filter((p) => p.rank === 3).map((p) => p.id), council: theirs.filter((p) => p.rank === 2).map((p) => p.id) };
    state = applyPolls(state, other, countParty(state, other, slate, 0, lead.id));
  }
  const slateWins = mine.filter((r) => r.won && r.slate).length;
  const slateSize = mine.filter((r) => r.slate).length;
  lines.push({ text: `Party polls: your slate wins ${slateWins} of ${slateSize} posts.`, tone: slateWins * 2 >= slateSize ? "good" : "bad" });
  return { state: { ...state, partyPolls: { ...pp, result: mine } }, lines };
}

/** Put someone on your slate for a post (or take them off). */
export function setSlate(s: GameState, post: "deputy" | "vp" | "council", id: number, on: boolean): { state: GameState; message: string } | { error: string } {
  const pp = s.partyPolls;
  if (!pp || pp.result) return { error: "No party polls are under way." };
  if (s.career.rung < 6) return { error: "Only the party president runs a slate." };
  const p = s.people.find((x) => x.id === id);
  if (!p || !active(p, yourParty(s)) || p.id === s.youId) return { error: "Only members of your party." };
  const st = structure(yourParty(s));
  const without = (l: number[]) => l.filter((x) => x !== id);
  let slate: Slate = { deputy: pp.slate.deputy === id ? undefined : pp.slate.deputy, vps: without(pp.slate.vps), council: without(pp.slate.council) };
  if (on) {
    if (post === "deputy") slate = { ...slate, deputy: id };
    else if (post === "vp") {
      if (slate.vps.length >= st.vps) return { error: `Your slate already has ${st.vps} for vice president.` };
      slate = { ...slate, vps: [...slate.vps, id] };
    } else {
      if (slate.council.length >= st.elected) return { error: `Your slate already fills all ${st.elected} council seats.` };
      slate = { ...slate, council: [...slate.council, id] };
    }
  }
  return { state: { ...s, partyPolls: { ...pp, slate } }, message: on ? `${p.name} is on your slate.` : `${p.name} is off your slate.` };
}

export type SlateMove = keyof typeof POLLS;

export function slateMoveBlocked(s: GameState, move: SlateMove): string | null {
  const pp = s.partyPolls;
  if (!pp || pp.result) return "No party polls are under way.";
  if (move === "tour") return s.me.ap < POLLS.tour.ap ? "Needs 1 AP." : s.me.funds < POLLS.tour.cost ? "Not enough money." : null;
  if (move === "posts") return s.me.ap < POLLS.posts.ap ? "Needs 1 AP." : s.me.capital < POLLS.posts.capital ? "Not enough political capital." : null;
  return s.me.funds < POLLS.money.cost ? "Not enough money." : null;
}

/** Campaign for your slate: tour the divisions, promise posts, or hand out envelopes. */
export function slateMove(s: GameState, move: SlateMove): { state: GameState; message: string } | { error: string } {
  const why = slateMoveBlocked(s, move);
  if (why) return { error: why };
  const pp = s.partyPolls!;
  let me = { ...s.me };
  let message: string;
  if (move === "tour") {
    me = { ...me, ap: me.ap - POLLS.tour.ap, funds: me.funds - POLLS.tour.cost };
    message = "You tour the divisions for your slate.";
  } else if (move === "posts") {
    me = { ...me, ap: me.ap - POLLS.posts.ap, capital: me.capital - POLLS.posts.capital, unity: Math.max(0, me.unity + POLLS.posts.unity) };
    message = "You promise posts to division chiefs who vote your slate.";
  } else {
    me = { ...me, funds: me.funds - POLLS.money.cost, risk: Math.min(100, me.risk + POLLS.money.risk), integrity: Math.max(0, me.integrity + POLLS.money.integrity) };
    message = "Envelopes change hands. Delegates warm to your slate.";
  }
  return { state: { ...s, me, partyPolls: { ...pp, effort: pp.effort + POLLS[move].effort } }, message };
}
