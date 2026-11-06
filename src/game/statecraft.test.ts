import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { nationWeek } from "./systems/nation";
import { SEATS, contestingIn } from "./world";
import { CRAFT, PROGRAMME_BY_ID, appointTop, craftOf, craftTargets, craftWeek, groupScores, initCraft, planBoost, queueBuild, setMa63, setPlan, setStateWeight, signDeal, startProgramme, topEffect, visitPartner } from "./systems/statecraft";
import { initWawasan, malaysiaPower, pillarPace, wz } from "./systems/wawasan";

const pm = (): GameState => {
  const g = newGame("PH", 1);
  return { ...g, career: { ...g.career, rung: 7 }, me: { ...g.me, ap: 16, capital: 100 } };
};
const ok = (r: { state: GameState } | { error: string }) => {
  if ("error" in r) throw new Error(r.error);
  return r.state;
};
const weeks = (g: GameState, n: number) => {
  for (let i = 0; i < n; i++) g = { ...craftWeek(g).state, week: g.week + 1 };
  return g;
};

describe("Malaysia Plan", () => {
  it("takes three priorities, runs five years, and speeds up its pillars", () => {
    const g = pm();
    expect("error" in setPlan(g, ["human", "infra"])).toBe(true);
    const s = ok(setPlan(g, ["human", "infra", "jobs"]));
    expect(planBoost(s, "human")).toBe(CRAFT.plan.boost);
    expect(planBoost(s, "innov")).toBe(1);
    expect("error" in setPlan(s, ["innov", "inst", "living"])).toBe(true);
    const alloc = { ...s, nation: { ...s.nation, wawasan: { ...initWawasan(), alloc: { youth: 4 } } } };
    expect(pillarPace(alloc).human).toBeGreaterThan(pillarPace({ ...alloc, craft: undefined }).human);
    expect(craftTargets(s).unemployment).toBeLessThan(craftTargets(g).unemployment);
  });
});

describe("ministry programmes", () => {
  it("run one to a ministry, and a good minister finishes first, with a lasting gain", () => {
    const g = pm();
    const s = ok(startProgramme(g, "tvet"));
    expect("error" in startProgramme(s, "stem")).toBe(true);
    const good = { ...s, people: s.people.map((p) => (p.id === s.cabinet.education ? { ...p, competence: 100 } : p)) };
    const bad = { ...s, people: s.people.map((p) => (p.id === s.cabinet.education ? { ...p, competence: 10 } : p)) };
    const g2 = weeks(good, 40);
    expect(craftOf(g2).programmes.education!.progress).toBeGreaterThan(craftOf(weeks(bad, 40)).programmes.education!.progress);
    const done = weeks(good, PROGRAMME_BY_ID.tvet.weeks + 10);
    expect(craftOf(done).finished).toContain("tvet");
    expect(wz(done).human).toBeGreaterThan(initWawasan().human);
    expect(craftTargets(done).unemployment).toBeLessThan(0);
  });
});

describe("states", () => {
  it("money develops a state and grows your service there; starving it falls behind", () => {
    const g = pm();
    const seat = SEATS.find((x) => x.state === "PNG" && contestingIn(x, g.entries).includes(g.player))!.index;
    const s = ok(setStateWeight(ok(setStateWeight(g, "PNG", 10)), "KTN", 0));
    const later = weeks(s, 104);
    const c = craftOf(later);
    expect(c.dev.PNG - craftOf(g).dev.PNG).toBeGreaterThan(c.dev.KTN - craftOf(g).dev.KTN);
    expect(later.me.service[seat]).toBeGreaterThan(g.me.service[seat]);
  });

  it("MA63 lifts Borneo and costs fiscal space", () => {
    const g = pm();
    const s = ok(setMa63(g, 40));
    const a = weeks(s, 52);
    const b = weeks(g, 52);
    expect(craftOf(a).dev.SBH).toBeGreaterThan(craftOf(b).dev.SBH);
    expect(a.fiscal).toBeLessThan(b.fiscal);
  });
});

describe("industry", () => {
  it("a build raises the sector and pays out; without the pillar it takes twice as long", () => {
    const g = pm();
    const s = ok(queueBuild(g, "ee", "PNG"));
    expect(s.fiscal).toBe(g.fiscal - CRAFT.build.fiscal);
    expect("error" in queueBuild(g, "ee", "KTN")).toBe(true);
    // Innovation starts below what electronics needs.
    expect(craftOf(weeks(s, 60)).levels.ee).toBe(0);
    const rich = { ...s, nation: { ...s.nation, wawasan: { ...initWawasan(), innov: 60 } } };
    const built = weeks(rich, 53);
    expect(craftOf(built).levels.ee).toBe(1);
    expect(craftTargets(built).gdp).toBeGreaterThan(0);
  });
});

describe("top appointments", () => {
  it("a capable appointee keeps paying, and is grateful", () => {
    const g = pm();
    const who = g.people.find((p) => p.party === "PKR" && p.id !== g.youId && !Object.values(g.cabinet).includes(p.id))!;
    const best = { ...g, people: g.people.map((p) => (p.id === who.id ? { ...p, competence: 90 } : p)) };
    const s = ok(appointTop(best, "khazanah", who.id));
    expect(topEffect(s, "khazanah")).toBeGreaterThan(0.5);
    expect(s.people.find((p) => p.id === who.id)!.memory?.[0].reason).toContain("Khazanah");
    expect(wz(weeks(s, 52)).innov).toBeGreaterThan(wz(g).innov);
    expect("error" in appointTop(s, "epf", who.id)).toBe(true);
  });
});

describe("world", () => {
  it("visits warm relations, Washington cools Beijing, and a deal lifts growth and Global Power", () => {
    const g = pm();
    const s = ok(visitPartner(g, "US"));
    expect(craftOf(s).relations.US).toBeGreaterThan(craftOf(g).relations.US);
    expect(craftOf(s).relations.China).toBeLessThan(craftOf(g).relations.China);
    expect(s.me.ap).toBe(g.me.ap - CRAFT.relation.visitAp);
    expect("error" in signDeal(s, "US")).toBe(true);
    let t = s;
    for (let i = 0; i < 3; i++) t = ok(visitPartner(t, "US"));
    const d = ok(signDeal(t, "US"));
    expect(craftTargets(d).gdp).toBeGreaterThan(craftTargets(t).gdp);
    expect(malaysiaPower(d)).toBeGreaterThan(malaysiaPower(t));
  });
});

describe("interest groups", () => {
  it("follow what you do, and pay out above the line", () => {
    const g = pm();
    const before = groupScores(g);
    const s: GameState = { ...g, nation: { ...g.nation, civilPay: "raise", wawasan: { ...initWawasan(), alloc: { civil: 3, rural: 4 } } } };
    const after = groupScores(s);
    expect(after.civil).toBeGreaterThan(before.civil);
    expect(after.felda).toBeGreaterThan(before.felda);
    expect(after.felda).toBeGreaterThanOrEqual(CRAFT.group.line);
    expect(craftTargets({ ...s, craft: initCraft() }).approval).toBeGreaterThan(craftTargets({ ...g, craft: initCraft() }).approval);
  });
});

describe("only your government", () => {
  it("nothing runs or counts under anyone else, and your boards lift the economy", () => {
    const g = ok(startProgramme(pm(), "invest"));
    const other = { ...g, parliament: { ...g.parliament, pm: "PN" as const } };
    expect(weeks(other, 30).craft).toBe(other.craft);
    expect(craftTargets(other).fdi).toBe(0);
    const done = weeks(g, 60);
    expect(nationWeek(done).nation.fdi).toBeGreaterThan(nationWeek({ ...done, craft: undefined }).nation.fdi);
  });
});
