// One overlay at a time. Full-screen moments queue up in a fixed order instead of stacking on each other:
// what you opened yourself (saves, your record), then election night and its talks, your legacy, the morning-after
// analysis, the cabinet, naming your coalition, a party election count, and finally waiting decisions.

import type { GameState } from "@/game/state";

export type Overlay = "saves" | "record" | "night" | "legacy" | "analysis" | "newterm" | "naming" | "race" | "alert";

export function activeOverlay(g: GameState, ui: { savesOpen: boolean; recordOpen: boolean; analysisOpen: boolean }): Overlay {
  if (ui.savesOpen) return "saves";
  if (ui.recordOpen) return "record";
  if (g.night || g.formation) return "night";
  if (g.ending) return "legacy";
  if (ui.analysisOpen && g.lastAnalysis) return "analysis";
  if (g.newTerm) return "newterm";
  if (g.namePending) return "naming";
  if (g.race?.result) return "race";
  return "alert";
}

/** Whether a blocking overlay is up (the alert slot only blocks when it has something to show). */
export const blocking = (o: Overlay) => o !== "alert";
