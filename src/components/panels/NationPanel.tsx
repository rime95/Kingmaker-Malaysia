"use client";

import { useState } from "react";
import { govSeats, leverBlocked, noConfidenceChance } from "@/game/actions";
import { PORTFOLIOS } from "@/game/data/people";
import { CRISIS_BY_KIND, PORTFOLIO_KPI, PROJECTS, PROJECT_BY_ID, ministerEffect, projectStates, type Nation } from "@/game/systems/nation";
import { byId } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { MAJORITY, cshort } from "@/game/world";
import { ActionCard } from "../ActionCard";

type Key = "gdp" | "inflation" | "unemployment" | "ringgit" | "debt" | "approval";

/** Each indicator: how to show it, and whether up is good. */
const TILES: { key: Key; label: string; fmt: (v: number) => string; upIsGood: boolean; note: string }[] = [
  { key: "gdp", label: "Growth", fmt: (v) => `${v.toFixed(1)}%`, upIsGood: true, note: "Real GDP, a year" },
  { key: "inflation", label: "Inflation", fmt: (v) => `${v.toFixed(1)}%`, upIsGood: false, note: "Prices, a year" },
  { key: "unemployment", label: "Unemployment", fmt: (v) => `${v.toFixed(1)}%`, upIsGood: false, note: "Share of the workforce" },
  { key: "ringgit", label: "Ringgit", fmt: (v) => `${v.toFixed(2)}`, upIsGood: false, note: "Per US dollar (higher is weaker)" },
  { key: "debt", label: "Federal debt", fmt: (v) => `${v.toFixed(0)}%`, upIsGood: false, note: "Of GDP" },
  { key: "approval", label: "Government approval", fmt: (v) => `${v.toFixed(0)}%`, upIsGood: true, note: "Feeds national swing" },
];

/** The state of the country, and what the Prime Minister (or the opposition) can do about it. */
export function NationPanel() {
  const game = useGame((s) => s.game)!;
  const { lever } = useGame();
  const n = game.nation;
  const pm = leverBlocked(game) === null;
  const gov = game.government.includes(game.player);
  const crisis = n.crisis ? CRISIS_BY_KIND[n.crisis.kind] : null;
  return (
    <div className="flex flex-col gap-5">
      {crisis && (
        <section className="inset p-3" style={{ outline: "1px solid var(--bad)" }}>
          <div className="eyebrow" style={{ color: "var(--bad)" }}>
            ▲ {crisis.title} · {n.crisis!.weeksLeft} wks left
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
            {crisis.text}
          </p>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="eyebrow">The numbers</h3>
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {cshort(game.parliament.pm)} government · {govSeats(game)} seats
          </span>
        </div>
        <div className="grid grid-cols-2 @lg:grid-cols-3 gap-2">
          {TILES.map((t) => (
            <Tile key={t.key} n={n} tile={t} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
          <Mini label="Cost of living" value={`${Math.round(n.col)}`} warn={n.col > 60} note="pressure, 50 = normal" />
          <Mini label="Investment" value={`${Math.round(n.fdi)}`} warn={n.fdi < 45} note="climate, 0–100" />
          <Mini label="OPR" value={`${n.opr.toFixed(2)}%`} note="Bank Negara sets it" />
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          {gov
            ? "In government you own these numbers: approval above 50 adds to your swing everywhere, below it costs you. Below 32, partners start walking out."
            : "In opposition you gain when these go wrong. A government below 32% approval starts losing partners."}
        </p>
      </section>

      {pm ? (
        <>
          <section>
            <h3 className="eyebrow mb-2">Your levers</h3>
            <div className="text-xs mb-1" style={{ color: "var(--ink-2)" }}>
              Civil service pay (5 capital to change)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["freeze", "normal", "raise"] as Nation["civilPay"][]).map((p) => (
                <button key={p} className="chip !py-1 text-xs" aria-pressed={n.civilPay === p} onClick={() => lever({ kind: "pay", stance: p })}>
                  {p === "freeze" ? "Freeze" : p === "normal" ? "With inflation" : "Pay rise"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="chip text-xs" disabled={n.stimulus > 0} onClick={() => lever({ kind: "stimulus" })} title="Fiscal space −10, growth +0.8 for six months. 10 capital.">
                {n.stimulus > 0 ? `Stimulus running (${n.stimulus} wks)` : "Launch a stimulus package"}
              </button>
            </div>
            <div className="grid gap-2 mt-3">
              <ActionCard id="roadshow" target={{ kind: "none" }} compact />
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
              Fuel subsidies, cash aid, the minimum wage and sales tax are set in Policy; they move prices, jobs and the debt here.
            </p>
          </section>
          <Projects />
        </>
      ) : !gov ? (
        <section>
          <h3 className="eyebrow mb-2">Hold them to account</h3>
          <div className="grid gap-2">
            <ActionCard id="attackRecord" target={{ kind: "none" }} compact />
            <ActionCard id="noConfidence" target={{ kind: "none" }} compact />
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
            A no-confidence motion passes about {Math.round(noConfidenceChance(game) * 100)}% of the time today. The government has {govSeats(game)} seats ({MAJORITY} for a majority).
          </p>
        </section>
      ) : (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          You are a junior partner in government: the Prime Minister pulls the levers, but you share the credit and the blame.
        </p>
      )}

      {!pm && n.projects.length > 0 && <Projects />}
      <Ministers />
    </div>
  );
}

function Tile({ n, tile }: { n: Nation; tile: (typeof TILES)[number] }) {
  const hist = [...n.history.map((h) => h[tile.key]), n[tile.key]];
  const prev = hist.length > 1 ? hist[Math.max(0, hist.length - 14)] : n[tile.key];
  const diff = n[tile.key] - prev;
  const better = tile.upIsGood ? diff > 0 : diff < 0;
  const flat = Math.abs(diff) < (tile.key === "ringgit" ? 0.01 : 0.05);
  return (
    <div className="inset p-2.5" title={`${tile.label}: ${tile.fmt(n[tile.key])}. ${tile.note}.`}>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {tile.label}
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-lg font-bold tabular-nums">{tile.fmt(n[tile.key])}</span>
        {!flat && (
          <span className="text-[11px] tabular-nums" style={{ color: better ? "var(--good)" : "var(--bad)" }}>
            {diff > 0 ? "▲" : "▼"} {tile.fmt(Math.abs(diff)).replace("%", "")}
          </span>
        )}
      </div>
      <Spark values={hist.slice(-26)} />
      <div className="text-[10px]" style={{ color: "var(--muted)" }}>
        {tile.note}
      </div>
    </div>
  );
}

/** A small single-series trend line (the last two years, one point a month). */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-6" />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${22 - ((v - lo) / span) * 18}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full h-6 my-0.5" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--ink-2)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Mini({ label, value, note, warn }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <div className="inset p-2">
      <div className="text-[10px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="font-semibold tabular-nums" style={{ color: warn ? "var(--bad)" : "var(--ink)" }}>
        {warn ? "▲ " : ""}
        {value}
      </div>
      <div className="text-[10px]" style={{ color: "var(--muted)" }}>
        {note}
      </div>
    </div>
  );
}

function Projects() {
  const game = useGame((s) => s.game)!;
  const { lever } = useGame();
  const [showAll, setShowAll] = useState(false);
  const pm = leverBlocked(game) === null;
  const running = game.nation.projects;
  const available = PROJECTS.filter((p) => !running.some((r) => r.id === p.id));
  return (
    <section>
      <h3 className="eyebrow mb-2">Mega projects</h3>
      {running.length === 0 && (
        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          Nothing under construction.
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {running.map((p) => {
          const def = PROJECT_BY_ID[p.id];
          return (
            <li key={p.id} className="inset p-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{def.name}</span>
                <span style={{ color: p.done ? "var(--good)" : "var(--ink-2)" }}>{p.done ? "✓ Open" : `${Math.round(p.progress * 100)}%`}</span>
              </div>
              {!p.done && (
                <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${p.progress * 100}%`, background: "var(--ink-2)" }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {pm && available.length > 0 && (
        <>
          <button className="text-xs underline mt-2" style={{ color: "var(--ink-2)" }} onClick={() => setShowAll((x) => !x)}>
            {showAll ? "Hide new projects" : `Start a new project (${available.length})`}
          </button>
          {showAll && (
            <ul className="flex flex-col gap-1.5 mt-2">
              {available.map((def) => (
                <li key={def.id} className="inset p-2.5 text-xs flex flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{def.name}</span>
                    <span style={{ color: "var(--ink-2)" }}>
                      RM {def.cost}bn · {Math.round(def.weeks / 52)} yrs
                    </span>
                  </div>
                  <div style={{ color: "var(--muted)" }}>
                    {def.blurb} Serves {projectStates(def)}.
                  </div>
                  <button className="chip !py-1 text-xs self-start" onClick={() => lever({ kind: "project", id: def.id })}>
                    Break ground · 10 capital
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** Each minister moves one number by how good they are. */
function Ministers() {
  const game = useGame((s) => s.game)!;
  const rows = PORTFOLIOS.filter((p) => PORTFOLIO_KPI[p.id]);
  return (
    <section>
      <h3 className="eyebrow mb-2">Ministers and their numbers</h3>
      <ul className="flex flex-col gap-1">
        {rows.map((port) => {
          const p = byId(game, game.cabinet[port.id]);
          const e = ministerEffect(game, port.id);
          return (
            <li key={port.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-2 items-center text-xs">
              <span className="truncate" style={{ color: "var(--muted)" }} title={port.name}>
                {port.name}
              </span>
              <span className="truncate">{p ? p.name : <span style={{ color: "var(--bad)" }}>Vacant</span>}</span>
              <span className="tabular-nums whitespace-nowrap" style={{ color: e > 0.1 ? "var(--good)" : e < -0.1 ? "var(--bad)" : "var(--ink-2)" }} title={`Moves: ${PORTFOLIO_KPI[port.id]}`}>
                {e > 0.1 ? "▲" : e < -0.1 ? "▼" : "•"} {PORTFOLIO_KPI[port.id]}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
        Competence above 60 helps, below it hurts; an empty ministry hurts most. Reshuffle in the People panel.
      </p>
    </section>
  );
}
