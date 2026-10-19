"use client";

import { careerTitle } from "@/game/progress";
import { fortressLevel, weekLabel } from "@/game/state";
import { CONTEST_POINTS, MP, PRESIDENT, RUNGS, RUNGS_OPP, contestChance, factionSize } from "@/game/systems/career";
import { TIER_TEXT } from "@/game/systems/formation";
import { ACHIEVEMENTS } from "@/game/systems/goals";
import { useGame } from "@/store/gameStore";
import { COALITION_INFO, SEATS, STATE_BY_ID } from "@/game/world";
import { fmtRM } from "./common";

export function Career() {
  const game = useGame((s) => s.game)!;
  const select = useGame((s) => s.select);
  const setView = useGame((s) => s.setView);
  const c = game.career;
  const inGov = game.government.includes(game.player);
  const names = inGov ? RUNGS : RUNGS_OPP;
  const faction = factionSize(c, game.holders, game.player);
  const partySeats = game.holders.filter((h) => h === game.player).length;
  const need = CONTEST_POINTS[c.rung];
  const chance = c.rung < PRESIDENT && isFinite(need ?? Infinity) ? contestChance(c, game.me.unity, faction, partySeats) : null;
  const home = SEATS[c.homeSeat];
  const homeHolder = game.holders[c.homeSeat];
  const earned = ACHIEVEMENTS.filter((a) => game.achievements[a.id] !== undefined);
  const bestSeats = Math.max(partySeats, ...game.tiers.map((t) => t.seats));
  const bestFunds = Math.max(...game.history.map((h) => h.funds), game.me.funds);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                {c.mode === "leader" ? "Leader mode" : "Career mode"} · generation {c.generation}
              </div>
              <h2 className="text-xl font-bold">{c.name}</h2>
              <div className="text-sm" style={{ color: "var(--ink-2)" }}>
                {careerTitle(game)} · {COALITION_INFO[game.player].short} · age {c.age}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">{c.points}</div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                career points
              </div>
            </div>
          </div>

          <ol className="flex flex-col gap-1">
            {names.map((name, i) => {
              const here = i === c.rung;
              const done = i < c.rung;
              return (
                <li key={name} className="flex items-center gap-2 text-sm rounded-md px-2 py-1" style={{ background: here ? "var(--surface-2)" : undefined, color: done || here ? "var(--ink)" : "var(--muted)" }}>
                  <span className="w-5 text-center" aria-hidden>
                    {done ? "✓" : here ? "●" : "○"}
                  </span>
                  <span className={here ? "font-semibold" : undefined}>{name}</span>
                  <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                    {i === MP ? "win your home seat at a GE" : i > 0 && isFinite(CONTEST_POINTS[i - 1]) ? `${CONTEST_POINTS[i - 1]} pts at the AGM` : i === 0 ? "start" : ""}
                  </span>
                </li>
              );
            })}
            <li className="flex items-center gap-2 text-sm rounded-md px-2 py-1" style={{ color: game.parliament.pm === game.player && c.rung >= PRESIDENT ? "var(--ink)" : "var(--muted)" }}>
              <span className="w-5 text-center" aria-hidden>
                {game.parliament.pm === game.player && c.rung >= PRESIDENT ? "★" : "○"}
              </span>
              Prime Minister
              <span className="ml-auto text-[11px]">win the coalition talks after a GE</span>
            </li>
          </ol>

          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            {c.rung >= PRESIDENT
              ? c.challenge
                ? "▲ A leadership challenge is coming at the June AGM. Raise unity and build your faction."
                : "You control the party: policy, the Budget, dissolution and coalition talks are yours."
              : c.rung === MP - 1
                ? `Next: win ${home.name} at the general election to become a Wakil Rakyat.`
                : chance !== null && need !== undefined
                  ? `Next: ${names[c.rung + 1]} at the June AGM. You need ${need} points${c.points >= need ? ` and have them: about ${Math.round(chance * 100)}% chance today.` : ` (you have ${c.points}).`}`
                  : ""}
          </p>
          {c.rung < PRESIDENT && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Until you lead the party, its leadership decides policy, the Budget, dissolution and coalition talks. Earn points by winning
              seats, by-elections and states, passing reforms, completing objectives, and building a faction of loyal MPs (campaign in your
              coalition&apos;s seats).
            </p>
          )}
        </section>

        <section className="panel p-4 flex flex-col gap-3">
          <h2 className="font-semibold">Your power base</h2>
          <button
            className="text-left rounded-lg border p-3"
            style={{ borderColor: "var(--line)" }}
            onClick={() => {
              select(c.homeSeat);
              setView("map");
            }}
          >
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              Home seat · {home.code} · {STATE_BY_ID[home.state].name}
            </div>
            <div className="font-semibold">{home.name}</div>
            <div className="text-xs" style={{ color: homeHolder === game.player ? "var(--good)" : "var(--bad)" }}>
              {homeHolder === game.player ? "▲ Held by your coalition" : `▼ Held by ${COALITION_INFO[homeHolder].short}`} · {fortressLevel(game.me.service[c.homeSeat])}
            </div>
          </button>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Big label="Loyal MPs" value={String(faction)} />
            <Big label="Weeks as PM" value={String(c.pmWeeks)} />
            <Big label="Protégé" value={c.protege.split(" ")[0]} />
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {c.name} retires around age {c.retireAge}; {c.protege} will take over, keeping 60% of your points and faction.
          </div>
          <h3 className="font-semibold text-sm mt-1">Recent career moves</h3>
          <ul className="text-xs flex flex-col gap-0.5 max-h-48 overflow-y-auto" style={{ color: "var(--ink-2)" }}>
            {c.log.length === 0 && <li>Nothing yet.</li>}
            {c.log.map((l, i) => (
              <li key={i}>
                <span style={{ color: "var(--muted)" }}>{weekLabel(l.week)}:</span> {l.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel p-4">
        <h2 className="font-semibold mb-2">This term&apos;s objectives</h2>
        <ul className="flex flex-col gap-1.5">
          {game.objectives.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-sm">
              <span aria-hidden style={{ color: o.done ? "var(--good)" : "var(--muted)" }}>
                {o.done ? "✓" : "○"}
              </span>
              <span style={{ textDecoration: o.done ? "line-through" : undefined, color: o.done ? "var(--muted)" : "var(--ink)" }}>{o.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          Each pays +10 political capital and +8 career points. New objectives arrive after every general election.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="panel p-4">
          <h2 className="font-semibold mb-2">Election record & bests</h2>
          {game.tiers.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              No general election yet.
            </p>
          ) : (
            <ul className="text-sm flex flex-col gap-1 mb-3">
              {game.tiers.map((t, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{weekLabel(t.week)}</span>
                  <span>
                    <b>{TIER_TEXT[t.tier].name}</b> · {t.seats} seats
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2 text-center">
            <Big label="Most seats" value={String(bestSeats)} />
            <Big label="Biggest war chest" value={fmtRM(bestFunds)} />
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="font-semibold mb-2">
            Achievements{" "}
            <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>
              {earned.length} of {ACHIEVEMENTS.length}
            </span>
          </h2>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const got = game.achievements[a.id] !== undefined;
              return (
                <div key={a.id} className="rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: got ? "var(--accent)" : "var(--line)", opacity: got ? 1 : 0.55 }}>
                  <div className="font-semibold">
                    {got ? "★ " : ""}
                    {a.name}
                  </div>
                  <div style={{ color: "var(--ink-2)" }}>{a.text}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md p-2" style={{ background: "var(--surface-2)" }}>
      <div className="font-bold tabular-nums">{value}</div>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}
