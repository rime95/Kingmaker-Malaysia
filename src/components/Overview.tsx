"use client";

import { useState } from "react";
import { ACTIONS, type ActionGroup } from "@/game/actions";
import { MACC } from "@/game/config";
import { useGame } from "@/store/gameStore";
import { STATES } from "@/game/world";
import { ActionCard } from "./ActionCard";
import { ReportBody } from "./ReportModal";
import { fmt, fmtRM } from "./common";

const GROUPS: { id: ActionGroup; title: string; hint: string }[] = [
  { id: "national", title: "National campaign", hint: "Messaging everywhere at once." },
  { id: "party", title: "Party", hint: "Unity makes every action work better; coalition trust under 40 costs you in every seat." },
  { id: "finance", title: "Money", hint: "Clean money is slow; fast money attracts MACC." },
];

export function Overview() {
  const game = useGame((s) => s.game)!;
  const me = game.me;
  const [tourState, setTourState] = useState(STATES[0].id);
  const maccChance = Math.max(0, me.risk - MACC.threshold) / MACC.divisor;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Meter label="Political capital" value={me.capital} max={200} note="Spent on announcements and, later, policies" />
        <Meter label="Party unity" value={me.unity} note="Multiplies every action" />
        <Meter label="Coalition trust" value={me.trust} warn={me.trust < 40} note={me.trust < 40 ? "Partners squabbling: costs you everywhere" : "Partners are on board"} />
        <Meter label="Integrity" value={me.integrity} note="Urban voters reward clean parties" />
        <Meter label="MACC risk" value={me.risk} warn={maccChance > 0} note={maccChance > 0 ? `${(maccChance * 100).toFixed(1)}% chance of a raid each week` : "No investigation likely"} />
        <Meter label="Media reach" value={me.reach} note="Boosts national campaigns" />
        <Meter label="National buzz" value={me.nationalBuzz} note="Fades about 6% a week" />
        <Stat label="Members" value={fmt(me.members)} note={`${fmtRM(me.members * 0.1)} dues a week`} />
      </div>

      {game.report && (
        <section className="panel p-4">
          <h2 className="font-semibold mb-2">Last {game.report.weeks === 4 ? "month" : "week"}</h2>
          <ReportBody report={game.report} />
        </section>
      )}

      {GROUPS.map((g) => (
        <section key={g.id} className="panel p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
            <h2 className="font-semibold">{g.title}</h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {g.hint}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ACTIONS.filter((a) => a.group === g.id && a.target === "none").map((a) => (
              <ActionCard key={a.id} id={a.id} target={{ kind: "none" }} />
            ))}
          </div>
        </section>
      ))}

      <section className="panel p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
          <h2 className="font-semibold">Ceramah tour</h2>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            For one seat, click it on the Seat map.
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <select value={tourState} onChange={(e) => setTourState(e.target.value)} className="rounded-lg border px-2 py-2 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink)" }}>
            {STATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex-1 min-w-[240px]">
            <ActionCard id="tour" target={{ kind: "state", state: tourState }} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Meter({ label, value, max = 100, note, warn }: { label: string; value: number; max?: number; note: string; warn?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {label}
        </span>
        <span className="font-semibold tabular-nums" style={{ color: warn ? "var(--bad)" : "var(--ink)" }}>
          {warn ? "▲ " : ""}
          {Math.round(value)}
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: warn ? "var(--bad)" : "var(--ink-2)" }} />
      </div>
      <div className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--muted)" }}>
        {note}
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel p-3">
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
        {note}
      </div>
    </div>
  );
}
