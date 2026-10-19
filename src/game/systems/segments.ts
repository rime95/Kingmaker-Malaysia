// Voter segments: how a policy, a budget line or a news event lands on each seat.
// Effects are log-odds for the player's coalition, weighted by who lives in the seat.

import { SEATS, type Bloc } from "../world";

export type Segment = Bloc | "urban" | "rural" | "youth" | "b40" | "all";
export type SegEffects = Partial<Record<Segment, number>>;

export const SEGMENT_LABEL: Record<Segment, string> = {
  malay: "Malay",
  chinese: "Chinese",
  indian: "Indian",
  sabah: "Sabah Bumi",
  sarawak: "Sarawak Bumi",
  other: "Others",
  urban: "Urban",
  rural: "Rural",
  youth: "Young voters",
  b40: "B40",
  all: "Everyone",
};

/** Each seat's weight for every segment (ethnic share; urban/rural split; youth and B40 relative to a typical seat). */
const WEIGHTS: Record<Segment, number>[] = SEATS.map((s) => ({
  ...s.demo.ethnic,
  urban: s.demo.urbanity,
  rural: 1 - s.demo.urbanity,
  youth: s.demo.youth / 0.3,
  b40: s.demo.b40 / 0.5,
  all: 1,
}));

export function segValue(seatIndex: number, eff: SegEffects): number {
  const w = WEIGHTS[seatIndex];
  let v = 0;
  for (const k in eff) v += (eff[k as Segment] ?? 0) * w[k as Segment];
  return v;
}

export function addSeg(a: SegEffects, b: SegEffects, scale = 1): SegEffects {
  const out: SegEffects = { ...a };
  for (const k in b) out[k as Segment] = (out[k as Segment] ?? 0) + (b[k as Segment] ?? 0) * scale;
  return out;
}

/** Fades every segment toward zero; drops values too small to matter. */
export function decaySeg(a: SegEffects, rate: number): SegEffects {
  const out: SegEffects = {};
  for (const k in a) {
    const v = (a[k as Segment] ?? 0) * (1 - rate);
    if (Math.abs(v) > 0.0005) out[k as Segment] = v;
  }
  return out;
}

/** "Malay +0.04 · Chinese −0.06" in vote-share points (roughly 25 pts per log-odds unit near 50%). */
export function describeSeg(eff: SegEffects, scale = 1): string {
  return (Object.entries(eff) as [Segment, number][])
    .filter(([, v]) => Math.abs(v * scale * 25) >= 0.05)
    .map(([k, v]) => {
      const pts = v * scale * 25;
      return `${SEGMENT_LABEL[k]} ${pts > 0 ? "+" : "−"}${Math.abs(pts).toFixed(1)}`;
    })
    .join(" · ");
}
