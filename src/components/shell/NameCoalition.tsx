"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { PALETTE, colorFree } from "@/game/systems/coalitions";
import { useGame } from "@/store/gameStore";

/** Name your coalition: shown once after you take power, and from the Party panel any time you lead the party. */
export function NameCoalition({ onClose }: { onClose?: () => void }) {
  const game = useGame((s) => s.game)!;
  const { rename, keepName } = useGame();
  const mine = game.coalitions[game.player];
  const [name, setName] = useState(mine.name);
  const [short, setShort] = useState(mine.short);
  const [color, setColor] = useState(mine.color);
  const close = () => {
    keepName();
    onClose?.();
  };

  // Rendered on <body>: panels use backdrop blur, which would trap a fixed overlay inside them.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgb(5 7 14 / 0.65)" }} onClick={close}>
      <div className="panel pop-in w-full max-w-md p-5 flex flex-col gap-4" role="dialog" aria-label="Name your coalition" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="eyebrow">{game.namePending ? "You won" : "Your coalition"}</div>
          <h2 className="text-xl font-bold mt-1">Name your coalition</h2>
          <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
            Keep the brand voters know, or launch a new one. The name and colour show on the map, the Dewan and Election Night.
          </p>
        </div>
        <label className="text-sm flex flex-col gap-1">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="rounded-lg px-3 py-2" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }} />
        </label>
        <label className="text-sm flex flex-col gap-1">
          Short name
          <input value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} maxLength={8} className="rounded-lg px-3 py-2 w-32" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }} />
        </label>
        <div className="text-sm flex flex-col gap-1.5">
          Colour
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((p) => {
              const free = colorFree(game, p, game.player);
              return (
                <button
                  key={p}
                  disabled={!free}
                  onClick={() => setColor(p)}
                  aria-label={`Colour ${p}${free ? "" : " (taken)"}`}
                  aria-pressed={color === p}
                  title={free ? p : "Too close to another coalition's colour"}
                  className="w-8 h-8 rounded-full"
                  style={{ background: p, opacity: free ? 1 : 0.2, outline: color === p ? "2px solid var(--ink)" : "none", outlineOffset: 2, cursor: free ? "pointer" : "not-allowed" }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="swatch" style={{ background: color, width: 14, height: 14 }} />
          <span className="font-semibold">{name || "…"}</span>
          <span style={{ color: "var(--muted)" }}>{short}</span>
        </div>
        <div className="flex gap-2">
          <button
            className="btn"
            onClick={() => {
              rename(name, short, color);
              onClose?.();
            }}
          >
            Save
          </button>
          <button className="btn btn-ghost" onClick={close}>
            Keep {mine.short}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
