// The left menu: six sections, each a set of tabs (the panels). Seat moves live on the map; everything else in here.

import type { Panel } from "@/store/gameStore";
import type { GameState } from "@/game/state";
import { isGovernment } from "@/game/state";
import type { ICONS } from "./icons";

export type SectionId = "campaign" | "party" | "government" | "parliament" | "money" | "seat";

export interface Section {
  id: SectionId;
  label: (g: GameState) => string;
  icon: keyof typeof ICONS;
  sub: string;
  tabs: { id: Panel; label: (g: GameState) => string }[];
}

export const SECTIONS: Section[] = [
  {
    id: "campaign",
    label: () => "Campaign",
    icon: "campaign",
    sub: "Your plan, the battlegrounds, seat pacts and candidates",
    tabs: [
      { id: "campaign", label: () => "Plan" },
      { id: "battle", label: () => "Battlegrounds & pacts" },
      { id: "nominations", label: () => "Nominations" },
      { id: "rivals", label: () => "Rivals" },
    ],
  },
  {
    id: "party",
    label: () => "Party",
    icon: "party",
    sub: "Your party's health, its people and your own staff",
    tabs: [
      { id: "party", label: () => "Overview" },
      { id: "people", label: () => "People" },
      { id: "team", label: () => "Your team" },
    ],
  },
  {
    id: "government",
    label: (g) => (isGovernment(g) ? "Government" : "Opposition"),
    icon: "nation",
    sub: "The country's numbers, the levers, policy and the Budget",
    tabs: [
      { id: "nation", label: () => "Dashboard" },
      { id: "policy", label: () => "Policy & Budget" },
      { id: "cabinet", label: (g) => (isGovernment(g) ? "Cabinet" : "Shadow cabinet") },
    ],
  },
  {
    id: "parliament",
    label: () => "Parliament",
    icon: "parliament",
    sub: "The Dewan Rakyat and the state assemblies",
    tabs: [
      { id: "parliament", label: () => "Dewan Rakyat" },
      { id: "orderpaper", label: () => "Order paper" },
      { id: "analysis", label: () => "Last election" },
      { id: "states", label: () => "States" },
    ],
  },
  {
    id: "money",
    label: () => "Money",
    icon: "treasury",
    sub: "The war chest, Bursa, property and your own fortune",
    tabs: [{ id: "treasury", label: () => "Money" }],
  },
  {
    id: "seat",
    label: () => "Seat",
    icon: "seat",
    sub: "Everything about the seat you clicked",
    tabs: [{ id: "seat", label: () => "Seat" }],
  },
];

export const sectionOf = (p: Panel | null) => (p ? SECTIONS.find((s) => s.tabs.some((t) => t.id === p)) : undefined);
