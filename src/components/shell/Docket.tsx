"use client";

import { useMemo, useState } from "react";
import { advise } from "@/game/advice";
import { inWeeks, upcoming } from "@/game/calendar";
import { CARD_BY_KIND } from "@/game/systems/events";
import { objectiveMet } from "@/game/systems/goals";
import { BUBBLE_INFO } from "@/game/systems/bubbles";
import { weekLabel } from "@/game/state";
import { useGame } from "@/store/gameStore";
import { SEATS } from "@/game/world";
import { ReportBody } from "./WeekReview";

const TONE = { good: "var(--good)", bad: "var(--bad)", info: "var(--brass)" } as const;

/**
 * The start of every turn: what needs you, the advisor's best moves, the opportunities on the map, your objectives, and
 * how last turn went. Ends with the End turn button.
 */
export function Docket({ compact }: { compact?: boolean }) {
  const game = useGame((s) => s.game)!;
  const { skipWeek, unsnooze, showPanel, focusSeat, focusState, act, snoozed, budgetSnoozed } = useGame();
  const [showLast, setShowLast] = useState(false);
  const tips = useMemo(() => advise(game).slice(0, 3), [game]);
  const soon = useMemo(() => upcoming(game).filter((x) => x.urgent), [game]);
  const president = game.career.rung >= 6;

  // Needs you: decisions first, then deadlines you act on.
  const needs: { key: string; text: string; go: () => void; label: string; hot?: boolean }[] = [];
  for (const c of game.cards) needs.push({ key: `card${c.id}`, text: CARD_BY_KIND[c.kind]?.title ?? "A decision", go: unsnooze, label: "Decide", hot: !snoozed.includes(c.id) });
  if (game.budgetDue !== null) needs.push({ key: "budget", text: "The Budget is due", go: () => (budgetSnoozed ? unsnooze() : showPanel("policy")), label: "Open", hot: true });
  for (const x of soon) {
    if (x.key === "budget") continue;
    if (x.key === "nom" && !president) continue;
    needs.push({
      key: x.key,
      text: `${x.label}: ${inWeeks(x.weeks)}`,
      go: () => {
        showPanel(x.panel);
        if (x.state) focusState(x.state);
      },
      label: x.key === "nom" ? "Name candidates" : "Go",
      hot: x.key === "nom" || x.weeks <= 1,
    });
  }

  const bubbles = game.bubbles;
  const [bubbleAt, setBubbleAt] = useState(0);
  const pending = game.cards.length + (game.budgetDue !== null ? 1 : 0);
  const ready = game.me.ap === 0 && !pending;

  return (
    <aside className={`docket panel songket-bg flex flex-col h-full ${compact ? "" : "w-full"}`} aria-label="Today's docket">
      <header className="px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="eyebrow">Today&apos;s docket</div>
        <div className="dossier-title text-lg leading-tight">
          Week {game.week + 1} · {weekLabel(game.week)}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3 flex flex-col gap-4 text-sm">
        <section className="flex flex-col gap-1.5">
          <h3 className="eyebrow">Needs you</h3>
          {needs.length === 0 && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Nothing waiting. Spend your AP on the map, then end the turn.
            </p>
          )}
          {needs.map((n) => (
            <div key={n.key} className={`docket-item ${n.hot ? "docket-hot" : ""}`}>
              <span className="flex-1 min-w-0">{n.text}</span>
              <button className="btn-ghost btn !px-2.5 !py-1 !text-xs flex-none" onClick={n.go}>
                {n.label}
              </button>
            </div>
          ))}
        </section>

        {tips.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="eyebrow">Advisor</h3>
            {tips.map((t, i) => (
              <div key={i} className="docket-item">
                <span aria-hidden style={{ color: TONE[t.tone] }}>
                  {t.tone === "bad" ? "▼" : t.tone === "good" ? "▲" : "◆"}
                </span>
                <span className="flex-1 min-w-0 text-xs leading-snug" style={{ color: "var(--ink-2)" }}>
                  {t.text}
                </span>
                {t.action && (
                  <button
                    className="btn !px-2.5 !py-1 !text-xs flex-none"
                    onClick={() => {
                      if (t.action!.target.kind === "seat") focusSeat(t.action!.target.seat);
                      act(t.action!.id, t.action!.target);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        {bubbles.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className="eyebrow">On the map</h3>
            <div className="docket-item">
              <span className="flex-1 min-w-0 text-xs" style={{ color: "var(--ink-2)" }}>
                {bubbles.length} opportunit{bubbles.length === 1 ? "y" : "ies"} this week. Next: {BUBBLE_INFO[bubbles[bubbleAt % bubbles.length].kind].title} in{" "}
                {SEATS[bubbles[bubbleAt % bubbles.length].seat].name}.
              </span>
              <button
                className="btn-ghost btn !px-2.5 !py-1 !text-xs flex-none"
                onClick={() => {
                  focusSeat(bubbles[bubbleAt % bubbles.length].seat);
                  setBubbleAt((k) => k + 1);
                }}
              >
                Show
              </button>
            </div>
          </section>
        )}

        {game.objectives.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="eyebrow">This term&apos;s objectives</h3>
            {game.objectives.map((o) => {
              const done = o.done || objectiveMet(game, o);
              return (
                <div key={o.id} className="flex gap-2 text-xs" style={{ color: done ? "var(--good)" : "var(--ink-2)" }}>
                  <span aria-hidden>{done ? "✓" : "○"}</span>
                  <span>{o.text}</span>
                </div>
              );
            })}
          </section>
        )}

        {game.report && (
          <section className="flex flex-col gap-1.5">
            <button className="eyebrow text-left" onClick={() => setShowLast((v) => !v)} aria-expanded={showLast}>
              {showLast ? "▾" : "▸"} Last turn
            </button>
            {showLast && <ReportBody report={game.report} limit={8} />}
          </section>
        )}
      </div>

      <footer className="p-3" style={{ borderTop: "1px solid var(--line)" }}>
        <button className={`btn w-full !py-3 text-base flex items-center justify-center gap-2 ${ready ? "btn-ready" : ""}`} onClick={skipWeek} title="End turn: two weeks (N or Space)">
          <span className="dossier-title">End turn</span>
          <span aria-hidden>▸</span>
        </button>
        <div className="text-center text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
          {game.me.ap} of {game.me.apMax} AP left · press N
        </div>
      </footer>
    </aside>
  );
}
