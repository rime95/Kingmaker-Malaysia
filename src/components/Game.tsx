"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COALITIONS } from "@/game/world";
import { useGame } from "@/store/gameStore";
import { NewGame } from "./NewGame";
import { Toast } from "./Toast";
import { ElectionNight } from "./ElectionNight";
import { NewTerm } from "./NewTerm";
import { Legacy } from "./Legacy";
import { StateNight } from "./StateNight";
import { StateTalksScreen, StateTerm } from "./StateTerm";
import { activeOverlay, blocking } from "./overlays";
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
import { Docket } from "./shell/Docket";
import { Timeline } from "./shell/Timeline";
import { TurnSummary } from "./shell/TurnSummary";
import { AlertModal } from "./shell/AlertModal";
import { NameCoalition } from "./shell/NameCoalition";
import { PartyRaceCount } from "./PartyRace";
import { PartyPollsResult } from "./panels/Council";
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
  const { panel, selected, analysisOpen, recordOpen, reportOpen, summaryOn, skipSummary } = useGame();
  const game = useGame((s) => s.game)!;
  const [savesOpen, setSavesOpen] = useState(false);
  const [docketOpen, setDocketOpen] = useState(false);
  const overlay = activeOverlay(game, { savesOpen, recordOpen, analysisOpen, summary: reportOpen && (summaryOn || skipSummary) && !game.night });
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);
  // Keyboard: N or Space ends the turn, 1–4 open the hubs (not while typing or a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(el.tagName) || blocking(overlayRef.current) || document.querySelector("[role=dialog]")) return;
      const st = useGame.getState();
      if (e.key === "n" || e.key === "N" || (e.key === " " && el.tagName !== "BUTTON")) {
        e.preventDefault();
        st.skipWeek();
      } else if (/^[1-4]$/.test(e.key)) openSection(SECTIONS[Number(e.key) - 1]);
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
    <div className="fixed inset-0 overflow-hidden main-map war-room">
      <MainMap />

      {/* Command bar and the timeline of what is coming */}
      <div className="absolute inset-x-3 top-3 z-30 flex flex-col gap-1.5">
        <TopBar onSaves={() => setSavesOpen(true)} onDocket={() => setDocketOpen(true)} />
        <div className="timeline-bar panel px-3 py-1.5">
          <Timeline />
        </div>
      </div>

      {/* The command rail */}
      <div className="hidden md:flex absolute left-3 top-[132px] bottom-[64px] z-20 flex-col pointer-events-none">
        <div className="pointer-events-auto">
          <NavRail />
        </div>
      </div>

      {/* The open hub, as a dossier over the map */}
      {panel && (
        <div className="absolute inset-x-3 md:right-auto md:left-[100px] top-[132px] bottom-[128px] md:bottom-[64px] z-30 flex">
          <SidePanel />
        </div>
      )}

      {/* Map view and legend */}
      {!panel && (
        <div className="absolute left-3 md:left-[100px] bottom-[128px] md:bottom-[64px] z-10 max-w-[calc(100%-24px)] md:max-w-[560px]">
          <LensBar />
        </div>
      )}

      {selected !== null && panel !== "seat" && <SeatPopover />}

      {/* The docket: a column on wide screens, a sheet on narrow ones */}
      <div className="hidden lg:flex absolute right-3 top-[132px] bottom-[64px] z-20 w-[312px]">
        <Docket />
      </div>
      {docketOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex justify-end" style={{ background: "rgb(4 8 16 / 0.6)" }} onClick={() => setDocketOpen(false)}>
          <div className="h-full w-full max-w-[380px] p-3 slide-in" onClick={(e) => e.stopPropagation()}>
            <Docket compact />
          </div>
        </div>
      )}

      <div className="md:hidden absolute inset-x-3 bottom-[60px] z-30">
        <NavRail />
      </div>
      <div className="absolute inset-x-3 bottom-3 z-20">
        <NewsTicker />
      </div>

      {overlay === "saves" && (
        <div className="modal-backdrop modal-top" onClick={() => setSavesOpen(false)}>
          <div className="w-full max-w-xl mt-16" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Saved games">
            <SaveSlots onDone={() => setSavesOpen(false)} />
            <button className="btn btn-ghost mt-2" onClick={() => setSavesOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      {overlay === "alert" && <AlertModal />}
      {overlay === "record" && <RecordModal />}
      {overlay === "analysis" && <ElectionAnalysisModal />}
      {overlay === "race" && <PartyRaceCount />}
      {overlay === "polls" && <PartyPollsResult />}
      {overlay === "summary" && <TurnSummary />}
      {overlay === "newterm" && <NewTerm />}
      {overlay === "statenight" && <StateNight />}
      {overlay === "statetalks" && <StateTalksScreen />}
      {overlay === "stateterm" && <StateTerm />}
      {overlay === "naming" && <NameCoalition />}
      {overlay === "legacy" && <Legacy />}
      {overlay === "night" && <ElectionNight />}
      <Toast />
    </div>
  );
}
