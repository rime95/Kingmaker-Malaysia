"use client";

import { serviceBase } from "@/game/bases";
import { fortressLevel } from "@/game/state";
import { BUBBLE_INFO } from "@/game/systems/bubbles";
import { DUNS } from "@/game/systems/dun";
import { isHostile, type Rival } from "@/game/systems/rivals";
import { useGame } from "@/store/gameStore";
import { BLOCS, BLOC_LABEL, COALITION_INFO, SEATS, STATE_BY_ID, candidateParty, contestingIn, type CoalitionId } from "@/game/world";
import { ActionCard } from "../ActionCard";
import { fmt, pct, useProjections } from "../common";
import { RATING_LABEL, coalColor } from "../map/lenses";
import { Icon } from "./icons";

const SEAT_ACTIONS = ["ceramah", "walkabout", "service", "machinery", "handout"];

/** The clicked seat: the essentials up top, your moves, then the detail folded away. */
export function SeatCard() {
  const game = useGame((s) => s.game)!;
  const { selected, select, claim } = useGame();
  const projections = useProjections();
  if (selected === null) return null;
  const i = selected;
  const seat = SEATS[i];
  const p = projections[i];
  const holder = game.holders[i];
  const contests = contestingIn(seat).includes(game.player);
  const shares = (Object.entries(p.shares) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const bubble = game.bubbles.find((b) => b.seat === i);
  const duns = DUNS.filter((d) => d.parent === i);
  const rivals = (Object.entries(game.rivals) as [CoalitionId, Rival][])
    .map(([c, r]) => ({ c, buzz: r.buzz[i], service: r.service[i] - serviceBase(c, i), hostile: isHostile(c, game.player, game.me.trust, game.government) }))
    .filter((x) => x.buzz >= 1 || x.service >= 1)
    .sort((a, b) => b.buzz + b.service - (a.buzz + a.service));

  return (
    <aside className="panel pop-in flex flex-col max-h-full w-full md:w-[340px]" aria-label={`${seat.name} seat`}>
      <div className="flex items-start gap-2 px-4 pt-3.5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex-1 min-w-0">
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {seat.code} · {STATE_BY_ID[seat.state].name}
          </div>
          <div className="text-lg font-bold leading-tight truncate">{seat.name}</div>
          <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "var(--ink-2)" }}>
            <span className="swatch" style={{ background: coalColor(holder) }} />
            {game.holderParties[i]} ({COALITION_INFO[holder].short}) · GE15 majority {fmt(seat.ge15Majority)}
          </div>
        </div>
        <button className="chip !p-2" onClick={() => select(null)} aria-label="Close">
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3 flex flex-col gap-4 text-sm @container">
        {bubble && (
          <button className="inset p-2.5 text-left flex items-center gap-2" style={{ outline: "1px solid var(--accent)" }} onClick={() => claim(bubble.id)}>
            <span className="text-lg">{BUBBLE_INFO[bubble.kind].icon}</span>
            <span className="flex-1">
              <b>{BUBBLE_INFO[bubble.kind].title}</b>
              <span className="block text-xs" style={{ color: "var(--ink-2)" }}>
                Collect: {BUBBLE_INFO[bubble.kind].reward(bubble.value)} (free, this week only)
              </span>
            </span>
          </button>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="eyebrow">If the election were today</h3>
            <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
              {RATING_LABEL[p.rating]} · {pct(p.margin, 1)}
            </span>
          </div>
          {shares.map(([c, v]) => (
            <div key={c} className="grid grid-cols-[92px_1fr_42px] items-center gap-2 py-0.5">
              <span className="text-xs truncate">
                {candidateParty(seat, c)} <span style={{ color: "var(--muted)" }}>{COALITION_INFO[c].short}</span>
              </span>
              <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: coalColor(c) }} />
              </div>
              <span className="text-xs tabular-nums text-right">{pct(v, 1)}</span>
            </div>
          ))}
        </section>

        {contests ? (
          <section>
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="eyebrow">Your moves here</h3>
              <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                {fortressLevel(game.me.service[i])} · service {Math.round(game.me.service[i])} · machinery {Math.round(game.me.machinery[i])} · buzz {Math.round(game.me.buzz[i])}
              </span>
            </div>
            <div className="grid gap-1.5">
              {SEAT_ACTIONS.map((id) => (
                <ActionCard key={id} id={id} target={{ kind: "seat", seat: i }} compact />
              ))}
            </div>
          </section>
        ) : (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Your coalition doesn&apos;t field candidates here.
          </p>
        )}

        {rivals.length > 0 && (
          <section>
            <h3 className="eyebrow mb-1.5">Rivals working this seat</h3>
            {rivals.map((x) => (
              <div key={x.c} className="flex items-center gap-2 text-xs py-0.5">
                <span className="swatch" style={{ background: coalColor(x.c) }} />
                {COALITION_INFO[x.c].short}
                {x.hostile && <span style={{ color: "var(--bad)" }}>▲ hostile</span>}
                <span className="ml-auto tabular-nums" style={{ color: "var(--ink-2)" }}>
                  buzz {Math.round(x.buzz)} · service +{Math.round(Math.max(0, x.service))}
                </span>
              </div>
            ))}
          </section>
        )}

        <details className="inset px-3 py-2">
          <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
            Who lives here, and its state seats
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {BLOCS.filter((b) => seat.demo.ethnic[b] >= 0.01).map((b) => (
              <div key={b} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-xs">
                <span>{BLOC_LABEL[b]}</span>
                <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${seat.demo.ethnic[b] * 100}%`, background: "var(--ink-2)" }} />
                </div>
                <span className="tabular-nums text-right">{pct(seat.demo.ethnic[b])}</span>
              </div>
            ))}
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              Urban {pct(seat.demo.urbanity)} · aged 18–29 {pct(seat.demo.youth)} · B40 {pct(seat.demo.b40)} · {fmt(seat.electorate)} voters (estimates)
            </div>
            {duns.length > 0 && (
              <div className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>
                State seats:{" "}
                {duns.map((d) => (
                  <span key={d.index} className="inline-flex items-center gap-1 mr-2">
                    <span className="swatch" style={{ background: coalColor(game.dunHolders[d.index]), width: 8, height: 8 }} />
                    {d.code} {d.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
