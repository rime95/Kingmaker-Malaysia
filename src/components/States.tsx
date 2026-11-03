"use client";

import { useMemo, useState } from "react";
import { assemblyDissolveBlocked, parliamentDissolveBlocked } from "@/game/actions";
import { GE, PRN } from "@/game/config";
import { voterInputs, weekLabel } from "@/game/state";
import { ASSEMBLY_STATES, countSeats, stateRule, weeksToElection } from "@/game/systems/assemblies";
import { DUNS, DUNS_BY_STATE, projectDuns, type DunProjection } from "@/game/systems/dun";
import { useGame } from "@/store/gameStore";
import { cshort, STATE_BY_ID, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor, pct } from "./common";
import { hemicycle } from "./Dewan";
import { CoalitionFlag, PartyFlag } from "./flags";
import { STATEGOV, STATE_POWERS, mbTitle, statePowerBlocked, type StatePower } from "@/game/systems/stategov";
import { chiefKey, holderOf as postHolder, homeOf, regionOf } from "@/game/systems/posts";
import { fmtRM } from "@/game/money";
import { Term } from "./Term";

function useDunProjections(): DunProjection[] {
  const game = useGame((s) => s.game);
  return useMemo(() => (game ? projectDuns(voterInputs(game)) : []), [game]);
}

export function States() {
  const game = useGame((s) => s.game)!;
  const [picked, setPicked] = useState<string>(() => ASSEMBLY_STATES.find((id) => game.assemblies[id].status === "campaign") ?? "SGR");
  const proj = useDunProjections();
  const focusState = useGame((s) => s.focusState);
  return (
    <div className="flex flex-col gap-4">
      <ParliamentPanel />
      <div className="grid gap-4 @2xl:grid-cols-[1fr_1.1fr] items-start">
        <div className="grid gap-2 @md:grid-cols-2">
          {ASSEMBLY_STATES.map((id) => (
            <StateCard
              key={id}
              id={id}
              proj={proj}
              active={picked === id}
              onPick={() => {
                setPicked(id);
                focusState(id);
              }}
            />
          ))}
        </div>
        <StateDetail id={picked} proj={proj} />
      </div>
    </div>
  );
}

function ParliamentPanel() {
  const game = useGame((s) => s.game)!;
  const dissolve = useGame((s) => s.dissolveParliament);
  const p = game.parliament;
  const blocked = parliamentDissolveBlocked(game);
  const toGo = weeksToElection(game);
  return (
    <section className="panel p-4 flex flex-wrap items-center gap-3" style={p.status === "campaign" ? { borderLeft: "4px solid var(--accent)" } : undefined}>
      <div className="flex-1 min-w-[240px]">
        <h2 className="font-semibold">Parliament</h2>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {p.status === "campaign"
            ? `Dissolved. General election polling day: ${weekLabel(p.pollWeek!)} (${toGo} week${toGo === 1 ? "" : "s"}).`
            : `Prime Minister from ${cshort(p.pm)}. Dissolves automatically on ${weekLabel(p.deadlineWeek)}; polling about ${GE.campaignWeeks} weeks later.`}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          States that vote with Parliament:{" "}
          {ASSEMBLY_STATES.filter((id) => game.assemblies[id].syncGE)
            .map((id) => STATE_BY_ID[id].name)
            .join(", ") || "none"}
          .
        </p>
      </div>
      {p.status === "sitting" && (
        <button
          className="btn"
          disabled={!!blocked}
          title={blocked ?? undefined}
          style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
          onClick={() => confirm("Advise the Agong to dissolve Parliament? The general election campaign starts now.") && dissolve()}
        >
          Dissolve Parliament
        </button>
      )}
    </section>
  );
}

function SeatStrip({ seats, total }: { seats: Partial<Record<CoalitionId, number>>; total: number }) {
  return (
    <div className="relative h-3">
      <div className="flex h-full gap-[2px] rounded-sm overflow-hidden">
        {CHART_ORDER.filter((c) => seats[c]).map((c) => (
          <div key={c} title={`${cshort(c)} ${seats[c]}`} style={{ width: `${(seats[c]! / total) * 100}%`, background: coalColor(c) }} />
        ))}
      </div>
      <div className="absolute -top-0.5 -bottom-0.5 w-[2px]" style={{ left: `${(Math.floor(total / 2) + 1) / total * 100}%`, background: "var(--ink)" }} />
    </div>
  );
}

function StateCard({ id, proj, active, onPick }: { id: string; proj: DunProjection[]; active: boolean; onPick: () => void }) {
  const game = useGame((s) => s.game)!;
  const rule = stateRule(game.dunHolders, id, game.government);
  const g = game.stateGov[id];
  const ruler = g?.ruler ?? rule.ruler;
  const mb = game.people.find((p) => p.id === g?.mb);
  const a = game.assemblies[id];
  const ids = DUNS_BY_STATE[id];
  const today = countSeats(ids.map((d) => proj[d].leader));
  const mineNow = rule.seats[game.player] ?? 0;
  const mineToday = today[game.player] ?? 0;
  const weeksLeft = (a.status === "campaign" ? a.pollWeek! : a.deadlineWeek) - game.week;
  return (
    <button
      onClick={onPick}
      className="panel p-3 text-left flex flex-col gap-1.5"
      style={{ borderColor: active ? "var(--ink)" : undefined, boxShadow: a.status === "campaign" ? "inset 4px 0 0 var(--accent)" : undefined }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">{STATE_BY_ID[id].name}</span>
        <span className="text-xs inline-flex items-center gap-1">
          <CoalitionFlag game={game} c={ruler} size={10} />
          {cshort(ruler)}
          {ruler === game.player ? " (you)" : ""}
        </span>
      </div>
      {mb && (
        <div className="text-xs truncate" style={{ color: "var(--ink-2)" }}>
          {mbTitle(id)}: <b>{mb.name}</b> ({mb.party})
        </div>
      )}
      <SeatStrip seats={rule.seats} total={rule.total} />
      <div className="text-xs flex flex-wrap justify-between gap-x-2" style={{ color: "var(--muted)" }}>
        <span>
          {a.status === "campaign" ? `Polling ${weekLabel(a.pollWeek!)}` : weeksLeft <= 26 ? `Term ends in ${weeksLeft} wks` : `Term ends ${weekLabel(a.deadlineWeek)}`}
          {a.syncGE && a.status === "sitting" ? " · with GE" : ""}
        </span>
        <span>
          You {mineNow} → {mineToday} today
        </span>
      </div>
    </button>
  );
}

function StateDetail({ id, proj }: { id: string; proj: DunProjection[] }) {
  const game = useGame((s) => s.game)!;
  const dissolve = useGame((s) => s.dissolveAssembly);
  const sync = useGame((s) => s.syncAssembly);
  const [view, setView] = useState<"now" | "today">("now");
  const [hover, setHover] = useState<{ d: number; x: number; y: number } | null>(null);
  const ids = DUNS_BY_STATE[id];
  const a = game.assemblies[id];
  const rule = stateRule(game.dunHolders, id, game.government);
  const g = game.stateGov[id];
  const ruler = g?.ruler ?? rule.ruler;
  const holderOf = (d: number) => (view === "now" ? game.dunHolders[d] : proj[d].leader);
  const order = [...ids].sort((x, y) => CHART_ORDER.indexOf(holderOf(x)) - CHART_ORDER.indexOf(holderOf(y)) || x - y);
  const geo = hemicycle(order);
  const blocked = assemblyDissolveBlocked(game, id);
  const mine = ruler === game.player;
  const counts = countSeats(ids.map(holderOf));

  return (
    <section className="panel p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{STATE_BY_ID[id].name} assembly</h2>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {ids.length} seats · {Math.floor(ids.length / 2) + 1} for a majority
        </span>
      </div>
      <div className="flex gap-2">
        <button className="chip" aria-pressed={view === "now"} onClick={() => setView("now")}>
          Today
        </button>
        <button className="chip" aria-pressed={view === "today"} onClick={() => setView("today")}>
          If held today
        </button>
      </div>
      <svg viewBox={`0 0 ${geo.w} ${geo.h}`} className="w-full h-auto" role="img" aria-label={`${STATE_BY_ID[id].name} assembly seating`}>
        {geo.dots.map((dot) => (
          <circle
            key={dot.seatIndex}
            cx={dot.x}
            cy={dot.y}
            r={geo.size}
            fill={coalColor(holderOf(dot.seatIndex))}
            stroke="var(--surface)"
            strokeWidth={1.5}
            onMouseMove={(e) => setHover({ d: dot.seatIndex, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={geo.w / 2} y={geo.h - 42} textAnchor="middle" className="map-label" style={{ fontSize: 17 }}>
          {(Object.entries(counts) as [CoalitionId, number][])
            .sort((x, y) => y[1] - x[1])
            .map(([c, n]) => `${cshort(c)} ${n}`)
            .join(" · ")}
        </text>
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-semibold">
            {DUNS[hover.d].code} {DUNS[hover.d].name}
          </div>
          <div>Held by {cshort(game.dunHolders[hover.d])}</div>
          <div style={{ color: "var(--muted)" }}>
            Today: {cshort(proj[hover.d].leader)} by {pct(proj[hover.d].margin, 1)}
          </div>
        </div>
      )}

      {a.lastAfter && (
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          Last state election ({weekLabel(a.lastPollWeek!)}):{" "}
          {(Object.entries(a.lastAfter) as [CoalitionId, number][])
            .sort((x, y) => y[1] - x[1])
            .map(([c, n]) => `${cshort(c)} ${n} (${n - (a.lastBefore?.[c] ?? 0) >= 0 ? "+" : "−"}${Math.abs(n - (a.lastBefore?.[c] ?? 0))})`)
            .join(", ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {a.status === "sitting" ? (
          <>
            <button
              className="btn"
              disabled={!!blocked}
              title={blocked ?? undefined}
              style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={() => confirm(`Dissolve the ${STATE_BY_ID[id].name} assembly? Polling day will be in ${PRN.campaignWeeks} weeks.`) && dissolve(id)}
            >
              Dissolve assembly
            </button>
            {mine && (
              <button className="chip" aria-pressed={a.syncGE} onClick={() => sync(id, !a.syncGE)}>
                Vote together with Parliament
              </button>
            )}
            {!mine && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Run by {cshort(ruler)}: they decide when it dissolves.
              </span>
            )}
          </>
        ) : (
          <span className="text-sm">Campaigning: polling day {weekLabel(a.pollWeek!)}. Rivals are pouring effort into this state.</span>
        )}
      </div>
      {g && <StateGovernment id={id} />}
      <StateChiefs id={id} />
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Governing a state pays RM {(PRN.stateIncomePerSeat / 1000).toFixed(0)}k per assembly seat a week to the party, fills a state treasury of RM{" "}
        {(STATEGOV.incomePerSeat / 1000).toFixed(0)}k per seat a week, and builds service in its parliamentary seats.
      </p>
    </section>
  );
}

/** Who runs the state: the MB or KM, the exco, and (your states) the treasury and its powers. */
function StateGovernment({ id }: { id: string }) {
  const game = useGame((s) => s.game)!;
  const { statePower, reshuffleState } = useGame();
  const g = game.stateGov[id];
  const person = (x: number | null) => game.people.find((p) => p.id === x);
  const mb = person(g.mb);
  const mine = g.ruler === game.player;
  return (
    <div className="inset p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="eyebrow">State government</h3>
        <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
          <CoalitionFlag game={game} c={g.ruler} size={10} />
          {[g.ruler, ...g.partners].map(cshort).join(" + ")}
        </span>
      </div>
      <div className="text-sm">
        <Term word={mbTitle(id)} />: <b>{mb ? mb.name : "vacant"}</b>
        {mb && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {" "}
            · {mb.party} · competence {Math.round(mb.competence)}
            {mine ? ` · trust ${Math.round(mb.loyalty)}` : ""}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {g.exco.map((x) => {
          const p = person(x);
          return p ? (
            <span key={x} className="trait-chip inline-flex items-center gap-1" title={`${p.party} · competence ${Math.round(p.competence)}`}>
              <PartyFlag id={p.party} size={9} />
              {p.name}
            </span>
          ) : null;
        })}
      </div>
      {mine && (
        <>
          <div className="text-xs" style={{ color: "var(--ink-2)" }}>
            State treasury: <b>{fmtRM(g.funds)}</b>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATE_POWERS) as StatePower[]).map((k) => {
              const why = statePowerBlocked(game, id, k);
              return (
                <button key={k} className="btn btn-ghost" disabled={!!why} title={why ?? STATE_POWERS[k].text} onClick={() => statePower(id, k)}>
                  {STATE_POWERS[k].name}
                </button>
              );
            })}
            <button className="btn btn-ghost" onClick={() => reshuffleState(id)}>
              Reshuffle the exco
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Every party's general in this state. */
function StateChiefs({ id }: { id: string }) {
  const game = useGame((s) => s.game)!;
  const region = regionOf(id);
  const rows = Object.keys(game.posts)
    .map((party) => ({ party, p: postHolder(game, party, chiefKey(region)) }))
    .filter((r) => r.p)
    .sort((a, b) => b.p!.competence - a.p!.competence);
  if (!rows.length) return null;
  const yours = game.coalitions[game.player].members[0];
  return (
    <details className="inset px-3 py-2">
      <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
        Party chiefs in {STATE_BY_ID[id].name} ({rows.length})
      </summary>
      <div className="mt-2 flex flex-col gap-1">
        {rows.map(({ party, p }) => (
          <div key={party} className="text-xs flex items-center gap-2">
            <PartyFlag id={party} size={10} />
            <span className="w-14 font-semibold">{party}</span>
            <span className={party === yours ? "font-semibold" : ""}>{p!.name}</span>
            <span style={{ color: "var(--muted)" }}>
              comp {Math.round(p!.competence)}
              {homeOf(p!) !== region ? " · parachuted" : ""}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
