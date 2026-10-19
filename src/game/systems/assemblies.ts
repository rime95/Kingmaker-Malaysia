// Dissolution and polling for Parliament and the 13 state assemblies.
// - Parliament: the prime minister's coalition may dissolve it at any time; it dissolves itself at the end of its
//   term. Polling day follows a few weeks later. (The full Election Night and government formation come next.)
// - Assemblies: the ruling coalition may dissolve early; otherwise each dissolves at the end of its term. States
//   that traditionally vote with Parliament dissolve when Parliament does.
// Seat changes give momentum (national buzz); winning or losing a state government moves capital and unity.

import { ASSEMBLY_TERMS, GE, PRN, START_DATE } from "../config";
import { runElection, type ElectionResult } from "../election";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { projectAll, type VoterInputs } from "../voter";
import { COALITIONS, COALITION_INFO, MAJORITY, SEATS, STATES, STATE_BY_ID, type CoalitionId } from "../world";
import { DUNS_BY_STATE, projectDuns, runStateElection } from "./dun";
import { startFormation } from "./formation";
import { addPoints } from "./career";

export interface Assembly {
  status: "sitting" | "campaign";
  pollWeek: number | null;
  /** Week it dissolves automatically if nobody dissolves it first. */
  deadlineWeek: number;
  /** Dissolves together with Parliament. */
  syncGE: boolean;
  lastPollWeek: number | null;
  /** Seats per coalition before and after the last state election. */
  lastBefore: Partial<Record<CoalitionId, number>> | null;
  lastAfter: Partial<Record<CoalitionId, number>> | null;
}

export interface Parliament {
  status: "sitting" | "campaign";
  pollWeek: number | null;
  deadlineWeek: number;
  /** Coalition of the prime minister, who alone may dissolve Parliament. */
  pm: CoalitionId;
  lastPollWeek: number | null;
}

/** Week number of a date (weeks since the game started, rounded down). */
export function weekOf(date: string): number {
  const ms = new Date(`${date}T00:00:00`).getTime() - new Date(`${START_DATE}T00:00:00`).getTime();
  return Math.floor(ms / (7 * 86_400_000));
}

export const ASSEMBLY_STATES = STATES.filter((s) => s.dunSeats > 0).map((s) => s.id);

export function initAssemblies(): Record<string, Assembly> {
  return Object.fromEntries(
    ASSEMBLY_STATES.map((id) => [
      id,
      {
        status: "sitting",
        pollWeek: null,
        deadlineWeek: weekOf(ASSEMBLY_TERMS[id].autoDissolve),
        syncGE: ASSEMBLY_TERMS[id].syncWithGE,
        lastPollWeek: null,
        lastBefore: null,
        lastAfter: null,
      } satisfies Assembly,
    ]),
  );
}

export function initParliament(autoDissolve: string): Parliament {
  return { status: "sitting", pollWeek: null, deadlineWeek: weekOf(autoDissolve), pm: "PH", lastPollWeek: null };
}

export function countSeats(holders: CoalitionId[]): Partial<Record<CoalitionId, number>> {
  const out: Partial<Record<CoalitionId, number>> = {};
  for (const h of holders) out[h] = (out[h] ?? 0) + 1;
  return out;
}

export interface StateRule {
  ruler: CoalitionId;
  /** The bloc with a majority in the assembly, if any. */
  side: "gov" | "opp" | null;
  seats: Partial<Record<CoalitionId, number>>;
  total: number;
}

/** Who runs a state: the largest coalition in the bloc (government or opposition side) that has a majority. */
export function stateRule(dunHolders: CoalitionId[], stateId: string, government: CoalitionId[]): StateRule {
  const ids = DUNS_BY_STATE[stateId];
  const seats = countSeats(ids.map((i) => dunHolders[i]));
  const total = ids.length;
  const sideSeats = (gov: boolean) => (Object.entries(seats) as [CoalitionId, number][]).filter(([c]) => government.includes(c) === gov).reduce((s, [, n]) => s + n, 0);
  const side = sideSeats(true) > total / 2 ? "gov" : sideSeats(false) > total / 2 ? "opp" : null;
  const pool = (Object.entries(seats) as [CoalitionId, number][]).filter(([c]) => side === null || government.includes(c) === (side === "gov"));
  pool.sort((a, b) => b[1] - a[1]);
  return { ruler: pool[0][0], side, seats, total };
}

export function stateRulers(dunHolders: CoalitionId[], government: CoalitionId[]): Record<string, CoalitionId> {
  return Object.fromEntries(ASSEMBLY_STATES.map((id) => [id, stateRule(dunHolders, id, government).ruler]));
}

/** Weeks until the next general election polling day (estimated if Parliament hasn't dissolved yet). */
export function weeksToElection(s: GameState): number {
  const p = s.parliament;
  return p.status === "campaign" ? Math.max(0, p.pollWeek! - s.week) : Math.max(0, p.deadlineWeek - s.week) + GE.campaignWeeks;
}

export function campaignStates(s: GameState): string[] {
  return ASSEMBLY_STATES.filter((id) => s.assemblies[id].status === "campaign");
}

export function dissolveAssembly(s: GameState, stateId: string, pollWeek = s.week + PRN.campaignWeeks): GameState {
  const a = s.assemblies[stateId];
  if (a.status !== "sitting") return s;
  return { ...s, assemblies: { ...s.assemblies, [stateId]: { ...a, status: "campaign", pollWeek } } };
}

export function dissolveParliament(s: GameState): GameState {
  if (s.parliament.status !== "sitting") return s;
  const pollWeek = s.week + GE.campaignWeeks;
  let next: GameState = { ...s, parliament: { ...s.parliament, status: "campaign", pollWeek } };
  for (const id of ASSEMBLY_STATES) if (next.assemblies[id].syncGE) next = dissolveAssembly(next, id, pollWeek);
  return next;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Seat changes give momentum: national buzz for winners, a dent for losers. Applies to you and the rivals. */
function applyMomentum(s: GameState, before: Partial<Record<CoalitionId, number>>, after: Partial<Record<CoalitionId, number>>, total: number): GameState {
  const me = { ...s.me };
  const rivals = { ...s.rivals };
  for (const c of COALITIONS) {
    const delta = (((after[c] ?? 0) - (before[c] ?? 0)) / total) * PRN.momentum;
    if (!delta) continue;
    if (c === s.player) me.nationalBuzz = clamp(me.nationalBuzz + delta);
    else if (rivals[c]) rivals[c] = { ...rivals[c]!, nationalBuzz: clamp(rivals[c]!.nationalBuzz + delta) };
  }
  return { ...s, me, rivals };
}

function holdStateElection(s: GameState, stateId: string, inputs: VoterInputs, lines: ReportLine[]): GameState {
  const name = STATE_BY_ID[stateId].name;
  const ids = DUNS_BY_STATE[stateId];
  const ruleBefore = stateRule(s.dunHolders, stateId, s.government);
  const { results, rngState } = runStateElection(inputs, stateId, s.rng);
  const dunHolders = [...s.dunHolders];
  for (const r of results) dunHolders[r.dun] = r.winner;
  let next: GameState = { ...s, rng: rngState, dunHolders };
  const ruleAfter = stateRule(dunHolders, stateId, s.government);
  next = applyMomentum(next, ruleBefore.seats, ruleAfter.seats, ids.length);

  const me = { ...next.me };
  const p = s.player;
  if (ruleAfter.ruler === p && ruleBefore.ruler !== p) {
    me.capital = clamp(me.capital + PRN.win.capital, 0, 200);
    me.unity = clamp(me.unity + PRN.win.unity);
    me.nationalBuzz = clamp(me.nationalBuzz + PRN.win.nationalBuzz);
  } else if (ruleBefore.ruler === p && ruleAfter.ruler !== p) {
    me.capital = clamp(me.capital + PRN.lose.capital, 0, 200);
    me.unity = clamp(me.unity + PRN.lose.unity);
  }
  next.me = me;
  const gained = (ruleAfter.seats[p] ?? 0) - (ruleBefore.seats[p] ?? 0);
  if (gained > 0) next.career = addPoints(next.career, s.week, gained, `+${gained} seats in the ${name} state election`);
  if (ruleAfter.ruler === p) next.career = addPoints(next.career, s.week, 8, `${ruleBefore.ruler === p ? "held" : "won"} the ${name} state government`);
  next.assemblies = {
    ...next.assemblies,
    [stateId]: {
      ...next.assemblies[stateId],
      status: "sitting",
      pollWeek: null,
      lastPollWeek: s.week,
      deadlineWeek: s.week + GE.termWeeks,
      lastBefore: ruleBefore.seats,
      lastAfter: ruleAfter.seats,
    },
  };

  const mine = (ruleAfter.seats[p] ?? 0) - (ruleBefore.seats[p] ?? 0);
  const summary = (Object.entries(ruleAfter.seats) as [CoalitionId, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${COALITION_INFO[c].short} ${n}`)
    .join(", ");
  const change = ruleAfter.ruler !== ruleBefore.ruler ? `${COALITION_INFO[ruleAfter.ruler].short} takes ${name} from ${COALITION_INFO[ruleBefore.ruler].short}` : `${COALITION_INFO[ruleAfter.ruler].short} holds ${name}`;
  lines.push({
    text: `${name} state election: ${change} (${summary}). ${mine === 0 ? "No net change for you" : `You ${mine > 0 ? "won" : "lost"} ${Math.abs(mine)} seat${Math.abs(mine) === 1 ? "" : "s"} net`}.`,
    tone: ruleAfter.ruler === p || mine > 0 ? "good" : mine < 0 || ruleBefore.ruler === p ? "bad" : "info",
  });
  return next;
}

function holdGeneralElection(s: GameState, inputs: VoterInputs, lines: ReportLine[]): GameState {
  const { result, rngState } = runElection(inputs, s.rng);
  const before = countSeats(s.holders);
  const holders = result.seats.map((r) => r.winner);
  const holderParties = result.seats.map((r) => r.winnerParty);
  let next: GameState = {
    ...s,
    rng: rngState,
    holders,
    holderParties,
    lastElection: result,
    parliament: { ...s.parliament, status: "sitting", pollWeek: null, lastPollWeek: s.week, deadlineWeek: s.week + GE.termWeeks },
  };
  next = applyMomentum(next, before, result.totals, SEATS.length);
  lines.push({ text: generalSummary(result, s.player), tone: result.totals[s.player] >= (before[s.player] ?? 0) ? "good" : "bad" });
  // Election Night, then talks to form a government
  next.night = { week: s.week, prevHolders: s.holders };
  next.formation = startFormation(next, result.totals, before[s.player] ?? 0);
  lines.push({ text: "Talks to form the next government have begun. The Agong is waiting for statutory declarations.", tone: "info" });
  return next;
}

function generalSummary(result: ElectionResult, player: CoalitionId): string {
  const parts = (Object.entries(result.totals) as [CoalitionId, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${COALITION_INFO[c].short} ${n}`)
    .join(", ");
  return `General election results: ${parts}. ${COALITION_INFO[player].short} won ${result.totals[player]} seats; ${MAJORITY} needed for a majority.`;
}

/**
 * Runs once at the start of each new week: automatic and AI dissolutions, then any polling days that fall this week.
 * `inputs` are the voter-model inputs for the new week.
 */
export function assembliesWeek(s: GameState, inputs: VoterInputs): { state: GameState; lines: ReportLine[] } {
  let state = s;
  const lines: ReportLine[] = [];
  const { week, seed, player } = s;

  // Parliament: end of term, or an AI prime minister who likes the polls
  if (state.parliament.status === "sitting") {
    const pm = state.parliament.pm;
    let reason: string | null = null;
    if (week >= state.parliament.deadlineWeek) reason = "Parliament has reached the end of its term and is dissolved automatically";
    else if (pm !== player && state.parliament.deadlineWeek - week <= GE.aiWindow) {
      const proj = projectAll(inputs);
      const govSeats = proj.filter((p) => state.government.includes(p.leader)).length;
      if (govSeats >= MAJORITY + GE.aiLead && hash01("ge", seed, week) < GE.aiChance)
        reason = `The Prime Minister (${COALITION_INFO[pm].short}) has advised the Agong to dissolve Parliament`;
    }
    if (reason) {
      state = dissolveParliament(state);
      lines.push({ text: `${reason}. Polling day is in ${GE.campaignWeeks} weeks.`, tone: "info" });
    }
  }

  // Assemblies: end of term, or an AI ruler calling an early election while ahead
  const rulers = stateRulers(state.dunHolders, state.government);
  let dunProj: ReturnType<typeof projectDuns> | null = null;
  for (const id of ASSEMBLY_STATES) {
    const a = state.assemblies[id];
    if (a.status !== "sitting") continue;
    const name = STATE_BY_ID[id].name;
    if (week >= a.deadlineWeek) {
      state = dissolveAssembly(state, id);
      lines.push({ text: `The ${name} assembly has reached the end of its term. Polling day is in ${PRN.campaignWeeks} weeks.`, tone: "info" });
      continue;
    }
    const ruler = rulers[id];
    if (ruler !== player && a.deadlineWeek - week <= PRN.aiEarlyWindow && hash01("prn", seed, week, id) < PRN.aiEarlyChance) {
      dunProj ??= projectDuns(inputs);
      const ahead = DUNS_BY_STATE[id].filter((d) => dunProj![d].leader === ruler).length > DUNS_BY_STATE[id].length / 2;
      if (ahead) {
        state = dissolveAssembly(state, id);
        lines.push({ text: `${COALITION_INFO[ruler].short} calls an early ${name} state election. Polling day is in ${PRN.campaignWeeks} weeks.`, tone: "info" });
      }
    }
  }

  // Polling days
  for (const id of ASSEMBLY_STATES) if (state.assemblies[id].status === "campaign" && state.assemblies[id].pollWeek === week) state = holdStateElection(state, id, inputs, lines);
  if (state.parliament.status === "campaign" && state.parliament.pollWeek === week) state = holdGeneralElection(state, inputs, lines);
  return { state, lines };
}
