// All balancing numbers live here. Every value is TEMPORARY.

import type { Bloc, CoalitionId, Region } from "./world";

type Lean = Partial<Record<CoalitionId, number>>;

/**
 * How each voter bloc leans in each region before seat-level effects (GE15-ish).
 * Seats are then calibrated so the starting map reproduces the GE15 result.
 */
export const BLOC_LEAN: Record<Region, Record<Bloc, Lean>> = {
  peninsula: {
    malay: { PH: 0.2, BN: 0.27, PN: 0.5, MUDA: 0.02, OTHERS: 0.01 },
    chinese: { PH: 0.82, BN: 0.1, PN: 0.05, MUDA: 0.02, OTHERS: 0.01 },
    indian: { PH: 0.65, BN: 0.18, PN: 0.15, MUDA: 0.01, OTHERS: 0.01 },
    sabah: { PH: 0.3, BN: 0.3, PN: 0.3, OTHERS: 0.1 },
    sarawak: { PH: 0.3, BN: 0.3, PN: 0.3, OTHERS: 0.1 },
    other: { PH: 0.4, BN: 0.2, PN: 0.2, MUDA: 0.05, OTHERS: 0.15 },
  },
  sabah: {
    malay: { PH: 0.15, BN: 0.25, PN: 0.3, GRS: 0.15, WARISAN: 0.12, OTHERS: 0.03 },
    chinese: { PH: 0.6, BN: 0.05, PN: 0.03, GRS: 0.15, WARISAN: 0.15, OTHERS: 0.02 },
    indian: { PH: 0.6, BN: 0.2, PN: 0.1, GRS: 0.05, WARISAN: 0.04, OTHERS: 0.01 },
    sabah: { PH: 0.1, BN: 0.18, PN: 0.07, GRS: 0.3, WARISAN: 0.25, OTHERS: 0.1 },
    sarawak: { PH: 0.2, BN: 0.2, PN: 0.1, GRS: 0.25, WARISAN: 0.2, OTHERS: 0.05 },
    other: { PH: 0.15, BN: 0.15, PN: 0.1, GRS: 0.2, WARISAN: 0.3, OTHERS: 0.1 },
  },
  sarawak: {
    malay: { GPS: 0.75, PH: 0.1, PN: 0.12, OTHERS: 0.03 },
    chinese: { GPS: 0.3, PH: 0.6, PN: 0.05, OTHERS: 0.05 },
    indian: { GPS: 0.4, PH: 0.5, PN: 0.05, OTHERS: 0.05 },
    sabah: { GPS: 0.6, PH: 0.2, PN: 0.1, OTHERS: 0.1 },
    sarawak: { GPS: 0.72, PH: 0.1, PN: 0.1, OTHERS: 0.08 },
    other: { GPS: 0.5, PH: 0.3, PN: 0.1, OTHERS: 0.1 },
  },
};

/** Share of the electorate that votes, before noise. */
export const TURNOUT = {
  base: 0.76,
  /** Young voters turn out less. */
  youthPenalty: 0.15,
  noise: 0.03,
  min: 0.5,
  max: 0.9,
};

/** Uncertainty of a simulated election, in log-odds. */
export const ELECTION_NOISE = {
  /** One draw per coalition for the whole country. */
  national: 0.06,
  /** One draw per coalition per state. */
  state: 0.06,
  /** One draw per coalition per seat. */
  seat: 0.1,
};

/** Projected margin (share points) for each seat rating. */
export const RATING_MARGIN = { safe: 0.15, likely: 0.07, lean: 0.025 };

// ---------------------------------------------------------------------------------------------
// Milestone 4: turn loop, resources, actions, party business empire. All values TEMPORARY.
// ---------------------------------------------------------------------------------------------

/** First game week (a Monday). Parliament automatically dissolves on 19 Dec 2027 (5 years after first sitting). */
export const START_DATE = "2026-10-19";
export const AUTO_DISSOLUTION = "2027-12-19";

/** Starting position per coalition (RM, members). */
export const START: Record<CoalitionId, { funds: number; members: number }> = {
  PH: { funds: 20_000_000, members: 1_500_000 },
  BN: { funds: 35_000_000, members: 3_300_000 },
  PN: { funds: 25_000_000, members: 1_400_000 },
  GPS: { funds: 30_000_000, members: 600_000 },
  GRS: { funds: 8_000_000, members: 200_000 },
  WARISAN: { funds: 6_000_000, members: 150_000 },
  MUDA: { funds: 1_500_000, members: 30_000 },
  OTHERS: { funds: 1_000_000, members: 10_000 },
};

export const ECONOMY = {
  /** Weekly party dues per member. */
  duesPerMember: 0.1,
  /** Weekly party income from each seat you hold (allocations, MP contributions). */
  seatIncomeGov: 8_000,
  seatIncomeOpp: 1_500,
  /** Weekly HQ overhead: fixed + per member. */
  hqFixed: 20_000,
  hqPerMember: 0.03,
  /** Weekly upkeep per machinery point, only in seats you contest. */
  machineryUpkeep: 25,
  /** Machinery lost per week when upkeep can't be paid. */
  machineryDecayUnpaid: 0.03,
  /** Fundraising fatigue: each dinner adds this, recovering per week. */
  fatiguePerDinner: 0.25,
  fatigueRecovery: 0.05,
};

/** How local and national presence turn into log-odds for your coalition. */
export const EFFECT = {
  /** Per point of constituency service above the seat's starting level (permanent). */
  service: 0.004,
  /** Per point of buzz (fades). */
  buzz: 0.005,
  /** Per point of machinery above the starting level (turnout). */
  machinery: 0.003,
  /** National buzz per point, added to your national swing. */
  nationalBuzz: 0.003,
  /** Scandal per point, taken off your national swing. */
  scandal: 0.004,
  /** Integrity per point above/below 60. */
  integrity: 0.002,
  /** Coalition trust below this costs every seat. */
  trustFloor: 40,
  trustPenalty: 0.03,
  /** Per economy point away from normal (55): the government gets credit and blame, the opposition a little of the reverse. */
  economyGov: 0.004,
  economyOpp: 0.002,
};

export const DECAY = {
  /** Share of buzz lost each week. */
  buzz: 0.05,
  nationalBuzz: 0.06,
  scandal: 0.05,
  /** Share of service lost each week (slow). */
  service: 0.002,
  /** Weekly drift toward the resting value. */
  unityRest: 60,
  unityDrift: 0.03,
  integrityRest: 60,
  integrityDrift: 0.01,
  riskPerWeek: 0.5,
};

/** Held seats build service on their own each week (MP allocations). */
export const SEAT_SERVICE_PER_WEEK = { gov: 0.3, opp: 0.1 };

/** Fortress levels by constituency service. */
export const FORTRESS = [
  { min: 70, name: "Kubu Kuat" },
  { min: 45, name: "Safe" },
  { min: 20, name: "Leaning" },
  { min: 0, name: "Marginal" },
];

export const AP_PER_WEEK = 6;

/** MACC: weekly probe chance = max(0, risk − threshold) / divisor. */
export const MACC = { threshold: 40, divisor: 400, fineShare: 0.1, integrityHit: 10, scandal: 30 };

// ---------------------------------------------------------------------------------------------
// Milestone 5: economy, policies, Budget, decision cards. All values TEMPORARY.
// ---------------------------------------------------------------------------------------------

/** Economy index at rest; it drifts back here each week. */
export const ECONOMY_REST = 55;
export const ECONOMY_DRIFT = { economy: 0.02, fiscal: 0.01, noise: 1.5 };

/** Public mood from events fades this share each week. */
export const MOOD_DECAY = 0.04;

export const CARDS = {
  /** No random cards before this week. */
  firstWeek: 3,
  /** Weekly chance of a new random card (about 1.3 a month). */
  chance: 0.33,
  /** Weeks before an unanswered card takes its default choice. */
  answerWeeks: 4,
  /** The same kind won't repeat within this many weeks. */
  noRepeat: 24,
  /** At most this many cards wait at once. */
  maxPending: 3,
};
