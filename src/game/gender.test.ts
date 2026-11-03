import { describe, expect, it } from "vitest";
import { GE15_RESULTS } from "./data/ge15";
import { ROSTERS, WOMEN_MPS } from "./data/people";
import { attireOf, isMuslim, isWoman } from "./systems/gender";
import { newGame } from "./state";

const real = (name: string, party = "PKR") => ({ id: 1, name, party, real: true });
const made = (name: string, party = "PKR", id = 7) => ({ id, name, party, real: false });

describe("who is a woman", () => {
  it("every woman on the list is a real GE15 winner or a roster figure", () => {
    const winners = new Set(GE15_RESULTS.map(([, , , c]) => c[0][0]));
    const roster = new Set(Object.values(ROSTERS).flatMap((r) => [r.president, r.deputy, ...(r.vps ?? []), ...(r.council ?? [])].filter(Boolean).map((e) => e![0])));
    for (const n of WOMEN_MPS) expect(winners.has(n) || roster.has(n), n).toBe(true);
  });

  it("knows the real women and men", () => {
    for (const n of ["Hannah Yeoh Tseow Suan", "Azalina Othman Said", "Fadhlina Sidek", "Nancy Shukri", "Amira Aisya Abdul Aziz"]) expect(isWoman(real(n)), n).toBe(true);
    for (const n of ["Anwar Ibrahim", "Ahmad Zahid Hamidi", "Lim Guan Eng", "Suhaili Abdul Rahman", "Muhyiddin Yassin"]) expect(isWoman(real(n)), n).toBe(false);
  });

  it("reads generated names", () => {
    expect(isWoman(made("Nurul Ain binti Rashid"))).toBe(true);
    expect(isWoman(made("Hafiz bin Omar"))).toBe(false);
    expect(isWoman(made("Tan Mei Ling", "DAP"))).toBe(true);
    expect(isWoman(made("Lim Wei Ming", "DAP"))).toBe(false);
    expect(isWoman(made("Priya Muthu", "MIC"))).toBe(true);
    expect(isWoman(made("Sylvia anak Unting", "PBB"))).toBe(true);
    expect(isWoman(made("Jinggut anak Unting", "PBB"))).toBe(false);
  });

  it("dresses people to match", () => {
    expect(attireOf(real("Hannah Yeoh Tseow Suan", "DAP"))).toBe("blazer");
    expect(attireOf(real("Siti Zailah Mohd Yusoff", "PAS"))).toBe("kurung");
    expect(attireOf(real("Azalina Othman Said", "UMNO"))).toBe("blazer");
    expect(["melayu", "suitSongkok"]).toContain(attireOf(real("Abdul Hadi Awang", "PAS")));
    expect(["suit", "batik"]).toContain(attireOf(real("Lim Guan Eng", "DAP")));
    expect(isMuslim(real("Anthony Loke Siew Fook", "DAP"))).toBe(false);
  });

  it("about a quarter to a third of generated recruits are women, and they wear women's clothes", () => {
    const g = newGame("PH", 3);
    const gen = g.people.filter((p) => !p.real && p.id !== g.youId);
    const women = gen.filter(isWoman);
    expect(women.length / gen.length).toBeGreaterThan(0.15);
    expect(women.length / gen.length).toBeLessThan(0.45);
    for (const p of women) expect(["kurung", "blazer"]).toContain(attireOf(p));
    for (const p of gen.filter((x) => !isWoman(x))) expect(["melayu", "suitSongkok", "suit", "batik"]).toContain(attireOf(p));
  });
});
