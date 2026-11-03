// The end of a leader's road. A career ends when you retire (of age, or by choice) or when the party throws you out.
// The game pauses on a legacy screen: what you won, how long you ruled, what you leave behind. Then the dynasty goes on
// with your protégé (or, if you were ousted, you can fight on from the back benches), or you start a new game.

import type { GameState } from "../state";
import { cshort } from "../world";
import { ACHIEVEMENTS, LEGACY } from "./goals";
import { RUNGS, succession } from "./career";

export interface Ending {
  reason: "retired" | "ousted" | "chose";
  week: number;
}

/** Why you can't retire now (null when you can). */
export function retireBlocked(s: GameState): string | null {
  if (s.ending) return "Already on your way out.";
  if (s.night || s.formation || s.newTerm) return "Not in the middle of an election.";
  return null;
}

/** Step down of your own accord: the legacy screen, then your protégé takes over. */
export function retireNow(s: GameState): { state: GameState; message: string } | { error: string } {
  const why = retireBlocked(s);
  if (why) return { error: why };
  return { state: { ...s, ending: { reason: "chose", week: s.week } }, message: `${s.career.name} announces their retirement.` };
}

/** Leave the legacy screen: the protégé takes over (or, ousted, you carry on from the ranks). */
export function continueAfterEnding(s: GameState): GameState {
  const e = s.ending;
  if (!e) return s;
  if (e.reason === "ousted") return { ...s, ending: null };
  return { ...s, ending: null, career: succession(s.career, s.seed, s.week) };
}

export interface Legacy {
  name: string;
  title: string;
  headline: string;
  age: number;
  generation: number;
  rung: string;
  /** General elections fought, and the results. */
  elections: number;
  wins: number;
  twoThirds: number;
  bestSeats: number;
  yearsAsPm: number;
  /** Time at Seri Perdana in words: "34 weeks" or "6.5 years". */
  timeAsPm: string;
  achievements: { name: string; text: string }[];
  goals: { name: string; done: boolean }[];
}

export function legacyOf(s: GameState): Legacy {
  const c = s.career;
  const fought = s.tiers;
  const wins = fought.filter((t) => t.tier === "platinum" || t.tier === "diamond").length;
  const twoThirds = fought.filter((t) => t.tier === "diamond").length;
  const bestSeats = Math.max(s.holders.filter((h) => h === s.player).length, ...fought.map((t) => t.seats));
  const yearsAsPm = Math.round((c.pmWeeks / 52) * 10) / 10;
  const timeAsPm = c.pmWeeks < 52 ? `${c.pmWeeks} week${c.pmWeeks === 1 ? "" : "s"}` : `${yearsAsPm} years`;
  const title =
    twoThirds >= 2
      ? "Bapa Pembangunan · Father of Development"
      : twoThirds === 1
        ? "Negarawan · Statesman"
        : wins >= 2
          ? "A Prime Minister the rakyat trusted twice"
          : wins === 1
            ? "Perdana Menteri · Prime Minister"
            : bestSeats >= 30
              ? "The kingmaker who built a movement"
              : "The voice of the opposition";
  const party = cshort(s.player);
  const why = s.ending?.reason === "ousted" ? "is ousted by the party" : "bows out";
  const headline =
    wins > 0
      ? `${c.name.toUpperCase()} ${why.toUpperCase()} AFTER ${wins} ELECTION WIN${wins === 1 ? "" : "S"} AND ${timeAsPm.toUpperCase()} AT SERI PERDANA`
      : `${c.name.toUpperCase()} ${why.toUpperCase()}: ${party} HAS ${bestSeats} SEAT${bestSeats === 1 ? "" : "S"} AT ITS PEAK`;
  return {
    name: c.name,
    title,
    headline,
    age: c.age,
    generation: c.generation,
    rung: RUNGS[c.rung],
    elections: fought.length,
    wins,
    twoThirds,
    bestSeats,
    yearsAsPm,
    timeAsPm,
    achievements: ACHIEVEMENTS.filter((a) => s.achievements[a.id] !== undefined).map((a) => ({ name: a.name, text: a.text })),
    goals: LEGACY.map((g) => ({ name: g.name, done: g.progress(s) >= 1 })),
  };
}
