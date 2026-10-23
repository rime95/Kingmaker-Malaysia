import { describe, expect, it } from "vitest";
import { backForPm, callGeneralElection, dewanVote, goToAgong, makeOffer, nextTalksRound } from "./actions";
import { isGovernment, newGame, type GameState } from "./state";
import { OFFERS, agongDecides, blocSeats, pickCandidates, sdCount, startFormation, willingness } from "./systems/formation";
import { isHostile } from "./systems/rivals";
import { advanceWeek } from "./week";
import { COALITIONS, type CoalitionId } from "./world";

const seatsOf = (o: Partial<Record<CoalitionId, number>>) => Object.fromEntries(COALITIONS.map((c) => [c, o[c] ?? 0])) as Record<CoalitionId, number>;

function afterGE(player: CoalitionId, seed: number): GameState {
  let g = newGame(player, seed);
  g = { ...g, parliament: { ...g.parliament, pm: player === "PH" ? "PH" : g.parliament.pm } };
  const r = player === "PH" ? callGeneralElection(g) : null;
  if (r?.ok) g = r.state;
  else g = { ...g, parliament: { ...g.parliament, deadlineWeek: 0 } };
  for (let w = 0; w < 7 && !g.formation; w++) g = advanceWeek(g);
  return g;
}

describe("forming a government", () => {
  it("picks the biggest coalition and its biggest non-partner as candidates", () => {
    expect(pickCandidates(seatsOf({ PH: 80, BN: 30, PN: 75, GPS: 23 }))).toEqual(["PH", "PN"]);
    expect(pickCandidates(seatsOf({ PN: 95, PH: 60, BN: 30, GPS: 25 }))).toEqual(["PN", "PH"]);
  });

  it("starts after a general election, with Election Night queued", () => {
    const g = afterGE("PH", 3);
    expect(g.formation).not.toBeNull();
    expect(g.night).not.toBeNull();
    expect(g.formation!.candidates).toContain("PH");
    expect(g.formation!.role).toBe("leader");
  });

  it("an offer makes a coalition more willing", () => {
    const g = afterGE("PH", 3);
    const f = g.formation!;
    const target = (["GPS", "GRS", "WARISAN", "BN"] as CoalitionId[]).find((c) => !f.committed[c] && f.seats[c] > 0);
    if (!target) return;
    const before = willingness(f, target, "PH", "PH");
    const r = makeOffer(g, target, "ministries");
    expect(r.ok).toBe(true);
    if (r.ok) expect(willingness(r.state.formation!, target, "PH", "PH")).toBeGreaterThan(before);
  });

  it("only one DPM post can be offered", () => {
    const g = afterGE("PH", 5);
    const open = COALITIONS.filter((c) => !g.formation!.committed[c] && c !== "PH" && g.formation!.seats[c] > 0);
    if (open.length < 2) return;
    const r1 = makeOffer(g, open[0], "dpm");
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(makeOffer(r1.state, open[1], "dpm").ok).toBe(false);
  });

  it("talks run three rounds, then the Agong appoints a government", () => {
    let g = afterGE("PH", 7);
    for (let i = 0; i < OFFERS.rounds; i++) {
      const r = nextTalksRound(g);
      expect(r.ok).toBe(true);
      if (r.ok) g = r.state;
    }
    expect(nextTalksRound(g).ok).toBe(false);
    const r = goToAgong(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.formation).toBeNull();
    expect(r.state.government).toContain(r.state.parliament.pm);
    expect(r.state.tiers).toHaveLength(1);
  });

  it("the government really changes: votes, hostility and your side follow it", () => {
    const g = newGame("PN", 1);
    const f = startFormation(g, seatsOf({ PN: 100, PH: 60, BN: 30, GPS: 27, GRS: 5 }), 73);
    const withF: GameState = { ...g, formation: { ...f, committed: { ...f.committed, GPS: "PN", BN: "PN" } } };
    const r = goToAgong(withF);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.parliament.pm).toBe("PN");
    expect(isGovernment(r.state)).toBe(true);
    expect(isHostile("PH", "PN", 60, r.state.government)).toBe(true);
    expect(isHostile("BN", "PN", 60, r.state.government)).toBe(false);
    expect(r.state.tiers.at(-1)!.tier).toBe("diamond"); // 100 + 30 + 27 = 157 ≥ 148
    expect(dewanVote(r.state).yes).toBeGreaterThan(0);
  });

  it("a kingmaker who provides the majority gets the DPM", () => {
    const g = newGame("GPS", 1);
    // A small party is a kingmaker, not a candidate.
    const f = startFormation(g, seatsOf({ PH: 104, PN: 80, BN: 6, GPS: 9, GRS: 7 }), 23);
    const base: GameState = { ...g, formation: { ...f, committed: { PH: "PH", PN: "PN", BN: "PH", GRS: "PN" } } };
    expect(sdCount(base.formation!, "PH")).toBe(110);
    const backed = backForPm(base, "PH", true);
    expect(backed.ok).toBe(true);
    if (!backed.ok) return;
    const o = agongDecides(backed.state.formation!, "GPS");
    expect(o.pm).toBe("PH");
    expect(o.dpmGranted).toBe(true);
  });

  it("a 16-seat party is a kingmaker: the two biggest blocs compete", () => {
    const g = newGame("MUDA", 1);
    const seats = seatsOf({ PH: 70, PN: 85, BN: 25, GPS: 22, GRS: 4, MUDA: 16 });
    const f = startFormation(g, seats, 1);
    expect(f.role).toBe("kingmaker");
    expect(f.candidates).not.toContain("MUDA");
    expect(f.candidates).toEqual(expect.arrayContaining(["PH", "PN"]));
  });

  it("blocs, not single coalitions, decide the candidates", () => {
    // BN is a natural partner of PH (same side): the PH bloc (70 + 45) beats PN alone (80).
    const seats = seatsOf({ PN: 80, PH: 70, BN: 45, GPS: 20 });
    expect(blocSeats("PH", seats)).toBe(115);
    expect(pickCandidates(seats)[0]).toBe("PH");
    // A pact partner joins your bloc, and signs for you at once.
    const g = newGame("WARISAN", 2);
    const f = startFormation(g, seatsOf({ PN: 80, PH: 50, BN: 20, WARISAN: 45, MUDA: 30 }), 3, ["MUDA"]);
    expect(f.role).toBe("leader");
    expect(f.committed.MUDA).toBe("WARISAN");
    expect(f.log.some((l) => l.includes("your election pact"))).toBe(true);
  });

  it("a shared enemy is common ground", () => {
    const g = newGame("BN", 3);
    const f = startFormation(g, seatsOf({ PH: 90, PN: 80, BN: 30, MUDA: 5 }), 30);
    // MUDA loathes PN: it leans to PH for that reason alone.
    expect(willingness(f, "MUDA", "PH", "BN") - willingness(f, "MUDA", "PN", "BN")).toBeGreaterThan(1);
  });

  it("time moving on resolves unfinished talks", () => {
    const g = afterGE("BN", 9);
    expect(g.formation).not.toBeNull();
    const n = advanceWeek(g);
    expect(n.formation).toBeNull();
    expect(n.tiers.length).toBe(1);
  });
});
