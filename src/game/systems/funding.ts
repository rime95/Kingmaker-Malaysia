// How Malaysian politicians pay for it all.
// - You: an MP's salary, plus a minister's or the Prime Minister's, paid into your own pocket every month.
// - Your seats: constituency allocations. Government MPs get about RM 1.3M a year each for local projects; opposition
//   MPs get a fraction, unless their party signs an MoU with the government (full allocations, but a softer opposition:
//   no no-confidence motions and weaker attacks).
// - The party: collections at every ceramah (kutipan derma, strongest for PAS- and DAP-led machines), merchandise and the
//   online shop when the party is in the news, and corporate donors who back likely winners in election season.
// - The dark side: kickbacks on contracts, GLC posts for allies, and "dedak" to buy loyalty. Quick money, real MACC risk.
// Numbers TEMPORARY (salaries are close to the real 2024 figures).

import { fmtRM } from "../money";
import type { GameState, ReportLine } from "../state";
import { mpOf } from "./people";
import { UNDERDOG, underdog } from "./growth";

const W = 12 / 52;

export const PAY = {
  /** Monthly, RM. */
  mp: 16_000,
  minister: 14_900,
  pm: 22_800,
};

export const ALLOC = {
  /** Weekly service an allocation buys in each seat you hold. */
  govService: 0.3,
  oppService: 0.1,
  /** What it's worth (shown in the cash flow), RM a year per seat. */
  govPerYear: 1_300_000,
  oppPerYear: 100_000,
  /** The MoU softens your attacks this much. */
  mouAttack: 0.7,
};

export const COLLECT = {
  /** Per ceramah, RM, scaled by buzz in the seat. */
  base: 4_000,
  /** Coalitions whose machines are famous for passing the bucket. */
  strong: ["PN", "PH"] as string[],
  strongMult: 1.6,
};

export const MERCH = { perMember: 0.015, buzzRef: 50 };
export const DONORS = { perPolledSeat: 2_500, beforeDeadline: 12 };

/** Your monthly pay, by what you hold. */
export function yourPay(s: GameState): { label: string; monthly: number }[] {
  const you = s.youId;
  const rows: { label: string; monthly: number }[] = [];
  const mine = you !== null && s.people.find((p) => p.id === you);
  const isMp = !!mine && mine.seat !== null && mpOf(s, mine.seat)?.id === you;
  if (isMp) rows.push({ label: "MP's salary", monthly: PAY.mp });
  if (s.parliament.pm === s.player && s.career.rung >= 6) rows.push({ label: "Prime Minister's salary", monthly: PAY.pm });
  else if (you !== null && Object.values(s.cabinet).includes(you)) rows.push({ label: "Minister's salary", monthly: PAY.minister });
  return rows;
}

/** Your coalition gets full constituency allocations (government, or an opposition that signed the MoU). */
export const fullAllocations = (s: GameState) => s.government.includes(s.player) || s.funding.mou;

/** Party income lines for the weekly cash flow (added to the existing ones). */
export function partyIncome(s: GameState): { label: string; amount: number }[] {
  const out: { label: string; amount: number }[] = [];
  const merch = Math.round(s.me.members * MERCH.perMember * Math.min(2, s.me.nationalBuzz / MERCH.buzzRef));
  if (merch > 0) out.push({ label: "Merchandise and online shop", amount: merch });
  // A small, noisy party raises money online from its supporters.
  const crowd = Math.round(UNDERDOG.crowdfund * underdog(s.holders.filter((h) => h === s.player).length) * Math.min(1.5, 0.3 + s.me.nationalBuzz / 50));
  if (crowd > 0) out.push({ label: "Online crowdfunding", amount: crowd });
  const poll = s.polls.national[0];
  const season = s.parliament.status === "campaign" || s.parliament.deadlineWeek - s.week <= DONORS.beforeDeadline;
  if (season && poll) {
    const d = Math.round((poll.seats[s.player] ?? 0) * DONORS.perPolledSeat);
    if (d > 0) out.push({ label: "Corporate donors (election season)", amount: d });
  }
  return out;
}

/** What a ceramah collects in a seat. */
export function collection(s: GameState, i: number): number {
  const mult = COLLECT.strong.includes(s.player) ? COLLECT.strongMult : 1;
  return Math.round((COLLECT.base * (0.5 + s.me.buzz[i] / 100) * mult) / 100) * 100;
}

/** Weekly: your pay goes into your own pocket. */
export function fundingWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const monthly = yourPay(s).reduce((a, r) => a + r.monthly, 0);
  if (!monthly) return { state: s, lines: [] };
  return { state: { ...s, personal: { ...s.personal, cash: s.personal.cash + Math.round(monthly * W) } }, lines: [] };
}

/** Sign (or tear up) the allocations MoU with the government. */
export function toggleMou(s: GameState): { state: GameState; message: string } | { error: string } {
  if (s.government.includes(s.player)) return { error: "Only the opposition signs an MoU with the government." };
  if (s.career.rung < 6) return { error: "Only the party president signs it." };
  if (s.funding.mou)
    return {
      state: { ...s, funding: { ...s.funding, mou: false }, me: { ...s.me, nationalBuzz: Math.min(100, s.me.nationalBuzz + 5) } },
      message: "You tear up the MoU. Your MPs lose their allocations; your supporters cheer.",
    };
  return {
    state: { ...s, funding: { ...s.funding, mou: true, mouWeek: s.week }, me: { ...s.me, unity: Math.max(0, s.me.unity - 4), integrity: Math.min(100, s.me.integrity + 2) } },
    message: "You sign the MoU: full allocations for your MPs' constituencies. Hardliners grumble that you've gone soft.",
  };
}

export interface Funding {
  mou: boolean;
  mouWeek: number | null;
}

export const initFunding = (): Funding => ({ mou: false, mouWeek: null });

export const allocationLine = (s: GameState) => {
  const held = s.holders.filter((h) => h === s.player).length;
  const perYear = fullAllocations(s) ? ALLOC.govPerYear : ALLOC.oppPerYear;
  return `Constituency allocations: ${fmtRM(perYear)} a year in each of your ${held} seats, spent on local projects (they build service there).`;
};
