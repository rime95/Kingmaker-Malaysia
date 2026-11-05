import { describe, expect, it } from "vitest";
import { migrateGame, newGame, type GameState } from "./state";
import { STRUCTURES } from "./data/structures";
import { appointBlocked, appointToCouncil, councilOf, councilTally, dropBlocked, dropFromCouncil } from "./systems/council";
import { applyPolls, countParty, defaultSlate, openPolls } from "./systems/partypolls";
import { patrons } from "./systems/camps";
import { yourParty } from "./systems/nominations";
import { COUNCIL_CARD } from "./systems/moreCards";

const ok = (r: { state: GameState; message: string } | { error: string }) => {
  if ("error" in r) throw new Error(r.error);
  return r.state;
};
const rich = (g: GameState): GameState => ({ ...g, me: { ...g.me, capital: 200, ap: 50, funds: 50_000_000 } });

describe("the supreme council", () => {
  it("each top party's council follows its own structure", () => {
    const g = newGame("PH", 4);
    for (const [party, st] of Object.entries(STRUCTURES)) {
      const c = councilOf(g, party);
      expect(c.vps.length, party).toBe(st.vps);
      expect(c.elected.length + c.appointed.length, party).toBeGreaterThanOrEqual(st.elected + st.appointed);
      expect(c.elected.length, party).toBe(st.elected);
    }
  });

  it("you appoint into open seats, and drop only those you appointed", () => {
    let g = rich(newGame("PH", 4));
    const party = yourParty(g);
    let c = councilOf(g, party);
    const elected = c.elected[0];
    expect(dropBlocked(g, elected.id)).toMatch(/party polls/);
    const appointee = c.appointed[0];
    const before = appointee.loyalty;
    g = ok(dropFromCouncil(g, appointee.id));
    const dropped = g.people.find((p) => p.id === appointee.id)!;
    expect(dropped.rank).toBe(1);
    expect(dropped.loyalty).toBeLessThan(before);
    expect(dropped.camp).not.toBe(g.youId);
    const mp = g.people.find((p) => p.party === party && p.rank === 1 && !p.retired)!;
    g = ok(appointToCouncil(g, mp.id));
    expect(g.people.find((p) => p.id === mp.id)!.council).toBe("appointed");
    c = councilOf(g, party);
    // Full: another appointment needs someone dropped to make way.
    if (!c.openAppointed) {
      const next = g.people.find((p) => p.party === party && p.rank === 1 && !p.retired && p.id !== mp.id)!;
      expect(appointBlocked(g, next.id)).toMatch(/drop someone/);
      expect(appointBlocked(g, next.id, c.appointed[0].id)).toBeNull();
    }
  });

  it("the meeting card counts the council: without a majority, going against the room costs unity", () => {
    const g = newGame("PH", 4);
    const party = yourParty(g);
    const card = { id: "c", kind: "council", week: g.week, deadline: g.week + 2 } as unknown as Parameters<typeof COUNCIL_CARD.choices>[1];
    const hostile = { ...g, people: g.people.map((p) => (p.party === party && p.id !== g.youId ? { ...p, camp: null, loyalty: 20 } : p)) };
    expect(councilTally(hostile).carries).toBe(false);
    const easy = COUNCIL_CARD.choices({ ...g, people: g.people.map((p) => (p.party === party ? { ...p, loyalty: 90 } : p)) }, card);
    const hard = COUNCIL_CARD.choices(hostile, card);
    const i = COUNCIL_CARD.defaultChoice === 0 ? 1 : 0;
    expect(hard[i].effect.unity ?? 0).toBeLessThan(easy[i].effect.unity ?? 0);
  });

  it("party polls: a slate with most of the divisions behind it takes most posts; losers drop back", () => {
    const g = rich(newGame("PH", 4));
    const party = yourParty(g);
    // Your camp holds every division.
    const chiefs = new Set(Object.values(g.divisions));
    const loyal = { ...g, people: g.people.map((p) => (chiefs.has(p.id) && p.id !== g.youId ? { ...p, camp: g.youId, loyalty: 70 } : p)) };
    const opened = openPolls(loyal);
    const slate = defaultSlate(opened);
    const res = countParty(opened, party, slate, 30, g.youId);
    const onSlate = res.filter((r) => r.slate);
    expect(onSlate.filter((r) => r.won).length).toBeGreaterThanOrEqual(Math.ceil(onSlate.length * 0.6));
    // A rival camp that holds every division instead takes seats from you.
    const rival = patrons(g, party).find((p) => p.id !== g.youId)!;
    const theirs = { ...g, people: g.people.map((p) => (chiefs.has(p.id) && p.id !== g.youId ? { ...p, camp: rival.id, loyalty: 20 } : p)) };
    const res2 = countParty(openPolls(theirs), party, defaultSlate(theirs), 0, g.youId);
    expect(res2.filter((r) => r.won && r.slate).length).toBeLessThan(onSlate.filter((r) => r.won).length);
    // Applying: winners hold their posts; incumbents who lost drop to the ranks.
    const after = applyPolls(theirs, party, res2);
    for (const r of res2.filter((x) => x.won)) expect(after.people.find((p) => p.id === r.id)!.rank).toBe(r.post === "deputy" ? 4 : r.post === "vp" ? 3 : 2);
    for (const r of res2.filter((x) => !x.won && x.incumbent && !res2.some((y) => y.won && y.id === x.id))) expect(after.people.find((p) => p.id === r.id)!.rank).toBe(1);
  });

  it("old saves grow their councils to size", () => {
    const g = newGame("PH", 4);
    // A save from before version 26: councils of six.
    const party = "UMNO";
    const trimmed = { ...g, version: 25, people: g.people.map((p) => (p.party === party && p.rank === 2 && councilOf(g, party).appointed.some((x) => x.id === p.id) ? { ...p, rank: 1, council: undefined } : p)) } as GameState & { version: number };
    const m = migrateGame(trimmed);
    const c = councilOf(m, party);
    expect(c.elected.length + c.appointed.length).toBeGreaterThanOrEqual(STRUCTURES.UMNO.elected + STRUCTURES.UMNO.appointed);
  });
});
