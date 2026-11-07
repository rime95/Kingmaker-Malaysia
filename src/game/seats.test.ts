import { describe, expect, it } from "vitest";
import { migrateGame, newGame, type GameState } from "./state";
import { moveParty, seatCandidate } from "./systems/coalitions";
import { pactSeats } from "./systems/pacts";
import { assignSeat, setOpenContest } from "./systems/partners";
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
});
