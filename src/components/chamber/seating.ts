// Who sits where in the 3D chamber. The 2D chart (Dewan.tsx hemicycle) fixes the spots and which side of the House each
// coalition is on; here the front benches are filled properly: the Prime Minister in the government front row nearest
// the centre, the cabinet beside them, and the Opposition Leader and their front bench opposite.

import type { GameState } from "../../game/state";
import { PORTFOLIOS } from "../../game/data/people";
import { leaderOfParty } from "../../game/systems/people";
import { SEATS, type CoalitionId } from "../../game/world";
import type { Geo } from "../hemicycle";

export interface Spot {
  /** The seat (and so the MP) placed here. */
  i: number;
  x: number;
  y: number;
  row: number;
  /** Angle round the half circle (π = far left, 0 = far right, as the chart draws it). */
  a: number;
}

export interface Seating {
  spots: Spot[];
  pm: number | null;
  oppLeader: number | null;
}

const angleOf = (geo: Geo, x: number, y: number) => {
  const R = (geo.w - 28) / 2;
  return Math.atan2(R + 14 - y, x - R - 14);
};

/** Places every MP: front benches first, then the rest of each side in the chart's order. */
export function seatChamber(geo: Geo, s: Pick<GameState, "holders" | "government" | "people" | "cabinet" | "coalitions" | "player" | "youId" | "opp">): Seating {
  const mpSeat = new Map<number, number>();
  for (const p of s.people) if (p.seat !== null) mpSeat.set(p.id, p.seat);
  const gov = (i: number) => s.government.includes(s.holders[i]);
  const slots = geo.dots.map((d) => ({ x: d.x, y: d.y, row: d.row, a: angleOf(geo, d.x, d.y), gov: gov(d.seatIndex), i: d.seatIndex }));

  const seatOf = (id: number | undefined) => (id === undefined ? undefined : mpSeat.get(id));
  // Government front bench: PM, the deputies, then the cabinet in order of rank.
  const govFront: number[] = [];
  for (const post of PORTFOLIOS) {
    const seat = seatOf(s.cabinet[post.id]);
    if (seat !== undefined && gov(seat) && !govFront.includes(seat)) govFront.push(seat);
  }
  // The Opposition Leader leads the largest coalition outside the government.
  const counts = new Map<CoalitionId, number>();
  for (const h of s.holders) if (!s.government.includes(h) && h !== "OTHERS") counts.set(h, (counts.get(h) ?? 0) + 1);
  const biggest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const oppFront: number[] = [];
  const push = (seat: number | undefined) => seat !== undefined && !gov(seat) && !oppFront.includes(seat) && oppFront.push(seat);
  if (biggest) {
    const leader = biggest === s.player && s.youId !== null ? s.youId : leaderOfParty(s, s.coalitions[biggest].members[0])?.id;
    push(seatOf(leader));
  }
  if (!s.government.includes(s.player)) for (const id of Object.values(s.opp?.shadow ?? {})) push(seatOf(id));
  for (const p of [...s.people].filter((x) => x.rank >= 3 && x.seat !== null).sort((a, b) => b.rank - a.rank || b.influence - a.influence)) push(p.seat!);

  const place = (side: boolean, front: number[]): Spot[] => {
    const mine = slots.filter((x) => x.gov === side);
    // Front-ness: the front row first, nearest the centre line (straight in front of the Speaker) first.
    const ranked = [...mine].sort((p, q) => p.row - q.row || Math.abs(p.a - Math.PI / 2) - Math.abs(q.a - Math.PI / 2));
    const frontSet = new Set(front);
    const rest = mine.map((x) => x.i).filter((i) => !frontSet.has(i));
    const order = [...front.filter((i) => mine.some((x) => x.i === i)), ...rest];
    // Front-benchers take the front spots; everyone else keeps the chart's left-to-right order in what is left.
    const out: Spot[] = [];
    order.slice(0, front.length).forEach((i, k) => {
      const spot = ranked[k];
      out.push({ i, x: spot.x, y: spot.y, row: spot.row, a: spot.a });
    });
    const left = mine.filter((x) => !out.some((o) => o.x === x.x && o.y === x.y));
    rest.forEach((i, k) => {
      const spot = left[k];
      out.push({ i, x: spot.x, y: spot.y, row: spot.row, a: spot.a });
    });
    return out;
  };

  const spots = [...place(true, govFront), ...place(false, oppFront)];
  return { spots, pm: govFront[0] ?? null, oppLeader: oppFront[0] ?? null };
}

/** A seat's name for a nameplate. */
export const seatName = (i: number) => SEATS[i].name;
