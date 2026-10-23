// Your own climb: from branch chief to Prime Minister and elder statesman, and the dynasty after you.
// - Rungs are won at the annual party AGM (June) once you have enough career points, except Wakil Rakyat, which you
//   win by taking your home seat at a general election. Prime Minister is earned in the coalition talks.
// - Career points come from results: by-elections, state elections, seats gained, policies and Budgets passed,
//   and the faction of MPs loyal to you (they become loyal when you campaign in their seats).
// - The party president controls the big levers (policy, Budget, dissolution, coalition talks); below that, your
//   party's leadership decides. More rungs mean more action points.
// - Leaders age. At retirement your protégé takes over, keeping part of what you built. Lose badly and the party
//   may challenge you. All numbers TEMPORARY.

import { hash01 } from "../rng";
import { COALITION_INFO, SEATS, type CoalitionId } from "../world";

export const RUNGS = [
  "Ketua Cawangan",
  "Ketua Bahagian",
  "Wakil Rakyat",
  "Deputy Minister",
  "Minister",
  "Party Vice President",
  "Party President",
] as const;
/** Opposition names for the same rungs. */
export const RUNGS_OPP = ["Ketua Cawangan", "Ketua Bahagian", "Wakil Rakyat", "Shadow Deputy Minister", "Shadow Minister", "Party Vice President", "Party President"] as const;

export const PRESIDENT = 6;
export const MP = 2;

/** Career points needed to contest the next rung at the AGM (index = current rung). MP has no AGM route. */
export const CONTEST_POINTS = [10, Infinity, 30, 55, 85, 130];
export const AP_BY_RUNG = [4, 4, 5, 5, 6, 6, 6];

export const CAREER = {
  /** Loyalty an MP gains when you campaign in their seat, and the share lost each week. */
  loyaltyPerAction: 6,
  loyaltyDecay: 0.01,
  /** An MP counts in your faction at this loyalty. */
  factionLoyalty: 40,
  /** Monthly points per 10 faction MPs. */
  factionPointsPer10: 1,
  retireAgeMin: 78,
  retireAgeSpread: 6,
  /** What a protégé keeps of your points and faction loyalty. */
  successorKeeps: 0.6,
  /** Unity below this at an AGM triggers a leadership challenge against a president. */
  challengeUnity: 30,
};

export interface Career {
  name: string;
  mode: "career" | "leader";
  rung: number;
  points: number;
  age: number;
  /** Week of the next birthday. */
  birthdayWeek: number;
  retireAge: number;
  homeSeat: number;
  /** Generations of leaders so far (1 = you). */
  generation: number;
  protege: string;
  /** Loyalty of each MP to you (only seats your coalition holds count). */
  loyalty: number[];
  /** Weeks spent as Prime Minister. */
  pmWeeks: number;
  /** Set when the party is restless: the next AGM is a leadership challenge. */
  challenge: boolean;
  log: { week: number; text: string }[];
  /** Last week a role move earned career points. */
  roleWeek?: number;
}

/** Leaders' parliamentary seats in leader mode (real where the leader is an MP; otherwise a party stronghold). */
const LEADER_SEAT: Partial<Record<CoalitionId, string>> = { PH: "P.063", BN: "P.075", PN: "P.143", GPS: "P.194", GRS: "P.175", WARISAN: "P.189", MUDA: "P.146", BERSAMA: "P.100" };
/** Approximate ages in Oct 2026 for leader mode. */
const LEADER_AGE: Partial<Record<CoalitionId, number>> = { PH: 79, BN: 73, PN: 79, GPS: 76, GRS: 71, WARISAN: 69, MUDA: 34, BERSAMA: 49 };

/** Fictional names for protégés. */
const PROTEGES = ["Aisyah Rahman", "Daniel Lim", "Kavitha Raj", "Hafiz Osman", "Tan Mei Ling", "Joanna Jinggut", "Faizal Kadir", "Priya Nair", "Amirul Hakim", "Grace Lajim", "Wong Kar Fai", "Nurul Izzah Hamid"];

export function protegeName(seed: number, generation: number): string {
  return PROTEGES[Math.floor(hash01("protege", seed, generation) * PROTEGES.length)];
}

export function defaultHomeSeat(player: CoalitionId): number {
  const code = LEADER_SEAT[player];
  const seat = SEATS.find((s) => s.code === code) ?? SEATS.find((s) => s.ge15Coalition === player) ?? SEATS[0];
  return seat.index;
}

export function initCareer(player: CoalitionId, seed: number, mode: "career" | "leader", name?: string, homeSeat?: number): Career {
  const leader = mode === "leader";
  const age = leader ? (LEADER_AGE[player] ?? 60) : 34;
  return {
    name: name?.trim() || (leader ? COALITION_INFO[player].leader : "You"),
    mode,
    rung: leader ? PRESIDENT : 0,
    points: leader ? 100 : 0,
    age,
    birthdayWeek: 20 + Math.floor(hash01("bday", seed) * 30),
    retireAge: CAREER.retireAgeMin + Math.floor(hash01("retire", seed) * CAREER.retireAgeSpread) + (leader && age >= 78 ? 3 : 0),
    homeSeat: homeSeat ?? defaultHomeSeat(player),
    generation: 1,
    protege: protegeName(seed, 1),
    loyalty: SEATS.map(() => (leader ? 30 : 0)),
    pmWeeks: 0,
    challenge: false,
    log: [],
  };
}

export function rungName(c: Career, inGovernment: boolean, isPm: boolean): string {
  if (isPm && c.rung >= PRESIDENT) return "Prime Minister";
  return (inGovernment ? RUNGS : RUNGS_OPP)[c.rung];
}

/** MPs from your coalition loyal to you. */
export function factionSize(c: Career, holders: CoalitionId[], player: CoalitionId): number {
  let n = 0;
  holders.forEach((h, i) => {
    if (h === player && c.loyalty[i] >= CAREER.factionLoyalty) n++;
  });
  return n;
}

export function isPresident(c: Career): boolean {
  return c.rung >= PRESIDENT;
}

/** Chance of winning the next rung at the AGM. */
export function contestChance(c: Career, unity: number, faction: number, partySeats: number): number {
  const need = CONTEST_POINTS[c.rung] ?? Infinity;
  if (!isFinite(need)) return 0;
  const over = (c.points - need) / Math.max(10, need);
  const share = partySeats ? faction / partySeats : 0;
  return Math.max(0.05, Math.min(0.95, 0.4 + over * 0.6 + (unity - 60) / 200 + share * 0.4));
}

export function addPoints(c: Career, week: number, points: number, text: string): Career {
  if (!points) return c;
  return { ...c, points: Math.max(0, c.points + points), log: [{ week, text: `${points > 0 ? "+" : "−"}${Math.abs(points)} career points: ${text}` }, ...c.log].slice(0, 30) };
}

export function promote(c: Career, week: number, text: string): Career {
  return { ...c, rung: c.rung + 1, log: [{ week, text }, ...c.log].slice(0, 30) };
}

/** Hand over to your protégé: a new generation keeps part of what you built. */
export function succession(c: Career, seed: number, week: number): Career {
  const generation = c.generation + 1;
  return {
    ...c,
    name: c.protege,
    generation,
    protege: protegeName(seed, generation),
    age: 46 + Math.floor(hash01("heirage", seed, generation) * 10),
    retireAge: CAREER.retireAgeMin + Math.floor(hash01("retire", seed, generation) * CAREER.retireAgeSpread),
    points: Math.round(c.points * CAREER.successorKeeps),
    loyalty: c.loyalty.map((l) => l * CAREER.successorKeeps),
    challenge: false,
    log: [{ week, text: `${c.name} retires. ${c.protege} takes over as ${RUNGS[c.rung]} (generation ${generation}).` }, ...c.log].slice(0, 30),
  };
}
