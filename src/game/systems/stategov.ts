// State governments. Every assembly has a ruling coalition, a Menteri Besar (Ketua Menteri in Melaka, Penang and
// Sabah; Premier in Sarawak) and an exco of six.
// - The MB comes from the biggest party in the ruling coalition, usually its state chief (posts.ts).
// - After a state election, a coalition with a majority of its own rules. With no majority the assembly is hung and
//   coalitions bargain: if you are one of the two biggest, you invite others with exco seats; otherwise the parties
//   settle it among themselves. The outcome stands until the next state election.
// - When you win a state you pick its MB and exco (the stateTerm screen). Partners judge their share of the exco.
// - Your states give you powers: a state treasury for kampung grants, and land deals that fill the war chest (at a
//   price). A disloyal MB may break away with part of the assembly.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { CardDef } from "./events";
import type { CardInstance, GameState, ReportLine } from "../state";
import { COALITIONS, SEATS, STATE_BY_ID, contestingIn, cshort, type CoalitionId } from "../world";
import { AFFINITY } from "./formation";
import { ASSEMBLY_STATES, countSeats, stateRule } from "./assemblies";
import { DUNS, DUNS_BY_STATE } from "./dun";
import { seatCandidate } from "./coalitions";
import { chiefKey, holderOf, homeOf, postPool, regionOf, setTalksHook } from "./posts";
import type { Person } from "./people";

export interface StateGov {
  ruler: CoalitionId;
  /** Coalitions that joined the ruler after hung-assembly talks. */
  partners: CoalitionId[];
  /** The ruling coalition's biggest party here: the MB's party. */
  party: string;
  mb: number | null;
  exco: number[];
  /** The state treasury (your states only). */
  funds: number;
  /** Last week you used a state power here. */
  actionWeek: number | null;
  /** Set by an election or talks: the ruler stands until the next state election. */
  settled: boolean;
}

/** The MB and exco you are drawing up for a state you won. */
export interface StateTerm {
  state: string;
  mb: number | null;
  exco: number[];
}

/** Hung-assembly talks you are leading. */
export interface StateTalks {
  state: string;
  week: number;
  deadline: number;
  rival: CoalitionId;
  joined: CoalitionId[];
  rivalJoined: CoalitionId[];
  /** Coalitions you have asked (once each), and the exco seats you offered. */
  asked: Partial<Record<CoalitionId, number>>;
  /** From your state chief working the assembly. */
  bonus: number;
}

/** State results to show (standalone state elections). */
export interface StateNight {
  states: string[];
  week: number;
  prev: CoalitionId[];
}

export const STATEGOV = {
  exco: 6,
  /** State treasury income per assembly seat per week (your states). */
  incomePerSeat: 3_000,
  fundsCap: 20_000_000,
  actionEvery: 4,
  grants: { cost: 1_500_000, buzz: 12, service: 2 },
  land: { funds: 800_000, perComp: 10_000, risk: 8, integrity: -2 },
  /** Willingness to join your state government. */
  talks: { base: 0.45, affinity: 0.6, rivalAffinity: 0.4, perPost: 0.12, sameSide: 0.1, weeks: 2, chiefBonus: 0.15 },
  /** Partner satisfaction from their share of the exco. */
  fair: 4,
  shortchanged: -10,
  /** A disloyal MB (below this) may break away. */
  rebelLoyalty: 30,
};

export const mbTitle = (stateId: string) => (stateId === "SWK" ? "Premier" : ["MLK", "PNG", "SBH"].includes(stateId) ? "Ketua Menteri" : "Menteri Besar");

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const aff = (a: CoalitionId, b: CoalitionId) => (a === b ? 1 : (AFFINITY[a]?.[b] ?? 0));

/** Who rules each state: settled by election or talks, otherwise the side with a majority. */
export function rulerOf(s: Pick<GameState, "dunHolders" | "government" | "stateGov">, id: string): CoalitionId {
  const g = s.stateGov?.[id];
  return g?.settled ? g.ruler : stateRule(s.dunHolders, id, s.government).ruler;
}

export function allRulers(s: Pick<GameState, "dunHolders" | "government" | "stateGov">): Record<string, CoalitionId> {
  return Object.fromEntries(ASSEMBLY_STATES.map((id) => [id, rulerOf(s, id)]));
}

/** Seats per coalition in a state assembly. */
export const stateSeats = (s: Pick<GameState, "dunHolders">, id: string) => countSeats(DUNS_BY_STATE[id].map((d) => s.dunHolders[d])) as Partial<Record<CoalitionId, number>>;

/** Seats per party among the ruling coalitions' assembly members. */
function partySeatsIn(s: GameState, id: string, coalitions: CoalitionId[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DUNS_BY_STATE[id]) {
    const h = s.dunHolders[d];
    if (!coalitions.includes(h)) continue;
    const p = seatCandidate(s, SEATS[DUNS[d].parent], h);
    out[p] = (out[p] ?? 0) + 1;
  }
  return out;
}

function leadParty(s: GameState, id: string, ruler: CoalitionId): string {
  const seats = partySeatsIn(s, id, [ruler]);
  return Object.entries(seats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? s.coalitions[ruler].members[0] ?? "IND";
}

/** Everyone already serving in a state government (and where), and everyone in the federal cabinet. */
function busy(s: GameState, except?: string): Set<number> {
  const out = new Set<number>(Object.values(s.cabinet).filter((x): x is number => x !== undefined));
  for (const [id, g] of Object.entries(s.stateGov ?? {})) {
    if (id === except) continue;
    if (g.mb !== null) out.add(g.mb);
    for (const x of g.exco) out.add(x);
  }
  return out;
}

export const isMb = (s: Pick<GameState, "stateGov">, id: number) => Object.values(s.stateGov ?? {}).some((g) => g.mb === id);

/** Who can serve in a state's government: active members of the ruling coalitions' parties, free of other posts. */
export function stateGovPool(s: GameState, id: string, coalitions: CoalitionId[]): Person[] {
  const taken = busy(s, id);
  const parties = new Set(coalitions.flatMap((c) => s.coalitions[c].members));
  return s.people
    .filter((p) => parties.has(p.party) && !p.retired && p.id !== s.youId && p.rank >= 1 && !taken.has(p.id))
    .sort((a, b) => fit(b, id) - fit(a, id));
}

const fit = (p: Person, id: string) => p.competence + p.influence * 0.4 + (homeOf(p) === regionOf(id) ? 60 : 0);

/** The MB the party would choose: its state chief, else its best local figure. */
function partyMb(s: GameState, id: string, party: string, pool: Person[]): number | null {
  const chief = holderOf(s, party, chiefKey(regionOf(id)));
  if (chief && pool.some((p) => p.id === chief.id)) return chief.id;
  return pool.find((p) => p.party === party)?.id ?? pool[0]?.id ?? null;
}

/** Exco seats per party, in proportion to their assembly seats (largest remainder). */
export function excoShares(s: GameState, id: string, coalitions: CoalitionId[], seats = STATEGOV.exco): Record<string, number> {
  const ps = partySeatsIn(s, id, coalitions);
  const total = Object.values(ps).reduce((a, b) => a + b, 0) || 1;
  const raw = Object.entries(ps).map(([p, n]) => ({ p, q: (n / total) * seats }));
  const out: Record<string, number> = Object.fromEntries(raw.map((r) => [r.p, Math.floor(r.q)]));
  let left = seats - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.q % 1) - (a.q % 1))) {
    if (left <= 0) break;
    out[r.p]++;
    left--;
  }
  return out;
}

function autoExco(s: GameState, id: string, coalitions: CoalitionId[], mb: number | null, pool: Person[]): number[] {
  const shares = excoShares(s, id, coalitions);
  const out: number[] = [];
  for (const [party, n] of Object.entries(shares)) out.push(...pool.filter((p) => p.party === party && p.id !== mb && !out.includes(p.id)).slice(0, n).map((p) => p.id));
  for (const p of pool) if (out.length < STATEGOV.exco && p.id !== mb && !out.includes(p.id)) out.push(p.id);
  return out.slice(0, STATEGOV.exco);
}

/** A fresh government for a state: MB and exco as the ruling parties would choose them. */
function formStateGov(s: GameState, id: string, ruler: CoalitionId, partners: CoalitionId[], settled: boolean, funds = 0): StateGov {
  const party = leadParty(s, id, ruler);
  const pool = stateGovPool(s, id, [ruler, ...partners]);
  const mb = partyMb(s, id, party, pool);
  return { ruler, partners, party, mb, exco: autoExco(s, id, [ruler, ...partners], mb, pool), funds, actionWeek: null, settled };
}

/** Keeps every state government current: a new ruler forms a new government; anyone who left is replaced. */
export function syncStateGov(s: GameState): GameState {
  const out: Record<string, StateGov> = {};
  const people = new Map(s.people.map((p) => [p.id, p]));
  let state = s;
  for (const id of ASSEMBLY_STATES) {
    const prev = s.stateGov?.[id];
    const ruler = prev?.settled ? prev.ruler : stateRule(s.dunHolders, id, s.government).ruler;
    const partners = prev?.settled ? prev.partners.filter((c) => s.coalitions[c].members.length) : [];
    const valid = (x: number | null) => {
      const p = x === null ? undefined : people.get(x);
      return !!p && !p.retired && [ruler, ...partners].some((c) => s.coalitions[c].members.includes(p.party));
    };
    if (!prev || prev.ruler !== ruler || !valid(prev.mb)) {
      out[id] = formStateGov({ ...state, stateGov: { ...(state.stateGov ?? {}), ...out } }, id, ruler, partners, prev?.settled ?? false, prev?.ruler === ruler ? prev.funds : 0);
    } else {
      const exco = prev.exco.filter(valid);
      if (exco.length < STATEGOV.exco) {
        const pool = stateGovPool({ ...state, stateGov: { ...(state.stateGov ?? {}), ...out, [id]: { ...prev, exco } } }, id, [ruler, ...partners]).filter((p) => p.id !== prev.mb && !exco.includes(p.id));
        exco.push(...pool.slice(0, STATEGOV.exco - exco.length).map((p) => p.id));
      }
      out[id] = { ...prev, partners, exco };
    }
    state = { ...state, stateGov: { ...(state.stateGov ?? {}), ...out } };
  }
  return { ...s, stateGov: out };
}

// --- After a state election ------------------------------------------------------------------------

/** Settles who rules: a majority of its own, else talks (yours, if you are one of the two biggest) or a deal among the others. */
function settle(s: GameState, id: string, lines: ReportLine[]): GameState {
  const seats = stateSeats(s, id);
  const total = DUNS_BY_STATE[id].length;
  const ranked = (Object.entries(seats) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]);
  const [top] = ranked[0];
  const funds = s.stateGov?.[id]?.ruler === top ? (s.stateGov[id].funds ?? 0) : 0;
  const set = (ruler: CoalitionId, partners: CoalitionId[]) => {
    const g = formStateGov(s, id, ruler, partners, true, funds);
    return { ...s, stateGov: { ...s.stateGov, [id]: g } };
  };
  if (ranked[0][1] > total / 2) return set(top, []);
  const name = STATE_BY_ID[id].name;
  const two = ranked.slice(0, 2).map(([c]) => c);
  if (two.includes(s.player) && s.player !== "OTHERS") {
    const rival = two.find((c) => c !== s.player) ?? ranked[1]?.[0];
    lines.push({ text: `The ${name} assembly is hung. You have ${STATEGOV.talks.weeks} weeks to put a majority together.`, tone: "info" });
    // Until the talks end, the old government stays in caretaker mode.
    return { ...s, stateTalks: { state: id, week: s.week, deadline: s.week + STATEGOV.talks.weeks, rival, joined: [], rivalJoined: [], asked: {}, bonus: 0 } };
  }
  const deal = aiDeal(s, id, [], s.player);
  lines.push({ text: `The ${name} assembly is hung. ${cshort(deal.ruler)}${deal.partners.length ? ` forms a government with ${deal.partners.map(cshort).join(", ")}` : " forms a minority government"}.`, tone: "info" });
  return set(deal.ruler, deal.partners);
}

/** The deal the parties strike without you: the biggest coalition gathers its most willing partners. */
function aiDeal(s: GameState, id: string, exclude: CoalitionId[], player: CoalitionId | null): { ruler: CoalitionId; partners: CoalitionId[] } {
  const seats = stateSeats(s, id);
  const total = DUNS_BY_STATE[id].length;
  const ranked = (Object.entries(seats) as [CoalitionId, number][]).filter(([c]) => c !== "OTHERS").sort((a, b) => b[1] - a[1]);
  const tryLead = (lead: CoalitionId) => {
    let have = seats[lead] ?? 0;
    const partners: CoalitionId[] = [];
    const options = ranked
      .map(([c]) => c)
      .filter((c) => c !== lead && c !== player && !exclude.includes(c))
      .sort((a, b) => aff(b, lead) + (s.government.includes(b) === s.government.includes(lead) ? 0.2 : 0) - (aff(a, lead) + (s.government.includes(a) === s.government.includes(lead) ? 0.2 : 0)));
    for (const c of options) {
      if (have > total / 2) break;
      if (aff(c, lead) < -0.2) continue;
      partners.push(c);
      have += seats[c] ?? 0;
    }
    // Independents back whoever is forming the government.
    have += seats.OTHERS ?? 0;
    return { ruler: lead, partners, have };
  };
  const options = ranked.slice(0, 2).map(([c]) => c).filter((c) => c !== player).map(tryLead);
  if (!options.length) return { ruler: ranked[0]?.[0] ?? "OTHERS", partners: [] };
  return options.sort((a, b) => Number(b.have > total / 2) - Number(a.have > total / 2) || b.have - a.have)[0];
}

/**
 * Runs after polling days (week.ts): states that voted this week are settled; your wins open the MB and exco screen;
 * standalone state elections get a results night.
 */
export function afterStatePolls(s: GameState, polled: string[], prevDun: GameState["dunHolders"]): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (!polled.length) return { state: s, lines };
  let state = s;
  for (const id of polled) state = settle(state, id, lines);
  state = syncStateGov(state);
  const mine = polled.filter((id) => state.stateGov[id].settled && state.stateGov[id].ruler === state.player && state.stateTalks?.state !== id);
  for (const id of mine) state = openStateTerm(state, id);
  const night = state.night?.week === s.week ? null : { states: polled, week: s.week, prev: prevDun };
  return { state: { ...state, stateNight: night ?? state.stateNight }, lines };
}

// --- Your talks in a hung assembly -------------------------------------------------------------------

export function inviteChance(s: GameState, c: CoalitionId, posts: number): number {
  const t = s.stateTalks;
  if (!t) return 0;
  const k = STATEGOV.talks;
  const same = s.government.includes(c) === s.government.includes(s.player) ? k.sameSide : 0;
  return Math.min(0.95, Math.max(0.05, k.base + aff(c, s.player) * k.affinity - aff(c, t.rival) * k.rivalAffinity + posts * k.perPost + same + t.bonus));
}

/** Coalitions in the hung assembly you could still ask. */
export function talksOptions(s: GameState): CoalitionId[] {
  const t = s.stateTalks;
  if (!t) return [];
  const seats = stateSeats(s, t.state);
  return COALITIONS.filter((c) => c !== s.player && c !== t.rival && (seats[c] ?? 0) > 0 && t.asked[c] === undefined);
}

export const talksSeats = (s: GameState, side: CoalitionId[]) => {
  const seats = stateSeats(s, s.stateTalks!.state);
  return side.reduce((n, c) => n + (seats[c] ?? 0), 0);
};

/** Ask a coalition to join your state government, offering exco seats. */
export function inviteToState(s: GameState, c: CoalitionId, posts: number): { state: GameState; message: string } | { error: string } {
  const t = s.stateTalks;
  if (!t) return { error: "No talks under way." };
  if (!talksOptions(s).includes(c)) return { error: "You can't ask them now." };
  if (posts < 0 || posts > 3) return { error: "Offer up to three exco seats." };
  const yes = hash01("statetalk", s.seed, s.week, t.state, c) < inviteChance(s, c, posts);
  const talks: StateTalks = { ...t, asked: { ...t.asked, [c]: posts }, joined: yes ? [...t.joined, c] : t.joined, rivalJoined: !yes && aff(c, t.rival) > 0 ? [...t.rivalJoined, c] : t.rivalJoined };
  let state: GameState = { ...s, stateTalks: talks };
  const total = DUNS_BY_STATE[t.state].length;
  const name = STATE_BY_ID[t.state].name;
  if (yes && talksSeats(state, [s.player, ...talks.joined]) > total / 2) {
    state = finishTalks(state, true);
    return { state, message: `${cshort(c)} joins you. You have a majority in ${name}: the ${mbTitle(t.state)} is yours to name.` };
  }
  return { state, message: yes ? `${cshort(c)} agrees to join your ${name} government.` : `${cshort(c)} turns you down${aff(c, t.rival) > 0 ? ` and talks to ${cshort(t.rival)} instead` : ""}.` };
}

/** The talks end: your coalition rules if it has a majority (or the bigger bloc); otherwise the rival does. */
export function finishTalks(s: GameState, won?: boolean): GameState {
  const t = s.stateTalks;
  if (!t) return s;
  const total = DUNS_BY_STATE[t.state].length;
  const mine = talksSeats(s, [s.player, ...t.joined]);
  const deal = aiDeal(s, t.state, [...t.joined], s.player);
  const rivalSeats = deal.ruler === t.rival ? talksSeats(s, [deal.ruler, ...new Set([...deal.partners, ...t.rivalJoined])]) : 0;
  const youWin = won ?? (mine > total / 2 || (mine >= rivalSeats && rivalSeats <= total / 2));
  const funds = s.stateGov?.[t.state]?.ruler === s.player ? s.stateGov[t.state].funds : 0;
  const g = youWin ? formStateGov(s, t.state, s.player, t.joined, true, funds) : formStateGov(s, t.state, deal.ruler, deal.partners.filter((c) => c !== s.player), true);
  let state: GameState = { ...s, stateTalks: null, stateGov: { ...s.stateGov, [t.state]: g } };
  if (youWin) state = openStateTerm(state, t.state, t.asked);
  return state;
}

/** Your chief works the assembly during talks: partners are more willing. */
setTalksHook((s, region) => (s.stateTalks && regionOf(s.stateTalks.state) === region ? { ...s, stateTalks: { ...s.stateTalks, bonus: s.stateTalks.bonus + STATEGOV.talks.chiefBonus } } : null));

// --- Your MB and exco ---------------------------------------------------------------------------------

/** Opens the MB and exco screen for a state you rule. `offers`: exco seats promised to partners in talks. */
export function openStateTerm(s: GameState, id: string, offers: Partial<Record<CoalitionId, number>> = {}): GameState {
  const g = s.stateGov?.[id];
  if (!g || g.ruler !== s.player || (s.stateTerms ?? []).some((t) => t.state === id)) return s;
  const coalitions = [g.ruler, ...g.partners];
  const pool = stateGovPool(s, id, coalitions);
  // Promised seats go to partners first.
  const promised: number[] = [];
  for (const [c, n] of Object.entries(offers) as [CoalitionId, number][]) if (g.partners.includes(c)) promised.push(...pool.filter((p) => s.coalitions[c].members.includes(p.party) && p.id !== g.mb).slice(0, n).map((p) => p.id));
  const exco = [...new Set([...promised, ...g.exco.filter((x) => x !== g.mb)])].slice(0, STATEGOV.exco);
  return { ...s, stateTerms: [...(s.stateTerms ?? []), { state: id, mb: g.mb, exco }] };
}

/** Three names for MB: the ruling party's best, and your own party's best if it is a different party. */
export function mbShortlist(s: GameState, id: string): Person[] {
  const g = s.stateGov[id];
  const pool = stateGovPool(s, id, [g.ruler, ...g.partners]);
  const yours = s.coalitions[s.player].members[0];
  const lead = pool.filter((p) => p.party === g.party).slice(0, 3);
  const own = g.party === yours ? [] : pool.filter((p) => p.party === yours).slice(0, 1);
  return [...lead.slice(0, own.length ? 2 : 3), ...own];
}

export function setStateDraft(s: GameState, id: string, change: { mb?: number; add?: number; remove?: number }): GameState {
  const terms = s.stateTerms ?? [];
  const t = terms.find((x) => x.state === id);
  if (!t) return s;
  const g = s.stateGov[id];
  const pool = new Set(stateGovPool(s, id, [g.ruler, ...g.partners]).map((p) => p.id));
  let { mb, exco } = t;
  if (change.mb !== undefined && pool.has(change.mb)) {
    exco = exco.filter((x) => x !== change.mb);
    mb = change.mb;
  }
  if (change.add !== undefined && pool.has(change.add) && change.add !== mb && !exco.includes(change.add) && exco.length < STATEGOV.exco) exco = [...exco, change.add];
  if (change.remove !== undefined) exco = exco.filter((x) => x !== change.remove);
  return { ...s, stateTerms: terms.map((x) => (x.state === id ? { ...x, mb, exco } : x)) };
}

/** Each partner party's share of the draft exco: seats on it ÷ seats its assembly members earn (1 = fair). */
export function excoFairness(s: GameState, t: StateTerm): Record<string, number> {
  const g = s.stateGov[t.state];
  const shares = excoShares(s, t.state, [g.ruler, ...g.partners], STATEGOV.exco + 1);
  const has: Record<string, number> = {};
  for (const id of [t.mb, ...t.exco]) {
    const p = s.people.find((x) => x.id === id);
    if (p) has[p.party] = (has[p.party] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(shares).filter(([, n]) => n >= 1).map(([p, n]) => [p, (has[p] ?? 0) / n]));
}

/** Swear in the MB and exco on the draft. */
export function confirmStateTerm(s: GameState, id?: string): { state: GameState; lines: ReportLine[] } {
  const terms = s.stateTerms ?? [];
  const t = id ? terms.find((x) => x.state === id) : terms[0];
  if (!t) return { state: s, lines: [] };
  const lines: ReportLine[] = [];
  const g = s.stateGov[t.state];
  const name = STATE_BY_ID[t.state].name;
  const fair = excoFairness(s, t);
  const yours = s.coalitions[s.player].members[0];
  const partySat = { ...s.partySat };
  for (const [party, f] of Object.entries(fair)) {
    if (party === yours) continue;
    const d = f >= 0.9 ? STATEGOV.fair : Math.round(STATEGOV.shortchanged * Math.min(1, (0.9 - f) / 0.9));
    partySat[party] = clamp((partySat[party] ?? 55) + d);
    if (d <= -5) lines.push({ text: `${party} feels shortchanged in the ${name} exco.`, tone: "bad" });
  }
  const chief = holderOf(s, yours, chiefKey(regionOf(t.state)));
  const people = s.people.map((p) => {
    if (p.id === t.mb) return { ...p, loyalty: clamp(p.loyalty + 10), influence: clamp(p.influence + 5) };
    // Your state chief expected the top job.
    if (chief && p.id === chief.id && t.mb !== chief.id) return { ...p, loyalty: clamp(p.loyalty - 10) };
    if (t.exco.includes(p.id)) return { ...p, loyalty: clamp(p.loyalty + 4) };
    return p;
  });
  const mb = s.people.find((p) => p.id === t.mb);
  const mbParty = mb?.party ?? g.party;
  lines.push({ text: `${mb ? mb.name : "A caretaker"} is sworn in as ${mbTitle(t.state)} of ${name}, with ${t.exco.length} exco members.`, tone: "good" });
  return {
    state: { ...s, partySat, people, stateGov: { ...s.stateGov, [t.state]: { ...g, mb: t.mb, exco: t.exco, party: mbParty } }, stateTerms: terms.filter((x) => x !== t) },
    lines,
  };
}

// --- Your states' powers ------------------------------------------------------------------------------

export type StatePower = "grants" | "land";

export const STATE_POWERS: Record<StatePower, { name: string; text: string }> = {
  grants: { name: "Kampung grants", text: `RM ${STATEGOV.grants.cost / 1e6}M from the state treasury: buzz and service in every seat you fight in the state` },
  land: { name: "Land & projects", text: "Approve land deals and contracts: money for the war chest, and MACC risk" },
};

export function statePowerBlocked(s: GameState, id: string, power: StatePower): string | null {
  const g = s.stateGov?.[id];
  if (!g || g.ruler !== s.player) return "You don't govern this state.";
  if (g.actionWeek !== null && s.week - g.actionWeek < STATEGOV.actionEvery) return `Next state decision in ${STATEGOV.actionEvery - (s.week - g.actionWeek)} week(s).`;
  if (power === "grants" && g.funds < STATEGOV.grants.cost) return "The state treasury can't afford it yet.";
  return null;
}

const mbOf = (s: GameState, id: string) => s.people.find((p) => p.id === s.stateGov[id]?.mb);

export function exerciseStatePower(s: GameState, id: string, power: StatePower): { state: GameState; message: string } | { error: string } {
  const why = statePowerBlocked(s, id, power);
  if (why) return { error: why };
  const g = s.stateGov[id];
  const mb = mbOf(s, id);
  const m = 0.6 + (mb?.competence ?? 50) / 125;
  const me = { ...s.me };
  const name = STATE_BY_ID[id].name;
  let funds = g.funds;
  let message: string;
  if (power === "grants") {
    funds -= STATEGOV.grants.cost;
    const buzz = [...me.buzz];
    const service = [...me.service];
    for (const seat of SEATS)
      if (seat.state === id && contestingIn(seat, s.entries).includes(s.player)) {
        buzz[seat.index] = clamp(buzz[seat.index] + STATEGOV.grants.buzz * m);
        service[seat.index] = clamp(service[seat.index] + STATEGOV.grants.service * m);
      }
    me.buzz = buzz;
    me.service = service;
    message = `The ${name} government hands out kampung grants${mb ? `; ${mb.name} cuts the ribbons` : ""}.`;
  } else {
    me.funds += Math.round(STATEGOV.land.funds + (mb?.competence ?? 50) * STATEGOV.land.perComp);
    me.risk = clamp(me.risk + STATEGOV.land.risk);
    me.integrity = clamp(me.integrity + STATEGOV.land.integrity);
    message = `The ${name} exco approves land deals; friendly contractors remember the party. MACC takes note.`;
  }
  return { state: { ...s, me, stateGov: { ...s.stateGov, [id]: { ...g, funds, actionWeek: s.week } } }, message };
}

/** Weekly: your state treasuries fill; governments stay current; a disloyal MB may break away (a card). */
export function stateGovWeek(s: GameState): { state: GameState; lines: ReportLine[]; rebel: { state: string; person: number } | null } {
  let state = syncStateGov(s);
  const gov = { ...state.stateGov };
  for (const id of ASSEMBLY_STATES) if (gov[id].ruler === s.player) gov[id] = { ...gov[id], funds: Math.min(STATEGOV.fundsCap, gov[id].funds + DUNS_BY_STATE[id].length * STATEGOV.incomePerSeat) };
  state = { ...state, stateGov: gov };
  let rebel: { state: string; person: number } | null = null;
  if (s.week % 4 === 1 && (s.cardLast.mbRebel ?? -99) < s.week - 26) {
    for (const id of ASSEMBLY_STATES) {
      const mb = mbOf(state, id);
      if (gov[id].ruler === s.player && mb && mb.loyalty < STATEGOV.rebelLoyalty && hash01("mbrebel", s.seed, s.week, id) < 0.2) {
        rebel = { state: id, person: mb.id };
        break;
      }
    }
  }
  return { state, lines: [], rebel };
}

/** At the start of a week: drafts left open are sworn in; talks past their deadline end. */
export function resolveStatePending(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  let state: GameState = { ...s, stateNight: null };
  if (state.stateTalks && state.week >= state.stateTalks.deadline) state = finishTalks(state);
  while ((state.stateTerms ?? []).length) {
    const r = confirmStateTerm(state);
    state = r.state;
    lines.push(...r.lines);
  }
  return { state, lines };
}

/** The MB breaks away with a share of your assembly members (they sit as independents). */
function mbBreaksAway(s: GameState, id: string): { state: GameState; lines: ReportLine[] } {
  const g = s.stateGov[id];
  const mb = mbOf(s, id);
  const mine = DUNS_BY_STATE[id].filter((d) => s.dunHolders[d] === s.player);
  const take = new Set(mine.filter((d) => hash01("breakaway", s.seed, s.week, d) < 0.3));
  const dunHolders = s.dunHolders.map((h, d) => (take.has(d) ? ("OTHERS" as CoalitionId) : h));
  let state: GameState = { ...s, dunHolders, people: s.people.map((p) => (p.id === mb?.id ? { ...p, loyalty: 0 } : p)) };
  const lines: ReportLine[] = [{ text: `${mb?.name ?? "The MB"} breaks away with ${take.size} assembly members in ${STATE_BY_ID[id].name}.`, tone: "bad" }];
  const seats = stateSeats(state, id);
  const total = DUNS_BY_STATE[id].length;
  const bloc = [g.ruler, ...g.partners].reduce((n, c) => n + (seats[c] ?? 0), 0);
  if (bloc <= total / 2) {
    state = { ...state, stateGov: { ...state.stateGov, [id]: { ...g, settled: false } } };
    state = settle(state, id, lines);
  } else state = { ...state, stateGov: { ...state.stateGov, [id]: { ...g, mb: null } } };
  return { state: syncStateGov(state), lines };
}

const cardState = (c?: CardInstance) => c?.state ?? "";

export const MB_REBEL_CARD: CardDef = {
  kind: "mbRebel",
  title: "Your MB goes rogue",
  text: (s, c) => {
    const p = s.people.find((x) => x.id === c.person);
    const id = cardState(c);
    return `${p?.name ?? "Your MB"}, ${mbTitle(id)} of ${STATE_BY_ID[id]?.name ?? "a state"}, is running the state as a personal fief and counting heads in the assembly. Word is they could walk out with a bloc of members.`;
  },
  choices: () => [
    {
      label: "Replace them",
      effect: {
        unity: -4,
        capital: -8,
        then: (st, c) => {
          const id = cardState(c);
          if (!st.stateGov[id]) return { state: st };
          const people = st.people.map((p) => (p.id === c?.person ? { ...p, loyalty: 5 } : p));
          const next = syncStateGov({ ...st, people, stateGov: { ...st.stateGov, [id]: { ...st.stateGov[id], mb: null } } });
          return { state: openStateTerm(next, id), lines: [{ text: `You drop the ${mbTitle(id)} of ${STATE_BY_ID[id].name}. Pick their successor.`, tone: "info" }] };
        },
      },
    },
    { label: "Make peace: more say and more money", effect: { capital: -6, personLoyalty: 25 } },
    {
      label: "Call their bluff",
      effect: { then: (st, c) => (hash01("bluff", st.seed, st.week) < 0.5 ? mbBreaksAway(st, cardState(c)) : { state: st, lines: [{ text: "The MB backs down. For now.", tone: "info" }] }) },
      note: "Even odds they walk out with part of the assembly.",
    },
  ],
  defaultChoice: 1,
};
