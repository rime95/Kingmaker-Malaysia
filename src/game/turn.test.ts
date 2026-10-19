import { describe, expect, it } from "vitest";
import { applyAction, buyAsset, previewAction, sellAsset, tapAsset, upgradeAsset } from "./actions";
import { advanceMonth } from "./month";
import { newGame, projectedSeats, type GameState } from "./state";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
const strip = (s: GameState) => ({ ...s, report: null });

function busyGame(): GameState {
  let g = newGame("PN", 2024);
  for (const [id, t] of [
    ["ceramah", { kind: "seat", seat: seat("P.044") }],
    ["service", { kind: "seat", seat: seat("P.015") }],
    ["tycoon", { kind: "none" }],
  ] as const) {
    const r = applyAction(g, id, t);
    if (!r.ok) throw new Error(r.error);
    g = r.state;
  }
  for (const type of ["construction", "bursa", "plantation"] as const) {
    const r = buyAsset(g, type, "crony");
    if (!r.ok) throw new Error(r.error);
    g = r.state;
  }
  return g;
}

describe("turn loop", () => {
  it("Skip 1 Month equals four Skip 1 Weeks", () => {
    const g = busyGame();
    let weeks = g;
    for (let i = 0; i < 4; i++) weeks = advanceWeek(weeks);
    expect(strip(advanceMonth(g))).toEqual(strip(weeks));
  });

  it("stays the same after a year of months vs weeks", () => {
    let a = busyGame();
    let b = a;
    for (let m = 0; m < 12; m++) a = advanceMonth(a);
    for (let w = 0; w < 48; w++) b = advanceWeek(b);
    expect(strip(a)).toEqual(strip(b));
  });

  it("refills AP and moves the week on", () => {
    const g = busyGame();
    expect(g.me.ap).toBeLessThan(g.me.apMax);
    const n = advanceWeek(g);
    expect(n.week).toBe(1);
    expect(n.me.ap).toBe(n.me.apMax);
    expect(n.history.at(-1)!.week).toBe(1);
  });

  it("buzz fades but service stays", () => {
    let g = busyGame();
    const i = seat("P.044");
    const buzz = g.me.buzz[i];
    const service = g.me.service[seat("P.015")];
    for (let w = 0; w < 10; w++) g = advanceWeek(g);
    expect(g.me.buzz[i]).toBeLessThan(buzz * 0.65);
    expect(g.me.service[seat("P.015")]).toBeGreaterThan(service * 0.95);
  });

  it("a starting game projects exactly the GE15 seats", () => {
    const g = newGame("PH", 1);
    expect(projectedSeats(g)).toBe(SEATS.filter((s) => s.ge15Coalition === "PH").length);
  });
});

describe("actions", () => {
  it("charge AP and money, and refuse when you can't afford them", () => {
    const g = newGame("MUDA", 3);
    const r = applyAction(g, "service", { kind: "seat", seat: seat("P.146") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me.ap).toBe(g.me.ap - 1);
    expect(r.state.me.funds).toBe(g.me.funds - 150_000);
    expect(applyAction(g, "media", { kind: "none" }).ok).toBe(true);
    const poor = { ...g, me: { ...g.me, funds: 10 } };
    expect(applyAction(poor, "media", { kind: "none" }).ok).toBe(false);
  });

  it("respect government / opposition", () => {
    expect(applyAction(newGame("PN", 1), "announce", { kind: "none" }).ok).toBe(false);
    expect(applyAction(newGame("PH", 1), "questions", { kind: "none" }).ok).toBe(false);
  });

  it("refuse seats your coalition doesn't contest", () => {
    expect(applyAction(newGame("GPS", 1), "ceramah", { kind: "seat", seat: seat("P.105") }).ok).toBe(false);
  });

  it("preview a positive share change for a ceramah in a marginal seat", () => {
    const p = previewAction(newGame("PN", 1), "ceramah", { kind: "seat", seat: seat("P.107") })!;
    expect(p.share).toBeGreaterThan(0);
  });

  it("enough work flips a marginal seat", () => {
    let g = newGame("PN", 1);
    const i = seat("P.107"); // Sungai Buloh, narrow PKR seat
    for (let w = 0; w < 6 && g.holders[i] !== "PN"; w++) {
      for (const id of ["service", "machinery", "ceramah"]) {
        const r = applyAction(g, id, { kind: "seat", seat: i });
        if (r.ok) g = r.state;
      }
    }
    const p = previewAction(g, "walkabout", { kind: "seat", seat: i });
    expect(p).not.toBeNull();
    expect(projectedSeats(g)).toBeGreaterThan(projectedSeats(newGame("PN", 1)));
  });
});

describe("business empire", () => {
  it("assets pay weekly income and can be upgraded, tapped and sold", () => {
    let g = newGame("BN", 9);
    let r = buyAsset(g, "property", "pro");
    expect(r.ok).toBe(true);
    g = (r as { state: GameState }).state;
    const next = advanceWeek(g);
    expect(next.report!.income.some((l) => l.label.startsWith("Property") && l.amount > 0)).toBe(true);
    r = upgradeAsset(g, "property");
    expect(r.ok && r.state.me.assets[0].level).toBe(2);
    r = tapAsset(g, "property");
    expect(r.ok && r.state.me.risk).toBeGreaterThan(g.me.risk);
    expect(tapAsset((r as { state: GameState }).state, "property").ok).toBe(false);
    r = sellAsset(g, "property");
    expect(r.ok && r.state.me.assets.length).toBe(0);
  });

  it("crony-run construction raises MACC risk week after week", () => {
    let g = newGame("PH", 5);
    g = (buyAsset(g, "construction", "crony") as { state: GameState }).state;
    const start = g.me.risk;
    for (let w = 0; w < 8; w++) g = advanceWeek(g);
    expect(g.me.risk).toBeGreaterThan(start);
  });

  it("newspapers raise media reach", () => {
    const g = newGame("PN", 1);
    const r = buyAsset(g, "newspaper", "pro");
    expect(r.ok && r.state.me.reach).toBeGreaterThan(g.me.reach);
  });
});
