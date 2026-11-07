import { describe, expect, it } from "vitest";
import { migrateGame, newGame, type GameState } from "./state";
import { moveParty, seatCandidate } from "./systems/coalitions";
import { pactSeats } from "./systems/pacts";
import { adunsAfterPolls } from "./systems/aduns";
import { DUNS } from "./systems/dun";
import { assignSeat, bestAllocation, giveState, setOpenContest, settleAllocation, shares, stateSeatsFor } from "./systems/partners";
import { nominationsWeek, partySeats } from "./systems/nominations";
import { TALKS, talkSeats } from "./systems/seattalks";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seatOf = (g: GameState, party: string) => SEATS.find((s) => g.holders[s.index] === g.player && g.holderParties[s.index] === party && s.index !== g.career.homeSeat)!;

describe("your coalition's seats", () => {
  it("you can give your own sitting seat to a partner with no pact, for free", () => {
    const g = moveParty(newGame("PH", 3), "BERSAMA", "PH");
    const lead = g.coalitions.PH.members[0];
    const seat = seatOf(g, lead);
    expect(g.pacts).toHaveLength(0);
    const r = assignSeat(g, seat.index, "DAP");
    if (!("state" in r)) throw new Error(r.error);
    expect(seatCandidate(r.state, seat, "PH")).toBe("DAP");
    expect(r.state.me.ap).toBe(g.me.ap);
    expect(r.state.me.unity).toBe(g.me.unity);
    expect(r.state.me.funds).toBe(g.me.funds);
  });

  it("a seat you stand aside in is the pact's business, not the coalition's", () => {
    const g = newGame("PH", 3);
    const seats = pactSeats(g, "BN");
    const k = Number(Object.keys(seats).find((x) => seats[Number(x)] === "PH"));
    const s: GameState = { ...g, pacts: [{ with: "BN", since: 0, seats, goodwill: TALKS.goodwill }] };
    expect("error" in assignSeat(s, k, "DAP")).toBe(true);
    expect("error" in setOpenContest(s, k, "DAP")).toBe(true);
  });

  it("seat talks are only ever about pacts", () => {
    const g = newGame("PH", 3);
    expect(talkSeats(g, () => ({}))).toHaveLength(0);
  });

  it("a party joining you from a pact coalition leaves you standing against nobody of your own", () => {
    const g = newGame("PH", 3);
    const seats = pactSeats(g, "BN");
    const s: GameState = { ...g, pacts: [{ with: "BN", since: 0, seats, goodwill: TALKS.goodwill }] };
    const heldByMca = SEATS.filter((x) => s.holderParties[x.index] === "MCA").map((x) => x.index);
    expect(heldByMca.some((i) => seats[i] === "PH")).toBe(true);
    const m = moveParty(s, "MCA", "PH");
    for (const i of heldByMca) expect(m.pacts[0].seats[i]).not.toBe("PH");
    expect(Object.keys(m.pacts[0].seats).length).toBeGreaterThan(0);
  });

  it("the old pop-up for coalition seat talks is gone, and a save holding one loads", () => {
    let g: GameState = moveParty(newGame("PH", 3), "BERSAMA", "PH");
    g = { ...g, parliament: { ...g.parliament, status: "campaign", pollWeek: g.week + 3 } };
    const next = advanceWeek(g);
    expect(next.cards.some((c) => c.kind === "seatTalks")).toBe(false);
    const old = JSON.parse(JSON.stringify(g));
    old.cards = [{ id: 1, kind: "seatTalks", week: g.week, deadline: g.week + 4 }];
    expect(migrateGame(old).cards.map((c) => c.kind)).toContain("seatTalks");
  });

  it("a whole state goes to one partner in one move, your own seat excepted", () => {
    const g = newGame("PH", 3);
    const state = SEATS[g.career.homeSeat].state;
    const moving = stateSeatsFor(g, state, "AMANAH");
    expect(moving.length).toBeGreaterThan(0);
    const r = giveState(g, state, "AMANAH");
    if (!("state" in r)) throw new Error(r.error);
    for (const seat of moving) expect(seatCandidate(r.state, seat, "PH")).toBe("AMANAH");
    expect(seatCandidate(r.state, SEATS[g.career.homeSeat], "PH")).toBe(seatCandidate(g, SEATS[g.career.homeSeat], "PH"));
    expect(r.state.me.ap).toBe(g.me.ap);
    expect(shares(r.state).find((x) => x.party === "AMANAH")!.given).toBeGreaterThan(shares(g).find((x) => x.party === "AMANAH")!.given);
    expect("error" in giveState(r.state, state, "AMANAH")).toBe(true);
  });

  it("during nominations your list follows the seats", () => {
    const g0 = newGame("PH", 3);
    const open = nominationsWeek({ ...g0, parliament: { ...g0.parliament, status: "campaign", pollWeek: g0.week + 3 } }).state;
    const lead = open.coalitions.PH.members[0];
    const seat = seatOf(open, lead);
    expect(open.nominations!.picks[seat.index]).toBeDefined();
    const gave = assignSeat(open, seat.index, "DAP");
    if (!("state" in gave)) throw new Error(gave.error);
    expect(gave.state.nominations!.picks[seat.index]).toBeUndefined();
    const back = assignSeat(gave.state, seat.index, lead);
    if (!("state" in back)) throw new Error(back.error);
    expect(back.state.nominations!.picks[seat.index]).toBeDefined();
    expect(partySeats(back.state)).toContain(seat.index);
  });

  it("an open contest stays when best-for-coalition runs, and ends if a party in it leaves", () => {
    const g = newGame("PH", 3);
    const seat = SEATS.find((x) => g.holders[x.index] === "PH" && x.index !== g.career.homeSeat)!;
    const other = g.coalitions.PH.members.find((p) => p !== seatCandidate(g, seat, "PH"))!;
    const r = setOpenContest(g, seat.index, other);
    if (!("state" in r)) throw new Error(r.error);
    const carried = seatCandidate(r.state, seat, "PH");
    const best = bestAllocation(r.state);
    if ("state" in best) expect(seatCandidate(best.state, seat, "PH")).toBe(carried);
    const left = moveParty(r.state, other, "PN");
    expect(left.openSeats[seat.index]).toBeUndefined();
  });

  it("you keep the flag in your own seat in an open contest", () => {
    const g = newGame("PH", 3);
    const home = SEATS[g.career.homeSeat];
    const cur = seatCandidate(g, home, "PH");
    const other = g.coalitions.PH.members.find((p) => p !== cur)!;
    const r = setOpenContest(g, home.index, other);
    if (!("state" in r)) throw new Error(r.error);
    expect(seatCandidate(r.state, home, "PH")).toBe(cur);
  });

  it("moving a parliamentary seat doesn't cost the ADUNs beneath it their seats", () => {
    const g = newGame("PH", 3);
    const d = DUNS.find((x) => g.dunHolders[x.index] === "PH" && g.people.some((p) => p.adun?.dun === x.index && p.party === "DAP"))!;
    const cur = g.people.find((p) => p.adun?.dun === d.index)!;
    const r = assignSeat(g, d.parent, "AMANAH");
    if (!("state" in r)) throw new Error(r.error);
    const after = adunsAfterPolls(r.state, [d.state]);
    const now = after.people.find((p) => p.adun?.dun === d.index)!;
    // Stood down by the 12% roll is the only way out.
    if (now.id !== cur.id) expect(now.party).toBe("AMANAH");
    const stayed = DUNS.filter((x) => x.parent === d.parent).filter((x) => after.people.find((p) => p.adun?.dun === x.index)?.party === g.people.find((p) => p.adun?.dun === x.index)?.party);
    expect(stayed.length).toBeGreaterThan(0);
  });
});

describe("a held registration", () => {
  it("takes the party's seats at nomination day but keeps the pressure on it", () => {
    const g = newGame("PH", 3);
    const s: GameState = { ...g, partnerCtl: { AMANAH: { pressure: 40, used: {}, warnedUntil: 0, cut: false, ros: true, apology: false, obedient: false } } };
    const after = settleAllocation(s).state;
    expect(after.partnerCtl.AMANAH.pressure).toBeGreaterThanOrEqual(40);
    expect(shares(after).find((x) => x.party === "AMANAH")!.given).toBe(0);
  });
});
