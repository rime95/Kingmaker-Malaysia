"use client";

import { useMemo } from "react";
import { useGame } from "@/store/gameStore";
import { winChance } from "@/game/systems/polls";
import { SEATS, STATE_BY_ID, contestingIn } from "@/game/world";
import { PactsCard } from "../PactsCard";
import { chancePct, useReads } from "../common";

/** Where the election will be decided: seats you could take, seats you could lose, and pacts to stop splitting the vote. */
export function BattlePanel() {
  const game = useGame((s) => s.game)!;
  const focusSeat = useGame((s) => s.focusSeat);
  const reads = useReads();
  const lists = useMemo(() => {
    const all = SEATS.filter((seat) => contestingIn(seat, game.entries).includes(game.player)).map((seat) => ({
      i: seat.index,
      chance: reads.length ? (winChance(reads[seat.index], game.player, game.week) ?? 0) : 0,
      mine: game.holders[seat.index] === game.player,
    }));
    return {
      targets: all.filter((x) => !x.mine && x.chance > 0.08).sort((a, b) => b.chance - a.chance).slice(0, 10),
      risk: all.filter((x) => x.mine && x.chance < 0.75).sort((a, b) => a.chance - b.chance).slice(0, 10),
    };
  }, [game, reads]);

  const list = (title: string, hint: string, rows: { i: number; chance: number }[]) => (
    <section>
      <h3 className="eyebrow mb-1">{title}</h3>
      <p className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
        {hint}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          None right now.
        </p>
      ) : (
        <ul className="grid gap-1 @md:grid-cols-2">
          {rows.map((x) => (
            <li key={x.i}>
              <button className="card inset w-full px-2.5 py-1.5 text-sm flex items-center gap-2 text-left" onClick={() => focusSeat(x.i)}>
                <span className="flex-1 truncate">
                  {SEATS[x.i].name} <span className="text-xs" style={{ color: "var(--muted)" }}>{STATE_BY_ID[SEATS[x.i].state].name}</span>
                </span>
                <span className="text-xs tabular-nums font-semibold" style={{ color: x.chance >= 0.5 ? "var(--good)" : "var(--bad)" }}>
                  {chancePct(x.chance)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      {list("Seats you could take", "Best chances first. Click one to fly there and act.", lists.targets)}
      {list("Seats you could lose", "Your own seats, shakiest first.", lists.risk)}
      <PactsCard />
    </div>
  );
}
