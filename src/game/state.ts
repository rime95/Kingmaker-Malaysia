// The saved game state. Plain data only, so it can be saved and reloaded exactly.

import { machineryBase, serviceBase } from "./bases";
import { MIN_START_FUNDS, edgeOf, standing, TURN_WEEKS, AP_PER_WEEK, AUTO_DISSOLUTION, DIFFICULTY, ECONOMY_REST, EFFECT, FORTRESS, START, type Difficulty, type ScenarioId } from "./config";
import { initAssemblies, initParliament, type Assembly, type Parliament } from "./systems/assemblies";
import { DUN_START } from "./systems/dun";
import type { Formation, WinTier } from "./systems/formation";
import { AP_BY_RUNG, initCareer, type Career } from "./systems/career";
import { newObjectives, type Objective } from "./systems/goals";
import { newBubbles, type Bubble } from "./systems/bubbles";
import { initPolls, type Polls } from "./systems/polls";
import { initCoalitions, initPartySat, type Coalitions } from "./systems/coalitions";
import { initPeople, syncYou, type Person } from "./systems/people";
import type { PortfolioId } from "./data/people";
import type { PartyRace } from "./systems/partyrace";
import { initTeam, pollError, type Staff } from "./systems/team";
import { NATION, initNation, type Nation } from "./systems/nation";
import { initBursa, type Stock } from "./systems/bursa";
import { initPersonal, type Personal } from "./systems/wealth";
import { candidateStrength, yourParty, type Nominations } from "./systems/nominations";
import type { SeatRecord } from "./systems/results";
import { asideFor, type Pact } from "./systems/pacts";
import { issueEffect } from "./systems/issues";
import type { Order } from "./systems/orders";
import { initDewan, type Dewan } from "./systems/dewan";
import type { Analysis } from "./systems/analysis";
import { initOpposition, type Agenda, type Opposition } from "./systems/agenda";
import { messageEffect, type Strategy } from "./systems/message";
import { WINGS, wingsEffect, type Wings } from "./systems/partyorg";
import { initFunding, type Funding } from "./systems/funding";
import { runElection, type ElectionResult } from "./election";
import type { Asset, Market } from "./systems/business";
import { policyVoters } from "./systems/policies";
import { initRivals, rivalNationalEffect, rivalSeatEffect, type Rivals } from "./systems/rivals";
import { segValue, type SegEffects } from "./systems/segments";
import { initScorecard, pillarEffect, pillarRows, restingScores, type Scorecard } from "./systems/scorecard";
import type { PolicyEntry } from "./systems/governing";
import { COALITION_INDEX, ZERO_SWING, naturalSupport, projectAll, type Swing, type VoterInputs } from "./voter";
import { COALITIONS, COALITION_INFO, SUPERMAJORITY, SEATS, contestingIn, type CoalitionId, type Entries } from "./world";

export { machineryBase, serviceBase, weekDate, weekLabel, weeksToDissolution } from "./bases";

export const SAVE_VERSION = 15;

/** The unity government as of the October 2026 snapshot. */
export const START_GOVERNMENT: CoalitionId[] = COALITIONS.filter((c) => COALITION_INFO[c].inGovernment);

/** One line of the weekly report. */
export interface ReportLine {
  text: string;
  tone?: "good" | "bad" | "info";
}

export interface WeekReport {
  week: number;
  income: { label: string; amount: number }[];
  expenses: { label: string; amount: number }[];
  seatsBefore: number;
  seatsAfter: number;
  /** Seats with the biggest projected share change for you this week. */
  movers: { seatIndex: number; delta: number }[];
  /** How many weeks this report covers (Skip 1 Month = 4). */
  weeks?: number;
  lines: ReportLine[];
}

export interface CardInstance {
  id: number;
  kind: string;
  week: number;
  /** Unanswered cards take their default choice in this week. */
  deadline: number;
  seat?: number;
  /** The party a card is about (e.g. a partner threatening to walk out). */
  party?: string;
  /** The person a card is about. */
  person?: number;
}

export interface HistoryPoint {
  week: number;
  funds: number;
  seats: number;
}

export interface Player {
  funds: number;
  ap: number;
  apMax: number;
  /** Spent on pushing bills and party discipline (more uses arrive with policies). */
  capital: number;
  unity: number;
  /** Trust between you and your coalition partners. */
  trust: number;
  integrity: number;
  /** MACC risk meter. */
  risk: number;
  /** 0–100; multiplies national messaging. */
  reach: number;
  members: number;
  fundFatigue: number;
  nationalBuzz: number;
  scandal: number;
  /** Per seat, your coalition's presence. */
  service: number[];
  buzz: number[];
  machinery: number[];
  assets: Asset[];
  /** Policy stance per policy id (option index; 0 = status quo). */
  policies: Record<string, number>;
  /** Short-lived reactions to events, by voter segment (fades 4% a week). */
  mood: SegEffects;
  /** Budget measures, by voter segment (fades 1.5% a week). */
  budget: SegEffects;
  /** Tycoon favours still owed. */
  favours: number;
  market: Market;
  /** 0–100: a wave building behind you. Lifts your national swing and makes every local move count for more. */
  momentum: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  player: CoalitionId;
  week: number;
  /** National swing and per-seat offsets for every coalition (rival AI will move these). */
  swing: Swing;
  seatOffsets: number[][];
  /** Who holds each seat now (starts as GE15). */
  holders: CoalitionId[];
  holderParties: string[];
  me: Player;
  report: WeekReport | null;
  history: HistoryPoint[];
  lastElection: ElectionResult | null;
  /** National economy (0–100, ~55 normal) and public finances (fiscal space, 0–100). */
  economy: number;
  fiscal: number;
  /** Decision cards waiting for an answer. */
  cards: CardInstance[];
  /** Last week each card kind appeared (no repeats within 24 weeks). */
  cardLast: Record<string, number>;
  /** The Budget: the week it became due (null when not due) and the last year tabled. */
  budgetDue: number | null;
  budgetYear: number | null;
  /** AI rival parties. */
  rivals: Rivals;
  /** Holder of each of the 600 state assembly seats. */
  dunHolders: CoalitionId[];
  assemblies: Record<string, Assembly>;
  parliament: Parliament;
  /** Coalitions in the federal government (the Prime Minister is parliament.pm). */
  government: CoalitionId[];
  /** Talks to form a government after a general election (null when none are under way). */
  formation: Formation | null;
  /** Election Night to show: the week it happened and who held the seats before. */
  night: { week: number; prevHolders: CoalitionId[] } | null;
  /** Your result tier at each general election. */
  tiers: WinTier[];
  /** Your own career: rung, points, age, faction and successors. */
  career: Career;
  /** This term's objectives. */
  objectives: Objective[];
  /** Achievement id → week earned. */
  achievements: Record<string, number>;
  settings: { scenario: ScenarioId; difficulty: Difficulty };
  /** This week's opportunity bubbles on the map. */
  bubbles: Bubble[];
  /** What you know of the race: national polls and per-seat reads. */
  polls: Polls;
  /** Latest simulated result per seat (null = the real GE15 result still stands). */
  seatResults: (SeatRecord | null)[];
  /** Number of the last general election held (15 = GE15). */
  geCount: number;
  /** Coalitions: names, colours and member parties (they change during a game). */
  coalitions: Coalitions;
  /** Each non-leading party's satisfaction with its coalition (0–100). */
  partySat: Record<string, number>;
  /** Seat → coalition → the party standing there, where parties have changed sides. */
  seatParty: Record<number, Partial<Record<CoalitionId, string>>>;
  /** You won: name your coalition (shown once after taking power). */
  namePending: boolean;
  /** Every MP, party leader and rising branch chief. */
  people: Person[];
  nextPersonId: number;
  /** Cabinet post → person id. */
  cabinet: Partial<Record<PortfolioId, number>>;
  /** Leader mode: the person who is you. */
  youId: number | null;
  /** A party election you are fighting (four weeks before the June AGM). */
  race: PartyRace | null;
  /** Your personal staff, and who is looking for work this month. */
  team: Staff[];
  teamMarket: Staff[];
  nextStaffId: number;
  /** The country: growth, prices, jobs, the ringgit, debt, approval, projects and crises. */
  nation: Nation;
  /** Bursa Malaysia, and your own money: cash, shares and property (plus the party's land bank). */
  bursa: Stock[];
  personal: Personal;
  /** Seats coalitions have moved into by opening branches (they contest them from then on). */
  entries: Entries;
  /** Candidates your party has named for the coming general election (null outside a campaign). */
  nominations: Nominations | null;
  /** Seat pacts with other coalitions (until the next general election is over). */
  pacts: Pact[];
  /** Seat → local issues you have taken up this term. */
  issuesTaken: Record<number, string[]>;
  /** How much of the GE15 calibration still holds (it fades each election). */
  calWeight: number;
  /** Moves repeated at the start of every turn. */
  orders: Order[];
  /** The Dewan Rakyat's sittings and Order Paper. */
  dewan: Dewan;
  /** What happened at the last general election, and why. */
  lastAnalysis: Analysis | null;
  /** The government's promises for this term. */
  agenda: Agenda | null;
  /** Your opposition work: shadow cabinet, attacks, investigations. */
  opp: Opposition;
  /** Your campaign message. */
  strategy: Strategy;
  /** The party's Youth and Wanita wings. */
  wings: Wings;
  /** Allocations MoU with the government (opposition). */
  funding: Funding;
  /** Per seat: your loyal base, built at past elections (log-odds). */
  roots: number[];
  /** Per seat: voters you have converted by working it (added to your natural base). */
  converts: number[];
  /** What voters think of every coalition: policies, principle, execution, credibility. */
  scorecard: Scorecard;
  /** Per seat: your recent local campaigning (repeats give less; heavy pressure draws a rival response). */
  seatWork: number[];
  /** Seats where a rival is counter-campaigning against you. */
  battlegrounds: Record<number, { by: CoalitionId; until: number }>;
  /** Your policy decisions and the numbers when you took them. */
  policyLog: PolicyEntry[];
}

export interface NewGameOptions {
  scenario?: ScenarioId;
  difficulty?: Difficulty;
  mode?: "career" | "leader";
  name?: string;
  homeSeat?: number;
}

export function newGame(player: CoalitionId, seed = Date.now() % 2147483647, opts: NewGameOptions = {}): GameState {
  const start = START[player];
  const service = SEATS.map((s) => serviceBase(player, s.index));
  const machinery = SEATS.map((s) => machineryBase(player, s.index));
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    player,
    week: 0,
    swing: ZERO_SWING(),
    seatOffsets: SEATS.map(() => COALITIONS.map(() => 0)),
    holders: SEATS.map((s) => s.ge15Coalition),
    holderParties: SEATS.map((s) => s.ge15Party),
    me: {
      funds: start.funds,
      ap: AP_PER_WEEK,
      apMax: AP_PER_WEEK,
      capital: 50,
      unity: 60,
      trust: 60,
      integrity: 60,
      risk: 10,
      reach: 40,
      members: start.members,
      fundFatigue: 0,
      nationalBuzz: 0,
      scandal: 0,
      service,
      buzz: SEATS.map(() => 0),
      machinery,
      assets: [],
      market: { commodity: 1 },
      policies: {},
      mood: {},
      budget: {},
      favours: 0,
      momentum: 0,
    },
    report: null,
    history: [],
    lastElection: null,
    economy: ECONOMY_REST,
    fiscal: 50,
    cards: [],
    cardLast: {},
    budgetDue: null,
    budgetYear: null,
    rivals: initRivals(player),
    dunHolders: [...DUN_START],
    assemblies: initAssemblies(),
    parliament: initParliament(AUTO_DISSOLUTION),
    government: START_GOVERNMENT,
    formation: null,
    night: null,
    tiers: [],
    career: initCareer(player, seed, opts.mode ?? "leader", opts.name, opts.homeSeat),
    objectives: [],
    achievements: {},
    settings: { scenario: opts.scenario ?? "present", difficulty: opts.difficulty ?? "normal" },
    bubbles: [],
    polls: { national: [], seats: [] },
    seatResults: SEATS.map(() => null),
    geCount: 15,
    coalitions: initCoalitions(),
    partySat: initPartySat(),
    seatParty: {},
    namePending: false,
    people: [],
    nextPersonId: 1,
    cabinet: {},
    youId: null,
    race: null,
    ...initTeam(seed),
    nation: initNation(),
    bursa: initBursa(),
    personal: initPersonal({ player, career: initCareer(player, seed, opts.mode ?? "leader", opts.name, opts.homeSeat) }),
    entries: {},
    nominations: null,
    pacts: [],
    issuesTaken: {},
    calWeight: 1,
    orders: [],
    dewan: initDewan(),
    lastAnalysis: null,
    agenda: null,
    opp: initOpposition(),
    strategy: { theme: null, since: 0 },
    wings: { youth: WINGS.start, women: WINGS.start },
    funding: initFunding(),
    roots: SEATS.map(() => 0),
    converts: SEATS.map(() => 0),
    scorecard: null as unknown as Scorecard,
    seatWork: SEATS.map(() => 0),
    battlegrounds: {},
    policyLog: [],
  };
  if (!contestingIn(SEATS[state.career.homeSeat]).includes(player)) state.entries = { [state.career.homeSeat]: [player] };
  Object.assign(state, initPeople(state));
  // Your own character takes the party president's chair (and the real president steps out of the game).
  const myName = opts.name?.trim();
  if (myName && state.youId !== null) state.people = state.people.map((p) => (p.id === state.youId ? { ...p, name: myName } : p));
  Object.assign(state, syncYou(state));
  state.me.apMax = state.me.ap = AP_BY_RUNG[state.career.rung] * TURN_WEEKS;
  // Difficulty and scenario
  state.me.funds = Math.round(Math.max(state.me.funds, MIN_START_FUNDS * edgeOf(state)) * DIFFICULTY[state.settings.difficulty].funds);
  state.me.unity = DIFFICULTY[state.settings.difficulty].unity;
  if (state.settings.scenario === "snap") state.parliament = { ...state.parliament, deadlineWeek: 3 };
  if (state.settings.scenario === "underdog") {
    state.me = { ...state.me, funds: Math.round(state.me.funds * 0.25), members: Math.round(state.me.members * 0.6), unity: 40, trust: 40 };
  }
  state.scorecard = initScorecard(state);
  state.history.push({ week: 0, funds: state.me.funds, seats: projectedSeats(state) });
  state.objectives = newObjectives(state);
  state.bubbles = newBubbles(state);
  state.polls = initPolls(projectAllFor(state), seed, 0, pollError(state));
  return state;
}

/** Parti Bersama joined the game in save version 15: it slots in before Others in coalition-indexed arrays. */
function addBersama(g: GameState): Partial<GameState> {
  const at = COALITION_INDEX.BERSAMA;
  const seatOffsets = g.seatOffsets.map((row) => (row.length < COALITIONS.length ? [...row.slice(0, at), 0, ...row.slice(at)] : row));
  const fresh = initCoalitions();
  const rivals = g.player === "BERSAMA" || g.rivals.BERSAMA ? g.rivals : { ...g.rivals, BERSAMA: initRivals(g.player).BERSAMA };
  const sc = g.scorecard;
  const scorecard = sc.now.BERSAMA ? sc : { ...sc, now: { ...sc.now, BERSAMA: restingScores(g, "BERSAMA") }, start: { ...sc.start, BERSAMA: restingScores(g, "BERSAMA") } };
  return {
    seatOffsets,
    swing: { ...g.swing, BERSAMA: g.swing.BERSAMA ?? 0 },
    coalitions: g.coalitions.BERSAMA ? g.coalitions : { ...g.coalitions, BERSAMA: fresh.BERSAMA },
    rivals,
    scorecard,
  };
}

/** Fills fields added after a save was made, so older saves keep working. */
export function migrateGame(g: GameState): GameState {
  const migrated: GameState = {
    ...g,
    version: SAVE_VERSION,
    me: { ...g.me, policies: g.me.policies ?? {}, mood: g.me.mood ?? {}, budget: g.me.budget ?? {}, favours: g.me.favours ?? 0, momentum: g.me.momentum ?? 0 },
    economy: g.economy ?? ECONOMY_REST,
    fiscal: g.fiscal ?? 50,
    cards: g.cards ?? [],
    cardLast: g.cardLast ?? {},
    budgetDue: g.budgetDue ?? null,
    budgetYear: g.budgetYear ?? null,
    rivals: g.rivals ?? initRivals(g.player),
    dunHolders: g.dunHolders ?? [...DUN_START],
    assemblies: g.assemblies ?? initAssemblies(),
    parliament: g.parliament ?? initParliament(AUTO_DISSOLUTION),
    government: g.government ?? START_GOVERNMENT,
    formation: g.formation ?? null,
    night: g.night ?? null,
    tiers: g.tiers ?? [],
    career: g.career ?? initCareer(g.player, g.seed, "leader"),
    objectives: g.objectives ?? [],
    achievements: g.achievements ?? {},
    settings: g.settings ?? { scenario: "present", difficulty: "normal" },
    bubbles: g.bubbles ?? [],
    polls: g.polls ?? { national: [], seats: [] },
    seatResults: g.seatResults ?? SEATS.map(() => null),
    geCount: g.geCount ?? 15,
    coalitions: g.coalitions ?? initCoalitions(),
    partySat: g.partySat ?? initPartySat(),
    seatParty: g.seatParty ?? {},
    namePending: g.namePending ?? false,
    people: g.people ?? [],
    nextPersonId: g.nextPersonId ?? 1,
    cabinet: g.cabinet ?? {},
    youId: g.youId ?? null,
    race: g.race ?? null,
    team: g.team ?? [],
    teamMarket: g.teamMarket ?? initTeam(g.seed).teamMarket,
    nextStaffId: g.nextStaffId ?? initTeam(g.seed).nextStaffId,
    nation: g.nation ?? initNation(),
    bursa: g.bursa ?? initBursa(),
    personal: g.personal ?? initPersonal(g),
    entries: g.entries ?? {},
    nominations: g.nominations ?? null,
    pacts: g.pacts ?? [],
    issuesTaken: g.issuesTaken ?? {},
    calWeight: g.calWeight ?? 1,
    orders: g.orders ?? [],
    dewan: g.dewan ?? initDewan(),
    lastAnalysis: g.lastAnalysis ?? null,
    agenda: g.agenda ?? null,
    opp: g.opp ?? initOpposition(),
    strategy: g.strategy ?? { theme: null, since: 0 },
    wings: g.wings ?? { youth: WINGS.start, women: WINGS.start },
    funding: g.funding ?? initFunding(),
    roots: g.roots ?? SEATS.map(() => 0),
    converts: g.converts ?? SEATS.map(() => 0),
    scorecard: g.scorecard as Scorecard,
    seatWork: g.seatWork ?? SEATS.map(() => 0),
    battlegrounds: g.battlegrounds ?? {},
    policyLog: g.policyLog ?? [],
  };
  if (!migrated.scorecard) migrated.scorecard = initScorecard(migrated);
  // Saves from before Parti Bersama: give it a place in every per-coalition table.
  if ((g.version ?? 0) < 15) Object.assign(migrated, addBersama(migrated));
  if (!migrated.people.length) Object.assign(migrated, syncYou({ ...migrated, ...initPeople(migrated) }));
  if (!migrated.polls.national.length) migrated.polls = initPolls(projectAllFor(migrated), migrated.seed, migrated.week, pollError(migrated));
  if (!migrated.objectives.length) migrated.objectives = newObjectives(migrated);
  return migrated;
}

/** Your star power: it builds over your first six months (a fresh game starts from the real GE15 map). */
export const starPower = (state: GameState) => (edgeOf(state) - 1) * EFFECT.starPower * Math.min(1, state.week / 26);

/** How hard voters push back on a big majority (log-odds off your national swing). */
// Voters only fear power that can rewrite the Constitution: the check starts at a two-thirds majority.
export const checkOnPower = (state: GameState) => Math.max(0, standing(state) - SUPERMAJORITY) * EFFECT.checkPerSeat;

/** Your national swing from messaging, scandal, integrity, coalition trust and the economy. */
export function playerNationalEffect(state: GameState): number {
  const me = state.me;
  let v = me.nationalBuzz * EFFECT.nationalBuzz - me.scandal * EFFECT.scandal + (me.integrity - 60) * EFFECT.integrity;
  if (me.trust < EFFECT.trustFloor) v -= EFFECT.trustPenalty;
  // The government gets the credit and the blame for the economy; the opposition gains a little from bad times.
  v += (state.economy - ECONOMY_REST) * (isGovernment(state) ? EFFECT.economyGov : -EFFECT.economyOpp);
  // The government's approval: yours to keep in power, theirs to lose in opposition.
  if (state.nation) v += (state.nation.approval - 50) * (isGovernment(state) ? NATION.approvalSwingGov : -NATION.approvalSwingOpp);
  // A wave: momentum lifts you everywhere.
  v += (me.momentum ?? 0) * EFFECT.momentum;
  // Star power: you are the protagonist.
  v += starPower(state);
  // Voters check unchecked power: the bigger your majority, the more they want an opposition.
  v -= checkOnPower(state);
  return v;
}

/** Your extra log-odds in one seat from service, buzz, machinery, policies, budget and the public mood. */
export function playerSeatEffect(state: GameState, i: number, policy?: SegEffects): number {
  const me = state.me;
  const pol = policy ?? policyVoters(me.policies, isGovernment(state));
  // Ground work counts for more when a wave is behind you.
  const ground =
    ((me.service[i] - serviceBase(state.player, i)) * EFFECT.service + me.buzz[i] * EFFECT.buzz + (me.machinery[i] - machineryBase(state.player, i)) * EFFECT.machinery) *
    (1 + (me.momentum ?? 0) / EFFECT.momentumGround) *
    edgeOf(state);
  return (
    ground +
    issueEffect(state, i, isGovernment(state)) +
    messageEffect(state, i) +
    wingsEffect(state, i) +
    (state.roots?.[i] ?? 0) +
    pillarEffect(state, state.player, i) +
    segValue(i, pol) +
    segValue(i, me.budget) +
    segValue(i, me.mood)
  );
}

/** Why you stand where you do in a seat: your log-odds by source (positive helps), for the "why" breakdown. */
export function seatBreakdown(state: GameState, i: number): { label: string; value: number }[] {
  const me = state.me;
  const gov = isGovernment(state);
  const wave = (1 + (me.momentum ?? 0) / EFFECT.momentumGround) * edgeOf(state);
  const pick = state.nominations?.picks[i];
  const pillars = pillarRows(state, state.player, i);
  const rows = [
    { label: "Your policies (as voters see them)", value: pillars.policies },
    { label: "Your principle", value: pillars.principle },
    { label: "Your execution", value: pillars.execution },
    { label: "Your credibility", value: pillars.credibility },
    { label: "National mood (messaging, economy, scandal)", value: playerNationalEffect(state) - (me.momentum ?? 0) * EFFECT.momentum - starPower(state) + checkOnPower(state) + state.swing[state.player] },
    { label: "Momentum", value: (me.momentum ?? 0) * EFFECT.momentum },
    { label: "Your star power", value: starPower(state) },
    { label: "Voters checking your power", value: -checkOnPower(state) },
    { label: "Service", value: (me.service[i] - serviceBase(state.player, i)) * EFFECT.service * wave },
    { label: "Buzz", value: me.buzz[i] * EFFECT.buzz * wave },
    { label: "Machinery", value: (me.machinery[i] - machineryBase(state.player, i)) * EFFECT.machinery * wave },
    { label: "Local issues taken up", value: issueEffect(state, i, gov) },
    { label: "Your message", value: messageEffect(state, i) },
    { label: "Loyal base (roots)", value: state.roots?.[i] ?? 0 },
    { label: "Converted voters", value: Math.log(1 + (state.converts?.[i] ?? 0) / Math.max(0.01, naturalSupport(i, state.player))) },
    { label: "Youth and Wanita wings", value: wingsEffect(state, i) },
    { label: "Candidate", value: pick !== undefined ? candidateStrength(state, i, state.people.find((x) => x.id === pick)) : 0 },
    { label: "Policies, Budget and mood", value: playerSeatEffect(state, i) - ((me.service[i] - serviceBase(state.player, i)) * EFFECT.service + me.buzz[i] * EFFECT.buzz + (me.machinery[i] - machineryBase(state.player, i)) * EFFECT.machinery) * wave - issueEffect(state, i, gov) - messageEffect(state, i) - wingsEffect(state, i) - (state.roots?.[i] ?? 0) - pillarEffect(state, state.player, i) },
  ];
  return rows.filter((r) => Math.abs(r.value) >= 0.005);
}

/** What the voter model sees: rival offsets plus everything the player has built. */
export function voterInputs(state: GameState): VoterInputs {
  const p = COALITION_INDEX[state.player];
  const swing = { ...state.swing, [state.player]: state.swing[state.player] + playerNationalEffect(state) };
  // A coalition left with no parties has no candidates.
  for (const c of COALITIONS) if (state.coalitions && !state.coalitions[c].members.length) swing[c] -= 20;
  const rivals = Object.entries(state.rivals) as [CoalitionId, NonNullable<Rivals[CoalitionId]>][];
  for (const [c, r] of rivals) swing[c] += rivalNationalEffect(r);
  const policy = policyVoters(state.me.policies, isGovernment(state));
  const seatOffsets = state.seatOffsets.map((row, i) => {
    const out = [...row];
    out[p] += playerSeatEffect(state, i, policy);
    // Your party's named candidate carries a personal vote.
    const pick = state.nominations?.picks[i];
    if (pick !== undefined) out[p] += candidateStrength(state, i, state.people.find((x) => x.id === pick && x.party === yourParty(state)));
    for (const [c, r] of rivals) out[COALITION_INDEX[c]] += rivalSeatEffect(r, c, i) + pillarEffect(state, c, i);
    return out;
  });
  return { swing, seatOffsets, entries: state.entries, aside: asideFor(state), calWeight: state.calWeight ?? 1, convertBase: state.converts ? { c: state.player, base: state.converts } : undefined };
}

export function projectedSeats(state: GameState): number {
  return projectAllFor(state).filter((p) => p.leader === state.player).length;
}

export function projectAllFor(state: GameState) {
  return projectAll(voterInputs(state));
}

/** Test election from the current state. Does not change who holds the seats. */
export function simulateElection(state: GameState): GameState {
  const { result, rngState } = runElection(voterInputs(state), state.rng);
  return { ...state, rng: rngState, lastElection: result };
}

/** Is a coalition (you, by default) in the federal government right now? */
export function isGovernment(state: GameState, c: CoalitionId = state.player): boolean {
  return state.government.includes(c);
}

export function seatCounts(holders: CoalitionId[]): Record<CoalitionId, number> {
  const out = Object.fromEntries(COALITIONS.map((c) => [c, 0])) as Record<CoalitionId, number>;
  for (const h of holders) out[h] += 1;
  return out;
}

export function fortressLevel(service: number): string {
  return FORTRESS.find((f) => service >= f.min)!.name;
}

