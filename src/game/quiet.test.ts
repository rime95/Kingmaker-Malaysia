import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { advanceTurn, mergeReports, needsYou } from "./month";

/** A game moved to a stretch with nothing on: no cards, no budget, the Dewan in recess, no election near. */
function calm(): GameState {
  const g = newGame("PH", 4);
  return {
    ...g,
    cards: [],
    budgetDue: null,
    dewan: { ...g.dewan, meeting: null, motions: [] } as GameState["dewan"],
    parliament: { ...g.parliament, deadlineWeek: g.week + 200 },
    report: { week: g.week, income: [], expenses: [], seatsBefore: 0, seatsAfter: 0, movers: [], lines: [] },
  };
}

describe("quiet weeks", () => {
  it("a turn with nothing for you is quiet", () => {
    const g = calm();
    expect(needsYou(g)).toBe(false);
    // A party vote due within the turn needs you.
    expect(needsYou({ ...g, race: { voteWeek: g.week + 1 } as unknown as GameState["race"] })).toBe(true);
  });

  it("a docket card, the budget, a campaign or talks need you", () => {
    const g = calm();
    expect(needsYou({ ...g, budgetDue: g.week })).toBe(true);
    expect(needsYou({ ...g, parliament: { ...g.parliament, status: "campaign" } })).toBe(true);
    expect(needsYou({ ...g, cards: [{ id: "x", week: g.week } as unknown as GameState["cards"][number]] })).toBe(true);
    expect(needsYou({ ...g, namePending: true })).toBe(true);
    expect(needsYou({ ...g, report: { ...g.report!, lines: [{ text: "A by-election is called in Kemaman.", tone: "info" }] } })).toBe(true);
  });

  it("merged reports cover every week", () => {
    const a = advanceTurn(newGame("PH", 4));
    const b = advanceTurn(a);
    const m = mergeReports([a.report!, b.report!]);
    expect(m.weeks).toBe((a.report!.weeks ?? 1) + (b.report!.weeks ?? 1));
    expect(m.seatsBefore).toBe(a.report!.seatsBefore);
    expect(new Set(m.lines.map((l) => l.text)).size).toBe(m.lines.length);
  });
});
