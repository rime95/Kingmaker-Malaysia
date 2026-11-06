// The command rail: four hubs, grouped by what you are trying to do. Seat moves live on the map; planning lives here.
// Older panel ids still open the right page (aliases), so links from cards and the advisor keep working.

import type { Panel } from "@/store/gameStore";
import type { GameState } from "@/game/state";
import { isGovernment } from "@/game/state";
import type { ICONS } from "./icons";

export type SectionId = "campaign" | "party" | "government" | "money" | "seat";

export interface Section {
  id: SectionId;
  label: (g: GameState) => string;
  icon: keyof typeof ICONS;
  sub: string;
  tabs: { id: Panel; label: (g: GameState) => string }[];
  /** Panels shown inside one of the tabs (the tab they belong to). */
  aliases?: Partial<Record<Panel, Panel>>;
}

export const SECTIONS: Section[] = [
  {
    id: "campaign",
    label: () => "Campaign",
    icon: "campaign",
    sub: "Win seats: your plan and message, the battlegrounds and pacts, your candidates, your rivals",
    tabs: [
      { id: "campaign", label: () => "Plan & message" },
      { id: "battle", label: () => "Seats & pacts" },
      { id: "nominations", label: () => "Nominations" },
      { id: "rivals", label: () => "Rivals" },
      { id: "news", label: () => "News" },
    ],
    aliases: { case: "campaign" },
  },
  {
    id: "party",
    label: () => "Party",
    icon: "party",
    sub: "Hold the party together: its health and wings, your lieutenants and generals, its people, your own staff",
    tabs: [
      { id: "party", label: () => "Overview" },
      { id: "leadership", label: () => "Leadership" },
      { id: "people", label: () => "People" },
      { id: "team", label: () => "Your team" },
    ],
  },
  {
    id: "government",
    label: (g) => (isGovernment(g) ? "Govern" : "Opposition"),
    icon: "nation",
    sub: "Run the country, or hold it to account: the numbers, policy and the Budget, the cabinet, the Dewan and the states",
    tabs: [
      { id: "nation", label: () => "Dashboard" },
      { id: "wawasan", label: () => "Wawasan" },
      { id: "policy", label: () => "Policy & Budget" },
      { id: "cabinet", label: (g) => (isGovernment(g) ? "Cabinet" : "Shadow cabinet") },
      { id: "parliament", label: () => "Dewan" },
      { id: "states", label: () => "States" },
    ],
    aliases: { orderpaper: "parliament", analysis: "nation" },
  },
  {
    id: "money",
    label: () => "Money",
    icon: "treasury",
    sub: "The war chest, Bursa, property and your own fortune",
    tabs: [{ id: "treasury", label: () => "Money" }],
  },
];

/** The full seat card (opened from the seat card on the map); not on the rail. */
const SEAT_SECTION: Section = { id: "seat", label: () => "Seat", icon: "seat", sub: "Everything about the seat you clicked", tabs: [{ id: "seat", label: () => "Seat" }] };

export const sectionOf = (p: Panel | null) => (p ? [...SECTIONS, SEAT_SECTION].find((s) => s.tabs.some((t) => t.id === p) || s.aliases?.[p]) : undefined);
/** The tab a panel lives under. */
export const tabOf = (p: Panel | null): Panel | null => (p ? (sectionOf(p)?.aliases?.[p] ?? p) : null);
