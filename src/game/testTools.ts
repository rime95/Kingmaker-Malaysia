// Test tools for play-testing (⋯ menu → Test tools). They bend the rules, so they're off by default.

import { dissolveParliament } from "./systems/assemblies";
import { nextMotion, openMeeting, resolveMotion } from "./systems/dewan";
import { weekDate, type GameState, type ReportLine } from "./state";
import { advanceWeek } from "./week";

/** Dissolve Parliament now and run the clock to polling day: nominations close with the defaults, Election Night starts. */
export function testGeneralElection(s: GameState): GameState {
  if (s.night || s.formation) return s;
  let g = s.parliament.status === "sitting" ? dissolveParliament(s) : s;
  for (let i = 0; i < 10 && !(g.night && g.night.week === g.week); i++) g = advanceWeek(g);
  return g;
}

/** Call the Dewan into session (if it's in recess) and take the next vote now. */
export function testSitting(s: GameState): { state: GameState; lines: ReportLine[] } {
  if (s.parliament.status !== "sitting") return { state: s, lines: [{ text: "Parliament is dissolved.", tone: "bad" }] };
  let g = s;
  if (!nextMotion(g)) g = { ...g, dewan: openMeeting(g, `${weekDate(g.week).getFullYear()}-special${g.dewan.nextId}`, weekDate(g.week).getFullYear()) };
  const m = nextMotion(g)!;
  return resolveMotion(g, m);
}

export function testBoost(s: GameState): GameState {
  return { ...s, me: { ...s.me, ap: s.me.ap + 10, funds: s.me.funds + 10_000_000 } };
}
