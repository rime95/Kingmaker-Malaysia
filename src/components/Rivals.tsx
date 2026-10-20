"use client";

import { serviceBase } from "@/game/bases";
import { fmtRM } from "@/game/money";
import { isHostile, rivalIds, type Rival } from "@/game/systems/rivals";
import { useGame } from "@/store/gameStore";
import { COALITION_INFO, SEATS, type CoalitionId } from "@/game/world";
import { coalColor } from "./common";

const MOOD_TEXT = { confident: "Confident", rattled: "Rattled", desperate: "Desperate" } as const;

export function Rivals() {
  const game = useGame((s) => s.game)!;
  const polled = game.polls.national[0]?.seats;
  const ids = rivalIds(game.player).sort((a, b) => (polled?.[b] ?? 0) - (polled?.[a] ?? 0));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Every other party plays too. They build service early, save their buzz for the run-up to the election, defend seats where you
        campaign, and go after seats you hold when they are hostile. Government partners stay friendly while coalition trust is above 40.
      </p>
      <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
        {ids.map((c) => (
          <RivalCard key={c} c={c} r={game.rivals[c]!} />
        ))}
      </div>
    </div>
  );
}

function RivalCard({ c, r }: { c: CoalitionId; r: Rival }) {
  const game = useGame((s) => s.game)!;
  const focusSeat = useGame((s) => s.focusSeat);
  const info = COALITION_INFO[c];
  const hostile = isHostile(c, game.player, game.me.trust, game.government);
  const held = game.holders.filter((h) => h === c).length;
  const projected = game.polls.national[0]?.seats[c] ?? 0;
  const builtService = r.service.reduce((sum, v, i) => sum + Math.max(0, v - serviceBase(c, i)), 0);
  const targets = [...new Set(r.targets)];

  return (
    <article className="panel p-4 flex flex-col gap-3" style={{ borderTop: `4px solid ${coalColor(c)}` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{info.name}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {game.coalitions[c].members.join(" · ") || "No parties left"} · {game.parliament.pm === c ? "Prime Minister" : game.government.includes(c) ? "Government" : "Opposition"}
          </div>
        </div>
        <span
          className="text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap border"
          style={{ borderColor: hostile ? "var(--bad)" : "var(--line)", color: hostile ? "var(--bad)" : "var(--ink-2)" }}
        >
          {hostile ? "▲ Hostile to you" : "Ally"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="Seats now" value={String(held)} />
        <Stat label="In the polls" value={`${projected}`} delta={projected - held} />
        <Stat label="War chest" value={fmtRM(r.funds)} />
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span style={{ color: "var(--muted)" }}>Strength</span>
          <span>
            <b className="tabular-nums">{r.strength}</b> · {MOOD_TEXT[r.mood]}
          </span>
        </div>
        <div className="h-1.5 rounded-full mt-1" style={{ background: "var(--surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: `${r.strength}%`, background: coalColor(c) }} />
        </div>
        <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          National buzz {Math.round(r.nationalBuzz)} · service built {Math.round(builtService)} pts
        </div>
      </div>

      {targets.length > 0 && (
        <div>
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>
            Working these seats this week
          </div>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((i) => {
              const yours = game.holders[i] === game.player;
              return (
                <button
                  key={i}
                  className="chip"
                  onClick={() => focusSeat(i)}
                  style={yours ? { borderColor: "var(--bad)" } : undefined}
                  title={yours ? "One of your seats" : undefined}
                >
                  {yours && <span style={{ color: "var(--bad)" }}>▲</span>}
                  {SEATS[i].name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {r.recent.length > 0 && (
        <ul className="text-[11px] flex flex-col gap-0.5" style={{ color: "var(--ink-2)" }}>
          {r.recent.slice(0, 3).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="rounded-md p-2" style={{ background: "var(--surface-2)" }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-semibold tabular-nums">
        {value}
        {delta ? (
          <span className="ml-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
            ({delta > 0 ? "+" : "−"}
            {Math.abs(delta)})
          </span>
        ) : null}
      </div>
    </div>
  );
}
