"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { adoptPolicy, answerCard, applyAction, buyAsset, sellAsset, setCeo, tableBudget, tapAsset, upgradeAsset, type ActionResult, type Target } from "@/game/actions";
import { advanceMonth } from "@/game/month";
import { migrateGame, newGame, simulateElection, SAVE_VERSION, type GameState } from "@/game/state";
import type { AssetType, CeoKind } from "@/game/systems/business";
import { advanceWeek } from "@/game/week";
import type { CoalitionId } from "@/game/world";

export type Lens = "holder" | "projection" | "support" | "presence" | "ethnic" | "urban" | "result";
export type View = "overview" | "map" | "dewan" | "policy" | "treasury";

export interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

interface Store {
  game: GameState | null;
  lens: Lens;
  view: View;
  selected: number | null;
  toast: Toast | null;
  /** Shown after a skip until dismissed. */
  reportOpen: boolean;
  start: (player: CoalitionId) => void;
  quit: () => void;
  simulate: () => void;
  skipWeek: () => void;
  skipMonth: () => void;
  act: (id: string, target: Target) => void;
  business: (op: "buy" | "upgrade" | "sell" | "tap" | "ceo", type: AssetType, ceo?: CeoKind) => void;
  policy: (policyId: string, option: number) => void;
  budget: (alloc: Record<string, number>) => void;
  answer: (cardId: number, choice: number) => void;
  select: (seatIndex: number | null) => void;
  setLens: (lens: Lens) => void;
  setView: (view: View) => void;
  closeReport: () => void;
  clearToast: () => void;
}

// Browser storage can be blocked (private windows, previews); the game still runs without it.
const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
}));

let toastId = 0;

export const useGame = create<Store>()(
  persist(
    (set, get) => {
      const result = (r: ActionResult) => {
        if (r.ok) set({ game: r.state, toast: { id: ++toastId, text: r.message } });
        else set({ toast: { id: ++toastId, text: r.error, error: true } });
      };
      return {
        game: null,
        lens: "holder",
        view: "overview",
        selected: null,
        toast: null,
        reportOpen: false,
        start: (player) => set({ game: newGame(player), lens: "holder", view: "overview", selected: null, reportOpen: false }),
        quit: () => set({ game: null, selected: null }),
        simulate: () => {
          const g = get().game;
          if (g) set({ game: simulateElection(g), lens: "result", view: get().view === "dewan" ? "dewan" : "map" });
        },
        skipWeek: () => {
          const g = get().game;
          if (g) set({ game: advanceWeek(g), reportOpen: true });
        },
        skipMonth: () => {
          const g = get().game;
          if (g) set({ game: advanceMonth(g), reportOpen: true });
        },
        act: (id, target) => {
          const g = get().game;
          if (g) result(applyAction(g, id, target));
        },
        business: (op, type, ceo) => {
          const g = get().game;
          if (!g) return;
          if (op === "buy") result(buyAsset(g, type, ceo ?? "pro"));
          else if (op === "upgrade") result(upgradeAsset(g, type));
          else if (op === "sell") result(sellAsset(g, type));
          else if (op === "tap") result(tapAsset(g, type));
          else result(setCeo(g, type, ceo ?? "pro"));
        },
        policy: (policyId, option) => {
          const g = get().game;
          if (g) result(adoptPolicy(g, policyId, option));
        },
        budget: (alloc) => {
          const g = get().game;
          if (g) result(tableBudget(g, alloc));
        },
        answer: (cardId, choice) => {
          const g = get().game;
          if (g) result(answerCard(g, cardId, choice));
        },
        select: (selected) => set({ selected }),
        setLens: (lens) => set({ lens }),
        setView: (view) => set({ view }),
        closeReport: () => set({ reportOpen: false }),
        clearToast: () => set({ toast: null }),
      };
    },
    {
      name: "mpr-save",
      version: SAVE_VERSION,
      storage: safeStorage,
      partialize: (s) => ({ game: s.game, lens: s.lens, view: s.view }),
      // Saves from before the turn loop can't be upgraded: start fresh.
      migrate: (persisted, version) => (version < 2 ? { game: null, lens: "holder", view: "overview" } : persisted) as Store,
      // Every load fills fields added since the save was made (safe to repeat).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return { ...current, ...p, game: p.game ? migrateGame(p.game) : null };
      },
    },
  ),
);
