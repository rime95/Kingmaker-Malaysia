"use client";

import { ROLES, TEAM, hireBlocked, teamSalaries, teamSlots, type Staff } from "@/game/systems/team";
import { RUNGS } from "@/game/systems/career";
import { useGame } from "@/store/gameStore";
import { fmtRM } from "../common";

/** Your personal staff: what each one does for you, what they cost, and who's looking for work. */
export function TeamPanel() {
  const game = useGame((s) => s.game)!;
  const { hireStaff, fireStaff, raiseStaff } = useGame();
  const slots = teamSlots(game);
  const nextRung = TEAM.slots.findIndex((n) => n > slots);
  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="eyebrow">
            Your team · {game.team.length} of {slots}
          </h3>
          <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            {fmtRM(teamSalaries(game))} a week
          </span>
        </div>
        {game.team.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            You are on your own. Hire from the people looking for work below: a political secretary is the quickest way to more action points.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {game.team.map((x) => (
            <li key={x.id} className="inset p-3 flex flex-col gap-2">
              <StaffHead x={x} />
              <Loyalty v={x.loyalty} />
              <div className="flex flex-wrap gap-1.5">
                <button className="chip !py-1 text-xs" onClick={() => raiseStaff(x.id)} title={`+${TEAM.raiseLoyalty} loyalty`}>
                  Give a raise (+{Math.round(TEAM.raise * 100)}%)
                </button>
                <button className="chip !py-1 text-xs" onClick={() => confirm(`Let ${x.name} go? Severance is ${fmtRM(x.salary * TEAM.severanceWeeks)}.`) && fireStaff(x.id)}>
                  Let go
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          Staff grow more skilled the longer they stay (and ask for more). Below {TEAM.poachBelow} loyalty rivals try to poach them; a bitter press secretary or strategist may
          leak. {nextRung > 0 ? `As ${RUNGS[nextRung]} you can employ ${TEAM.slots[nextRung]}.` : ""}
        </p>
      </section>

      <section>
        <h3 className="eyebrow mb-2">Looking for work this month</h3>
        <ul className="flex flex-col gap-2">
          {game.teamMarket.map((x) => {
            const why = hireBlocked(game, x.id);
            const taken = game.team.some((t) => t.role === x.role);
            return (
              <li key={x.id} className="inset p-3 flex flex-col gap-2">
                <StaffHead x={x} />
                {taken && (
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    You already have a {ROLES[x.role].name.toLowerCase()}: only the better one counts.
                  </div>
                )}
                <button className="btn !py-1.5 !text-sm self-start" disabled={!!why} title={why ?? undefined} onClick={() => hireStaff(x.id)}>
                  Hire · {fmtRM(x.salary * TEAM.signingWeeks)} signing fee
                </button>
                {why && (
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {why}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          New candidates every four weeks.
        </p>
      </section>
    </div>
  );
}

function StaffHead({ x }: { x: Staff }) {
  const role = ROLES[x.role];
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex-none w-9 h-9 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, var(--primary-a), var(--primary-b))" }}>
        {x.name
          .split(/\s+/)
          .filter((w) => /^[A-Z]/.test(w))
          .slice(0, 2)
          .map((w) => w[0])
          .join("")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-sm truncate">{x.name}</span>
          <span className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
            {fmtRM(x.salary)}/wk
          </span>
        </div>
        <div className="text-xs" style={{ color: "var(--ink-2)" }}>
          {role.name} · <span aria-label={`skill ${x.skill} of 5`}>{"★".repeat(x.skill)}{"☆".repeat(5 - x.skill)}</span>
        </div>
        <div className="text-[11px]" style={{ color: "var(--good)" }}>
          {role.effect(x.skill)}
        </div>
      </div>
    </div>
  );
}

function Loyalty({ v }: { v: number }) {
  const warn = v < TEAM.poachBelow;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span style={{ color: "var(--muted)" }}>Loyalty</span>
      <div className="flex-1 h-1 rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: warn ? "var(--bad)" : "var(--ink-2)" }} />
      </div>
      <span className="tabular-nums" style={{ color: warn ? "var(--bad)" : "var(--ink-2)" }}>
        {Math.round(v)}
      </span>
    </div>
  );
}
