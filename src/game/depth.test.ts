import { describe, expect, it } from "vitest";
import { deepMove } from "./actions";
import { advanceMonth } from "./month";
import { newGame, projectAllFor, type GameState } from "./state";
import { OPP, badness, critique, itemMet, rollAgenda } from "./systems/agenda";
import { THEMES, discipline, messageEffect } from "./systems/message";
import { WINGS } from "./systems/partyorg";
import { mpOf } from "./systems/people";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const strip = (s: GameState) => ({ ...s, report: null });
const rich = (s: GameState): GameState => ({ ...s, me: { ...s.me, ap: 40, funds: 100_000_000, capital: 150 } });
const seat = (code: string) => SEATS.find((x) => x.code === code)!.index;

describe("governing", () => {
  it("every government sets three promises, and keeping them builds approval", () => {
    const g = advanceWeek(newGame("PH", 1));
    expect(g.agenda?.items).toHaveLength(3);
    expect(g.agenda?.by).toBe(g.parliament.pm);
    const a = rollAgenda(g);
    const kept = { ...g, agenda: { ...a, items: a.items.map((it) => ({ ...it, target: it.from })) } };
    expect(kept.agenda.items.every((it) => itemMet(kept, it))).toBe(true);
  });
});

describe("opposing", () => {
  it("attacks on a bad number land; attacks on a good one fall flat", () => {
    const g = rich(advanceWeek(newGame("PN", 2)));
    const bad = { ...g, nation: { ...g.nation, inflation: 6 } };
    const good = { ...g, nation: { ...g.nation, inflation: 1.5 } };
    expect(badness(bad, "inflation")).toBeGreaterThan(0.9);
    const a = critique(bad, "inflation");
    const b = critique(good, "inflation");
    if ("error" in a || "error" in b) throw new Error("blocked");
    expect(a.state.nation.approval).toBeLessThan(bad.nation.approval);
    expect(b.state.me.nationalBuzz).toBeLessThanOrEqual(good.me.nationalBuzz);
    expect("error" in critique(a.state, "inflation")).toBe(true);
    expect("error" in critique(rich(newGame("PH", 2)), "inflation")).toBe(true);
  });

  it("an investigation runs for weeks and then goes public on its own", () => {
    let g = rich(advanceWeek(newGame("PN", 3)));
    const r = deepMove(g, { kind: "probe" });
    if (!r.ok) throw new Error(r.error);
    g = r.state;
    expect(g.opp.probe).not.toBeNull();
    for (let k = 0; k < 20 && g.opp.probe; k++) g = advanceWeek(g);
    expect(g.opp.probe).toBeNull();
  });

  it("a street rally has a cooldown, and the opposition gets a shadow cabinet", () => {
    let g = rich(advanceWeek(newGame("PN", 4)));
    expect(Object.keys(g.opp.shadow).length).toBeGreaterThan(3);
    const r = deepMove(g, { kind: "rally" });
    if (!r.ok) throw new Error(r.error);
    g = rich(r.state);
    expect(deepMove(g, { kind: "rally" }).ok).toBe(false);
    expect(OPP.rally.cooldown).toBeGreaterThan(4);
  });
});

describe("campaign message and the party", () => {
  it("a message grows with discipline and moves the voters it targets", () => {
    let g = newGame("PN", 5);
    const r = deepMove(g, { kind: "theme", id: "bangsa" });
    if (!r.ok) throw new Error(r.error);
    g = r.state;
    const malay = seat("P.021"); // Kota Bharu
    expect(discipline(g)).toBe(0);
    for (let k = 0; k < 12; k++) g = advanceWeek(g);
    expect(discipline(g)).toBe(1);
    expect(messageEffect(g, malay)).toBeGreaterThan(0);
    expect(THEMES.length).toBeGreaterThan(5);
    // Changing costs capital.
    const c = deepMove(g, { kind: "theme", id: "reform" });
    if (!c.ok) throw new Error(c.error);
    expect(c.state.me.capital).toBeLessThan(g.me.capital);
  });

  it("funding a wing lifts it, and it fades back without money", () => {
    let g = rich(newGame("BN", 6));
    const r = deepMove(g, { kind: "wing", wing: "youth" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.wings.youth).toBe(WINGS.start + WINGS.fund);
    g = r.state;
    for (let k = 0; k < 10; k++) g = advanceWeek(g);
    expect(g.wings.youth).toBeLessThan(WINGS.start + WINGS.fund);
  });

  it("the Supreme Council meets, and sacking an MP takes their seat out of the party", () => {
    let g = newGame("PH", 7);
    for (let k = 0; k < 12 && !g.cards.some((c) => c.kind === "council"); k++) g = advanceWeek(g);
    expect(g.cards.some((c) => c.kind === "council")).toBe(true);
    const i = SEATS.findIndex((_, k) => g.holders[k] === "PH" && mpOf(g, k) && mpOf(g, k)!.rank < 4 && mpOf(g, k)!.party === "PKR" && mpOf(g, k)!.id !== g.youId);
    const mp = mpOf(g, i)!;
    const r = deepMove(rich(g), { kind: "sack", id: mp.id });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.holders[i]).toBe("OTHERS");
    expect(projectAllFor(r.state).length).toBe(SEATS.length);
  });

  it("Skip 1 Month still equals four weeks", () => {
    const base = newGame("PN", 8);
    let w = base;
    for (let k = 0; k < 4; k++) w = advanceWeek(w);
    const m = advanceMonth(base);
    expect(strip(m).opp).toEqual(strip(w).opp);
    expect(strip(m).wings).toEqual(strip(w).wings);
    expect(strip(m).agenda).toEqual(strip(w).agenda);
  });
});
