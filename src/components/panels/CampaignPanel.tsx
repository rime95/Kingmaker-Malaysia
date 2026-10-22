"use client";

import { useMemo, useState } from "react";
import { advise } from "@/game/advice";
import { ACTIONS, type ActionGroup } from "@/game/actions";
import { useGame } from "@/store/gameStore";
import { winChance } from "@/game/systems/polls";
import { SEATS, STATES, STATE_BY_ID, contestingIn } from "@/game/world";
import { RUNGS } from "@/game/systems/career";
import { PartyRaceCard } from "../PartyRace";
import { ActionCard } from "../ActionCard";
import { pct, useReads } from "../common";

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
  const { act, focusSeat, openPanel } = useGame();
  const tips = useMemo(() => advise(game).slice(0, 4), [game]);
  const [tourState, setTourState] = useState(STATES[0].id);
  const reads = useReads();
  // Battlegrounds: seats you contest where your polled chance is closest to a coin flip.
  const battle = useMemo(
    () =>
      SEATS.filter((seat) => contestingIn(seat, game.entries).includes(game.player))
        .map((seat) => ({ i: seat.index, chance: reads.length ? (winChance(reads[seat.index], game.player, game.week) ?? 0) : 0 }))
        .filter((x) => x.chance > 0.2 && x.chance < 0.8)
        .sort((a, b) => Math.abs(a.chance - 0.5) - Math.abs(b.chance - 0.5))
        .slice(0, 6),
    [game, reads],
  );

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

      {game.nominations?.open && (
        <button className="inset p-3 text-left text-sm" style={{ outline: "1px solid var(--accent)" }} onClick={() => openPanel("nominations")}>
          <b style={{ color: "var(--accent)" }}>Nominations close in {Math.max(0, game.nominations.closesWeek - game.week)} weeks.</b>{" "}
          {game.career.rung >= 6 ? "Review your candidates, or stand in new seats." : "See who your president is putting up, and whether it's you."}
        </button>
      )}

      <PartyRaceCard />

      {ACTIONS.some((a) => a.rungs?.includes(game.career.rung)) && (
        <section>
          <h3 className="eyebrow mb-2">Your role · {RUNGS[game.career.rung]}</h3>
          <div className="grid gap-2 @md:grid-cols-2">
            {ACTIONS.filter((a) => a.group === "role" && a.rungs?.includes(game.career.rung)).map((a) => (
              <ActionCard key={a.id} id={a.id} target={a.target === "state" ? { kind: "state", state: tourState } : { kind: "none" }} compact />
            ))}
          </div>
          {ACTIONS.some((a) => a.group === "role" && a.target === "state" && a.rungs?.includes(game.career.rung)) && (
            <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              Ministry projects go to the state picked under By state below.
            </p>
          )}
        </section>
      )}

      {battle.length > 0 && (
        <section>
          <h3 className="eyebrow mb-2">Battleground seats</h3>
          <ul className="flex flex-col gap-1">
            {battle.map((x) => (
              <li key={x.i}>
                <button className="inset w-full px-2.5 py-1.5 text-sm flex items-center gap-2 text-left hover:brightness-125" onClick={() => focusSeat(x.i)}>
                  <span className="flex-1 truncate">
                    {SEATS[x.i].name} <span className="text-xs" style={{ color: "var(--muted)" }}>{STATE_BY_ID[SEATS[x.i].state].name}</span>
                  </span>
                  <span className="text-xs tabular-nums font-semibold" style={{ color: x.chance >= 0.5 ? "var(--good)" : "var(--bad)" }}>
                    {pct(x.chance)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <h3 className="eyebrow mb-2">By state: tours and expansion</h3>
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
          <ActionCard id="launchState" target={{ kind: "state", state: tourState }} compact />
        </div>
      </section>
    </div>
  );
}
