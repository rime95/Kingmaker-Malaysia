"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { COALITIONS } from "@/game/world";
import { useGame } from "@/store/gameStore";
import { NewGame } from "./NewGame";
import { Toast } from "./Toast";
import { ElectionNight } from "./ElectionNight";
import { SaveSlots } from "./SaveSlots";
import { MainMap } from "./shell/MainMap";
import { TopBar } from "./shell/TopBar";
import { NavRail, openSection } from "./shell/NavRail";
import { SECTIONS } from "./shell/sections";
import { SeatPopover } from "./shell/SeatPopover";
import { RecordModal } from "./RecordModal";
import { ElectionAnalysisModal } from "./ElectionAnalysis";
import { LensBar } from "./shell/LensBar";
import { SidePanel } from "./shell/SidePanel";
import { NewsTicker } from "./shell/NewsTicker";
import { WeekReview } from "./shell/WeekReview";
import { AlertModal } from "./shell/AlertModal";
import { NameCoalition } from "./shell/NameCoalition";
import { PartyRaceCount } from "./PartyRace";
import { useSoundtrack } from "./SoundControls";

const noop = () => () => {};

export function Game() {
  // Saves load from browser storage, so render only after mounting (no hydration mismatch).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const game = useGame((s) => s.game);
  useSoundtrack(!game ? "title" : game.night ? "night" : "campaign");
  if (!mounted) return null;
  return game ? <Main /> : <NewGame />;
}

/**
 * Map-first layout: the map fills the screen; the status bar, navigation, panels, seat card and news ticker float over it.
 * Phones: navigation moves to the bottom, panels and the seat card become sheets.
 */
function Main() {
  const { panel, selected } = useGame();
  const game = useGame((s) => s.game)!;
  const [savesOpen, setSavesOpen] = useState(false);
  // Keyboard: N or Space for the next turn, 1–6 for the sections (not while typing or a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(el.tagName) || document.querySelector("[role=dialog]")) return;
      const st = useGame.getState();
      if (e.key === "n" || e.key === "N" || (e.key === " " && el.tagName !== "BUTTON")) {
        e.preventDefault();
        st.skipWeek();
      } else if (/^[1-6]$/.test(e.key)) openSection(SECTIONS[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Coalition colours can change (a winner rebrands): feed them to the CSS variables every view uses.
  const coalitions = game.coalitions;
  useEffect(() => {
    const root = document.documentElement;
    for (const c of COALITIONS) root.style.setProperty(`--c-${c}`, coalitions[c].color);
    return () => {
      for (const c of COALITIONS) root.style.removeProperty(`--c-${c}`);
    };
  }, [coalitions]);

  return (
    <div className="fixed inset-0 overflow-hidden main-map">
      <MainMap />

      <div className="absolute inset-x-3 top-3 z-30">
        <TopBar onSaves={() => setSavesOpen(true)} />
      </div>

      <div className="hidden md:flex absolute left-3 top-[88px] bottom-[72px] z-20 flex-col justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <NavRail />
        </div>
      </div>

      {!panel && (
        <div className="absolute left-3 md:left-[92px] top-[88px] z-10 max-w-[calc(100%-24px)] md:max-w-[620px]">
          <LensBar />
        </div>
      )}

      {panel && (
        <div className="absolute inset-x-3 md:right-auto md:left-[92px] top-[88px] bottom-[128px] md:bottom-[72px] z-30 flex">
          <SidePanel />
        </div>
      )}

      {selected !== null && panel !== "seat" && <SeatPopover />}

      {!panel && selected === null && (
        <div className="absolute left-3 md:left-[92px] bottom-[128px] md:bottom-[72px] z-20 max-h-[50vh] flex">
          <WeekReview />
        </div>
      )}

      <div className="md:hidden absolute inset-x-3 bottom-[64px] z-30">
        <NavRail />
      </div>
      <div className="absolute inset-x-3 bottom-3 z-20">
        <NewsTicker />
      </div>

      {savesOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgb(5 7 14 / 0.6)" }} onClick={() => setSavesOpen(false)}>
          <div className="w-full max-w-xl mt-16" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Saved games">
            <SaveSlots onDone={() => setSavesOpen(false)} />
            <button className="btn btn-ghost mt-2" onClick={() => setSavesOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      <AlertModal />
      <RecordModal />
      {!game.night && <ElectionAnalysisModal />}
      {!game.night && <PartyRaceCount />}
      {game.namePending && !game.night && !game.formation && <NameCoalition />}
      <ElectionNight />
      <Toast />
    </div>
  );
}
