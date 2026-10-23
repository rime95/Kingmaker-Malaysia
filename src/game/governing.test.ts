import { describe, expect, it } from "vitest";
import { adoptPolicy, deepMove } from "./actions";
import { advanceTurn } from "./month";
import { newGame, type GameState } from "./state";
import { agendaWeek, AGENDA } from "./systems/agenda";
import { LEGACY } from "./systems/goals";
import { reportCard } from "./systems/governing";
import { POLICY_BY_ID } from "./systems/policies";
import { caseBlocked } from "./systems/scorecard";
import { advanceWeek } from "./week";

const rich = (s: GameState): GameState => ({ ...s, me: { ...s.me, ap: 60, funds: 80_000_000, capital: 200 } });
const opt = (policy: string, id: string) => POLICY_BY_ID[policy].options.findIndex((o) => o.id === id);

describe("governing well, and being re-elected for it", () => {
  it("your manifesto becomes your government's promises", () => {
    const g = rich(newGame("PH", 1));
    const r = adoptPolicy(g, "cashaid", opt("cashaid", "expand"));
    if (!r.ok) throw new Error(r.error);
    const fresh = agendaWeek({ ...r.state, agenda: null }).state;
    const col = fresh.agenda!.items.find((it) => it.kpi === "col");
    expect(col?.pledge).toBe("Expand cash aid");
    expect(col!.target).toBeLessThan(col!.from);
    expect(fresh.agenda!.items.length).toBeGreaterThanOrEqual(AGENDA.items);
    expect(r.state.policyLog[0]).toMatchObject({ policy: "cashaid", gov: true });
  });

  it("the record goes before the voters when the campaign starts", () => {
    const g = newGame("PH", 2);
    let s = agendaWeek({ ...g, agenda: null }).state;
    // Every promise kept: the numbers moved past every target.
    const nation = { ...s.nation };
    for (const it of s.agenda!.items) (nation as unknown as Record<string, number>)[it.kpi] = it.target + (it.target > it.from ? 1 : -1);
    s = { ...s, nation, week: s.week + 30 };
    expect(reportCard(s)!.kept).toBe(s.agenda!.items.length);
    const before = s.scorecard.now.PH.execution;
    const judged = agendaWeek({ ...s, parliament: { ...s.parliament, status: "campaign" } });
    expect(judged.state.agenda!.judged).toBe(true);
    expect(judged.state.scorecard.now.PH.execution).toBeGreaterThan(before);
    expect(judged.lines.some((l) => l.text.includes("record goes before the voters"))).toBe(true);
  });

  it("a crisis handled badly costs the government Execution", () => {
    const g = newGame("PH", 3);
    const s: GameState = {
      ...g,
      nation: { ...g.nation, approval: 30, crisis: { kind: "pandemic", startWeek: 0, weeksLeft: 1, severity: 1, from: { approval: 55, gdp: 4.4 } } },
    };
    const n = advanceWeek(s);
    expect(n.scorecard.now.PH.execution).toBeLessThan(advanceWeek({ ...s, nation: { ...s.nation, crisis: null } }).scorecard.now.PH.execution);
    expect(n.report!.lines.some((l) => l.text.includes("stumbled through"))).toBe(true);
  });

  it("only a government can defend its record in a debate", () => {
    const campaign = (s: GameState): GameState => rich({ ...s, parliament: { ...s.parliament, status: "campaign" } });
    expect(caseBlocked(campaign(newGame("PN", 4)), { move: "debate", line: "record" })).not.toBeNull();
    expect(caseBlocked(campaign(newGame("PH", 4)), { move: "debate", line: "record" })).toBeNull();
  });

  it("legacy goals count while you are Prime Minister", () => {
    const g = newGame("PH", 5);
    const debt = LEGACY.find((l) => l.id === "debt60")!;
    expect(debt.progress({ ...g, nation: { ...g.nation, debt: 58 } })).toBe(1);
    expect(debt.progress({ ...newGame("PN", 5), nation: { ...g.nation, debt: 58 } })).toBe(0);
  });

  it("the secretary-general spends the AP you leave on the ground campaign", () => {
    const g = rich(newGame("PN", 6));
    const on = deepMove(g, { kind: "autoGround", on: true });
    if (!on.ok) throw new Error(on.error);
    const t = advanceTurn(on.state);
    expect(t.report!.lines.some((l) => l.text.includes("secretary-general"))).toBe(true);
  });
});

describe("who governs matters", () => {
  it("your government delivers; anyone else's drifts into misrule", () => {
    // Same country, same week: PH governs in both. In one PH is you; in the other you're PN, watching.
    let yours = newGame("PH", 8);
    let theirs = newGame("PN", 8);
    for (let w = 0; w < 52; w++) {
      yours = advanceWeek({ ...yours, cards: [] });
      theirs = advanceWeek({ ...theirs, cards: [] });
    }
    expect(yours.nation.approval).toBeGreaterThan(theirs.nation.approval + 5);
    expect(yours.nation.gdp).toBeGreaterThan(theirs.nation.gdp);
    expect(yours.nation.col).toBeLessThan(theirs.nation.col);
  });
});
