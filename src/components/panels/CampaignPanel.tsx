"use client";

import { useMemo, useState } from "react";
import { advise } from "@/game/advice";
import { ACTIONS, type ActionGroup } from "@/game/actions";
import { useGame } from "@/store/gameStore";
import { SEATS, STATES } from "@/game/world";
import { ActionCard } from "../ActionCard";

const TONE = { good: "var(--good)", bad: "var(--bad)", info: "var(--ink-2)" } as const;
const ICON = { good: "▲", bad: "▼", info: "•" } as const;

const GROUPS: { id: ActionGroup; title: string }[] = [
  { id: "national", title: "Nationwide" },
  { id: "party", title: "Party" },
  { id: "finance", title: "Money" },
];

/** What to do this week: the advisor's picks, then every nationwide, party and money action. */
export function CampaignPanel() {
  const game = useGame((s) => s.game)!;
  const { act, focusSeat } = useGame();
  const tips = useMemo(() => advise(game).slice(0, 4), [game]);
  const [tourState, setTourState] = useState(STATES[0].id);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="eyebrow mb-2">Advisor</h3>
        <ul className="flex flex-col gap-2">
          {tips.map((tip, i) => (
            <li key={i} className="inset p-2.5 text-sm flex gap-2 items-start">
              <span aria-hidden style={{ color: TONE[tip.tone] }}>
                {ICON[tip.tone]}
              </span>
              <span className="flex-1">{tip.text}</span>
              {tip.action && (
                <button
                  className="chip flex-none"
                  onClick={() => {
                    const target = tip.action!.target;
                    if (target.kind === "seat") focusSeat(target.seat);
                    act(tip.action!.id, target);
                  }}
                  title={tip.action.target.kind === "seat" ? SEATS[tip.action.target.seat].name : undefined}
                >
                  {tip.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        For a single seat, click it on the map. Gold bubbles on the map are free bonuses this week.
      </p>

      {GROUPS.map((g) => (
        <section key={g.id}>
          <h3 className="eyebrow mb-2">{g.title}</h3>
          <div className="grid gap-2 @md:grid-cols-2">
            {ACTIONS.filter((a) => a.group === g.id && a.target === "none").map((a) => (
              <ActionCard key={a.id} id={a.id} target={{ kind: "none" }} compact />
            ))}
          </div>
        </section>
      ))}

      <section>
        <h3 className="eyebrow mb-2">Ceramah tour</h3>
        <div className="flex flex-col gap-2">
          <select
            value={tourState}
            onChange={(e) => setTourState(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            {STATES.map((s) => (
              <option key={s.id} value={s.id} style={{ background: "var(--raised)" }}>
                {s.name}
              </option>
            ))}
          </select>
          <ActionCard id="tour" target={{ kind: "state", state: tourState }} compact />
        </div>
      </section>
    </div>
  );
}
