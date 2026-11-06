import { afterEach, describe, expect, it } from "vitest";
import { dewanVote } from "./actions";
import { newGame, type GameState } from "./state";
import { COALITION_RULES, coalitionOf, coalitionsWeek, moveParty, seatCandidate } from "./systems/coalitions";
import { RECRUIT, recruitParty, recruitWillingness } from "./systems/growth";
import { asideFor, proposePact } from "./systems/pacts";
import { BULLY, overrideDependence, type Dependence, assignSeat, bestAllocation, bully, bullyBlocked, coalitionSeats, ctlOf, dependence, forgive, partnerSeatEffects, partnersAfterElection, partnersOf, partnersWeek, setOpenContest, settleAllocation, shares, signRivalPacts, tame } from "./systems/partners";
import { SEATS } from "./world";

/** You as PH's leader. */
const lead = (): GameState => {
  const g = newGame("PH", 1);
  return { ...g, career: { ...g.career, rung: 7 }, me: { ...g.me, capital: 100, ap: 16, funds: 100_000_000 } };
};
/** Fix a party's dependence for this test. */
const force = (g: GameState, party: string, d: Partial<Dependence>) => {
  overrideDependence((p) => (p === party ? d : null));
  return g;
};
afterEach(() => overrideDependence(null));

describe("coalition seat board", () => {
  it("the leader gives any seat to any party in the coalition, free", () => {
    const g = lead();
    const seat = coalitionSeats(g).find((x) => seatCandidate(g, x, g.player) === "PKR" && x.index !== g.career.homeSeat)!;
    const r = assignSeat(g, seat.index, "AMANAH");
    expect("state" in r).toBe(true);
    if (!("state" in r)) return;
    expect(seatCandidate(r.state, seat, g.player)).toBe("AMANAH");
    expect(r.state.me.capital).toBe(g.me.capital);
    expect(r.state.partySat).toEqual(g.partySat);
    expect("error" in assignSeat(g, seat.index, "UMNO")).toBe(true);
  });

  it("every partner shows a fair share, and shortchanging is capped and only felt at nominations", () => {
    const g = lead();
    expect(shares(g).every((r) => r.fair >= r.held)).toBe(true);
    let state = g;
    for (const seat of coalitionSeats(g)) if (seatCandidate(state, seat, g.player) === "DAP") state = (assignSeat(state, seat.index, "PKR") as { state: GameState }).state;
    expect(state.partySat.DAP).toBe(g.partySat.DAP);
    const r = settleAllocation(state);
    expect(r.state.partySat.DAP).toBe(Math.max(0, g.partySat.DAP + BULLY.underCap));
    expect(ctlOf(r.state, "DAP").pressure).toBeGreaterThan(0);
  });

  it("best for the coalition suits parties to their voters", () => {
    const g = lead();
    const r = bestAllocation(g);
    const state = "state" in r ? r.state : g;
    const given = (x: GameState, party: string) => shares(x).find((r) => r.party === party)!.given;
    expect(given(state, "PKR")).toBeGreaterThan(given(g, "PKR") - 15); // Your own party keeps its seats.
    const chinese = coalitionSeats(state).filter((s) => s.demo.ethnic.chinese > 0.6 && s.index !== g.career.homeSeat && g.holderParties[s.index] === "DAP");
    expect(chinese.filter((s) => seatCandidate(state, s, g.player) === "DAP").length).toBe(chinese.length);
  });

  it("an open contest costs votes there, and both parties count the seat", () => {
    const g = lead();
    const seat = coalitionSeats(g).find((x) => seatCandidate(g, x, g.player) === "PKR" && x.index !== g.career.homeSeat)!;
    const before = shares(g).find((x) => x.party === "AMANAH")!.given;
    const r = setOpenContest(g, seat.index, "AMANAH");
    expect("state" in r).toBe(true);
    if (!("state" in r)) return;
    expect(partnerSeatEffects(r.state).get(seat.index)).toBeLessThan(0);
    expect(shares(r.state).find((x) => x.party === "AMANAH")!.given).toBeGreaterThanOrEqual(before + 1);
  });
});

describe("leverage", () => {
  it("a dependent partner stays however unhappy; one that can survive walks", () => {
    const g = { ...lead(), week: 40, partySat: { ...lead().partySat, UPKO: 5 } };
    const stuck = coalitionsWeek(force(g, "UPKO", { dependent: true, withYou: 3, alone: 0 }));
    expect(coalitionOf(stuck.state, "UPKO")).toBe("PH");
    expect(stuck.lines.some((l) => l.text.includes("It stays"))).toBe(true);
    const free = coalitionsWeek(force(g, "UPKO", { dependent: false, withYou: 3, alone: 3 }));
    expect(coalitionOf(free.state, "UPKO")).not.toBe("PH");
  });

  it("satisfaction in government settles near 65", () => {
    let g: GameState = { ...lead(), government: ["PH"], partySat: { ...lead().partySat, DAP: 55 } };
    for (let i = 1; i < 120; i++) g = coalitionsWeek({ ...g, week: i * 4 }).state;
    expect(COALITION_RULES.govPerMonth).toBe(1);
    expect(g.partySat.DAP).toBeGreaterThan(55);
    expect(g.partySat.DAP).toBeLessThan(80);
  });

  it("bullying is free, works only on dependent partners and only once in 26 weeks", () => {
    const g = force(lead(), "AMANAH", { dependent: true, withYou: 5, alone: 0 });
    const r = bully(g, "AMANAH", "warn");
    expect("state" in r).toBe(true);
    if (!("state" in r)) return;
    expect(r.state.me.capital).toBe(g.me.capital);
    expect(r.state.me.funds).toBe(g.me.funds);
    expect(r.state.me.ap).toBe(g.me.ap);
    expect(r.state.partySat).toEqual(g.partySat);
    expect(tame(r.state, "AMANAH")).toBe(true);
    expect(bullyBlocked(force(r.state, "AMANAH", { dependent: true }), "AMANAH", "warn")).toMatch(/recently/);
    const later = force({ ...r.state, week: r.state.week + BULLY.cooldown }, "AMANAH", { dependent: true });
    expect(bullyBlocked(later, "AMANAH", "warn")).toBeNull();
    expect(bullyBlocked(force(g, "AMANAH", { dependent: false }), "AMANAH", "warn")).toMatch(/doesn't need you/);
  });

  it("expelling a partner takes its seats away from the coalition and leaves it weaker", () => {
    const g = force(lead(), "AMANAH", { dependent: true, withYou: 5, alone: 0, home: "OTHERS" });
    const r = bully(g, "AMANAH", "expel");
    expect("state" in r).toBe(true);
    if (!("state" in r)) return;
    expect(coalitionOf(r.state, "AMANAH")).toBe("OTHERS");
    expect(partnersOf(r.state)).not.toContain("AMANAH");
    expect(r.state.me.capital).toBe(g.me.capital);
  });

  it("poaching and merging bring MPs into your party", () => {
    const g = force(lead(), "AMANAH", { dependent: true, heavy: true, withYou: 5, alone: 0 });
    const before = g.holderParties.filter((p) => p === "AMANAH").length;
    const p = bully(g, "AMANAH", "poach");
    expect("state" in p && p.state.holderParties.filter((x) => x === "AMANAH").length).toBeLessThan(before);
    const m = bully(g, "AMANAH", "merge");
    expect("state" in m).toBe(true);
    if (!("state" in m)) return;
    expect(m.state.holderParties).not.toContain("AMANAH");
    expect(m.state.coalitions.PH.members).not.toContain("AMANAH");
    expect(m.state.people.some((x) => x.party === "AMANAH")).toBe(false);
  });

  it("a rebel you back takes over their party", () => {
    const g = force(lead(), "AMANAH", { dependent: true });
    const r = bully(g, "AMANAH", "rebel");
    if (!("state" in r)) throw new Error("blocked");
    const old = g.people.find((p) => p.party === "AMANAH" && p.rank === 5)?.id;
    const after = partnersWeek({ ...r.state, week: r.state.week + BULLY.rebelWeeks });
    expect(after.state.people.find((p) => p.party === "AMANAH" && p.rank === 5)?.id).not.toBe(old);
    expect(after.lines.some((l) => l.text.includes("challenger"))).toBe(true);
  });

  it("full pressure brings an apology, and a forgiven partner is obedient until the election", () => {
    const g = { ...lead(), partnerCtl: { AMANAH: { ...ctlOf(lead(), "AMANAH"), pressure: 100, since: 0, cut: true } }, week: 20 };
    expect("error" in forgive(g, "AMANAH")).toBe(true);
    const a = partnersWeek(g);
    expect(ctlOf(a.state, "AMANAH").apology).toBe(true);
    expect(a.lines.some((l) => l.text.includes("apologise"))).toBe(true);
    const f = forgive(a.state, "AMANAH");
    if (!("state" in f)) throw new Error("not forgiven");
    expect(ctlOf(f.state, "AMANAH").obedient).toBe(true);
    expect(ctlOf(f.state, "AMANAH").cut).toBe(false);
    const low = { ...f.state, week: 40, partySat: { ...f.state.partySat, AMANAH: 2 }, me: { ...f.state.me, unity: 0 } };
    expect(coalitionOf(coalitionsWeek(force(low, "AMANAH", { dependent: false, alone: 5 })).state, "AMANAH")).toBe("PH");
    expect(dewanVote(low).rebels).toBeLessThanOrEqual(dewanVote({ ...low, partnerCtl: {} }).rebels);
    expect(partnersAfterElection(f.state).partnerCtl.AMANAH.obedient).toBe(false);
  });
});

describe("joining and pacts", () => {
  it("a party on its own isn't charged for merging a coalition", () => {
    const g = lead();
    const opp = { ...g, government: ["PH" as const] };
    expect(recruitWillingness(opp, "WARISAN")).toBeGreaterThanOrEqual(RECRUIT.threshold - 0.1);
  });

  it("a refusal costs only the AP", () => {
    const g = lead();
    const r = recruitParty(g, "PAS");
    if (!("state" in r)) throw new Error("blocked");
    expect(r.message).toMatch(/turns you down/);
    expect(r.state.me.capital).toBe(g.me.capital);
    expect(r.state.me.funds).toBe(g.me.funds);
    expect(r.state.me.ap).toBe(g.me.ap - RECRUIT.ap);
  });

  it("a pact with a coalition that merges into yours ends", () => {
    const g = lead();
    const p = proposePact(g, "MUDA");
    const withPact = "state" in p && p.state.pacts.length ? p.state : { ...g, pacts: [{ with: "MUDA" as const, since: 0, seats: { [SEATS[0].index]: g.player } }] };
    const merged = moveParty(withPact, "MUDA", g.player);
    expect(merged.pacts.some((x) => x.with === "MUDA")).toBe(false);
  });

  it("rival coalitions sign pacts when an election is called, and their voters follow", () => {
    const g = { ...newGame("PN", 1), week: 60 };
    const r = signRivalPacts(g);
    expect(r.state.rivalPacts.length).toBeGreaterThan(0);
    const pact = r.state.rivalPacts[0];
    expect(Object.keys(pact.seats).length).toBeGreaterThan(0);
    expect(Object.keys(asideFor(r.state)).length).toBeGreaterThan(0);
    expect(r.lines[0].text).toMatch(/seat pact/);
  });

  it("your dependence numbers come from the projection", () => {
    const g = lead();
    const d = dependence(g, "AMANAH");
    expect(d.withYou).toBeGreaterThanOrEqual(0);
    expect(typeof d.dependent).toBe("boolean");
  });
});
