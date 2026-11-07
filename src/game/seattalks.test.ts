import { describe, expect, it } from "vitest";
import { newGame, projectAllFor, type GameState } from "./state";
import { moveParty } from "./systems/coalitions";
import { partySeats } from "./systems/nominations";
import { pactSeats } from "./systems/pacts";
import { TALKS, claimSeat, concedeSeat, talkSeats } from "./systems/seattalks";
import { choosePm, formCabinet, youArePm } from "./systems/people";
import { SEATS, contestingIn } from "./world";

const shares = (g: GameState) => {
  const proj = projectAllFor(g);
  return (i: number) => proj[i].shares;
};

describe("seat talks", () => {
  it("a party joining your coalition keeps only the seats it holds", () => {
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    const before = partySeats(g).length;
    const next = moveParty(g, "PKR", "MUDA");
    const pkrHeld = SEATS.filter((s) => s.ge15Party === "PKR").length;
    const carried = SEATS.filter((s) => next.seatParty[s.index]?.MUDA === "PKR").length;
    expect(carried).toBe(pkrHeld);
    // Your own party now stands in the PKR seats it doesn't hold.
    expect(partySeats(next).length).toBeGreaterThan(before);
  });

  it("a small party in a pact is not forced aside almost everywhere", () => {
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    const split = pactSeats(g, "PH");
    const shared = Object.keys(split).length;
    const mine = Object.values(split).filter((c) => c === "PH").length; // PH stands aside: you stand
    expect(shared).toBeGreaterThan(5);
    expect(mine).toBeGreaterThanOrEqual(1);
    // Seats you hold stay yours.
    for (const s of SEATS) if (g.holders[s.index] === "MUDA" && split[s.index]) expect(split[s.index]).toBe("PH");
  });

  it("nominations skip seats where you stand aside", () => {
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    const seats = pactSeats(g, "PH");
    const withPact: GameState = { ...g, pacts: [{ with: "PH", since: 0, seats, goodwill: TALKS.goodwill }] };
    const aside = Object.keys(seats).map(Number).filter((i) => seats[i] === "MUDA");
    const listed = new Set(partySeats(withPact));
    for (const i of aside) expect(listed.has(i)).toBe(false);
  });

  it("claiming costs goodwill, conceding earns it, and a partner refuses once goodwill runs out", () => {
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    let s: GameState = { ...g, pacts: [{ with: "PH", since: 0, seats: pactSeats(g, "PH"), goodwill: TALKS.goodwill }] };
    const rows = talkSeats(s, shares(s));
    const theirs = rows.filter((r) => r.standing === "them");
    const r1 = claimSeat(s, theirs[0]);
    if ("error" in r1) throw new Error(r1.error);
    expect(r1.state.pacts[0].goodwill!).toBeLessThan(TALKS.goodwill);
    expect(r1.state.pacts[0].seats[theirs[0].seat]).toBe("PH");
    s = r1.state;
    const mine = talkSeats(s, shares(s)).filter((r) => r.standing === "you");
    const r2 = concedeSeat(s, mine[0]);
    if ("error" in r2) throw new Error(r2.error);
    expect(r2.state.pacts[0].goodwill!).toBeGreaterThan(s.pacts[0].goodwill!);
    // Keep claiming until they say no.
    let t = r2.state;
    let refused = false;
    for (const r of talkSeats(t, shares(t)).filter((x) => x.standing === "them")) {
      const res = claimSeat(t, r);
      if ("error" in res) {
        refused = true;
        break;
      }
      t = res.state;
    }
    expect(refused).toBe(true);
  });
});

describe("who becomes Prime Minister", () => {
  it("the biggest party in your coalition provides the PM", () => {
    let g = newGame("MUDA", 3, { name: "Adam Rahman" });
    g = moveParty(g, "PKR", "MUDA");
    // Your coalition governs, and PKR (31 seats) out-won MUDA.
    g = { ...g, parliament: { ...g.parliament, pm: "MUDA" }, government: ["MUDA"] };
    const pm = choosePm(g, "MUDA")!;
    expect(pm.party).toBe("PKR");
    const cabinet = formCabinet(g);
    expect(cabinet.pm).not.toBe(g.youId);
    expect(cabinet.dpm).toBe(g.youId);
    expect(youArePm({ ...g, cabinet })).toBe(false);
  });

  it("you lead the government when your party is the biggest, but only if you won your seat", () => {
    const g = newGame("PH", 3, { name: "Adam Rahman" });
    // Give all of PH's seats to PKR (your party).
    const holderParties = g.holderParties.map((p, i) => (g.holders[i] === "PH" ? "PKR" : p));
    const you = g.people.find((p) => p.id === g.youId)!;
    const s = { ...g, holderParties };
    expect(choosePm(s, "PH")?.id).toBe(you.id);
    const unseated = { ...s, people: s.people.map((p) => (p.id === you.id ? { ...p, seat: null } : p)) };
    expect(choosePm(unseated, "PH")?.id).not.toBe(you.id);
  });

  it("every seat in talks is one your coalition contests", () => {
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    const moved = moveParty(g, "PKR", "MUDA");
    const s: GameState = { ...moved, pacts: [{ with: "PN", since: 0, seats: pactSeats(moved, "PN"), goodwill: TALKS.goodwill }] };
    const rows = talkSeats(s, shares(s));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(contestingIn(SEATS[r.seat], s.entries)).toContain("MUDA");
  });
});

describe("campaigning with allies", () => {
  it("in a seat you give your partner, you campaign for their candidate, not your own", async () => {
    const { applyAction } = await import("./actions");
    const { allyIn } = await import("./actions");
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    const seats = pactSeats(g, "PH");
    const s: GameState = { ...g, me: { ...g.me, ap: 20, funds: 5_000_000 }, pacts: [{ with: "PH", since: 0, seats, goodwill: TALKS.goodwill }] };
    const aside = Number(Object.keys(seats).find((k) => seats[Number(k)] === "MUDA"));
    expect(allyIn(s, aside)).toBe("PH");
    expect(applyAction(s, "ceramah", { kind: "seat", seat: aside }).ok).toBe(false);
    const r = applyAction(s, "ally", { kind: "seat", seat: aside });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.rivals.PH!.buzz[aside]).toBeGreaterThan(s.rivals.PH!.buzz[aside]);
      expect(r.state.pacts[0].joint).toBe(1);
    }
  });

  it("a pact partner never counter-campaigns against you, and helps in your close seats", async () => {
    const { battlegroundsWeek } = await import("./systems/scorecard");
    const { alliesWeek } = await import("./systems/pacts");
    const g = newGame("MUDA", 3, { name: "Adam Rahman" });
    const seats = pactSeats(g, "PH");
    const phSeat = g.holders.findIndex((h) => h === "PH");
    const work = g.seatWork.map((w, i) => (i === phSeat ? 20 : w));
    const s: GameState = { ...g, seatWork: work, pacts: [{ with: "PH", since: 0, seats, goodwill: 80 }] };
    expect(battlegroundsWeek(s).state.battlegrounds[phSeat]).toBeUndefined();
    const proj = projectAllFor(s);
    const mine = Object.keys(seats).map(Number).filter((i) => seats[i] === "PH");
    // Pretend every seat they gave you is a coin flip.
    const close = proj.map((p, i) => (mine.includes(i) ? { ...p, leader: "MUDA" as const, margin: 0.01 } : p));
    const r = alliesWeek({ ...s, parliament: { ...s.parliament, status: "campaign" } }, close);
    expect(r.lines.length).toBe(1);
    expect(mine.some((i) => r.state.me.buzz[i] > s.me.buzz[i])).toBe(true);
  });
});

describe("your own seat", () => {
  it("a pact never makes you stand aside in your home seat", () => {
    const g = newGame("BERSAMA", 3, { name: "Adam Rahman" });
    const split = pactSeats(g, "PH");
    if (split[g.career.homeSeat] !== undefined) expect(split[g.career.homeSeat]).toBe("PH");
  });
});
