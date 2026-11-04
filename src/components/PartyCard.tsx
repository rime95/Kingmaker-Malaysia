"use client";

import { type Vote } from "@/game/systems/dewan";
import { Tip } from "./Tip";
import { mpOf } from "@/game/systems/people";
import { partyColor } from "@/game/systems/coalitions";
import { partyStats } from "@/game/systems/partyStats";
import { useGame } from "@/store/gameStore";
import { cname, MAJORITY, SEATS } from "@/game/world";
import { CoalitionFlag } from "./flags";
import { VOTE_COLOR, VOTE_LABEL } from "./SeatHolderCard";

/** The party under the pointer in the Dewan, 2D or 3D: its strength, people and how it voted, and the seat you're on. */
export function PartyCard({ party, seat, x, y, votes }: { party: string; seat: number | null; x: number; y: number; votes?: Vote[] }) {
  const game = useGame((s) => s.game)!;
  const st = partyStats(game, party, votes);
  const mp = seat !== null ? mpOf(game, seat) : undefined;
  const delta = st.seats - st.seatsAtGE;
  const coalSeats = game.holders.filter((h) => h === st.coalition).length;
  return (
    <Tip x={x} y={y} width={284} className="party-card">
      <div className="flex items-center gap-2">
        <span className="swatch" style={{ background: partyColor(game, party), width: 12, height: 12 }} />
        <span className="font-semibold text-[13px] leading-tight flex-1">{st.name}</span>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: st.side === "government" ? "rgb(227 194 122 / 0.18)" : "rgb(255 255 255 / 0.08)", color: st.side === "government" ? "var(--brass-hi)" : "var(--ink-2)" }}>
          {st.side === "government" ? "Government" : "Opposition"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5" style={{ color: "var(--ink-2)" }}>
        <CoalitionFlag game={game} c={st.coalition} size={10} />
        {cname(st.coalition)} · {coalSeats} seats together
      </div>

      <div className="grid grid-cols-3 gap-1.5 my-2 text-center">
        <Stat value={`${st.seats}`} label="seats" />
        <Stat value={`${(st.share * 100).toFixed(1)}%`} label="of the House" />
        <Stat value={delta === 0 ? "±0" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`} label={game.lastElection ? "since the GE" : "since GE15"} tone={delta > 0 ? "var(--good)" : delta < 0 ? "var(--bad)" : undefined} />
      </div>
      {/* Its weight against the 112 needed */}
      <div className="h-1.5 rounded-full overflow-hidden relative" style={{ background: "rgb(255 255 255 / 0.08)" }}>
        <div className="h-full" style={{ width: `${Math.min(100, (st.seats / MAJORITY) * 100)}%`, background: partyColor(game, party) }} />
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>
        {st.seats >= MAJORITY ? "A majority on its own" : `${Math.round((st.seats / MAJORITY) * 100)}% of the ${MAJORITY} needed to govern alone`}
      </div>

      <div className="mt-2 flex flex-col gap-0.5" style={{ color: "var(--ink-2)" }}>
        {st.leader && (
          <div>
            Leader: <b style={{ color: "var(--ink)" }}>{st.leader}</b>
          </div>
        )}
        <div>
          {st.side === "government" ? `${st.posts} cabinet post${st.posts === 1 ? "" : "s"}` : st.posts ? `${st.posts} shadow post${st.posts === 1 ? "" : "s"}` : "No cabinet posts"} · {st.women} wom{st.women === 1 ? "a" : "e"}n MP{st.women === 1 ? "" : "s"}
        </div>
      </div>

      {st.votes && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(["aye", "no", "abstain", "absent"] as Vote[])
            .filter((v) => st.votes![v])
            .map((v) => (
              <span key={v} className="inline-flex items-center gap-1">
                <span className="swatch" style={{ background: VOTE_COLOR[v], width: 8, height: 8 }} />
                {st.votes![v]} {VOTE_LABEL[v].toLowerCase()}
              </span>
            ))}
        </div>
      )}

      {seat !== null && (
        <div className="mt-2 pt-1.5" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          <span style={{ color: "var(--ink)" }}>{mp ? mp.name : "Vacant"}</span>
          {mp?.id === game.youId ? " (you)" : ""} · {SEATS[seat].code} {SEATS[seat].name}
          <div className="text-[10px]">Click for the seat</div>
        </div>
      )}
    </Tip>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-md py-1" style={{ background: "rgb(255 255 255 / 0.05)" }}>
      <div className="num font-semibold text-[15px]" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="text-[10px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}
