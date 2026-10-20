"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RACE, raceMoveBlocked, raceOutlook, type RaceMove } from "@/game/systems/partyrace";
import { factionSize } from "@/game/systems/career";
import { useGame } from "@/store/gameStore";
import { fmtRM, pct } from "./common";

const MOVES: { id: RaceMove; name: string; cost: string; blurb: string }[] = [
  { id: "court", name: "Court delegates", cost: `1 AP · ${fmtRM(RACE.court.cost)}`, blurb: "Tour the divisions. Steady, clean." },
  { id: "posts", name: "Promise posts", cost: `1 AP · ${RACE.posts.capital} capital`, blurb: "Division chiefs back you for a seat at the table. Costs a little unity." },
  { id: "faction", name: "Rally your faction", cost: "1 AP", blurb: "Your loyal MPs work the phones. Worth more the bigger your faction." },
  { id: "money", name: "Money politics", cost: `0 AP · ${fmtRM(RACE.money.cost)}`, blurb: "Envelopes. Fast, and MACC is watching." },
];

/** The party election you are fighting: who you face, how the delegates lean, and your moves. */
export function PartyRaceCard() {
  const game = useGame((s) => s.game)!;
  const race = game.race;
  const move = useGame((s) => s.race);
  if (!race || race.result) return null;
  const outlook = raceOutlook(game, race);
  const weeks = race.voteWeek - game.week;
  const faction = factionSize(game.career, game.holders, game.player);
  return (
    <section className="inset p-3 flex flex-col gap-2.5" style={{ outline: "1px solid var(--accent)" }}>
      <div className="flex items-baseline justify-between">
        <h3 className="eyebrow" style={{ color: "var(--accent)" }}>
          {race.kind === "defend" ? "Leadership challenge" : `Party election: ${race.post}`}
        </h3>
        <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
          vote in {weeks} wk{weeks === 1 ? "" : "s"}
        </span>
      </div>
      <div className="text-xs" style={{ color: "var(--ink-2)" }}>
        Against: {race.rivals.map((r) => r.name).join(", ") || "nobody"}
        {race.kind === "vp" ? ` · top ${RACE.vpSeats} win` : ""}
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Delegates leaning your way</span>
          <span className="font-semibold tabular-nums" style={{ color: outlook >= 0.5 ? "var(--good)" : "var(--bad)" }}>
            {pct(outlook)}
          </span>
        </div>
        <div className="relative h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${outlook * 100}%`, background: outlook >= 0.5 ? "var(--good)" : "var(--bad)" }} />
          <div className="absolute -top-0.5 -bottom-0.5 w-px" style={{ left: "50%", background: "var(--ink-2)" }} />
        </div>
        <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Your effort {Math.round(race.effort)} · rivals&apos; best {Math.round(Math.max(0, ...race.rivals.map((r) => r.effort)))} · faction {faction} MPs. Division chiefs loyal to you
          bring their delegates.
        </div>
      </div>
      <div className="grid gap-1.5 @md:grid-cols-2">
        {MOVES.map((m) => {
          const why = raceMoveBlocked(game, m.id);
          return (
            <button key={m.id} className="text-left rounded-lg p-2 border disabled:cursor-not-allowed" style={{ borderColor: "var(--line)", background: "var(--surface-2)", opacity: why ? 0.55 : 1 }} disabled={!!why} title={why ?? m.blurb} onClick={() => move(m.id)}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-semibold">{m.name}</span>
                <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                  {m.cost}
                </span>
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {m.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The count at the AGM: delegations declare one by one, like a small Election Night. */
export function PartyRaceCount() {
  const game = useGame((s) => s.game)!;
  const endRace = useGame((s) => s.endRace);
  const race = game.race;
  const total = race?.result?.tally.length ?? 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!total) return;
    const t = setInterval(() => setShown((n) => (n >= total ? n : n + 1)), Math.max(40, 2600 / total));
    return () => clearInterval(t);
  }, [total]);
  if (!race?.result) return null;
  const r = race.result;
  const done = shown >= total;
  const counted = r.tally.slice(0, shown);
  const you = counted.filter((t) => t.to === -1).length;
  const rivals = race.rivals.map((_, k) => counted.filter((t) => t.to === k).length);
  const max = Math.max(1, total);
  const rows = [{ name: `${game.career.name} (you)`, n: you, you: true }, ...race.rivals.map((x, k) => ({ name: x.name, n: rivals[k], you: false }))];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgb(5 7 14 / 0.72)" }}>
      <div className="panel pop-in w-full max-w-lg p-5 flex flex-col gap-4" role="dialog" aria-label="Party election count">
        <div>
          <div className="eyebrow" style={{ color: "var(--accent)" }}>
            Party AGM · the count
          </div>
          <h2 className="text-xl font-bold mt-1">{race.kind === "defend" ? "Leadership challenge" : race.post}</h2>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            {shown} of {total} {race.kind === "division" ? "branches" : "divisions"} declared
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="flex justify-between text-sm">
                <span className={row.you ? "font-semibold" : undefined}>{row.name}</span>
                <span className="tabular-nums font-semibold">{row.n}</span>
              </div>
              <div className="h-2.5 rounded-full mt-1" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(row.n / max) * 100}%`, background: row.you ? "linear-gradient(90deg, var(--primary-a), var(--primary-b))" : "var(--ink-2)" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs h-4 truncate" style={{ color: "var(--ink-2)" }}>
          {counted.length ? `${counted[counted.length - 1].label}: ${counted[counted.length - 1].to === -1 ? "for you" : `for ${race.rivals[counted[counted.length - 1].to]?.name}`}` : "Counting begins…"}
        </div>
        {done && (
          <div className="text-lg font-bold" style={{ color: r.won ? "var(--good)" : "var(--bad)" }}>
            {r.won ? (race.kind === "defend" ? "You survive the challenge." : `You are the new ${race.post}.`) : race.kind === "defend" ? "You have been ousted." : "You lose this time."}
          </div>
        )}
        <div className="flex gap-2">
          {done ? (
            <button className="btn" onClick={endRace}>
              Continue
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => setShown(total)}>
              Skip to the result
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
