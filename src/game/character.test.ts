import { describe, expect, it } from "vitest";
import { newGame } from "./state";
import { coalitionLeader } from "./systems/coalitions";
import { chairmanCampaign, chairmanOf } from "./systems/chairman";
import { syncYou } from "./systems/people";
import { titleOf } from "./systems/people";

describe("your character", () => {
  it("takes the party president's chair under the name you chose", () => {
    const g = newGame("MUDA", 1, { name: "  Adam Rahman " });
    expect(g.career.name).toBe("Adam Rahman");
    expect(g.people.find((p) => p.id === g.youId)?.name).toBe("Adam Rahman");
    expect(g.people.find((p) => p.id === g.youId)?.rank).toBe(5);
    expect(coalitionLeader(g, "MUDA")).toBe("Adam Rahman");
  });

  it("keeps the real president on as Party Chairman", () => {
    const g = newGame("BERSAMA", 1, { name: "Adam Rahman" });
    const ch = chairmanOf(g)!;
    expect(ch.name).toBe("Rafizi Ramli");
    expect(ch.chairman).toBe(true);
    expect(titleOf(g, ch)).toContain("Party Chairman");
    // Rafizi keeps Pandan; you are not given his seat.
    expect(ch.seat).not.toBeNull();
    expect(g.career.homeSeat).not.toBe(ch.seat);
    // Only one president.
    expect(g.people.filter((p) => p.party === "BERSAMA" && p.rank === 5).length).toBe(1);
  });

  it("playing the real leader has no chairman", () => {
    const g = newGame("BERSAMA", 1, { name: "Rafizi Ramli" });
    expect(chairmanOf(g)).toBeUndefined();
  });

  it("leading the government makes you PM, with the chairman in cabinet", () => {
    const g = newGame("PH", 1, { name: "Adam Rahman" });
    expect(g.cabinet.pm).toBe(g.youId);
    const ch = chairmanOf(g)!;
    expect(ch.name).toBe("Anwar Ibrahim");
    expect(Object.values(g.cabinet)).toContain(ch.id);
  });

  it("a mid-game takeover makes the old president chairman", () => {
    const g = newGame("BERSAMA", 1, { mode: "career", name: "Adam Rahman" });
    const you = g.people.find((p) => p.id === g.youId)!;
    const next = syncYou({ ...g, career: { ...g.career, rung: 6 } });
    expect(next.people.find((p) => p.id === you.id)?.rank).toBe(5);
    expect(chairmanOf(next)?.name).toBe("Rafizi Ramli");
  });

  it("the chairman campaigns for you once a week", () => {
    const g = newGame("BERSAMA", 1, { name: "Adam Rahman" });
    const seat = g.career.homeSeat;
    const r = chairmanCampaign(g, seat);
    if ("error" in r) throw new Error(r.error);
    expect(r.state.me.buzz[seat]).toBeGreaterThan(g.me.buzz[seat]);
    expect("error" in chairmanCampaign(r.state, seat)).toBe(true);
  });
});

describe("candidates", () => {
  it("traits play differently seat to seat", async () => {
    const { traitVote, profileOf } = await import("./systems/profiles");
    const { SEATS } = await import("./world");
    const g = newGame("PN", 2);
    const city = SEATS.reduce((a, b) => (b.demo.urbanity > a.demo.urbanity ? b : a)).index;
    const rural = SEATS.reduce((a, b) => (b.demo.urbanity < a.demo.urbanity && (b.demo.ethnic.malay ?? 0) > 0.8 ? b : a)).index;
    const ustaz = g.people.find((p) => profileOf(p).traits.includes("religious") && !profileOf(p).traits.includes("local"));
    const techno = g.people.find((p) => profileOf(p).traits.includes("technocrat") && !profileOf(p).traits.includes("local"));
    expect(ustaz && techno).toBeTruthy();
    expect(traitVote(ustaz!, rural)).toBeGreaterThan(traitVote(ustaz!, city));
    expect(traitVote(techno!, city)).toBeGreaterThan(traitVote(techno!, rural));
    // Profiles are stable.
    expect(profileOf(ustaz!)).toEqual(profileOf(ustaz!));
  });
});
