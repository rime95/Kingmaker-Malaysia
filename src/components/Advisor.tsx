"use client";

import { useMemo } from "react";
import { advise } from "@/game/advice";
import { useGame } from "@/store/gameStore";
import { useT } from "./i18n";

const TONE = { good: "var(--good)", bad: "var(--bad)", info: "var(--ink-2)" } as const;
const ICON = { good: "▲", bad: "▼", info: "•" } as const;

/** What deserves your attention this week, with one-click moves. */
export function Advisor() {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const t = useT();
  const tips = useMemo(() => advise(game), [game]);
  return (
    <section className="panel p-4">
      <h2 className="font-semibold mb-2">{t("advisor")}</h2>
      <ul className="flex flex-col gap-1.5">
        {tips.map((tip, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span aria-hidden style={{ color: TONE[tip.tone] }}>
              {ICON[tip.tone]}
            </span>
            <span className="flex-1 min-w-[220px]">{tip.text}</span>
            {tip.action && (
              <button className="chip" onClick={() => act(tip.action!.id, tip.action!.target)}>
                {tip.action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
