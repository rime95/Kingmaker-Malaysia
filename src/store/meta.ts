"use client";

// Across games: your best general-election result with each coalition. Kept in this browser only.
// Browser storage can be blocked; the game works without it.

import type { WinTier } from "@/game/systems/formation";
import type { CoalitionId } from "@/game/world";

const KEY = "mpr-meta";
const ORDER: WinTier["tier"][] = ["none", "bronze", "silver", "gold", "platinum", "diamond"];

export interface Meta {
  best: Partial<Record<CoalitionId, WinTier["tier"]>>;
}

export function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Meta) : { best: {} };
  } catch {
    return { best: {} };
  }
}

export function recordTier(c: CoalitionId, tier: WinTier["tier"]): void {
  const meta = readMeta();
  if (ORDER.indexOf(tier) <= ORDER.indexOf(meta.best[c] ?? "none") && meta.best[c]) return;
  meta.best[c] = tier;
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {}
}

/** The Underdog scenario unlocks after any Gold or better. */
export function underdogUnlocked(meta: Meta): boolean {
  return Object.values(meta.best).some((t) => t && ORDER.indexOf(t) >= ORDER.indexOf("gold"));
}

let lastRaw: string | null | undefined;
let lastMeta: Meta = { best: {} };

/** Cached snapshot for React: the same object until the stored value changes. */
export function metaSnapshot(): Meta {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastMeta = readMeta();
  }
  return lastMeta;
}
