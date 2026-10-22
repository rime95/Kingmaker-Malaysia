"use client";

import { useEffect } from "react";
import { useGame, type Panel } from "@/store/gameStore";
import { Dewan } from "../Dewan";
import { Policy } from "../Policy";
import { Rivals } from "../Rivals";
import { SeatBars } from "../SeatBars";
import { States } from "../States";
import { MoneyPanel } from "../panels/MoneyPanel";
import { CampaignPanel } from "../panels/CampaignPanel";
import { PartyPanel } from "../panels/PartyPanel";
import { PeoplePanel } from "../panels/PeoplePanel";
import { TeamPanel } from "../panels/TeamPanel";
import { NationPanel } from "../panels/NationPanel";
import { NominationsPanel } from "../panels/NominationsPanel";
import { Icon } from "./icons";

const TITLES: Record<Panel, { title: string; sub: string }> = {
  campaign: { title: "Campaign", sub: "Nationwide, party and money moves" },
  party: { title: "Party & career", sub: "Your party's health and your climb" },
  people: { title: "People", sub: "The cabinet and every party's leadership" },
  team: { title: "Your team", sub: "Your own staff, and who is looking for work" },
  nation: { title: "The nation", sub: "The economy, the government's record and its levers" },
  nominations: { title: "Nominations", sub: "Who stands for your party, and where" },
  policy: { title: "Policy & Budget", sub: "Positions, the economy and the Budget" },
  states: { title: "States", sub: "Assemblies, state elections and dissolution" },
  parliament: { title: "Dewan Rakyat", sub: "Who sits where, and the numbers" },
  rivals: { title: "Rivals", sub: "What the other parties are doing" },
  treasury: { title: "Money", sub: "The war chest, Bursa, property and your own fortune" },
};

/** One panel at a time, sliding in over the map. Esc closes it. */
export function SidePanel() {
  const { panel, openPanel } = useGame();
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && openPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, openPanel]);
  if (!panel) return null;
  const t = TITLES[panel];
  const wide = panel === "parliament" || panel === "treasury" || panel === "states";
  return (
    <aside className={`panel side-panel slide-in flex flex-col h-full w-full ${wide ? "md:w-[620px]" : "md:w-[480px]"}`} aria-label={t.title}>
      <div className="flex items-start gap-3 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex-1">
          <h2 className="text-lg font-bold leading-tight">{t.title}</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {t.sub}
          </p>
        </div>
        <button className="chip !p-2" onClick={() => openPanel(null)} aria-label="Close panel">
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4 @container">
        {panel === "campaign" && <CampaignPanel />}
        {panel === "party" && <PartyPanel />}
        {panel === "people" && <PeoplePanel />}
        {panel === "team" && <TeamPanel />}
        {panel === "nation" && <NationPanel />}
        {panel === "nominations" && <NominationsPanel />}
        {panel === "policy" && <Policy />}
        {panel === "states" && <States />}
        {panel === "rivals" && <Rivals />}
        {panel === "treasury" && <MoneyPanel />}
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
