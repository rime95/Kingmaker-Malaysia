import { describe, expect, it } from "vitest";
import { ACTION_BY_ID, BRANCH, actionCost, applyAction, nominateCandidate, unopenedIn } from "./actions";
import { advanceMonth } from "./month";
import { newGame, projectAllFor, type GameState } from "./state";
import { NOMINATION, candidateStrength, partySeats } from "./systems/nominations";
import { byId, leaderOfParty, mpOf } from "./systems/people";
import { CALIBRATION } from "./voter";
import { advanceWeek } from "./week";
import { SEATS, contestingIn } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
const strip = (s: GameState) => ({ ...s, report: null });

/** Advance a snap-election game until nominations are open. */
function toNominations(g: GameState): GameState {
  for (let i = 0; i < 10 && !g.nominations; i++) g = advanceWeek(g);
  return g;
}

describe("opening branches anywhere", () => {
  it("lets you stand in a seat your coalition never contested, and every move works there at once", () => {
    const g = newGame("GRS", 1);
    const i = seat("P.105"); // Petaling Jaya: GRS never stands in Selangor
    expect(contestingIn(SEATS[i], g.entries)).not.toContain("GRS");
    expect(applyAction(g, "ceramah", { kind: "seat", seat: i }).ok).toBe(false);
    const r = applyAction(g, "branch", { kind: "seat", seat: i });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me.funds).toBe(g.me.funds - actionCost(g, ACTION_BY_ID.branch, { kind: "seat", seat: i }));
    expect(BRANCH.cost).toBeGreaterThan(0);
    expect(contestingIn(SEATS[i], r.state.entries)).toContain("GRS");
    expect(projectAllFor(r.state)[i].shares.GRS).toBeGreaterThan(0.02);
    expect(applyAction(r.state, "ceramah", { kind: "seat", seat: i }).ok).toBe(true);
    expect(applyAction(r.state, "branch", { kind: "seat", seat: i }).ok).toBe(false);
  });

  it("ground work grows a new branch", () => {
    const g = newGame("MUDA", 2);
    const i = seat("P.001");
    const r = applyAction(g, "branch", { kind: "seat", seat: i });
    if (!r.ok) throw new Error(r.error);
    let s = r.state;
    const start = projectAllFor(s)[i].shares.MUDA!;
    for (let k = 0; k < 6; k++) {
      s = { ...s, me: { ...s.me, ap: 10, funds: 50_000_000 } };
      const w = applyAction(s, "service", { kind: "seat", seat: i });
      if (w.ok) s = w.state;
    }
    expect(projectAllFor(s)[i].shares.MUDA!).toBeGreaterThan(start);
  });

  it("the party president can launch in a whole state", () => {
    const g = newGame("WARISAN", 3);
    const n = unopenedIn(g, "JHR").length;
    expect(n).toBeGreaterThan(20);
    const r = applyAction({ ...g, me: { ...g.me, funds: 100_000_000 } }, "launchState", { kind: "state", state: "JHR" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(unopenedIn(r.state, "JHR")).toHaveLength(0);
    expect(applyAction(newGame("WARISAN", 3, { mode: "career" }), "launchState", { kind: "state", state: "JHR" }).ok).toBe(false);
  });

  it("GE15 calibration is untouched and AI expansion is rare and repeatable", () => {
    expect(CALIBRATION.length).toBe(SEATS.length);
    let a = newGame("PH", 4);
    let b = newGame("PH", 4);
    for (let k = 0; k < 104; k++) {
      a = advanceWeek(a);
      b = advanceWeek(b);
    }
    expect(a.entries).toEqual(b.entries);
    const opened = Object.values(a.entries).reduce((n, l) => n + l.length, 0);
    expect(opened).toBeLessThan(30);
  });

  it("career mode can start from any seat with a new branch", () => {
    const g = newGame("GPS", 5, { mode: "career", homeSeat: seat("P.105") });
    expect(contestingIn(SEATS[seat("P.105")], g.entries)).toContain("GPS");
  });
});

describe("nomination day", () => {
  it("opens at dissolution with sitting MPs as defaults, and closes two weeks later", () => {
    let g = toNominations(newGame("PH", 6, { scenario: "snap" }));
    expect(g.nominations?.open).toBe(true);
    const opened = g.week;
    const i = seat("P.063"); // Tambun, Anwar's seat
    expect(g.nominations!.picks[i]).toBe(mpOf(g, i)!.id);
    expect(partySeats(g).length).toBeGreaterThan(20);
    while (g.week < opened + NOMINATION.window) g = advanceWeek(g);
    expect(g.nominations?.open).toBe(false);
  });

  it("your pick becomes the MP when the seat is won, and a stronger candidate pulls more votes", () => {
    let g = toNominations(newGame("PH", 7, { scenario: "snap" }));
    const i = seat("P.105");
    const old = mpOf(g, i)!;
    const r = nominateCandidate(g, i, "newface");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    g = r.state;
    const pick = byId(g, g.nominations!.picks[i])!;
    expect(pick.id).not.toBe(old.id);
    expect(candidateStrength(g, i, old)).toBeGreaterThan(candidateStrength(g, i, { ...old, seat: null, influence: 10 }));
    for (let k = 0; k < 10 && g.geCount === 15; k++) g = advanceWeek(g);
    if (g.holders[i] === "PH") expect(mpOf(g, i)!.id).toBe(pick.id);
    expect(byId(g, old.id)!.loyalty).toBeLessThan(old.loyalty);
    expect(g.nominations).toBeNull();
  });

  it("only the president names candidates; in career mode the president needs to trust you", () => {
    const g = toNominations(newGame("PH", 8, { scenario: "snap", mode: "career", homeSeat: seat("P.105") }));
    expect(nominateCandidate(g, seat("P.105"), "newface").ok).toBe(false);
    // Rung 1 (Ketua Bahagian) and a trusting president: you get the seat on nomination day.
    const pres = leaderOfParty(g, "PKR")!;
    let trusted: GameState = { ...g, career: { ...g.career, rung: 1 }, people: g.people.map((p) => (p.id === pres.id ? { ...p, loyalty: 80 } : p)) };
    let distrusted: GameState = { ...g, career: { ...g.career, rung: 1 }, people: g.people.map((p) => (p.id === pres.id ? { ...p, loyalty: 10 } : p)) };
    for (let k = 0; k < NOMINATION.window; k++) {
      trusted = advanceWeek(trusted);
      distrusted = advanceWeek(distrusted);
    }
    expect(trusted.nominations!.picks[seat("P.105")]).toBe(trusted.youId);
    expect(distrusted.nominations!.picks[seat("P.105")]).not.toBe(distrusted.youId);
  });

  it("Skip 1 Month still equals four weeks through nominations", () => {
    const base = newGame("PN", 9, { scenario: "snap" });
    let w = base;
    for (let k = 0; k < 4; k++) w = advanceWeek(w);
    const m = advanceMonth(base);
    expect(strip(m).nominations).toEqual(strip(w).nominations);
    expect(strip(m).entries).toEqual(strip(w).entries);
  });
});
