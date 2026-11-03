import { describe, expect, it } from "vitest";
import { newGame } from "./state";
import { hemicycle } from "../components/hemicycle";
import { seatChamber } from "../components/chamber/seating";
import { SEATS, type CoalitionId } from "./world";

const CHART_ORDER: CoalitionId[] = ["PH", "BN", "GPS", "GRS", "OTHERS", "WARISAN", "MUDA", "BERSAMA", "PN"];

function chamber(player: Parameters<typeof newGame>[0]) {
  const g = newGame(player, 4);
  // As the Dewan draws it: the government on the left, the PM's coalition first.
  const govOrder = [g.parliament.pm, ...CHART_ORDER.filter((c) => c !== g.parliament.pm && g.government.includes(c))];
  const oppOrder = CHART_ORDER.filter((c) => !g.government.includes(c)).reverse();
  const order = [...govOrder, ...[...oppOrder].reverse()];
  const seats = SEATS.map((s) => s.index)
    .filter((i) => order.includes(g.holders[i]))
    .sort((a, b) => order.indexOf(g.holders[a]) - order.indexOf(g.holders[b]) || a - b);
  return { g, geo: hemicycle(seats) };
}

describe("front benches", () => {
  it("the Prime Minister and cabinet sit in the government front row; the Opposition Leader in the opposition front row", () => {
    const { g, geo } = chamber("PH");
    const c = seatChamber(geo, g);
    expect(c.spots).toHaveLength(geo.dots.length);
    expect(new Set(c.spots.map((s) => s.i)).size).toBe(geo.dots.length);
    const pmSeat = g.people.find((p) => p.id === g.cabinet.pm)!.seat!;
    expect(c.pm).toBe(pmSeat);
    const at = (i: number) => c.spots.find((s) => s.i === i)!;
    expect(at(pmSeat).row).toBe(0);
    const govFront = c.spots.filter((s) => g.government.includes(g.holders[s.i]) && s.row === 0);
    // The PM is the government front-row seat nearest the centre line.
    const nearest = [...govFront].sort((a, b) => Math.abs(a.a - Math.PI / 2) - Math.abs(b.a - Math.PI / 2))[0];
    expect(nearest.i).toBe(pmSeat);
    // Every seated minister who fits is on the front row.
    const ministers = Object.values(g.cabinet)
      .map((id) => g.people.find((p) => p.id === id)?.seat)
      .filter((x): x is number => x !== null && x !== undefined);
    const frontMinisters = ministers.filter((i) => at(i).row === 0).length;
    expect(frontMinisters).toBeGreaterThanOrEqual(Math.min(ministers.length, govFront.length) - 1);
    expect(c.oppLeader).not.toBeNull();
    expect(at(c.oppLeader!).row).toBe(0);
    expect(g.government.includes(g.holders[c.oppLeader!])).toBe(false);
  });
});
