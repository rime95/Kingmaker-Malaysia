"use client";

import { useEffect, useMemo, useState } from "react";
import { MalaysiaMap } from "./map/MalaysiaMap";
import { fmtRM } from "@/game/money";
import { TIER_TEXT } from "@/game/systems/formation";
import { useGame } from "@/store/gameStore";
import { COALITION_INFO, MAJORITY, SEATS, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor, fmt } from "./common";
import { CoalitionTalks } from "./CoalitionTalks";
import { useT } from "./i18n";

/** Seconds per seat call at 1× (222 seats ≈ 40 seconds). */
const STEP_MS = 180;

/**
 * The climax: results come in seat by seat, the map fills in, the counters race to 112, then the talks to form a
 * government and the Agong's decision. The result is already decided in the engine; this screen only reveals it.
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
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--bg)" }} role="dialog" aria-label="Election Night">
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

function Count({ onDone }: { onDone: () => void }) {
  const game = useGame((s) => s.game)!;
  const result = game.lastElection!;
  const prev = game.night!.prevHolders;
  const player = game.player;
  const order = useMemo(() => [...result.seats].sort((a, b) => a.callOrder - b.callOrder), [result]);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const t = useT();
  const sound = useGame((s) => s.sound);
  const setSound = useGame((s) => s.setSound);

  // A short tone per declared seat (higher for your gains), when sound is on.
  useEffect(() => {
    if (!sound || k === 0 || k > TOTAL_SEATS) return;
    const r = order[k - 1];
    beep(r.winner === player && prev[r.seatIndex] !== player ? 880 : r.winner === player ? 660 : 330);
  }, [k, sound, order, player, prev]);

  useEffect(() => {
    if (!playing || k >= TOTAL_SEATS) return;
    const t = setTimeout(() => setK((x) => Math.min(TOTAL_SEATS, x + 1)), STEP_MS / speed);
    return () => clearTimeout(t);
  }, [k, playing, speed]);

  const called = order.slice(0, k);
  const counts = Object.fromEntries(CHART_ORDER.map((c) => [c, 0])) as Record<CoalitionId, number>;
  for (const r of called) counts[r.winner]++;
  const revealed = new Set(called.map((r) => r.seatIndex));
  const nightFills = SEATS.map((_, i) => {
    const r = revealed.has(i) ? result.seats[i] : null;
    return r ? { fill: coalColor(r.winner), flipped: prev[i] !== r.winner } : { fill: "var(--land)" };
  });
  const done = k >= TOTAL_SEATS;
  const gains = called.filter((r) => r.winner === player && prev[r.seatIndex] !== player);
  const losses = called.filter((r) => r.winner !== player && prev[r.seatIndex] === player);
  const latestGain = gains.length && gains.at(-1) === called.at(-1) ? gains.at(-1) : null;
  const votes = result.seats.reduce((s, r) => s + Object.values(r.votes).reduce((a, b) => a + (b ?? 0), 0), 0);
  const electorate = SEATS.reduce((s, x) => s + x.electorate, 0);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-4 flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            {t("liveResults")}
          </div>
          <h1 className="text-2xl font-bold tabular-nums">{done ? t("allDeclared") : `${clockLabel(k / TOTAL_SEATS)} · ${k} / 222 ${t("declared")}`}</h1>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" onClick={() => setSound(!sound)} aria-pressed={sound}>
            {t("sound")} {sound ? "on" : "off"}
          </button>
          {!done && (
            <>
              <button className="btn btn-ghost" onClick={() => setPlaying((p) => !p)}>
                {playing ? t("pause") : t("resume")}
              </button>
              <button className="btn btn-ghost" onClick={() => setSpeed((s) => (s === 1 ? 4 : s === 4 ? 12 : 1))}>
                {t("speed")} {speed}×
              </button>
              <button className="btn btn-ghost" onClick={() => setK(TOTAL_SEATS)}>
                {t("skipEnd")}
              </button>
            </>
          )}
          {done && (
            <button className="btn" onClick={onDone}>
              {t("toTalks")}
            </button>
          )}
        </div>
      </header>

      <RaceBars counts={counts} player={player} />

      {latestGain && (
        <div className="rounded-lg px-4 py-2 text-center font-bold" style={{ background: coalColor(player), color: "#fff" }} role="status">
          {t("seatStolen")} {SEATS[latestGain.seatIndex].name} from {COALITION_INFO[prev[latestGain.seatIndex]].short}, by {fmt(latestGain.majority)} votes
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-3">
          <MalaysiaMap className="relative h-[52vh] min-h-[320px]" fills={nightFills} showDuns="never" ariaLabel="Seats declared so far" />
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Grey: still counting. Dashed outline: the seat changed hands.
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="panel p-3 grid grid-cols-3 gap-2 text-center">
            <Big label="Your gains" value={`+${gains.length}`} />
            <Big label="Your losses" value={`−${losses.length}`} />
            <Big label="Turnout" value={`${Math.round((votes / electorate) * 100)}%`} />
          </div>
          <Ticker order={called} prev={prev} player={player} />
          {done && <Summary counts={counts} prev={prev} player={player} />}
        </div>
      </div>
    </div>
  );
}

function RaceBars({ counts, player }: { counts: Record<CoalitionId, number>; player: CoalitionId }) {
  const top = CHART_ORDER.filter((c) => counts[c] > 0).sort((a, b) => counts[b] - counts[a]);
  return (
    <div className="panel p-3 flex flex-col gap-1.5">
      {top.slice(0, 6).map((c) => (
        <div key={c} className="grid grid-cols-[72px_1fr_40px] items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: c === player ? "var(--ink)" : "var(--ink-2)" }}>
            {COALITION_INFO[c].short}
            {c === player ? " ★" : ""}
          </span>
          <div className="relative h-5 rounded-sm" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-sm transition-[width] duration-150" style={{ width: `${(counts[c] / TOTAL_SEATS) * 100}%`, background: coalColor(c) }} />
            <div className="absolute -top-1 -bottom-1 w-[2px]" style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, background: "var(--ink)" }} />
          </div>
          <span className="text-sm font-bold tabular-nums text-right">{counts[c]}</span>
        </div>
      ))}
      <div className="text-[11px] text-right" style={{ color: "var(--muted)" }}>
        Line = {MAJORITY} seats for a majority
      </div>
    </div>
  );
}

function Ticker({ order, prev, player }: { order: { seatIndex: number; winner: CoalitionId; winnerParty: string; majority: number; callOrder: number }[]; prev: CoalitionId[]; player: CoalitionId }) {
  const last = order.slice(-7).reverse();
  return (
    <div className="panel p-3 flex flex-col gap-1.5" aria-live="polite">
      <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        Latest declarations
      </div>
      {last.length === 0 && <div className="text-sm">Polls have closed. Counting is under way…</div>}
      {last.map((r) => {
        const seat = SEATS[r.seatIndex];
        const flip = prev[r.seatIndex] !== r.winner;
        const upset = flip && seat.ge15Majority > 8000;
        const tags: string[] = [];
        if (upset) tags.push("UPSET");
        else if (flip) tags.push(`GAIN from ${COALITION_INFO[prev[r.seatIndex]].short}`);
        if (r.majority < 300) tags.push("RECOUNT");
        else if (r.majority < 1500) tags.push("Too close to call");
        return (
          <div key={r.seatIndex} className="flex items-center gap-2 text-sm">
            <span className="swatch" style={{ background: coalColor(r.winner) }} />
            <span className="truncate">
              <b>{seat.name}</b> · {r.winnerParty} ({COALITION_INFO[r.winner].short}) {flip ? "wins" : "holds"} by {fmt(r.majority)}
            </span>
            {tags.map((t) => (
              <span
                key={t}
                className="ml-auto text-[10px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap border"
                style={{ borderColor: r.winner === player || prev[r.seatIndex] === player ? "var(--ink)" : "var(--line)" }}
              >
                {t}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Summary({ counts, prev, player }: { counts: Record<CoalitionId, number>; prev: CoalitionId[]; player: CoalitionId }) {
  const before = prev.filter((h) => h === player).length;
  const now = counts[player];
  return (
    <div className="panel p-4">
      <div className="font-semibold mb-1">The night in one line</div>
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        {COALITION_INFO[player].short} {now >= before ? "rises" : "falls"} from {before} to {now} seats. Nobody reaches {MAJORITY} alone
        {CHART_ORDER.some((c) => counts[c] >= MAJORITY) ? "… except one coalition, which has a majority on its own." : ", so the talks begin."}
      </p>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
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
  if (!tier) return null;
  const t = TIER_TEXT[tier.tier];
  const pm = game.parliament.pm;
  const inGov = game.government.includes(game.player);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgb(0 0 0 / 0.6)" }} role="dialog" aria-label="Election verdict">
      <div className="panel p-6 w-full max-w-md text-center flex flex-col gap-3">
        <div className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {tr("verdict")}
        </div>
        <div className="text-4xl font-black" style={{ color: tier.tier === "none" ? "var(--bad)" : "var(--accent)" }}>
          {t.name}
        </div>
        <p className="text-sm">{t.text}</p>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Prime Minister: {COALITION_INFO[pm].leader} ({COALITION_INFO[pm].short}) with {tier.govSeats} seats behind the government.{" "}
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

let audio: AudioContext | null = null;
function beep(freq: number) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.13);
  } catch {}
}
