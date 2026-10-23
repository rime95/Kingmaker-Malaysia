// Time moves in turns of two weeks; Skip 1 Month is two turns. Each is a run of weekly steps with the reports merged.

import type { GameState, ReportLine, WeekReport } from "./state";
import { autoGround } from "./systems/governing";
import { TURN_WEEKS } from "./config";
import { advanceWeek } from "./week";
import { ACTION_BY_ID, applyAction, saturation } from "./actions";
import { runOrders } from "./systems/orders";

function mergeAmounts(lists: { label: string; amount: number }[][]): { label: string; amount: number }[] {
  const out = new Map<string, number>();
  for (const list of lists) for (const l of list) out.set(l.label, (out.get(l.label) ?? 0) + l.amount);
  return [...out].map(([label, amount]) => ({ label, amount }));
}

/** Run `n` weekly steps; with `stopAtNight`, stop early when Election Night starts (you watch it as it happens). */
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
  }
  if (reports.length === 1) return state;
  const last = reports.at(-1)!;
  // The lines without repeats. Seat counts come from the national poll, which appears once a month.
  const all = reports.flatMap((r) => r.lines);
  const events = all.filter((l, i) => all.findIndex((x) => x.text === l.text) === i);
  return {
    ...state,
    report: {
      ...last,
      income: mergeAmounts(reports.map((r) => r.income)),
      expenses: mergeAmounts(reports.map((r) => r.expenses)),
      seatsBefore: reports[0].seatsBefore,
      lines: events,
      weeks: reports.length,
    },
  };
}

export const advanceTurn = (s: GameState) => advanceWeeks(s, TURN_WEEKS, true);
export const advanceMonth = (s: GameState) => advanceWeeks(s, 4);
