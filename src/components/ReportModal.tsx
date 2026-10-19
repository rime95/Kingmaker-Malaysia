"use client";

import { useGame } from "@/store/gameStore";
import { weekLabel, type WeekReport } from "@/game/state";
import { SEATS } from "@/game/world";
import { fmtRM } from "./common";

const TONE = { good: "var(--good)", bad: "var(--bad)", info: "var(--ink-2)" } as const;

export function ReportBody({ report }: { report: WeekReport }) {
  const select = useGame((s) => s.select);
  const setView = useGame((s) => s.setView);
  const totalIn = report.income.reduce((a, l) => a + l.amount, 0);
  const totalOut = report.expenses.reduce((a, l) => a + l.amount, 0);
  const lines = report.lines.length ? report.lines : [{ text: "A quiet week.", tone: "info" as const }];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span>
          Seats if held today: <b className="tabular-nums">{report.seatsBefore}</b> → <b className="tabular-nums">{report.seatsAfter}</b>
        </span>
        <span>
          Cash flow: <b className="tabular-nums">{fmtRM(totalIn - totalOut)}</b>{" "}
          <span style={{ color: "var(--muted)" }}>
            ({fmtRM(totalIn)} in, {fmtRM(totalOut)} out)
          </span>
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden style={{ color: TONE[l.tone ?? "info"] }}>
              {l.tone === "good" ? "▲" : l.tone === "bad" ? "▼" : "•"}
            </span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      {report.movers.length > 0 && (
        <div>
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Biggest moves in your vote share
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.movers.map((m) => (
              <button
                key={m.seatIndex}
                className="chip"
                onClick={() => {
                  select(m.seatIndex);
                  setView("map");
                }}
              >
                {SEATS[m.seatIndex].name}
                <span className="tabular-nums" style={{ color: m.delta >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {m.delta >= 0 ? "▲" : "▼"} {Math.abs(m.delta * 100).toFixed(1)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportModal() {
  const { game, reportOpen, closeReport } = useGame();
  if (!game?.report || !reportOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgb(0 0 0 / 0.45)" }} onClick={closeReport}>
      <div className="panel p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Weekly report">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-bold">{game.report.weeks === 4 ? "Monthly report" : "Weekly report"}</h2>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            to {weekLabel(game.week)}
          </span>
        </div>
        <ReportBody report={game.report} />
        <div className="flex justify-end mt-4">
          <button className="btn" onClick={closeReport} autoFocus>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
