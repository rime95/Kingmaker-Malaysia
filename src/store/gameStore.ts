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
  delegateStaff,
  nominateCandidate,
  makePact,
  dewanPrep,
  dewanTable,
  deepMove,
  type DeepOp,
  breakPact,
  fireStaff,
  headhuntStaff,
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
import { advanceTurn, advanceWeeks } from "@/game/month";
import { testBoost, testGeneralElection, testSitting } from "@/game/testTools";
import { toggleOrder } from "@/game/systems/orders";
import type { PrepMove } from "@/game/systems/dewan";
import { renameCoalition, syncNames } from "@/game/systems/coalitions";
import { migrateGame, newGame, SAVE_VERSION, type GameState, type NewGameOptions } from "@/game/state";
import { recordTier } from "./meta";
import type { AssetType, CeoKind } from "@/game/systems/business";
import type { CoalitionId } from "@/game/world";
import type { PortfolioId } from "@/game/data/people";
import type { RaceMove } from "@/game/systems/partyrace";
import { buyProperty, buyShares, cancelOrder, declareAssets, donate, payOffLoan, placeOrder, sellProperty, sellShares, setPayTeam, type Owner } from "@/game/systems/wealth";
import type { StockOrder } from "@/game/systems/bursa";
import type { MapFocus } from "@/components/map/MalaysiaMap";

export type Lens = "holder" | "parties" | "projection" | "support" | "presence" | "pressure" | "ethnic" | "urban" | "result" | "swing";
/** Side panels that open over the map. */
export type Panel = "campaign" | "battle" | "party" | "people" | "team" | "nation" | "nominations" | "policy" | "states" | "parliament" | "rivals" | "treasury" | "seat" | "orderpaper" | "analysis" | "cabinet";

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
  /** Where on screen the seat was clicked (the action popover opens there); null = docked. */
  popAt: { x: number; y: number } | null;
  /** The Record modal (your career, objectives and achievements). */
  recordOpen: boolean;
  /** The post-election analysis (opens after Election Night). */
  analysisOpen: boolean;
  setAnalysisOpen: (open: boolean) => void;
  setRecordOpen: (open: boolean) => void;
  /** Where the map should fly next. */
  mapFocus: MapFocus;
  toast: Toast | null;
  floater: Floater | null;
  /** Week in review, shown after time moves on. */
  reportOpen: boolean;
  /** Decision cards you put off ("decide later") until you open them again. */
  snoozed: number[];
  budgetSnoozed: boolean;
  /** Dewan votes you've seen the alert for. */
  voteSeen: number[];
  seeVote: (id: number) => void;
  lang: "en" | "ms";
  sound: boolean;
  /** Play-test tools in the ⋯ menu. */
  testTools: boolean;
  setTestTools: (on: boolean) => void;
  test: (kind: "ge" | "sitting" | "boost") => void;
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
  nominate: (seat: number, person: number | "newface" | "local") => void;
  pact: (c: CoalitionId, on: boolean) => void;
  order: (id: string, target: Target) => void;
  dewan: (motionId: number, move: PrepMove) => void;
  tableMotion: () => void;
  deep: (op: DeepOp) => void;
  money: (
    op:
      | { kind: "buy"; ticker: string; n: number }
      | { kind: "sell"; ticker: string; n: number }
      | { kind: "order"; ticker: string; order: StockOrder["kind"]; trigger: number; shares: number }
      | { kind: "cancel"; id: number }
      | { kind: "buyProp"; id: string; units: number; owner: Owner; ltv: number }
      | { kind: "sellProp"; index: number }
      | { kind: "payoff"; index: number }
      | { kind: "donate"; amount: number }
      | { kind: "declare" }
      | { kind: "payTeam"; on: boolean },
  ) => void;
  lever: (l: { kind: "pay"; stance: "freeze" | "normal" | "raise" } | { kind: "stimulus" } | { kind: "project"; id: string }) => void;
  hireStaff: (id: number) => void;
  fireStaff: (id: number) => void;
  raiseStaff: (id: number) => void;
  delegate: (id: number, auto: boolean) => void;
  headhunt: () => void;
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
  back: (leader: CoalitionId, askDpm: boolean | "pm") => void;
  agong: () => void;
  endNight: () => void;
  load: (game: GameState) => void;
  notify: (text: string, error?: boolean) => void;
  select: (seatIndex: number | null) => void;
  /** A seat clicked on the map: select it and open the action popover where you clicked. */
  pick: (seatIndex: number, x: number, y: number) => void;
  /** Open a panel (no toggling): sub-tabs switch with this. */
  showPanel: (panel: Panel) => void;
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
        popAt: null,
        recordOpen: false,
        analysisOpen: false,
        setAnalysisOpen: (analysisOpen) => set({ analysisOpen }),
        setRecordOpen: (recordOpen) => set({ recordOpen }),
        mapFocus: null,
        toast: null,
        floater: null,
        reportOpen: false,
        snoozed: [],
        budgetSnoozed: false,
        voteSeen: [],
        seeVote: (id) => set({ voteSeen: [...get().voteSeen.slice(-40), id] }),
        lang: "en",
        sound: false,
        testTools: false,
        setTestTools: (testTools) => set({ testTools }),
        test: (kind) => {
          const g = get().game;
          if (!g || !get().testTools) return;
          if (kind === "ge") {
            if (g.night || g.formation) return set({ toast: { id: ++toastId, text: BLOCKED, error: true } });
            set({ game: testGeneralElection(g), reportOpen: false, panel: null });
          } else if (kind === "sitting") {
            const r = testSitting(g);
            set({ game: r.state, panel: "parliament", toast: { id: ++toastId, text: r.lines[0]?.text ?? "The Dewan votes." } });
          }
          else set({ game: testBoost(g), toast: { id: ++toastId, text: "+10 AP, +RM 10M." } });
        },
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
          if (g) moved(advanceTurn(g));
        },
        skipMonth: () => {
          const g = get().game;
          if (g?.night || g?.formation) return set({ toast: { id: ++toastId, text: BLOCKED, error: true } });
          if (g) moved(advanceWeeks(g, 4, true));
        },
        skipToEvent: () => {
          let g = get().game;
          if (!g) return;
          if (g.night || g.formation) return set({ toast: { id: ++toastId, text: BLOCKED, error: true } });
          const start = g.week;
          // Up to 12 weeks (six turns), stopping at anything that needs you.
          for (let i = 0; i < 6; i++) {
            g = advanceTurn(g);
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
        delegate: (id, auto) => {
          const g = get().game;
          if (g) result(delegateStaff(g, id, auto));
        },
        headhunt: () => {
          const g = get().game;
          if (g) result(headhuntStaff(g));
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
        money: (op) => {
          const g = get().game;
          if (!g) return;
          const run = () => {
            switch (op.kind) {
              case "buy":
                return buyShares(g, op.ticker, op.n);
              case "sell":
                return sellShares(g, op.ticker, op.n);
              case "order":
                return placeOrder(g, op.ticker, op.order, op.trigger, op.shares);
              case "cancel":
                return cancelOrder(g, op.id);
              case "buyProp":
                return buyProperty(g, op.id, op.units, op.owner, op.ltv);
              case "sellProp":
                return sellProperty(g, op.index);
              case "payoff":
                return payOffLoan(g, op.index);
              case "donate":
                return donate(g, op.amount);
              case "declare":
                return declareAssets(g);
              case "payTeam":
                return setPayTeam(g, op.on);
            }
          };
          const r = run();
          result(r);
        },
        dewan: (motionId, move) => {
          const g = get().game;
          if (g) result(dewanPrep(g, motionId, move));
        },
        deep: (op) => {
          const g = get().game;
          if (g) result(deepMove(g, op));
        },
        tableMotion: () => {
          const g = get().game;
          if (g) result(dewanTable(g));
        },
        order: (id, target) => {
          const g = get().game;
          if (!g) return;
          const r = toggleOrder(g, id, target);
          result("error" in r ? { ok: false, error: r.error } : { ok: true, state: r.state, message: r.message });
        },
        pact: (c, on) => {
          const g = get().game;
          if (g) result(on ? makePact(g, c) : breakPact(g, c));
        },
        nominate: (seat, person) => {
          const g = get().game;
          if (g) result(nominateCandidate(g, seat, person));
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
          if (g) set({ game: closeNight(g), analysisOpen: !!g.lastAnalysis && g.lastAnalysis.week === g.night?.week });
        },
        load: (game) => set({ game, selected: null, reportOpen: false, panel: null, snoozed: [], toast: { id: ++toastId, text: "Game loaded." }, mapFocus: { kind: "reset", nonce: ++nonce } }),
        notify: (text, error) => set({ toast: { id: ++toastId, text, error } }),
        select: (selected) => set({ selected, popAt: null }),
        pick: (i, x, y) => set({ selected: i, popAt: { x, y } }),
        // A seat popover that was open by the click point moves aside (docked right) so the panel doesn't sit under it.
        showPanel: (panel) => set({ panel, popAt: null }),
        focusSeat: (i) => set({ selected: i, popAt: null, mapFocus: { kind: "seat", index: i, nonce: ++nonce }, panel: typeof window !== "undefined" && window.innerWidth < 900 ? null : get().panel }),
        focusState: (id) => set({ mapFocus: { kind: "state", id, nonce: ++nonce } }),
        setLens: (lens) => set({ lens }),
        openPanel: (panel) => set({ panel: get().panel === panel ? null : panel, popAt: null }),
        closeReport: () => set({ reportOpen: false }),
        clearToast: () => set({ toast: null }),
      };
    },
    {
      name: "mpr-save",
      version: SAVE_VERSION,
      storage: safeStorage,
      partialize: (s) => ({ game: s.game, lens: s.lens, lang: s.lang, sound: s.sound, testTools: s.testTools }),
      // Saves from before the turn loop can't be upgraded: start fresh.
      migrate: (persisted, version) => (version < 2 ? { game: null, lens: "holder" } : persisted) as Store,
      // Every load fills fields added since the save was made (safe to repeat).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return { ...current, game: p.game ? migrateGame(p.game) : null, lens: p.lens ?? current.lens, lang: p.lang ?? current.lang, sound: p.sound ?? current.sound, testTools: p.testTools ?? current.testTools };
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
