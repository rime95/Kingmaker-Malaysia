"use client";

import { useEffect, useMemo, useState } from "react";
import { MalaysiaMap } from "./map/MalaysiaMap";
import { DUNS, DUNS_BY_STATE } from "@/game/systems/dun";
import { mbTitle } from "@/game/systems/stategov";
import { hash01 } from "@/game/rng";
import { useGame } from "@/store/gameStore";
import { SEATS, STATE_BY_ID, cshort, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor } from "./common";
import { sfx } from "./audio";
import { CoalitionFlag, JalurGemilang } from "./flags";
import { Term } from "./Term";

/** Milliseconds per assembly seat at 1×. */
const STEP_MS = 140;
const LAND = SEATS.map(() => ({ fill: "var(--land)" }));

/**
 * A state election night: the assembly seats come in one by one, the map fills in, the race to a majority, then who
 * forms the government and who will be Menteri Besar. The results are already in the engine; this only reveals them.
 */
export function StateNight() {
  const game = useGame((s) => s.game)!;
  const endStateNight = useGame((s) => s.endStateNight);
  const night = game.stateNight!;
  const player = game.player;
  const [pick, setPick] = useState(night.states[0]);
  const order = useMemo(
    () => night.states.flatMap((id) => DUNS_BY_STATE[id]).sort((a, b) => hash01("dunorder", night.week, a) - hash01("dunorder", night.week, b)),
    [night],
  );
  const [k, setK] = useState(0);
  const [speed, setSpeed] = useState(1);
  const done = k >= order.length;
  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setK((x) => Math.min(order.length, x + 1)), STEP_MS / speed);
    return () => clearTimeout(id);
  });
  useEffect(() => {
    if (!done) return;
    sfx("majority");
  }, [done]);
  const revealed = useMemo(() => new Set(order.slice(0, k)), [order, k]);
  const dunFills = useMemo(() => DUNS.map((d) => (revealed.has(d.index) ? coalColor(game.dunHolders[d.index]) : night.states.includes(d.state) ? "var(--land)" : null)), [revealed, game.dunHolders, night.states]);
  const [focus, setFocus] = useState(() => ({ kind: "state" as const, id: night.states[0], nonce: 1 }));

  const ids = DUNS_BY_STATE[pick];
  const total = ids.length;
  const need = Math.floor(total / 2) + 1;
  const counts = Object.fromEntries(CHART_ORDER.map((c) => [c, 0])) as Record<CoalitionId, number>;
  let held = 0;
  let gained = 0;
  let lost = 0;
  for (const d of ids) {
    if (!revealed.has(d)) continue;
    const w = game.dunHolders[d];
    counts[w]++;
    if (w === player) night.prev[d] === player ? held++ : gained++;
    else if (night.prev[d] === player) lost++;
  }
  const called = ids.filter((d) => revealed.has(d)).length;
  const allIn = called === total;
  const g = game.stateGov[pick];
  const mb = game.people.find((p) => p.id === g?.mb);
  const hung = game.stateTalks?.state === pick;
  const leader = CHART_ORDER.filter((c) => counts[c] > 0).sort((a, b) => counts[b] - counts[a]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto tv" role="dialog" aria-modal="true" aria-label="State election night">
      <div className="tv-studio" aria-hidden>
        <span className="tv-beam tv-beam-l" />
        <span className="tv-beam tv-beam-r" />
      </div>
      <header className="tv-bar sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="tv-live">
          <span className="tv-live-dot" /> LIVE
        </span>
        <JalurGemilang height={20} wave />
        <div className="leading-tight">
          <div className="text-[11px] font-bold tracking-[0.2em] tv-gold">
            <Term word="PRN" /> · PILIHAN RAYA NEGERI
          </div>
          <div className="text-lg font-black tabular-nums">{done ? "All seats declared" : `${k} / ${order.length} declared`}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!done && (
            <>
              <button className="btn btn-ghost" onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))}>
                Speed {speed}×
              </button>
              <button className="btn btn-ghost" onClick={() => setK(order.length)}>
                Skip to the end
              </button>
            </>
          )}
          {done && (
            <button className="btn btn-ready" onClick={endStateNight}>
              Continue
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1200px] px-4 py-3 flex flex-col gap-3 relative">
        {night.states.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {night.states.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={pick === id}
                className="chip"
                data-on={pick === id}
                onClick={() => {
                  setPick(id);
                  setFocus((f) => ({ kind: "state", id, nonce: f.nonce + 1 }));
                }}
              >
                {STATE_BY_ID[id].name}
              </button>
            ))}
          </div>
        )}

        <section className="panel p-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-black">{STATE_BY_ID[pick].name}</h2>
            <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
              {called} of {total} declared · {need} for a majority
            </span>
          </div>
          {/* Race to the majority line */}
          <div className="flex flex-col gap-1">
            {leader.slice(0, 5).map((c) => (
              <div key={c} className="flex items-center gap-2 text-xs">
                <CoalitionFlag game={game} c={c} size={12} />
                <span className="w-16 font-semibold truncate">{cshort(c)}</span>
                <span className="relative flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <span className="absolute inset-y-0 left-0 transition-all" style={{ width: `${(counts[c] / total) * 100}%`, background: coalColor(c), boxShadow: c === player ? "0 0 8px var(--gold)" : undefined }} />
                  <span className="absolute inset-y-0 w-0.5" style={{ left: `${(need / total) * 100}%`, background: "var(--gold)" }} />
                </span>
                <span className="w-8 text-right font-black tabular-nums">{counts[c]}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="panel p-2">
            <MalaysiaMap className="relative w-full aspect-[16/10] max-h-[58vh] min-h-[240px]" clip fills={LAND} dunFills={dunFills} showDuns="always" focus={focus} controls={false} ariaLabel="State seats declared so far" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="panel p-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Kekal · held" value={held} />
              <Stat label="Rampas · gained" value={gained} tone="var(--good)" />
              <Stat label="Terlepas · lost" value={lost} tone="var(--bad)" />
            </div>
            {allIn && (
              <div className="panel p-4 flex flex-col gap-1 tv-pop">
                <div className="eyebrow">{hung ? "Hung assembly" : "The new government"}</div>
                {hung ? (
                  <p className="text-sm">Nobody has a majority. You will try to put a coalition together.</p>
                ) : g ? (
                  <>
                    <div className="flex items-center gap-2">
                      <CoalitionFlag game={game} c={g.ruler} size={18} />
                      <span className="text-lg font-black">{cshort(g.ruler)} forms the government</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                      {g.ruler === player ? (
                        <>You will name the {mbTitle(pick)} and the exco next.</>
                      ) : (
                        <>
                          {mb ? mb.name : "A new leader"} ({g.party}) is set to be <Term word={mbTitle(pick)} />.
                        </>
                      )}
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-2xl font-black tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}
