import { describe, expect, it } from "vitest";
import { migrateGame, newGame, projectAllFor, type GameState } from "./state";
import { coalitionLeader } from "./systems/coalitions";
import { COALITIONS, SEATS } from "./world";

const seat = (code: string) => SEATS.find((x) => x.code === code)!.index;

describe("Parti Bersama", () => {
  it("holds Pandan and Setiawangsa, led by Rafizi Ramli with Nik Nazmi as deputy", () => {
    const g = newGame("BERSAMA", 1);
    expect(g.holders.filter((h) => h === "BERSAMA").length).toBe(2);
    expect(g.holders[seat("P.100")]).toBe("BERSAMA");
    expect(g.holders[seat("P.118")]).toBe("BERSAMA");
    expect(coalitionLeader(newGame("PN", 1), "BERSAMA")).toBe("Rafizi Ramli");
    const nik = g.people.find((p) => p.name === "Nik Nazmi Nik Ahmad")!;
    expect(nik.party).toBe("BERSAMA");
    expect(nik.seat).toBe(seat("P.118"));
    expect(g.government).not.toContain("BERSAMA");
    // The starting map still reproduces GE15, with the two seats now Bersama's.
    const proj = projectAllFor(g);
    expect(proj[seat("P.100")].leader).toBe("BERSAMA");
    expect(proj[seat("P.118")].leader).toBe("BERSAMA");
  });

  it("old saves gain Bersama in every per-coalition table", () => {
    const g = newGame("PN", 2);
    const at = COALITIONS.indexOf("BERSAMA");
    const drop = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== "BERSAMA"));
    const [swing, coalitions, rivals, now] = [drop(g.swing), drop(g.coalitions), drop(g.rivals), drop(g.scorecard.now)];
    const old = {
      ...g,
      version: 14,
      seatOffsets: g.seatOffsets.map((row) => row.filter((_, i) => i !== at)),
      swing,
      coalitions,
      rivals,
      scorecard: { ...g.scorecard, now, start: now },
    } as unknown as GameState;
    const m = migrateGame(old);
    expect(m.seatOffsets[0].length).toBe(COALITIONS.length);
    expect(m.swing.BERSAMA).toBe(0);
    expect(m.coalitions.BERSAMA.members).toContain("BERSAMA");
    expect(m.rivals.BERSAMA).toBeDefined();
    expect(m.scorecard.now.BERSAMA).toBeDefined();
    expect(projectAllFor(m).length).toBe(SEATS.length);
  });
});
