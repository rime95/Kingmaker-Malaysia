"use client";

import { useEffect, useMemo } from "react";
import { PORTFOLIOS, type PortfolioId } from "@/game/data/people";
import { PORTFOLIO_KPI } from "@/game/systems/nation";
import { cabinetPool, draftFairness } from "@/game/systems/newterm";
import { byId, type Person } from "@/game/systems/people";
import { TRAITS, profileOf } from "@/game/systems/profiles";
import { useGame } from "@/store/gameStore";
import { PARTIES } from "@/game/world";
import { sfx } from "./audio";
import { JalurGemilang, PartyFlag } from "./flags";

/** After an election you win as Prime Minister: you are sworn in, then you pick every minister. */
export function NewTerm() {
  const game = useGame((s) => s.game)!;
  const { draftPost, suggestCabinet, swearIn } = useGame();
  const t = game.newTerm!;
  const pool = useMemo(() => cabinetPool(game), [game]);
  const fair = draftFairness(game);
  const you = byId(game, game.youId);
  useEffect(() => {
    sfx("fanfare");
  }, []);
  const filled = PORTFOLIOS.filter((p) => t.draft[p.id]).length;
  const parties = Object.keys(fair).sort((a, b) => fair[a] - fair[b]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto tv" role="dialog" aria-label="Form your cabinet">
      <div className="mx-auto max-w-[1100px] px-4 py-6 flex flex-col gap-4">
        <header className="panel p-5 text-center flex flex-col items-center gap-2 relative overflow-hidden">
          <JalurGemilang height={34} wave />
          <div className="text-[11px] font-bold tracking-[0.3em] tv-gold">ISTANA NEGARA · ANGKAT SUMPAH</div>
          <h2 className="text-2xl md:text-3xl font-black">{game.career.name}, Prime Minister of Malaysia</h2>
          <p className="text-sm max-w-xl" style={{ color: "var(--ink-2)" }}>
            You have taken the oath before the Agong. Now name your cabinet: every post is yours to fill. Give partners a fair share of the posts or they will
            sulk, and leave out a heavyweight at your peril.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
          <section className="panel p-3 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="eyebrow">Your cabinet · {filled} of {PORTFOLIOS.length} posts</h3>
              <button className="chip text-xs" onClick={suggestCabinet}>
                Use the suggested cabinet
              </button>
            </div>
            {PORTFOLIOS.map((port) => {
              const p = byId(game, t.draft[port.id]);
              return (
                <div key={port.id} className="inset px-2.5 py-2 grid gap-2 md:grid-cols-[170px_minmax(0,1fr)] items-center">
                  <div className="text-xs min-w-0">
                    <div className="font-semibold truncate">{port.name}</div>
                    {PORTFOLIO_KPI[port.id] && <div style={{ color: "var(--muted)" }}>Moves: {PORTFOLIO_KPI[port.id]}</div>}
                  </div>
                  {port.id === "pm" ? (
                    <Minister p={you} />
                  ) : (
                    <div className="flex flex-col gap-1 min-w-0">
                      <select
                        value={p?.id ?? ""}
                        onChange={(e) => draftPost(port.id as PortfolioId, e.target.value ? Number(e.target.value) : null)}
                        className="rounded-md px-1.5 py-1 text-xs min-w-0"
                        style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
                        aria-label={port.name}
                      >
                        <option value="">— Vacant —</option>
                        {port.id === "finance" && you && <option value={you.id}>You ({you.name}), PM and Finance</option>}
                        {pool
                          .filter((x) => x.id !== game.youId)
                          .map((x) => (
                            <option key={x.id} value={x.id} style={{ background: "var(--raised)" }}>
                              {x.party} · {x.name} · competence {Math.round(x.competence)}
                              {x.seat === null ? " (not an MP)" : ""}
                              {x.chairman ? " · Chairman" : ""}
                            </option>
                          ))}
                      </select>
                      {p && <Minister p={p} />}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
            <section className="panel p-3 flex flex-col gap-2">
              <h3 className="eyebrow">Fair shares</h3>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                Posts each party holds against what its seats earn. Below the line, they feel shortchanged.
              </p>
              {parties.map((party) => {
                const f = fair[party];
                return (
                  <div key={party} className="text-xs flex items-center gap-2">
                    <PartyFlag id={party} size={11} />
                    <span className="w-16 truncate font-semibold" title={PARTIES[party]?.name}>
                      {party}
                    </span>
                    <span className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <span className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (f / 1.6) * 100)}%`, background: f >= 0.9 ? "var(--good)" : f >= 0.6 ? "var(--accent)" : "var(--bad)" }} />
                      <span className="absolute inset-y-0 w-px" style={{ left: `${(0.9 / 1.6) * 100}%`, background: "#fff" }} />
                    </span>
                    <span className="w-10 text-right tabular-nums">{Math.round(f * 100)}%</span>
                  </div>
                );
              })}
            </section>
            <button
              className="btn hero-cta"
              onClick={() => {
                sfx("majority");
                swearIn();
              }}
            >
              Bentuk kabinet · Swear them in
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Minister({ p }: { p: Person | undefined }) {
  const game = useGame((s) => s.game)!;
  if (!p) return null;
  const prof = profileOf(p);
  return (
    <div className="flex items-center gap-2 text-xs min-w-0">
      <PartyFlag id={p.party} size={11} />
      <span className="font-semibold truncate">
        {p.name}
        {p.id === game.youId ? " (you)" : ""}
      </span>
      <span className="whitespace-nowrap" style={{ color: "var(--muted)" }}>
        competence {Math.round(p.competence)} · loyalty {Math.round(p.loyalty)}
      </span>
      <span className="hidden md:flex gap-1 flex-wrap">
        {p.chairman && <span className="trait-chip">Chairman</span>}
        {p.id !== game.youId && prof.traits.map((tr) => (
          <span key={tr} className={`trait-chip ${TRAITS[tr].risk ? "trait-risk" : ""}`} title={TRAITS[tr].blurb}>
            {TRAITS[tr].name}
          </span>
        ))}
      </span>
    </div>
  );
}
