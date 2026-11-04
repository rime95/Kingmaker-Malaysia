// What the map colours by. Each lens gives a fill for every parliamentary seat and a short legend.

import { serviceBase } from "@/game/bases";
import { FORTRESS } from "@/game/config";
import type { GameState } from "@/game/state";
import { isHostile, type Rival } from "@/game/systems/rivals";
import { leaderOf, winChance, type SeatRead } from "@/game/systems/polls";
import { partyColor } from "@/game/systems/coalitions";
import type { Rating } from "@/game/voter";
import { BLOC_LABEL, contestingIn, cshort, majorityBloc, SEATS, type CoalitionId } from "@/game/world";
import type { Lens } from "@/store/gameStore";
import { divisionChief } from "@/game/systems/camps";
import { campColorOf, campColors, LEADER_CAMP, RIVAL_COLORS, UNALIGNED, YOUR_CAMP } from "../campColors";

const PARTNER_BRANCH = "#4a6a8a";
const yourParty = (game: GameState) => game.coalitions[game.player].members[0];

export const LENSES: { id: Lens; label: string; short: string }[] = [
  { id: "holder", label: "Who holds each seat", short: "Holder" },
  { id: "parties", label: "Which party holds each seat", short: "Parties" },
  { id: "divisions", label: "Your branches: your divisions by camp, a partner's, or none", short: "Branches" },
  { id: "projection", label: "Latest polls and branch reports", short: "Polls" },
  { id: "support", label: "Your polled vote share", short: "Support" },
  { id: "presence", label: "Your strongholds (service)", short: "Strongholds" },
  { id: "pressure", label: "Hostile rivals at work", short: "Rivals" },
  { id: "ethnic", label: "Ethnic majority (estimate)", short: "Ethnic" },
  { id: "urban", label: "Urban to rural", short: "Urban" },
  { id: "result", label: "Last war-room simulation", short: "War room" },
  { id: "swing", label: "Your swing at the last general election", short: "Swing" },
];

export const RATING_OPACITY: Record<Rating, number> = { safe: 1, likely: 0.78, lean: 0.55, tossup: 0.32 };
export const RATING_LABEL: Record<Rating, string> = { safe: "Safe", likely: "Likely", lean: "Leaning", tossup: "Toss-up" };

export const coalColor = (c: CoalitionId) => `var(--c-${c})`;
/** Sequential ramp: from the empty-land colour to `color`. */
export const ramp = (color: string, t: number) => `color-mix(in oklch, ${color} ${Math.round(Math.min(1, Math.max(0, t)) * 100)}%, var(--land))`;

export interface SeatFill {
  fill: string;
  opacity?: number;
  /** Dashed outline: the seat would change hands. */
  flipped?: boolean;
  /** Your result here on election night: held, gained from another party (rampas), or lost. */
  mark?: "hold" | "gain" | "lost";
}

/** How hard hostile rivals are working a seat: their buzz plus service built above their starting level. */
export function rivalPressure(game: GameState, i: number): number {
  let max = 0;
  for (const [c, r] of Object.entries(game.rivals) as [CoalitionId, Rival][]) {
    if (!isHostile(c, game.player, game.me.trust, game.government)) continue;
    max = Math.max(max, r.buzz[i] + Math.max(0, r.service[i] - serviceBase(c, i)));
  }
  return max;
}

/** How sure a read is that its leader wins, as a rating. */
export function readRating(r: SeatRead, week: number): { leader: CoalitionId; rating: Rating; chance: number } {
  const [leader] = leaderOf(r.shares);
  const chance = winChance(r, leader, week) ?? 0.5;
  return { leader, chance, rating: chance >= 0.9 ? "safe" : chance >= 0.7 ? "likely" : chance >= 0.56 ? "lean" : "tossup" };
}

export function lensFill(game: GameState, reads: SeatRead[], lens: Lens, i: number): SeatFill {
  const seat = SEATS[i];
  switch (lens) {
    case "holder":
      return { fill: coalColor(game.holders[i]) };
    case "parties":
      return { fill: partyColor(game, game.holderParties[i]) };
    case "divisions": {
      // Your party's division: its chief's camp (solid where the MP leads it, lighter for an organiser; dashed if hostile).
      const chief = divisionChief(game, i);
      if (chief) return { fill: campColorOf(campColors(game, yourParty(game)), chief), opacity: chief.seat === i ? 1 : 0.6, flipped: chief.loyalty < 35 };
      // A partner's branch, or none.
      return contestingIn(seat, game.entries).includes(game.player) ? { fill: PARTNER_BRANCH, opacity: 0.55 } : { fill: "var(--land)" };
    }
    case "projection": {
      const r = readRating(reads[i], game.week);
      return { fill: coalColor(r.leader), opacity: RATING_OPACITY[r.rating] * (reads[i].source === "estimate" ? 0.7 : 1), flipped: r.leader !== game.holders[i] };
    }
    case "support":
      return { fill: ramp(coalColor(game.player), (reads[i].shares[game.player] ?? 0) / 0.7) };
    case "presence":
      return contestingIn(seat, game.entries).includes(game.player) ? { fill: ramp(coalColor(game.player), game.me.service[i] / 90) } : { fill: "var(--land)" };
    case "pressure":
      return { fill: ramp("var(--bad)", rivalPressure(game, i) / 40) };
    case "ethnic":
      return { fill: `var(--e-${majorityBloc(seat)})` };
    case "urban":
      return { fill: ramp("var(--ink-2)", seat.demo.urbanity) };
    case "swing": {
      const v = game.lastAnalysis?.swing[i];
      if (v === null || v === undefined) return { fill: "var(--land)" };
      return { fill: ramp(v >= 0 ? "var(--good)" : "var(--bad)", Math.abs(v) / 0.12) };
    }
    case "result": {
      const r = game.lastElection?.seats[i];
      return r ? { fill: coalColor(r.winner), flipped: r.winner !== game.holders[i] } : { fill: "var(--land)" };
    }
  }
}

export interface LegendItem {
  color: string;
  label: string;
  opacity?: number;
}

export function lensLegend(game: GameState, lens: Lens): { items: LegendItem[]; note?: string } {
  const player = game.player;
  switch (lens) {
    case "holder":
      return { items: [...new Set(game.holders)].map((c) => ({ color: coalColor(c), label: cshort(c) })) };
    case "parties": {
      const parties = [...new Set(game.holderParties)].sort((a, b) => game.holderParties.filter((p) => p === b).length - game.holderParties.filter((p) => p === a).length);
      return { items: parties.map((p) => ({ color: partyColor(game, p), label: `${p} ${game.holderParties.filter((x) => x === p).length}` })), note: "Partners wear lighter or darker shades of their coalition's colour." };
    }
    case "divisions": {
      const chiefs = Object.values(game.divisions ?? {}).map((id) => game.people.find((p) => p.id === id)!).filter(Boolean);
      const mine = chiefs.filter((p) => p.camp === game.youId).length;
      const hostile = chiefs.filter((p) => p.loyalty < 35).length;
      const youLead = chiefs.some((p) => p.camp === game.youId) || game.career.rung >= 6;
      return {
        items: [
          { color: youLead ? YOUR_CAMP : LEADER_CAMP, label: youLead ? "Your camp" : "Leader's camp" },
          { color: RIVAL_COLORS[0], label: "Rival camp" },
          { color: UNALIGNED, label: "Unaligned" },
          { color: PARTNER_BRANCH, label: "Partner's branch", opacity: 0.55 },
          { color: "var(--land)", label: "No branch" },
        ],
        note: `${chiefs.length} divisions of ${yourParty(game)} · ${mine} in your camp · ${hostile} hostile (dashed). Lighter: a local organiser, not an MP.`,
      };
    }
    case "projection":
      return { items: (Object.keys(RATING_OPACITY) as Rating[]).map((r) => ({ color: "var(--ink-2)", label: RATING_LABEL[r], opacity: RATING_OPACITY[r] })), note: "Who leads in your polls. Faded = rough estimate only. Dashed = would change hands." };
    case "support":
      return { items: [0.1, 0.3, 0.5, 0.7].map((v) => ({ color: ramp(coalColor(player), v / 0.7), label: `${Math.round(v * 100)}%` })) };
    case "presence":
      return { items: [...FORTRESS].reverse().map((f) => ({ color: ramp(coalColor(player), (f.min + 10) / 90), label: f.name })) };
    case "pressure":
      return { items: [5, 15, 25, 40].map((v) => ({ color: ramp("var(--bad)", v / 40), label: v === 40 ? "40+" : String(v) })), note: "Hostile rivals' buzz and new service" };
    case "ethnic":
      return { items: (["malay", "chinese", "indian", "sabah", "sarawak", "mixed"] as const).map((b) => ({ color: `var(--e-${b})`, label: b === "mixed" ? "No majority" : BLOC_LABEL[b] })) };
    case "urban":
      return { items: [0.15, 0.5, 0.95].map((v) => ({ color: ramp("var(--ink-2)", v), label: v < 0.3 ? "Rural" : v > 0.9 ? "City" : "Town" })) };
    case "swing":
      return {
        items: [-0.12, -0.04, 0.04, 0.12].map((v) => ({ color: ramp(v >= 0 ? "var(--good)" : "var(--bad)", Math.abs(v) / 0.12), label: `${v > 0 ? "+" : "−"}${Math.abs(v * 100)}` })),
        note: game.lastAnalysis ? `Change in your vote share, ${game.lastAnalysis.label} vs the election before (points).` : "No general election yet.",
      };
    case "result":
      return { items: [], note: game.lastElection ? "Colour = simulated winner. Dashed = would change hands." : "Run a war-room simulation from the menu first." };
  }
}
