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

/** What needs you in each hub (a small brass badge on the rail). */
function badge(g: ReturnType<typeof useGame.getState>["game"], id: string): number {
  if (!g) return 0;
  if (id === "campaign") return (g.nominations?.open && g.career.rung >= 6 ? 1 : 0) + (g.stateTalks ? 1 : 0);
  if (id === "government") return (g.budgetDue !== null ? 1 : 0) + (g.dewan.motions.some((m) => !m.result && !m.withdrawn && m.voteWeek <= g.week + 1) ? 1 : 0);
  if (id === "party") return g.race && !g.race.result ? 1 : 0;
  return 0;
}

/** The command rail: a songket-edged column on desktop, a bottom bar on phones. Four hubs, keys 1–4. */
export function NavRail() {
  const panel = useGame((s) => s.panel);
  const game = useGame((s) => s.game)!;
  const cur = sectionOf(panel);
  return (
    <nav className="rail panel songket-edge flex md:flex-col gap-1 p-1.5 justify-around md:justify-start" aria-label="Hubs">
      {SECTIONS.map((s, k) => {
        const on = cur?.id === s.id;
        const n = badge(game, s.id);
        return (
          <button
            key={s.id}
            onClick={() => openSection(s)}
            aria-pressed={on}
            title={`${s.label(game)} (${k + 1})`}
            className="nav-item relative flex-1 md:flex-none flex flex-col items-center gap-1 rounded-lg px-1.5 md:px-2 py-2.5 min-w-[56px] md:w-[72px] transition-colors"
            style={{ background: on ? "linear-gradient(180deg, var(--primary-a), var(--primary-b))" : "transparent", color: on ? "var(--gold-ink)" : "var(--ink-2)" }}
          >
            <Icon name={s.icon} className="w-5 h-5" />
            <span className="text-[11px] font-semibold leading-tight text-center">{s.label(game)}</span>
            {n > 0 && <span className="rail-badge">{n}</span>}
          </button>
        );
      })}
    </nav>
  );
}
