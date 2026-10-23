"use client";

import { useEffect, useRef, useState } from "react";
import { careerTitle } from "@/game/progress";
import { isGovernment, weekLabel } from "@/game/state";
import { weeksToElection } from "@/game/systems/assemblies";
import { useGame } from "@/store/gameStore";
import { COALITIONS, cshort, MAJORITY, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER, fmtRM } from "../common";
import { coalColor } from "../map/lenses";
import { useT } from "../i18n";
import { Icon } from "./icons";
import { SoundControls } from "../SoundControls";

/** The slim status bar across the top (GE16 "status report" style). */
export function TopBar({ onSaves }: { onSaves: () => void }) {
  const game = useGame((s) => s.game)!;
  const { skipWeek, unsnooze, snoozed, budgetSnoozed } = useGame();
  const t = useT();
  // The race as the latest national poll sees it (not the hidden true numbers).
  const poll = game.polls.national[0];
  const counts = poll?.seats ?? (Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<CoalitionId, number>);
  const marginal = poll?.marginal ?? 0;
  const top: CoalitionId[] = COALITIONS.filter((c) => c !== "OTHERS")
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3);
  if (!top.includes(game.player)) top[2] = game.player;
  const toPoll = weeksToElection(game);
  const me = game.me;
  const pending = game.cards.length + (game.budgetDue !== null ? 1 : 0);
  const waiting = pending > 0 && (snoozed.length > 0 || budgetSnoozed);

  return (
    <header className="panel px-3 py-2 flex items-center gap-2 sm:gap-3">
      <div className="min-w-0 flex-none">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="swatch" style={{ background: coalColor(game.player) }} />
          {cshort(game.player)}
          <span className="font-normal hidden sm:inline" style={{ color: "var(--muted)" }}>
            · {isGovernment(game) ? t("government") : t("opposition")}
          </span>
        </div>
        <div className="hidden sm:block text-[11px] truncate max-w-[180px]" style={{ color: "var(--ink-2)" }}>
          {game.career.name} · {careerTitle(game)}
        </div>
      </div>

      <div className="hidden md:block w-px self-stretch" style={{ background: "var(--line)" }} />

      <div className="flex-none">
        <div className="eyebrow">Week {game.week + 1}</div>
        <div className="text-sm font-semibold tabular-nums">{weekLabel(game.week)}</div>
        <div className="hidden sm:block text-[11px] tabular-nums" style={{ color: game.parliament.status === "campaign" ? "var(--bad)" : "var(--muted)" }}>
          {game.parliament.status === "campaign" ? `Polling in ${toPoll} wk${toPoll === 1 ? "" : "s"}` : `GE in ~${toPoll} wks`}
        </div>
      </div>

      {/* The latest national poll */}
      <div className="hidden lg:flex flex-1 min-w-0 flex-col items-center gap-1">
        <div className="flex items-end gap-6">
          {top.map((c) => (
            <div key={c} className="text-center">
              <div className="text-2xl font-black tabular-nums leading-none" style={{ color: c === game.player ? "var(--ink)" : "var(--ink-2)" }}>
                {counts[c]}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 mt-0.5" style={{ color: "var(--ink-2)" }}>
                <span className="swatch" style={{ background: coalColor(c), width: 8, height: 8 }} />
                {cshort(c)}
                {c === game.player ? " ★" : ""}
              </div>
            </div>
          ))}
          <div className="text-center">
            <div className="text-2xl font-black tabular-nums leading-none" style={{ color: "var(--muted)" }}>
              {marginal}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--muted)" }}>
              Marginal
            </div>
          </div>
        </div>
        <div className="relative h-1.5 w-full max-w-[420px] rounded-full overflow-hidden flex gap-px" title={poll ? `${poll.pollster} poll, ${weekLabel(poll.week)}: seats if the election were held then` : undefined} style={{ background: "var(--surface-2)" }}>
          {CHART_ORDER.filter((c) => counts[c]).map((c) => (
            <div key={c} style={{ width: `${(counts[c] / TOTAL_SEATS) * 100}%`, background: coalColor(c) }} />
          ))}
          <div className="absolute inset-y-0 w-[2px]" style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, background: "#fff" }} />
        </div>
      </div>
      <div className="flex-1 lg:hidden" />

      <div className="flex-none text-right hidden sm:block">
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          {t("warChest")}
        </div>
        <div key={Math.round(me.funds / 10_000)} className="font-bold tabular-nums flash" style={{ color: me.funds < 0 ? "var(--bad)" : "var(--ink)" }}>
          {fmtRM(me.funds)}
        </div>
      </div>
      <div className="flex-none hidden sm:block" title={`${me.ap} of ${me.apMax} action points left this week`}>
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          AP
        </div>
        <div className="flex gap-1 mt-1">
          {Array.from({ length: me.apMax }, (_, i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full transition-colors duration-300" style={{ background: i < me.ap ? "var(--ink)" : "var(--surface-2)", border: "1px solid var(--line)", boxShadow: i < me.ap ? "0 0 6px rgb(236 238 246 / 0.5)" : "none" }} />
          ))}
        </div>
      </div>

      {waiting && (
        <button className="relative chip" onClick={unsnooze} aria-label={`${pending} decisions waiting`}>
          <Icon name="bell" className="w-4 h-4" />
          <span className="font-bold" style={{ color: "var(--accent)" }}>
            {pending}
          </span>
        </button>
      )}
      <button className={`btn flex-none !px-3 sm:!px-4 ${me.ap === 0 && !pending ? "btn-ready" : ""}`} onClick={skipWeek} title="Next turn: two weeks (N or Space)">
        <span className="hidden sm:inline">{t("skipWeek")}</span>
        <span className="sm:hidden" aria-label={t("skipWeek")}>Next ▸</span>
      </button>
      <Menu onSaves={onSaves} />
    </header>
  );
}

function Menu({ onSaves }: { onSaves: () => void }) {
  const { skipMonth, skipToEvent, simulate, quit, lang, setLang, testTools, setTestTools, test, setRecordOpen } = useGame();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = (label: string, fn: () => void, hint?: string) => (
    <button
      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5"
      title={hint}
      onClick={() => {
        setOpen(false);
        fn();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="relative flex-none" ref={ref}>
      <button className="chip !px-2 !py-2" onClick={() => setOpen((o) => !o)} aria-label="More" aria-expanded={open}>
        <Icon name="menu" className="w-5 h-5" />
      </button>
      {open && (
        <div className="panel absolute right-0 top-full mt-2 w-56 p-1.5 z-50 pop-in">
          {item(t("skipMonth"), skipMonth)}
          {item(t("skipEvent"), skipToEvent, "Skips up to 12 weeks, stopping at anything that needs you.")}
          {item(t("testElection"), simulate, "Your strategists run a full test election on the true numbers. Seats do not change hands.")}
          {testTools && (
            <>
              <div className="h-px my-1" style={{ background: "var(--line)" }} />
              <div className="eyebrow px-3 pt-1" style={{ color: "var(--accent)" }}>
                Test tools
              </div>
              {item("Run general election now", () => test("ge"), "Dissolve now and jump to polling day.")}
              {item("Run Dewan vote now", () => test("sitting"), "Call the Dewan into session if needed and take the next vote now.")}
              {item("+10 AP, +RM 10M", () => test("boost"))}
            </>
          )}
          <div className="h-px my-1" style={{ background: "var(--line)" }} />
          <SoundControls />
          <div className="h-px my-1" style={{ background: "var(--line)" }} />
          {item(testTools ? "Hide test tools" : "Show test tools", () => setTestTools(!testTools), "Play-test shortcuts that bend the rules.")}
          {item("Your record & achievements", () => setRecordOpen(true))}
          {item(t("saves"), onSaves)}
          {item(lang === "en" ? "Bahasa Malaysia" : "English", () => setLang(lang === "en" ? "ms" : "en"))}
          {item(t("newGame"), () => confirm("Start a new game? Save this one first if you want to keep it.") && quit())}
        </div>
      )}
    </div>
  );
}
