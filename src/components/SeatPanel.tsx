"use client";

import { useGame } from "@/store/gameStore";
import { BLOCS, BLOC_LABEL, COALITION_INFO, PARTIES, SEATS, STATE_BY_ID, candidateParty, contestingIn, type CoalitionId } from "@/game/world";
import { fortressLevel } from "@/game/state";
import { serviceBase } from "@/game/bases";
import { isHostile, type Rival } from "@/game/systems/rivals";
import { ActionCard } from "./ActionCard";
import { coalColor, fmt, pct, useProjections } from "./common";

const RATING_TEXT = { safe: "Safe", likely: "Likely", lean: "Leaning", tossup: "Toss-up" } as const;

export function SeatPanel() {
  const { game, selected, select } = useGame();
  const projections = useProjections();
  if (!game) return null;
  if (selected === null)
    return (
      <div className="panel p-4 text-sm" style={{ color: "var(--ink-2)" }}>
        <div className="font-semibold mb-1" style={{ color: "var(--ink)" }}>
          No seat selected
        </div>
        Click any seat on the map or in the Dewan to see who holds it, who lives there, and how it would vote today.
      </div>
    );

  const seat = SEATS[selected];
  const p = projections[selected];
  const holder = game.holders[selected];
  const result = game.lastElection?.seats[selected];
  const contests = contestingIn(seat).includes(game.player);
  const shares = (Object.entries(p.shares) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="panel p-4 flex flex-col gap-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {seat.code} · {STATE_BY_ID[seat.state].name}
          </div>
          <div className="text-lg font-bold leading-tight">{seat.name}</div>
        </div>
        <button className="chip" onClick={() => select(null)} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Held by" value={<span className="inline-flex items-center gap-1.5"><span className="swatch" style={{ background: coalColor(holder) }} />{game.holderParties[selected]}</span>} sub={COALITION_INFO[holder].name} />
        <Stat label="GE15 majority" value={fmt(seat.ge15Majority)} sub={`${fmt(seat.electorate)} voters`} />
      </div>

      <section>
        <h3 className="font-semibold mb-2">If the election were today</h3>
        <div className="text-xs mb-2" style={{ color: "var(--ink-2)" }}>
          {RATING_TEXT[p.rating]} {COALITION_INFO[p.leader].short}, margin {pct(p.margin, 1)}
        </div>
        <div className="flex flex-col gap-1.5">
          {shares.map(([c, v]) => (
            <div key={c} className="grid grid-cols-[86px_1fr_44px] items-center gap-2">
              <span className="text-xs truncate">
                {candidateParty(seat, c)} <span style={{ color: "var(--muted)" }}>({COALITION_INFO[c].short})</span>
              </span>
              <div className="h-2.5 rounded-sm" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-sm" style={{ width: `${v * 100}%`, background: coalColor(c) }} />
              </div>
              <span className="text-xs tabular-nums text-right">{pct(v, 1)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">
          Your {COALITION_INFO[game.player].short} presence{" "}
          <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>
            {contests ? fortressLevel(game.me.service[selected]) : "not contested"}
          </span>
        </h3>
        {contests ? (
          <>
            <div className="flex flex-col gap-1.5 mb-3">
              <Presence label="Service" value={game.me.service[selected]} note="permanent" />
              <Presence label="Machinery" value={game.me.machinery[selected]} note="needs upkeep" />
              <Presence label="Buzz" value={game.me.buzz[selected]} note="fades 5%/wk" />
            </div>
            <div className="grid gap-2">
              {SEAT_ACTIONS.map((id) => (
                <ActionCard key={id} id={id} target={{ kind: "seat", seat: selected }} compact />
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs" style={{ color: "var(--ink-2)" }}>
            Your coalition doesn&apos;t field candidates here.
          </div>
        )}
      </section>

      <RivalActivity seatIndex={selected} />

      {result && (
        <section>
          <h3 className="font-semibold mb-1">Test election</h3>
          <div className="text-xs" style={{ color: "var(--ink-2)" }}>
            {result.winnerParty} ({COALITION_INFO[result.winner].short}) wins by {fmt(result.majority)} on {pct(result.turnout)} turnout
            {result.winner !== holder ? `: a gain from ${COALITION_INFO[holder].short}.` : "."}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-semibold mb-2">
          Who lives here <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>(estimate)</span>
        </h3>
        <div className="flex flex-col gap-1.5">
          {BLOCS.filter((b) => seat.demo.ethnic[b] >= 0.005).map((b) => (
            <div key={b} className="grid grid-cols-[120px_1fr_40px] items-center gap-2 text-xs">
              <span>{BLOC_LABEL[b]}</span>
              <div className="h-2 rounded-sm" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-sm" style={{ width: `${seat.demo.ethnic[b] * 100}%`, background: `var(--e-${b === "other" ? "mixed" : b})` }} />
              </div>
              <span className="tabular-nums text-right">{pct(seat.demo.ethnic[b])}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Urban" value={pct(seat.demo.urbanity)} />
          <Stat label="Aged 18–29" value={pct(seat.demo.youth)} />
          <Stat label="B40" value={pct(seat.demo.b40)} />
        </div>
      </section>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {PARTIES[game.holderParties[selected]]?.name}
      </div>
    </div>
  );
}

/** Which rivals are campaigning in this seat, and how hard. */
function RivalActivity({ seatIndex }: { seatIndex: number }) {
  const game = useGame((s) => s.game)!;
  const rows = (Object.entries(game.rivals) as [CoalitionId, Rival][])
    .map(([c, r]) => ({ c, buzz: r.buzz[seatIndex], service: r.service[seatIndex] - serviceBase(c, seatIndex), hostile: isHostile(c, game.player, game.me.trust) }))
    .filter((x) => x.buzz >= 1 || x.service >= 1)
    .sort((a, b) => b.buzz + b.service - (a.buzz + a.service));
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="font-semibold mb-2">Rivals working this seat</h3>
      <div className="flex flex-col gap-1">
        {rows.map((x) => (
          <div key={x.c} className="flex items-center gap-2 text-xs">
            <span className="swatch" style={{ background: `var(--c-${x.c})` }} />
            <span className="font-medium">{COALITION_INFO[x.c].short}</span>
            {x.hostile && <span style={{ color: "var(--bad)" }}>▲ hostile</span>}
            <span className="ml-auto tabular-nums" style={{ color: "var(--ink-2)" }}>
              buzz {Math.round(x.buzz)} · service +{Math.round(Math.max(0, x.service))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const SEAT_ACTIONS =["ceramah", "walkabout", "service", "machinery", "handout"];

function Presence({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr_110px] items-center gap-2 text-xs">
      <span>{label}</span>
      <div className="h-2 rounded-sm" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-sm" style={{ width: `${Math.min(100, value)}%`, background: "var(--ink-2)" }} />
      </div>
      <span className="tabular-nums text-right" style={{ color: "var(--muted)" }}>
        {Math.round(value)} · {note}
      </span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="font-semibold tabular-nums">{value}</div>
      {sub && (
        <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
