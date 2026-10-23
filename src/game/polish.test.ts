import { describe, expect, it } from "vitest";
import { advise } from "./advice";
import { START } from "./config";
import { newGame, type GameState } from "./state";
import { advanceWeek } from "./week";

function weeks(g: GameState, n: number) {
  for (let i = 0; i < n; i++) g = advanceWeek(g);
  return g;
}

describe("scenarios and difficulty", () => {
  it("snap election dissolves Parliament in week 3 and votes five weeks later", () => {
    let g = newGame("PN", 1, { scenario: "snap" });
    g = weeks(g, 4);
    expect(g.parliament.status).toBe("campaign");
    g = weeks(g, 5);
    expect(g.parliament.lastPollWeek).toBe(8);
  });

  it("underdog starts broke and divided", () => {
    const g = newGame("BN", 1, { scenario: "underdog" });
    expect(g.me.funds).toBe(Math.round(START.BN.funds * 0.25));
    expect(g.me.unity).toBe(40);
  });

  it("difficulty changes your starting money and how hard rivals campaign", () => {
    expect(newGame("PH", 1, { difficulty: "easy" }).me.funds).toBe(START.PH.funds * 1.5);
    const moves = (d: "easy" | "hard") => {
      // The run-up to polling day, when rivals campaign hardest.
      let g = newGame("PH", 2, { difficulty: d });
      g = { ...g, parliament: { ...g.parliament, deadlineWeek: g.week + 10 } };
      let total = 0;
      for (let w = 0; w < 6; w++) {
        g = advanceWeek(g);
        total += Object.values(g.rivals).reduce((s, r) => s + r!.targets.length, 0);
      }
      return total;
    };
    expect(moves("hard")).toBeGreaterThan(moves("easy"));
  });
});

describe("advisor", () => {
  it("suggests seats to work, with one-click actions", () => {
    const tips = advise(newGame("PN", 1));
    expect(tips.length).toBeGreaterThan(1);
    expect(tips.some((t) => t.action?.target.kind === "seat")).toBe(true);
  });

  it("warns about a short runway and MACC risk", () => {
    const g = newGame("MUDA", 1);
    // Running machinery everywhere costs more each week than a small party brings in.
    const tips = advise({ ...g, me: { ...g.me, funds: 50_000, risk: 70, machinery: g.me.machinery.map(() => 100) } });
    expect(tips.some((t) => t.text.startsWith("Money runs out"))).toBe(true);
    expect(tips.some((t) => t.text.startsWith("MACC risk"))).toBe(true);
  });
});
