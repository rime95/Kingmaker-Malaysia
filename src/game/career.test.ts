import { describe, expect, it } from "vitest";
import { adoptPolicy, answerCard, applyAction, callGeneralElection } from "./actions";
import { newGame, type GameState } from "./state";
import { AP_BY_RUNG, CONTEST_POINTS, PRESIDENT, factionSize } from "./systems/career";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
function weeks(g: GameState, n: number) {
  for (let i = 0; i < n; i++) g = advanceWeek(g);
  return g;
}

describe("career", () => {
  it("leader mode starts as party president under the real leader's name", () => {
    const g = newGame("PH", 1);
    expect(g.career.rung).toBe(PRESIDENT);
    expect(g.career.name).toBe("Anwar Ibrahim");
    expect(SEATS[g.career.homeSeat].name).toBe("Tambun");
  });

  it("career mode starts at the bottom with fewer action points", () => {
    let g = newGame("PN", 1, { mode: "career", name: "Siti", homeSeat: seat("P.107") });
    expect(g.career.rung).toBe(0);
    expect(g.career.name).toBe("Siti");
    g = advanceWeek(g);
    expect(g.me.apMax).toBe(AP_BY_RUNG[0]);
  });

  it("only the party president sets policy and dissolves Parliament", () => {
    const g = newGame("PH", 1, { mode: "career" });
    expect(adoptPolicy(g, "wage", 1).ok).toBe(false);
    expect(callGeneralElection(g).ok).toBe(false);
  });

  it("campaigning in your coalition's seats builds a loyal faction", () => {
    let g = newGame("PH", 1, { mode: "career" });
    const i = seat("P.105"); // Petaling Jaya, a PH seat
    for (let k = 0; k < 7; k++) {
      const r = applyAction({ ...g, me: { ...g.me, ap: 10 } }, "walkabout", { kind: "seat", seat: i });
      expect(r.ok).toBe(true);
      if (r.ok) g = r.state;
    }
    expect(g.career.loyalty[i]).toBeGreaterThanOrEqual(40);
    expect(factionSize(g.career, g.holders, g.player)).toBe(1);
  });

  it("the June AGM lets you contest the next post once you have the points", () => {
    let g = newGame("PN", 2, { mode: "career" });
    g = { ...g, career: { ...g.career, points: CONTEST_POINTS[0] + 20 } };
    while (!g.cards.some((c) => c.kind === "agm")) g = advanceWeek(g);
    const card = g.cards.find((c) => c.kind === "agm")!;
    const r = answerCard(g, card.id, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const promoted = r.state.career.rung === 1;
    const lostPoints = r.state.career.points < g.career.points;
    expect(promoted || lostPoints).toBe(true);
  });

  it("leaders retire and a protégé takes over", () => {
    let g = newGame("PH", 3);
    g = { ...g, career: { ...g.career, age: g.career.retireAge } };
    const heir = g.career.protege;
    g = advanceWeek(g);
    expect(g.career.generation).toBe(2);
    expect(g.career.name).toBe(heir);
    expect(g.career.rung).toBe(PRESIDENT);
  });

  it("a Ketua Bahagian who wins their home seat at the GE becomes a Wakil Rakyat", () => {
    let g = newGame("PN", 4, { mode: "career", homeSeat: seat("P.024") }); // Kubang Kerian, a PAS stronghold
    g = { ...g, career: { ...g.career, rung: 1 }, parliament: { ...g.parliament, deadlineWeek: 0 } };
    g = weeks(g, 6);
    expect(g.holders[seat("P.024")]).toBe("PN");
    expect(g.career.rung).toBe(2);
  });
});

describe("objectives and achievements", () => {
  it("each term has three objectives", () => {
    const g = newGame("BN", 1);
    expect(g.objectives).toHaveLength(3);
    expect(g.objectives.some((o) => o.kind === "seats")).toBe(true);
  });

  it("completing an objective pays out", () => {
    let g = newGame("BN", 1);
    g = { ...g, objectives: [{ id: "chest", kind: "chest", text: "Build a war chest", target: 1, done: false }] };
    const before = g.me.capital;
    g = advanceWeek(g);
    expect(g.objectives[0].done).toBe(true);
    expect(g.me.capital).toBeGreaterThan(before);
  });

  it("achievements are earned and remembered", () => {
    const g = weeks(newGame("PH", 1), 1);
    expect(g.achievements["first-week"]).toBe(1);
    expect(g.achievements.president).toBeDefined();
  });
});
