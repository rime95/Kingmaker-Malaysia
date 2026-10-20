"use client";

import { useGame, type Panel } from "@/store/gameStore";
import { useT, type StringKey } from "../i18n";
import { Icon } from "./icons";

const ITEMS: { id: Panel; label: StringKey }[] = [
  { id: "campaign", label: "campaign" },
  { id: "party", label: "career" },
  { id: "people", label: "people" },
  { id: "team", label: "team" },
  { id: "policy", label: "policy" },
  { id: "states", label: "states" },
  { id: "parliament", label: "dewan" },
  { id: "rivals", label: "rivals" },
  { id: "treasury", label: "treasury" },
];

/** Left icon rail on desktop, bottom bar on phones. Each icon opens one panel over the map. */
export function NavRail() {
  const { panel, openPanel } = useGame();
  const t = useT();
  return (
    <nav className="panel flex md:flex-col gap-1 p-1.5 justify-between md:justify-around overflow-x-auto md:overflow-visible scroll-thin" aria-label="Panels">
      {ITEMS.map((it) => {
        const on = panel === it.id;
        return (
          <button
            key={it.id}
            onClick={() => openPanel(it.id)}
            aria-pressed={on}
            title={t(it.label)}
            className="flex-none flex flex-col items-center gap-0.5 rounded-xl px-1.5 md:px-2 py-2 min-w-[44px] md:w-[58px] transition-colors"
            style={{ background: on ? "linear-gradient(135deg, var(--primary-a), var(--primary-b))" : "transparent", color: on ? "#fff" : "var(--ink-2)" }}
          >
            <Icon name={it.id === "parliament" ? "parliament" : it.id} className="w-5 h-5" />
            <span className="text-[9px] font-semibold leading-tight text-center">{t(it.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
