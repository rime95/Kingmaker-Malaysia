// Every player decision, as pure functions: (state, target) → new state + a message.
// Actions cost Action Points (AP) and money. Business decisions cost money only.

import { DIFFICULTY, ECONOMY } from "./config";
import { POLLS, commissionedRead } from "./systems/polls";
import { BUDGET, BUDGET_LINES, budgetEnvelope } from "./systems/budget";
import { resolveCard } from "./systems/events";
import { MULTIRACIAL, PLEDGE_WEIGHT, POLICY_BY_ID, POLICY_COST, UNFUNDED_INTEGRITY_PER_FISCAL } from "./systems/policies";
import { addSeg, type SegEffects } from "./systems/segments";
import { fmtRM } from "./money";
import { isGovernment, projectAllFor, simulateElection, weekDate, weekLabel, type GameState, type Player } from "./state";
import { ASSEMBLY_STATES, dissolveAssembly, dissolveParliament, stateRule } from "./systems/assemblies";
import { AFFINITY, BORNEO, OFFERS, TIER_TEXT, agongDecides, backCandidate, deciding, endRound, winTier, type Offer } from "./systems/formation";
import { CAREER as CAREER_LOYALTY, RUNGS, addPoints, isPresident } from "./systems/career";
import { raceMove, type RaceMove } from "./systems/partyrace";
import { careerAfterFormation } from "./progress";
import { aiRebrand } from "./systems/coalitions";
import { PEOPLE, byId, favourBlocked, favourOf, formCabinet, meetPerson, mpOf, syncYou } from "./systems/people";
import { PORTFOLIOS, type PortfolioId } from "./data/people";
import { BUBBLE_INFO, applyBubble } from "./systems/bubbles";
import { ASSETS, MAX_LEVEL, assetIncome, newAsset, saleValue, upgradeCost, type AssetType, type CeoKind } from "./systems/business";
import { contestingIn, cshort, MAJORITY, SEATS, STATE_BY_ID, type CoalitionId } from "./world";

export type Target = { kind: "none" } | { kind: "seat"; seat: number } | { kind: "state"; state: string };
export type ActionGroup = "local" | "national" | "party" | "finance" | "role";

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
  /** Only at these career rungs (your role's own moves). */
  rungs?: number[];
  /** Changes beyond your own stats (e.g. an ally's campaign), applied after run. */
  after?: (s: GameState, t: Target) => GameState;
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

/** The friendliest coalition standing in a seat your coalition doesn't contest. */
export function allyIn(s: GameState, i: number): CoalitionId | null {
  let best: CoalitionId | null = null;
  let score = 0.2;
  for (const c of contestingIn(SEATS[i])) {
    if (c === s.player || c === "OTHERS") continue;
    const v = (AFFINITY[s.player][c] ?? 0) + (s.government.includes(c) === s.government.includes(s.player) ? 0.3 : 0);
    if (v > score) {
      score = v;
      best = c;
    }
  }
  return best;
}

export const ALLY_BUZZ = 12;

/** Role moves earn career points at most once a week (the work counts, not the number of photo-ops). */
const careerPoints = (n: number, why: string) => (s: GameState) => (s.career.roleWeek === s.week ? s : { ...s, career: { ...addPoints(s.career, s.week, n, why), roleWeek: s.week } });
const home = (s: GameState) => s.career.homeSeat;

/** What only your current post lets you do, from branch chief to vice president. */
const ROLE_ACTIONS: ActionDef[] = [
  {
    id: "kenduri",
    name: "Kenduri for the branch",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [0, 1],
    blurb: "Feed the kampung, meet every family. Buzz and members in your home seat, and the branch remembers who fed them.",
    cost: () => 15_000,
    run: (me, s) => {
      me.buzz[home(s)] = addBuzz(me.buzz[home(s)], 6);
      me.members += 300;
      return `A kenduri in ${SEATS[home(s)].name}: three hundred new members sign up.`;
    },
    after: careerPoints(1, "a well-attended kenduri"),
  },
  {
    id: "membership",
    name: "Membership drive",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [0],
    blurb: "Sign up new members door to door. Members pay dues and every one is a vote in branch elections.",
    cost: () => 8_000,
    run: (me) => {
      me.members += 800;
      return "Your branch signs up 800 new members.";
    },
    after: careerPoints(1, "grew the branch"),
  },
  {
    id: "divisionDrive",
    name: "Division machinery drive",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [1],
    blurb: "As division chief you command the branches: machinery in your home seat at a third of the usual price.",
    cost: () => 25_000,
    run: (me, s) => {
      me.machinery[home(s)] = clamp(me.machinery[home(s)] + 12);
      return `Machinery in ${SEATS[home(s)].name} is now ${Math.round(me.machinery[home(s)])}.`;
    },
    after: careerPoints(1, "organised the division"),
  },
  {
    id: "dewanQuestion",
    name: "Question in the Dewan",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [2, 3, 4],
    blurb: "A sharp question at question time makes the evening news.",
    cost: () => 0,
    blocked: (s) => (s.parliament.status !== "sitting" ? "Parliament is dissolved." : null),
    run: (me) => {
      me.nationalBuzz = clamp(me.nationalBuzz + 3);
      return "Your question makes the evening news.";
    },
    after: careerPoints(1, "a question in the Dewan"),
  },
  {
    id: "ministryProject",
    name: "Ministry project",
    group: "role",
    target: "state",
    ap: 2,
    rungs: [3, 4],
    only: "gov",
    blurb: "Your ministry's budget builds roads, clinics and schools across a state. Free service in every seat you contest there.",
    cost: () => 0,
    run: (me, s, t) => {
      const idx = stateSeats(s, t);
      for (const i of idx) me.service[i] = clamp(me.service[i] + 2.5);
      me.risk = clamp(me.risk + 1);
      return `Your ministry breaks ground in ${STATE_BY_ID[(t as { state: string }).state].name}.`;
    },
    after: careerPoints(2, "a ministry project"),
  },
  {
    id: "shadowAttack",
    name: "Shadow minister's attack",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [3, 4],
    only: "opp",
    blurb: "Tear into the minister you shadow. National buzz, and the press starts calling you a minister-in-waiting.",
    cost: () => 20_000,
    run: (me) => {
      me.nationalBuzz = clamp(me.nationalBuzz + 6);
      return "Your press conference leads the news.";
    },
    after: careerPoints(1, "a shadow minister's attack"),
  },
  {
    id: "wingRally",
    name: "Rally the youth wing",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [5],
    blurb: "As vice president you run a wing: a youth convention wins over young voters everywhere.",
    cost: () => 100_000,
    run: (me) => {
      me.mood = addSeg(me.mood, { youth: 0.04 });
      return "The youth convention trends all weekend.";
    },
    after: careerPoints(2, "a youth convention"),
  },
  {
    id: "broker",
    name: "Broker a deal",
    group: "role",
    target: "none",
    ap: 1,
    rungs: [5],
    blurb: "Settle a feud between warlords and smooth things over with partners. Unity and trust, and the president owes you.",
    cost: () => 0,
    run: (me) => {
      me.unity = clamp(me.unity + 4);
      me.trust = clamp(me.trust + 3);
      return "You settle a feud between two division chiefs.";
    },
    after: careerPoints(2, "brokered a deal"),
  },
];

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
    id: "ally",
    name: "Back an ally",
    group: "local",
    target: "seat",
    ap: 1,
    blurb: "Your coalition has no candidate here. Campaign for a friendly party's candidate: their vote rises, and so does their trust in you.",
    cost: () => 45_000,
    blocked: (s, t) => {
      const seat = seatOf(t);
      if (!seat) return null;
      if (contestingIn(seat).includes(s.player)) return "You field a candidate here. Use your own moves.";
      return allyIn(s, seat.index) ? null : "No friendly party stands here.";
    },
    run: (me, s, t) => {
      const i = (t as { seat: number }).seat;
      const ally = allyIn(s, i)!;
      me.trust = clamp(me.trust + 2);
      me.favours += 1;
      return `You campaign for the ${cshort(ally)} candidate in ${SEATS[i].name}. They will remember it.`;
    },
    after: (s, t) => {
      const i = (t as { seat: number }).seat;
      const ally = allyIn(s, i);
      const r = ally ? s.rivals[ally] : undefined;
      if (!ally || !r) return s;
      const buzz = [...r.buzz];
      buzz[i] = clamp(buzz[i] + ALLY_BUZZ);
      return { ...s, rivals: { ...s.rivals, [ally]: { ...r, buzz } } };
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

ACTIONS.push(...ROLE_ACTIONS);

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
  if (def.only === "gov" && !isGovernment(s)) return "Government only.";
  if (def.only === "opp" && isGovernment(s)) return "Opposition only.";
  if (def.rungs && !def.rungs.includes(s.career.rung)) return `Only as ${def.rungs.map((r) => RUNGS[r]).join(" or ")}.`;
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
  const base = def.after ? def.after({ ...s, me }, t) : s;
  // Campaigning in your own coalition's seats wins the loyalty of their MPs (your faction).
  const loyalty = [...s.career.loyalty];
  const seats = t.kind === "seat" ? [t.seat] : t.kind === "state" ? SEATS.filter((x) => x.state === t.state).map((x) => x.index) : [];
  const gain = t.kind === "seat" ? CAREER_LOYALTY.loyaltyPerAction : CAREER_LOYALTY.loyaltyPerAction / 3;
  for (const i of seats) if (s.holders[i] === s.player) loyalty[i] = Math.min(100, loyalty[i] + gain);
  // ...and of the MPs themselves.
  const mps = new Set(seats.filter((i) => s.holders[i] === s.player).map((i) => mpOf(s, i)?.id));
  const people = mps.size ? base.people.map((p) => (mps.has(p.id) && p.id !== s.youId ? { ...p, loyalty: Math.min(100, p.loyalty + gain * 0.5) } : p)) : base.people;
  return { ok: true, state: { ...base, me, people, career: { ...base.career, loyalty } }, message };
}

export const WAR_ROOM_COST = 100_000;

/** A war-room simulation: a full test election from today's true support (seats don't change hands). */
export function warRoom(s: GameState): ActionResult {
  if (s.me.funds < WAR_ROOM_COST) return { ok: false, error: `Needs ${fmtRM(WAR_ROOM_COST)}.` };
  const next = simulateElection({ ...s, me: { ...s.me, funds: s.me.funds - WAR_ROOM_COST } });
  return { ok: true, state: next, message: `War-room simulation done (${fmtRM(WAR_ROOM_COST)}): the map shows who would win. Seats don't change hands.` };
}

/** A campaign move in a party election. */
export function raceAct(s: GameState, move: RaceMove): ActionResult {
  const r = raceMove(s, move);
  return "error" in r ? { ok: false, error: r.error } : { ok: true, state: r.state, message: r.message };
}

/** Close the party election count. */
export function closeRace(s: GameState): GameState {
  return s.race?.result ? { ...s, race: null } : s;
}

/** Commission a constituency poll (money only, no AP). One per seat per week. */
export function commissionPoll(s: GameState, seat: number): ActionResult {
  const old = s.polls.seats[seat];
  if (old?.source === "poll" && old.week === s.week) return { ok: false, error: "You already have this week's poll." };
  if (s.me.funds < POLLS.seatCost) return { ok: false, error: `Needs ${fmtRM(POLLS.seatCost)}.` };
  const read = commissionedRead(projectAllFor(s)[seat], s.seed, s.week, seat, s.me.machinery[seat], DIFFICULTY[s.settings.difficulty].pollError);
  const seats = [...s.polls.seats];
  seats[seat] = read;
  return {
    ok: true,
    state: { ...s, me: { ...s.me, funds: s.me.funds - POLLS.seatCost }, polls: { ...s.polls, seats } },
    message: `${read.pollster} polled ${SEATS[seat].name} (±${Math.round(read.moe * 100)}%).`,
  };
}

const LEADERSHIP_ONLY = "Only the party president decides this. Climb the party ladder (Career tab).";

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
  const cash = assetIncome(a, isGovernment(s), me.market) * TAP_WEEKS;
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
    if (!s.government.includes(h)) return;
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
  if (!isPresident(s.career)) return LEADERSHIP_ONLY;
  if ((s.me.policies[policyId] ?? 0) === option) return "Already your position.";
  const capital = isGovernment(s) ? POLICY_COST.gov : POLICY_COST.opp;
  if (s.me.ap < POLICY_COST.ap) return `Needs ${POLICY_COST.ap} AP.`;
  if (s.me.capital < capital) return `Needs ${capital} political capital.`;
  return null;
}

/** Government: enact a policy (Dewan vote). Opposition: pledge it. */
export function adoptPolicy(s: GameState, policyId: string, option: number): ActionResult {
  const why = policyBlocked(s, policyId, option);
  if (why) return { ok: false, error: why };
  const gov = isGovernment(s);
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
  const career = vote ? addPoints(s.career, s.week, 3, `passed ${policy.name.toLowerCase()} reform`) : s.career;
  return { ok: true, state: { ...s, me, economy, fiscal, career }, message };
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
  if (!auto && !isPresident(s.career)) return { ok: false, error: LEADERSHIP_ONLY };
  const gov = isGovernment(s);
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
  if (!auto) state.career = addPoints(s.career, s.week, 5, `Budget ${year + 1} passed`);
  return { ok: true, state, message: `${how} ${vote.yes}–${vote.no}${over ? `, with a deficit of ${over} points` : ""}.` };
}

export function answerCard(s: GameState, cardId: number, choice: number): ActionResult {
  const r = resolveCard(s, cardId, choice);
  if (!r) return { ok: false, error: "That decision is no longer waiting." };
  const state = syncYou(r.state, r.lines);
  const extra = r.lines.map((l) => l.text).join(" ");
  return { ok: true, state, message: extra ? `${r.message} ${extra}` : r.message };
}

// ---------------------------------------------------------------------------------------------
// People: meetings, favours and the cabinet
// ---------------------------------------------------------------------------------------------

export function meet(s: GameState, id: number): ActionResult {
  const r = meetPerson(s, id);
  return "error" in r ? { ok: false, error: r.error } : { ok: true, state: r.state, message: r.message };
}

export function askFavour(s: GameState, id: number): ActionResult {
  const why = favourBlocked(s, id);
  if (why) return { ok: false, error: why };
  const p = byId(s, id)!;
  const f = favourOf(s, p);
  const me = { ...s.me, unity: clamp(s.me.unity + (f.unity ?? 0)), capital: clamp(s.me.capital + (f.capital ?? 0), 0, 200), trust: clamp(s.me.trust + (f.trust ?? 0)) };
  const people = s.people.map((x) => (x.id === id ? { ...x, loyalty: x.loyalty - PEOPLE.favourLoyalty, favourWeek: s.week } : x));
  const career = f.points ? addPoints(s.career, s.week, f.points, `${p.name} brought delegates over`) : s.career;
  return { ok: true, state: { ...s, me, people, career }, message: `${p.name}: ${f.text.split(":")[0].toLowerCase()}.` };
}

export function appointBlocked(s: GameState, post: PortfolioId, id: number | null): string | null {
  if (s.parliament.pm !== s.player || !isPresident(s.career)) return "Only you as Prime Minister can appoint ministers.";
  if (post === "pm") return "You are the Prime Minister.";
  if (id === null) return null;
  const p = byId(s, id);
  if (!p) return "They have left politics.";
  if (!s.government.some((c) => s.coalitions[c].members.includes(p.party))) return "Ministers come from government parties.";
  return null;
}

/** Reshuffle: put someone in a ministry (or leave it empty). The sacked minister and their party take it badly. */
export function appoint(s: GameState, post: PortfolioId, id: number | null): ActionResult {
  const why = appointBlocked(s, post, id);
  if (why) return { ok: false, error: why };
  const cabinet = { ...s.cabinet };
  const old = byId(s, cabinet[post]);
  // One post per person (except the PM, who may hold Finance).
  if (id !== null) for (const [k, v] of Object.entries(cabinet)) if (v === id && k !== "pm") delete cabinet[k as PortfolioId];
  if (id === null) delete cabinet[post];
  else cabinet[post] = id;
  let me = s.me;
  let partySat = s.partySat;
  const mine = s.coalitions[s.player].members;
  const people = s.people.map((p) => {
    if (old && p.id === old.id && p.id !== id) return { ...p, loyalty: Math.max(0, p.loyalty - 25) };
    if (p.id === id) return { ...p, loyalty: Math.min(100, p.loyalty + 15) };
    return p;
  });
  const feel = (party: string, d: number) => {
    if (party === mine[0]) me = { ...me, unity: clamp(me.unity + d / 2) };
    else if (mine.includes(party)) partySat = { ...partySat, [party]: clamp((partySat[party] ?? 55) + d) };
    else me = { ...me, trust: clamp(me.trust + d / 2) };
  };
  if (old && old.id !== id) feel(old.party, -6);
  const p = byId(s, id);
  if (p && p.id !== old?.id) feel(p.party, 4);
  const name = PORTFOLIOS.find((x) => x.id === post)!.name;
  return { ok: true, state: { ...s, cabinet, people, me, partySat }, message: p ? `${p.name} is the new ${name === "Finance" ? "Finance Minister" : `minister for ${name}`}.` : `${name} is left without a minister.` };
}

// ---------------------------------------------------------------------------------------------
// Dissolution (Parliament and state assemblies)
// ---------------------------------------------------------------------------------------------

export function parliamentDissolveBlocked(s: GameState): string | null {
  if (s.parliament.pm !== s.player) return "Only the Prime Minister can advise the Agong to dissolve Parliament.";
  if (!isPresident(s.career)) return LEADERSHIP_ONLY;
  if (s.parliament.status !== "sitting") return "Parliament is already dissolved.";
  return null;
}

export function callGeneralElection(s: GameState): ActionResult {
  const why = parliamentDissolveBlocked(s);
  if (why) return { ok: false, error: why };
  const next = dissolveParliament(s);
  const synced = ASSEMBLY_STATES.filter((id) => next.assemblies[id].status === "campaign" && s.assemblies[id].status === "sitting");
  const also = synced.length ? ` ${synced.map((id) => STATE_BY_ID[id].name).join(", ")} dissolve${synced.length === 1 ? "s" : ""} too.` : "";
  return { ok: true, state: next, message: `The Agong consents: Parliament is dissolved. Polling day is ${weekLabel(next.parliament.pollWeek!)}.${also}` };
}

export function assemblyDissolveBlocked(s: GameState, stateId: string): string | null {
  if (stateRule(s.dunHolders, stateId, s.government).ruler !== s.player) return "Only the state's ruling coalition can dissolve its assembly.";
  if (!isPresident(s.career)) return LEADERSHIP_ONLY;
  if (s.assemblies[stateId].status !== "sitting") return "Already dissolved.";
  return null;
}

export function callStateElection(s: GameState, stateId: string): ActionResult {
  const why = assemblyDissolveBlocked(s, stateId);
  if (why) return { ok: false, error: why };
  const next = dissolveAssembly(s, stateId);
  return { ok: true, state: next, message: `The ${STATE_BY_ID[stateId].name} assembly is dissolved. Polling day is ${weekLabel(next.assemblies[stateId].pollWeek!)}.` };
}

/** Whether a state you govern votes together with Parliament. */
export function setSyncWithGE(s: GameState, stateId: string, sync: boolean): ActionResult {
  if (stateRule(s.dunHolders, stateId, s.government).ruler !== s.player) return { ok: false, error: "Only the state's ruling coalition decides this." };
  if (!isPresident(s.career)) return { ok: false, error: LEADERSHIP_ONLY };
  const a = s.assemblies[stateId];
  return {
    ok: true,
    state: { ...s, assemblies: { ...s.assemblies, [stateId]: { ...a, syncGE: sync } } },
    message: sync ? `${STATE_BY_ID[stateId].name} will dissolve together with Parliament.` : `${STATE_BY_ID[stateId].name} will hold its own state election.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Forming a government after a general election
// ---------------------------------------------------------------------------------------------

export type OfferKind = "dpm" | "ministries" | "ma63";

export function offerBlocked(s: GameState, c: CoalitionId, kind: OfferKind): string | null {
  const f = s.formation;
  if (!f) return "No talks are under way.";
  if (f.role !== "leader") return "Only a prime-minister candidate makes offers.";
  if (!isPresident(s.career)) return LEADERSHIP_ONLY;
  if (!deciding(f, s.player).includes(c)) return "They have already signed.";
  const o = f.offers[c] ?? {};
  if (kind === "dpm" && (o.dpm || Object.values(f.offers).some((x) => x?.dpm))) return "There is only one Deputy Prime Minister post.";
  if (kind === "ministries" && (o.ministries ?? 0) >= OFFERS.ministries.max) return `At most ${OFFERS.ministries.max} extra ministries.`;
  if (kind === "ma63" && (!BORNEO.includes(c) || o.ma63)) return BORNEO.includes(c) ? "Already promised." : "Only Sabah and Sarawak parties care about MA63.";
  return null;
}

export function makeOffer(s: GameState, c: CoalitionId, kind: OfferKind): ActionResult {
  const why = offerBlocked(s, c, kind);
  if (why) return { ok: false, error: why };
  const f = s.formation!;
  const o = { ...(f.offers[c] ?? {}) };
  if (kind === "dpm") o.dpm = true;
  if (kind === "ministries") o.ministries = (o.ministries ?? 0) + 1;
  if (kind === "ma63") o.ma63 = true;
  const label = kind === "dpm" ? "the Deputy Prime Minister's post" : kind === "ministries" ? "more ministries" : "full MA63 devolution";
  return {
    ok: true,
    state: { ...s, formation: { ...f, offers: { ...f.offers, [c]: o }, log: [...f.log, `You offer ${cshort(c)} ${label}.`] } },
    message: `Offer made to ${cshort(c)}: ${label}.`,
  };
}

export function nextTalksRound(s: GameState): ActionResult {
  const f = s.formation;
  if (!f) return { ok: false, error: "No talks are under way." };
  if (f.round > OFFERS.rounds) return { ok: false, error: "Talks are over. Go to the Agong." };
  if (!isPresident(s.career)) return { ok: false, error: LEADERSHIP_ONLY };
  const next = endRound(f, s.player);
  return { ok: true, state: { ...s, formation: next }, message: `Round ${f.round} of talks is over.` };
}

export function backForPm(s: GameState, leader: CoalitionId, askDpm: boolean): ActionResult {
  const f = s.formation;
  if (!f || f.role !== "kingmaker") return { ok: false, error: "You aren't the kingmaker." };
  if (!f.candidates.includes(leader)) return { ok: false, error: "Not a candidate." };
  if (f.committed[s.player]) return { ok: false, error: "You have already signed." };
  if (!isPresident(s.career)) return { ok: false, error: LEADERSHIP_ONLY };
  return { ok: true, state: { ...s, formation: backCandidate(f, s.player, leader, askDpm) }, message: `You back ${cshort(leader)} for Prime Minister.` };
}

/** Finish the talks (any remaining rounds play out) and let the Agong decide. */
export function goToAgong(s: GameState): ActionResult {
  let f = s.formation;
  if (!f) return { ok: false, error: "No talks are under way." };
  // Below the presidency, your party leadership picks the side for you.
  if (f.role === "kingmaker" && !f.committed[s.player] && !isPresident(s.career)) {
    const [x, y] = f.candidates;
    f = backCandidate(f, s.player, (AFFINITY[s.player][x] ?? 0) >= (AFFINITY[s.player][y] ?? 0) ? x : y, false);
  }
  while (f.round <= OFFERS.rounds) f = endRound(f, s.player);
  const o = agongDecides(f, s.player);
  const me = cloneMe(s.me);
  const inGov = o.government.includes(s.player);
  const lines: string[] = [];
  if (o.pm === s.player) {
    for (const [c, offer] of Object.entries(f.offers) as [CoalitionId, Offer][]) {
      if (!o.government.includes(c)) continue;
      if (offer.dpm) me.capital = clamp(me.capital + OFFERS.dpm.capital, 0, 200);
      if (offer.ministries) me.unity = clamp(me.unity + OFFERS.ministries.unity * offer.ministries);
      if (offer.ma63) me.policies = { ...me.policies, ma63: 1 };
    }
  } else if (inGov) {
    me.capital = clamp(me.capital + (o.dpmGranted ? 25 : 10), 0, 200);
    if (o.dpmGranted) me.unity = clamp(me.unity + 5);
    lines.push(o.dpmGranted ? "Your leader becomes Deputy Prime Minister." : f.askedDpm ? "Your DPM demand was turned down, but you are in government." : "");
  }
  me.trust = inGov ? 65 : 50;
  let state: GameState = { ...s, me, formation: null, government: o.government, parliament: { ...s.parliament, pm: o.pm } };
  // A new cabinet: the AI shares posts by seats; as Prime Minister you can reshuffle it any time.
  state.cabinet = formCabinet(state);
  // The winner may rebrand: you name your coalition; an AI prime minister's coalition sometimes relaunches.
  if (o.pm === s.player) state.namePending = true;
  else {
    const r = aiRebrand(state, o.pm);
    state = r.state;
    if (r.line) lines.push(r.line.text);
  }
  const tier = winTier(state, f, o);
  state.tiers = [...s.tiers, tier];
  const how = o.majority ? `with ${o.sds} SDs` : `leading a minority government on ${o.sds} SDs`;
  const message = `The Agong appoints the leader of ${cshort(o.pm)} as Prime Minister, ${how}. ${lines.filter(Boolean).join(" ")} Result: ${TIER_TEXT[tier.tier].name}.`;
  state.report = state.report ? { ...state.report, lines: [...state.report.lines, { text: message, tone: inGov ? "good" : "bad" }] } : state.report;
  return { ok: true, state: careerAfterFormation(state, f, o), message };
}

/** If time moves on with talks unfinished, they resolve without you: as kingmaker you back your natural partner. */
export function autoResolveFormation(s: GameState): GameState {
  let state = s;
  const f = s.formation;
  if (!f) return s;
  if (f.role === "kingmaker" && !f.committed[s.player]) {
    const [x, y] = f.candidates;
    const pick = (AFFINITY[s.player][x] ?? 0) >= (AFFINITY[s.player][y] ?? 0) ? x : y;
    state = { ...state, formation: backCandidate(f, s.player, pick, false) };
  }
  const r = goToAgong(state);
  return r.ok ? r.state : s;
}

/** Closes the Election Night screen (the result is already applied). */
export function closeNight(s: GameState): GameState {
  return { ...s, night: null };
}

/** Collect an opportunity bubble from the map (no AP). */
export function claimBubble(s: GameState, id: number): ActionResult {
  const b = s.bubbles.find((x) => x.id === id);
  if (!b) return { ok: false, error: "That opportunity has passed." };
  const info = BUBBLE_INFO[b.kind];
  return { ok: true, state: applyBubble(s, b), message: `${info.title} in ${SEATS[b.seat].name}: ${info.reward(b.value)}.` };
}
