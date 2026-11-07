"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { careerTitle } from "@/game/progress";
import { isGovernment, weekLabel } from "@/game/state";
import { termOf, weeksToElection } from "@/game/systems/assemblies";
import { useGame } from "@/store/gameStore";
import {
  COALITIONS,
  cshort,
  MAJORITY,
  TOTAL_SEATS,
  type CoalitionId,
} from "@/game/world";
import { CHART_ORDER, fmtRM } from "../common";
import { coalColor } from "../map/lenses";
import { useT } from "../i18n";
import { Icon } from "./icons";
import { SoundControls } from "../SoundControls";
import { Bunting, CoalitionFlag } from "../flags";
import type { GameState } from "@/game/state";

/** Campaign bunting: the flags of every party standing, strung along the top. */
const buntingFor = (g: GameState) => {
  const ids = COALITIONS.filter(
    (c) => c !== "OTHERS" && g.coalitions[c].members.length,
  ).flatMap((c) => g.coalitions[c].members.slice(0, 3));
  return Array.from({ length: 28 }, (_, k) => ids[k % ids.length]);
};

/**
 * The command bar: who you are, the race to 112 as the latest poll sees it, and your resources. On narrow screens it
 * also holds the docket button and End turn (on wide screens the docket column has them).
 */
const FAST: [string, number][] = [
  ["Fast forward 1 month", 4],
  ["Fast forward 3 months", 13],
  ["Fast forward 6 months", 26],
  ["To the next big moment", 52],
];

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

const CAPITAL_HELP = "Political capital: your standing and the favours you can call in, up to 200. It pays for political moves: policies, appointments, inviting parties, mega projects, whipping votes. You earn 1 a week, 10 for an objective, a by-election or a state, and more from Wawasan milestones and finished programmes.";

export function TopBar({
  onSaves,
  onDocket,
}: {
  onSaves: () => void;
  onDocket?: () => void;
}) {
  const game = useGame((s) => s.game)!;
  const { skipWeek } = useGame();
  const t = useT();
  // The race as the latest national poll sees it (not the hidden true numbers).
  const poll = game.polls.national[0];
  const counts =
    poll?.seats ??
    (Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<
      CoalitionId,
      number
    >);
  const marginal = poll?.marginal ?? 0;
  const top: CoalitionId[] = COALITIONS.filter((c) => c !== "OTHERS")
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3);
  if (!top.includes(game.player)) top[2] = game.player;
  const toPoll = weeksToElection(game);
  const me = game.me;
  const pending = game.cards.length + (game.budgetDue !== null ? 1 : 0);
  const gov = isGovernment(game);
  const term = termOf(game);
  const campaign = game.parliament.status === "campaign";
  const termLine = campaign ? "Parliament dissolved" : `${ordinal(term.number)} Parliament, year ${term.year} of ${term.of}`;
  const termHelp = campaign
    ? `Polling day is ${weekLabel(game.parliament.pollWeek ?? game.week)}.`
    : `The ${ordinal(term.number)} Parliament must dissolve by ${weekLabel(game.parliament.deadlineWeek)}, ${Math.max(0, game.parliament.deadlineWeek - game.week)} weeks from now.`;
  return (
    <header className="command-bar panel px-2.5 sm:px-3 py-2 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 sm:gap-4 relative">
      <div className="sm:hidden order-last w-full text-[11px] num" style={{ color: "var(--ink-2)" }} title={termHelp}>
        {weekLabel(game.week)} · {campaign ? "Parliament dissolved" : `Year ${term.year} of ${term.of}, ${ordinal(term.number)} Parliament`}
      </div>
      {game.parliament.status === "campaign" && (
        <Bunting ids={buntingFor(game)} />
      )}
      {/* Who you are */}
      <div className="min-w-0 flex-none flex items-center gap-2.5">
        <CoalitionFlag game={game} c={game.player} size={22} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="dossier-title text-base leading-none">
              {cshort(game.player)}
            </span>
            <span className="gov-badge hidden sm:inline" data-gov={gov}>
              {gov ? t("government") : t("opposition")}
            </span>
          </div>
          <div
            className="hidden sm:block text-[11px] truncate max-w-[200px] mt-0.5"
            style={{ color: "var(--ink-2)" }}
          >
            {game.career.name} · {careerTitle(game)}
          </div>
          <div className="hidden sm:block text-[11px] mt-0.5 num whitespace-nowrap" style={{ color: "var(--ink-2)" }} title={termHelp}>
            {weekLabel(game.week)} · {campaign ? `polls on ${weekLabel(game.parliament.pollWeek ?? game.week)}` : termLine}
          </div>
        </div>
      </div>

      {/* The race to 112 */}
      <div
        className="hidden lg:flex flex-1 min-w-0 flex-col gap-1 max-w-[560px] mx-auto"
        title={
          poll
            ? `${poll.pollster} poll, ${weekLabel(poll.week)}: seats if the election were held then`
            : undefined
        }
      >
        <div className="flex items-baseline justify-between gap-3 text-[11px]">
          {top.map((c) => (
            <span
              key={c}
              className="inline-flex items-baseline gap-1.5"
              style={{
                color: c === game.player ? "var(--ink)" : "var(--ink-2)",
              }}
            >
              <CoalitionFlag game={game} c={c} size={10} />
              <span className="font-semibold">{cshort(c)}</span>
              <span className="dossier-title text-lg num leading-none">
                {counts[c]}
              </span>
              {c === game.player ? (
                <span style={{ color: "var(--brass)" }}>★</span>
              ) : null}
            </span>
          ))}
          <span style={{ color: "var(--muted)" }}>
            marginal <b className="num">{marginal}</b>
          </span>
        </div>
        <div
          className="relative h-2 w-full rounded-full overflow-hidden flex gap-px"
          style={{ background: "var(--surface-2)" }}
        >
          {CHART_ORDER.filter((c) => counts[c]).map((c) => (
            <div
              key={c}
              style={{
                width: `${(counts[c] / TOTAL_SEATS) * 100}%`,
                background: coalColor(c),
              }}
            />
          ))}
          <div
            className="absolute -inset-y-0.5 w-[2px]"
            style={{
              left: `${(MAJORITY / TOTAL_SEATS) * 100}%`,
              background: "var(--brass-hi)",
            }}
            title="112: a majority"
          />
          <div
            className="absolute -inset-y-0.5 w-px opacity-70"
            style={{
              left: `${(148 / TOTAL_SEATS) * 100}%`,
              background: "var(--brass)",
            }}
            title="148: two-thirds"
          />
        </div>
      </div>
      <div className="flex-1 lg:hidden" />

      {/* Your resources */}
      <div className="flex-none flex items-center gap-2 sm:gap-4">
        <div className="hidden sm:block text-right">
          <div className="eyebrow !text-[10px]">
            {game.parliament.status === "campaign" ? "Polling in" : "GE in"}
          </div>
          <div
            className="text-sm font-semibold num"
            style={{
              color:
                game.parliament.status === "campaign"
                  ? "var(--bad)"
                  : "var(--ink)",
            }}
          >
            {toPoll} wk{toPoll === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow !text-[10px] hidden sm:block">{t("warChest")}</div>
          <div
            key={Math.round(me.funds / 10_000)}
            className="dossier-title text-base num flash"
            style={{ color: me.funds < 0 ? "var(--bad)" : "var(--ink)" }}
          >
            {fmtRM(me.funds)}
          </div>
        </div>
        <div className="text-right" title={CAPITAL_HELP}>
          <div className="eyebrow !text-[10px] hidden sm:block">Capital</div>
          <div className="dossier-title text-base num" aria-label={`Political capital ${Math.round(me.capital)}`}>
            <span className="sm:hidden text-[10px]">Cap </span>
            {Math.round(me.capital)}
          </div>
        </div>
        <div
          className="hidden sm:block"
          title={`${me.ap} of ${me.apMax} action points left`}
        >
          <div className="eyebrow !text-[10px]">AP {me.ap}</div>
          <div className="flex gap-1 mt-1 max-w-[120px] flex-wrap">
            {Array.from({ length: me.apMax }, (_, i) => (
              <span key={i} className="ap-pip" data-on={i < me.ap} />
            ))}
          </div>
        </div>
        {onDocket && (
          <span className="lg:hidden">
            <button
              className="chip relative"
              onClick={onDocket}
              aria-label={`Docket, ${pending} waiting`}
            >
              <Icon name="bell" className="w-4 h-4" />
              <span className="hidden sm:inline">Docket</span>
              {pending > 0 && (
                <span
                  className="font-bold"
                  style={{ color: "var(--brass-hi)" }}
                >
                  {pending}
                </span>
              )}
            </button>
          </span>
        )}
        <button
          className={`btn flex-none !px-3 lg:hidden ${me.ap === 0 && !pending ? "btn-ready" : ""}`}
          onClick={skipWeek}
          title="End turn: two weeks (N or Space)"
        >
          End ▸
        </button>
        <Menu onSaves={onSaves} />
      </div>
    </header>
  );
}

function Menu({ onSaves }: { onSaves: () => void }) {
  const {
    fastForward,
    simulate,
    quit,
    testTools,
    setTestTools,
    test,
    setRecordOpen,
    retire,
    summaryOn,
    setSummaryOn,
    autoSkip,
    setAutoSkip,
  } = useGame();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = (label: string, fn: () => void, hint?: string) => (
    <button
      className="w-full text-left px-3 py-2 rounded-lg text-sm menu-item"
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
      <button
        className="chip !px-2 !py-2"
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-expanded={open}
      >
        <Icon name="menu" className="w-5 h-5" />
      </button>
      {open && (
        <div className="panel absolute right-0 top-full mt-2 w-56 p-1.5 z-50 pop-in">
          {FAST.map(([label, weeks]) => (
            <Fragment key={label}>{item(label, () => fastForward(weeks), "Routine decisions take their default answer. Stops at anything big: elections, your Budget, crises, a partner walking out. You get one summary at the end.")}</Fragment>
          ))}
          {item(
            t("testElection"),
            simulate,
            "Your strategists run a full test election on the true numbers. Seats do not change hands.",
          )}
          {testTools && (
            <>
              <div
                className="h-px my-1"
                style={{ background: "var(--line)" }}
              />
              <div
                className="eyebrow px-3 pt-1"
                style={{ color: "var(--accent)" }}
              >
                Test tools
              </div>
              {item(
                "Run general election now",
                () => test("ge"),
                "Dissolve now and jump to polling day.",
              )}
              {item(
                "Run Dewan vote now",
                () => test("sitting"),
                "Call the Dewan into session if needed and take the next vote now.",
              )}
              {item("+10 AP, +RM 10M", () => test("boost"))}
              {item(
                "Open party polls now",
                () => test("polls"),
                "Start this term's party polls: the deputy, vice presidents and council are up in 4 weeks.",
              )}
            </>
          )}
          <div className="h-px my-1" style={{ background: "var(--line)" }} />
          <SoundControls />
          <div className="h-px my-1" style={{ background: "var(--line)" }} />
          {item(
            testTools ? "Hide test tools" : "Show test tools",
            () => setTestTools(!testTools),
            "Play-test shortcuts that bend the rules.",
          )}
          {item(
            summaryOn ? "Turn summary: on" : "Turn summary: off",
            () => setSummaryOn(!summaryOn),
            "Show how each turn went in a card when it ends.",
          )}
          {item(
            autoSkip ? "Skip quiet weeks and routine decisions: on" : "Skip quiet weeks and routine decisions: off",
            () => setAutoSkip(!autoSkip),
            "On: End turn keeps going for up to 12 weeks until something big needs you, and routine decisions take their default answer. Off: every turn stops and you decide every card yourself.",
          )}
          {item("Your record & achievements", () => setRecordOpen(true))}
          {item(
            "Retire and see your legacy",
            () =>
              confirm(
                "Retire now? Your protégé takes over after you see your legacy.",
              ) && retire(),
            "Step down: see what you leave behind, then your protégé leads.",
          )}
          {item(t("saves"), onSaves)}
          {item(
            t("newGame"),
            () =>
              confirm(
                "Start a new game? Save this one first if you want to keep it.",
              ) && quit(),
          )}
        </div>
      )}
    </div>
  );
}
