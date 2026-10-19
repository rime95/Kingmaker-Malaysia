// Every player decision, as pure functions: (state, target) → new state + a message.
// Actions cost Action Points (AP) and money. Business decisions cost money only.

import { ECONOMY } from "./config";
import { BUDGET, BUDGET_LINES, budgetEnvelope } from "./systems/budget";
import { resolveCard } from "./systems/events";
import { MULTIRACIAL, PLEDGE_WEIGHT, POLICY_BY_ID, POLICY_COST, UNFUNDED_INTEGRITY_PER_FISCAL } from "./systems/policies";
import { addSeg, type SegEffects } from "./systems/segments";
import { fmtRM } from "./money";
import { isGovernment, projectAllFor, weekDate, type GameState, type Player } from "./state";
import { ASSETS, MAX_LEVEL, assetIncome, newAsset, saleValue, upgradeCost, type AssetType, type CeoKind } from "./systems/business";
import { COALITION_INFO, MAJORITY, SEATS, STATE_BY_ID, contestingIn } from "./world";

export type Target = { kind: "none" } | { kind: "seat"; seat: number } | { kind: "state"; state: string };
export type ActionGroup = "local" | "national" | "party" | "finance";

export interface ActionDef {
  id: string;
  name: string;
  group: ActionGroup;
  target: Target["kind"];
  ap: number;
  only?: "gov" | "opp";
  blurb: string;
  cost: (s: GameState, t: Target) => number;
  /** Changes the player's stats; returns the result message. Costs are charged by applyAction. */
  run: (me: Player, s: GameState, t: Target) => string;
  /** Extra reason the action can't be taken here. */
  blocked?: (s: GameState, t: Target) => string | null;
}

export type ActionResult = { ok: true; state: GameState; message: string } | { ok: false; error: string };

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
/** Buzz has diminishing returns: the louder a seat already is, the less each event adds. */
const addBuzz = (b: number, gain: number) => clamp(b + gain * (1 - b / 120));
/** Party unity makes everything work better or worse. */
const eff = (me: Player) => 0.6 + me.unity / 250;
const reachMult = (me: Player) => 0.5 + me.reach / 100;
const hasAsset = (me: Player, type: AssetType) => me.assets.some((a) => a.type === type);
const seatOf = (t: Target) => (t.kind === "seat" ? SEATS[t.seat] : null);
const notContesting = (s: GameState, t: Target) => {
  const seat = seatOf(t);
  return seat && !contestingIn(seat).includes(s.player) ? "Your coalition does not contest this seat." : null;
};

export const ACTIONS: ActionDef[] = [
  // Local: one seat
  {
    id: "ceramah",
    name: "Ceramah",
    group: "local",
    target: "seat",
    ap: 2,
    blurb: "An evening rally in the seat. Big buzz that fades about 5% a week.",
    cost: () => 30_000,
    blocked: notContesting,
    run: (me, s, t) => {
      const i = (t as { seat: number }).seat;
      me.buzz[i] = addBuzz(me.buzz[i], 18 * eff(me));
      return `Ceramah in ${SEATS[i].name} drew a crowd.`;
    },
  },
  {
    id: "walkabout",
    name: "Walkabout",
    group: "local",
    target: "seat",
    ap: 1,
    blurb: "Pasar malam and kopitiam handshakes. A little buzz and a little service.",
    cost: () => 5_000,
    blocked: notContesting,
    run: (me, s, t) => {
      const i = (t as { seat: number }).seat;
      me.buzz[i] = addBuzz(me.buzz[i], 7 * eff(me));
      me.service[i] = clamp(me.service[i] + 1);
      return `Walkabout in ${SEATS[i].name}.`;
    },
  },
  {
    id: "service",
    name: "Service project",
    group: "local",
    target: "seat",
    ap: 1,
    blurb: "Clinic, road repair or flood relief. Slow, but permanent: this is how seats become fortresses.",
    cost: () => 150_000,
    blocked: notContesting,
    run: (me, s, t) => {
      const i = (t as { seat: number }).seat;
      me.service[i] = clamp(me.service[i] + 6 * eff(me));
      return `Service project delivered in ${SEATS[i].name}.`;
    },
  },
  {
    id: "machinery",
    name: "Build machinery",
    group: "local",
    target: "seat",
    ap: 1,
    blurb: "Branch workers, transport and polling agents. Gets your voters out; costs weekly upkeep.",
    cost: () => 60_000,
    blocked: notContesting,
    run: (me, s, t) => {
      const i = (t as { seat: number }).seat;
      me.machinery[i] = clamp(me.machinery[i] + 10);
      return `Machinery in ${SEATS[i].name} is now ${Math.round(me.machinery[i])}.`;
    },
  },
  {
    id: "handout",
    name: "Cash handout",
    group: "local",
    target: "seat",
    ap: 1,
    blurb: "Fast and expensive. Works in poor rural seats; young urban voters take the money and vote elsewhere. Raises MACC risk.",
    cost: () => 250_000,
    blocked: notContesting,
    run: (me, s, t) => {
      const i = (t as { seat: number }).seat;
      const d = SEATS[i].demo;
      me.buzz[i] = addBuzz(me.buzz[i], 25 * (1 - 0.6 * d.urbanity) * (1 - d.youth) * (0.5 + d.b40));
      me.integrity = clamp(me.integrity - 2);
      me.risk = clamp(me.risk + 4);
      return `Handouts in ${SEATS[i].name}. Not everyone who took the money will vote for you.`;
    },
  },
  // Local: whole state
  {
    id: "tour",
    name: "Ceramah tour",
    group: "local",
    target: "state",
    ap: 3,
    blurb: "A rally in every seat you contest in the state. Cheaper per seat than single ceramah, smaller effect.",
    cost: (s, t) => 20_000 * stateSeats(s, t).length,
    run: (me, s, t) => {
      for (const i of stateSeats(s, t)) me.buzz[i] = addBuzz(me.buzz[i], 8 * eff(me));
      return `Ceramah tour across ${STATE_BY_ID[(t as { state: string }).state].name}.`;
    },
  },
  // National
  {
    id: "media",
    name: "National media blitz",
    group: "national",
    target: "none",
    ap: 2,
    blurb: "TV, newspapers and billboards everywhere. National buzz, boosted by your media reach.",
    cost: () => 500_000,
    run: (me) => {
      me.nationalBuzz = addBuzz(me.nationalBuzz, 12 * reachMult(me) * eff(me));
      return "Your message is on every channel this week.";
    },
  },
  {
    id: "social",
    name: "TikTok & WhatsApp push",
    group: "national",
    target: "none",
    ap: 1,
    blurb: "Cheap national buzz, plus extra buzz in young urban seats. 30% cheaper with a digital agency.",
    cost: (s) => (hasAsset(s.me, "digital") ? 70_000 : 100_000),
    run: (me) => {
      me.nationalBuzz = addBuzz(me.nationalBuzz, 3 * reachMult(me));
      SEATS.forEach((seat, i) => {
        if (seat.demo.urbanity > 0.65) me.buzz[i] = addBuzz(me.buzz[i], 4 * (seat.demo.youth / 0.3));
      });
      return "Your clips are trending with young urban voters.";
    },
  },
  {
    id: "announce",
    name: "Government announcement",
    group: "national",
    target: "none",
    ap: 1,
    only: "gov",
    blurb: "Use the podium of government. Costs political capital instead of money.",
    cost: () => 0,
    blocked: (s) => (s.me.capital < 5 ? "Needs 5 political capital." : null),
    run: (me) => {
      me.capital -= 5;
      me.nationalBuzz = addBuzz(me.nationalBuzz, 8 * reachMult(me));
      return "Ministers announce good news nationwide.";
    },
  },
  {
    id: "questions",
    name: "Grill ministers in the Dewan",
    group: "national",
    target: "none",
    ap: 1,
    only: "opp",
    blurb: "Parliamentary questions that embarrass the government. Builds political capital.",
    cost: () => 0,
    run: (me) => {
      me.capital = clamp(me.capital + 3, 0, 200);
      me.nationalBuzz = addBuzz(me.nationalBuzz, 3 * reachMult(me));
      return "A minister fumbled your question on live TV.";
    },
  },
  // Party
  {
    id: "warlords",
    name: "Shore up the warlords",
    group: "party",
    target: "none",
    ap: 1,
    blurb: "Keep division chiefs happy with posts and projects. Unity makes every action work better.",
    cost: () => 200_000,
    run: (me) => {
      me.unity = clamp(me.unity + 6);
      return `Division chiefs are on side. Unity ${Math.round(me.unity)}.`;
    },
  },
  {
    id: "members",
    name: "Membership drive",
    group: "party",
    target: "none",
    ap: 2,
    blurb: "Sign up new members: more dues every week and a little unity.",
    cost: () => 150_000,
    run: (me) => {
      const gain = Math.round(me.members * 0.02 + 2_000);
      me.members += gain;
      me.unity = clamp(me.unity + 2);
      return `${gain.toLocaleString("en-MY")} new members signed up.`;
    },
  },
  {
    id: "summit",
    name: "Coalition partners' summit",
    group: "party",
    target: "none",
    ap: 1,
    blurb: "Keep partners happy. If trust falls below 40, squabbling costs you everywhere.",
    cost: () => 100_000,
    run: (me) => {
      me.trust = clamp(me.trust + 8);
      return `Partners leave the summit smiling. Trust ${Math.round(me.trust)}.`;
    },
  },
  // Finance
  {
    id: "dinner",
    name: "Fundraising dinner",
    group: "finance",
    target: "none",
    ap: 1,
    blurb: "Clean money, but donors tire of being asked: each dinner raises less until they recover.",
    cost: () => 0,
    run: (me) => {
      const raised = Math.round((200_000 + me.members * 0.1) * (1 - me.fundFatigue));
      me.funds += raised;
      me.fundFatigue = Math.min(0.9, me.fundFatigue + ECONOMY.fatiguePerDinner);
      return `The dinner raised ${fmtRM(raised)}.`;
    },
  },
  {
    id: "tycoon",
    name: "Court a tycoon",
    group: "finance",
    target: "none",
    ap: 1,
    blurb: "RM 2M now. Tycoons expect favours, and MACC notices.",
    cost: () => 0,
    run: (me) => {
      me.funds += 2_000_000;
      me.favours += 1;
      me.risk = clamp(me.risk + 12);
      me.integrity = clamp(me.integrity - 3);
      return "A tycoon pledges RM 2M. They will expect something back.";
    },
  },
  {
    id: "glc",
    name: "Tap GLC networks",
    group: "finance",
    target: "none",
    ap: 1,
    only: "gov",
    blurb: "Government-linked companies find ways to help. RM 1.5M, more risk.",
    cost: () => 0,
    run: (me) => {
      me.funds += 1_500_000;
      me.risk = clamp(me.risk + 8);
      return "GLC friends sponsor your events. RM 1.5M.";
    },
  },
  {
    id: "declare",
    name: "Publish party accounts",
    group: "finance",
    target: "none",
    ap: 1,
    blurb: "Audited, public accounts. Integrity up, MACC risk down.",
    cost: () => 50_000,
    run: (me) => {
      me.integrity = clamp(me.integrity + 8);
      me.risk = clamp(me.risk - 15);
      return "Your accounts are public. Urban voters approve.";
    },
  },
];

export const ACTION_BY_ID: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

function stateSeats(s: GameState, t: Target): number[] {
  if (t.kind !== "state") return [];
  return SEATS.filter((seat) => seat.state === t.state && contestingIn(seat).includes(s.player)).map((seat) => seat.index);
}

function cloneMe(me: Player): Player {
  return { ...me, service: [...me.service], buzz: [...me.buzz], machinery: [...me.machinery], assets: me.assets.map((a) => ({ ...a })), policies: { ...me.policies } };
}

/** Why an action can't be taken now (null when it can). */
export function actionBlocked(s: GameState, def: ActionDef, t: Target): string | null {
  if (def.only === "gov" && !isGovernment(s.player)) return "Government only.";
  if (def.only === "opp" && isGovernment(s.player)) return "Opposition only.";
  if (def.target !== t.kind) return "Pick a target first.";
  if (s.me.ap < def.ap) return `Needs ${def.ap} AP (you have ${s.me.ap}).`;
  const cost = def.cost(s, t);
  if (cost > s.me.funds) return `Needs ${fmtRM(cost)}.`;
  return def.blocked?.(s, t) ?? null;
}

export function applyAction(s: GameState, id: string, t: Target): ActionResult {
  const def = ACTION_BY_ID[id];
  if (!def) return { ok: false, error: "Unknown action." };
  const why = actionBlocked(s, def, t);
  if (why) return { ok: false, error: why };
  const me = cloneMe(s.me);
  me.funds -= def.cost(s, t);
  me.ap -= def.ap;
  const message = def.run(me, s, t);
  return { ok: true, state: { ...s, me }, message };
}

export interface Preview {
  /** Change in seats you would win if the election were today. */
  seats: number;
  /** Change in your vote share in the target seat (seat actions), or average over the seats you contest. */
  share: number;
}

/** Estimated effect of an action, from the same model the game uses (no randomness). */
export function previewAction(s: GameState, id: string, t: Target): Preview | null {
  const def = ACTION_BY_ID[id];
  if (!def || def.target !== t.kind) return null;
  const me = cloneMe(s.me);
  def.run(me, s, t);
  const after: GameState = { ...s, me };
  const a = projectAllFor(s);
  const b = projectAllFor(after);
  const seats = b.filter((p) => p.leader === s.player).length - a.filter((p) => p.leader === s.player).length;
  let share = 0;
  if (t.kind === "seat") share = (b[t.seat].shares[s.player] ?? 0) - (a[t.seat].shares[s.player] ?? 0);
  else {
    const idx = SEATS.filter((seat) => contestingIn(seat).includes(s.player) && (t.kind !== "state" || seat.state === t.state)).map((seat) => seat.index);
    share = idx.reduce((sum, i) => sum + (b[i].shares[s.player] ?? 0) - (a[i].shares[s.player] ?? 0), 0) / Math.max(1, idx.length);
  }
  return { seats, share };
}

// ---------------------------------------------------------------------------------------------
// Business empire (money only, no AP)
// ---------------------------------------------------------------------------------------------

export function buyAsset(s: GameState, type: AssetType, ceo: CeoKind): ActionResult {
  const me = cloneMe(s.me);
  const existing = me.assets.find((a) => a.type === type);
  const price = ASSETS[type].price;
  if (price > me.funds) return { ok: false, error: `Needs ${fmtRM(price)}.` };
  if (existing && type !== "bursa") return { ok: false, error: "Already owned. Upgrade it instead." };
  me.funds -= price;
  if (existing) {
    existing.value += price;
    existing.invested += price;
    return { ok: true, state: { ...s, me }, message: `Added ${fmtRM(price)} to the Bursa portfolio.` };
  }
  me.assets.push(newAsset(type, ceo));
  if (type === "newspaper") me.reach = clamp(me.reach + 8);
  return { ok: true, state: { ...s, me }, message: `Bought: ${ASSETS[type].name}.` };
}

export function upgradeAsset(s: GameState, type: AssetType): ActionResult {
  const me = cloneMe(s.me);
  const a = me.assets.find((x) => x.type === type);
  if (!a || type === "bursa") return { ok: false, error: "Nothing to upgrade." };
  if (a.level >= MAX_LEVEL) return { ok: false, error: "Already at the top level." };
  const cost = upgradeCost(a);
  if (cost > me.funds) return { ok: false, error: `Needs ${fmtRM(cost)}.` };
  me.funds -= cost;
  a.level += 1;
  a.invested += cost;
  a.value += cost;
  if (type === "newspaper") me.reach = clamp(me.reach + 8);
  return { ok: true, state: { ...s, me }, message: `${ASSETS[type].name} upgraded to level ${a.level}.` };
}

export function sellAsset(s: GameState, type: AssetType): ActionResult {
  const me = cloneMe(s.me);
  const a = me.assets.find((x) => x.type === type);
  if (!a) return { ok: false, error: "Not owned." };
  const cash = saleValue(a);
  me.funds += cash;
  if (type === "newspaper") me.reach = clamp(me.reach - 8 * a.level);
  me.assets = me.assets.filter((x) => x !== a);
  return { ok: true, state: { ...s, me }, message: `Sold ${ASSETS[type].name} for ${fmtRM(cash)}.` };
}

export function setCeo(s: GameState, type: AssetType, ceo: CeoKind): ActionResult {
  const me = cloneMe(s.me);
  const a = me.assets.find((x) => x.type === type);
  if (!a) return { ok: false, error: "Not owned." };
  a.ceo = ceo;
  return { ok: true, state: { ...s, me }, message: ceo === "pro" ? "A professional CEO takes over." : "A loyal crony takes over." };
}

export const TAP_WEEKS = 20;
export const TAP_COOLDOWN = 26;

/** Pull 20 weeks of income out now for the war chest. Big MACC risk; once every 26 weeks per asset. */
export function tapAsset(s: GameState, type: AssetType): ActionResult {
  const me = cloneMe(s.me);
  const a = me.assets.find((x) => x.type === type);
  if (!a || type === "bursa") return { ok: false, error: "Can't tap this." };
  if (a.tappedWeek !== null && s.week - a.tappedWeek < TAP_COOLDOWN) return { ok: false, error: `Tapped recently; again in ${TAP_COOLDOWN - (s.week - a.tappedWeek)} weeks.` };
  const cash = assetIncome(a, isGovernment(s.player), me.market) * TAP_WEEKS;
  me.funds += cash;
  me.risk = clamp(me.risk + 15);
  a.tappedWeek = s.week;
  return { ok: true, state: { ...s, me }, message: `Moved ${fmtRM(cash)} from ${ASSETS[type].name} into the war chest. Investigators may ask questions.` };
}

// ---------------------------------------------------------------------------------------------
// Policies, Dewan votes, the Budget and decision cards
// ---------------------------------------------------------------------------------------------

export interface DewanVote {
  yes: number;
  no: number;
  /** Government-side MPs expected to rebel or stay away. */
  rebels: number;
  passes: boolean;
}

/**
 * How a government bill would go in the Dewan today. Government-bloc MPs vote yes unless partners have lost trust
 * (their MPs rebel in proportion) or your own party is split (low unity).
 */
export function dewanVote(s: GameState): DewanVote {
  let partnerSeats = 0;
  let ownSeats = 0;
  s.holders.forEach((h) => {
    if (!COALITION_INFO[h].inGovernment) return;
    if (h === s.player) ownSeats++;
    else partnerSeats++;
  });
  const partnerRebels = Math.round(partnerSeats * Math.max(0, (50 - s.me.trust) / 50));
  const ownRebels = Math.round(ownSeats * Math.max(0, (30 - s.me.unity) / 30) * 0.3);
  const rebels = partnerRebels + ownRebels;
  const yes = partnerSeats + ownSeats - rebels;
  return { yes, no: SEATS.length - yes, rebels, passes: yes >= MAJORITY };
}

/** Why a policy change can't be made now (null when it can). */
export function policyBlocked(s: GameState, policyId: string, option: number): string | null {
  const policy = POLICY_BY_ID[policyId];
  if (!policy || !policy.options[option]) return "Unknown policy.";
  if ((s.me.policies[policyId] ?? 0) === option) return "Already your position.";
  const capital = isGovernment(s.player) ? POLICY_COST.gov : POLICY_COST.opp;
  if (s.me.ap < POLICY_COST.ap) return `Needs ${POLICY_COST.ap} AP.`;
  if (s.me.capital < capital) return `Needs ${capital} political capital.`;
  return null;
}

/** Government: enact a policy (Dewan vote). Opposition: pledge it. */
export function adoptPolicy(s: GameState, policyId: string, option: number): ActionResult {
  const why = policyBlocked(s, policyId, option);
  if (why) return { ok: false, error: why };
  const gov = isGovernment(s.player);
  const policy = POLICY_BY_ID[policyId];
  const opt = policy.options[option];
  const me = cloneMe(s.me);
  me.ap -= POLICY_COST.ap;
  me.capital -= gov ? POLICY_COST.gov : POLICY_COST.opp;
  const vote = gov ? dewanVote(s) : null;
  if (vote && !vote.passes) {
    me.unity = clamp(me.unity - 5);
    return { ok: true, state: { ...s, me }, message: `${policy.name}: the bill was defeated ${vote.yes}–${vote.no}. A humiliation for the government.` };
  }
  me.policies = { ...me.policies, [policyId]: option };
  if (MULTIRACIAL.includes(s.player) && opt.trustMultiracial) me.trust = clamp(me.trust + opt.trustMultiracial);
  if (opt.integrity) me.integrity = clamp(me.integrity + opt.integrity);
  if (!gov && (opt.fiscal ?? 0) < 0) me.integrity = clamp(me.integrity + opt.fiscal! * UNFUNDED_INTEGRITY_PER_FISCAL);
  const economy = gov ? clamp(s.economy + (opt.economy ?? 0)) : s.economy;
  const fiscal = gov ? clamp(s.fiscal + (opt.fiscal ?? 0)) : s.fiscal;
  const message = vote
    ? `${policy.name}: "${opt.label}" passes the Dewan ${vote.yes}–${vote.no}.`
    : `${policy.name}: you pledge "${opt.label}". Voters give it ${Math.round(PLEDGE_WEIGHT * 100)}% credit until you can deliver.`;
  return { ok: true, state: { ...s, me, economy, fiscal }, message };
}

/** Preview: change in seats if held today after a policy change (assuming it passes). */
export function previewPolicy(s: GameState, policyId: string, option: number): number {
  // Run the real change (with AP and capital topped up) so integrity, trust and economy side effects count too.
  const r = adoptPolicy({ ...s, me: { ...s.me, ap: 99, capital: 999 } }, policyId, option);
  if (!r.ok) return 0;
  const seats = (g: GameState) => projectAllFor(g).filter((p) => p.leader === s.player).length;
  return seats(r.state) - seats(s);
}

export function budgetVoters(alloc: Record<string, number>, weight: number): { voters: SegEffects; economy: number } {
  let voters: SegEffects = {};
  let economy = 0;
  for (const line of BUDGET_LINES) {
    const pts = alloc[line.id] ?? 0;
    voters = addSeg(voters, line.voters, pts * weight);
    economy += (line.economy ?? 0) * pts;
  }
  return { voters, economy };
}

/** Tables this year's Budget (government) or a shadow budget (opposition). */
export function tableBudget(s: GameState, alloc: Record<string, number>, auto = false): ActionResult {
  if (s.budgetDue === null) return { ok: false, error: "No Budget is due." };
  if (Object.values(alloc).some((v) => v < 0)) return { ok: false, error: "Allocations can't be negative." };
  const gov = isGovernment(s.player);
  const envelope = budgetEnvelope(s.fiscal);
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  if (total > envelope + BUDGET.overspendMax) return { ok: false, error: `At most ${envelope + BUDGET.overspendMax} points.` };
  const me = cloneMe(s.me);
  const year = weekDate(s.week).getFullYear();
  const done = { ...s, budgetDue: null, budgetYear: year };
  if (!gov) {
    if (me.ap < BUDGET.shadowAp) return { ok: false, error: `Needs ${BUDGET.shadowAp} AP.` };
    me.ap -= BUDGET.shadowAp;
    me.budget = addSeg(me.budget, budgetVoters(alloc, BUDGET.shadowWeight).voters);
    return { ok: true, state: { ...done, me }, message: "Your shadow budget gets a respectful hearing." };
  }
  const vote = dewanVote(s);
  if (!vote.passes) {
    me.capital = clamp(me.capital - BUDGET.defeat.capital, 0, 200);
    me.unity = clamp(me.unity - BUDGET.defeat.unity);
    me.scandal = clamp(me.scandal + BUDGET.defeat.scandal);
    return { ok: true, state: { ...done, me }, message: `Budget ${year + 1} is defeated ${vote.yes}–${vote.no}. The government is in crisis.` };
  }
  const { voters, economy } = budgetVoters(alloc, 1);
  me.budget = addSeg(me.budget, voters);
  const over = Math.max(0, total - envelope);
  const state = {
    ...done,
    me,
    economy: clamp(s.economy + economy - over * BUDGET.overspendEconomy),
    fiscal: clamp(s.fiscal - over * BUDGET.overspendFiscal),
  };
  const how = auto ? "Treasury officials table a default Budget; it passes" : `Budget ${year + 1} passes`;
  return { ok: true, state, message: `${how} ${vote.yes}–${vote.no}${over ? `, with a deficit of ${over} points` : ""}.` };
}

export function answerCard(s: GameState, cardId: number, choice: number): ActionResult {
  const r = resolveCard(s, cardId, choice);
  if (!r) return { ok: false, error: "That decision is no longer waiting." };
  const extra = r.lines.map((l) => l.text).join(" ");
  return { ok: true, state: r.state, message: extra ? `${r.message} ${extra}` : r.message };
}
