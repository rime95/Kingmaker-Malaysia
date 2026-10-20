"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  adoptPolicy,
  answerCard,
  applyAction,
  appoint,
  askFavour,
  closeRace,
  fireStaff,
  launchStimulus,
  setCivilPay,
  startProject,
  hireStaff,
  raceAct,
  raiseStaff,
  meet,
  backForPm,
  buyAsset,
  callGeneralElection,
  callStateElection,
  claimBubble,
  closeNight,
  commissionPoll,
  goToAgong,
  makeOffer,
  nextTalksRound,
  sellAsset,
  setCeo,
  setSyncWithGE,
  tableBudget,
  tapAsset,
  upgradeAsset,
  warRoom,
  type ActionResult,
  type OfferKind,
  type Target,
} from "@/game/actions";
import { advanceMonth } from "@/game/month";
import { renameCoalition, syncNames } from "@/game/systems/coalitions";
import { migrateGame, newGame, SAVE_VERSION, type GameState, type NewGameOptions } from "@/game/state";
import { recordTier } from "./meta";
import type { AssetType, CeoKind } from "@/game/systems/business";
import { advanceWeek } from "@/game/week";
import type { CoalitionId } from "@/game/world";
import type { PortfolioId } from "@/game/data/people";
import type { RaceMove } from "@/game/systems/partyrace";
import type { MapFocus } from "@/components/map/MalaysiaMap";

export type Lens = "holder" | "parties" | "projection" | "support" | "presence" | "pressure" | "ethnic" | "urban" | "result";
/** Side panels that open over the map. */
export type Panel = "campaign" | "party" | "people" | "team" | "nation" | "policy" | "states" | "parliament" | "rivals" | "treasury";

export interface Toast {
  id: number;
  text: string;
  error?: boolean;
}

/** A "+RM 250k" that floats up from a claimed bubble. */
export interface Floater {
  id: number;
  seat: number;
  text: string;
}

interface Store {
  game: GameState | null;
  lens: Lens;
  panel: Panel | null;
  selected: number | null;
  /** Where the map should fly next. */
  mapFocus: MapFocus;
  toast: Toast | null;
  floater: Floater | null;
  /** Week in review, shown after time moves on. */
  reportOpen: boolean;
  /** Decision cards you put off ("decide later") until you open them again. */
  snoozed: number[];
  budgetSnoozed: boolean;
  lang: "en" | "ms";
  sound: boolean;
  setLang: (lang: "en" | "ms") => void;
  setSound: (on: boolean) => void;
  start: (player: CoalitionId, opts?: NewGameOptions) => void;
  quit: () => void;
  simulate: () => void;
  skipWeek: () => void;
  skipMonth: () => void;
  skipToEvent: () => void;
  act: (id: string, target: Target) => void;
  claim: (bubbleId: number) => void;
  poll: (seat: number) => void;
  meet: (id: number) => void;
  lever: (l: { kind: "pay"; stance: "freeze" | "normal" | "raise" } | { kind: "stimulus" } | { kind: "project"; id: string }) => void;
  hireStaff: (id: number) => void;
  fireStaff: (id: number) => void;
  raiseStaff: (id: number) => void;
  race: (move: RaceMove) => void;
  endRace: () => void;
  favour: (id: number) => void;
  appoint: (post: PortfolioId, id: number | null) => void;
  rename: (name: string, short: string, color: string) => void;
  keepName: () => void;
  business: (op: "buy" | "upgrade" | "sell" | "tap" | "ceo", type: AssetType, ceo?: CeoKind) => void;
  policy: (policyId: string, option: number) => void;
  budget: (alloc: Record<string, number>) => void;
  answer: (cardId: number, choice: number) => void;
  snooze: (cardId: number) => void;
  snoozeBudget: () => void;
  unsnooze: () => void;
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
  /** Select a seat and fly the map to it (closes a panel that would cover it on small screens). */
  focusSeat: (seatIndex: number) => void;
  focusState: (stateId: string) => void;
  setLens: (lens: Lens) => void;
  openPanel: (panel: Panel | null) => void;
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
let nonce = 0;
const BLOCKED = "Finish Election Night and the coalition talks first.";

export const useGame = create<Store>()(
  persist(
    (set, get) => {
      const result = (r: ActionResult) => {
        if (r.ok) set({ game: r.state, toast: { id: ++toastId, text: r.message } });
        else set({ toast: { id: ++toastId, text: r.error, error: true } });
      };
      const moved = (game: GameState) => set({ game, reportOpen: true, budgetSnoozed: false });
      return {
        game: null,
        lens: "holder",
        panel: null,
        selected: null,
        mapFocus: null,
        toast: null,
        floater: null,
        reportOpen: false,
        snoozed: [],
        budgetSnoozed: false,
        lang: "en",
        sound: false,
        setLang: (lang) => set({ lang }),
        setSound: (sound) => set({ sound }),
        start: (player, opts) => set({ game: newGame(player, undefined, opts), lens: "holder", panel: null, selected: null, reportOpen: false, snoozed: [], mapFocus: { kind: "reset", nonce: ++nonce } }),
        quit: () => set({ game: null, selected: null, panel: null }),
        simulate: () => {
          const g = get().game;
          if (!g) return;
          const r = warRoom(g);
          result(r);
          if (r.ok) set({ lens: "result" });
        },
        skipWeek: () => {
          const g = get().game;
          if (g?.night || g?.formation) return set({ toast: { id: ++toastId, text: BLOCKED, error: true } });
          if (g) moved(advanceWeek(g));
        },
        skipMonth: () => {
          const g = get().game;
          if (g?.night || g?.formation) return set({ toast: { id: ++toastId, text: BLOCKED, error: true } });
          if (g) moved(advanceMonth(g));
        },
        skipToEvent: () => {
          let g = get().game;
          if (!g) return;
          if (g.night || g.formation) return set({ toast: { id: ++toastId, text: BLOCKED, error: true } });
          const start = g.week;
          // Up to 12 weeks, stopping at anything that needs you.
          for (let i = 0; i < 12; i++) {
            g = advanceWeek(g);
            const alarming = g.report!.lines.some((l) => /MACC|in debt|Couldn.t pay|state election|by-election|leadership|retires|Achievement|Objective complete/.test(l.text));
            if (g.cards.length || g.budgetDue !== null || g.night || g.parliament.status === "campaign" || alarming) break;
          }
          moved(g);
          set({ toast: { id: ++toastId, text: `Skipped ${g.week - start} week${g.week - start === 1 ? "" : "s"}.` } });
        },
        act: (id, target) => {
          const g = get().game;
          if (g) result(applyAction(g, id, target));
        },
        claim: (bubbleId) => {
          const g = get().game;
          if (!g) return;
          const b = g.bubbles.find((x) => x.id === bubbleId);
          const r = claimBubble(g, bubbleId);
          result(r);
          if (r.ok && b) set({ floater: { id: ++toastId, seat: b.seat, text: r.message.split(": ").at(-1)!.replace(/\.$/, "") } });
        },
        rename: (name, short, color) => {
          const g = get().game;
          if (!g) return;
          const r = renameCoalition(g, name, short, color);
          if (r.ok) set({ game: r.state, toast: { id: ++toastId, text: `Your coalition is now ${name.trim()} (${short.trim()}).` } });
          else set({ toast: { id: ++toastId, text: r.error, error: true } });
        },
        keepName: () => {
          const g = get().game;
          if (g) set({ game: { ...g, namePending: false } });
        },
        race: (move) => {
          const g = get().game;
          if (g) result(raceAct(g, move));
        },
        endRace: () => {
          const g = get().game;
          if (g) set({ game: closeRace(g) });
        },
        hireStaff: (id) => {
          const g = get().game;
          if (g) result(hireStaff(g, id));
        },
        fireStaff: (id) => {
          const g = get().game;
          if (g) result(fireStaff(g, id));
        },
        raiseStaff: (id) => {
          const g = get().game;
          if (g) result(raiseStaff(g, id));
        },
        lever: (l) => {
          const g = get().game;
          if (!g) return;
          result(l.kind === "pay" ? setCivilPay(g, l.stance) : l.kind === "stimulus" ? launchStimulus(g) : startProject(g, l.id));
        },
        meet: (id) => {
          const g = get().game;
          if (g) result(meet(g, id));
        },
        favour: (id) => {
          const g = get().game;
          if (g) result(askFavour(g, id));
        },
        appoint: (post, id) => {
          const g = get().game;
          if (g) result(appoint(g, post, id));
        },
        poll: (seat) => {
          const g = get().game;
          if (g) result(commissionPoll(g, seat));
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
        snooze: (cardId) => set({ snoozed: [...get().snoozed, cardId] }),
        snoozeBudget: () => set({ budgetSnoozed: true }),
        unsnooze: () => set({ snoozed: [], budgetSnoozed: false }),
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
        load: (game) => set({ game, selected: null, reportOpen: false, panel: null, snoozed: [], toast: { id: ++toastId, text: "Game loaded." }, mapFocus: { kind: "reset", nonce: ++nonce } }),
        notify: (text, error) => set({ toast: { id: ++toastId, text, error } }),
        select: (selected) => set({ selected }),
        focusSeat: (i) => set({ selected: i, mapFocus: { kind: "seat", index: i, nonce: ++nonce }, panel: typeof window !== "undefined" && window.innerWidth < 900 ? null : get().panel }),
        focusState: (id) => set({ mapFocus: { kind: "state", id, nonce: ++nonce } }),
        setLens: (lens) => set({ lens }),
        openPanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
        closeReport: () => set({ reportOpen: false }),
        clearToast: () => set({ toast: null }),
      };
    },
    {
      name: "mpr-save",
      version: SAVE_VERSION,
      storage: safeStorage,
      partialize: (s) => ({ game: s.game, lens: s.lens, lang: s.lang, sound: s.sound }),
      // Saves from before the turn loop can't be upgraded: start fresh.
      migrate: (persisted, version) => (version < 2 ? { game: null, lens: "holder" } : persisted) as Store,
      // Every load fills fields added since the save was made (safe to repeat).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return { ...current, game: p.game ? migrateGame(p.game) : null, lens: p.lens ?? current.lens, lang: p.lang ?? current.lang, sound: p.sound ?? current.sound };
      },
    },
  ),
);

// Coalition names can change during a game; keep display text in step with the loaded game.
useGame.subscribe((st, prev) => {
  if (st.game && st.game.coalitions !== prev.game?.coalitions) syncNames(st.game);
});
// ...and for a game already loaded from storage when the store was created.
{
  const loaded = useGame.getState().game;
  if (loaded) syncNames(loaded);
}
