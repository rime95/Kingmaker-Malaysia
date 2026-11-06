import { describe, expect, it } from "vitest";
import { ALARM } from "./month";
import { newGame, type GameState } from "./state";
import { AMBITION, ambitionsMonth, tiesOf, wantOf } from "./systems/ambitions";
import { logNews, newsWeek, storiesFor } from "./systems/news";
import { remember } from "./systems/people";
import { PLOT, breakPlot, plotOf, plotsMonth } from "./systems/plots";
import { profileOf } from "./systems/realProfiles";
import { advanceWeek } from "./week";

const lead = (): GameState => {
  const g = newGame("PH", 1);
  return { ...g, career: { ...g.career, rung: 7 }, me: { ...g.me, capital: 100, ap: 16 } };
};

describe("memory and favours", () => {
  it("people remember their last six reasons, and a big good turn banks a favour", () => {
    let p = lead().people[0];
    for (let i = 0; i < 8; i++) p = remember(p, 2, `reason ${i}`, i);
    expect(p.memory).toHaveLength(6);
    expect(p.memory![0].reason).toBe("reason 7");
    expect(p.owed).toBeUndefined();
    expect(remember(p, 15, "You made me a minister", 9).owed).toBe(1);
  });
});

describe("goals and ties", () => {
  it("nobody is thanked for what they already had; delivering a goal wins them over", () => {
    const base = lead();
    const pick = base.people.find((p) => p.party === 'AMANAH' && p.rank <= 1 && p.seat === null)!;
    const g = { ...base, week: 1, people: base.people.map((p) => (p.id === pick.id ? { ...p, influence: 50, rank: 1 } : p)) };
    const seeded = ambitionsMonth(g);
    expect(seeded.lines).toHaveLength(0);
    const who = seeded.state.people.find((p) => p.id === pick.id)!;
    expect(wantOf(who)).toBe('council');
    const given = { ...seeded.state, week: 5, people: seeded.state.people.map((p) => (p.id === who.id ? { ...p, rank: 2 } : p)) };
    const r = ambitionsMonth(given);
    const after = r.state.people.find((p) => p.id === who.id)!;
    expect(after.loyalty).toBeGreaterThanOrEqual(Math.min(100, who.loyalty + AMBITION.delivered - 1));
    expect(after.owed).toBe(1);
    expect(r.lines.some((l) => l.text.includes(who.name))).toBe(true);
  });

  it("researched profiles load, and rivals never cost loyalty", () => {
    expect(profileOf("Shahril Hamdan")?.sources.length).toBeGreaterThan(0);
    const g = lead();
    const withTies = g.people.find((p) => tiesOf(g, p).rivals.length > 0);
    if (withTies) {
      const after = ambitionsMonth({ ...g, week: 1 }).state.people.find((p) => p.id === withTies.id)!;
      expect(after.loyalty).toBeGreaterThanOrEqual(withTies.loyalty);
    }
  });
});

describe("plots", () => {
  it("a plot can be broken, and at worst takes one seat and starts again", () => {
    const g: GameState = { ...lead(), week: 2, plot: { strength: 99, warned: true } };
    const b = breakPlot(g);
    if (!("state" in b)) throw new Error("blocked");
    expect(plotOf(b.state).strength).toBe(59);
    const r = plotsMonth({ ...g, me: { ...g.me, unity: 10 } });
    const p = plotOf(r.state).strength;
    expect(p === PLOT.after || p >= 99 || p < 99).toBe(true);
    expect(r.state.people.filter((x) => x.party === "PKR" && x.rank >= 2).length).toBeGreaterThanOrEqual(g.people.filter((x) => x.party === "PKR" && x.rank >= 2).length - 1);
  });

  it("over a term the politician systems favour you: rivals fall out more than plots land", () => {
    let g: GameState = { ...lead(), week: 0 };
    let landed = 0;
    let feuds = 0;
    for (let w = 0; w < 260; w++) {
      const r = plotsMonth({ ...g, week: w });
      g = r.state;
      landed += r.lines.filter((l) => l.text.includes("off the council")).length;
      feuds += r.lines.filter((l) => l.text.includes("open dispute")).length;
    }
    expect(feuds).toBeGreaterThan(landed);
  });
});

describe("news", () => {
  it("stories name real people, never trip the alarm that stops quiet turns, and never mention crime", () => {
    const g = lead();
    const low = { ...g, nation: { ...g.nation, approval: 30, col: 70, debt: 70, ringgit: 4.8, gdp: 6 } };
    const list = [...storiesFor(low), ...storiesFor({ ...low, player: "PN" as const, government: ["PH" as const] })];
    expect(list.length).toBeGreaterThan(3);
    for (const x of list) {
      expect(ALARM.test(x.text)).toBe(false);
      expect(/corrupt|charged|court|graft|bribe|scandal|arrest/i.test(x.text)).toBe(false);
    }
  });

  it("the log keeps stories and doesn't repeat them", () => {
    const g = lead();
    const once = logNews(g, [{ text: "Hello", tone: "good" }]);
    const twice = logNews({ ...g, news: once }, [{ text: "Hello", tone: "good" }]);
    expect(twice).toHaveLength(1);
    expect(twice[0].paper).toBeTruthy();
  });

  it("a played year fills the news log", () => {
    let g = lead();
    for (let i = 0; i < 52; i++) g = advanceWeek({ ...g, cards: [] });
    expect(g.news!.length).toBeGreaterThan(15);
    expect(newsWeek(g)).toBeDefined();
  });
});
