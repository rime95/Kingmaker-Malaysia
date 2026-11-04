// Camp colours, shared by the org chart, the map's branches lens and the seat card.

import type { GameState } from "@/game/state";
import { patrons } from "@/game/systems/camps";
import type { Person } from "@/game/systems/people";

/** Yours in brass, the leader's (when it isn't you) violet, rivals red, blue and green. */
export const YOUR_CAMP = "#e3c27a";
export const LEADER_CAMP = "#a58be0";
export const RIVAL_COLORS = ["#e0705c", "#5b9be0", "#58b58a"];
export const UNALIGNED = "#5d6476";

/** Each patron's camp colour in a party. */
export function campColors(game: GameState, party: string): Map<number, string> {
  const out = new Map<number, string>();
  let k = 0;
  for (const p of patrons(game, party)) out.set(p.id, p.id === game.youId ? YOUR_CAMP : p.rank === 5 ? LEADER_CAMP : RIVAL_COLORS[k++ % RIVAL_COLORS.length]);
  return out;
}

/** The colour of someone's camp (grey when unaligned). */
export const campColorOf = (colors: Map<number, string>, p: Person) => (p.camp != null ? (colors.get(p.camp) ?? UNALIGNED) : UNALIGNED);
