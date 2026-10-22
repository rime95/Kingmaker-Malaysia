"use client";

import { weekLabel, type WeekReport } from "@/game/state";
import { useGame } from "@/store/gameStore";
import { SEATS } from "@/game/world";
import { fmtRM } from "../common";
import { Icon } from "./icons";

const TONE = { good: "var(--good)", bad: "var(--bad)", info: "var(--ink-2)" } as const;

export function ReportBody({ report, limit }: { report: WeekReport; limit?: number }) {
  const focusSeat = useGame((s) => s.focusSeat);
  const totalIn = report.income.reduce((a, l) => a + l.amount, 0);
  const totalOut = report.expenses.reduce((a, l) => a + l.amount, 0);
  const all = report.lines.length ? report.lines : [{ text: "A quiet week.", tone: "info" as const }];
  // Bad news first, then good, then the rest.
  const order = { bad: 0, good: 1, info: 2 } as const;
  const lines = [...all].sort((a, b) => order[a.tone ?? "info"] - order[b.tone ?? "info"]).slice(0, limit ?? all.length);
  const delta = report.seatsAfter - report.seatsBefore;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="inset p-2.5">
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            Seats if held today
          </div>
          <div className="font-bold tabular-nums">
            {report.seatsAfter}{" "}
            {delta !== 0 && (
              <span className="text-xs" style={{ color: delta > 0 ? "var(--good)" : "var(--bad)" }}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
              </span>
            )}
          </div>
        </div>
        <div className="inset p-2.5">
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            Cash flow
          </div>
          <div className="font-bold tabular-nums">{fmtRM(totalIn - totalOut)}</div>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden style={{ color: TONE[l.tone ?? "info"] }}>
              {l.tone === "good" ? "▲" : l.tone === "bad" ? "▼" : "•"}
            </span>
            <span>{l.text}</span>
          </li>
        ))}
        {limit && all.length > limit && (
          <li className="text-xs" style={{ color: "var(--muted)" }}>
            and {all.length - limit} more in the news ticker.
          </li>
        )}
      </ul>
      {report.movers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {report.movers.map((m) => (
            <button key={m.seatIndex} className="chip" onClick={() => focusSeat(m.seatIndex)}>
              {SEATS[m.seatIndex].name}
              <span className="tabular-nums" style={{ color: m.delta >= 0 ? "var(--good)" : "var(--bad)" }}>
                {m.delta >= 0 ? "▲" : "▼"} {Math.abs(m.delta * 100).toFixed(1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A compact summary card after time moves on. */
export function WeekReview() {
  const { game, reportOpen, closeReport } = useGame();
  if (!game?.report || !reportOpen || game.night) return null;
  return (
    <section className="panel pop-in p-4 w-full md:w-[380px] max-h-full overflow-y-auto scroll-thin" aria-label="Week in review">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <div className="eyebrow">{(game.report.weeks ?? 1) >= 4 ? "Month in review" : (game.report.weeks ?? 1) === 2 ? "Fortnight in review" : "Week in review"}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            to {weekLabel(game.week)}
          </div>
        </div>
        <button className="chip !p-2" onClick={closeReport} aria-label="Close">
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>
      <ReportBody report={game.report} limit={6} />
    </section>
  );
}
