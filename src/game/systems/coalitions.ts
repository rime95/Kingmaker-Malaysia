// Coalitions are alliances of parties that can change during a game.
// - Each coalition slot (PH, BN, PN…) has a name, short name, colour and member parties. The first member leads it.
// - Every non-leading party has a satisfaction with its coalition. It drifts monthly: up in government, down in
//   opposition, and up or down with how the coalition treats it (seat talks, decision cards).
// - Unhappy parties leave and join the coalition they like best. Their MPs cross with them, and their candidates take
//   their personal vote along (the old coalition must field someone new).
// - Winners rename their coalition. The player names theirs; the AI sometimes rebrands after a big change.
// Slots never change (the voter model is per slot), so a coalition with no members simply has no candidates left.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, COALITION_INFO, PARTIES, SEATS, candidateParty, contestingIn, cshort, seatRegion, setCoalitionNames, type CoalitionId, type Seat } from "../world";
import { AFFINITY } from "./formation";

export interface CoalitionState {
  name: string;
  short: string;
  color: string;
  /** Member parties; the first one leads. */
  members: string[];
}

export type Coalitions = Record<CoalitionId, CoalitionState>;

export const COALITION_RULES = {
  /** Satisfaction drifts toward this each month. */
  rest: 55,
  drift: 0.1,
  govPerMonth: 3,
  oppPerMonth: -1,
  /** At or below this, a party in your coalition threatens to walk out (a decision card). */
  warn: 30,
  /** At or below this, a party leaves. */
  leave: 15,
  /** AI coalitions: monthly chance an unhappy party (below warn) walks. */
  aiLeaveChance: 0.25,
  /** Log-odds a candidate's personal vote carries when their party switches coalitions. */
  personalVote: 0.5,
};

const START_SAT: Record<string, number> = {
  DAP: 70,
  AMANAH: 65,
  UPKO: 40,
  MCA: 45,
  MIC: 38,
  PBRS: 55,
  PAS: 62,
  GERAKAN: 55,
  SUPP: 72,
  PRS: 70,
  PDP: 66,
  KDM: 50,
  PBM: 50,
};

/** Where a party would rather be, beyond what its coalition thinks (−1 to 1). */
const PARTY_LEAN: Record<string, Partial<Record<CoalitionId, number>>> = {
  MIC: { PN: 0.35 },
  MCA: { PN: -0.3, PH: 0.1 },
  UPKO: { WARISAN: 0.3, GRS: 0.2 },
  PBRS: { GRS: 0.4 },
  GERAKAN: { BN: 0.3 },
  KDM: { GRS: 0.35, BN: 0.2 },
  PBM: { PH: 0.3, GPS: 0.2 },
};

/** Colours with clearly different hues, for coalitions to pick from. */
export const PALETTE = ["#e5383b", "#4f74e8", "#cf7317", "#c94f9c", "#1a9fd0", "#a8932a", "#159a7c", "#8b5cf6", "#e8c547", "#ff8fc7", "#8fd14f", "#a8653a", "#9c2f52"];

/** AI coalitions rebrand from these. */
const NAME_POOL = [
  ["Gagasan Rakyat", "GR"],
  ["Perpaduan Nasional", "PPN"],
  ["Barisan Bersatu", "BB"],
  ["Pakatan Rakyat Baharu", "PRB"],
  ["Ikatan Prihatin", "IP"],
  ["Gabungan Harapan Rakyat", "GHR"],
  ["Muafakat Nasional", "MN"],
  ["Angkatan Perpaduan", "AP"],
] as const;

export function initCoalitions(): Coalitions {
  return Object.fromEntries(
    COALITIONS.map((c) => {
      const members = Object.values(PARTIES)
        .filter((p) => p.coalition === c)
        .map((p) => p.id);
      return [c, { name: COALITION_INFO[c].name, short: COALITION_INFO[c].short, color: PALETTE_START[c], members }];
    }),
  ) as Coalitions;
}

const PALETTE_START: Record<CoalitionId, string> = { PH: "#e5383b", BN: "#4f74e8", GPS: "#cf7317", GRS: "#c94f9c", WARISAN: "#1a9fd0", MUDA: "#a8932a", PN: "#159a7c", OTHERS: "#8a8f9c" };

export function initPartySat(): Record<string, number> {
  return { ...START_SAT };
}

/** Keep display names in step with a game (call whenever the game changes). */
export function syncNames(s: { coalitions: Coalitions }) {
  setCoalitionNames(Object.fromEntries(COALITIONS.map((c) => [c, { name: s.coalitions[c].name, short: s.coalitions[c].short }])) as Record<CoalitionId, { name: string; short: string }>);
}

export function coalitionOf(s: Pick<GameState, "coalitions">, party: string): CoalitionId {
  for (const c of COALITIONS) if (s.coalitions[c].members.includes(party)) return c;
  return "OTHERS";
}

export const leadParty = (s: Pick<GameState, "coalitions">, c: CoalitionId) => s.coalitions[c].members[0] ?? null;

/** The party a coalition fields in a seat, after any parties have changed sides. */
export function seatCandidate(s: Pick<GameState, "seatParty" | "coalitions">, seat: Seat, c: CoalitionId): string {
  const override = s.seatParty[seat.index]?.[c];
  if (override) return override;
  const base = candidateParty(seat, c);
  const members = s.coalitions[c].members;
  if (c === "OTHERS" || members.includes(base) || !members.length) return base;
  // The usual party has left: the coalition's leading party (or another member from the region) stands instead.
  const region = seatRegion(seat);
  return members.find((p) => PARTIES[p]?.home === region) ?? members[0];
}

// --- Colours -------------------------------------------------------------------------------------

function toOklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** Perceptual distance between two colours (OKLab). */
export function colorDistance(a: string, b: string): number {
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export const MIN_COLOR_DISTANCE = 0.09;

/** Colours another active coalition already uses. */
export function usedColors(s: Pick<GameState, "coalitions">, except?: CoalitionId): string[] {
  return COALITIONS.filter((c) => c !== except && s.coalitions[c].members.length).map((c) => s.coalitions[c].color);
}

export function colorFree(s: Pick<GameState, "coalitions">, color: string, except?: CoalitionId): boolean {
  return usedColors(s, except).every((u) => colorDistance(u, color) >= MIN_COLOR_DISTANCE);
}

/** A party's shade: the lead party wears the coalition colour, partners lighter or darker versions of it. */
export function partyColor(s: Pick<GameState, "coalitions">, party: string): string {
  const c = coalitionOf(s, party);
  const k = s.coalitions[c].members.indexOf(party);
  if (k <= 0) return `var(--c-${c})`;
  const amount = 22 + Math.floor((k - 1) / 2) * 16;
  return `color-mix(in oklch, var(--c-${c}) ${100 - amount}%, ${k % 2 ? "white" : "black"})`;
}

// --- Parties changing sides ----------------------------------------------------------------------

/** Coalitions a party could join: they stand where the party is based and like it enough. */
function joinScore(s: GameState, party: string, to: CoalitionId): number {
  const from = coalitionOf(s, party);
  if (to === from || to === "OTHERS") return -Infinity;
  const home = PARTIES[party]?.home ?? "national";
  const standsThere = SEATS.some((seat) => (home === "national" || seatRegion(seat) === home) && contestingIn(seat).includes(to));
  if (!standsThere || !s.coalitions[to].members.length) return -Infinity;
  return (AFFINITY[from]?.[to] ?? 0) + (PARTY_LEAN[party]?.[to] ?? 0) + (s.government.includes(to) ? 0.15 : 0);
}

export function bestHome(s: GameState, party: string): CoalitionId | null {
  let best: CoalitionId | null = null;
  let score = 0;
  for (const c of COALITIONS) {
    const v = joinScore(s, party, c);
    if (v > score) {
      score = v;
      best = c;
    }
  }
  return best;
}

/**
 * Moves a party to another coalition: its MPs cross the floor with it, its candidates take their personal vote along,
 * and the old coalition has to field someone else in those seats.
 */
export function moveParty(s: GameState, party: string, to: CoalitionId): GameState {
  const from = coalitionOf(s, party);
  if (from === to) return s;
  const coalitions = { ...s.coalitions, [from]: { ...s.coalitions[from], members: s.coalitions[from].members.filter((p) => p !== party) }, [to]: { ...s.coalitions[to], members: [...s.coalitions[to].members, party] } };
  const holders = s.holders.map((h, i) => (s.holderParties[i] === party ? to : h));
  const fi = COALITIONS.indexOf(from);
  const ti = COALITIONS.indexOf(to);
  const seatOffsets = s.seatOffsets.map((row) => [...row]);
  const seatParty = { ...s.seatParty };
  const entries = { ...s.entries };
  for (const seat of SEATS) {
    if (seatCandidate(s, seat, from) !== party) continue;
    // The party's seats come with it: its new coalition stands there from now on.
    if (!contestingIn(seat, entries).includes(to)) entries[seat.index] = [...(entries[seat.index] ?? []), to];
    const contests = contestingIn(seat, entries);
    seatOffsets[seat.index][fi] -= COALITION_RULES.personalVote;
    if (contests.includes(to)) {
      seatOffsets[seat.index][ti] += COALITION_RULES.personalVote;
      seatParty[seat.index] = { ...seatParty[seat.index], [to]: party };
    }
    const rest = { ...seatParty[seat.index] };
    delete rest[from];
    seatParty[seat.index] = rest;
  }
  const partySat = { ...s.partySat, [party]: 60 };
  return { ...s, coalitions, holders, seatOffsets, seatParty, partySat, entries };
}

// --- Monthly turn --------------------------------------------------------------------------------

/** Monthly: satisfaction drifts; unhappy parties warn you (a card) or walk out. Runs inside advanceWeek. */
export function coalitionsWeek(s: GameState): { state: GameState; lines: ReportLine[]; warn: string | null } {
  const lines: ReportLine[] = [];
  if (s.week % 4 !== 0) return { state: s, lines, warn: null };
  let state = s;
  const partySat = { ...s.partySat };
  let warn: string | null = null;
  for (const c of COALITIONS) {
    if (c === "OTHERS") continue;
    for (const party of s.coalitions[c].members.slice(1)) {
      let v = partySat[party] ?? COALITION_RULES.rest;
      v += (COALITION_RULES.rest - v) * COALITION_RULES.drift;
      v += s.government.includes(c) ? COALITION_RULES.govPerMonth : COALITION_RULES.oppPerMonth;
      if (c === s.player) v += (s.me.trust - 50) / 25;
      v += (hash01("psat", s.seed, s.week, party) - 0.5) * 6;
      partySat[party] = Math.max(0, Math.min(100, v));
    }
  }
  state = { ...state, partySat };
  for (const c of COALITIONS) {
    if (c === "OTHERS") continue;
    for (const party of state.coalitions[c].members.slice(1)) {
      const v = state.partySat[party];
      const home = bestHome(state, party);
      if (c === s.player) {
        if (v <= COALITION_RULES.leave && home) {
          lines.push({ text: `${PARTIES[party].name} walks out of ${cshort(c)} and joins ${cshort(home)}. Its MPs cross the floor with it.`, tone: "bad" });
          state = moveParty(state, party, home);
        } else if (v <= COALITION_RULES.warn && !warn && !state.cards.some((x) => x.kind === "partnerWalkout")) warn = party;
      } else if (v <= COALITION_RULES.warn && home && hash01("aileave", s.seed, s.week, party) < COALITION_RULES.aiLeaveChance) {
        lines.push({ text: `${PARTIES[party].name} quits ${cshort(c)} for ${cshort(home)}.`, tone: home === s.player ? "good" : "info" });
        state = moveParty(state, party, home);
      }
    }
  }
  return { state, lines, warn };
}

/** After a general election: a new prime minister's coalition may rebrand (the AI only; you choose for yours). */
export function aiRebrand(s: GameState, c: CoalitionId): { state: GameState; line: ReportLine | null } {
  if (c === s.player || c === "OTHERS" || hash01("rebrand", s.seed, s.week, c) > 0.3) return { state: s, line: null };
  const taken = new Set(COALITIONS.map((x) => s.coalitions[x].name));
  const pick = NAME_POOL.find(([n]) => !taken.has(n));
  if (!pick) return { state: s, line: null };
  const old = s.coalitions[c];
  const color = colorFree(s, old.color, c) ? old.color : (PALETTE.find((p) => colorFree(s, p, c)) ?? old.color);
  const state = { ...s, coalitions: { ...s.coalitions, [c]: { ...old, name: pick[0], short: pick[1], color } } };
  return { state, line: { text: `${old.name} relaunches as ${pick[0]} (${pick[1]}).`, tone: "info" } };
}

/** Rename your coalition. */
export function renameCoalition(s: GameState, name: string, short: string, color: string): { ok: true; state: GameState } | { ok: false; error: string } {
  const n = name.trim();
  const sh = short.trim();
  if (n.length < 3 || n.length > 40) return { ok: false, error: "The name needs 3 to 40 characters." };
  if (sh.length < 2 || sh.length > 8) return { ok: false, error: "The short name needs 2 to 8 characters." };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { ok: false, error: "Pick a colour." };
  if (COALITIONS.some((c) => c !== s.player && (s.coalitions[c].short.toLowerCase() === sh.toLowerCase() || s.coalitions[c].name.toLowerCase() === n.toLowerCase())))
    return { ok: false, error: "Another coalition already uses that name." };
  if (!colorFree(s, color, s.player)) return { ok: false, error: "Too close to another coalition's colour." };
  return { ok: true, state: { ...s, namePending: false, coalitions: { ...s.coalitions, [s.player]: { ...s.coalitions[s.player], name: n, short: sh, color } } } };
}

/** Who leads a coalition: its lead party's president today (you, if you lead your party). */
export function coalitionLeader(s: Pick<GameState, "coalitions" | "player" | "career" | "people">, c: CoalitionId): string {
  if (c === s.player && s.career.rung >= 6) return s.career.name;
  const lead = s.coalitions[c].members[0];
  if (!lead) return "—";
  return s.people.find((p) => p.party === lead && p.rank === 5)?.name ?? PARTIES[lead]?.leader ?? "—";
}
