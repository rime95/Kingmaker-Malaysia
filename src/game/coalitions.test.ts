import { describe, expect, it } from "vitest";
import { answerCard } from "./actions";
import { newGame, projectAllFor, type GameState } from "./state";
import { COALITION_RULES, PALETTE, aiRebrand, bestHome, coalitionOf, colorDistance, colorFree, coalitionsWeek, moveParty, partyColor, renameCoalition, seatCandidate, syncNames } from "./systems/coalitions";
import { advanceWeek } from "./week";
import { COALITIONS, SEATS, cshort } from "./world";


describe("parties inside coalitions", () => {
  it("starts with the real line-ups, the first party leading", () => {
    const g = newGame("PH", 1);
    expect(g.coalitions.PH.members).toEqual(["PKR", "DAP", "AMANAH", "UPKO"]);
    expect(g.coalitions.PN.members).toEqual(["BERSATU", "PAS", "GERAKAN"]);
    expect(coalitionOf(g, "MCA")).toBe("BN");
    // Every seat holder's party belongs to the holding coalition.
    SEATS.forEach((s) => {
      if (g.holders[s.index] !== "OTHERS") expect(g.coalitions[g.holders[s.index]].members).toContain(g.holderParties[s.index]);
    });
  });

  it("starting colours are clearly different from each other", () => {
    const g = newGame("PH", 1);
    const colors = COALITIONS.map((c) => g.coalitions[c].color);
    for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) expect(colorDistance(colors[i], colors[j])).toBeGreaterThan(0.08);
  });

  it("a party that switches sides takes its MPs and its candidates' personal vote", () => {
    const g = newGame("PH", 2);
    const before = projectAllFor(g);
    const mic = SEATS.filter((s) => g.holderParties[s.index] === "MIC").map((s) => s.index);
    const micStands = SEATS.filter((s) => seatCandidate(g, s, "BN") === "MIC").map((s) => s.index);
    expect(micStands.length).toBeGreaterThan(0);
    const next = moveParty(g, "MIC", "PN");
    expect(next.coalitions.BN.members).not.toContain("MIC");
    expect(next.coalitions.PN.members).toContain("MIC");
    for (const i of mic) expect(next.holders[i]).toBe("PN");
    const after = projectAllFor(next);
    const i = micStands[0];
    expect(seatCandidate(next, SEATS[i], "PN")).toBe("MIC");
    expect(seatCandidate(next, SEATS[i], "BN")).not.toBe("MIC");
    expect(after[i].shares.PN!).toBeGreaterThan(before[i].shares.PN!);
    expect(after[i].shares.BN!).toBeLessThan(before[i].shares.BN!);
  });

  it("unhappy partners in your coalition warn you first, then walk out", () => {
    const g = newGame("BN", 3);
    const warned = coalitionsWeek({ ...g, partySat: { ...g.partySat, MIC: 18 } });
    expect(warned.warn).toBe("MIC");
    const gone = coalitionsWeek({ ...g, partySat: { ...g.partySat, MIC: 2 } });
    expect(gone.state.coalitions.BN.members).not.toContain("MIC");
    expect(gone.lines.some((l) => l.text.includes("walks out"))).toBe(true);
    expect(bestHome(g, "MIC")).toBe("PN");
  });

  it("the walkout card raises or lowers that party's goodwill", () => {
    const g = newGame("BN", 4);
    const withCard: GameState = { ...g, cards: [{ id: 1, kind: "partnerWalkout", week: 0, deadline: 2, party: "MCA" }] };
    const r = answerCard(withCard, 1, 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.partySat.MCA).toBe(Math.min(100, g.partySat.MCA + 25));
  });

  it("a warning becomes a decision card in the weekly turn", () => {
    let g = newGame("BN", 5);
    g = { ...g, week: 3, partySat: { ...g.partySat, MIC: 17 } };
    g = advanceWeek(g);
    expect(g.cards.some((c) => c.kind === "partnerWalkout" && c.party === "MIC")).toBe(true);
    expect(COALITION_RULES.warn).toBeGreaterThan(COALITION_RULES.leave);
  });

  it("partners wear shades of their coalition colour", () => {
    const g = newGame("PH", 1);
    expect(partyColor(g, "PKR")).toBe("var(--c-PH)");
    expect(partyColor(g, "DAP")).toContain("var(--c-PH)");
    expect(partyColor(g, "DAP")).not.toBe(partyColor(g, "AMANAH"));
  });
});

describe("naming coalitions", () => {
  it("you can rename yours, but not to a taken name or a clashing colour", () => {
    const g = newGame("PH", 1);
    const ok = renameCoalition(g, "Harapan Baharu", "HB", "#8b5cf6");
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    syncNames(ok.state);
    expect(cshort("PH")).toBe("HB");
    syncNames(g);
    expect(renameCoalition(g, "Barisan Nasional", "BN2", "#8b5cf6").ok).toBe(false);
    expect(renameCoalition(g, "Something New", "SN", g.coalitions.BN.color).ok).toBe(false);
    expect(colorFree(g, g.coalitions.PH.color, "PH")).toBe(true);
    expect(PALETTE.filter((p) => colorFree(g, p, "PH")).length).toBeGreaterThan(3);
  });

  it("an AI winner sometimes relaunches its coalition with a fresh name and a free colour", () => {
    let renamed = 0;
    for (let seed = 1; seed < 30; seed++) {
      const g = { ...newGame("PH", seed), week: 60 };
      const r = aiRebrand(g, "PN");
      if (r.line) {
        renamed++;
        expect(r.state.coalitions.PN.name).not.toBe("Perikatan Nasional");
        expect(colorFree(r.state, r.state.coalitions.PN.color, "PN")).toBe(true);
      }
      expect(aiRebrand(g, "PH").line).toBeNull();
    }
    expect(renamed).toBeGreaterThan(0);
    expect(renamed).toBeLessThan(29);
  });

  it("winning the premiership asks you to name your coalition", () => {
    let g = newGame("PH", 8, { scenario: "snap" });
    for (let i = 0; i < 10 && !g.formation; i++) g = advanceWeek(g);
    expect(g.formation).not.toBeNull();
    g = advanceWeek(g); // talks resolve
    if (g.parliament.pm === "PH") expect(g.namePending).toBe(true);
    else expect(g.namePending).toBe(false);
  });
});
