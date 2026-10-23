import { describe, expect, it } from "vitest";
import { newGame } from "./state";
import { coalitionLeader } from "./systems/coalitions";

describe("your character", () => {
  it("takes the party president's chair under the name you chose", () => {
    const g = newGame("MUDA", 1, { name: "  Adam Rahman " });
    expect(g.career.name).toBe("Adam Rahman");
    expect(g.people.find((p) => p.id === g.youId)?.name).toBe("Adam Rahman");
    expect(g.people.some((p) => p.name === "Amira Aisya Abdul Aziz")).toBe(false);
    expect(coalitionLeader(g, "MUDA")).toBe("Adam Rahman");
  });
});
