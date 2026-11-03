"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MalaysiaMap } from "./map/MalaysiaMap";
import { fmtRM } from "@/game/money";
import { TIER_TEXT } from "@/game/systems/formation";
import { useGame } from "@/store/gameStore";
import { coalitionLeader } from "@/game/systems/coalitions";
import { cshort, MAJORITY, SEATS, SUPERMAJORITY, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor, fmt } from "./common";
import { CoalitionTalks } from "./CoalitionTalks";
import { useT } from "./i18n";
import { audio, sfx } from "./audio";
import { CoalitionFlag, JalurGemilang, PartyFlag } from "./flags";
import { SoundControls } from "./SoundControls";

/** Milliseconds per seat call at 1× (222 seats ≈ 40 seconds). */
const STEP_MS = 180;
/** The opening countdown, in seconds. */
const COUNTDOWN = 3;

/**
 * The climax, as a TV broadcast: polls close, results come in seat by seat, the map fills in, the scoreboard races to
 * 112, breaking-news banners mark every gain, loss and upset, then the talks to form a government and the Agong's
 * decision. The result is already decided in the engine; this screen only reveals it.
 */
export function ElectionNight() {
  const game = useGame((s) => s.game);
  const endNight = useGame((s) => s.endNight);
  const [stage, setStage] = useState<"count" | "talks">("count");
  if (!game?.night || !game.lastElection) return null;
  if (!game.formation) {
    return <Verdict onClose={endNight} />;
  }
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto tv" role="dialog" aria-label="Election Night">
      {stage === "count" ? <Count onDone={() => setStage("talks")} /> : <CoalitionTalks />}
    </div>
  );
}

function clockLabel(progress: number): string {
  // Polls close at 6pm; the last seats are called around 2am.
  const minutes = 18 * 60 + Math.round(progress * 8 * 60);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 && h < 24 ? "PM" : "AM"}`;
}

type Call = { seatIndex: number; winner: CoalitionId; winnerParty: string; majority: number; callOrder: number };
type Moment = { key: number; kind: "gain" | "loss" | "upset"; seat: number; winner: CoalitionId; from: CoalitionId; majority: number };
type Big = { kind: "majority" | "twothirds" | "hung"; c?: CoalitionId };

/** Your result in a seat: held, gained (rampas) or lost; nothing if it was never yours. */
function markOf(winner: CoalitionId, before: CoalitionId, player: CoalitionId): "hold" | "gain" | "lost" | undefined {
  if (winner === player) return before === player ? "hold" : "gain";
  return before === player ? "lost" : undefined;
}

function Count({ onDone }: { onDone: () => void }) {
  const game = useGame((s) => s.game)!;
  const result = game.lastElection!;
  const prev = game.night!.prevHolders;
  const player = game.player;
  const order = useMemo(() => [...result.seats].sort((a, b) => a.callOrder - b.callOrder) as Call[], [result]);
  const [k, setK] = useState(0);
  const [intro, setIntro] = useState(COUNTDOWN);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [big, setBig] = useState<Big | null>(null);
  const shown = useRef(new Set<string>());
  const t = useT();

  // Polls close: a three-second countdown before the first seat.
  useEffect(() => {
    if (intro <= 0) return;
    sfx(intro === 1 ? "call" : "chime");
    const id = setTimeout(() => setIntro((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [intro]);

  const countAt = (n: number) => {
    const out = Object.fromEntries(CHART_ORDER.map((c) => [c, 0])) as Record<CoalitionId, number>;
    for (const r of order.slice(0, n)) out[r.winner]++;
    return out;
  };

  /** Declare up to seat `n`: a sound and a banner for the last one; the count stops for a majority or a hung parliament. */
  const declareTo = (n: number) => {
    const r = order[n - 1];
    if (r) {
      const from = prev[r.seatIndex];
      const flip = from !== r.winner;
      const upset = flip && SEATS[r.seatIndex].ge15Majority > 8000;
      const m = { key: n, seat: r.seatIndex, winner: r.winner, from, majority: r.majority };
      if (flip && r.winner === player) {
        sfx("gain");
        sfx("crowd");
        setMoment({ ...m, kind: "gain" });
      } else if (flip && from === player) {
        sfx("loss");
        sfx("groan");
        setMoment({ ...m, kind: "loss" });
      } else if (upset && speed <= 4 && n - k === 1) {
        sfx("call");
        setMoment({ ...m, kind: "upset" });
      } else if (speed <= 4 && n % 3 === 0) sfx("hold");
    }
    const c = countAt(n);
    let stop: Big | null = null;
    for (const x of CHART_ORDER) {
      if (c[x] >= SUPERMAJORITY && !shown.current.has(`2/3${x}`)) {
        shown.current.add(`2/3${x}`).add(`maj${x}`);
        stop = { kind: "twothirds", c: x };
        break;
      }
      if (c[x] >= MAJORITY && !shown.current.has(`maj${x}`)) {
        shown.current.add(`maj${x}`);
        stop = { kind: "majority", c: x };
        break;
      }
    }
    if (!stop && n >= TOTAL_SEATS && !CHART_ORDER.some((x) => c[x] >= MAJORITY) && !shown.current.has("hung")) {
      shown.current.add("hung");
      stop = { kind: "hung" };
    }
    if (stop) {
      sfx(stop.kind === "hung" ? "call" : "majority");
      setBig(stop);
    }
    setK(n);
  };

  useEffect(() => {
    if (intro > 0 || !playing || big || k >= TOTAL_SEATS) return;
    const id = setTimeout(() => declareTo(Math.min(TOTAL_SEATS, k + 1)), STEP_MS / speed);
    return () => clearTimeout(id);
  });

  // The kompang drives harder as your seats climb toward a majority.
  const mine = countAt(k)[player];
  useEffect(() => {
    if (!audio) return;
    audio.intensity = Math.min(1, mine / MAJORITY);
    return () => {
      if (audio) audio.intensity = 0;
    };
  }, [mine]);

  useEffect(() => {
    if (!moment) return;
    const id = setTimeout(() => setMoment(null), 2600 / Math.min(speed, 2));
    return () => clearTimeout(id);
  }, [moment, speed]);

  const called = order.slice(0, k);
  const counts = countAt(k);
  const done = k >= TOTAL_SEATS;

  const revealed = new Set(called.map((r) => r.seatIndex));
  const nightFills = SEATS.map((_, i) => {
    const r = revealed.has(i) ? result.seats[i] : null;
    if (!r) return { fill: "var(--land)" };
    return { fill: coalColor(r.winner), flipped: prev[i] !== r.winner, mark: markOf(r.winner, prev[i], player) };
  });
  // A gold star on every seat you took from someone else.
  const stars = called.filter((r) => r.winner === player && prev[r.seatIndex] !== player).map((r) => ({ key: `star${r.seatIndex}`, seat: r.seatIndex, kind: "star" as const, icon: "★" }));
  const held = called.filter((r) => r.winner === player && prev[r.seatIndex] === player).length;
  const gains = called.filter((r) => r.winner === player && prev[r.seatIndex] !== player).length;
  const losses = called.filter((r) => r.winner !== player && prev[r.seatIndex] === player).length;
  const votes = result.seats.reduce((s, r) => s + Object.values(r.votes).reduce((a, b) => a + (b ?? 0), 0), 0);
  const electorate = SEATS.reduce((s, x) => s + x.electorate, 0);

  return (
    <div className="min-h-full flex flex-col relative">
      {/* The studio: spotlights sweeping behind the set */}
      <div className="tv-studio" aria-hidden>
        <span className="tv-beam tv-beam-l" />
        <span className="tv-beam tv-beam-r" />
      </div>
      {/* The broadcast bar */}
      <header className="tv-bar sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="tv-live">
          <span className="tv-live-dot" /> LIVE
        </span>
        <JalurGemilang height={22} wave />
        <div className="leading-tight">
          <div className="text-[11px] font-bold tracking-[0.2em] tv-gold">PRU{game.geCount} · MALAM PILIHAN RAYA</div>
          <div className="text-lg font-black tabular-nums">
            {done ? t("allDeclared") : `${clockLabel(k / TOTAL_SEATS)} · ${k} / ${TOTAL_SEATS} ${t("declared")}`}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SoundControls compact />
          {!done && (
            <>
              <button className="btn btn-ghost" onClick={() => setPlaying((p) => !p)}>
                {playing ? t("pause") : t("resume")}
              </button>
              <button className="btn btn-ghost" onClick={() => setSpeed((s) => (s === 1 ? 4 : s === 4 ? 12 : 1))}>
                {t("speed")} {speed}×
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setIntro(0);
                  declareTo(TOTAL_SEATS);
                }}
              >
                {t("skipEnd")}
              </button>
            </>
          )}
          {done && !big && (
            <button className="btn" onClick={onDone}>
              {t("toTalks")}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex flex-col gap-3 flex-1 relative">
        <Scoreboard counts={counts} player={player} />
        <RaceTo112 counts={counts} player={player} />

        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr] flex-1">
          <div className="panel p-2 relative overflow-hidden">
            <MalaysiaMap className="relative h-[54vh] min-h-[320px]" clip fills={nightFills} markers={stars} showDuns="never" ariaLabel="Seats declared so far" />
            {moment && <LowerThird m={moment} />}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] px-1 pt-1" style={{ color: "var(--ink-2)" }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="legend-mark legend-hold" /> You hold <b className="tabular-nums">{held}</b>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="legend-mark legend-gain">★</span> Rampas · gained <b className="tabular-nums">{gains}</b>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="legend-mark legend-lost" /> Terlepas · lost <b className="tabular-nums">{losses}</b>
              </span>
              <span style={{ color: "var(--muted)" }}>Grey: still counting. Dashed: changed hands.</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <CrowdCam
              mood={moment?.kind === "gain" ? "cheer" : moment?.kind === "loss" ? "quiet" : counts[player] >= MAJORITY ? "cheer" : "tense"}
              share={counts[player] / MAJORITY}
            />
            <Swingometer gains={gains} losses={losses} player={player} />
            <div className="panel p-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Your gains" value={`+${gains}`} tone="var(--good)" />
              <Stat label="Your losses" value={`−${losses}`} tone="var(--bad)" />
              <Stat label="Turnout" value={`${Math.round((votes / electorate) * 100)}%`} />
            </div>
            <Declarations order={called} prev={prev} player={player} />
          </div>
        </div>
      </div>

      <Crawl order={called} prev={prev} player={player} />

      {intro > 0 && <PollsClose n={intro} />}
      {big && (
        <BigMoment
          big={big}
          counts={counts}
          onGo={() => {
            setBig(null);
            if (done) onDone();
          }}
          done={done}
        />
      )}
    </div>
  );
}

/** 6pm: the ballot boxes close. */
function PollsClose({ n }: { n: number }) {
  return (
    <div className="tv-overlay">
      <div className="text-center">
        <div className="text-sm font-bold tracking-[0.3em]" style={{ color: "var(--accent)" }}>
          6:00 PM · PETI UNDI DITUTUP
        </div>
        <div className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>
          Polls have closed across Malaysia. Counting begins in
        </div>
        <div key={n} className="tv-count">
          {n}
        </div>
      </div>
    </div>
  );
}

/** The race to 112: one bar for the whole Dewan, and the leaders' tiles. */
function Scoreboard({ counts, player }: { counts: Record<CoalitionId, number>; player: CoalitionId }) {
  const game = useGame((s) => s.game)!;
  const order = CHART_ORDER.filter((c) => counts[c] > 0);
  const top = [...order].sort((a, b) => counts[b] - counts[a]).slice(0, 4);
  const declared = order.reduce((a, c) => a + counts[c], 0);
  return (
    <div className="panel p-3">
      <div className="grid grid-cols-2 @container md:grid-cols-4 gap-2 mb-3">
        {top.map((c, i) => (
          <div key={c} className="tv-tile" style={{ borderColor: coalColor(c), boxShadow: i === 0 ? `0 0 24px -8px ${coalColor(c)}` : undefined }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-black tracking-wide inline-flex items-center gap-1.5">
                <CoalitionFlag game={game} c={c} size={14} />
                {cshort(c)}
                {c === player ? " ★" : ""}
              </span>
              <span className="text-3xl font-black tabular-nums" style={{ color: coalColor(c) }}>
                {counts[c]}
              </span>
            </div>
            <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
              {coalitionLeader(game, c)} · {counts[c] >= MAJORITY ? "MAJORITY" : `${MAJORITY - counts[c]} short`}
            </div>
          </div>
        ))}
      </div>
      <div className="relative h-7 rounded-md overflow-hidden flex" style={{ background: "var(--surface-2)" }}>
        {order.map((c) => (
          <div
            key={c}
            className="h-full transition-[width] duration-200"
            style={{ width: `${(counts[c] / TOTAL_SEATS) * 100}%`, background: coalColor(c) }}
            title={`${cshort(c)} ${counts[c]}`}
          />
        ))}
        <div className="absolute inset-y-0 w-[3px]" style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, background: "#fff", boxShadow: "0 0 8px #fff" }} />
      </div>
      <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--muted)" }}>
        <span>{declared} declared</span>
        <span style={{ marginLeft: `${(MAJORITY / TOTAL_SEATS) * 100 - 12}%` }}>▲ {MAJORITY} for a majority</span>
        <span>{TOTAL_SEATS - declared} to go</span>
      </div>
    </div>
  );
}

/** The race to 112: the leading blocs run in lanes, their leaders riding the tips, past the majority line. */
function RaceTo112({ counts, player }: { counts: Record<CoalitionId, number>; player: CoalitionId }) {
  const game = useGame((s) => s.game)!;
  const lanes: CoalitionId[] = CHART_ORDER.filter((c) => c !== "OTHERS")
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3);
  // You always have a lane, even before your first seat.
  if (!lanes.includes(player)) lanes[2] = player;
  // The track runs to 160 so the two-thirds mark (148) sits near the end.
  const max = 160;
  const at = (n: number) => `${(Math.min(n, max) / max) * 100}%`;
  return (
    <div className="panel p-3 tv-race" aria-label="Race to 112">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-widest mb-2" style={{ color: "var(--muted)" }}>
        <span>LUMBA KE PUTRAJAYA · RACE TO 112</span>
        <span className="tv-gold">148 = two-thirds</span>
      </div>
      <div className="grid grid-cols-[84px_1fr] gap-x-2 gap-y-2.5 items-center py-1">
        {lanes.map((c) => (
          <span key={c} className="text-[11px] font-black tracking-wide inline-flex items-center gap-1 truncate" style={{ gridColumn: 1 }}>
            <CoalitionFlag game={game} c={c} size={10} /> {cshort(c)}{" "}
            <span className="tabular-nums" style={{ color: coalColor(c) }}>
              {counts[c]}
            </span>
          </span>
        ))}
        <div className="relative flex flex-col gap-2.5" style={{ gridColumn: 2, gridRow: `1 / span ${lanes.length}` }}>
          <div className="tv-race-line" style={{ left: at(MAJORITY) }}>
            <span>112</span>
          </div>
          <div className="tv-race-line tv-race-gold" style={{ left: at(SUPERMAJORITY) }} />
          {lanes.map((c) => {
            const won = counts[c] >= MAJORITY;
            const name = c === player ? game.career.name : coalitionLeader(game, c);
            return (
              <div key={c} className="relative h-6 rounded-full" style={{ background: "var(--surface-2)" }}>
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${won ? "tv-race-won" : ""}`}
                  style={{ width: at(counts[c]), background: coalColor(c), boxShadow: `0 0 18px -4px ${coalColor(c)}` }}
                />
                <div className="tv-racer" style={{ left: at(counts[c]), borderColor: coalColor(c) }} title={name}>
                  {initialsOf(name)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

/** Picture-in-picture: your party's HQ, where the crowd cheers your gains and falls silent at your losses. */
function CrowdCam({ mood, share }: { mood: "cheer" | "tense" | "quiet"; share: number }) {
  const game = useGame((s) => s.game)!;
  const party = game.coalitions[game.player].members[0] ?? game.player;
  const city = SEATS[game.career.homeSeat]?.name ?? "Kuala Lumpur";
  const people = 26;
  return (
    <div
      className={`panel tv-cam tv-cam-${mood}`}
      aria-label={`Your party headquarters: the crowd is ${mood === "cheer" ? "cheering" : mood === "quiet" ? "silent" : "watching nervously"}`}
    >
      <div className="tv-cam-tag">
        <span className="tv-live-dot" /> LIVE · {party} HQ, {city}
      </div>
      <div className="tv-cam-screen">
        <div className="tv-cam-stage">
          <span className="tv-cam-banner">
            <PartyFlag id={party} size={16} /> {game.career.name.toUpperCase()}
          </span>
        </div>
        <div className="tv-crowd">
          {Array.from({ length: people }, (_, k) => {
            const flag = k % 4 === 1;
            return (
              <span
                key={k}
                className="tv-fan"
                style={{
                  left: `${(k / people) * 100 + ((k * 37) % 7) * 0.4}%`,
                  animationDelay: `${((k * 53) % 10) / 14}s`,
                  bottom: `${((k * 29) % 3) * 6}px`,
                  transform: `scale(${0.8 + ((k * 17) % 5) / 12})`,
                }}
              >
                {flag && (
                  <span className="tv-fan-flag">
                    <PartyFlag id={party} size={9} />
                  </span>
                )}
                <span className="tv-fan-head" />
                <span className="tv-fan-body" />
              </span>
            );
          })}
        </div>
        <div className="tv-cam-meter" style={{ width: `${Math.min(100, share * 100)}%`, background: coalColor(game.player) }} />
      </div>
      <div className="tv-cam-caption">
        {mood === "cheer" ? 'The hall erupts: "Menang! Menang!"' : mood === "quiet" ? "A hush falls over the hall." : "Supporters watch the screens, waiting."}
      </div>
    </div>
  );
}

/** A breaking-news banner over the map. */
function LowerThird({ m }: { m: Moment }) {
  const seat = SEATS[m.seat];
  const label = m.kind === "gain" ? "KERUSI DIRAMPAS · SEAT GAINED" : m.kind === "loss" ? "KERUSI TERLEPAS · SEAT LOST" : "KEJUTAN · UPSET";
  return (
    <div key={m.key} className="tv-lower" role="status">
      <div className="tv-lower-tag" style={{ background: m.kind === "loss" ? "var(--bad)" : m.kind === "gain" ? coalColor(m.winner) : "var(--accent)" }}>
        {label}
      </div>
      <div className="tv-lower-body">
        <b>{seat.name}</b> ({seat.code}) · {cshort(m.winner)} takes it from {cshort(m.from)} by {fmt(m.majority)} votes
      </div>
    </div>
  );
}

/** The swingometer: your net gains and losses tonight. */
function Swingometer({ gains, losses, player }: { gains: number; losses: number; player: CoalitionId }) {
  const net = gains - losses;
  const angle = Math.max(-80, Math.min(80, net * 4));
  return (
    <div className="panel p-3">
      <div className="text-xs font-bold tracking-widest" style={{ color: "var(--muted)" }}>
        SWINGOMETER
      </div>
      <svg viewBox="0 0 200 110" className="w-full h-auto max-h-[140px]">
        <defs>
          <linearGradient id="swing" x1="0" x2="1">
            <stop offset="0" stopColor="var(--bad)" />
            <stop offset="0.5" stopColor="#4b5168" />
            <stop offset="1" stopColor={coalColor(player)} />
          </linearGradient>
        </defs>
        <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="url(#swing)" strokeWidth="14" strokeLinecap="round" />
        {[-60, -30, 0, 30, 60].map((a) => (
          <line key={a} x1="100" y1="22" x2="100" y2="30" stroke="var(--muted)" strokeWidth="1.5" transform={`rotate(${a} 100 100)`} />
        ))}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px", transition: "transform 400ms cubic-bezier(.3,1.6,.5,1)" }}>
          <line x1="100" y1="100" x2="100" y2="24" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill="#fff" />
      </svg>
      <div className="text-center text-sm font-bold -mt-1" style={{ color: net > 0 ? "var(--good)" : net < 0 ? "var(--bad)" : "var(--ink-2)" }}>
        {net === 0 ? "No net change yet" : `${net > 0 ? "+" : ""}${net} seats ${net > 0 ? "to" : "from"} ${cshort(player)}`}
      </div>
    </div>
  );
}

function Declarations({ order, prev, player }: { order: Call[]; prev: CoalitionId[]; player: CoalitionId }) {
  const last = order.slice(-6).reverse();
  return (
    <div className="panel p-3 flex flex-col gap-1.5" aria-live="polite">
      <div className="text-xs font-bold tracking-widest" style={{ color: "var(--muted)" }}>
        LATEST DECLARATIONS
      </div>
      {last.length === 0 && <div className="text-sm">Counting is under way…</div>}
      {last.map((r) => {
        const seat = SEATS[r.seatIndex];
        const flip = prev[r.seatIndex] !== r.winner;
        const upset = flip && seat.ge15Majority > 8000;
        // Your seats get their own tags: rampas (gained), kekal (held), terlepas (lost).
        const mark = markOf(r.winner, prev[r.seatIndex], player);
        const tag =
          mark === "gain"
            ? `★ RAMPAS from ${cshort(prev[r.seatIndex])}`
            : mark === "lost"
              ? `TERLEPAS to ${cshort(r.winner)}`
              : mark === "hold"
                ? "KEKAL"
                : upset
                  ? "UPSET"
                  : flip
                    ? `GAIN from ${cshort(prev[r.seatIndex])}`
                    : r.majority < 300
                      ? "RECOUNT"
                      : r.majority < 1500
                        ? "Too close to call"
                        : "";
        return (
          <div key={r.seatIndex} className={`tv-row flex items-center gap-2 text-sm ${mark ? `tv-row-${mark}` : ""}`}>
            <PartyFlag id={r.winnerParty} size={11} />
            <span className="truncate">
              <b>{seat.name}</b> · {r.winnerParty} ({cshort(r.winner)}) {flip ? "wins" : "holds"} by {fmt(r.majority)}
            </span>
            {tag && (
              <span
                className="ml-auto text-[10px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap"
                style={
                  mark === "gain"
                    ? { background: "#ffcc00", color: "#1a1300" }
                    : mark === "lost"
                      ? { background: "#d9363e", color: "#fff" }
                      : mark === "hold"
                        ? { background: "#fff", color: "#111" }
                        : { background: "var(--surface-2)", color: "#fff" }
                }
              >
                {tag}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The crawl along the bottom of the screen. */
function Crawl({ order, prev, player }: { order: Call[]; prev: CoalitionId[]; player: CoalitionId }) {
  const items = order.slice(-14).reverse();
  if (!items.length) return null;
  // Your seats stand out in the ticker too: gold for rampas, white for kekal, red for terlepas.
  const line = () =>
    items.map((r, n) => {
      const mark = markOf(r.winner, prev[r.seatIndex], player);
      const what = mark === "gain" ? "★ RAMPAS" : mark === "lost" ? "TERLEPAS" : mark === "hold" ? "KEKAL" : prev[r.seatIndex] !== r.winner ? "GAIN" : "hold";
      return (
        <span key={n} className={mark ? `tv-crawl-${mark}` : undefined}>
          {SEATS[r.seatIndex].name}: {cshort(r.winner)} {what} ({fmt(r.majority)}){n < items.length - 1 ? "   •   " : ""}
        </span>
      );
    });
  return (
    <div className="tv-crawl" aria-hidden>
      <span className="tv-crawl-tag">TERKINI</span>
      <div className="tv-crawl-track">
        <span>{line()}</span>
        <span>{line()}</span>
      </div>
    </div>
  );
}

/** A coalition crosses 112 (or 148), or the night ends hung. */
function BigMoment({ big, counts, onGo, done }: { big: Big; counts: Record<CoalitionId, number>; onGo: () => void; done: boolean }) {
  const game = useGame((s) => s.game)!;
  const c = big.c;
  const title = big.kind === "hung" ? "PARLIMEN TERGANTUNG" : big.kind === "twothirds" ? "MAJORITI DUA PERTIGA" : "MAJORITI MUDAH";
  const sub =
    big.kind === "hung"
      ? `Hung parliament. Nobody reaches ${MAJORITY} alone: the talks to form a government begin.`
      : `${cshort(c!)} wins ${big.kind === "twothirds" ? `a two-thirds supermajority (${SUPERMAJORITY}+)` : `a majority on its own (${MAJORITY}+)`}. ${coalitionLeader(game, c!)} is heading for Istana Negara.`;
  const color = c ? coalColor(c) : "var(--accent)";
  return (
    <div className="tv-overlay" onClick={onGo}>
      <div className="text-center px-6 tv-pop">
        {c && <Fireworks color={color} />}
        <div className="text-xs font-bold tracking-[0.3em]" style={{ color: "var(--accent)" }}>
          BERITA TERKINI · BREAKING
        </div>
        <div className="text-4xl md:text-6xl font-black mt-2" style={{ color, textShadow: `0 0 40px ${color}` }}>
          {title}
        </div>
        <p className="text-base md:text-lg mt-3 max-w-xl mx-auto" style={{ color: "var(--ink)" }}>
          {sub}
        </p>
        {c && (
          <div className="text-6xl font-black tabular-nums mt-3" style={{ color }}>
            {counts[c]}
          </div>
        )}
        <button className="btn mt-5" onClick={onGo} autoFocus>
          {done ? "Continue" : "Keep counting"}
        </button>
      </div>
    </div>
  );
}

function Fireworks({ color }: { color: string }) {
  return (
    <div className="tv-fireworks" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{ background: i % 3 ? color : "#ffd166", left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.18}s` }} />
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-2xl font-black tabular-nums" style={{ color: tone }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

/** After the Agong's decision: the result tier for this election. */
function Verdict({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game)!;
  const tr = useT();
  const tier = game.tiers.at(-1);
  useEffect(() => {
    if (tier && tier.tier !== "none") sfx(tier.tier === "platinum" || tier.tier === "diamond" ? "majority" : "fanfare");
  }, [tier]);
  if (!tier) return null;
  const t = TIER_TEXT[tier.tier];
  const pm = game.parliament.pm;
  const inGov = game.government.includes(game.player);
  const top = tier.tier === "platinum" || tier.tier === "diamond";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.75)" }}
      role="dialog"
      aria-label="Election verdict"
    >
      <div className="panel p-6 w-full max-w-md text-center flex flex-col gap-3 relative overflow-hidden tv-pop">
        {top && <Fireworks color={coalColor(game.player)} />}
        <div className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {tr("verdict")}
        </div>
        <div
          className="text-5xl font-black"
          style={{ color: tier.tier === "none" ? "var(--bad)" : "var(--accent)", textShadow: top ? "0 0 30px var(--accent)" : undefined }}
        >
          {t.name}
        </div>
        <p className="text-sm">{t.text}</p>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Prime Minister: {coalitionLeader(game, pm)} ({cshort(pm)}) with {tier.govSeats} seats behind the government.{" "}
          {pm === game.player ? "That's you." : inGov ? "You are in government." : "You are in opposition."}
        </p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Your seats: {tier.seats}. War chest: {fmtRM(game.me.funds)}. The next term starts now.
        </p>
        <button className="btn self-center" onClick={onClose} autoFocus>
          {tr("newTerm")}
        </button>
      </div>
    </div>
  );
}
