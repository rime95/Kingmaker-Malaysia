"use client";

import { useGame } from "@/store/gameStore";
import { COALITION_INFO, SEATS, type CoalitionId } from "@/game/world";
import { coalColor } from "./common";

const PLAYABLE: CoalitionId[] = ["PH", "BN", "PN", "GPS", "GRS", "WARISAN", "MUDA"];

export function NewGame() {
  const start = useGame((s) => s.start);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Malam Pilihan Raya</h1>
        <p className="mt-2" style={{ color: "var(--ink-2)" }}>
          Build your power base, hold what you have and win election night. Pick the coalition you will lead.
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Data snapshot: Oct 2026 leaders, GE15 seat results.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAYABLE.map((c) => {
          const info = COALITION_INFO[c];
          const seats = SEATS.filter((s) => s.ge15Coalition === c).length;
          return (
            <button key={c} onClick={() => start(c)} className="panel p-4 text-left hover:shadow-md transition-shadow" style={{ borderLeft: `5px solid ${coalColor(c)}` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{info.name}</span>
                <span className="text-sm tabular-nums" style={{ color: "var(--ink-2)" }}>
                  {seats} seats
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {info.leader} · {info.inGovernment ? "Government" : "Opposition"}
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
                {info.blurb}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
