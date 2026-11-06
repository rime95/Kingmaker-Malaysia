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
import { CasePanel } from "../panels/CasePanel";
import { PartyPanel } from "../panels/PartyPanel";
import { PeoplePanel } from "../panels/PeoplePanel";
import { Leadership } from "../panels/Leadership";
import { TeamPanel } from "../panels/TeamPanel";
import { NationPanel } from "../panels/NationPanel";
import { WawasanPanel } from "../panels/WawasanPanel";
import { NewsPanel } from "../panels/NewsPanel";
import { StatecraftPanel } from "../panels/StatecraftPanel";
import { NominationsPanel } from "../panels/NominationsPanel";
import { SeatCard } from "./SeatCard";
import { OrderPaper } from "../OrderPaper";
import { CabinetPanel } from "../panels/CabinetPanel";
import { AnalysisBody } from "../ElectionAnalysis";
import { sectionOf, tabOf } from "./sections";
import { Icon } from "./icons";

/** One hub at a time: a dossier sliding in over the map, with folder tabs along the top. Esc closes it. */
export function SidePanel() {
  const { panel, openPanel, showPanel, setAnalysisOpen } = useGame();
  const game = useGame((s) => s.game)!;
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, openPanel]);
  const section = sectionOf(panel);
  const tab = tabOf(panel);
  if (!panel || !section) return null;
  const wide = tab === "parliament" || tab === "treasury" || tab === "states" || tab === "people" || tab === "leadership" || tab === "nation" || tab === "wawasan" || tab === "statecraft" || tab === "nominations";
  return (
    <aside className={`panel side-panel slide-in flex flex-col h-full w-full ${wide ? "md:w-[720px]" : "md:w-[600px]"}`} aria-label={section.label(game)}>
      <div className="px-5 pt-4" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="eyebrow">Bilik Gerakan</div>
            <h2 className="dossier-title text-2xl leading-tight">{section.label(game)}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
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
              const on = t.id === tab;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => showPanel(t.id)}
                  className="tab flex-none px-3.5 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg"
                  style={{
                    color: on ? "var(--brass-hi)" : "var(--muted)",
                    background: on ? "rgb(201 162 74 / 0.1)" : "transparent",
                    borderBottom: `2px solid ${on ? "var(--brass)" : "transparent"}`,
                  }}
                >
                  {t.label(game)}
                  {(t.id === "nominations" && game.nominations?.open) || (t.id === "parliament" && game.dewan.motions.some((m) => !m.result && !m.withdrawn && m.voteWeek <= game.week + 1)) ? (
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
        {tab === "campaign" && (
          <div className="flex flex-col gap-6">
            <CampaignPanel />
            <section className="flex flex-col gap-2" id="your-case">
              <div className="brass-rule" />
              <h3 className="dossier-title text-lg">Your case to the voters</h3>
              <CasePanel />
            </section>
          </div>
        )}
        {panel === "battle" && <BattlePanel />}
        {panel === "party" && <PartyPanel />}
        {panel === "people" && <PeoplePanel />}
        {panel === "leadership" && <Leadership />}
        {panel === "team" && <TeamPanel />}
        {panel === "nation" && (
          <div className="flex flex-col gap-3">
            {game.lastAnalysis && (
              <button className="inset px-3 py-2 text-left text-xs flex items-center gap-2" onClick={() => setAnalysisOpen(true)}>
                <span className="eyebrow">Last election</span>
                <span style={{ color: "var(--ink-2)" }}>What happened at {game.lastAnalysis.label ?? "the last election"}, and why →</span>
              </button>
            )}
            <NationPanel />
          </div>
        )}
        {panel === "wawasan" && <WawasanPanel />}
        {panel === "news" && <NewsPanel />}
        {panel === "statecraft" && <StatecraftPanel />}
        {panel === "nominations" && <NominationsPanel />}
        {panel === "policy" && <Policy />}
        {panel === "states" && <States />}
        {panel === "rivals" && <Rivals />}
        {panel === "treasury" && <MoneyPanel />}
        {panel === "seat" && <SeatCard embedded />}

        {panel === "cabinet" && <CabinetPanel />}
        {panel === "analysis" &&
          (game.lastAnalysis ? (
            <AnalysisBody a={game.lastAnalysis} />
          ) : (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              No general election yet. After the next one, the full analysis lives here.
            </p>
          ))}
        {tab === "parliament" && (
          <div className="flex flex-col gap-4">
            <SeatBars />
            <Dewan />
            <section className="flex flex-col gap-2" id="order-paper">
              <div className="brass-rule" />
              <h3 className="dossier-title text-lg">Order paper</h3>
              <OrderPaper />
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
