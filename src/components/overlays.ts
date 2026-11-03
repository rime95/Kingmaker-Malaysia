// One overlay at a time. Full-screen moments queue up in a fixed order instead of stacking on each other:
// what you opened yourself (saves, your record), then election night and its talks, a state results night, your
// legacy, the morning-after analysis, the cabinet, hung-assembly talks, a state MB and exco, naming your coalition, a
// party election count, the turn summary, and finally waiting decisions.

import type { GameState } from "@/game/state";

export type Overlay = "saves" | "record" | "night" | "statenight" | "legacy" | "analysis" | "newterm" | "statetalks" | "stateterm" | "naming" | "race" | "summary" | "alert";

export function activeOverlay(g: GameState, ui: { savesOpen: boolean; recordOpen: boolean; analysisOpen: boolean; summary?: boolean }): Overlay {
  if (ui.savesOpen) return "saves";
  if (ui.recordOpen) return "record";
  if (g.night || g.formation) return "night";
  if (g.stateNight) return "statenight";
  if (g.ending) return "legacy";
  if (ui.analysisOpen && g.lastAnalysis) return "analysis";
  if (g.newTerm) return "newterm";
  if (g.stateTalks) return "statetalks";
  if (g.stateTerms?.length) return "stateterm";
  if (g.namePending) return "naming";
  if (g.race?.result) return "race";
  if (ui.summary && g.report) return "summary";
  return "alert";
}

/** Whether a blocking overlay is up (the alert slot only blocks when it has something to show). */
export const blocking = (o: Overlay) => o !== "alert";
