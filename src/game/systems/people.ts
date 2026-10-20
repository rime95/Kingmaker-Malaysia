// The people of Malaysian politics: every MP, each party's leadership, and the young branch chiefs waiting their turn.
// - Each party is a pyramid: President, Deputy President, Vice Presidents, Supreme Council, division chiefs (MPs and
//   would-be MPs) and a small pool of branch chiefs.
// - Nobody appears from nowhere. When someone leaves (retires, loses a challenge, defects, is sacked or jailed), the post is
//   filled from the rank directly below, and that post from the rank below it, down to the branch chiefs. Only the branch
//   pool gets newly generated characters, young and unknown. Over a long game they rise all the way to the top.
// - Leaders who retire while holding a seat stay on as MPs until the next general election.
// - The government's cabinet is drawn from its parties' senior MPs, in proportion to each party's seats.
// Real people start with neutral, game-only numbers; scandal cards never name them (see events.ts). All numbers TEMPORARY.

import { PORTFOLIOS, ROSTERS, START_CABINET, type PortfolioId, type RosterEntry } from "../data/people";
import { weekDate } from "../bases";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { GE15_RESULTS } from "../data/ge15";
import { PARTIES, SEATS, type CoalitionId } from "../world";
import { makeName, recruitBloc } from "./names";

export const RANKS = ["Branch chief", "Division chief", "Supreme Council", "Vice President", "Deputy President", "President"] as const;
export const PRESIDENT_RANK = 5;

export interface Person {
  id: number;
  name: string;
  party: string;
  /** Index into RANKS. */
  rank: number;
  /** Parliamentary seat held, if an MP. */
  seat: number | null;
  born: number;
  retireAge: number;
  /** Stepped down from party posts; leaves at the next general election. */
  retired: boolean;
  /** 0–100: standing in the party (posts held, seats won, years served). */
  influence: number;
  /** 0–100: how well they run a ministry. */
  competence: number;
  /** 0–100: hunger for the next post. */
  ambition: number;
  /** 0–100: loyalty to you. */
  loyalty: number;
  /** Real person (from the starting snapshot) or generated. */
  real: boolean;
  /** Week they took their current rank. */
  since: number;
  /** Last week they did you a favour. */
  favourWeek?: number;
}

export const PEOPLE = {
  /** Fixed posts per rank for big, medium and small parties: [branch pool, -, council, VPs, deputy, president]. */
  slotsBig: [4, 0, 6, 3, 1, 1],
  slotsMid: [3, 0, 4, 2, 1, 1],
  slotsSmall: [2, 0, 2, 1, 1, 1],
  /** Influence each month, by rank. */
  influencePerMonth: [0.3, 0.3, 0.5, 0.7, 0.8, 0.8],
  mpInfluencePerMonth: 0.3,
  ministerInfluencePerMonth: 0.6,
  meetLoyalty: 8,
  meetCost: 20_000,
  favourLoyalty: 20,
  favourMinLoyalty: 60,
  favourCooldown: 8,
};

const START_INFLUENCE = [10, 25, 45, 60, 75, 90];

export function slotsFor(party: string): number[] {
  const seats = SEATS.filter((s) => s.ge15Party === party).length;
  return seats >= 10 ? PEOPLE.slotsBig : seats >= 3 ? PEOPLE.slotsMid : PEOPLE.slotsSmall;
}

/** Parties with a leadership (independents have none). */
export const HIERARCHY_PARTIES = Object.keys(PARTIES).filter((p) => p !== "IND");

export const yearOf = (week: number) => weekDate(week).getFullYear();
export const ageOf = (p: Person, week: number) => yearOf(week) - p.born;

const r = (seed: number, ...key: (string | number)[]) => hash01("ppl", seed, ...key);

function baseLoyalty(party: string, s: Pick<GameState, "player" | "coalitions">): number {
  const mine = s.coalitions[s.player].members;
  return party === mine[0] ? 50 : mine.includes(party) ? 35 : 15;
}

function newPerson(id: number, name: string, party: string, rank: number, seed: number, week: number, born: number, real: boolean, s: Pick<GameState, "player" | "coalitions">, seat: number | null = null): Person {
  return {
    id,
    name,
    party,
    rank,
    seat,
    born,
    retireAge: 72 + Math.floor(r(seed, "ret", id) * 14),
    retired: false,
    influence: START_INFLUENCE[rank] + Math.round((r(seed, "inf", id) - 0.5) * 10),
    competence: 35 + Math.round(r(seed, "comp", id) * 55),
    ambition: 20 + Math.round(r(seed, "amb", id) * 75),
    loyalty: baseLoyalty(party, s),
    real,
    since: week,
  };
}

/** A new branch chief: young, unknown, from a community the party recruits in. */
function recruit(id: number, party: string, seed: number, week: number, s: Pick<GameState, "player" | "coalitions">): Person {
  const seats = SEATS.filter((x) => x.ge15Party === party);
  const home = seats.length ? seats[Math.floor(r(seed, "home", id) * seats.length)] : SEATS[Math.floor(r(seed, "home2", id) * SEATS.length)];
  const bloc = recruitBloc(party, home.demo.ethnic, seed, id);
  const name = makeName(bloc, seed, id, party);
  return newPerson(id, name, party, 0, seed, week, yearOf(week) - 28 - Math.floor(r(seed, "age", id) * 12), false, s);
}

export interface PeopleState {
  people: Person[];
  nextPersonId: number;
  cabinet: Partial<Record<PortfolioId, number>>;
  /** Leader mode: the person who is you. */
  youId: number | null;
}

/** Everyone at the start: all 222 MPs from GE15, each party's real leadership, then generated posts to fill the pyramid. */
export function initPeople(s: Pick<GameState, "seed" | "week" | "player" | "coalitions" | "holderParties" | "government" | "parliament" | "career">): PeopleState {
  const seed = s.seed;
  const people: Person[] = [];
  let next = 1;
  const year = yearOf(s.week);
  // MPs
  GE15_RESULTS.forEach(([, , , cands], i) => {
    const party = s.holderParties[i];
    const p = newPerson(next++, cands[0][0], party, 1, seed, s.week, year - 40 - Math.floor(r(seed, "mpage", i) * 28), true, s, i);
    // Bigger majorities, more standing.
    p.influence = Math.round(20 + Math.min(20, SEATS[i].ge15Majority / 1500));
    people.push(p);
  });
  // Leaderships
  const place = (party: string, e: RosterEntry, rank: number) => {
    const [name, code, born] = e;
    const seat = code ? SEATS.findIndex((x) => x.code === code) : -1;
    const mp = seat >= 0 ? people.find((p) => p.seat === seat) : undefined;
    if (mp) {
      Object.assign(mp, { name, party, rank, born, influence: START_INFLUENCE[rank] + Math.round((r(seed, "linf", name) - 0.5) * 8) });
      return;
    }
    const p = newPerson(next++, name, party, rank, seed, s.week, born, true, s);
    people.push(p);
  };
  for (const [party, roster] of Object.entries(ROSTERS)) {
    place(party, roster.president, 5);
    if (roster.deputy) place(party, roster.deputy, 4);
    roster.vps?.forEach((e) => place(party, e, 3));
    roster.council?.forEach((e) => place(party, e, 2));
  }
  // Today's veterans don't all bow out at once: each real person serves at least a couple more years.
  for (const p of people) if (p.real) p.retireAge = Math.max(p.retireAge, year - p.born + 2 + Math.floor(r(seed, "stay", p.id) * 9));
  // Fill the pyramid from the top down with the party's most senior MPs, then generated members.
  for (const party of HIERARCHY_PARTIES) {
    const slots = slotsFor(party);
    for (let rank = 5; rank >= 2; rank--) {
      while (people.filter((p) => p.party === party && p.rank === rank).length < slots[rank]) {
        const pool = people.filter((p) => p.party === party && p.rank === 1).sort((a, b) => b.influence - a.influence);
        if (pool.length) {
          pool[0].rank = rank;
          pool[0].influence = Math.max(pool[0].influence, START_INFLUENCE[rank] - 5);
        } else {
          const p = recruit(next++, party, seed, s.week, s);
          p.rank = rank;
          p.influence = START_INFLUENCE[rank] - 10;
          p.born -= 10 + rank * 3;
          people.push(p);
        }
      }
    }
    for (let k = 0; k < slots[0]; k++) people.push(recruit(next++, party, seed, s.week, s));
  }
  // Leader mode: you are your party's president.
  const lead = s.coalitions[s.player].members[0];
  const youId = s.career.mode === "leader" ? (people.find((p) => p.party === lead && p.rank === 5)?.id ?? null) : null;
  let state: PeopleState = { people, nextPersonId: next, cabinet: {}, youId };
  state = { ...state, cabinet: startCabinet(state, s) };
  return state;
}

// --- Lookups -------------------------------------------------------------------------------------

export const byId = (s: Pick<GameState, "people">, id: number | undefined | null) => (id == null ? undefined : s.people.find((p) => p.id === id));
export const mpOf = (s: Pick<GameState, "people">, seat: number) => s.people.find((p) => p.seat === seat);
export const partyPeople = (s: Pick<GameState, "people">, party: string) => s.people.filter((p) => p.party === party).sort((a, b) => b.rank - a.rank || b.influence - a.influence);
export const leaderOfParty = (s: Pick<GameState, "people">, party: string) => s.people.find((p) => p.party === party && p.rank === PRESIDENT_RANK);
export const postOf = (s: Pick<GameState, "cabinet">, id: number): PortfolioId[] => (Object.entries(s.cabinet) as [PortfolioId, number][]).filter(([, v]) => v === id).map(([k]) => k);

/** Title for a person, e.g. "Vice President, UMNO · Minister of Health · MP for Kuala Selangor". */
export function titleOf(s: Pick<GameState, "cabinet">, p: Person): string {
  const parts = [`${p.retired ? "Former leader" : RANKS[p.rank]}, ${p.party}`];
  const posts = postOf(s, p.id);
  if (posts.length) parts.push(posts.map((k) => PORTFOLIOS.find((x) => x.id === k)!.name).join(", "));
  if (p.seat !== null) parts.push(`MP for ${SEATS[p.seat].name}`);
  return parts.join(" · ");
}

// --- Leaving and succession ----------------------------------------------------------------------

type Mutable = { people: Person[]; nextPersonId: number; cabinet: Partial<Record<PortfolioId, number>>; youId: number | null };

function score(p: Person, seed: number, week: number): number {
  return p.influence + Math.min(20, (week - p.since) / 26) + p.ambition * 0.1 + hash01("succ", seed, week, p.id) * 8;
}

/**
 * Fills a vacancy at `rank` in a party from the rank below, cascading down to the branch pool, where a new recruit joins.
 * Returns news lines for the top promotions.
 */
function fill(m: Mutable, party: string, rank: number, seed: number, week: number, s: Pick<GameState, "player" | "coalitions">, lines: ReportLine[]) {
  if (rank === 0) {
    m.people.push(recruit(m.nextPersonId++, party, seed, week, s));
    return;
  }
  if (rank === 1) {
    // A branch chief steps up to lead a division; a new recruit takes their branch.
    const up = m.people.filter((p) => p.party === party && p.rank === 0 && p.id !== m.youId).sort((a, b) => b.influence - a.influence)[0];
    if (up) {
      up.rank = 1;
      up.since = week;
    }
    m.people.push(recruit(m.nextPersonId++, party, seed, week, s));
    return;
  }
  // Anyone about to retire stays where they are.
  const eligible = (p: Person) => p.party === party && !p.retired && p.id !== m.youId && ageOf(p, week) < p.retireAge - 1;
  const below = m.people.filter((p) => eligible(p) && p.rank === rank - 1);
  // At the very top, a strong Vice President can beat the Deputy.
  const pool = rank === PRESIDENT_RANK ? m.people.filter((p) => eligible(p) && (p.rank === 4 || p.rank === 3)) : below;
  if (!pool.length) {
    const p = recruit(m.nextPersonId++, party, seed, week, s);
    p.rank = rank;
    m.people.push(p);
    return;
  }
  const best = [...pool].sort((a, b) => score(b, seed, week) + (b.rank === 4 ? 15 : 0) - (score(a, seed, week) + (a.rank === 4 ? 15 : 0)))[0];
  const from = best.rank;
  best.rank = rank;
  best.since = week;
  best.influence = Math.min(100, best.influence + 5);
  if (rank >= 3) lines.push({ text: `${best.name} becomes ${RANKS[rank]} of ${party}.`, tone: "info" });
  fill(m, party, from, seed, week, s, lines);
}

/** A party member takes over an empty seat (stands in at the next election; for now they sit for it). */
function replaceMp(m: Mutable, party: string, seat: number, seed: number, week: number, s: Pick<GameState, "player" | "coalitions">, lines: ReportLine[]) {
  const free = m.people.filter((p) => p.party === party && p.seat === null && !p.retired && p.rank >= 1 && p.rank <= 2 && p.id !== m.youId).sort((a, b) => b.influence - a.influence);
  let pick = free[0];
  if (!pick) {
    pick = m.people.filter((p) => p.party === party && p.rank === 0 && p.id !== m.youId)[0];
    if (pick) {
      pick.rank = 1;
      fill(m, party, 0, seed, week, s, lines);
    } else {
      pick = recruit(m.nextPersonId++, party, seed, week, s);
      pick.rank = 1;
      m.people.push(pick);
    }
  }
  pick.seat = seat;
}

/** Someone leaves their party post (and the party, unless they keep a seat as a retired MP). */
export function leave(s: GameState, id: number, reason: "retires" | "resigns" | "defects" | "removed", lines: ReportLine[]): GameState {
  const m: Mutable = { people: s.people.map((p) => ({ ...p })), nextPersonId: s.nextPersonId, cabinet: { ...s.cabinet }, youId: s.youId };
  const p = m.people.find((x) => x.id === id);
  if (!p || p.id === s.youId) return s;
  const rank = p.rank;
  const verb = { retires: "retires", resigns: "resigns", defects: "quits the party", removed: "is removed" }[reason];
  if (rank >= 3) lines.push({ text: `${p.name} ${verb} as ${RANKS[rank]} of ${p.party}${p.seat !== null && reason === "retires" ? ", staying on as an MP until the election" : ""}.`, tone: "info" });
  if (reason === "retires" && p.seat !== null) {
    p.retired = true;
    p.rank = 1;
  } else {
    m.people = m.people.filter((x) => x.id !== id);
    // Someone has to sit for the seat until the next election (a defector's seat goes to a by-election instead).
    if (p.seat !== null && reason !== "defects") replaceMp(m, p.party, p.seat, s.seed, s.week, s, lines);
  }
  // Out of cabinet too (the PM's post is refilled when a government forms).
  for (const [k, v] of Object.entries(m.cabinet)) if (v === id && k !== "pm") delete m.cabinet[k as PortfolioId];
  if (rank >= 2) fill(m, p.party, rank, s.seed, s.week, s, lines);
  return { ...s, ...m };
}

/** Monthly: people age, gain standing, and retire when their time comes. */
export function peopleMonth(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (s.week % 4 !== 2) return { state: s, lines };
  const inCabinet = new Set(Object.values(s.cabinet));
  let state: GameState = {
    ...s,
    people: s.people.map((p) => {
      const age = ageOf(p, s.week);
      let inf = p.influence + PEOPLE.influencePerMonth[p.rank] + (p.seat !== null ? PEOPLE.mpInfluencePerMonth : 0) + (inCabinet.has(p.id) ? PEOPLE.ministerInfluencePerMonth : 0);
      if (age > 75) inf -= 0.6;
      // Loyalty drifts slowly back toward where it started.
      const rest = baseLoyalty(p.party, s);
      return { ...p, influence: Math.max(0, Math.min(100, inf)), loyalty: p.loyalty + (rest - p.loyalty) * 0.03 };
    }),
  };
  const due = state.people.filter((p) => !p.retired && p.id !== state.youId && ageOf(p, s.week) >= p.retireAge && p.rank >= 1);
  for (const p of due.slice(0, 3)) state = leave(state, p.id, "retires", lines);
  return { state, lines };
}

// --- Elections -----------------------------------------------------------------------------------

/**
 * After polling: winners take their seats. A party's sitting MP keeps the seat if they won; otherwise the party's candidate
 * is its most senior member without a seat, or a branch chief stepping up. Losers keep their party posts; retired MPs go.
 */
export function seatWinners(s: GameState, winners: { seat: number; party: string }[], lines: ReportLine[]): GameState {
  const m: Mutable = { people: s.people.map((p) => ({ ...p })), nextPersonId: s.nextPersonId, cabinet: { ...s.cabinet }, youId: s.youId };
  for (const w of winners) {
    const sitting = m.people.find((p) => p.seat === w.seat);
    if (sitting && sitting.party === w.party && !sitting.retired) continue;
    if (sitting) {
      sitting.seat = null;
      sitting.influence = Math.max(0, sitting.influence - 8);
      if (sitting.retired) m.people = m.people.filter((p) => p.id !== sitting.id);
    }
    if (w.party === "IND" || !HIERARCHY_PARTIES.includes(w.party)) {
      const seat = SEATS[w.seat];
      const p = newPerson(m.nextPersonId++, makeName(recruitBloc("IND", seat.demo.ethnic, s.seed, w.seat), s.seed, w.seat, s.week), w.party, 1, s.seed, s.week, yearOf(s.week) - 45, false, s, w.seat);
      m.people.push(p);
      continue;
    }
    const free = m.people.filter((p) => p.party === w.party && p.seat === null && !p.retired && p.rank >= 1 && p.rank <= 3 && p.id !== m.youId).sort((a, b) => b.influence - a.influence);
    let cand = free.find((p) => hash01("cand", s.seed, s.week, w.seat, p.id) < 0.5) ?? free[0];
    if (!cand) {
      cand = m.people.filter((p) => p.party === w.party && p.rank === 0).sort((a, b) => b.influence - a.influence)[0];
      if (cand) {
        cand.rank = 1;
        cand.since = s.week;
        fill(m, w.party, 0, s.seed, s.week, s, lines);
      } else {
        cand = recruit(m.nextPersonId++, w.party, s.seed, s.week, s);
        cand.rank = 1;
        m.people.push(cand);
      }
    }
    cand.seat = w.seat;
    cand.influence = Math.min(100, cand.influence + 6);
  }
  // Retired MPs whose seats were contested leave politics.
  const contested = new Set(winners.map((w) => w.seat));
  m.people = m.people.filter((p) => !(p.retired && (p.seat === null || contested.has(p.seat))));
  return { ...s, ...m };
}

// --- Cabinet -------------------------------------------------------------------------------------

/** Seats each government party holds. */
function partySeats(s: Pick<GameState, "holders" | "holderParties">, government: CoalitionId[]): Record<string, number> {
  const out: Record<string, number> = {};
  s.holders.forEach((h, i) => {
    if (government.includes(h)) out[s.holderParties[i]] = (out[s.holderParties[i]] ?? 0) + 1;
  });
  return out;
}

/** Who a party sends to cabinet first: its most senior, most capable MPs (senators only when it has too few MPs). */
function nominees(people: Person[], party: string, taken: Set<number>): Person[] {
  return people
    .filter((p) => p.party === party && !taken.has(p.id) && !p.retired && p.rank >= 1)
    .sort((a, b) => (b.seat !== null ? 30 : 0) + b.rank * 12 + b.influence + b.competence * 0.3 - ((a.seat !== null ? 30 : 0) + a.rank * 12 + a.influence + a.competence * 0.3));
}

/**
 * Forms a cabinet for a government: the PM is the leader of the PM's coalition, the DPM goes to the next-largest
 * partner, and other posts are shared by seats (D'Hondt), each party sending its senior MPs.
 */
export function formCabinet(s: Pick<GameState, "people" | "holders" | "holderParties" | "coalitions" | "parliament" | "government" | "youId" | "player" | "career">, keep: Partial<Record<PortfolioId, number>> = {}): Partial<Record<PortfolioId, number>> {
  const cabinet: Partial<Record<PortfolioId, number>> = { ...keep };
  const taken = new Set(Object.values(cabinet));
  const pmCoal = s.parliament.pm;
  const pmParty = s.coalitions[pmCoal].members[0];
  if (!cabinet.pm) {
    const pm = pmCoal === s.player && s.youId !== null ? byId(s, s.youId) : leaderOfParty(s, pmParty);
    if (pm) cabinet.pm = pm.id;
  }
  if (cabinet.pm) taken.add(cabinet.pm);
  const seats = partySeats(s, s.government);
  const partners = s.government.filter((c) => c !== pmCoal && c !== "OTHERS").sort((a, b) => coalSeats(s, b) - coalSeats(s, a));
  const leaderOf = (c: CoalitionId) => {
    const lead = s.coalitions[c].members[0];
    return nominees(s.people, lead, taken)[0];
  };
  if (!cabinet.dpm && partners[0]) {
    const p = leaderOf(partners[0]);
    if (p) {
      cabinet.dpm = p.id;
      taken.add(p.id);
    }
  }
  const borneo = partners.find((c) => c === "GPS" || c === "GRS");
  if (!cabinet.dpm2 && borneo) {
    const p = leaderOf(borneo);
    if (p) {
      cabinet.dpm2 = p.id;
      taken.add(p.id);
    }
  }
  // D'Hondt over parties for the remaining ministries.
  const quota: Record<string, number> = {};
  for (const id of Object.values(cabinet)) {
    const p = byId(s, id);
    if (p) quota[p.party] = (quota[p.party] ?? 0) + 1;
  }
  for (const port of PORTFOLIOS) {
    if (cabinet[port.id]) continue;
    const party = Object.keys(seats)
      .filter((p) => HIERARCHY_PARTIES.includes(p))
      .sort((a, b) => seats[b] / ((quota[b] ?? 0) + 1) - seats[a] / ((quota[a] ?? 0) + 1))[0];
    const pick = party ? nominees(s.people, party, taken)[0] : undefined;
    if (!pick) continue;
    cabinet[port.id] = pick.id;
    taken.add(pick.id);
    quota[party] = (quota[party] ?? 0) + 1;
  }
  return cabinet;
}

function coalSeats(s: Pick<GameState, "holders">, c: CoalitionId): number {
  return s.holders.filter((h) => h === c).length;
}

/** The October 2026 cabinet where it is known, the rest by the usual rules. */
function startCabinet(m: PeopleState, s: Parameters<typeof initPeople>[0]): Partial<Record<PortfolioId, number>> {
  const keep: Partial<Record<PortfolioId, number>> = {};
  for (const [k, name] of Object.entries(START_CABINET) as [PortfolioId, string][]) {
    const p = m.people.find((x) => x.name === name);
    if (p) keep[k] = p.id;
  }
  return formCabinet({ ...s, people: m.people, youId: m.youId, holders: SEATS.map((x) => x.ge15Coalition) } as Parameters<typeof formCabinet>[0], keep);
}

/** How fairly each government party is treated: posts held ÷ posts its seats would earn. */
export function cabinetFairness(s: Pick<GameState, "people" | "cabinet" | "holders" | "holderParties" | "government">): Record<string, number> {
  const seats = partySeats(s, s.government);
  const total = Object.values(seats).reduce((a, b) => a + b, 0) || 1;
  const posts: Record<string, number> = {};
  const n = Object.keys(s.cabinet).length || 1;
  for (const id of Object.values(s.cabinet)) {
    const p = byId(s, id);
    if (p) posts[p.party] = (posts[p.party] ?? 0) + 1;
  }
  return Object.fromEntries(Object.keys(seats).map((p) => [p, (posts[p] ?? 0) / Math.max(0.5, (seats[p] / total) * n)]));
}


// --- You in the roster ---------------------------------------------------------------------------

/** Your party rank for each career rung (Ketua Cawangan … Party President). */
const RANK_FOR_RUNG = [0, 1, 1, 2, 2, 3, 5];

/** Your heir: the most loyal and senior of your party's deputy and vice presidents. */
export function heir(s: Pick<GameState, "people" | "youId" | "coalitions" | "player">): Person | undefined {
  const lead = s.coalitions[s.player].members[0];
  return s.people
    .filter((p) => p.party === lead && (p.rank === 4 || p.rank === 3) && p.id !== s.youId && !p.retired)
    .sort((a, b) => b.loyalty * 0.6 + b.influence * 0.4 - (a.loyalty * 0.6 + a.influence * 0.4))[0];
}

/**
 * Keeps the roster in step with your career: you hold the party rank your career has reached, sit for your home seat
 * once you win it, take over from your heir when a new generation starts, and the person you displaced moves aside.
 */
export function syncYou(s: GameState, lines: ReportLine[] = []): GameState {
  const lead = s.coalitions[s.player].members[0];
  const c = s.career;
  let state = s;
  let m: Mutable = { people: s.people.map((p) => ({ ...p })), nextPersonId: s.nextPersonId, cabinet: { ...s.cabinet }, youId: s.youId };
  let you = m.people.find((p) => p.id === m.youId);
  if (!you) {
    you = newPerson(m.nextPersonId++, c.name, lead, RANK_FOR_RUNG[c.rung], s.seed, s.week, yearOf(s.week) - c.age, false, s);
    you.loyalty = 100;
    m.people.push(you);
    m.youId = you.id;
  }
  // A new generation: your heir becomes you.
  if (you.name !== c.name) {
    const h = m.people.find((p) => p.name === c.name && p.id !== you!.id);
    if (h) {
      const rank = h.rank;
      m.people = m.people.filter((p) => p.id !== h.id);
      if (h.seat !== null && h.seat !== c.homeSeat) replaceMp(m, h.party, h.seat, s.seed, s.week, s, lines);
      for (const [k, v] of Object.entries(m.cabinet)) if (v === h.id) delete m.cabinet[k as PortfolioId];
      if (rank >= 2) fill(m, lead, rank, s.seed, s.week, s, lines);
    }
    you.name = c.name;
    you.born = yearOf(s.week) - c.age;
  }
  you.party = lead;
  const rank = RANK_FOR_RUNG[c.rung];
  if (you.rank !== rank) {
    const sitting = m.people.find((p) => p.party === lead && p.rank === rank && p.id !== you!.id);
    if (rank === PRESIDENT_RANK && sitting) {
      // The old president moves aside to the council (or retires if old enough).
      sitting.rank = 2;
      lines.push({ text: `${sitting.name} hands the ${lead} presidency to ${you.name}.`, tone: "info" });
    }
    const was = you.rank;
    you.rank = rank;
    you.since = s.week;
    if (was === PRESIDENT_RANK && rank < PRESIDENT_RANK) fill(m, lead, PRESIDENT_RANK, s.seed, s.week, s, lines);
  }
  // Your seat: once you have won your home seat.
  const home = c.homeSeat;
  const holdsHome = s.holders[home] === s.player && c.rung >= 2;
  if (holdsHome && you.seat !== home) {
    const other = m.people.find((p) => p.seat === home && p.id !== you!.id);
    if (other) other.seat = null;
    you.seat = home;
  } else if (!holdsHome && you.seat === home) you.seat = null;
  m = { ...m, people: m.people };
  state = { ...state, ...m };
  const h = heir(state);
  if (h && h.name !== state.career.protege) state = { ...state, career: { ...state.career, protege: h.name } };
  return state;
}

// --- Your dealings with people -------------------------------------------------------------------

export function meetBlocked(s: GameState, id: number): string | null {
  const p = byId(s, id);
  if (!p) return "They have left politics.";
  if (p.id === s.youId) return "That's you.";
  if (s.me.ap < 1) return "Needs 1 AP.";
  if (s.me.funds < PEOPLE.meetCost) return "Not enough money.";
  return null;
}

/** Coffee, a kenduri, a long dinner: loyalty to you rises (less once they already like you). */
export function meetPerson(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = meetBlocked(s, id);
  if (why) return { error: why };
  const people = s.people.map((p) => (p.id === id ? { ...p, loyalty: Math.min(100, p.loyalty + PEOPLE.meetLoyalty * (1 - p.loyalty / 130)) } : p));
  const p = byId(s, id)!;
  return { state: { ...s, people, me: { ...s.me, ap: s.me.ap - 1, funds: s.me.funds - PEOPLE.meetCost } }, message: `You spend an evening with ${p.name}.` };
}

/** What someone can do for you depends on who they are. */
export function favourOf(s: GameState, p: Person): { text: string; unity?: number; capital?: number; trust?: number; points?: number } {
  const mine = s.coalitions[s.player].members;
  if (!mine.includes(p.party)) return p.rank >= 3 ? { text: "Talks up working with you: partner trust +6", trust: 6 } : { text: "Passes you useful gossip: capital +4", capital: 4 };
  if (p.rank >= 3) return { text: "Rallies the party behind you: unity +5, capital +5", unity: 5, capital: 5 };
  if (p.seat !== null) return { text: "Brings their division's delegates to your side: career points +3", points: 3 };
  return { text: "Organises the grassroots for you: unity +3", unity: 3 };
}

export function favourBlocked(s: GameState, id: number): string | null {
  const p = byId(s, id);
  if (!p) return "They have left politics.";
  if (p.id === s.youId) return "That's you.";
  if (p.loyalty < PEOPLE.favourMinLoyalty) return `They need loyalty ${PEOPLE.favourMinLoyalty}+ to do you a favour.`;
  if (p.favourWeek !== undefined && s.week - p.favourWeek < PEOPLE.favourCooldown) return "You asked them recently.";
  return null;
}
