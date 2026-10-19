"use client";

// Named save slots in this browser, plus export/import as a file to move a game to another computer.

import { migrateGame, weekLabel, type GameState } from "@/game/state";
import { COALITION_INFO } from "@/game/world";

const KEY = "mpr-slots";
const MAX_SLOTS = 8;

export interface Slot {
  id: string;
  name: string;
  savedAt: number;
  summary: string;
  game: GameState;
}

export function listSlots(): Slot[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Slot[]) : [];
  } catch {
    return [];
  }
}

function write(slots: Slot[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

export function summary(g: GameState): string {
  return `${COALITION_INFO[g.player].short} · ${g.career.name} · ${weekLabel(g.week)} · ${g.holders.filter((h) => h === g.player).length} seats`;
}

export function saveSlot(g: GameState, name: string): boolean {
  const slots = listSlots();
  const slot: Slot = { id: `${Date.now()}`, name: name.trim() || summary(g), savedAt: Date.now(), summary: summary(g), game: g };
  return write([slot, ...slots].slice(0, MAX_SLOTS));
}

export function deleteSlot(id: string): void {
  write(listSlots().filter((s) => s.id !== id));
}

export function loadSlot(id: string): GameState | null {
  const s = listSlots().find((x) => x.id === id);
  return s ? migrateGame(s.game) : null;
}

/** Download the game as a .json file (the browser asks where to save it). */
export function exportGame(g: GameState): void {
  const blob = new Blob([JSON.stringify({ format: "malam-pilihan-raya", game: g })], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `malam-pilihan-raya-${COALITION_INFO[g.player].short}-week${g.week + 1}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importGame(file: File): Promise<GameState | null> {
  try {
    const data = JSON.parse(await file.text());
    if (data?.format !== "malam-pilihan-raya" || !data.game?.holders) return null;
    return migrateGame(data.game as GameState);
  } catch {
    return null;
  }
}
