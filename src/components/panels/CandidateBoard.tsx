"use client";

import { useMemo, useState } from "react";
import { NOMINATION, lineup, partySeats } from "@/game/systems/nominations";
import { GROUP_INFO, bench, bestSeatsFor, chanceWith, groupOf, pickIn, suggestPlacements, type Move, type SeatGroup } from "@/game/systems/lineup";
import { homeOf, type Person } from "@/game/systems/people";
import { regionName } from "@/game/systems/posts";
import { useGame } from "@/store/gameStore";
import { SEATS, regionOf } from "@/game/world";
import { chancePct, useReads } from "../common";

const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))} pts`;

/** Where someone stands now: their seat in the line-up, or not placed. */
function standingIn(picks: Record<number, number>, id: number): number | undefined {
  const k = Object.keys(picks).find((x) => picks[Number(x)] === id);
  return k === undefined ? undefined : Number(k);
}

/**
 * The candidates board, open at any time to the party president: your bench of big names on one side, the seats that
 * matter on the other. Pick a name to see their best seats; place them with one click; or take a suggested line-up.
 * Before dissolution it sets your calon (each change costs political capital); in the nomination window it is the list.
 */
export function CandidateBoard({ onOpenSeat }: { onOpenSeat: (seat: number) => void }) {
  const game = useGame((s) => s.game)!;
  const nominate = useGame((s) => s.nominate);
  const deep = useGame((s) => s.deep);
  const reads = useReads();
  const [focus, setFocus] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [plan, setPlan] = useState<Move[] | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  const picks = useMemo(() => lineup(game), [game]);
  const people = useMemo(() => bench(game), [game]);
  const rows = useMemo(
    () =>
      partySeats(game).map((i) => {
        const pick = pickIn(game, i, picks);
        const chance = reads.length ? chanceWith(game, reads[i], i, pick, picks) : 0;
        return { i, pick, chance, group: groupOf(game, i, chance) as SeatGroup };
      }),
    [game, picks, reads],
  );
  const focused = focus !== null ? game.people.find((p) => p.id === focus) : undefined;
  const best = useMemo(() => (focused && reads.length ? bestSeatsFor(game, reads, focused, 5) : []), [game, reads, focused]);
  const bestBy = new Map(best.map((b) => [b.seat, b.gain]));

  const n = game.nominations;
  const locked = !!n && !n.open;
  const expected = rows.reduce((a, r) => a + r.chance, 0);
  const named = Object.keys(game.calon ?? {}).length;
  const term = q.trim().toLowerCase();
  const match = (r: (typeof rows)[number]) => !term || SEATS[r.i].name.toLowerCase().includes(term) || !!r.pick?.name.toLowerCase().includes(term);
  const tag = (r: (typeof rows)[number]) =>
    !r.pick ? "open" : r.pick.id === game.youId ? "you" : r.pick.seat === r.i ? "MP" : game.calon?.[r.i] === r.pick.id ? "named" : r.pick.seat !== null ? "moved in" : "division chief";

  const place = (seat: number, p: Person) => {
    const r = rows.find((x) => x.i === seat);
    const mp = r?.pick && r.pick.seat === seat && r.pick.id !== p.id ? r.pick : undefined;
    if (mp && !confirm(`Put ${p.name} in ${SEATS[seat].name} instead of ${mp.name}, the sitting MP? They lose loyalty and may stand as an independent.`)) return;
    nominate(seat, p.id);
  };

  return (
    <div className="flex flex-col gap-3 @container">
      <section className="inset p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <b className="text-sm">{locked ? "Names are locked" : n?.open ? `Nomination day in ${Math.max(0, n.closesWeek - game.week)} weeks: changes are free` : "Your line-up for the next election"}</b>
          <span className="text-xs tabular-nums" style={{ color: "var(--ink-2)" }}>
            Expected seats {expected.toFixed(0)} of {rows.length} · {rows.filter((r) => r.group !== "other").length} key seats{!n ? ` · ${named} named` : ""}
          </span>
        </div>
        {!n && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            These are your candidates-in-waiting: they become your nomination list when Parliament is dissolved. Each change costs {NOMINATION.name.capital} political capital; anyone you pass over notices, a sitting MP most of all.
          </p>
        )}
        {!locked && (
          <div className="flex flex-wrap gap-1.5">
            <button
              className="btn"
              disabled={!reads.length}
              onClick={() => {
                const m = suggestPlacements(game, reads);
                setPlan(m);
                setTicked(new Set(m.map((x) => x.person.id)));
              }}
            >
              Suggest a line-up
            </button>
            {!n && named > 0 && (
              <button className="btn btn-ghost" onClick={() => Object.keys(game.calon).forEach((k) => deep({ kind: "clearCalon", seat: Number(k) }))}>
                Reset to defaults
              </button>
            )}
          </div>
        )}
        {plan && (
          <div className="flex flex-col gap-1.5 mt-1">
            {!plan.length ? (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Your line-up is already close to the best your bench allows.
              </p>
            ) : (
              <>
                <div className="eyebrow">Suggested moves</div>
                {plan.map((m) => (
                  <label key={m.person.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={ticked.has(m.person.id)}
                      onChange={(e) => {
                        const t = new Set(ticked);
                        if (e.target.checked) t.add(m.person.id);
                        else t.delete(m.person.id);
                        setTicked(t);
                      }}
                    />
                    <span className="flex-1">
                      <b>{m.person.name}</b> {m.from !== undefined ? `${SEATS[m.from].name} → ` : "→ "}
                      <b>{SEATS[m.to].name}</b>
                      {m.displaced ? <span style={{ color: "var(--muted)" }}> (in place of {m.displaced.name})</span> : null}
                    </span>
                    <span className="tabular-nums font-semibold" style={{ color: "var(--good)" }}>
                      {pts(m.gain)}
                    </span>
                  </label>
                ))}
                <div className="flex gap-1.5">
                  <button
                    className="btn"
                    disabled={!ticked.size}
                    onClick={() => {
                      deep({ kind: "placeMany", moves: plan.filter((m) => ticked.has(m.person.id)).map((m) => ({ id: m.person.id, seat: m.to })) });
                      setPlan(null);
                    }}
                  >
                    Make {ticked.size} move{ticked.size === 1 ? "" : "s"}
                    {!n ? ` · ${ticked.size * NOMINATION.name.capital} capital` : ""}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setPlan(null)}>
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-3 @lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] grid-cols-1">
        {/* The bench */}
        <section className="flex flex-col gap-1.5">
          <div className="eyebrow">Your bench</div>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Pick someone to see the seats where they&apos;d help most.
          </p>
          <ul className="flex flex-col gap-1">
            {people.map((p) => {
              const at = standingIn(picks, p.id);
              const on = focus === p.id;
              return (
                <li key={p.id}>
                  <button
                    className="inset w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2"
                    style={{ outline: on ? "2px solid var(--brass-hi)" : undefined }}
                    onClick={() => setFocus(on ? null : p.id)}
                    aria-pressed={on}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">
                        {p.id === game.youId ? "You" : p.name}
                        {p.tokoh && <span style={{ color: "var(--brass-hi)" }}> · tokoh</span>}
                      </span>
                      <span className="block truncate" style={{ color: "var(--muted)" }}>
                        {at !== undefined ? `${SEATS[at].name}${p.seat === at ? " (MP)" : ""}` : "not placed"} · {regionName(homeOf(p))}
                      </span>
                    </span>
                    <span className="tabular-nums" style={{ color: "var(--ink-2)" }} title="Standing">
                      {Math.round(p.influence)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The seats */}
        <section className="flex flex-col gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a seat or name"
            className="rounded-md px-2 py-1 text-xs"
            style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
          />
          {focused && (
            <div className="inset p-2.5 text-xs flex flex-col gap-1">
              <b>Best seats for {focused.id === game.youId ? "you" : focused.name}</b>
              {best.length ? (
                best.map((b) => (
                  <div key={b.seat} className="flex items-center gap-2">
                    <span className="flex-1">
                      {SEATS[b.seat].name}
                      <span style={{ color: "var(--muted)" }}> · {homeOf(focused) === regionOf(SEATS[b.seat].state) ? "home state" : regionName(regionOf(SEATS[b.seat].state))}</span>
                    </span>
                    <span className="tabular-nums font-semibold" style={{ color: "var(--good)" }}>
                      {pts(b.gain)}
                    </span>
                    {!locked && (
                      <button className="chip !py-0.5 !px-2 !text-[11px]" onClick={() => place(b.seat, focused)}>
                        Place
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span style={{ color: "var(--muted)" }}>Nowhere better than where they are now.</span>
              )}
            </div>
          )}
          {(["danger", "battle", "stretch", "other"] as SeatGroup[]).map((g) => {
            const list = rows.filter((r) => r.group === g && match(r)).sort((a, b) => (g === "danger" ? a.chance - b.chance : b.chance - a.chance));
            if (!list.length) return null;
            const fold = g === "other" && !showOther && !term;
            return (
              <div key={g} className="flex flex-col gap-1">
                <button className="flex items-baseline justify-between text-xs px-1 py-1" style={{ borderBottom: "1px solid var(--line)" }} onClick={() => g === "other" && setShowOther(!showOther)}>
                  <span className="eyebrow">
                    {g === "other" ? (fold ? "▸ " : "▾ ") : ""}
                    {GROUP_INFO[g].name} · {list.length}
                  </span>
                  <span style={{ color: "var(--muted)" }}>{GROUP_INFO[g].text}</span>
                </button>
                {!fold &&
                  list.map((r) => {
                    const gain = bestBy.get(r.i);
                    return (
                      <div key={r.i} className="inset px-2.5 py-1.5 text-xs flex items-center gap-2" style={gain ? { outline: "1px solid var(--good)" } : undefined}>
                        <button className="flex-1 min-w-0 text-left" onClick={() => onOpenSeat(r.i)}>
                          <span className="block font-semibold truncate">{SEATS[r.i].name}</span>
                          <span className="block truncate" style={{ color: "var(--muted)" }}>
                            {r.pick ? (r.pick.id === game.youId ? "You" : r.pick.name) : "— no name yet —"} · {tag(r)}
                          </span>
                        </button>
                        <span className="tabular-nums w-10 text-right" style={{ color: r.chance >= 0.5 ? "var(--good)" : "var(--ink-2)" }}>
                          {chancePct(r.chance)}
                        </span>
                        {focused && !locked && r.pick?.id !== focused.id && (
                          <button className="chip !py-0.5 !px-2 !text-[11px]" onClick={() => place(r.i, focused)} title={gain ? `${pts(gain)} with ${focused.name}` : undefined}>
                            {gain ? pts(gain) : "Place"}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
