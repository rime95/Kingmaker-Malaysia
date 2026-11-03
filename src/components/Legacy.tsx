"use client";

import { useEffect } from "react";
import { legacyOf } from "@/game/systems/legacy";
import { useGame } from "@/store/gameStore";
import { weekLabel } from "@/game/state";
import { sfx } from "./audio";
import { CoalitionFlag, JalurGemilang } from "./flags";

/** The end of a leader's road: what they won, how long they ruled, and what they leave behind. */
export function Legacy() {
  const game = useGame((s) => s.game)!;
  const { leaveLegacy, quit } = useGame();
  const l = legacyOf(game);
  const ousted = game.ending?.reason === "ousted";
  useEffect(() => {
    sfx("fanfare");
  }, []);
  const initials = l.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Your legacy">
      <div className="modal-card max-w-3xl w-full flex flex-col gap-4 tv-pop">
        {/* The next morning's front page */}
        <div className="legacy-paper">
          <div className="flex items-center justify-between text-xs font-bold tracking-widest">
            <span>BERITA RAKYAT</span>
            <span>{weekLabel(game.week)}</span>
          </div>
          <h2 className="legacy-headline">{l.headline}</h2>
        </div>

        <div className="flex items-center gap-4">
          <span className="party-avatar !w-16 !h-16 !text-xl" style={{ background: "var(--c-" + game.player + ")" }} aria-hidden>
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <JalurGemilang height={16} />
              <CoalitionFlag game={game} c={game.player} size={16} />
            </div>
            <div className="text-2xl font-black mt-1">{l.name}</div>
            <div className="tv-gold font-bold">{l.title}</div>
            <div className="text-sm" style={{ color: "var(--ink-2)" }}>
              {l.rung} · aged {l.age} · generation {l.generation} of your dynasty
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <Stat label="General elections" value={l.elections} />
          <Stat label="Won as PM" value={l.wins} />
          <Stat label="Two-thirds majorities" value={l.twoThirds} />
          <Stat label="Time as PM" value={l.timeAsPm} />
          <Stat label="Best seat haul" value={l.bestSeats} />
          <Stat label="Achievements" value={l.achievements.length} />
          <Stat label="Legacy goals" value={`${l.goals.filter((g) => g.done).length}/${l.goals.length}`} />
          <Stat label="Weeks played" value={game.week} />
        </div>

        {l.achievements.length > 0 && (
          <section>
            <h3 className="eyebrow mb-1.5">Achievements</h3>
            <div className="flex flex-wrap gap-1.5">
              {l.achievements.map((a) => (
                <span key={a.name} className="trait-chip" title={a.text}>
                  🏅 {a.name}
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="eyebrow mb-1.5">Legacy goals</h3>
          <div className="flex flex-wrap gap-1.5">
            {l.goals.map((g) => (
              <span key={g.name} className="trait-chip" style={{ opacity: g.done ? 1 : 0.5 }}>
                {g.done ? "✓" : "○"} {g.name}
              </span>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-2 justify-end">
          <button className="btn btn-ghost" onClick={() => confirm("Start a new game? Save this one first if you want to keep it.") && quit()}>
            New game
          </button>
          <button className="btn" onClick={leaveLegacy}>
            {ousted ? "Fight on from the ranks" : `Continue as ${game.career.protege}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="inset px-2 py-2">
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}
