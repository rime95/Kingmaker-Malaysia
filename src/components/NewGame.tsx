"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { DIFFICULTY, DIFFICULTY_ROWS, SCENARIOS, type Difficulty, type ScenarioId } from "@/game/config";
import { defaultHomeSeat } from "@/game/systems/career";
import { TIER_TEXT } from "@/game/systems/formation";
import { useGame } from "@/store/gameStore";
import { metaSnapshot, underdogUnlocked, type Meta } from "@/store/meta";
import { COALITION_INFO, SEATS, STATE_BY_ID, contestingIn, type CoalitionId } from "@/game/world";
import { coalColor } from "./common";
import { SaveSlots } from "./SaveSlots";
import { Toast } from "./Toast";

const PLAYABLE: CoalitionId[] = ["PH", "BN", "PN", "GPS", "GRS", "WARISAN", "MUDA"];
const noop = () => () => {};
const EMPTY: Meta = { best: {} };

export function NewGame() {
  const start = useGame((s) => s.start);
  const meta = useSyncExternalStore(noop, metaSnapshot, () => EMPTY);
  const [pick, setPick] = useState<CoalitionId | null>(null);
  const [mode, setMode] = useState<"leader" | "career">("leader");
  const [name, setName] = useState("");
  const [home, setHome] = useState<number | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("present");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const seats = useMemo(() => (pick ? SEATS.filter((s) => contestingIn(s).includes(pick)).sort((a, b) => a.name.localeCompare(b.name)) : []), [pick]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-2">Malaysia · general election</div>
        <h1 className="text-4xl font-black tracking-tight" style={{ background: "linear-gradient(90deg, var(--primary-a), var(--primary-b))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Malam Pilihan Raya
        </h1>
        <p className="mt-2" style={{ color: "var(--ink-2)" }}>
          Build your power base, hold what you have and win election night. Pick the coalition you will lead.
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
                setHome(defaultHomeSeat(c));
              }}
              className="panel p-4 text-left hover:shadow-md transition-shadow"
              style={{ borderLeft: `5px solid ${coalColor(c)}`, outline: pick === c ? "2px solid var(--ink)" : undefined }}
              aria-pressed={pick === c}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{info.name}</span>
                <span className="text-sm tabular-nums" style={{ color: "var(--ink-2)" }}>
                  {n} seats
                </span>
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
          <h2 className="font-semibold">Your game with {COALITION_INFO[pick].name}</h2>
          <Choice label="How you play">
            <button className="chip" aria-pressed={mode === "leader"} onClick={() => setMode("leader")}>
              Leader: start as {COALITION_INFO[pick].leader}, party president
            </button>
            <button className="chip" aria-pressed={mode === "career"} onClick={() => setMode("career")}>
              Career: start as a branch chief and climb
            </button>
          </Choice>
          {mode === "career" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm flex flex-col gap-1">
                Your name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisyah" maxLength={40} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink)" }} />
              </label>
              <label className="text-sm flex flex-col gap-1">
                Home seat (you will contest it to become an MP)
                <select value={home ?? ""} onChange={(e) => setHome(Number(e.target.value))} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink)" }}>
                  {seats.map((s) => (
                    <option key={s.index} value={s.index}>
                      {s.name} ({STATE_BY_ID[s.state].name}) · held by {COALITION_INFO[s.ge15Coalition].short}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
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
          <button className="btn self-start" onClick={() => start(pick, { mode, name, homeSeat: home ?? undefined, scenario, difficulty })}>
            Start
          </button>
        </section>
      )}

      <SaveSlots />
      <Toast />
    </div>
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
