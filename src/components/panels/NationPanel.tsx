"use client";

import { useState } from "react";
import { govSeats, leverBlocked, noConfidenceChance } from "@/game/actions";
import { CRISIS_BY_KIND, PROJECTS, PROJECT_BY_ID, projectStates, type Nation } from "@/game/systems/nation";
import { AGENDA, KPIS, KPI_INFO, OPP, agendaText, badness, brokenPromise, challengeable, critiqueBlocked, evidenceLabel, itemMet, rallyBlocked, type Kpi } from "@/game/systems/agenda";
import { useGame } from "@/store/gameStore";
import { MAJORITY, cshort } from "@/game/world";
import { ActionCard } from "../ActionCard";
import { RECORD_KPIS, better, reportCard } from "@/game/systems/governing";
import { LEGACY } from "@/game/systems/goals";
import { POLICY_BY_ID } from "@/game/systems/policies";

/** The state of the country: the government's promises, the numbers, and what you can do about them. */
export function NationPanel() {
  const game = useGame((s) => s.game)!;
  const { lever } = useGame();
  const n = game.nation;
  const pm = leverBlocked(game) === null;
  const gov = game.government.includes(game.player);
  const crisis = n.crisis ? CRISIS_BY_KIND[n.crisis.kind] : null;
  return (
    <div className="flex flex-col gap-4">
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

      <AgendaCard />
      <RecordCard />

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="eyebrow">The numbers</h3>
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            {cshort(game.parliament.pm)} government · {govSeats(game)} seats · OPR {n.opr.toFixed(2)}% · RM {n.ringgit.toFixed(2)}/USD
          </span>
        </div>
        <div className="grid grid-cols-2 @lg:grid-cols-4 gap-2">
          {KPIS.map((k) => (
            <Tile key={k} k={k} />
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          {gov
            ? "In government you own these numbers: approval above 50 adds to your swing everywhere. Below 32, partners start walking out."
            : "In opposition you gain when these go wrong. Attack a number that is genuinely bad (worse still if they promised to fix it); attacking a good one falls flat."}
        </p>
      </section>

      {pm ? (
        <section>
          <h3 className="eyebrow mb-2">Your levers</h3>
          <div className="grid gap-2 @md:grid-cols-2">
            <div className="inset p-2.5">
              <div className="text-xs font-semibold mb-1">Civil service pay · 5 capital</div>
              <div className="flex flex-wrap gap-1.5">
                {(["freeze", "normal", "raise"] as Nation["civilPay"][]).map((p) => (
                  <button key={p} className="chip !py-1 text-xs" aria-pressed={n.civilPay === p} onClick={() => lever({ kind: "pay", stance: p })}>
                    {p === "freeze" ? "Freeze" : p === "normal" ? "With inflation" : "Pay rise"}
                  </button>
                ))}
              </div>
            </div>
            <button className="card card-action inset p-2.5 text-left text-xs" disabled={n.stimulus > 0} onClick={() => lever({ kind: "stimulus" })}>
              <span className="block font-semibold text-[13px]">{n.stimulus > 0 ? `Stimulus running (${n.stimulus} wks)` : "Launch a stimulus package"}</span>
              <span style={{ color: "var(--ink-2)" }}>10 capital · fiscal space −10, growth +0.8 for six months</span>
            </button>
            <ActionCard id="roadshow" target={{ kind: "none" }} compact />
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
            Fuel subsidies, cash aid, the minimum wage and sales tax are set under Policy &amp; Budget; ministers are under Cabinet.
          </p>
        </section>
      ) : !gov ? (
        <AccountCard />
      ) : (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          You are a junior partner in government: the Prime Minister pulls the levers, but you share the credit and the blame.
        </p>
      )}

      {(pm || n.projects.length > 0) && <Projects />}
      <LegacyCard />
    </div>
  );
}

/** The government's promises for the term: on track or broken. */
function AgendaCard() {
  const game = useGame((s) => s.game)!;
  const a = game.agenda;
  if (!a) return null;
  const mine = a.by === game.player;
  return (
    <section className="inset p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="eyebrow">{mine ? "Your promises this term" : `The ${cshort(a.by)} government's promises`}</h3>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {a.items.filter((it) => itemMet(game, it)).length} of {a.items.length} kept
        </span>
      </div>
      <ul className="grid gap-1.5 @md:grid-cols-3">
        {a.items.map((it) => {
          const ok = itemMet(game, it);
          const info = KPI_INFO[it.kpi];
          return (
            <li key={it.kpi} className="rounded-lg px-2.5 py-2 text-xs" style={{ background: "var(--surface-2)", outline: `1px solid ${ok ? "var(--good)" : "var(--line)"}` }}>
              <div className="font-semibold">{agendaText(it)}</div>
              <div style={{ color: "var(--ink-2)" }}>
                Was {info.fmt(it.from)} · now {info.fmt(game.nation[it.kpi])}
              </div>
              <div className="font-semibold mt-0.5" style={{ color: ok ? "var(--good)" : brokenPromise(game, it.kpi) ? "var(--bad)" : "var(--ink-2)" }}>
                {ok ? "✓ Kept" : brokenPromise(game, it.kpi) ? (mine ? "✗ Broken" : "✗ Broken: attack it") : `Not yet (${Math.max(0, AGENDA.grace - (game.week - a.week))} wks of grace)`}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
        {mine ? `Each promise kept adds ${AGENDA.monthlyApproval} approval a month.` : `Attacks on a broken promise land ${AGENDA.brokenBonus}× harder.`}
      </p>
    </section>
  );
}

function Tile({ k }: { k: Kpi }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const n = game.nation;
  const info = KPI_INFO[k];
  const histKey = k as keyof Nation["history"][number];
  const hist = [...n.history.map((h) => (histKey in h ? (h[histKey] as number) : n[k])), n[k]];
  const prev = hist.length > 1 ? hist[Math.max(0, hist.length - 14)] : n[k];
  const diff = n[k] - prev;
  const better = info.upIsGood ? diff > 0 : diff < 0;
  const flat = Math.abs(diff) < 0.05;
  const bad = badness(game, k);
  const opp = !game.government.includes(game.player);
  const why = opp ? critiqueBlocked(game, k) : null;
  return (
    <div className="inset p-2.5 flex flex-col" title={`${info.label}: ${info.fmt(n[k])}`}>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {info.label}
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-lg font-bold tabular-nums" style={{ color: bad > 0.5 ? "var(--bad)" : undefined }}>
          {info.fmt(n[k])}
        </span>
        {!flat && (
          <span className="text-[11px] tabular-nums" style={{ color: better ? "var(--good)" : "var(--bad)" }}>
            {diff > 0 ? "▲" : "▼"}
          </span>
        )}
      </div>
      <Spark values={hist.slice(-26)} />
      {opp && (
        <button className="chip !py-0.5 !px-2 text-[11px] mt-1 justify-center" disabled={!!why} title={why ?? `1 AP · RM 50k. How bad it is: ${Math.round(bad * 100)}%${brokenPromise(game, k) ? " · a broken promise" : ""}`} onClick={() => deep({ kind: "critique", kpi: k })}>
          Attack · {bad < 0.12 ? "weak" : bad < 0.45 ? "fair" : "strong"}
        </button>
      )}
    </div>
  );
}

/** The opposition's toolkit beyond speeches: investigations, the street, the courts, and the big motion. */
function AccountCard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const p = game.opp.probe;
  const bills = challengeable(game);
  const rallyWhy = rallyBlocked(game);
  return (
    <section>
      <h3 className="eyebrow mb-2">Hold them to account</h3>
      <div className="grid gap-2 @md:grid-cols-2">
        <div className="inset p-2.5 text-xs flex flex-col gap-1.5">
          <div className="font-semibold text-[13px]">Investigation</div>
          {p ? (
            <>
              <div style={{ color: "var(--ink-2)" }}>
                Digging into {p.title}. Evidence: <b>{evidenceLabel(p.quality)}</b>.
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: "var(--accent)" }} />
              </div>
              <button className="chip !py-1 self-start" onClick={() => deep({ kind: "publish" })} title="Going early is riskier: the case may not hold">
                Go public now ({Math.round(p.progress)}%)
              </button>
            </>
          ) : (
            <>
              <span style={{ color: "var(--ink-2)" }}>
                Dig into a ministry for a few months, then go public. Lands: the minister may fall and approval drops. Fails: a defamation suit.
              </span>
              <button className="chip !py-1 self-start" onClick={() => deep({ kind: "probe" })}>
                Start digging · {OPP.probe.ap} AP · RM 300k
              </button>
            </>
          )}
        </div>
        <button className="card card-action inset p-2.5 text-left text-xs" disabled={!!rallyWhy} title={rallyWhy ?? undefined} onClick={() => deep({ kind: "rally" })}>
          <span className="block font-semibold text-[13px]">Street rally</span>
          <span style={{ color: "var(--ink-2)" }}>{rallyWhy ?? `${OPP.rally.ap} AP · RM 800k. A huge moment for the young and urban; a crackdown wins sympathy, a riot costs you.`}</span>
        </button>
        <ActionCard id="attackRecord" target={{ kind: "none" }} compact />
        <ActionCard id="noConfidence" target={{ kind: "none" }} compact />
      </div>
      <div className="mt-2">
        <div className="text-xs font-semibold mb-1">Court challenges</div>
        {bills.length === 0 ? (
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            No recent government law to challenge.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bills.slice(0, 4).map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{m.title}</span>
                <button className="chip !py-0.5 text-[11px]" onClick={() => deep({ kind: "court", motion: m.id })}>
                  Challenge · {OPP.court.ap} AP · RM 500k
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
        A no-confidence motion passes about {Math.round(noConfidenceChance(game) * 100)}% of the time today. The government has {govSeats(game)} seats ({MAJORITY} for a majority).
      </p>
    </section>
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


/** The government's record so far (the report card voters will see), and what each of your decisions did. */
function RecordCard() {
  const game = useGame((s) => s.game)!;
  const card = reportCard(game);
  const mine = game.agenda?.by === game.player;
  const decisions = (game.policyLog ?? []).filter((e) => e.gov).slice(0, 6);
  if (!card && !decisions.length) return null;
  const fmtBy = (k: Kpi, v: number) => `${v >= 0 ? "▲" : "▼"} ${KPI_INFO[k].label.toLowerCase()} ${Math.abs(v) < 1 ? Math.abs(v).toFixed(1) : Math.abs(v).toFixed(0)}`;
  return (
    <section className="inset p-3">
      {card && (
        <>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="eyebrow">{mine ? "Your record so far" : `The ${cshort(game.agenda!.by)} government's record`}</h3>
            <span className="text-[11px] font-semibold" style={{ color: card.grade > 0.05 ? "var(--good)" : card.grade < -0.25 ? "var(--bad)" : "var(--ink-2)" }}>
              {card.verdict}
            </span>
          </div>
          <p className="text-xs mb-1.5" style={{ color: "var(--ink-2)" }}>
            Promises kept {card.kept} of {card.total}
            {card.broken ? ` · ${card.broken} broken` : ""} · since the term began:{" "}
            {card.moves
              .filter((m) => Math.abs(m.by) >= (m.kpi === "col" || m.kpi === "fdi" || m.kpi === "approval" ? 1 : 0.1))
              .map((m) => (
                <span key={m.kpi} style={{ color: m.by >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {fmtBy(m.kpi, m.by)}{" "}
                </span>
              ))}
          </p>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            When the campaign starts, this record goes before the voters: a good one lifts the government&apos;s Execution and Principle, a bad one sinks them.
          </p>
        </>
      )}
      {mine && decisions.length > 0 && (
        <div className="mt-2.5">
          <h4 className="text-xs font-semibold mb-1">What your decisions did</h4>
          <ul className="flex flex-col gap-1">
            {decisions.map((e) => {
              const opt = POLICY_BY_ID[e.policy]?.options[e.option];
              const moved = RECORD_KPIS.map((k) => ({ k, v: better(game, e.at, k) }))
                .filter((x) => Math.abs(x.v) >= (x.k === "col" || x.k === "fdi" || x.k === "approval" ? 1 : 0.1))
                .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
                .slice(0, 3);
              return (
                <li key={`${e.week}-${e.policy}`} className="text-xs flex gap-2">
                  <span className="flex-none tabular-nums" style={{ color: "var(--muted)" }}>
                    {game.week - e.week} wks ago
                  </span>
                  <span className="flex-1 min-w-0">
                    <b>{opt?.label ?? e.policy}</b>
                    {moved.length ? ": since then " : ": too early to tell"}
                    {moved.map((x) => (
                      <span key={x.k} style={{ color: x.v >= 0 ? "var(--good)" : "var(--bad)" }}>
                        {fmtBy(x.k, x.v)}{" "}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            Policies take months to work through: numbers drift toward their new level, faster with a capable minister.
          </p>
        </div>
      )}
    </section>
  );
}

/** What a great Prime Minister leaves behind. */
function LegacyCard() {
  const game = useGame((s) => s.game)!;
  return (
    <section>
      <h3 className="eyebrow mb-2">Your legacy</h3>
      <ul className="grid gap-1.5 @md:grid-cols-2">
        {LEGACY.map((l) => {
          const done = game.achievements[`legacy-${l.id}`] !== undefined;
          const p = done ? 1 : l.progress(game);
          return (
            <li key={l.id} className="inset px-2.5 py-2 text-xs" style={done ? { outline: "1px solid var(--good)" } : undefined}>
              <div className="flex justify-between">
                <b className="text-[13px]">{l.name}</b>
                <span style={{ color: done ? "var(--good)" : "var(--muted)" }}>{done ? "✓ Achieved" : `${Math.round(p * 100)}%`}</span>
              </div>
              <div style={{ color: "var(--ink-2)" }}>{l.text}</div>
              <div className="h-1 rounded-full mt-1" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: done ? "var(--good)" : "var(--accent)" }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
        Counted while you are Prime Minister.
      </p>
    </section>
  );
}
