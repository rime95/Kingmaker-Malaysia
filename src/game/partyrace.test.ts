import { describe, expect, it } from "vitest";
import { answerCard, applyAction, raceAct } from "./actions";
import { weekDate } from "./bases";
import { newGame, type GameState } from "./state";
import { RACE, raceOnOffer, raceOpens, raceOutlook, startRace } from "./systems/partyrace";
import { leaderOfParty, byId } from "./systems/people";
import { advanceWeek } from "./week";

/** Weeks until mid-May (the race opens). */
function toMay(g: GameState): GameState {
  while (!raceOpens(g.week + 1)) g = advanceWeek(g);
  return g;
}

describe("party elections", () => {
  it("offers the right race for your rung", () => {
    const career = newGame("PN", 1, { mode: "career" });
    expect(raceOnOffer(career)).toBeNull();
    expect(raceOnOffer({ ...career, career: { ...career.career, points: 12 } })).toBe("division");
    expect(raceOnOffer({ ...career, career: { ...career.career, rung: 4, points: 90 } })).toBe("vp");
    expect(raceOnOffer({ ...career, career: { ...career.career, rung: 5, points: 140 } })).toBe("president");
    const leader = newGame("PN", 1);
    expect(raceOnOffer(leader)).toBeNull();
    expect(raceOnOffer({ ...leader, career: { ...leader.career, challenge: true } })).toBe("defend");
  });

  it("opens in mid-May, runs four weeks, and the AGM count decides it", () => {
    let g = newGame("PH", 2, { mode: "career", name: "Aisyah" });
    g = { ...g, career: { ...g.career, points: 15 } };
    g = toMay(g);
    g = advanceWeek(g);
    expect(weekDate(g.week).getMonth()).toBe(4);
    const card = g.cards.find((c) => c.kind === "partyRace")!;
    expect(card).toBeDefined();
    const r = answerCard(g, card.id, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    g = r.state;
    expect(g.race?.kind).toBe("division");
    for (let i = 0; i < 3; i++) {
      const m = raceAct(g, "court");
      if (m.ok) g = m.state;
      g = advanceWeek(g);
    }
    g = advanceWeek(g);
    expect(g.race?.result).not.toBeNull();
    const res = g.race!.result!;
    expect(res.tally).toHaveLength(RACE.branches);
    expect(g.career.rung).toBe(res.won ? 1 : 0);
    // No AGM card while you are in a race.
    expect(g.cards.some((c) => c.kind === "agm")).toBe(false);
  });

  it("division chiefs loyal to you bring their delegates", () => {
    const g = newGame("PH", 3, { mode: "career" });
    const base = { ...g, career: { ...g.career, rung: 4, points: 90 } };
    const race = startRace(base, "vp");
    const party = g.coalitions.PH.members[0];
    const set = (loyalty: number): GameState => ({ ...base, race, people: base.people.map((p) => (p.party === party && p.id !== g.youId ? { ...p, loyalty } : p)) });
    expect(raceOutlook(set(90), race)).toBeGreaterThan(raceOutlook(set(10), race) + 0.2);
  });

  it("campaign moves cost what they say and money politics raises MACC risk", () => {
    const g = newGame("PH", 4, { mode: "career" });
    const withRace = { ...g, career: { ...g.career, points: 12 }, race: startRace({ ...g, career: { ...g.career, points: 12 } }, "division") };
    const court = raceAct(withRace, "court");
    expect(court.ok && court.state.race!.effort).toBe(RACE.court.effort);
    const money = raceAct(withRace, "money");
    expect(money.ok && money.state.me.risk).toBeGreaterThan(withRace.me.risk);
    expect(raceAct(g, "court").ok).toBe(false);
  });

  it("losing a leadership challenge hands the presidency to the challenger", () => {
    const g = newGame("BN", 5);
    let state: GameState = { ...g, career: { ...g.career, challenge: true } };
    state = { ...state, race: { ...startRace(state, "defend"), effort: 0, voteWeek: state.week + 1 } };
    const challenger = state.race!.rivals[0];
    // Every division chief hates you.
    state = { ...state, me: { ...state.me, unity: 10 }, people: state.people.map((p) => (p.id === g.youId ? p : { ...p, loyalty: 0 })), race: { ...state.race!, rivals: [{ ...challenger, effort: 200 }] } };
    state = advanceWeek(state);
    expect(state.race?.result?.won).toBe(false);
    expect(state.career.rung).toBe(5);
    expect(byId(state, state.youId)!.rank).toBe(3);
    expect(leaderOfParty(state, "UMNO")!.id).toBe(challenger.id);
  });
});

describe("appointments and roles", () => {
  it("a loyal president appoints you minister once you have earned it", () => {
    let g = newGame("PH", 6, { mode: "career" });
    const pres = leaderOfParty(g, "PKR")!;
    g = { ...g, week: 4, career: { ...g.career, rung: 2, points: 40 }, people: g.people.map((p) => (p.id === pres.id ? { ...p, loyalty: 70 } : p)) };
    g = advanceWeek(g);
    const card = g.cards.find((c) => c.kind === "appointment");
    expect(card).toBeDefined();
    const r = answerCard(g, card!.id, 0);
    expect(r.ok && r.state.career.rung).toBe(3);
  });

  it("each rung has its own moves", () => {
    const g = newGame("PH", 7, { mode: "career" });
    expect(applyAction(g, "membership", { kind: "none" }).ok).toBe(true);
    expect(applyAction(g, "dewanQuestion", { kind: "none" }).ok).toBe(false);
    const mp = { ...g, career: { ...g.career, rung: 2 } };
    const q = applyAction(mp, "dewanQuestion", { kind: "none" });
    expect(q.ok).toBe(true);
    if (q.ok) expect(q.state.career.points).toBe(mp.career.points + 1);
    expect(applyAction({ ...mp, parliament: { ...mp.parliament, status: "campaign" } }, "dewanQuestion", { kind: "none" }).ok).toBe(false);
    expect(applyAction(newGame("PH", 7), "kenduri", { kind: "none" }).ok).toBe(false);
  });
});
