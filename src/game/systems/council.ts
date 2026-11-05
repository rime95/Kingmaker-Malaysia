// Your party's supreme council: who sits on it, and your hand over it.
// - Seats: the president, the deputy and vice presidents, the elected members (party polls, partypolls.ts), the members
//   the president appoints, and the post-holders who sit by virtue of their post (ex officio: the wing chiefs, the
//   Secretary-General, the Treasurer, the Information Chief).
// - As president you fill the appointed seats and can drop anyone you appointed. Dropping costs you: the dropped sulk
//   and go over to a rival camp; a purge (three or more in a year) dents the party's unity.
// - The council votes on the items at its meetings: your side carries it if your camp and the loyal hold a majority.
// All numbers TEMPORARY.

import type { GameState } from "../state";
import { HIERARCHY_PARTIES, markCouncil, structure, type Person } from "./people";
import { patrons } from "./camps";
import { NATIONAL_POSTS, holderOf } from "./posts";
import { yourParty } from "./nominations";

export const COUNCIL = {
  appoint: { capital: 3, loyalty: 10 },
  drop: { capital: 2, loyalty: -15, unity: -1 },
  /** Dropping this many within a year is a purge. */
  purge: { count: 3, unity: -3 },
  /** Loyal enough to vote your way without being in your camp; hostile enough to vote against you. */
  loyal: 60,
  hostile: 35,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export interface CouncilView {
  name: string;
  president?: Person;
  deputy?: Person;
  vps: Person[];
  elected: Person[];
  appointed: Person[];
  /** Post-holders who sit by their post. */
  exOfficio: { post: string; p: Person }[];
  openAppointed: number;
  size: number;
}

/** Everyone on a party's council, by the kind of seat they hold. */
export function councilOf(s: GameState, party: string): CouncilView {
  const st = structure(party);
  const ppl = s.people.filter((p) => p.party === party && !p.retired && !p.chairman);
  const byRank = (r: number) => ppl.filter((p) => p.rank === r).sort((a, b) => b.influence - a.influence);
  const two = byRank(2);
  const elected = two.filter((p) => p.council !== "appointed");
  const appointed = two.filter((p) => p.council === "appointed");
  const seated = new Set([...ppl.filter((p) => p.rank >= 2).map((p) => p.id)]);
  const exOfficio = NATIONAL_POSTS.map((post) => ({ post, p: holderOf(s, party, post) }))
    .filter((x): x is { post: (typeof NATIONAL_POSTS)[number]; p: Person } => !!x.p && !seated.has(x.p.id))
    .map((x) => ({ post: x.post, p: x.p }));
  const vps = byRank(3);
  return {
    name: st.council,
    president: byRank(5)[0],
    deputy: byRank(4)[0],
    vps,
    elected,
    appointed,
    exOfficio,
    openAppointed: Math.max(0, st.appointed - appointed.length),
    size: 1 + (byRank(4).length ? 1 : 0) + vps.length + two.length + exOfficio.length,
  };
}

/** Old saves: each party's council and vice presidents grow to its structure, promoting its strongest members. */
export function growCouncils(s: GameState): GameState {
  const people = s.people.map((p) => ({ ...p }));
  for (const party of HIERARCHY_PARTIES) {
    const st = structure(party);
    const ppl = people.filter((p) => p.party === party && !p.retired && !p.chairman && p.id !== s.youId);
    const up = (rank: number, want: number) => {
      const have = ppl.filter((p) => p.rank === rank).length;
      ppl.filter((p) => p.rank === rank - 1).sort((a, b) => b.influence - a.influence).slice(0, Math.max(0, want - have)).forEach((p) => {
        p.rank = rank;
        p.since = s.week;
      });
    };
    up(3, st.vps);
    up(2, st.elected + st.appointed);
    markCouncil(people, party);
  }
  return { ...s, people };
}

/**
 * Old saves: a real politician counted twice (a roster entry without a seat beside the MP of the same name) becomes one
 * person: the MP, at the higher rank, with every post, division and pick pointing to them.
 */
export function mergeDuplicates(s: GameState): GameState {
  const swap = new Map<number, number>();
  const keep = new Map<number, number>();
  for (const p of s.people) {
    if (!p.real || p.seat !== null) continue;
    const mp = s.people.find((x) => x.real && x.name === p.name && x.seat !== null && x.id !== p.id);
    if (mp) {
      swap.set(p.id, mp.id);
      keep.set(mp.id, Math.max(mp.rank, p.rank));
    }
  }
  if (!swap.size) return s;
  const to = (id: number | undefined) => (id !== undefined && swap.has(id) ? swap.get(id)! : id);
  const remap = <T extends Partial<Record<string | number, number>>>(o: T): T => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, to(v)])) as T;
  return {
    ...s,
    people: s.people.filter((p) => !swap.has(p.id)).map((p) => (keep.has(p.id) ? { ...p, rank: keep.get(p.id)!, council: keep.get(p.id) === 2 ? p.council : undefined } : p.camp != null && swap.has(p.camp) ? { ...p, camp: swap.get(p.camp)! } : p)),
    cabinet: remap(s.cabinet),
    posts: Object.fromEntries(Object.entries(s.posts ?? {}).map(([party, posts]) => [party, remap(posts)])),
    divisions: remap(s.divisions ?? {}),
    calon: remap(s.calon ?? {}),
    youId: to(s.youId ?? undefined) ?? null,
  };
}

/**
 * Who on the council votes your way: your camp and anyone loyal to you; against you, rival camps and the hostile; the
 * unaligned in between split (half a vote each your way).
 */
export function councilTally(s: GameState, party = yourParty(s)): { yours: number; against: number; undecided: number; total: number; carries: boolean } {
  const c = councilOf(s, party);
  const all = [c.president, c.deputy, ...c.vps, ...c.elected, ...c.appointed, ...c.exOfficio.map((x) => x.p)].filter((p): p is Person => !!p);
  const isYours = (p: Person) => p.id === s.youId || p.camp === s.youId || p.loyalty >= COUNCIL.loyal;
  const isAgainst = (p: Person) => !isYours(p) && ((p.camp != null && p.camp !== s.youId) || p.loyalty < COUNCIL.hostile);
  const yours = all.filter(isYours).length;
  const against = all.filter(isAgainst).length;
  const undecided = all.length - yours - against;
  return { yours, against, undecided, total: all.length, carries: (yours + undecided / 2) * 2 > all.length };
}

/** Why you can't appoint this person to the council (null when you can). `drop`: an appointee to make way. */
export function appointBlocked(s: GameState, id: number, drop?: number): string | null {
  if (s.career.rung < 6) return "Only the party president appoints the council.";
  const party = yourParty(s);
  const p = s.people.find((x) => x.id === id);
  if (!p || p.party !== party || p.retired) return "Only active members of your party.";
  if (p.id === s.youId) return "That's you.";
  if (p.rank >= 2) return "Already on the council.";
  const c = councilOf(s, party);
  if (!c.openAppointed && drop === undefined) return `All ${structure(party).appointed} appointed seats are taken: drop someone to make room.`;
  if (drop !== undefined && !c.appointed.some((x) => x.id === drop)) return "You can only drop someone you appointed.";
  if (s.me.capital < COUNCIL.appoint.capital + (drop !== undefined ? COUNCIL.drop.capital : 0)) return "Not enough political capital.";
  return null;
}

/** Appoint someone to the council (making room by dropping one of your appointees, if you name one). */
export function appointToCouncil(s: GameState, id: number, drop?: number): { state: GameState; message: string } | { error: string } {
  const why = appointBlocked(s, id, drop);
  if (why) return { error: why };
  let state = s;
  let dropped = "";
  if (drop !== undefined) {
    const r = dropFromCouncil(state, drop);
    if ("error" in r) return r;
    state = r.state;
    dropped = ` ${r.message}`;
  }
  const party = yourParty(s);
  const youLead = patrons(state, party).some((x) => x.id === s.youId);
  const p = state.people.find((x) => x.id === id)!;
  state = {
    ...state,
    people: state.people.map((x) => (x.id === id ? { ...x, rank: 2, council: "appointed" as const, since: s.week, loyalty: clamp(x.loyalty + COUNCIL.appoint.loyalty), camp: x.camp ?? (youLead ? s.youId : x.camp) } : x)),
    me: { ...state.me, capital: state.me.capital - COUNCIL.appoint.capital },
  };
  return { state, message: `${p.name} joins the ${structure(party).council}.${dropped}` };
}

export function dropBlocked(s: GameState, id: number): string | null {
  if (s.career.rung < 6) return "Only the party president can drop council members.";
  const p = s.people.find((x) => x.id === id);
  if (!p || p.party !== yourParty(s) || p.rank !== 2) return "They're not on the council.";
  if (p.council !== "appointed") return "Elected members answer to the party polls.";
  if (s.me.capital < COUNCIL.drop.capital) return "Not enough political capital.";
  return null;
}

/** Drop one of your appointees: they leave the council, sulk, and go over to a rival camp. Too many and it's a purge. */
export function dropFromCouncil(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = dropBlocked(s, id);
  if (why) return { error: why };
  const party = yourParty(s);
  const rival = patrons(s, party).find((x) => x.id !== s.youId);
  const recent = [...(s.councilDrops ?? []).filter((w) => w > s.week - 52), s.week];
  const purge = recent.length >= COUNCIL.purge.count;
  const p = s.people.find((x) => x.id === id)!;
  const state: GameState = {
    ...s,
    people: s.people.map((x) => (x.id === id ? { ...x, rank: 1, council: undefined, since: s.week, loyalty: clamp(x.loyalty + COUNCIL.drop.loyalty), camp: x.camp === s.youId || x.camp == null ? (rival?.id ?? null) : x.camp } : x)),
    councilDrops: recent,
    me: { ...s.me, capital: s.me.capital - COUNCIL.drop.capital, unity: clamp(s.me.unity + (purge ? COUNCIL.purge.unity : COUNCIL.drop.unity)) },
  };
  return { state, message: `${p.name} is dropped from the council${rival ? ` and drifts to ${rival.name}'s camp` : ""}.${purge ? " The party calls it a purge." : ""}` };
}
