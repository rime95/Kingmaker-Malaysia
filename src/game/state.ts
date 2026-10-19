// The saved game state. Plain data only, so it can be saved and reloaded exactly.

import { AP_PER_WEEK, EFFECT, FORTRESS, START, START_DATE } from "./config";
import { runElection, type ElectionResult } from "./election";
import type { Asset, Market } from "./systems/business";
import { COALITION_INDEX, ZERO_SWING, ge15MarginShare, projectAll, type Swing, type VoterInputs } from "./voter";
import { COALITIONS, COALITION_INFO, SEATS, contestingIn, type CoalitionId } from "./world";

export const SAVE_VERSION = 2;

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
}

/** Starting service in a seat: your own seats start stronger, safest seats strongest. */
export function serviceBase(player: CoalitionId, seatIndex: number): number {
  const s = SEATS[seatIndex];
  if (s.ge15Coalition !== player) return 5;
  return Math.round(20 + 50 * Math.min(1, ge15MarginShare(s) / 0.4));
}

export function machineryBase(player: CoalitionId, seatIndex: number): number {
  const s = SEATS[seatIndex];
  if (!contestingIn(s).includes(player)) return 0;
  return s.ge15Coalition === player ? 30 : 12;
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
    },
    report: null,
    history: [],
    lastElection: null,
  };
  state.history.push({ week: 0, funds: start.funds, seats: projectedSeats(state) });
  return state;
}

/** Your national swing from messaging, scandal, integrity and coalition trust. */
export function playerNationalEffect(me: Player): number {
  let v = me.nationalBuzz * EFFECT.nationalBuzz - me.scandal * EFFECT.scandal + (me.integrity - 60) * EFFECT.integrity;
  if (me.trust < EFFECT.trustFloor) v -= EFFECT.trustPenalty;
  return v;
}

/** Your extra log-odds in one seat from service, buzz and machinery. */
export function playerSeatEffect(state: GameState, i: number): number {
  const me = state.me;
  return (
    (me.service[i] - serviceBase(state.player, i)) * EFFECT.service +
    me.buzz[i] * EFFECT.buzz +
    (me.machinery[i] - machineryBase(state.player, i)) * EFFECT.machinery
  );
}

/** What the voter model sees: rival offsets plus everything the player has built. */
export function voterInputs(state: GameState): VoterInputs {
  const p = COALITION_INDEX[state.player];
  const swing = { ...state.swing, [state.player]: state.swing[state.player] + playerNationalEffect(state.me) };
  const seatOffsets = state.seatOffsets.map((row, i) => {
    const r = [...row];
    r[p] += playerSeatEffect(state, i);
    return r;
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

export function weekDate(week: number): Date {
  const d = new Date(`${START_DATE}T00:00:00`);
  d.setDate(d.getDate() + week * 7);
  return d;
}

export function weekLabel(week: number): string {
  return weekDate(week).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
