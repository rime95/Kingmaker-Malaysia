"use client";

import { useGame, type Panel } from "@/store/gameStore";
import { SECTIONS, sectionOf, type Section } from "./sections";
import { Icon } from "./icons";

/** The tab you last used in each section. */
const last: Partial<Record<string, Panel>> = {};
useGame.subscribe((st) => {
  const cur = sectionOf(st.panel);
  if (cur && st.panel) last[cur.id] = st.panel;
});

/** Open a section on the tab you last used there (or close it if it's open). */
export function openSection(s: Section) {
  const st = useGame.getState();
  if (sectionOf(st.panel)?.id === s.id) st.openPanel(null);
  else st.showPanel(last[s.id] ?? s.tabs[0].id);
}

/** Left icon rail on desktop, bottom bar on phones: six sections, each with its own tabs. */
export function NavRail() {
  const panel = useGame((s) => s.panel);
  const game = useGame((s) => s.game)!;
  const cur = sectionOf(panel);
  return (
    <nav className="panel flex md:flex-col gap-1 p-1.5 justify-between md:justify-around overflow-x-auto md:overflow-visible scroll-thin" aria-label="Sections">
      {SECTIONS.map((s, k) => {
        const on = cur?.id === s.id;
        return (
          <button
            key={s.id}
            onClick={() => openSection(s)}
            aria-pressed={on}
            title={`${s.label(game)} (${k + 1})`}
            className="nav-item flex-none flex flex-col items-center gap-0.5 rounded-xl px-1.5 md:px-2 py-2 min-w-[44px] md:w-[62px] transition-colors"
            style={{ background: on ? "linear-gradient(135deg, var(--primary-a), var(--primary-b))" : "transparent", color: on ? "#fff" : "var(--ink-2)" }}
          >
            <Icon name={s.icon} className="w-5 h-5" />
            <span className="text-[9.5px] font-semibold leading-tight text-center">{s.label(game)}</span>
          </button>
        );
      })}
    </nav>
  );
}
