// Time moves in turns of two weeks; Skip 1 Month is two turns. Each is a run of weekly steps with the reports merged.

import type { GameState, ReportLine, WeekReport } from "./state";
import { autoGround } from "./systems/governing";
import { TURN_WEEKS } from "./config";
import { advanceWeek } from "./week";
import { ACTION_BY_ID, applyAction, saturation } from "./actions";
import { runOrders } from "./systems/orders";
import { upcoming } from "./calendar";

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
  };
}

/** News that should stop time moving on by itself. */
export const ALARM = /MACC|in debt|Couldn.t pay|state election|by-election|leadership|retires|Achievement|Objective complete/;

/**
 * Does the turn just played leave anything for you? A decision on the docket, a deadline or vote within the next turn,
 * a screen to see (election night, talks, a new cabinet), a campaign under way, or alarming news. If not, it was quiet.
 */
export function needsYou(s: GameState): boolean {
  if (s.cards.length || s.budgetDue !== null) return true;
  if (s.night || s.stateNight || s.stateTalks || s.stateTerms?.length || s.formation || s.newTerm || s.namePending || s.ending) return true;
  if (s.parliament.status === "campaign" || s.nominations?.open) return true;
  if (Object.values(s.assemblies).some((a) => a.status === "campaign")) return true;
  if (upcoming(s).some((u) => u.urgent || u.weeks <= TURN_WEEKS)) return true;
  return !!s.report?.lines.some((l) => ALARM.test(l.text));
}

export const advanceTurn = (s: GameState) => advanceWeeks(s, TURN_WEEKS, true);
export const advanceMonth = (s: GameState) => advanceWeeks(s, 4);
