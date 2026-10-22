"use client";

import { useMemo } from "react";
import { ACTION_BY_ID, actionBlocked, previewAction, type Target } from "@/game/actions";
import { hasOrder } from "@/game/systems/orders";
import { useGame } from "@/store/gameStore";
import { fmtRM } from "./common";

/** Groups whose moves can be standing orders (repeated every turn). */
const REPEATABLE = ["local", "national", "finance"];

/** One action: name, AP, cost, what it does, the model's estimate, and why it's unavailable. */
export function ActionCard({ id, target, compact = false, dense = false }: { id: string; target: Target; compact?: boolean; dense?: boolean }) {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const order = useGame((s) => s.order);
  const def = ACTION_BY_ID[id];
  const blocked = actionBlocked(game, def, target);
  const hidden = (def.only === "gov" && blocked === "Government only.") || (def.only === "opp" && blocked === "Opposition only.");
  const preview = useMemo(() => (blocked ? null : previewAction(game, id, target)), [game, id, target, blocked]);
  if (hidden) return null;
  const cost = def.cost(game, target);
  const standing = hasOrder(game, id, target);

  let estimate: string | null = null;
  if (preview && (def.group === "local" || def.group === "national")) {
    const pts = preview.share * 100;
    estimate = `≈ ${pts >= 0 ? "+" : ""}${pts.toFixed(2)} pts${target.kind === "seat" ? "" : " avg"}`;
    if (preview.seats) estimate += ` · ${preview.seats > 0 ? "+" : ""}${preview.seats} seat${Math.abs(preview.seats) === 1 ? "" : "s"}`;
  }

  if (dense)
    return (
      <div className="flex items-stretch gap-1">
        <button
          onClick={() => act(id, target)}
          disabled={!!blocked}
          title={blocked ?? def.blurb}
          className="card card-action flex-1 min-w-0 text-left rounded-lg px-2.5 py-1.5 border disabled:cursor-not-allowed flex items-center gap-2"
          style={{ borderColor: standing ? "var(--accent)" : "var(--line)", background: "var(--surface-2)", opacity: blocked ? 0.55 : 1 }}
        >
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-[13px] truncate">{def.name}</span>
            <span className="block text-[10.5px] truncate" style={{ color: blocked ? "var(--muted)" : "var(--ink-2)" }}>
              {blocked ?? estimate ?? def.blurb}
            </span>
          </span>
          <span className="text-[10.5px] tabular-nums whitespace-nowrap text-right" style={{ color: "var(--ink-2)" }}>
            {def.ap} AP
            <br />
            {cost ? fmtRM(cost) : ""}
          </span>
        </button>
        {REPEATABLE.includes(def.group) && (
          <button
            className="rounded-lg px-2 text-xs"
            onClick={() => order(id, target)}
            title={standing ? "Standing order: runs every turn. Click to cancel." : "Repeat this every turn (standing order)"}
            aria-pressed={standing}
            style={{ background: standing ? "var(--accent)" : "transparent", color: standing ? "var(--bg)" : "var(--muted)", border: "1px solid var(--line)" }}
          >
            ↻
          </button>
        )}
      </div>
    );

  return (
    <div className="relative">
      <button
        onClick={() => act(id, target)}
        disabled={!!blocked}
        title={def.blurb}
        className="card card-action w-full text-left rounded-lg p-2.5 border disabled:cursor-not-allowed"
        style={{
          borderColor: standing ? "var(--accent)" : "var(--line)",
          background: "var(--surface-2)",
          opacity: blocked ? 0.55 : 1,
        }}
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
        <div className="text-[11px] mt-1 font-medium pr-16" style={{ color: blocked ? "var(--muted)" : "var(--ink)" }}>
          {blocked ?? estimate ?? " "}
        </div>
      </button>
      {REPEATABLE.includes(def.group) && (
        <button
          className="absolute bottom-1.5 right-1.5 rounded-md px-1.5 text-[11px] leading-5"
          onClick={() => order(id, target)}
          title={standing ? "Standing order: runs at the start of every turn. Click to cancel." : "Repeat this every turn (standing order)"}
          aria-pressed={standing}
          style={{
            background: standing ? "var(--accent)" : "transparent",
            color: standing ? "var(--bg)" : "var(--muted)",
            border: "1px solid var(--line)",
          }}
        >
          ↻{standing ? " every turn" : ""}
        </button>
      )}
    </div>
  );
}
