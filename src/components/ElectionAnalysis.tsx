"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Analysis, SeatNote } from "@/game/systems/analysis";
import { useGame } from "@/store/gameStore";
import { cshort, SEATS, STATE_BY_ID } from "@/game/world";
import { coalColor, pct } from "./common";

const signed = (v: number, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(digits)}`;

/** The morning after: shown once Election Night and the talks are over, and kept under Parliament → Last election. */
export function ElectionAnalysisModal() {
  const open = useGame((s) => s.analysisOpen);
  const set = useGame((s) => s.setAnalysisOpen);
  const a = useGame((s) => s.game?.lastAnalysis);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && set(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, set]);
  if (!open || !a) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgb(5 7 14 / 0.65)" }} onClick={() => set(false)}>
      <div className="panel w-full max-w-5xl my-8 p-5 @container" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Election analysis">
        <AnalysisBody a={a} onDone={() => set(false)} />
      </div>
    </div>,
    document.body,
  );
}

/** Everything about the last general election: the headline, the pundits, the seats, the groups and the states. */
export function AnalysisBody({ a, onDone }: { a: Analysis; onDone?: () => void }) {
  const { focusSeat, setLens } = useGame();
  const go = (i: number) => {
    onDone?.();
    focusSeat(i);
  };
  const d = a.seats.after - a.seats.before;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="eyebrow">{a.label} · the morning after</div>
          <h2 className="text-2xl font-black leading-tight">
            <span style={{ color: coalColor(a.player) }}>{cshort(a.player)}</span> {d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : "holds"}: {a.seats.after} seats
          </h2>
        </div>
        <button
          className="chip"
          onClick={() => {
            setLens("swing");
            onDone?.();
          }}
        >
          Show the swing on the map
        </button>
        {onDone && (
          <button className="btn" onClick={onDone}>
            Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 @2xl:grid-cols-5 gap-2">
        <Tile label="Seats" value={`${a.seats.before} → ${a.seats.after}`} delta={d ? `${d > 0 ? "+" : "−"}${Math.abs(d)}` : "no change"} good={d >= 0} />
        <Tile label="Your national vote" value={pct(a.vote.after, 1)} delta={`${signed(a.vote.after - a.vote.before)} pts`} good={a.vote.after >= a.vote.before} />
        <Tile label="vs the final poll" value={a.seats.polled === null ? "—" : `${a.seats.polled} seats`} delta={a.seats.polled === null ? "" : `${a.seats.after - a.seats.polled >= 0 ? "+" : "−"}${Math.abs(a.seats.after - a.seats.polled)} on the night`} good={a.seats.polled === null || a.seats.after >= a.seats.polled} />
        <Tile label="vs the projection" value={`${a.seats.projected} seats`} delta={`${a.seats.after - a.seats.projected >= 0 ? "+" : "−"}${Math.abs(a.seats.after - a.seats.projected)} luck on the day`} good={a.seats.after >= a.seats.projected} />
        <Tile label="Turnout" value={pct(a.turnout)} delta={`${a.deposits.length} deposit${a.deposits.length === 1 ? "" : "s"} lost`} good={!a.deposits.length} />
      </div>

      <section className="inset p-3">
        <h3 className="eyebrow mb-1.5">What the pundits say</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {a.pundits.map((p, k) => (
            <li key={k}>“{p}”</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 @2xl:grid-cols-2">
        <SeatList title={`Gains (${a.gains.length})`} hint="Seats you took, and what did it." notes={a.gains} go={go} />
        <SeatList title={`Losses (${a.losses.length})`} hint="Seats you held and lost." notes={a.losses} go={go} />
        <SeatList title="Near misses" hint="Lost by under 5 points: how many votes you were short." notes={a.nearMisses} go={go} />
        <SeatList title="Best swings" hint="Where your vote grew most." notes={a.best} go={go} />
      </div>

      <div className="grid gap-4 @2xl:grid-cols-2">
        <section>
          <h3 className="eyebrow mb-1">Who voted for you (estimate)</h3>
          <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
            Your share among each group, from where they live. Faded bar: last time.
          </p>
          <div className="flex flex-col gap-1.5">
            {a.groups.map((g) => (
              <div key={g.group} className="grid grid-cols-[120px_minmax(0,1fr)_64px] items-center gap-2 text-xs">
                <span className="truncate" style={{ color: "var(--ink-2)" }}>
                  {g.group}
                </span>
                <span className="relative h-3 rounded" style={{ background: "var(--surface-2)" }}>
                  <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, g.before * 100 * 1.4)}%`, background: coalColor(a.player), opacity: 0.3 }} />
                  <span className="absolute left-0 rounded" style={{ top: 3, bottom: 3, width: `${Math.min(100, g.after * 100 * 1.4)}%`, background: coalColor(a.player) }} />
                </span>
                <span className="tabular-nums text-right">
                  {pct(g.after)} <span style={{ color: g.after >= g.before ? "var(--good)" : "var(--bad)" }}>{signed(g.after - g.before, 0)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="eyebrow mb-2">State by state</h3>
          <div className="grid grid-cols-[minmax(0,1fr)_70px_70px] gap-x-2 gap-y-1 text-xs">
            <span style={{ color: "var(--muted)" }}>State</span>
            <span className="text-right" style={{ color: "var(--muted)" }}>
              Seats
            </span>
            <span className="text-right" style={{ color: "var(--muted)" }}>
              Vote swing
            </span>
            {a.states.map((s) => (
              <div key={s.state} className="contents">
                <span className="truncate">{s.name}</span>
                <span className="text-right tabular-nums">
                  {s.before} → <b style={{ color: s.after > s.before ? "var(--good)" : s.after < s.before ? "var(--bad)" : undefined }}>{s.after}</b>
                </span>
                <span className="text-right tabular-nums" style={{ color: s.voteAfter >= s.voteBefore ? "var(--good)" : "var(--bad)" }}>
                  {signed(s.voteAfter - s.voteBefore)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, delta, good }: { label: string; value: string; delta: string; good: boolean }) {
  return (
    <div className="inset p-2.5">
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px]" style={{ color: good ? "var(--good)" : "var(--bad)" }}>
        {delta}
      </div>
    </div>
  );
}

function SeatList({ title, hint, notes, go }: { title: string; hint: string; notes: SeatNote[]; go: (i: number) => void }) {
  return (
    <section>
      <h3 className="eyebrow">{title}</h3>
      <p className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
        {hint}
      </p>
      {notes.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          None.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 max-h-[260px] overflow-y-auto scroll-thin">
          {notes.map((n) => (
            <li key={n.i}>
              <button className="card inset w-full px-2.5 py-1.5 text-left text-xs" onClick={() => go(n.i)}>
                <span className="flex items-baseline gap-2">
                  <b className="flex-1 truncate text-[13px]">{SEATS[n.i].name}</b>
                  <span style={{ color: "var(--muted)" }}>{STATE_BY_ID[SEATS[n.i].state].name}</span>
                  <span className="tabular-nums">
                    {pct(n.before)} → {pct(n.after)}
                  </span>
                </span>
                <span className="block" style={{ color: "var(--ink-2)" }}>
                  {n.short ? `Short by ${n.short.toLocaleString("en-MY")} votes` : `Margin ${signed(n.margin)} pts`}
                  {n.why.length > 0 && ` · ${n.why.map((w) => `${w.label.split(" (")[0].toLowerCase()} ${w.value >= 0 ? "+" : "−"}${Math.abs(Math.round(w.value * 100))}`).join(", ")}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
