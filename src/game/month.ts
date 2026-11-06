// Time moves in turns of two weeks; Skip 1 Month is two turns. Each is a run of weekly steps with the reports merged.

import type { GameState, ReportLine, WeekReport } from "./state";
import { autoGround } from "./systems/governing";
import { TURN_WEEKS } from "./config";
import { advanceWeek } from "./week";
import { ACTION_BY_ID, applyAction, saturation } from "./actions";
import { runOrders } from "./systems/orders";
import { CARD_BY_KIND, CARD_PRIORITY, resolveCard } from "./systems/events";
import { syncYou } from "./systems/people";

function mergeAmounts(lists: { label: string; amount: number }[][]): { label: string; amount: number }[] {
  const out = new Map<string, number>();
  for (const list of lists) for (const l of list) out.set(l.label, (out.get(l.label) ?? 0) + l.amount);
  return [...out].map(([label, amount]) => ({ label, amount }));
}

/**
 * Run `n` weekly steps; with `stopAtNight`, stop early when Election Night starts (you watch it as it happens), and for a
 * state election night, hung-assembly talks or a state government to form (they need you this week).
 */
export function advanceWeeks(s: GameState, n: number, stopAtNight = false): GameState {
  let state = s;
  const reports: WeekReport[] = [];
  for (let i = 0; i < n; i++) {
    // Before a turn ends, your secretary-general spends the AP you left on the ground campaign.
    let groundLines: ReportLine[] = [];
    if (i % TURN_WEEKS === 0 && state.strategy.autoGround && !state.night && !state.formation) {
      const g = autoGround(state, applyAction, saturation);
      state = g.state;
      groundLines = g.lines;
    }
    state = advanceWeek(state);
    if (groundLines.length) state = { ...state, report: { ...state.report!, lines: [...groundLines, ...state.report!.lines] } };
    // A new turn starts: your standing orders run first.
    if (((i + 1) % TURN_WEEKS === 0 || i === n - 1) && state.orders.length && !state.night) {
      const o = runOrders(state, applyAction, (id) => ACTION_BY_ID[id]?.name ?? id);
      state = {
        ...o.state,
        report: {
          ...state.report!,
          lines: [...state.report!.lines, ...o.lines],
        },
      };
    }
    reports.push(state.report!);
    if (stopAtNight && state.night && state.night.week === state.week) break;
    if (stopAtNight && (state.stateNight || state.stateTalks || state.stateTerms?.length || state.formation?.midTerm)) break;
  }
  if (reports.length === 1) return state;
  return { ...state, report: mergeReports(reports) };
}

/** Several weeks' reports as one: the money summed, the lines without repeats, seats from the first to the last. */
export function mergeReports(reports: WeekReport[]): WeekReport {
  const last = reports.at(-1)!;
  // Seat counts come from the national poll, which appears once a month.
  const all = reports.flatMap((r) => r.lines);
  const events = all.filter((l, i) => all.findIndex((x) => x.text === l.text) === i);
  return {
    ...last,
    income: mergeAmounts(reports.map((r) => r.income)),
    expenses: mergeAmounts(reports.map((r) => r.expenses)),
    seatsBefore: reports[0].seatsBefore,
    lines: events,
    weeks: reports.reduce((a, r) => a + (r.weeks ?? 1), 0),
    handled: reports.flatMap((r) => r.handled ?? []),
  };
}

/** News that should stop time moving on by itself. */
export const ALARM = /MACC|in debt|Couldn.t pay/;

/** Cards that matter enough to wait for you; the rest can take their default answer when time skips. */
const important = (kind: string) => (CARD_PRIORITY[kind] ?? 3) <= 1;

/**
 * What must stop time: a screen to see, an election or party vote, your Budget as Prime Minister, an important card or
 * alarming news. `since`: only cards from this week on count (a long skip you asked for passes the ones you put off).
 */
export function bigMoment(s: GameState, since = -1): boolean {
  if (s.night || s.stateNight || s.stateTalks || s.stateTerms?.length || s.formation || s.newTerm || s.namePending || s.ending) return true;
  if (s.parliament.status === "campaign" || s.nominations?.open) return true;
  if (s.race && !s.race.result) return true;
  if (s.career.rung >= 6 && s.partyPolls && !s.partyPolls.result) return true;
  if (s.budgetDue !== null && s.parliament.pm === s.player && s.career.rung >= 6) return true;
  if (s.cards.some((c) => important(c.kind) && c.week >= since)) return true;
  return !!s.report?.lines.some((l) => ALARM.test(l.text));
}

/** Routine cards take their default answer; what was decided goes in the report. */
export function handleRoutine(s: GameState): GameState {
  let state = s;
  const lines: ReportLine[] = [];
  const handled: string[] = [];
  for (const card of s.cards.filter((c) => !important(c.kind))) {
    const def = CARD_BY_KIND[card.kind];
    const r = resolveCard(state, card.id, def.defaultChoice, true);
    if (!r) continue;
    state = syncYou(r.state, r.lines);
    lines.push(...r.lines.slice(1));
    handled.push(`${def.title}: ${def.choices(s, card)[def.defaultChoice].label}`);
  }
  if (!handled.length || !state.report) return state;
  return { ...state, report: { ...state.report, lines: [...state.report.lines, ...lines], handled: [...(state.report.handled ?? []), ...handled] } };
}

export const advanceTurn = (s: GameState) => advanceWeeks(s, TURN_WEEKS, true);
export const advanceMonth = (s: GameState) => advanceWeeks(s, 4);

/** Quiet turns play on by themselves, up to this many (12 weeks). */
export const QUIET_TURNS = 6;

/** Move on up to `weeks`, handling the routine, until a big moment; one merged report. `since`: see `bigMoment`. */
export function fastForward(s: GameState, weeks: number, since?: number): GameState {
  let state = handleRoutine(s);
  const carried = state.report?.handled?.filter((h) => !(s.report?.handled ?? []).includes(h)) ?? [];
  const reports: WeekReport[] = [];
  while (state.week - s.week < weeks) {
    state = handleRoutine(advanceTurn(state));
    reports.push(state.report!);
    if (bigMoment(state, since)) break;
  }
  if (carried.length) reports[0] = { ...reports[0], handled: [...carried, ...(reports[0].handled ?? [])] };
  const report = mergeReports(reports);
  return { ...state, report };
}
