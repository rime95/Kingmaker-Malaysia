"use client";

import { useGame } from "@/store/gameStore";
import { LENSES, lensLegend } from "../map/lenses";

/** What the map is coloured by, with a one-line legend. */
export function LensBar() {
  const game = useGame((s) => s.game)!;
  const { lens, setLens } = useGame();
  const legend = lensLegend(game, lens);
  const current = LENSES.find((l) => l.id === lens)!;
  return (
    <div className="panel px-2 py-2 flex flex-col gap-1.5 max-w-full">
      <div className="flex gap-1 overflow-x-auto scroll-thin" role="radiogroup" aria-label="Map view">
        {LENSES.map((l) => {
          const disabled = (l.id === "result" && !game.lastElection) || (l.id === "swing" && !game.lastAnalysis);
          return (
            <button
              key={l.id}
              role="radio"
              aria-checked={lens === l.id}
              className="chip flex-none"
              data-on={lens === l.id}
              disabled={disabled}
              title={disabled ? (l.id === "swing" ? "After the next general election" : "Run a test election first (menu ⋯)") : l.label}
              style={disabled ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
              onClick={() => setLens(l.id)}
            >
              {l.short}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
        <span className="font-semibold" style={{ color: "var(--ink)" }}>
          {current.label}
        </span>
        {legend.items.map((it) => (
          <span key={it.label} className="inline-flex items-center gap-1">
            <span className="swatch" style={{ background: it.color, opacity: it.opacity ?? 1 }} />
            {it.label}
          </span>
        ))}
        {legend.note && <span style={{ color: "var(--muted)" }}>{legend.note}</span>}
      </div>
    </div>
  );
}
