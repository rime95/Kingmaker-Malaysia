import { describe, expect, it } from "vitest";
import { inWeeks, upcoming } from "./calendar";
import { newGame } from "./state";

describe("what's coming", () => {
  it("lists the general election, the Budget and state polls, urgent things first then soonest", () => {
    const g = newGame("PH", 2);
    const list = upcoming(g);
    expect(list.some((x) => x.key === "ge")).toBe(true);
    expect(list.some((x) => x.key === "budget")).toBe(true);
    for (let k = 1; k < list.length; k++) {
      const a = list[k - 1];
      const b = list[k];
      if (a.urgent === b.urgent) expect(a.weeks).toBeLessThanOrEqual(b.weeks);
      else expect(a.urgent).toBe(true);
    }
  });

  it("a dissolved Parliament puts polling day first", () => {
    const g0 = newGame("PH", 2);
    const g = { ...g0, parliament: { ...g0.parliament, status: "campaign" as const, pollWeek: g0.week + 3 } };
    const first = upcoming(g)[0];
    expect(first.label).toBe("Polling day");
    expect(first.weeks).toBe(3);
  });

  it("a state in campaign shows its polling day", () => {
    const g0 = newGame("PH", 2);
    const g = { ...g0, assemblies: { ...g0.assemblies, PRK: { ...g0.assemblies.PRK, status: "campaign" as const, pollWeek: g0.week + 2 } } };
    expect(upcoming(g).find((x) => x.key === "prn-PRK")).toMatchObject({ urgent: true, weeks: 2, state: "PRK" });
  });

  it("says weeks in words", () => {
    expect(inWeeks(0)).toBe("this week");
    expect(inWeeks(1)).toBe("1 wk");
    expect(inWeeks(12)).toBe("12 wks");
    expect(inWeeks(260)).toBe("~5 yrs");
  });
});
