"use client";

import { useRef, useState } from "react";
import { useGame } from "@/store/gameStore";
import { deleteSlot, exportGame, importGame, listSlots, loadSlot, saveSlot, type Slot } from "@/store/slots";

/** Named save slots in this browser, and save files to move a game between computers. */
export function SaveSlots({ onDone }: { onDone?: () => void }) {
  const game = useGame((s) => s.game);
  const load = useGame((s) => s.load);
  const notify = useGame((s) => s.notify);
  const [slots, setSlots] = useState<Slot[]>(() => listSlots());
  const [name, setName] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const refresh = () => setSlots(listSlots());

  return (
    <section className="panel p-4 flex flex-col gap-3">
      <h2 className="font-semibold">Saved games</h2>
      {game && (
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this save (optional)"
            maxLength={60}
            className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-[180px]"
            style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink)" }}
          />
          <button
            className="btn"
            onClick={() => {
              const ok = saveSlot(game, name);
              notify(ok ? "Game saved in this browser." : "Couldn't save: browser storage is blocked or full.", !ok);
              setName("");
              refresh();
            }}
          >
            Save
          </button>
          <button className="btn btn-ghost" onClick={() => exportGame(game)}>
            Download save file
          </button>
        </div>
      )}
      {slots.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          No saves in this browser yet. The current game also saves itself automatically.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {slots.map((s) => (
            <li key={s.id} className="card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)" }}>
              <div className="flex-1 min-w-[180px]">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {s.summary} · saved {new Date(s.savedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              <button
                className="chip"
                onClick={() => {
                  if (game && !confirm("Load this save? Your current game will be replaced (it stays in its own slots if you saved it).")) return;
                  const g = loadSlot(s.id);
                  if (g) {
                    load(g);
                    onDone?.();
                  }
                }}
              >
                Load
              </button>
              <button
                className="chip"
                onClick={() => {
                  if (!confirm(`Delete "${s.name}"?`)) return;
                  deleteSlot(s.id);
                  refresh();
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button className="btn btn-ghost text-sm" onClick={() => file.current?.click()}>
          Load from file…
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const g = await importGame(f);
            if (!g) return notify("That file isn't a Malam Pilihan Raya save.", true);
            load(g);
            onDone?.();
          }}
        />
      </div>
    </section>
  );
}
