"use client";

import { useGame } from "@/store/gameStore";
import { CARD_BY_KIND, describeEffect } from "@/game/systems/events";

/** Decision cards waiting for an answer, each with its choices and their numbers. */
export function DecisionCards() {
  const game = useGame((s) => s.game)!;
  const answer = useGame((s) => s.answer);
  if (!game.cards.length) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {game.cards.map((card) => {
        const def = CARD_BY_KIND[card.kind];
        const choices = def.choices(game, card);
        const left = card.deadline - game.week;
        return (
          <article key={card.id} className="panel p-4 flex flex-col gap-2" style={{ borderLeft: "4px solid var(--accent)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{def.title}</h3>
              <span className="text-[11px] whitespace-nowrap" style={{ color: left <= 1 ? "var(--bad)" : "var(--muted)" }}>
                {left <= 1 ? "Decide this week" : `${left} weeks to decide`}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              {def.text(game, card)}
            </p>
            <div className="flex flex-col gap-1.5">
              {choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => answer(card.id, i)}
                  className="card card-action text-left rounded-lg border p-2.5"
                  style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
                >
                  <div className="text-sm font-semibold">
                    {c.label}
                    {i === def.defaultChoice && (
                      <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                        default if you don&apos;t decide
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                    {describeEffect(c.effect)}
                  </div>
                  {c.note && (
                    <div className="text-[11px] mt-0.5 italic" style={{ color: "var(--muted)" }}>
                      {c.note}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
