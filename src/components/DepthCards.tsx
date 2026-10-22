"use client";

import { MESSAGE, THEMES, THEME_BY_ID, discipline } from "@/game/systems/message";
import { COUNCIL_EVERY, WINGS } from "@/game/systems/partyorg";
import { SEGMENT_LABEL, type Segment } from "@/game/systems/segments";
import { useGame } from "@/store/gameStore";
import { fmtRM } from "./common";

/** Your campaign message: pick one theme and stick with it. */
export function MessageCard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const cur = game.strategy.theme ? THEME_BY_ID[game.strategy.theme] : null;
  const d = discipline(game);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="eyebrow">Your message</h3>
        {cur && (
          <span className="text-[11px]" style={{ color: "var(--muted)" }}>
            Discipline {Math.round(d * 100)}%
          </span>
        )}
      </div>
      {cur ? (
        <div className="inset p-2.5 mb-2">
          <div className="font-bold">“{cur.slogan}”</div>
          <div className="text-xs" style={{ color: "var(--ink-2)" }}>
            {cur.name}: {cur.blurb}
          </div>
          <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${d * 100}%`, background: "var(--accent)" }} />
          </div>
        </div>
      ) : (
        <p className="text-xs mb-2" style={{ color: "var(--ink-2)" }}>
          Pick the one thing your campaign is about. It grows stronger over {MESSAGE.disciplineWeeks} weeks of sticking to it, and louder with national buzz.
        </p>
      )}
      <div className="grid gap-1.5 @md:grid-cols-2">
        {THEMES.filter((t) => t.id !== cur?.id).map((t) => (
          <button key={t.id} className="card card-action inset px-2.5 py-2 text-left text-xs" onClick={() => deep({ kind: "theme", id: t.id })} title={t.blurb}>
            <span className="block font-semibold text-[13px]">{t.name}</span>
            <span className="block truncate" style={{ color: "var(--ink-2)" }}>
              {(Object.entries(t.seg) as [Segment, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${SEGMENT_LABEL[k]} ${v > 0 ? "▲" : "▼"}`)
                .join(" · ")}
            </span>
          </button>
        ))}
      </div>
      {cur && (
        <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Changing costs {MESSAGE.switchCapital} capital and resets discipline.
        </p>
      )}
    </section>
  );
}

/** The Youth and Wanita wings, and when the Supreme Council next meets. */
export function WingsCard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const next = COUNCIL_EVERY - ((game.week - 3 + COUNCIL_EVERY * 100) % COUNCIL_EVERY);
  const wing = (key: "youth" | "women", name: string, does: string) => (
    <div className="inset p-2.5 text-xs flex flex-col gap-1">
      <div className="flex justify-between">
        <b className="text-[13px]">{name}</b>
        <span className="tabular-nums" style={{ color: game.wings[key] < 40 ? "var(--bad)" : "var(--ink-2)" }}>
          {Math.round(game.wings[key])}
        </span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${game.wings[key]}%`, background: "var(--ink-2)" }} />
      </div>
      <span style={{ color: "var(--muted)" }}>{does}</span>
      <button className="chip !py-1 self-start" onClick={() => deep({ kind: "wing", wing: key })}>
        Fund · {WINGS.ap} AP · {fmtRM(WINGS.cost)}
      </button>
    </div>
  );
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="eyebrow">Party wings</h3>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          Supreme Council meets in {next === COUNCIL_EVERY ? 0 : next} week{next === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-2 grid-cols-2">
        {wing("youth", "Pemuda (Youth)", "Wins young voters and gets the vote out. Fades unless funded.")}
        {wing("women", "Wanita", "Works every kampung and signs up members. Fades unless funded.")}
      </div>
    </section>
  );
}
