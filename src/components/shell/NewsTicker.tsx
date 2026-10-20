"use client";

import { useGame } from "@/store/gameStore";
import { cshort, type CoalitionId } from "@/game/world";

/** Plague Inc-style headlines along the bottom. Hover pauses; click opens the week in review. */
export function NewsTicker() {
  const game = useGame((s) => s.game)!;
  const headlines = [
    ...(game.report?.lines ?? []).map((l) => ({ text: l.text, tone: l.tone ?? "info" })),
    ...(Object.entries(game.rivals) as [CoalitionId, NonNullable<(typeof game.rivals)[CoalitionId]>][])
      .filter(([, r]) => r.recent[0])
      .map(([c, r]) => ({ text: `${cshort(c)}: ${r.recent[0].replace(/^Week \d+: /, "")}`, tone: "info" as const })),
  ];
  if (game.bubbles.length) headlines.unshift({ text: `${game.bubbles.length} opportunit${game.bubbles.length === 1 ? "y" : "ies"} on the map this week: click the gold bubbles.`, tone: "good" });
  if (!headlines.length) headlines.push({ text: "Quiet week in Malaysian politics.", tone: "info" });
  const items = [...headlines, ...headlines]; // doubled for a seamless loop
  return (
    <button
      className="panel ticker w-full flex items-center gap-3 px-3 py-2 overflow-hidden text-left"
      onClick={() => useGame.setState({ reportOpen: true })}
      aria-label="News headlines. Click for the week in review."
    >
      <span className="eyebrow flex-none rounded-md px-2 py-0.5" style={{ background: "rgb(242 85 90 / 0.15)", color: "var(--bad)" }}>
        ● Live
      </span>
      <span className="flex-1 overflow-hidden">
        <span className="ticker-track text-sm">
          {items.map((h, i) => (
            <span key={i} style={{ color: h.tone === "bad" ? "var(--bad)" : h.tone === "good" ? "var(--good)" : "var(--ink-2)" }}>
              {h.tone === "bad" ? "▼ " : h.tone === "good" ? "▲ " : ""}
              {h.text}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
