import { describe, expect, it } from "vitest";
import { newGame, projectAllFor, type GameState } from "./state";
import { advanceWeek } from "./week";
import { NATIONAL_POSTS, appointPost, autoPosts, chiefKey, holderOf, postPool, sendOnMission, wingRest } from "./systems/posts";
import { leave } from "./systems/people";
import { SEATS } from "./world";

const yours = (g: GameState) => g.coalitions[g.player].members[0];

describe("lieutenants and generals", () => {
  it("every party starts with its national posts filled, and your party has a chief in every state", () => {
    const g = newGame("PH", 3);
    for (const party of ["PKR", "DAP", "UMNO", "PAS", "BERSATU"]) for (const k of NATIONAL_POSTS) expect(holderOf(g, party, k), `${party} ${k}`).toBeDefined();
    expect(holderOf(g, yours(g), chiefKey("SGR"))).toBeDefined();
    expect(holderOf(g, yours(g), chiefKey("WP"))).toBeDefined();
  });

  it("nobody holds two posts, and you and your chairman hold none", () => {
    const g = newGame("BN", 3, { name: "Adam Rahman" });
    for (const posts of Object.values(g.posts)) {
      const ids = Object.values(posts);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(g.youId);
      expect(ids.some((id) => g.people.find((p) => p.id === id)?.chairman)).toBe(false);
    }
  });

  it("a post-holder who leaves is replaced", () => {
    const g = newGame("PH", 3);
    const sg = holderOf(g, "PKR", "sg")!;
    const gone = autoPosts(leave(g, sg.id, "resigns", []));
    const next = holderOf(gone, "PKR", "sg");
    expect(next).toBeDefined();
    expect(next!.id).not.toBe(sg.id);
  });

  it("a stronger state chief lifts your projection in that state, and nowhere else", () => {
    const g = newGame("PH", 3);
    const key = chiefKey("SGR");
    const pool = postPool(g, yours(g));
    const best = [...pool].sort((a, b) => b.competence - a.competence)[0];
    const strong = { ...g, people: g.people.map((p) => (p.id === best.id ? { ...p, competence: 100, home: "SGR", loyalty: 90 } : p)), me: { ...g.me, capital: 50 } };
    const r = appointPost(strong, key, best.id);
    if ("error" in r) throw new Error(r.error);
    const before = projectAllFor(g);
    const after = projectAllFor(r.state);
    const sgr = SEATS.filter((s) => s.state === "SGR" && (before[s.index].shares.PH ?? 0) > 0);
    const gain = sgr.reduce((x, s) => x + (after[s.index].shares.PH ?? 0) - (before[s.index].shares.PH ?? 0), 0);
    expect(gain).toBeGreaterThan(0);
    const johor = SEATS.filter((s) => s.state === "JHR");
    for (const s of johor) expect(after[s.index].shares.PH ?? 0).toBeCloseTo(before[s.index].shares.PH ?? 0, 6);
  });

  it("a mission costs an action point, and the person can't go again straight away", () => {
    const g = newGame("PH", 3);
    const sg = holderOf(g, yours(g), "sg")!;
    const r = sendOnMission(g, sg.id);
    if ("error" in r) throw new Error(r.error);
    expect(r.state.me.ap).toBe(g.me.ap - 1);
    const after = r.state.people.find((p) => p.id === sg.id)!;
    expect(Math.abs(after.loyalty - sg.loyalty)).toBeGreaterThan(0);
    expect("error" in sendOnMission(r.state, sg.id)).toBe(true);
  });

  it("a capable Youth chief raises the wing's resting level", () => {
    const g = newGame("PH", 3);
    const y = holderOf(g, yours(g), "youth")!;
    const strong = { ...g, people: g.people.map((p) => (p.id === y.id ? { ...p, competence: 95 } : p)) };
    const weak = { ...g, people: g.people.map((p) => (p.id === y.id ? { ...p, competence: 20 } : p)) };
    expect(wingRest(strong, 40).youth).toBeGreaterThan(wingRest(weak, 40).youth);
  });

  it("posts stay filled as the weeks go by", () => {
    let g = newGame("PN", 4);
    for (let w = 0; w < 30; w++) g = advanceWeek(g);
    for (const k of NATIONAL_POSTS) expect(holderOf(g, yours(g), k)).toBeDefined();
  }, 30_000);
});
