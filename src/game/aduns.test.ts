import { describe, expect, it } from "vitest";
import { migrateGame, newGame, type GameState } from "./state";
import { BIRTHS } from "./data/births";
import { MP_BORN } from "./data/people";
import { realBorn } from "./systems/people";
import { adunNote, adunsAfterPolls } from "./systems/aduns";
import { termOf } from "./systems/assemblies";
import { DUNS, DUNS_BY_STATE } from "./systems/dun";
import { cabinetPool } from "./systems/newterm";
import { chiefKey, homeOf, regionOf } from "./systems/posts";
import { afterStatePolls, mbShortlist, resolveStatePending, stateGovPool } from "./systems/stategov";
import { advanceWeek } from "./week";

const seated = (g: GameState) => g.people.filter((p) => p.adun && p.adun.dun !== null);

function winKedah(g0: GameState): GameState {
  const ids = DUNS_BY_STATE.KDH;
  const dunHolders = [...g0.dunHolders];
  ids.forEach((d, k) => (dunHolders[d] = k < ids.length - 5 ? "PH" : "PN"));
  return afterStatePolls({ ...g0, dunHolders }, ["KDH"], g0.dunHolders).state;
}

describe("state assembly members", () => {
  it("every one of the 600 seats has one member, from that state", () => {
    const g = newGame("PH", 2);
    const a = seated(g);
    expect(DUNS).toHaveLength(600);
    expect(new Set(a.map((p) => p.adun!.dun)).size).toBe(600);
    expect(a).toHaveLength(600);
    for (const p of a) expect(homeOf(p)).toBe(regionOf(DUNS[p.adun!.dun!].state));
  });

  it("they stay out of the cabinet list", () => {
    const g = newGame("PH", 2);
    expect(cabinetPool(g).some((p) => p.adun)).toBe(false);
  });

  it("real politicians get no invented record", () => {
    const g = newGame("PH", 2);
    expect(g.people.filter((p) => p.real && p.adun?.terms)).toHaveLength(0);
  });

  it("a government's picks are all that state's members or its chief", () => {
    const g = winKedah(newGame("PH", 2));
    const gov = g.stateGov.KDH;
    const chiefs = new Set(g.coalitions.PH.members.map((m) => g.posts[m]?.[chiefKey("KDH")]));
    for (const p of stateGovPool(g, "KDH", ["PH"])) expect(p.adun?.state === "KDH" || chiefs.has(p.id)).toBe(true);
    for (const id of [gov.mb, ...gov.exco]) {
      const p = g.people.find((x) => x.id === id)!;
      expect(p.adun?.state === "KDH" || chiefs.has(p.id)).toBe(true);
    }
    expect(mbShortlist(g, "KDH").length).toBeGreaterThan(0);
    expect(gov.exco).toHaveLength(6);
  });

  it("a seat held gains a term; a seat lost gets a first-termer; the old team's term counts", () => {
    const g = newGame("PH", 2);
    const old = g.stateGov.SGR;
    const ids = DUNS_BY_STATE.SGR;
    const dunHolders = [...g.dunHolders];
    const flip = ids.find((d) => g.dunHolders[d] === "PN")!;
    dunHolders[flip] = "PH";
    const before = seated(g).find((p) => p.adun!.dun === flip)!;
    const next = adunsAfterPolls({ ...g, dunHolders }, ["SGR"]);
    const now = seated(next).find((p) => p.adun!.dun === flip)!;
    expect(now.id).not.toBe(before.id);
    expect(now.adun!.terms).toBe(1);
    expect(next.people.find((p) => p.id === old.mb)!.adun!.mbTerms).toBeGreaterThanOrEqual(1);
    const stayed = seated(next).filter((p) => p.adun!.state === "SGR" && g.people.some((q) => q.id === p.id));
    expect(stayed.length).toBeGreaterThan(30);
    for (const p of stayed) expect(p.adun!.terms).toBe(g.people.find((q) => q.id === p.id)!.adun!.terms + 1);
    expect(seated(next)).toHaveLength(600);
  });

  it("the draft screen calls the outgoing team incumbent", () => {
    const g0 = newGame("PH", 2);
    const old = g0.stateGov.KDH.exco[0];
    const g = winKedah(g0);
    expect(g.stateTerms.some((t) => t.state === "KDH")).toBe(true);
    const p = g.people.find((x) => x.id === old);
    if (p) expect(adunNote(g, p)).toMatch(/Incumbent exco/);
    const done = resolveStatePending(g).state;
    const mb = done.people.find((x) => x.id === done.stateGov.KDH.mb)!;
    expect(adunNote(done, mb)).toMatch(/Incumbent Menteri Besar/);
  });

  it("the list stays near its size through ten years", () => {
    let g = newGame("PN", 3);
    const start = g.people.length;
    for (let w = 0; w < 520; w++) {
      g = advanceWeek({ ...g, cards: [] });
      g = { ...g, stateTerms: [], stateTalks: null };
    }
    expect(seated(g).length).toBe(600);
    expect(g.people.length).toBeLessThan(start + 150);
  }, 60000);

  it("an old save gains its members and keeps its governments", () => {
    const g = JSON.parse(JSON.stringify(newGame("PH", 3)));
    g.people = g.people.filter((p: { adun?: unknown }) => !p.adun);
    const gov = g.stateGov.PNG;
    for (const x of Object.values(g.stateGov) as { outgoing?: unknown }[]) delete x.outgoing;
    const m = migrateGame({ ...g, version: 30 });
    expect(seated(m)).toHaveLength(600);
    expect(m.stateGov.PNG.ruler).toBe(gov.ruler);
    const again = migrateGame(JSON.parse(JSON.stringify(m)));
    expect(seated(again)).toHaveLength(600);
  });
});

describe("real ages", () => {
  it("uses sourced years, leaves nobody on the old placeholder, and makes the unknown young", () => {
    const g = newGame("PH", 2);
    const age = (name: string) => 2026 - g.people.find((p) => p.name === name)!.born;
    expect(age("Syed Saddiq Syed Abdul Rahman")).toBe(34);
    expect(age("Young Syefura Othman")).toBe(37);
    expect(age("Akmal Saleh")).toBe(38);
    expect(age("Onn Hafiz Ghazi")).toBe(47);
    expect(g.people.filter((p) => p.tokoh && p.born === 1965 && !realBorn(p.name)).length).toBe(0);
    expect(g.people.filter((p) => p.real && 2026 - p.born > 70 && !BIRTHS[p.name] && !MP_BORN[p.name]).length).toBeLessThan(10);
  });

  it("an old save takes the corrected ages and changes nobody's party", () => {
    const g = JSON.parse(JSON.stringify(newGame("PH", 3)));
    for (const p of g.people) if (p.name === "Young Syefura Othman") p.born = 1948;
    const m = migrateGame({ ...g, version: 30 });
    expect(2026 - m.people.find((p) => p.name === "Young Syefura Othman")!.born).toBeLessThanOrEqual(50);
    expect(m.people.slice(0, g.people.length).map((p) => p.party)).toEqual(g.people.map((p: { party: string }) => p.party));
  });
});

describe("the term", () => {
  it("starts in year 4 of the 15th Parliament and renews after a general election", () => {
    const g = newGame("PH", 2);
    expect(termOf(g)).toEqual({ number: 15, year: 4, of: 5 });
    const after = { ...g, geCount: 16, week: 100, parliament: { ...g.parliament, deadlineWeek: 360 } };
    expect(termOf(after)).toEqual({ number: 16, year: 1, of: 5 });
  });
});
