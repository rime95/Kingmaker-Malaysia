// Small shared helpers with no game-state dependencies: starting presence per seat and the calendar.

import { AUTO_DISSOLUTION, START_DATE } from "./config";
import { ge15MarginShare } from "./voter";
import { SEATS, contestingIn, type CoalitionId } from "./world";

/** Starting service in a seat: a coalition's own seats start stronger, its safest seats strongest. */
export function serviceBase(c: CoalitionId, seatIndex: number): number {
  const s = SEATS[seatIndex];
  if (s.ge15Coalition !== c) return 5;
  return Math.round(20 + 50 * Math.min(1, ge15MarginShare(s) / 0.4));
}

export function machineryBase(c: CoalitionId, seatIndex: number): number {
  const s = SEATS[seatIndex];
  if (!contestingIn(s).includes(c)) return 0;
  return s.ge15Coalition === c ? 30 : 12;
}

export function weekDate(week: number): Date {
  const d = new Date(`${START_DATE}T00:00:00`);
  d.setDate(d.getDate() + week * 7);
  return d;
}

export function weekLabel(week: number): string {
  return weekDate(week).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Whole weeks until Parliament dissolves automatically (0 once it has). */
export function weeksToDissolution(week: number): number {
  const ms = new Date(`${AUTO_DISSOLUTION}T00:00:00`).getTime() - weekDate(week).getTime();
  return Math.max(0, Math.round(ms / (7 * 86_400_000)));
}
