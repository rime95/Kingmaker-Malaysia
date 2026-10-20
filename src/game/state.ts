// The saved game state. Plain data only, so it can be saved and reloaded exactly.

import { machineryBase, serviceBase } from "./bases";
import { AP_PER_WEEK, AUTO_DISSOLUTION, DIFFICULTY, ECONOMY_REST, EFFECT, FORTRESS, START, type Difficulty, type ScenarioId } from "./config";
import { initAssemblies, initParliament, type Assembly, type Parliament } from "./systems/assemblies";
import { DUN_START } from "./systems/dun";
import type { Formation, WinTier } from "./systems/formation";
import { AP_BY_RUNG, initCareer, type Career } from "./systems/career";
import { newObjectives, type Objective } from "./systems/goals";
import { newBubbles, type Bubble } from "./systems/bubbles";
import { initPolls, type Polls } from "./systems/polls";
import { initCoalitions, initPartySat, type Coalitions } from "./systems/coalitions";
import type { SeatRecord } from "./systems/results";
import { runElection, type ElectionResult } from "./election";
import type { Asset, Market } from "./systems/business";
import { policyVoters } from "./systems/policies";
import { initRivals, rivalNationalEffect, rivalSeatEffect, type Rivals } from "./systems/rivals";
import { segValue, type SegEffects } from "./systems/segments";
import { COALITION_INDEX, ZERO_SWING, projectAll, type Swing, type VoterInputs } from "./voter";
import { COALITIONS, COALITION_INFO, SEATS, type CoalitionId } from "./world";

export { machineryBase, serviceBase, weekDate, weekLabel, weeksToDissolution } from "./bases";

export const SAVE_VERSION = 5;

/** The unity government as of the October 2026 snapshot. */
export const START_GOVERNMENT: CoalitionId[] = COALITIONS.filter((c) => COALITION_INFO[c].inGovernment);

/** One line of the weekly report. */
export interface ReportLine {
  text: string;
  tone?: "good" | "bad" | "info";
}

export interface WeekReport {
  week: number;
  income: { label: string; amount: number }[];
  expenses: { label: string; amount: number }[];
  seatsBefore: number;
  seatsAfter: number;
  /** Seats with the biggest projected share change for you this week. */
  movers: { seatIndex: number; delta: number }[];
  /** How many weeks this report covers (Skip 1 Month = 4). */
  weeks?: number;
  lines: ReportLine[];
}

export interface CardInstance {
  id: number;
  kind: string;
  week: number;
  /** Unanswered cards take their default choice in this week. */
  deadline: number;
  seat?: number;
  /** The party a card is about (e.g. a partner threatening to walk out). */
  party?: string;
}

export interface HistoryPoint {
  week: number;
  funds: number;
  seats: number;
}

export interface Player {
  funds: number;
  ap: number;
  apMax: number;
  /** Spent on pushing bills and party discipline (more uses arrive with policies). */
  capital: number;
  unity: number;
  /** Trust between you and your coalition partners. */
  trust: number;
  integrity: number;
  /** MACC risk meter. */
  risk: number;
  /** 0–100; multiplies national messaging. */
  reach: number;
  members: number;
  fundFatigue: number;
  nationalBuzz: number;
  scandal: number;
  /** Per seat, your coalition's presence. */
  service: number[];
  buzz: number[];
  machinery: number[];
  assets: Asset[];
  /** Policy stance per policy id (option index; 0 = status quo). */
  policies: Record<string, number>;
  /** Short-lived reactions to events, by voter segment (fades 4% a week). */
  mood: SegEffects;
  /** Budget measures, by voter segment (fades 1.5% a week). */
  budget: SegEffects;
  /** Tycoon favours still owed. */
  favours: number;
  market: Market;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  player: CoalitionId;
  week: number;
  /** National swing and per-seat offsets for every coalition (rival AI will move these). */
  swing: Swing;
  seatOffsets: number[][];
  /** Who holds each seat now (starts as GE15). */
  holders: CoalitionId[];
  holderParties: string[];
  me: Player;
  report: WeekReport | null;
  history: HistoryPoint[];
  lastElection: ElectionResult | null;
  /** National economy (0–100, ~55 normal) and public finances (fiscal space, 0–100). */
  economy: number;
  fiscal: number;
  /** Decision cards waiting for an answer. */
  cards: CardInstance[];
  /** Last week each card kind appeared (no repeats within 24 weeks). */
  cardLast: Record<string, number>;
  /** The Budget: the week it became due (null when not due) and the last year tabled. */
  budgetDue: number | null;
  budgetYear: number | null;
  /** AI rival parties. */
  rivals: Rivals;
  /** Holder of each of the 600 state assembly seats. */
  dunHolders: CoalitionId[];
  assemblies: Record<string, Assembly>;
  parliament: Parliament;
  /** Coalitions in the federal government (the Prime Minister is parliament.pm). */
  government: CoalitionId[];
  /** Talks to form a government after a general election (null when none are under way). */
  formation: Formation | null;
  /** Election Night to show: the week it happened and who held the seats before. */
  night: { week: number; prevHolders: CoalitionId[] } | null;
  /** Your result tier at each general election. */
  tiers: WinTier[];
  /** Your own career: rung, points, age, faction and successors. */
  career: Career;
  /** This term's objectives. */
  objectives: Objective[];
  /** Achievement id → week earned. */
  achievements: Record<string, number>;
  settings: { scenario: ScenarioId; difficulty: Difficulty };
  /** This week's opportunity bubbles on the map. */
  bubbles: Bubble[];
  /** What you know of the race: national polls and per-seat reads. */
  polls: Polls;
  /** Latest simulated result per seat (null = the real GE15 result still stands). */
  seatResults: (SeatRecord | null)[];
  /** Number of the last general election held (15 = GE15). */
  geCount: number;
  /** Coalitions: names, colours and member parties (they change during a game). */
  coalitions: Coalitions;
  /** Each non-leading party's satisfaction with its coalition (0–100). */
  partySat: Record<string, number>;
  /** Seat → coalition → the party standing there, where parties have changed sides. */
  seatParty: Record<number, Partial<Record<CoalitionId, string>>>;
  /** You won: name your coalition (shown once after taking power). */
  namePending: boolean;
}

export interface NewGameOptions {
  scenario?: ScenarioId;
  difficulty?: Difficulty;
  mode?: "career" | "leader";
  name?: string;
  homeSeat?: number;
}

export function newGame(player: CoalitionId, seed = Date.now() % 2147483647, opts: NewGameOptions = {}): GameState {
  const start = START[player];
  const service = SEATS.map((s) => serviceBase(player, s.index));
  const machinery = SEATS.map((s) => machineryBase(player, s.index));
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    player,
    week: 0,
    swing: ZERO_SWING(),
    seatOffsets: SEATS.map(() => COALITIONS.map(() => 0)),
    holders: SEATS.map((s) => s.ge15Coalition),
    holderParties: SEATS.map((s) => s.ge15Party),
    me: {
      funds: start.funds,
      ap: AP_PER_WEEK,
      apMax: AP_PER_WEEK,
      capital: 50,
      unity: 60,
      trust: 60,
      integrity: 60,
      risk: 10,
      reach: 40,
      members: start.members,
      fundFatigue: 0,
      nationalBuzz: 0,
      scandal: 0,
      service,
      buzz: SEATS.map(() => 0),
      machinery,
      assets: [],
      market: { commodity: 1 },
      policies: {},
      mood: {},
      budget: {},
      favours: 0,
    },
    report: null,
    history: [],
    lastElection: null,
    economy: ECONOMY_REST,
    fiscal: 50,
    cards: [],
    cardLast: {},
    budgetDue: null,
    budgetYear: null,
    rivals: initRivals(player),
    dunHolders: [...DUN_START],
    assemblies: initAssemblies(),
    parliament: initParliament(AUTO_DISSOLUTION),
    government: START_GOVERNMENT,
    formation: null,
    night: null,
    tiers: [],
    career: initCareer(player, seed, opts.mode ?? "leader", opts.name, opts.homeSeat),
    objectives: [],
    achievements: {},
    settings: { scenario: opts.scenario ?? "present", difficulty: opts.difficulty ?? "normal" },
    bubbles: [],
    polls: { national: [], seats: [] },
    seatResults: SEATS.map(() => null),
    geCount: 15,
    coalitions: initCoalitions(),
    partySat: initPartySat(),
    seatParty: {},
    namePending: false,
  };
  state.me.apMax = state.me.ap = AP_BY_RUNG[state.career.rung];
  // Difficulty and scenario
  state.me.funds = Math.round(state.me.funds * DIFFICULTY[state.settings.difficulty].funds);
  state.me.unity = DIFFICULTY[state.settings.difficulty].unity;
  if (state.settings.scenario === "snap") state.parliament = { ...state.parliament, deadlineWeek: 3 };
  if (state.settings.scenario === "underdog") {
    state.me = { ...state.me, funds: Math.round(state.me.funds * 0.25), members: Math.round(state.me.members * 0.6), unity: 40, trust: 40 };
  }
  state.history.push({ week: 0, funds: state.me.funds, seats: projectedSeats(state) });
  state.objectives = newObjectives(state);
  state.bubbles = newBubbles(state);
  state.polls = initPolls(projectAllFor(state), seed, 0, DIFFICULTY[state.settings.difficulty].pollError);
  return state;
}

/** Fills fields added after a save was made, so older saves keep working. */
export function migrateGame(g: GameState): GameState {
  const migrated: GameState = {
    ...g,
    version: SAVE_VERSION,
    me: { ...g.me, policies: g.me.policies ?? {}, mood: g.me.mood ?? {}, budget: g.me.budget ?? {}, favours: g.me.favours ?? 0 },
    economy: g.economy ?? ECONOMY_REST,
    fiscal: g.fiscal ?? 50,
    cards: g.cards ?? [],
    cardLast: g.cardLast ?? {},
    budgetDue: g.budgetDue ?? null,
    budgetYear: g.budgetYear ?? null,
    rivals: g.rivals ?? initRivals(g.player),
    dunHolders: g.dunHolders ?? [...DUN_START],
    assemblies: g.assemblies ?? initAssemblies(),
    parliament: g.parliament ?? initParliament(AUTO_DISSOLUTION),
    government: g.government ?? START_GOVERNMENT,
    formation: g.formation ?? null,
    night: g.night ?? null,
    tiers: g.tiers ?? [],
    career: g.career ?? initCareer(g.player, g.seed, "leader"),
    objectives: g.objectives ?? [],
    achievements: g.achievements ?? {},
    settings: g.settings ?? { scenario: "present", difficulty: "normal" },
    bubbles: g.bubbles ?? [],
    polls: g.polls ?? { national: [], seats: [] },
    seatResults: g.seatResults ?? SEATS.map(() => null),
    geCount: g.geCount ?? 15,
    coalitions: g.coalitions ?? initCoalitions(),
    partySat: g.partySat ?? initPartySat(),
    seatParty: g.seatParty ?? {},
    namePending: g.namePending ?? false,
  };
  if (!migrated.polls.national.length) migrated.polls = initPolls(projectAllFor(migrated), migrated.seed, migrated.week, DIFFICULTY[migrated.settings.difficulty].pollError);
  if (!migrated.objectives.length) migrated.objectives = newObjectives(migrated);
  return migrated;
}

/** Your national swing from messaging, scandal, integrity, coalition trust and the economy. */
export function playerNationalEffect(state: GameState): number {
  const me = state.me;
  let v = me.nationalBuzz * EFFECT.nationalBuzz - me.scandal * EFFECT.scandal + (me.integrity - 60) * EFFECT.integrity;
  if (me.trust < EFFECT.trustFloor) v -= EFFECT.trustPenalty;
  // The government gets the credit and the blame for the economy; the opposition gains a little from bad times.
  v += (state.economy - ECONOMY_REST) * (isGovernment(state) ? EFFECT.economyGov : -EFFECT.economyOpp);
  return v;
}

/** Your extra log-odds in one seat from service, buzz, machinery, policies, budget and the public mood. */
export function playerSeatEffect(state: GameState, i: number, policy?: SegEffects): number {
  const me = state.me;
  const pol = policy ?? policyVoters(me.policies, isGovernment(state));
  return (
    (me.service[i] - serviceBase(state.player, i)) * EFFECT.service +
    me.buzz[i] * EFFECT.buzz +
    (me.machinery[i] - machineryBase(state.player, i)) * EFFECT.machinery +
    segValue(i, pol) +
    segValue(i, me.budget) +
    segValue(i, me.mood)
  );
}

/** What the voter model sees: rival offsets plus everything the player has built. */
export function voterInputs(state: GameState): VoterInputs {
  const p = COALITION_INDEX[state.player];
  const swing = { ...state.swing, [state.player]: state.swing[state.player] + playerNationalEffect(state) };
  // A coalition left with no parties has no candidates.
  for (const c of COALITIONS) if (state.coalitions && !state.coalitions[c].members.length) swing[c] -= 20;
  const rivals = Object.entries(state.rivals) as [CoalitionId, NonNullable<Rivals[CoalitionId]>][];
  for (const [c, r] of rivals) swing[c] += rivalNationalEffect(r);
  const policy = policyVoters(state.me.policies, isGovernment(state));
  const seatOffsets = state.seatOffsets.map((row, i) => {
    const out = [...row];
    out[p] += playerSeatEffect(state, i, policy);
    for (const [c, r] of rivals) out[COALITION_INDEX[c]] += rivalSeatEffect(r, c, i);
    return out;
  });
  return { swing, seatOffsets };
}

export function projectedSeats(state: GameState): number {
  return projectAllFor(state).filter((p) => p.leader === state.player).length;
}

export function projectAllFor(state: GameState) {
  return projectAll(voterInputs(state));
}

/** Test election from the current state. Does not change who holds the seats. */
export function simulateElection(state: GameState): GameState {
  const { result, rngState } = runElection(voterInputs(state), state.rng);
  return { ...state, rng: rngState, lastElection: result };
}

/** Is a coalition (you, by default) in the federal government right now? */
export function isGovernment(state: GameState, c: CoalitionId = state.player): boolean {
  return state.government.includes(c);
}

export function seatCounts(holders: CoalitionId[]): Record<CoalitionId, number> {
  const out = Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<CoalitionId, number>;
  for (const h of holders) out[h] += 1;
  return out;
}

export function fortressLevel(service: number): string {
  return FORTRESS.find((f) => service >= f.min)!.name;
}

