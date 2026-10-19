"use client";

import { useState, useSyncExternalStore } from "react";
import { useGame, type View } from "@/store/gameStore";
import { campaignStates, weeksToElection } from "@/game/systems/assemblies";
import { isGovernment, weekLabel } from "@/game/state";
import { careerTitle } from "@/game/progress";
import { STATE_BY_ID } from "@/game/world";
import { NewGame } from "./NewGame";
import { SeatBars } from "./SeatBars";
import { SeatMap } from "./SeatMap";
import { SeatPanel } from "./SeatPanel";
import { Dewan } from "./Dewan";
import { Overview } from "./Overview";
import { Treasury } from "./Treasury";
import { Policy } from "./Policy";
import { Rivals } from "./Rivals";
import { States } from "./States";
import { Career } from "./Career";
import { ReportModal } from "./ReportModal";
import { Toast } from "./Toast";
import { ElectionNight } from "./ElectionNight";
import { SaveSlots } from "./SaveSlots";
import { useT, type StringKey } from "./i18n";
import { CoalitionChip, fmtRM } from "./common";

const noop = () => () => {};

export function Game() {
  // Saves load from browser storage, so render only after mounting (no hydration mismatch).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const game = useGame((s) => s.game);
  if (!mounted) return null;
  return game ? <Main /> : <NewGame />;
}

const TABS: View[] = ["overview", "career", "map", "dewan", "states", "policy", "rivals", "treasury"];

function Main() {
  const { game, view, setView, simulate, quit, skipWeek, skipMonth, skipToEvent, lang, setLang } = useGame();
  const t = useT();
  const [savesOpen, setSavesOpen] = useState(false);
  if (!game) return null;
  const toPoll = weeksToElection(game);
  const campaigns = campaignStates(game).map((id) => STATE_BY_ID[id].name);
  const me = game.me;
  const needs = game.cards.length + (game.budgetDue !== null ? 1 : 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-bold tracking-tight">Malam Pilihan Raya</h1>
        <span className="chip" style={{ cursor: "default" }}>
          <CoalitionChip c={game.player} /> · {isGovernment(game) ? t("government") : t("opposition")} · {game.career.name}, {careerTitle(game)}
        </span>
        <span className="text-sm tabular-nums" style={{ color: "var(--ink-2)" }}>
          Week {game.week + 1} · {weekLabel(game.week)}
          <span style={{ color: game.parliament.status === "campaign" ? "var(--bad)" : "var(--muted)" }}>
            {game.parliament.status === "campaign" ? ` · GE polling day in ${toPoll} week${toPoll === 1 ? "" : "s"}` : ` · GE due in about ${toPoll} weeks`}
          </span>
          {campaigns.length > 0 && <span style={{ color: "var(--muted)" }}> · State elections: {campaigns.join(", ")}</span>}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="chip" onClick={() => setLang(lang === "en" ? "ms" : "en")} title="Bahasa Malaysia / English">
            {lang === "en" ? "BM" : "EN"}
          </button>
          <button className="btn btn-ghost" onClick={simulate} title="Runs a test general election from today's support. Seats do not change hands.">
            {t("testElection")}
          </button>
          <button className="btn btn-ghost" onClick={() => setSavesOpen(true)}>
            {t("saves")}
          </button>
          <button className="btn btn-ghost" onClick={() => confirm("Start a new game? Save this one first if you want to keep it.") && quit()}>
            {t("newGame")}
          </button>
        </div>
      </header>

      <div className="panel px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {t("warChest")}
          </div>
          <div className="font-bold tabular-nums" style={{ color: me.funds < 0 ? "var(--bad)" : "var(--ink)" }}>
            {fmtRM(me.funds)}
          </div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {t("ap")}
          </div>
          <div className="flex gap-1 mt-1" aria-label={`${me.ap} of ${me.apMax} action points left`}>
            {Array.from({ length: me.apMax }, (_, i) => (
              <span key={i} className="w-3.5 h-3.5 rounded-full border" style={{ borderColor: "var(--ink-2)", background: i < me.ap ? "var(--ink)" : "transparent" }} />
            ))}
          </div>
        </div>
        <div className="text-xs max-w-[340px]" style={{ color: "var(--ink-2)" }}>
          {me.ap > 0 ? `${me.ap} AP left this week. Unused AP is lost when the week ends.` : "No AP left. End the week to continue."}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn" onClick={skipWeek}>
            {t("skipWeek")}
          </button>
          <button className="btn btn-ghost" onClick={skipMonth}>
            {t("skipMonth")}
          </button>
          <button className="btn btn-ghost" onClick={skipToEvent} title="Skips up to 12 weeks, stopping at anything that needs you.">
            {t("skipEvent")}
          </button>
        </div>
      </div>

      <SeatBars />

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((id) => (
          <button key={id} role="tab" className="chip" aria-selected={view === id} data-on={view === id} onClick={() => setView(id)}>
            {t(id as StringKey)}
            {id === "overview" && needs > 0 && (
              <span className="ml-1 rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--accent)", color: "#fff" }} aria-label={`${needs} decisions waiting`}>
                {needs}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "overview" && <Overview />}
      {view === "treasury" && <Treasury />}
      {view === "policy" && <Policy />}
      {view === "rivals" && <Rivals />}
      {view === "states" && <States />}
      {view === "career" && <Career />}
      {(view === "map" || view === "dewan") && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="panel p-3 w-full lg:flex-1 min-w-0">{view === "map" ? <SeatMap /> : <Dewan />}</div>
          <div className="w-full lg:w-[360px] flex-none">
            <SeatPanel />
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Seats start as won at GE15 (Nov 2022); state assemblies start from approximate real splits. Seat demographics are estimates. Real
        parties and leaders are used for flavour; every result and event in the game is simulated.
      </p>
      {savesOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgb(0 0 0 / 0.45)" }} onClick={() => setSavesOpen(false)}>
          <div className="w-full max-w-xl mt-10" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Saved games">
            <SaveSlots onDone={() => setSavesOpen(false)} />
            <button className="btn mt-2" onClick={() => setSavesOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      {!game.night && <ReportModal />}
      <ElectionNight />
      <Toast />
    </div>
  );
}
