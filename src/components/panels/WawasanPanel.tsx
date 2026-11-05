"use client";

import { useState } from "react";
import { leverBlocked } from "@/game/actions";
import { budgetEnvelope } from "@/game/systems/budget";
import {
  MILESTONES,
  PILLARS,
  WAWASAN,
  etaWeeks,
  gdpUsdBn,
  incomeUsd,
  pillarPace,
  potentialBoost,
  qualityOfLife,
  taxBite,
  taxTargets,
  worldRank,
  worldTable,
  wz,
  youBuild,
} from "@/game/systems/wawasan";
import { useGame } from "@/store/gameStore";
import { cshort } from "@/game/world";

const usd = (v: number) => `US$${Math.round(v).toLocaleString("en-US")}`;
const eta = (weeks: number | null | undefined) => (weeks === undefined ? "pace shows after a few months" : weeks === null ? "not at this pace" : weeks === 0 ? "reached" : weeks < 52 ? `~${weeks} wks` : `~${(weeks / 52).toFixed(1)} yrs`);

/** Wawasan: building Malaysia into a superpower. Income, quality of life, the world table, the pillars and the tax take. */
export function WawasanPanel() {
  const game = useGame((s) => s.game)!;
  const w = wz(game);
  const build = youBuild(game);
  const income = incomeUsd(game);
  const qol = qualityOfLife(game);
  const rank = worldRank(game);
  const h = game.nation.history;
  // Pace from the last year of history (income per week, QoL per week).
  const yearAgo = h.filter((x) => x.income !== undefined && x.week >= game.week - 52 && x.week <= game.week - 8)[0];
  const span = yearAgo ? Math.max(4, game.week - yearAgo.week) : 0;
  const incomePace = yearAgo ? (income - yearAgo.income!) / span : 0;
  const qolPace = yearAgo ? (qol - yearAgo.qol!) / span : 0;
  const next = MILESTONES.find((m) => !w.reached.includes(m.id));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Build Malaysia into a superpower. Your Budget builds four pillars; the pillars lift growth; growth lifts income, quality of life and Malaysia&apos;s place in the
        world. {build ? "Only your government builds: keep the premiership." : `The ${cshort(game.parliament.pm)} government isn't building: the pillars wear down and income stalls until you govern.`}
      </p>

      <div className="grid gap-2 @md:grid-cols-3">
        <Big label="Income per head" value={usd(income)} sub={`GDP ${gdpUsdBn(game) >= 1000 ? `US$${(gdpUsdBn(game) / 1000).toFixed(2)} trillion` : `US$${Math.round(gdpUsdBn(game))} billion`}`} target={income < 15000 ? `High income at US$15,000: ${eta(yearAgo ? etaWeeks(income, 15000, incomePace) : undefined)}` : income < 30000 ? `Developed at US$30,000: ${eta(yearAgo ? etaWeeks(income, 30000, incomePace) : undefined)}` : "Developed-nation income"} />
        <Big label="Quality of Life" value={qol.toFixed(1)} sub="Income, schools and hospitals, infrastructure, prices, institutions" target={qol < 70 ? `70 for a developed nation: ${eta(yearAgo ? etaWeeks(qol, 70, qolPace) : undefined)}` : qol < 80 ? `80 for a superpower: ${eta(yearAgo ? etaWeeks(qol, 80, qolPace) : undefined)}` : "Superpower quality of life"} />
        <Big label="Global Power" value={`#${rank}`} sub="of 32 countries" target={rank > 15 ? "Top 15: Asian Tiger" : rank > 10 ? "Top 10: global power" : rank > 5 ? "Top 5: superpower" : "Among the world's great powers"} />
      </div>

      <Milestones />
      <Pillars />
      <Tax />
      <IncomeChart />
      <World />
      {next && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Next milestone: <b>{next.name}</b>: {next.text} Reward +{next.capital} capital and approval.
        </p>
      )}
    </div>
  );
}

function Big({ label, value, sub, target }: { label: string; value: string; sub: string; target: string }) {
  return (
    <div className="panel p-3">
      <div className="eyebrow">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {sub}
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--brass-hi)" }}>
        {target}
      </div>
    </div>
  );
}

function Milestones() {
  const game = useGame((s) => s.game)!;
  const w = wz(game);
  return (
    <section>
      <h3 className="eyebrow mb-2">The road to superpower</h3>
      <ol className="grid gap-1.5 @md:grid-cols-5">
        {MILESTONES.map((m, i) => {
          const done = w.reached.includes(m.id);
          const p = done ? 1 : m.progress(game, w);
          return (
            <li key={m.id} className="rounded-lg px-2.5 py-2 text-xs" style={{ background: "var(--surface-2)", outline: `1px solid ${done ? "var(--good)" : "var(--line)"}` }} title={m.text}>
              <div className="font-semibold">
                {i + 1}. {m.name}
              </div>
              <div style={{ color: "var(--ink-2)" }}>{m.text}</div>
              <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--line)" }}>
                <div className="h-1.5 rounded-full" style={{ width: `${Math.round(p * 100)}%`, background: done ? "var(--good)" : "var(--brass)" }} />
              </div>
              <div className="mt-1 font-semibold" style={{ color: done ? "var(--good)" : "var(--muted)" }}>
                {done ? "✓ Reached" : `${Math.round(p * 100)}% · +${m.capital} capital`}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Pillars() {
  const game = useGame((s) => s.game)!;
  const w = wz(game);
  const pace = pillarPace(game, w);
  const boost = potentialBoost(w);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="eyebrow">The four pillars</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Potential growth {boost >= 0 ? "+" : ""}
          {boost.toFixed(2)}% a year from the pillars
        </span>
      </div>
      <div className="grid gap-2 @md:grid-cols-2">
        {PILLARS.map((p) => {
          const v = w[p.id];
          const d = pace[p.id];
          return (
            <div key={p.id} className="inset p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{p.name}</span>
                <span className="text-sm tabular-nums">
                  {v.toFixed(1)}
                  <span className="text-xs ml-1.5" style={{ color: d > 0 ? "var(--good)" : "var(--bad)" }}>
                    {d >= 0 ? "+" : ""}
                    {d.toFixed(1)}/yr
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full mt-1" style={{ background: "var(--line)" }}>
                <div className="h-2 rounded-full" style={{ width: `${v}%`, background: "var(--brass)" }} />
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {p.blurb}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        Pillars wear down {WAWASAN.decay} point a year and gains slow as they fill. {Object.keys(w.alloc).length ? "Building from your last Budget." : "No Budget of yours yet: allocate one in October under Policy & Budget."}
      </p>
    </section>
  );
}

function Tax() {
  const game = useGame((s) => s.game)!;
  const { lever } = useGame();
  const w = wz(game);
  const [rate, setRate] = useState(w.tax);
  const T = WAWASAN.tax;
  const blocked = leverBlocked(game);
  const preview = { ...game, nation: { ...game.nation, wawasan: { ...w, tax: rate } } };
  const t = taxTargets(preview);
  const fmt = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
  return (
    <section className="inset p-3">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="eyebrow">Tax take</h3>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Now {w.tax}% of GDP · {T.capital} capital to change
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input type="range" min={T.min} max={T.max} step={1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="flex-1" aria-label="Tax take, % of GDP" disabled={!!blocked} />
        <span className="w-12 text-right tabular-nums font-semibold">{rate}%</span>
        <button className="btn" disabled={!!blocked || rate === w.tax || game.me.capital < T.capital} onClick={() => lever({ kind: "tax", rate })}>
          Set
        </button>
      </div>
      <div className="grid grid-cols-2 @md:grid-cols-4 gap-2 mt-2 text-xs">
        <Fx label="Budget" value={`${budgetEnvelope(game.fiscal, t.envelope)} pts`} note={`${fmt(t.envelope, 1)} from tax`} />
        <Fx label="Fiscal space" value={`${fmt(t.fiscal * 52, 1)}/yr`} />
        <Fx label="Growth" value={`${fmt(t.growth)}%`} />
        <Fx label="Approval" value={fmt(t.approval, 1)} />
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        More tax, a bigger Budget to build with, at a cost to growth and approval. Strong institutions soften the bite (now {Math.round(taxBite(w) * 100)}% of it). The SST/GST policy sets the mix: GST
        counts as one point more.
        {blocked ? ` ${blocked}` : ""}
      </p>
    </section>
  );
}

function Fx({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ background: "var(--surface-2)" }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
      {note && <div style={{ color: "var(--muted)" }}>{note}</div>}
    </div>
  );
}

function IncomeChart() {
  const game = useGame((s) => s.game)!;
  const pts = [...game.nation.history.filter((x) => x.income !== undefined).map((x) => ({ week: x.week, v: x.income! })), { week: game.week, v: incomeUsd(game) }];
  if (pts.length < 3) return null;
  const W = 600;
  const H = 120;
  const lo = Math.min(...pts.map((p) => p.v)) * 0.95;
  const hi = Math.max(...pts.map((p) => p.v), lo + 1000) * 1.02;
  const x = (wk: number) => ((wk - pts[0].week) / Math.max(1, game.week - pts[0].week)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = pts.map((p) => `${x(p.week).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const mark = (v: number, label: string) =>
    v > lo && v < hi ? (
      <g key={label}>
        <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="4 4" />
        <text x={4} y={y(v) - 3} fontSize={10} fill="var(--muted)">
          {label}
        </text>
      </g>
    ) : null;
  return (
    <section>
      <h3 className="eyebrow mb-2">Income per head</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none" role="img" aria-label="Income per head over time">
        {mark(15000, "High income")}
        {mark(30000, "Developed")}
        <polyline points={line} fill="none" stroke="var(--brass)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}

function World() {
  const game = useGame((s) => s.game)!;
  const table = worldTable(game);
  const me = table.findIndex((c) => c.you);
  const show = table.map((c, i) => ({ ...c, rank: i + 1 })).filter((c, i) => i < 5 || Math.abs(i - me) <= 3);
  return (
    <section>
      <h3 className="eyebrow mb-2">Global Power</h3>
      <ul className="text-sm">
        {show.map((c, i) => (
          <li key={c.name}>
            {i > 0 && c.rank - show[i - 1].rank > 1 && (
              <div className="text-xs text-center" style={{ color: "var(--muted)" }}>
                ⋯
              </div>
            )}
            <div className="flex items-center gap-2 px-2 py-1 rounded-md" style={c.you ? { background: "rgb(201 162 74 / 0.15)", outline: "1px solid var(--brass)" } : undefined}>
              <span className="w-7 tabular-nums text-xs" style={{ color: "var(--muted)" }}>
                #{c.rank}
              </span>
              <span className={`flex-1 ${c.you ? "font-semibold" : ""}`}>{c.name}</span>
              <span className="tabular-nums text-xs">{c.power.toFixed(1)}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
        Global Power blends income per head, quality of life, innovation and the size of the economy.
      </p>
    </section>
  );
}
