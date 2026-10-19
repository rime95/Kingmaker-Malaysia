// The annual Budget, tabled in the second week of October. In government you spend an envelope of points set by
// fiscal space (overspending is allowed but hurts the economy) and the Dewan must pass it. In opposition you can
// table a shadow budget: no vote, smaller effect. All numbers TEMPORARY.

import type { SegEffects } from "./segments";

export interface BudgetLine {
  id: string;
  label: string;
  blurb: string;
  /** Voter effect per point (log-odds, fades about 1.5% a week). */
  voters: SegEffects;
  /** Economy change per point. */
  economy?: number;
}

export const BUDGET_LINES: BudgetLine[] = [
  { id: "cash", label: "Cash aid & subsidies", blurb: "Money straight to poorer households.", voters: { b40: 0.01 } },
  { id: "rural", label: "Rural development", blurb: "Roads, water, FELDA and kampung grants.", voters: { rural: 0.009 } },
  { id: "urban", label: "Transit & housing", blurb: "MRT lines, affordable homes, flood mitigation in cities.", voters: { urban: 0.009 } },
  { id: "youth", label: "Education & youth", blurb: "PTPTN relief, TVET, gig-worker protection.", voters: { youth: 0.009 } },
  { id: "borneo", label: "Sabah & Sarawak", blurb: "Pan Borneo, rural power and water, MA63 grants.", voters: { sabah: 0.016, sarawak: 0.016 } },
  { id: "civil", label: "Civil service pay", blurb: "1.7 million civil servants, many of them Malay voters.", voters: { malay: 0.007, all: 0.0013 } },
  { id: "tax", label: "Tax relief", blurb: "Income tax cuts and reliefs. Helps everyone a little and boosts the economy.", voters: { all: 0.004, urban: 0.002 }, economy: 0.5 },
];

export const BUDGET = {
  /** Weeks to table it before officials table a default (government) or the chance lapses (opposition). */
  window: 2,
  overspendMax: 5,
  overspendFiscal: 3,
  overspendEconomy: 0.5,
  shadowWeight: 0.4,
  shadowAp: 2,
  decay: 0.015,
  /** What a defeated budget costs. */
  defeat: { capital: 30, unity: 10, scandal: 20 },
};

/** Points to spend this year, from fiscal space (0–100). */
export function budgetEnvelope(fiscal: number): number {
  return Math.max(4, Math.round(8 + fiscal / 10));
}

/** Officials' default: spread evenly across every line. */
export function defaultAllocation(envelope: number): Record<string, number> {
  const out: Record<string, number> = {};
  BUDGET_LINES.forEach((l, i) => (out[l.id] = Math.floor(envelope / BUDGET_LINES.length) + (i < envelope % BUDGET_LINES.length ? 1 : 0)));
  return out;
}

/** True when this date falls in the Budget week (8–14 October). */
export function isBudgetWeek(date: Date): boolean {
  return date.getMonth() === 9 && date.getDate() >= 8 && date.getDate() <= 14;
}
