"use client";

import { MACC } from "@/game/config";
import { useGame } from "@/store/gameStore";
import { Career } from "../Career";
import { CoalitionCard } from "../CoalitionCard";
import { PartyRaceCard } from "../PartyRace";
import { fmt, fmtRM } from "../common";

/** Your party's health at a glance, then your career. */
export function PartyPanel() {
  const game = useGame((s) => s.game)!;
  const openPanel = useGame((s) => s.openPanel);
  const me = game.me;
  const maccChance = Math.max(0, me.risk - MACC.threshold) / MACC.divisor;
  return (
    <div className="flex flex-col gap-5">
      <PartyRaceCard />
      <section>
        <h3 className="eyebrow mb-2">Party health</h3>
        <div className="grid grid-cols-2 gap-2">
          <Meter label="Unity" value={me.unity} note="Multiplies every action" warn={me.unity < 40} />
          <Meter label="Partner trust" value={me.trust} note={me.trust < 40 ? "Squabbling costs you everywhere" : "Partners are on board"} warn={me.trust < 40} />
          <Meter label="Integrity" value={me.integrity} note="Urban voters reward clean parties" />
          <Meter label="MACC risk" value={me.risk} note={maccChance > 0 ? `${(maccChance * 100).toFixed(1)}% raid chance a week` : "No investigation likely"} warn={maccChance > 0} />
          <Meter label="Political capital" value={me.capital} max={200} note="For policies and announcements" />
          <Meter label="Media reach" value={me.reach} note="Boosts national campaigns" />
          <Meter label="National buzz" value={me.nationalBuzz} note="Fades about 6% a week" />
          <div className="inset p-2.5">
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Members
            </div>
            <div className="font-semibold tabular-nums">{fmt(me.members)}</div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {fmtRM(me.members * 0.1)} dues a week
            </div>
          </div>
        </div>
      </section>
      <button className="chip self-start" onClick={() => openPanel("nominations")}>
        Candidates and nominations
      </button>
      <CoalitionCard />
      <Career />
    </div>
  );
}

function Meter({ label, value, max = 100, note, warn }: { label: string; value: number; max?: number; note: string; warn?: boolean }) {
  return (
    <div className="inset p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {label}
        </span>
        <span className="font-semibold tabular-nums text-sm" style={{ color: warn ? "var(--bad)" : "var(--ink)" }}>
          {warn ? "▲ " : ""}
          {Math.round(value)}
        </span>
      </div>
      <div className="h-1 rounded-full mt-1.5" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: warn ? "var(--bad)" : "var(--ink-2)" }} />
      </div>
      <div className="text-[10.5px] mt-1 leading-snug" style={{ color: "var(--muted)" }}>
        {note}
      </div>
    </div>
  );
}
