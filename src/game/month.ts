// Skip 1 Month: exactly four weekly steps, with the four reports merged into one.

import type { GameState, WeekReport } from "./state";
import { advanceWeek } from "./week";

function mergeAmounts(lists: { label: string; amount: number }[][]): { label: string; amount: number }[] {
  const out = new Map<string, number>();
  for (const list of lists) for (const l of list) out.set(l.label, (out.get(l.label) ?? 0) + l.amount);
  return [...out].map(([label, amount]) => ({ label, amount }));
}

export function advanceMonth(s: GameState): GameState {
  let state = s;
  const reports: WeekReport[] = [];
  for (let i = 0; i < 4; i++) {
    state = advanceWeek(state);
    reports.push(state.report!);
  }
  const last = reports[3];
  // The month's lines, without repeats. Seat counts come from the national poll, which appears once a month.
  const all = reports.flatMap((r) => r.lines);
  const events = all.filter((l, i) => all.findIndex((x) => x.text === l.text) === i);
  const before = reports[0].seatsBefore;
  return {
    ...state,
    report: {
      ...last,
      income: mergeAmounts(reports.map((r) => r.income)),
      expenses: mergeAmounts(reports.map((r) => r.expenses)),
      seatsBefore: before,
      lines: events,
      weeks: 4,
    },
  };
}
