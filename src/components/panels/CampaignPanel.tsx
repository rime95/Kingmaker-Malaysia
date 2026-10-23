"use client";

import { useMemo, useState } from "react";
import { advise } from "@/game/advice";
import { ACTIONS, type ActionGroup } from "@/game/actions";
import { useGame } from "@/store/gameStore";
import { SEATS, STATES } from "@/game/world";
import { targetName } from "@/game/systems/orders";
import { RUNGS } from "@/game/systems/career";
import { PartyRaceCard } from "../PartyRace";
import { ActionCard } from "../ActionCard";
import { MessageCard } from "../DepthCards";
import { AUTO } from "@/game/systems/governing";

const TONE = { good: "var(--good)", bad: "var(--bad)", info: "var(--ink-2)" } as const;
const ICON = { good: "▲", bad: "▼", info: "•" } as const;

const GROUPS: { id: ActionGroup; title: string }[] = [
  { id: "national", title: "Nationwide" },
  { id: "party", title: "Party" },
  { id: "finance", title: "Money" },
];

/** Your plan for the turn: the advisor's picks, standing orders, then every nationwide, party and money action. */
export function CampaignPanel() {
  const game = useGame((s) => s.game)!;
  const { act, focusSeat, showPanel, deep } = useGame();
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

      <section className="inset p-2.5 text-sm flex items-center gap-3">
        <div className="flex-1">
          <b>Secretary-general runs the ground campaign</b>
          <div className="text-xs" style={{ color: "var(--ink-2)" }}>
            Each turn, any AP you leave goes on local issues and service in your closest seats (keeping RM {AUTO.reserve / 1e6}M in reserve). Your turns stay about the big
            calls.
          </div>
        </div>
        <button className="chip flex-none" aria-pressed={!!game.strategy.autoGround} onClick={() => deep({ kind: "autoGround", on: !game.strategy.autoGround })}>
          {game.strategy.autoGround ? "On" : "Off"}
        </button>
      </section>

      {game.nominations?.open && (
        <button className="inset p-3 text-left text-sm" style={{ outline: "1px solid var(--accent)" }} onClick={() => showPanel("nominations")}>
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

      <MessageCard />

      <StandingOrders />

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Seat moves are on the map: click a seat. Gold bubbles are free bonuses this turn.
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

/** Moves that repeat every turn (set with ↻ on any move). */
function StandingOrders() {
  const game = useGame((s) => s.game)!;
  const order = useGame((s) => s.order);
  return (
    <section>
      <h3 className="eyebrow mb-1">Standing orders</h3>
      {game.orders.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          None yet. Press ↻ on any move (here or on a seat) and it runs at the start of every turn while you have the AP and money.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {game.orders.map((o, k) => (
            <li key={k}>
              <button className="chip !py-1 text-xs" onClick={() => order(o.id, o.target)} title="Cancel this standing order">
                ↻ {ACTIONS.find((a) => a.id === o.id)?.name} · {targetName(o.target)} ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
