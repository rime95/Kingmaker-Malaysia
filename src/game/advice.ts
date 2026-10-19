// The advisor: a short list of what deserves your attention this week, built only from the game's own numbers.
// Seat suggestions are ranked with the same preview the action cards show.

import { previewAction, type Target } from "./actions";
import { MACC } from "./config";
import { projectAllFor, type GameState } from "./state";
import { campaignStates, weeksToElection } from "./systems/assemblies";
import { CONTEST_POINTS, PRESIDENT } from "./systems/career";
import { weeklyCashFlow } from "./week";
import { SEATS, STATE_BY_ID, contestingIn } from "./world";
import { fmtRM } from "./money";

export interface Tip {
  text: string;
  tone: "good" | "bad" | "info";
  /** A one-click action, when the tip has an obvious move. */
  action?: { id: string; target: Target; label: string };
}

export function advise(s: GameState): Tip[] {
  const tips: Tip[] = [];
  const me = s.me;
  const toGo = weeksToElection(s);

  // Money
  const flow = weeklyCashFlow(s);
  const net = flow.income.reduce((a, l) => a + l.amount, 0) - flow.expenses.reduce((a, l) => a + l.amount, 0) - flow.upkeep;
  if (net < 0 && me.funds / -net < 16) tips.push({ text: `Money runs out in about ${Math.max(0, Math.floor(me.funds / -net))} weeks (${fmtRM(net)} a week). Raise funds or sell an asset.`, tone: "bad", action: { id: "dinner", target: { kind: "none" }, label: "Fundraising dinner" } });

  // Risks
  if (me.risk > MACC.threshold) tips.push({ text: `MACC risk is ${Math.round(me.risk)}: a raid could cost 10% of your war chest. Publishing your accounts cuts it.`, tone: "bad", action: { id: "declare", target: { kind: "none" }, label: "Publish accounts" } });
  if (me.trust < 45) tips.push({ text: `Coalition trust is ${Math.round(me.trust)}. Below 40, partners squabble and cost you in every seat.`, tone: "bad", action: { id: "summit", target: { kind: "none" }, label: "Partners' summit" } });
  if (me.unity < 45) tips.push({ text: `Party unity is ${Math.round(me.unity)}: every action works worse, and under 30 a leadership challenge looms.`, tone: "bad", action: { id: "warlords", target: { kind: "none" }, label: "Shore up warlords" } });

  // Timing
  if (s.parliament.status === "campaign") tips.push({ text: `Polling day in ${toGo} week${toGo === 1 ? "" : "s"}. Spend now: ceramah in marginal seats and a national media blitz.`, tone: "info", action: { id: "media", target: { kind: "none" }, label: "Media blitz" } });
  else if (toGo <= 12) tips.push({ text: `About ${toGo} weeks to the general election. Buzz fades 5% a week, so this is the time for rallies and media.`, tone: "info" });
  else tips.push({ text: "Far from the election: build permanent service in marginal seats now; save buzz for the final weeks.", tone: "info" });
  for (const id of campaignStates(s)) {
    const a = s.assemblies[id];
    tips.push({ text: `${STATE_BY_ID[id].name} votes in ${a.pollWeek! - s.week} weeks. Rivals are focusing there.`, tone: "info", action: { id: "tour", target: { kind: "state", state: id }, label: `Tour ${STATE_BY_ID[id].name}` } });
  }

  // Best seats to work this week
  const proj = projectAllFor(s);
  const late = toGo <= 12 || s.parliament.status === "campaign";
  const actionId = late ? "ceramah" : "service";
  const close = SEATS.filter((seat) => contestingIn(seat).includes(s.player))
    .map((seat) => {
      const p = proj[seat.index];
      const mine = p.shares[s.player] ?? 0;
      const other = p.leader === s.player ? (p.runnerUp ? p.shares[p.runnerUp]! : 0) : p.shares[p.leader]!;
      return { i: seat.index, gap: mine - other };
    })
    .filter((x) => Math.abs(x.gap) < 0.06)
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .slice(0, 12);
  const ranked = close
    .map((x) => ({ ...x, p: previewAction(s, actionId, { kind: "seat", seat: x.i }) }))
    .filter((x) => x.p)
    .sort((a, b) => b.p!.seats - a.p!.seats || b.p!.share - a.p!.share)
    .slice(0, 3);
  for (const x of ranked) {
    const seat = SEATS[x.i];
    const where = x.gap >= 0 ? `you lead by ${(x.gap * 100).toFixed(1)} pts` : `you trail by ${(-x.gap * 100).toFixed(1)} pts`;
    tips.push({
      text: `${seat.name}: ${where}. A ${late ? "ceramah" : "service project"} there is worth about ${(x.p!.share * 100).toFixed(2)} pts${x.p!.seats > 0 ? " and flips the seat" : ""}.`,
      tone: x.gap >= 0 ? "info" : "good",
      action: { id: actionId, target: { kind: "seat", seat: x.i }, label: late ? "Ceramah" : "Service" },
    });
  }

  // Career
  const c = s.career;
  if (c.rung < PRESIDENT && isFinite(CONTEST_POINTS[c.rung] ?? Infinity) && c.points >= CONTEST_POINTS[c.rung]) tips.push({ text: "You have the support to contest the next party post at the June AGM.", tone: "good" });
  return tips;
}
