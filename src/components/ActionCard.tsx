"use client";

import { useMemo } from "react";
import { ACTION_BY_ID, actionBlocked, previewAction, type Target } from "@/game/actions";
import { useGame } from "@/store/gameStore";
import { fmtRM } from "./common";

/** One action: name, AP, cost, what it does, the model's estimate, and why it's unavailable. */
export function ActionCard({ id, target, compact = false }: { id: string; target: Target; compact?: boolean }) {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const def = ACTION_BY_ID[id];
  const blocked = actionBlocked(game, def, target);
  const hidden = (def.only === "gov" && blocked === "Government only.") || (def.only === "opp" && blocked === "Opposition only.");
  const preview = useMemo(() => (blocked ? null : previewAction(game, id, target)), [game, id, target, blocked]);
  if (hidden) return null;
  const cost = def.cost(game, target);

  let estimate: string | null = null;
  if (preview && (def.group === "local" || def.group === "national")) {
    const pts = preview.share * 100;
    estimate = `≈ ${pts >= 0 ? "+" : ""}${pts.toFixed(2)} pts${target.kind === "seat" ? "" : " avg"}`;
    if (preview.seats) estimate += ` · ${preview.seats > 0 ? "+" : ""}${preview.seats} seat${Math.abs(preview.seats) === 1 ? "" : "s"}`;
  }

  return (
    <button
      onClick={() => act(id, target)}
      disabled={!!blocked}
      title={def.blurb}
      className="card card-action text-left rounded-lg p-2.5 border disabled:cursor-not-allowed"
      style={{ borderColor: "var(--line)", background: "var(--surface-2)", opacity: blocked ? 0.55 : 1 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">{def.name}</span>
        <span className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
          {def.ap} AP{cost ? ` · ${fmtRM(cost)}` : ""}
        </span>
      </div>
      {!compact && (
        <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
          {def.blurb}
        </div>
      )}
      <div className="text-[11px] mt-1 font-medium" style={{ color: blocked ? "var(--muted)" : "var(--ink)" }}>
        {blocked ?? estimate ?? " "}
      </div>
    </button>
  );
}
