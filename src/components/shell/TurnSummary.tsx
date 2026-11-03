"use client";

import { useState } from "react";
import { weekLabel } from "@/game/state";
import { useGame } from "@/store/gameStore";
import { fmtRM } from "../common";
import { ReportBody } from "./WeekReview";

/** After the turn: how it went, in a glance. The full report is one click away. */
export function TurnSummary() {
  const game = useGame((s) => s.game)!;
  const { closeReport } = useGame();
  const [full, setFull] = useState(false);
  const r = game.report!;
  const weeks = r.weeks ?? 1;
  const delta = r.seatsAfter - r.seatsBefore;
  const cash = r.income.reduce((a, l) => a + l.amount, 0) - r.expenses.reduce((a, l) => a + l.amount, 0);
  const momentum = Math.round(game.me.momentum ?? 0);
  const fresh = game.cards.filter((c) => c.week === game.week).length;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Turn summary" onClick={closeReport}>
      <div className="modal-card pop-in w-full max-w-lg flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="eyebrow">{weeks >= 4 ? "The month" : weeks === 2 ? "The fortnight" : "The week"} to {weekLabel(game.week)}</div>
          <h2 className="text-2xl">How it went</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Figure label="Seats if held today" value={`${r.seatsAfter}`} delta={delta} />
          <Figure label="Cash" value={fmtRM(cash)} tone={cash >= 0 ? "var(--good)" : "var(--bad)"} />
          <Figure label="Momentum" value={`${momentum}`} tone={momentum >= 40 ? "var(--brass-hi)" : undefined} />
        </div>
        <div className="brass-rule" />
        <ReportBody report={r} limit={full ? undefined : 5} figures={false} />
        {fresh > 0 && (
          <p className="text-xs" style={{ color: "var(--brass-hi)" }}>
            {fresh === 1 ? "A decision is" : `${fresh} decisions are`} waiting on your docket.
          </p>
        )}
        <div className="flex gap-2 justify-end">
          {!full && r.lines.length > 5 && (
            <button className="btn btn-ghost" onClick={() => setFull(true)}>
              Full report
            </button>
          )}
          <button className="btn" onClick={closeReport} autoFocus>
            To the docket
          </button>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, delta, tone }: { label: string; value: string; delta?: number; tone?: string }) {
  return (
    <div className="inset p-2">
      <div className="dossier-title text-2xl num" style={tone ? { color: tone } : undefined}>
        {value}
        {delta ? (
          <span className="text-sm ml-1" style={{ color: delta > 0 ? "var(--good)" : "var(--bad)" }}>
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        ) : null}
      </div>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}
