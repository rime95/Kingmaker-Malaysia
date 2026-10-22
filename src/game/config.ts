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
  service: 0.006,
  /** Per point of buzz (fades). */
  buzz: 0.007,
  /** Per point of machinery above the starting level (turnout). */
  machinery: 0.004,
  /** Momentum: national swing per point, and the point at which ground work counts double. */
  momentum: 0.003,
  momentumGround: 100,
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
  /** Share of momentum lost each week, and what each seat gained in a national poll adds. */
  momentum: 0.04,
  momentumPerSeat: 2.5,
  /** ...and each point of national vote share gained. */
  momentumPerPoint: 4,
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
/** Weeks in one turn: AP is handed out per turn, so a turn gets two weeks' worth. */
export const TURN_WEEKS = 2;

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

// ---------------------------------------------------------------------------------------------
// Milestone 6: AI rival parties. All values TEMPORARY.
// ---------------------------------------------------------------------------------------------

export const AI = {
  /** Multiplies how many moves rivals make each week (difficulty knob). */
  aggression: 1,
  /** Moves per week by phase: long before the election, in the last 26 weeks, in the last 8 weeks. */
  movesEarly: 1,
  movesMid: 3,
  movesLate: 4,
  midWeeks: 26,
  lateWeeks: 8,
  /** Rivals keep at least this much in the bank. */
  reserve: 1_000_000,
  /** Effect of rival moves (same scale as the player's). */
  ceramah: { cost: 30_000, buzz: 12 },
  service: { cost: 150_000, gain: 4 },
  handout: { cost: 250_000, buzz: 20 },
  media: { cost: 500_000, buzz: 8 },
  /** Attack ads against you: your national buzz falls and scandal rises. */
  attack: { cost: 300_000, playerBuzz: -5, playerScandal: 1 },
  /** Attack ads come mostly from your head-to-head rivals: chance scales with seats where you two are the top two, up to this many. */
  attackRivalrySeats: 40,
  /** Seats within this margin are worth fighting for. */
  attackGap: 0.1,
  defendGap: 0.08,
  /** Extra weight on seats you hold when a rival is hostile to you; allies mostly leave your seats alone. */
  hostileWeight: 1.4,
  allyWeight: 0.25,
  /** Allies turn hostile when your coalition trust falls below this. */
  allyTrustFloor: 40,
};

// ---------------------------------------------------------------------------------------------
// Milestone 7: state elections (PRN) and dissolution. All values TEMPORARY; dates approximate.
// ---------------------------------------------------------------------------------------------

/**
 * Each assembly's automatic dissolution date (five years after its first sitting) and whether it
 * traditionally dissolves together with Parliament.
 */
export const ASSEMBLY_TERMS: Record<string, { autoDissolve: string; syncWithGE: boolean }> = {
  PLS: { autoDissolve: "2027-12-19", syncWithGE: true },
  KDH: { autoDissolve: "2028-09-01", syncWithGE: false },
  KTN: { autoDissolve: "2028-09-01", syncWithGE: false },
  TRG: { autoDissolve: "2028-09-01", syncWithGE: false },
  PNG: { autoDissolve: "2028-09-01", syncWithGE: false },
  PRK: { autoDissolve: "2027-12-19", syncWithGE: true },
  PHG: { autoDissolve: "2027-12-19", syncWithGE: true },
  SGR: { autoDissolve: "2028-09-01", syncWithGE: false },
  NSN: { autoDissolve: "2028-09-01", syncWithGE: false },
  MLK: { autoDissolve: "2026-12-20", syncWithGE: false },
  JHR: { autoDissolve: "2027-04-21", syncWithGE: false },
  SBH: { autoDissolve: "2030-12-01", syncWithGE: false },
  SWK: { autoDissolve: "2027-02-14", syncWithGE: false },
};

/**
 * Seats per coalition in each assembly at the start (approximate, from the latest state elections).
 * Starting state seats are assigned to match these, so each state begins with its real government.
 */
export const ASSEMBLY_START: Record<string, Partial<Record<CoalitionId, number>>> = {
  PLS: { PN: 14, PH: 1 },
  KDH: { PN: 33, PH: 3 },
  KTN: { PN: 43, BN: 2 },
  TRG: { PN: 32 },
  PNG: { PH: 27, BN: 2, PN: 11 },
  PRK: { PN: 26, PH: 24, BN: 9 },
  PHG: { BN: 16, PN: 17, PH: 9 },
  SGR: { PH: 32, BN: 2, PN: 22 },
  NSN: { PH: 17, BN: 14, PN: 5 },
  MLK: { BN: 21, PH: 5, PN: 2 },
  JHR: { BN: 40, PH: 12, PN: 3, MUDA: 1 },
  SBH: { GRS: 29, WARISAN: 25, BN: 6, PH: 2, PN: 1, OTHERS: 10 },
  SWK: { GPS: 76, PH: 2, OTHERS: 4 },
};

export const PRN = {
  /** Weeks from dissolution to polling day (the law allows up to 60 days). */
  campaignWeeks: 4,
  /** A state government pays its ruling coalition this per assembly seat per week. */
  stateIncomePerSeat: 2_000,
  /** And builds service in its parliamentary seats each week. */
  stateServicePerWeek: 0.1,
  /** Momentum: national buzz per share of the assembly gained (e.g. +10% of seats → +2). */
  momentum: 20,
  /** Winning or losing a state government. */
  win: { capital: 10, unity: 5, nationalBuzz: 8 },
  lose: { capital: -10, unity: -8 },
  /** AI rulers may call early elections in the last weeks of a term when they look safe. */
  aiEarlyWindow: 20,
  aiEarlyChance: 0.05,
  /** Rivals put this much more effort into seats in a state that is campaigning. */
  aiFocus: 2,
  noise: { state: 0.08, seat: 0.12 },
};

export const GE = {
  /** Weeks from dissolving Parliament to polling day. */
  campaignWeeks: 5,
  /** Term length in weeks after polling day before automatic dissolution. */
  termWeeks: 260,
  /** An AI prime minister may dissolve early in the last weeks of a term if the government bloc looks this far above 112. */
  aiWindow: 26,
  aiLead: 8,
  aiChance: 0.12,
  /** Share of the GE15 calibration (built-in incumbency) left after each new election. */
  calFade: 0.6,
};

// ---------------------------------------------------------------------------------------------
// Milestone 10: scenarios and difficulty.
// ---------------------------------------------------------------------------------------------

export type Difficulty = "easy" | "normal" | "hard";
export type ScenarioId = "present" | "snap" | "underdog";

export interface DifficultyDef {
  label: string;
  text: string;
  /** Rival campaigning strength. */
  aiAggression: number;
  /** Starting money. */
  funds: number;
  /** Starting party unity. */
  unity: number;
  /** Poll error (1 = as designed). */
  pollError: number;
  /** How often news and crises land on your desk. */
  cards: number;
  /** MACC raid odds. */
  raids: number;
  /** How fast buzz fades. */
  decay: number;
  /** Extra willingness partners need before backing you in coalition talks. */
  greed: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { label: "Easy", text: "Gentle rivals, sharper polls, fewer crises, loyal partners.", aiAggression: 0.7, funds: 1.5, unity: 70, pollError: 0.7, cards: 0.8, raids: 0.6, decay: 0.8, greed: -0.1 },
  normal: { label: "Normal", text: "As designed.", aiAggression: 1, funds: 1, unity: 60, pollError: 1, cards: 1, raids: 1, decay: 1, greed: 0 },
  hard: { label: "Hard", text: "Hungry rivals, fuzzy polls, more crises and partners who drive a hard bargain.", aiAggression: 1.35, funds: 0.75, unity: 50, pollError: 1.4, cards: 1.25, raids: 1.5, decay: 1.25, greed: 0.12 },
};

/** How each difficulty compares, for the start screen. */
export const DIFFICULTY_ROWS: { label: string; get: (d: DifficultyDef) => string }[] = [
  { label: "Rival campaigning", get: (d) => `${Math.round(d.aiAggression * 100)}%` },
  { label: "Starting money", get: (d) => `${Math.round(d.funds * 100)}%` },
  { label: "Starting unity", get: (d) => String(d.unity) },
  { label: "Poll error", get: (d) => `${Math.round(d.pollError * 100)}%` },
  { label: "Crises and news", get: (d) => `${Math.round(d.cards * 100)}%` },
  { label: "MACC raid odds", get: (d) => `${Math.round(d.raids * 100)}%` },
  { label: "Buzz fades", get: (d) => `${Math.round(d.decay * 100)}%` },
  { label: "Partners in talks", get: (d) => (d.greed < 0 ? "Eager" : d.greed > 0 ? "Demanding" : "Fair") },
];

export const SCENARIOS: Record<ScenarioId, { label: string; text: string }> = {
  present: { label: "Present day (Oct 2026)", text: "The real situation: the unity government, a year before Parliament's term ends." },
  snap: { label: "Snap election", text: "Parliament dissolves in three weeks. Straight to the campaign and Election Night." },
  underdog: { label: "Underdog", text: "Your party is broke and divided: a quarter of the money, low unity and partners who doubt you." },
};
