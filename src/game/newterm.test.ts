import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { advanceWeek } from "./week";
import { confirmCabinet, draftFairness, openNewTerm, setDraft } from "./systems/newterm";
import { byId, formCabinet } from "./systems/people";
import { chairmanOf } from "./systems/chairman";

/** PH as the player, leading the government, with the cabinet screen open. */
const opened = (): GameState => {
  const g = newGame("PH", 4, { name: "Adam Rahman" });
  return openNewTerm(g, g.cabinet);
};

describe("forming the cabinet", () => {
  it("opens for you as PM, drafted from the suggested line-up", () => {
    const s = opened();
    expect(s.newTerm).not.toBeNull();
    expect(s.newTerm!.draft).toEqual(s.cabinet);
  });

  it("does not open when someone else is PM", () => {
    const g = newGame("PN", 4, { name: "Adam Rahman" });
    expect(openNewTerm(g, g.cabinet).newTerm ?? null).toBeNull();
  });

  it("one post per person", () => {
    let s = opened();
    const someone = byId(s, s.newTerm!.draft.health)!;
    s = setDraft(s, "education", someone.id);
    expect(s.newTerm!.draft.education).toBe(someone.id);
    expect(s.newTerm!.draft.health).toBeUndefined();
  });

  it("shortchanging a partner costs you their goodwill", () => {
    let s = opened();
    // Hand every post you can to your own party.
    const mine = s.people.filter((p) => p.party === "PKR" && p.rank >= 1 && !p.retired && p.id !== s.youId);
    const posts = Object.keys(s.newTerm!.draft).filter((k) => k !== "pm") as (keyof NonNullable<GameState["newTerm"]>["draft"])[];
    posts.forEach((k, n) => (s = setDraft(s, k, mine[n % mine.length].id)));
    expect(draftFairness(s).DAP).toBeLessThan(0.9);
    const before = s.partySat.DAP ?? 55;
    const after = confirmCabinet(s).state;
    expect(after.partySat.DAP).toBeLessThan(before);
    expect(after.newTerm).toBeNull();
  });

  it("the chairman expects a post", () => {
    let s = opened();
    const ch = chairmanOf(s)!;
    for (const [k, v] of Object.entries(s.newTerm!.draft)) if (v === ch.id && k !== "pm") s = setDraft(s, k as "finance", null);
    const after = confirmCabinet(s).state;
    expect(chairmanOf(after)!.loyalty).toBeLessThan(ch.loyalty);
  });

  it("a cabinet left on the table is sworn in when time moves on", () => {
    const s = opened();
    const next = advanceWeek(s);
    expect(next.newTerm).toBeNull();
    expect(next.cabinet.pm).toBe(s.youId);
    expect(Object.keys(formCabinet(s)).length).toBeGreaterThan(5);
  });
});
