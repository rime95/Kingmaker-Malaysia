"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DIFFICULTY, DIFFICULTY_ROWS, SCENARIOS, type Difficulty, type ScenarioId } from "@/game/config";
import { TIER_TEXT } from "@/game/systems/formation";
import { useGame } from "@/store/gameStore";
import { metaSnapshot, underdogUnlocked, type Meta } from "@/store/meta";
import { cname, COALITION_INFO, SEATS, type CoalitionId } from "@/game/world";
import { coalColor } from "./common";
import { SaveSlots } from "./SaveSlots";
import { Toast } from "./Toast";
import { MalaysiaMap } from "./map/MalaysiaMap";
import { SoundControls } from "./SoundControls";
import { sfx } from "./audio";

const PLAYABLE: CoalitionId[] = ["PH", "BN", "PN", "GPS", "GRS", "WARISAN", "MUDA", "BERSAMA"];
const noop = () => () => {};
const EMPTY: Meta = { best: {} };

export function NewGame() {
  const start = useGame((s) => s.start);
  const meta = useSyncExternalStore(noop, metaSnapshot, () => EMPTY);
  const [pick, setPick] = useState<CoalitionId | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("present");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [name, setName] = useState("");
  const named = name.trim().length >= 2;

  const pickerRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col">
      <Hero onStart={() => pickerRef.current?.scrollIntoView({ behavior: "smooth" })} />
    <div ref={pickerRef} className="mx-auto w-full max-w-4xl px-4 py-10 flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Pilih parti anda · Choose your party</div>
        <p style={{ color: "var(--ink-2)" }}>
          Build your power base, hold what you have and win election night. You are the party president: pick the coalition you will lead.
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Data snapshot: Oct 2026 leaders, GE15 seat results, approximate state assembly splits. Real parties and leaders are used for
          flavour; every event and result in the game is simulated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PLAYABLE.map((c) => {
          const info = COALITION_INFO[c];
          const n = SEATS.filter((s) => s.ge15Coalition === c).length;
          const best = meta.best[c];
          return (
            <button
              key={c}
              onClick={() => {
                setPick(c);
                sfx("chime");
              }}
              className="panel party-card p-4 text-left"
              style={{ borderLeft: `5px solid ${coalColor(c)}`, outline: pick === c ? "2px solid var(--ink)" : undefined }}
              aria-pressed={pick === c}
            >
              <div className="flex items-center gap-3">
                <span className="party-avatar" style={{ background: coalColor(c) }} aria-hidden>
                  {initials(info.leader)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{info.name}</span>
                    <span className="text-sm tabular-nums" style={{ color: "var(--ink-2)" }}>
                      {n} seats
                    </span>
                  </div>
                  <div className="h-1 rounded-full mt-1" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (n / 112) * 100)}%`, background: coalColor(c) }} />
                  </div>
                </div>
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {info.leader} · {info.inGovernment ? "Government" : "Opposition"}
                {best ? ` · Your best: ${TIER_TEXT[best].name}` : ""}
              </div>
              <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
                {info.blurb}
              </p>
            </button>
          );
        })}
      </div>

      {pick && (
        <section className="panel p-4 flex flex-col gap-4">
          <h2 className="font-semibold">Your game with {cname(pick)}</h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Your name</span>
            <input
              className="inset px-3 py-2 text-sm"
              value={name}
              maxLength={40}
              autoFocus
              placeholder={`e.g. ${COALITION_INFO[pick].leader}`}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && named && start(pick, { mode: "leader", scenario, difficulty, name })}
            />
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              You are the new president of {cname(pick)}, taking over from {COALITION_INFO[pick].leader}.
            </span>
          </label>
          <Choice label="Scenario">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
              const locked = id === "underdog" && !underdogUnlocked(meta);
              return (
                <button key={id} className="chip" aria-pressed={scenario === id} disabled={locked} style={locked ? { opacity: 0.45, cursor: "not-allowed" } : undefined} title={locked ? "Unlocks after any Gold result or better" : SCENARIOS[id].text} onClick={() => setScenario(id)}>
                  {locked ? "🔒 " : ""}
                  {SCENARIOS[id].label}
                </button>
              );
            })}
          </Choice>
          <p className="text-xs -mt-2" style={{ color: "var(--muted)" }}>
            {SCENARIOS[scenario].text}
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Difficulty</span>
            <div className="grid grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] text-xs rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
              <div />
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <button key={d} className="px-2 py-2 font-semibold text-sm" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)} style={{ background: difficulty === d ? "var(--raised)" : undefined, color: difficulty === d ? "var(--ink)" : "var(--ink-2)", boxShadow: difficulty === d ? "inset 0 -2px 0 var(--primary-a)" : undefined }}>
                  {DIFFICULTY[d].label}
                </button>
              ))}
              {DIFFICULTY_ROWS.map((row) => (
                <Fragment key={row.label}>
                  <div className="px-2 py-1" style={{ color: "var(--muted)", borderTop: "1px solid var(--line)" }}>
                    {row.label}
                  </div>
                  {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                    <div key={d} className="px-2 py-1 text-center tabular-nums cursor-pointer" onClick={() => setDifficulty(d)} style={{ borderTop: "1px solid var(--line)", background: difficulty === d ? "var(--raised)" : undefined, color: difficulty === d ? "var(--ink)" : "var(--ink-2)" }}>
                      {row.get(DIFFICULTY[d])}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {DIFFICULTY[difficulty].text}
            </p>
          </div>
          <button className="btn self-start" disabled={!named} title={named ? undefined : "Name your character first."} onClick={() => start(pick, { mode: "leader", scenario, difficulty, name })}>
            {named ? "Start" : "Name your character to start"}
          </button>
        </section>
      )}

      <SaveSlots />
      <Toast />
    </div>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w) && !["Abdul", "Abang", "Bin", "Binti"].includes(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/** Seats in a random-looking but fixed order, for the title map to light up. */
const REVEAL = SEATS.map((s) => s.index).sort((a, b) => ((a * 7919) % 223) - ((b * 7919) % 223));

/** The title screen: Malaysia lights up seat by seat behind the title. */
function Hero({ onStart }: { onStart: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= SEATS.length) return;
    const id = setTimeout(() => setN((x) => Math.min(SEATS.length, x + 3)), 45);
    return () => clearTimeout(id);
  }, [n]);
  const lit = useMemo(() => new Set(REVEAL.slice(0, n)), [n]);
  const fills = useMemo(() => SEATS.map((s) => (lit.has(s.index) ? { fill: coalColor(s.ge15Coalition) } : { fill: "var(--land)" })), [lit]);
  return (
    <section className="hero">
      <div className="hero-map" aria-hidden>
        <MalaysiaMap className="relative w-full h-full" fills={fills} showDuns="never" controls={false} clip />
      </div>
      <div className="hero-shade" aria-hidden />
      <div className="absolute top-4 right-4 z-10">
        <SoundControls compact />
      </div>
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="jalur" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ background: i % 2 ? "#fff" : "#cc0001" }} />
          ))}
        </div>
        <div className="text-xs md:text-sm font-bold tracking-[0.35em] mt-4" style={{ color: "#ffcc00" }}>
          PILIHAN RAYA UMUM · MALAYSIA
        </div>
        <h1 className="hero-title">MALAM PILIHAN RAYA</h1>
        <p className="text-lg md:text-2xl font-semibold mt-2">222 kerusi. Satu malam. Siapa akan membentuk kerajaan?</p>
        <p className="text-sm md:text-base mt-1" style={{ color: "var(--ink-2)" }}>
          222 seats. One night. Who will form the government?
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-7">
          <button
            className="btn hero-cta"
            onClick={() => {
              sfx("fanfare");
              onStart();
            }}
          >
            Mula · Start
          </button>
          <button className="btn btn-ghost" onClick={() => document.getElementById("saves")?.scrollIntoView({ behavior: "smooth" })}>
            Load a game
          </button>
        </div>
        <div className="mt-8 text-xs tabular-nums" style={{ color: "var(--muted)" }}>
          {n < SEATS.length ? `Counting… ${n} / 222` : "GE15: a hung parliament. The next one is yours to win."}
        </div>
      </div>
    </section>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
