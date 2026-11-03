import { describe, expect, it } from "vitest";
import { newGame, migrateGame, type GameState } from "./state";
import { advanceWeek } from "./week";
import { autoNominate, autoResolveFormation, changeGovernmentMidTerm, goToAgong } from "./actions";
import { autoPick, nominate, partySeats, shortlist } from "./systems/nominations";
import { ROSTERS, ROSTER_HOME } from "./data/people";
import { fillVacantSeats, homeOf, recruitPerson, syncYou } from "./systems/people";
import { chiefKey, holderOf } from "./systems/posts";
import { SEATS, regionOf } from "./world";

const snap = (player: Parameters<typeof newGame>[0], seed: number) => newGame(player, seed, { scenario: "snap" });
function toNominations(g: GameState): GameState {
  for (let i = 0; i < 10 && !g.nominations; i++) g = advanceWeek(g);
  return g;
}

describe("home states", () => {
  it("everyone has a home; real figures without a seat are where they really come from", () => {
    const g = newGame("PH", 4);
    expect(g.people.every((p) => !!p.home)).toBe(true);
    for (const roster of Object.values(ROSTERS))
      for (const e of [roster.president, roster.deputy, ...(roster.vps ?? []), ...(roster.council ?? [])]) {
        if (!e || e[1]) continue;
        const p = g.people.find((x) => x.name === e[0]);
        if (p && ROSTER_HOME[e[0]]) expect(homeOf(p), e[0]).toBe(ROSTER_HOME[e[0]]);
      }
    // MPs are from their seat's state.
    for (const p of g.people.filter((x) => x.seat !== null && x.real).slice(0, 50)) expect(p.home).toBe(regionOf(SEATS[p.seat!].state));
  });

  it("a local recruit is from the seat's state, with a name to match", () => {
    const g = newGame("PH", 4);
    const kuching = SEATS.find((s) => s.state === "SWK")!.index;
    const p = recruitPerson(9999, "PKR", g.seed, g.week, g, kuching);
    expect(p.home).toBe("SWK");
  });

  it("losing a seat doesn't change where you're from", () => {
    const g = newGame("PH", 4);
    const mp = g.people.find((p) => p.seat !== null && p.real)!;
    expect(homeOf({ ...mp, seat: null })).toBe(homeOf(mp));
  });

  it("rival parties' state chiefs are locals whenever the party has a local", () => {
    const g = newGame("PN", 4);
    for (const party of ["UMNO", "PKR", "DAP", "PAS"])
      for (const region of ["SBH", "MLK", "SWK", "KTN"]) {
        const chief = holderOf(g, party, chiefKey(region));
        if (!chief) continue;
        const hasLocal = g.people.some((p) => p.party === party && !p.retired && homeOf(p) === region && p.id !== g.youId && !p.chairman);
        if (hasLocal) expect(homeOf(chief), `${party} ${region}`).toBe(region);
      }
  });

  it("an old save gets homes and local chiefs", () => {
    const g = newGame("PH", 4);
    const old = { ...g, version: 19, people: g.people.map((p) => ({ ...p, home: undefined })) } as GameState;
    const m = migrateGame(old);
    expect(m.people.every((p) => !!p.home)).toBe(true);
  });
});

describe("one MP, one seat", () => {
  it("a party leader stands only in their own home seat, however you auto-pick", () => {
    let g = toNominations(snap("PH", 2));
    expect(g.nominations).not.toBeNull();
    const r = autoNominate(g);
    if (r.ok) g = r.state;
    const mine = Object.entries(g.nominations!.picks).filter(([, v]) => v === g.youId).map(([k]) => Number(k));
    expect(mine.every((k) => k === g.career.homeSeat)).toBe(true);
    for (const seat of partySeats(g).slice(0, 30)) if (seat !== g.career.homeSeat) expect(shortlist(g, seat, 5).some((p) => p.id === g.youId)).toBe(false);
    if (partySeats(g).includes(g.career.homeSeat)) expect(g.nominations!.picks[g.career.homeSeat]).toBe(g.youId);
    const a = autoPick(g);
    if ("state" in a) expect(Object.values(a.state.nominations!.picks).filter((v) => v === g.youId).length).toBeLessThanOrEqual(1);
  }, 30_000);

  it("picking someone already picked elsewhere moves them, and their old seat gets a new name", () => {
    const g = toNominations(snap("PH", 2));
    const seats = partySeats(g).filter((i) => i !== g.career.homeSeat && g.people.find((p) => p.id === g.nominations!.picks[i])?.seat !== i);
    const [a, b] = seats;
    const who = g.nominations!.picks[a];
    const r = nominate(g, b, who);
    if ("error" in r) throw new Error(r.error);
    expect(r.state.nominations!.picks[b]).toBe(who);
    expect(r.state.nominations!.picks[a]).toBeDefined();
    expect(r.state.nominations!.picks[a]).not.toBe(who);
  }, 30_000);

  it("moving you to your home seat hands your old seat to a colleague", () => {
    const g = newGame("PH", 4);
    const you = g.people.find((p) => p.id === g.youId)!;
    const other = SEATS.find((s) => g.holders[s.index] === "PH" && s.index !== g.career.homeSeat && g.holderParties[s.index] === you.party)!.index;
    const displaced = g.people.find((p) => p.seat === other)!;
    // You somehow sit for another seat, and don't hold your own.
    const odd: GameState = { ...g, people: g.people.map((p) => (p.id === you.id ? { ...p, seat: other } : p.id === displaced.id ? { ...p, seat: null } : p)) };
    const s = syncYou(odd);
    expect(s.people.find((p) => p.id === g.youId)!.seat).toBe(g.career.homeSeat);
    expect(s.people.some((p) => p.seat === other)).toBe(true);
    expect(s.people.filter((p) => p.id === g.youId)).toHaveLength(1);
  });

  it("empty seats in an old save get an MP", () => {
    const g = newGame("PH", 4);
    const i = g.people.find((p) => p.seat !== null && p.id !== g.youId)!.seat!;
    const empty = { ...g, people: g.people.map((p) => (p.seat === i ? { ...p, seat: null } : p)) };
    expect(fillVacantSeats(empty).people.some((p) => p.seat === i)).toBe(true);
  });
});

describe("joining a government is your choice", () => {
  it("a fallen government opens talks for a party leader, and doing nothing keeps you out", () => {
    const g = newGame("MUDA", 11);
    const thin: GameState = { ...g, government: ["PH"], nation: { ...g.nation, approval: 30 } };
    const talks = changeGovernmentMidTerm(thin);
    expect(talks.formation?.midTerm).toBe(true);
    expect(talks.government).toEqual(["PH"]);
    const done = autoResolveFormation(talks);
    expect(done.formation).toBeNull();
    expect(done.government).not.toContain("MUDA");
    // Going to the Agong without signing anything also keeps you on the crossbench.
    const r = goToAgong(talks);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.government).not.toContain("MUDA");
  });
});
