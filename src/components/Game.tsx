"use client";

import { useSyncExternalStore } from "react";
import { useGame, type View } from "@/store/gameStore";
import { AUTO_DISSOLUTION } from "@/game/config";
import { weekDate, weekLabel } from "@/game/state";
import { COALITION_INFO } from "@/game/world";
import { NewGame } from "./NewGame";
import { SeatBars } from "./SeatBars";
import { SeatMap } from "./SeatMap";
import { SeatPanel } from "./SeatPanel";
import { Dewan } from "./Dewan";
import { Overview } from "./Overview";
import { Treasury } from "./Treasury";
import { Policy } from "./Policy";
import { ReportModal } from "./ReportModal";
import { Toast } from "./Toast";
import { CoalitionChip, fmtRM } from "./common";

const noop = () => () => {};

export function Game() {
  // Saves load from browser storage, so render only after mounting (no hydration mismatch).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const game = useGame((s) => s.game);
  if (!mounted) return null;
  return game ? <Main /> : <NewGame />;
}

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "map", label: "Seat map" },
  { id: "dewan", label: "Dewan Rakyat" },
  { id: "policy", label: "Policy & Budget" },
  { id: "treasury", label: "Treasury" },
];

function Main() {
  const { game, view, setView, simulate, quit, skipWeek, skipMonth } = useGame();
  if (!game) return null;
  const info = COALITION_INFO[game.player];
  const weeksLeft = Math.max(0, Math.round((new Date(`${AUTO_DISSOLUTION}T00:00:00`).getTime() - weekDate(game.week).getTime()) / (7 * 86400000)));
  const me = game.me;
  const needs = game.cards.length + (game.budgetDue !== null ? 1 : 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-bold tracking-tight">Malam Pilihan Raya</h1>
        <span className="chip" style={{ cursor: "default" }}>
          <CoalitionChip c={game.player} /> · {info.inGovernment ? "Government" : "Opposition"}
        </span>
        <span className="text-sm tabular-nums" style={{ color: "var(--ink-2)" }}>
          Week {game.week + 1} · {weekLabel(game.week)}
          <span style={{ color: "var(--muted)" }}> · Parliament dissolves in {weeksLeft} weeks</span>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={simulate} title="Runs a test general election from today's support. Seats do not change hands.">
            Test election
          </button>
          <button className="btn btn-ghost" onClick={() => confirm("Start a new game? This one will be lost.") && quit()}>
            New game
          </button>
        </div>
      </header>

      <div className="panel px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            War chest
          </div>
          <div className="font-bold tabular-nums" style={{ color: me.funds < 0 ? "var(--bad)" : "var(--ink)" }}>
            {fmtRM(me.funds)}
          </div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            Action points
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
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={skipWeek}>
            Skip 1 week
          </button>
          <button className="btn btn-ghost" onClick={skipMonth}>
            Skip 1 month
          </button>
        </div>
      </div>

      <SeatBars />

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="chip" aria-selected={view === t.id} data-on={view === t.id} onClick={() => setView(t.id)}>
            {t.label}
            {t.id === "overview" && needs > 0 && (
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
      {(view === "map" || view === "dewan") && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="panel p-3 w-full lg:flex-1 min-w-0">{view === "map" ? <SeatMap /> : <Dewan />}</div>
          <div className="w-full lg:w-[360px] flex-none">
            <SeatPanel />
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Seats as won at GE15 (Nov 2022); later by-elections and defections are not modelled yet. Seat demographics are estimates. Real
        parties and leaders are used for flavour; every result and event in the game is simulated.
      </p>
      <ReportModal />
      <Toast />
    </div>
  );
}
