"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { adoptPolicy, answerCard, applyAction, backForPm, buyAsset, callGeneralElection, callStateElection, closeNight, goToAgong, makeOffer, nextTalksRound, sellAsset, setCeo, setSyncWithGE, tableBudget, tapAsset, upgradeAsset, type ActionResult, type OfferKind, type Target } from "@/game/actions";
import { advanceMonth } from "@/game/month";
import { migrateGame, newGame, simulateElection, SAVE_VERSION, type GameState, type NewGameOptions } from "@/game/state";
import { recordTier } from "./meta";
import type { AssetType, CeoKind } from "@/game/systems/business";
import { advanceWeek } from "@/game/week";
import type { CoalitionId } from "@/game/world";

export type Lens = "holder" | "projection" | "support" | "presence" | "pressure" | "ethnic" | "urban" | "result";
export type View = "overview" | "map" | "dewan" | "states" | "policy" | "rivals" | "treasury" | "career";

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
  lang: "en" | "ms";
  sound: boolean;
  setLang: (lang: "en" | "ms") => void;
  setSound: (on: boolean) => void;
  skipToEvent: () => void;
  start: (player: CoalitionId, opts?: NewGameOptions) => void;
  quit: () => void;
  simulate: () => void;
  skipWeek: () => void;
  skipMonth: () => void;
  act: (id: string, target: Target) => void;
  business: (op: "buy" | "upgrade" | "sell" | "tap" | "ceo", type: AssetType, ceo?: CeoKind) => void;
  policy: (policyId: string, option: number) => void;
  budget: (alloc: Record<string, number>) => void;
  answer: (cardId: number, choice: number) => void;
  dissolveParliament: () => void;
  dissolveAssembly: (stateId: string) => void;
  syncAssembly: (stateId: string, sync: boolean) => void;
  offer: (c: CoalitionId, kind: OfferKind) => void;
  talksRound: () => void;
  back: (leader: CoalitionId, askDpm: boolean) => void;
  agong: () => void;
  endNight: () => void;
  load: (game: GameState) => void;
  notify: (text: string, error?: boolean) => void;
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
        lang: "en",
        sound: false,
        setLang: (lang) => set({ lang }),
        setSound: (sound) => set({ sound }),
        skipToEvent: () => {
          let g = get().game;
          if (!g) return;
          if (g.night || g.formation) return set({ toast: { id: ++toastId, text: "Finish Election Night and the coalition talks first.", error: true } });
          const start = g.week;
          // Up to 12 weeks, stopping at anything that needs you.
          for (let i = 0; i < 12; i++) {
            g = advanceWeek(g);
            const report = g.report!;
            const alarming = report.lines.some((l) => /MACC|in debt|Couldn.t pay|state election|by-election|leadership|retires|Achievement|Objective complete/.test(l.text));
            if (g.cards.length || g.budgetDue !== null || g.night || g.parliament.status === "campaign" || alarming) break;
          }
          set({ game: g, reportOpen: true, toast: { id: ++toastId, text: `Skipped ${g.week - start} week${g.week - start === 1 ? "" : "s"}.` } });
        },
        start: (player, opts) => set({ game: newGame(player, undefined, opts), lens: "holder", view: "overview", selected: null, reportOpen: false }),
        quit: () => set({ game: null, selected: null }),
        simulate: () => {
          const g = get().game;
          if (g) set({ game: simulateElection(g), lens: "result", view: get().view === "dewan" ? "dewan" : "map" });
        },
        skipWeek: () => {
          const g = get().game;
          if (g?.night || g?.formation) return set({ toast: { id: ++toastId, text: "Finish Election Night and the coalition talks first.", error: true } });
          if (g) set({ game: advanceWeek(g), reportOpen: true });
        },
        skipMonth: () => {
          const g = get().game;
          if (g?.night || g?.formation) return set({ toast: { id: ++toastId, text: "Finish Election Night and the coalition talks first.", error: true } });
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
        dissolveParliament: () => {
          const g = get().game;
          if (g) result(callGeneralElection(g));
        },
        dissolveAssembly: (stateId) => {
          const g = get().game;
          if (g) result(callStateElection(g, stateId));
        },
        syncAssembly: (stateId, sync) => {
          const g = get().game;
          if (g) result(setSyncWithGE(g, stateId, sync));
        },
        offer: (c, kind) => {
          const g = get().game;
          if (g) result(makeOffer(g, c, kind));
        },
        talksRound: () => {
          const g = get().game;
          if (g) result(nextTalksRound(g));
        },
        back: (leader, askDpm) => {
          const g = get().game;
          if (g) result(backForPm(g, leader, askDpm));
        },
        agong: () => {
          const g = get().game;
          if (!g) return;
          const r = goToAgong(g);
          result(r);
          if (r.ok && r.state.tiers.length) recordTier(r.state.player, r.state.tiers.at(-1)!.tier);
        },
        endNight: () => {
          const g = get().game;
          if (g) set({ game: closeNight(g) });
        },
        load: (game) => set({ game, selected: null, reportOpen: false, view: "overview", toast: { id: ++toastId, text: "Game loaded." } }),
        notify: (text, error) => set({ toast: { id: ++toastId, text, error } }),
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
      partialize: (s) => ({ game: s.game, lens: s.lens, view: s.view, lang: s.lang, sound: s.sound }),
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
