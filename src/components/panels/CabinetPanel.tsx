"use client";

import { useState } from "react";
import { PORTFOLIOS, type PortfolioId } from "@/game/data/people";
import { KPIS, KPI_INFO, shadowBoost } from "@/game/systems/agenda";
import { PORTFOLIO_KPI, ministerEffect } from "@/game/systems/nation";
import { byId } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { Cabinet } from "./PeoplePanel";

/** In government: the cabinet and what each minister does to the numbers. In opposition: your shadow cabinet. */
export function CabinetPanel() {
  const game = useGame((s) => s.game)!;
  const [open, setOpen] = useState<number | null>(null);
  if (!game.government.includes(game.player)) return <ShadowCabinet />;
  return (
    <div className="flex flex-col gap-5">
      <Cabinet open={open} onOpen={setOpen} />
      <Ministers />
    </div>
  );
}

/** Each minister moves one number by how good they are. */
function Ministers() {
  const game = useGame((s) => s.game)!;
  const rows = PORTFOLIOS.filter((p) => PORTFOLIO_KPI[p.id]);
  return (
    <section>
      <h3 className="eyebrow mb-2">Ministers and their numbers</h3>
      <ul className="grid gap-1 @md:grid-cols-2">
        {rows.map((port) => {
          const p = byId(game, game.cabinet[port.id]);
          const e = ministerEffect(game, port.id);
          return (
            <li key={port.id} className="inset px-2.5 py-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate" style={{ color: "var(--muted)" }}>
                  {port.name}
                </span>
                <span className="tabular-nums whitespace-nowrap" style={{ color: e > 0.1 ? "var(--good)" : e < -0.1 ? "var(--bad)" : "var(--ink-2)" }}>
                  {e > 0.1 ? "▲" : e < -0.1 ? "▼" : "•"} {PORTFOLIO_KPI[port.id]}
                </span>
              </div>
              <div className="truncate">
                {p ? (
                  <>
                    {p.name} <span style={{ color: "var(--muted)" }}>· competence {Math.round(p.competence)}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--bad)" }}>Vacant</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
        Competence above 60 helps, below it hurts; an empty ministry hurts most.
      </p>
    </section>
  );
}

const SHADOW_POSTS: PortfolioId[] = [...new Set([...KPIS.map((k) => KPI_INFO[k].post), "health", "education", "home"] as PortfolioId[])];

/** Your shadow cabinet: who leads the attack on each number. */
function ShadowCabinet() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const parties = game.coalitions[game.player].members;
  const pool = game.people.filter((p) => parties.includes(p.party) && p.seat !== null && !p.retired && p.id !== game.youId).sort((a, b) => b.competence - a.competence);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Your shadow ministers lead the attack on their numbers: the more competent they are, the harder your attacks and investigations land. Being named raises
        their loyalty to you.
      </p>
      <ul className="flex flex-col gap-1">
        {SHADOW_POSTS.map((post) => {
          const p = byId(game, game.opp.shadow[post]);
          const kpis = KPIS.filter((k) => KPI_INFO[k].post === post).map((k) => KPI_INFO[k].label);
          return (
            <li key={post} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_44px] items-center gap-2 text-xs">
              <span className="truncate" style={{ color: "var(--muted)" }} title={kpis.join(", ")}>
                Shadow {PORTFOLIOS.find((x) => x.id === post)!.name}
                {kpis.length ? <span className="block text-[10px]">{kpis.join(", ")}</span> : null}
              </span>
              <select
                value={p?.id ?? ""}
                onChange={(e) => deep({ kind: "shadow", post, id: e.target.value ? Number(e.target.value) : null })}
                className="rounded-md px-1.5 py-1 text-xs min-w-0"
                style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
              >
                <option value="">— Nobody —</option>
                {pool.map((x) => (
                  <option key={x.id} value={x.id} style={{ background: "var(--raised)" }}>
                    {x.party} · {x.name} · competence {Math.round(x.competence)}
                  </option>
                ))}
              </select>
              <span className="tabular-nums text-right" style={{ color: "var(--ink-2)" }} title="Attack strength">
                ×{shadowBoost(game, post).toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
