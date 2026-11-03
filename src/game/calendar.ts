// What's coming: the dated events on the timeline strip and the docket, soonest first. Pure, from the game state.

import { weekDate, type GameState } from "./state";
import { GE, PRN } from "./config";
import { isBudgetWeek } from "./systems/budget";
import { raceOpens } from "./systems/partyrace";
import { nextMotion } from "./systems/dewan";
import { STATE_BY_ID } from "./world";
import type { Panel } from "@/store/gameStore";

export interface Upcoming {
  key: string;
  /** Weeks from now (0 = this week). */
  weeks: number;
  label: string;
  /** Needs you now (a deadline you act on, not just a date). */
  urgent: boolean;
  /** Where to go about it. */
  panel: Panel;
  state?: string;
}

/** The next week (from `from`) that satisfies `test`, within a year and a half. */
function nextWeek(from: number, test: (w: number) => boolean): number | null {
  for (let w = from; w < from + 80; w++) if (test(w)) return w;
  return null;
}

export function upcoming(s: GameState): Upcoming[] {
  const out: Upcoming[] = [];
  const now = s.week;
  const p = s.parliament;
  if (p.status === "campaign" && p.pollWeek !== null) out.push({ key: "ge", weeks: p.pollWeek - now, label: "Polling day", urgent: true, panel: "campaign" });
  else out.push({ key: "ge", weeks: Math.max(0, p.deadlineWeek - now) + GE.campaignWeeks, label: "General election due", urgent: false, panel: "campaign" });
  if (s.nominations?.open) out.push({ key: "nom", weeks: Math.max(0, s.nominations.closesWeek - now), label: "Nomination day", urgent: true, panel: "nominations" });
  for (const [id, a] of Object.entries(s.assemblies)) {
    const name = STATE_BY_ID[id].name;
    if (a.status === "campaign" && a.pollWeek !== null) out.push({ key: `prn-${id}`, weeks: a.pollWeek - now, label: `${name} votes`, urgent: true, panel: "states", state: id });
    else if (!a.syncGE && a.deadlineWeek - now <= 26) out.push({ key: `prn-${id}`, weeks: Math.max(0, a.deadlineWeek - now) + PRN.campaignWeeks, label: `${name} election due`, urgent: false, panel: "states", state: id });
  }
  if (s.budgetDue !== null) out.push({ key: "budget", weeks: 0, label: "Budget due", urgent: true, panel: "policy" });
  else {
    const b = nextWeek(now + 1, (w) => isBudgetWeek(weekDate(w)));
    if (b !== null) out.push({ key: "budget", weeks: b - now, label: "Budget day", urgent: false, panel: "policy" });
  }
  const m = nextMotion(s);
  if (m) out.push({ key: `vote-${m.id}`, weeks: Math.max(0, m.voteWeek - now), label: "Dewan vote", urgent: m.voteWeek - now <= 1, panel: "orderpaper" });
  if (s.race && !s.race.result) out.push({ key: "race", weeks: Math.max(0, s.race.voteWeek - now), label: "Party vote", urgent: true, panel: "party" });
  else {
    const r = nextWeek(now + 1, raceOpens);
    if (r !== null) out.push({ key: "race", weeks: r - now, label: "Party elections open", urgent: false, panel: "party" });
  }
  return out.filter((x) => x.weeks >= 0).sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.weeks - b.weeks);
}

/** "this week", "1 wk", "12 wks", "~2 yrs". */
export function inWeeks(w: number): string {
  if (w <= 0) return "this week";
  if (w >= 104) return `~${Math.round(w / 52)} yrs`;
  return `${w} wk${w === 1 ? "" : "s"}`;
}
