// The saved game state. Plain data only, so it can be saved and reloaded exactly.

import { machineryBase, serviceBase } from "./bases";
import { AP_PER_WEEK, ECONOMY_REST, EFFECT, FORTRESS, START } from "./config";
import { runElection, type ElectionResult } from "./election";
import type { Asset, Market } from "./systems/business";
import { policyVoters } from "./systems/policies";
import { initRivals, rivalNationalEffect, rivalSeatEffect, type Rivals } from "./systems/rivals";
import { segValue, type SegEffects } from "./systems/segments";
import { COALITION_INDEX, ZERO_SWING, projectAll, type Swing, type VoterInputs } from "./voter";
import { COALITIONS, COALITION_INFO, SEATS, type CoalitionId } from "./world";

export { machineryBase, serviceBase, weekDate, weekLabel, weeksToDissolution } from "./bases";

export const SAVE_VERSION = 3;

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
}

export function newGame(player: CoalitionId, seed = Date.now() % 2147483647): GameState {
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
  };
  state.history.push({ week: 0, funds: start.funds, seats: projectedSeats(state) });
  return state;
}

/** Fills fields added after a save was made, so older saves keep working. */
export function migrateGame(g: GameState): GameState {
  return {
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
  };
}

/** Your national swing from messaging, scandal, integrity, coalition trust and the economy. */
export function playerNationalEffect(state: GameState): number {
  const me = state.me;
  let v = me.nationalBuzz * EFFECT.nationalBuzz - me.scandal * EFFECT.scandal + (me.integrity - 60) * EFFECT.integrity;
  if (me.trust < EFFECT.trustFloor) v -= EFFECT.trustPenalty;
  // The government gets the credit and the blame for the economy; the opposition gains a little from bad times.
  v += (state.economy - ECONOMY_REST) * (isGovernment(state.player) ? EFFECT.economyGov : -EFFECT.economyOpp);
  return v;
}

/** Your extra log-odds in one seat from service, buzz, machinery, policies, budget and the public mood. */
export function playerSeatEffect(state: GameState, i: number, policy?: SegEffects): number {
  const me = state.me;
  const pol = policy ?? policyVoters(me.policies, isGovernment(state.player));
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
  const rivals = Object.entries(state.rivals) as [CoalitionId, NonNullable<Rivals[CoalitionId]>][];
  for (const [c, r] of rivals) swing[c] += rivalNationalEffect(r);
  const policy = policyVoters(state.me.policies, isGovernment(state.player));
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

export function isGovernment(c: CoalitionId): boolean {
  return COALITION_INFO[c].inGovernment;
}

export function seatCounts(holders: CoalitionId[]): Record<CoalitionId, number> {
  const out = Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<CoalitionId, number>;
  for (const h of holders) out[h] += 1;
  return out;
}

export function fortressLevel(service: number): string {
  return FORTRESS.find((f) => service >= f.min)!.name;
}

