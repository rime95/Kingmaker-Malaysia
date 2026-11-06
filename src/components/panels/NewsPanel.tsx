"use client";

import { useState } from "react";
import { useGame } from "@/store/gameStore";
import { weekDate } from "@/game/state";

const COLOR = { good: "var(--good)", bad: "var(--bad)", info: "var(--ink-2)" };
const FILTERS = ["All", "Good", "Bad"] as const;

/** The news: every story and report kept, newest first, front page on top. */
export function NewsPanel() {
  const game = useGame((s) => s.game)!;
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const items = (game.news ?? []).filter((n) => f === "All" || n.tone === f.toLowerCase());
  const [lead, ...rest] = items;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {FILTERS.map((x) => (
          <button key={x} className="chip !py-1 text-xs" aria-pressed={f === x} onClick={() => setF(x)}>
            {x}
          </button>
        ))}
      </div>
      {!lead && (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Nothing in the papers yet. End a turn and the news starts here.
        </p>
      )}
      {lead && (
        <article className="inset p-3">
          <div className="eyebrow">
            {lead.paper} · {weekDate(lead.week).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <h3 className="dossier-title text-lg mt-1" style={{ color: COLOR[lead.tone] }}>
            {lead.text}
          </h3>
        </article>
      )}
      <ul className="flex flex-col gap-1">
        {rest.map((n, i) => (
          <li key={`${n.week}${i}`} className="text-xs px-2 py-1.5 rounded-md" style={{ background: "var(--surface-2)" }}>
            <span style={{ color: "var(--muted)" }}>
              {n.paper} · {weekDate(n.week).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}:{" "}
            </span>
            <span style={{ color: COLOR[n.tone] }}>{n.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
