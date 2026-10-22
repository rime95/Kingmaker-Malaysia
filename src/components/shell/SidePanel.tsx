"use client";

import { useEffect } from "react";
import { useGame } from "@/store/gameStore";
import { Dewan } from "../Dewan";
import { Policy } from "../Policy";
import { Rivals } from "../Rivals";
import { SeatBars } from "../SeatBars";
import { States } from "../States";
import { MoneyPanel } from "../panels/MoneyPanel";
import { CampaignPanel } from "../panels/CampaignPanel";
import { BattlePanel } from "../panels/BattlePanel";
import { PartyPanel } from "../panels/PartyPanel";
import { PeoplePanel } from "../panels/PeoplePanel";
import { TeamPanel } from "../panels/TeamPanel";
import { NationPanel } from "../panels/NationPanel";
import { NominationsPanel } from "../panels/NominationsPanel";
import { SeatCard } from "./SeatCard";
import { OrderPaper } from "../OrderPaper";
import { CabinetPanel } from "../panels/CabinetPanel";
import { AnalysisBody } from "../ElectionAnalysis";
import { sectionOf } from "./sections";
import { Icon } from "./icons";

/** One section at a time, sliding in over the map, with its tabs along the top. Esc closes it. */
export function SidePanel() {
  const { panel, openPanel, showPanel } = useGame();
  const game = useGame((s) => s.game)!;
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, openPanel]);
  const section = sectionOf(panel);
  if (!panel || !section) return null;
  const wide = panel === "parliament" || panel === "treasury" || panel === "states" || panel === "people" || panel === "analysis";
  return (
    <aside className={`panel side-panel slide-in flex flex-col h-full w-full ${wide ? "md:w-[640px]" : "md:w-[500px]"}`} aria-label={section.label(game)}>
      <div className="px-5 pt-4" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold leading-tight">{section.label(game)}</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {section.sub}
            </p>
          </div>
          <button className="chip !p-2" onClick={() => openPanel(null)} aria-label="Close panel">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
        {section.tabs.length > 1 ? (
          <div className="flex gap-1 mt-3 -mb-px overflow-x-auto scroll-thin" role="tablist">
            {section.tabs.map((t) => {
              const on = t.id === panel;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => showPanel(t.id)}
                  className="tab flex-none px-3 py-2 text-xs font-semibold whitespace-nowrap"
                  style={{ color: on ? "var(--ink)" : "var(--muted)", borderBottom: `2px solid ${on ? "var(--primary-a)" : "transparent"}` }}
                >
                  {t.label(game)}
                  {(t.id === "nominations" && game.nominations?.open) || (t.id === "orderpaper" && game.dewan.motions.some((m) => !m.result && !m.withdrawn && m.voteWeek <= game.week + 1)) ? (
                    <span style={{ color: "var(--accent)" }}> ●</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="h-3" />
        )}
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 @container">
        {panel === "campaign" && <CampaignPanel />}
        {panel === "battle" && <BattlePanel />}
        {panel === "party" && <PartyPanel />}
        {panel === "people" && <PeoplePanel />}
        {panel === "team" && <TeamPanel />}
        {panel === "nation" && <NationPanel />}
        {panel === "nominations" && <NominationsPanel />}
        {panel === "policy" && <Policy />}
        {panel === "states" && <States />}
        {panel === "rivals" && <Rivals />}
        {panel === "treasury" && <MoneyPanel />}
        {panel === "seat" && <SeatCard embedded />}
        {panel === "orderpaper" && <OrderPaper />}
        {panel === "cabinet" && <CabinetPanel />}
        {panel === "analysis" &&
          (game.lastAnalysis ? (
            <AnalysisBody a={game.lastAnalysis} />
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              No general election yet. After the next one, the full analysis lives here.
            </p>
          ))}
        {panel === "parliament" && (
          <div className="flex flex-col gap-4">
            <SeatBars />
            <Dewan />
          </div>
        )}
      </div>
    </aside>
  );
}
