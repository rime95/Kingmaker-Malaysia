import { describe, expect, it } from "vitest";
import { appoint, askFavour, meet } from "./actions";
import { advanceMonth } from "./month";
import { newGame, type GameState } from "./state";
import { HIERARCHY_PARTIES, PEOPLE, byId, heir, leave, leaderOfParty, mpOf, seatWinners, slotsFor, syncYou } from "./systems/people";
import { succession } from "./systems/career";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
const strip = (s: GameState) => ({ ...s, report: null });

describe("the people", () => {
  it("every seat has its real GE15 MP, and every party a full leadership", () => {
    const g = newGame("PH", 1);
    for (const s of SEATS) expect(mpOf(g, s.index)).toBeDefined();
    expect(mpOf(g, seat("P.075"))!.name).toBe("Ahmad Zahid Hamidi");
    expect(leaderOfParty(g, "PAS")!.name).toBe("Abdul Hadi Awang");
    for (const party of HIERARCHY_PARTIES) {
      const slots = slotsFor(party);
      for (const rank of [5, 4, 3, 2]) expect(g.people.filter((p) => p.party === party && p.rank === rank).length).toBeGreaterThanOrEqual(slots[rank]);
    }
  });

  it("starts with the real cabinet where it is known", () => {
    const g = newGame("BN", 2);
    expect(byId(g, g.cabinet.pm)!.name).toBe("Anwar Ibrahim");
    expect(byId(g, g.cabinet.dpm)!.name).toBe("Ahmad Zahid Hamidi");
    expect(byId(g, g.cabinet.transport)!.name).toBe("Anthony Loke Siew Fook");
    expect(byId(g, g.cabinet.home)!.seat).toBeNull(); // a senator
    // Every minister comes from a government party.
    for (const id of Object.values(g.cabinet)) expect(g.government.some((c) => g.coalitions[c].members.includes(byId(g, id)!.party))).toBe(true);
  });

  it("in leader mode you are your party's president", () => {
    const g = newGame("PN", 3);
    const you = byId(g, g.youId)!;
    expect(you.name).toBe("Muhyiddin Yassin");
    expect(you.rank).toBe(5);
    expect(heir(g)?.party).toBe("BERSATU");
    expect(g.career.protege).toBe(heir(g)!.name);
  });

  it("when a leader leaves, everyone moves up one rank and a branch chief joins at the bottom", () => {
    const g = newGame("PH", 4);
    const umno = (s: GameState) => s.people.filter((p) => p.party === "UMNO");
    const deputy = umno(g).find((p) => p.rank === 4)!;
    const president = leaderOfParty(g, "UMNO")!;
    const lines: { text: string }[] = [];
    const next = leave({ ...g, people: g.people.map((p) => (p.id === president.id ? { ...p, seat: null } : p)) }, president.id, "resigns", lines);
    expect(leaderOfParty(next, "UMNO")!.id).toBe(deputy.id);
    expect(next.people.some((p) => p.id === president.id)).toBe(false);
    for (const rank of [5, 4, 3, 2]) expect(umno(next).filter((p) => p.rank === rank).length).toBe(umno(g).filter((p) => p.rank === rank).length);
    expect(umno(next).filter((p) => p.rank === 0).length).toBeGreaterThanOrEqual(umno(g).filter((p) => p.rank === 0).length);
    expect(next.people.some((p) => p.party === "UMNO" && p.rank === 0 && !g.people.some((q) => q.id === p.id))).toBe(true);
    expect(lines.some((l) => l.text.includes("becomes President of UMNO"))).toBe(true);
  });

  it("a leader who retires keeps their seat until the election", () => {
    const g = newGame("PH", 5);
    const hadi = leaderOfParty(g, "PAS")!;
    const next = leave(g, hadi.id, "retires", []);
    const after = byId(next, hadi.id)!;
    expect(after.retired).toBe(true);
    expect(after.seat).toBe(hadi.seat);
    expect(leaderOfParty(next, "PAS")!.id).not.toBe(hadi.id);
    // At the election the party fields someone else.
    const won = seatWinners(next, [{ seat: hadi.seat!, party: "PAS" }], []);
    expect(byId(won, hadi.id)).toBeUndefined();
    expect(mpOf(won, hadi.seat!)!.party).toBe("PAS");
  });

  it("a seat that changes hands gets a new MP from the winning party", () => {
    const g = newGame("PH", 6);
    const i = seat("P.105");
    const old = mpOf(g, i)!;
    const next = seatWinners(g, [{ seat: i, party: "BERSATU" }], []);
    expect(mpOf(next, i)!.party).toBe("BERSATU");
    expect(byId(next, old.id)!.seat).toBeNull();
  });

  it("a new generation: your heir becomes you and leaves their old post", () => {
    const g = newGame("PH", 7);
    const h = heir(g)!;
    const next = syncYou({ ...g, career: succession({ ...g.career, protege: h.name }, g.seed, g.week) });
    expect(byId(next, next.youId)!.name).toBe(h.name);
    expect(next.people.filter((p) => p.name === h.name)).toHaveLength(1);
    expect(next.people.filter((p) => p.party === "PKR" && p.rank === h.rank).length).toBe(g.people.filter((p) => p.party === "PKR" && p.rank === h.rank).length);
  });

  it("career mode puts you in the party as a branch chief", () => {
    const g = newGame("PN", 8, { mode: "career", name: "Siti" });
    const you = byId(g, g.youId)!;
    expect(you.name).toBe("Siti");
    expect(you.rank).toBe(0);
    expect(leaderOfParty(g, "BERSATU")!.name).toBe("Muhyiddin Yassin");
  });

  it("meeting raises loyalty; a loyal person does you a favour once in a while", () => {
    const g = newGame("PH", 9);
    const dap = leaderOfParty(g, "DAP")!;
    const r = meet(g, dap.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(byId(r.state, dap.id)!.loyalty).toBeGreaterThan(dap.loyalty);
    expect(r.state.me.ap).toBe(g.me.ap - 1);
    expect(askFavour(g, dap.id).ok).toBe(false);
    const loyal = { ...g, people: g.people.map((p) => (p.id === dap.id ? { ...p, loyalty: 80 } : p)) };
    const f = askFavour(loyal, dap.id);
    expect(f.ok).toBe(true);
    if (!f.ok) return;
    expect(f.state.me.unity).toBeGreaterThan(g.me.unity);
    expect(byId(f.state, dap.id)!.loyalty).toBe(80 - PEOPLE.favourLoyalty);
    expect(askFavour(f.state, dap.id).ok).toBe(false);
  });

  it("only the Prime Minister reshuffles; a sacked minister takes it badly", () => {
    const pm = newGame("PH", 10);
    const old = byId(pm, pm.cabinet.health)!;
    const pick = pm.people.find((p) => p.party === "PKR" && p.rank === 2 && !Object.values(pm.cabinet).includes(p.id))!;
    const r = appoint(pm, "health", pick.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cabinet.health).toBe(pick.id);
    expect(byId(r.state, old.id)!.loyalty).toBeLessThan(old.loyalty);
    expect(appoint(newGame("PN", 10), "health", pick.id).ok).toBe(false);
  });

  it("people age and move up over the years, and Skip 1 Month still equals four weeks", () => {
    let w = newGame("BN", 11);
    for (let i = 0; i < 4; i++) w = advanceWeek(w);
    const m = advanceMonth(newGame("BN", 11));
    expect(strip(m).people).toEqual(strip(w).people);
    let g = newGame("BN", 12);
    for (let i = 0; i < 260; i++) g = advanceWeek(g);
    for (const party of HIERARCHY_PARTIES) expect(leaderOfParty(g, party)).toBeDefined();
    expect(new Set(g.people.filter((p) => p.seat !== null).map((p) => p.seat)).size).toBe(SEATS.length);
  });
});
