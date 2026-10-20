// Skip 1 Week: the only place time moves. Skip 1 Month is exactly four of these (see month.ts).

import { DECAY, DIFFICULTY, ECONOMY, ECONOMY_DRIFT, MACC, MOOD_DECAY, PRN, SEAT_SERVICE_PER_WEEK } from "./config";
import { assembliesWeek, campaignStates, stateRulers, weeksToElection } from "./systems/assemblies";
import { DUNS_BY_STATE } from "./systems/dun";
import { autoResolveFormation, changeGovernmentMidTerm, govSeats, tableBudget } from "./actions";
import { careerAfterGE, careerWeek, goalsWeek } from "./progress";
import { newBubbles } from "./systems/bubbles";
import { pollsWeek } from "./systems/polls";
import { coalitionsWeek, syncNames } from "./systems/coalitions";
import { leaderOfParty, peopleMonth, syncYou } from "./systems/people";
import { raceOnOffer, raceOpens, raceWeek } from "./systems/partyrace";
import { CONTEST_POINTS } from "./systems/career";
import { economyScore, nationWeek, projectSeats } from "./systems/nation";
import { projectOpened, wealthWeek } from "./systems/wealth";
import { ROLES, pollError, teamDonations, teamRaidMult, teamSalaries, teamUpkeepMult, teamWeek } from "./systems/team";
import { BUDGET, budgetEnvelope, defaultAllocation, isBudgetWeek } from "./systems/budget";
import { cardsWeek } from "./systems/events";
import { rivalsWeek } from "./systems/rivals";
import { decaySeg } from "./systems/segments";
import { fmtRM } from "./money";
import { Rng, hash01 } from "./rng";
import { isGovernment, machineryBase, projectAllFor, serviceBase, voterInputs, weekDate, type GameState, type ReportLine, type WeekReport } from "./state";
import { ASSETS, CEO, assetIncome, assetRisk, marketWeek } from "./systems/business";
import { MAJORITY, SEATS, STATE_BY_ID, contestingIn, cshort } from "./world";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const HISTORY_LIMIT = 520;

/** This week's money in and out at the current state. Machinery upkeep is separate: it goes unpaid when money runs out. */
export function weeklyCashFlow(s: GameState): { income: WeekReport["income"]; expenses: WeekReport["expenses"]; upkeep: number } {
  const me = s.me;
  const gov = isGovernment(s);
  const held = s.holders.filter((h) => h === s.player).length;
  const income: WeekReport["income"] = [
    { label: "Party dues", amount: Math.round(me.members * ECONOMY.duesPerMember) },
    { label: `Seat allocations (${held} seats)`, amount: held * (gov ? ECONOMY.seatIncomeGov : ECONOMY.seatIncomeOpp) },
  ];
  for (const [id, ruler] of Object.entries(stateRulers(s.dunHolders, s.government)))
    if (ruler === s.player) income.push({ label: `State government (${STATE_BY_ID[id].name})`, amount: DUNS_BY_STATE[id].length * PRN.stateIncomePerSeat });
  for (const a of me.assets) income.push({ label: ASSETS[a.type].name, amount: assetIncome(a, gov, me.market) });
  const expenses: WeekReport["expenses"] = [{ label: "HQ & staff", amount: Math.round(ECONOMY.hqFixed + me.members * ECONOMY.hqPerMember) }];
  if (s.team.length && !s.personal.payTeam) expenses.push({ label: "Your team", amount: teamSalaries(s) });
  const donations = teamDonations(s);
  if (donations) income.push({ label: `Donors (${s.team.find((x) => x.role === "fundraiser")?.name})`, amount: donations });
  const salaries = me.assets.reduce((sum, a) => sum + CEO[a.ceo].salary, 0);
  if (salaries) expenses.push({ label: "Company CEOs", amount: salaries });
  const upkeep = Math.round(
    SEATS.reduce((sum, seat) => sum + (contestingIn(seat).includes(s.player) ? me.machinery[seat.index] : 0), 0) * ECONOMY.machineryUpkeep * teamUpkeepMult(s),
  );
  return { income, expenses, upkeep };
}

export function advanceWeek(input: GameState): GameState {
  // Unfinished government talks resolve before time moves on.
  syncNames(input);
  const s = input.formation ? autoResolveFormation(input) : input;
  const before = projectAllFor(s);
  const gov = isGovernment(s);
  const me = { ...s.me, service: [...s.me.service], buzz: [...s.me.buzz], machinery: [...s.me.machinery], assets: s.me.assets.map((a) => ({ ...a })), policies: { ...s.me.policies } };
  const lines: ReportLine[] = [];
  const contested = SEATS.filter((seat) => contestingIn(seat).includes(s.player)).map((seat) => seat.index);
  const held = s.holders.map((h, i) => (h === s.player ? i : -1)).filter((i) => i >= 0);

  const diff = DIFFICULTY[s.settings.difficulty];
  const { income, expenses, upkeep } = weeklyCashFlow(s);

  const totalIn = income.reduce((x, l) => x + l.amount, 0);
  const fixedOut = expenses.reduce((x, l) => x + l.amount, 0);
  me.funds += totalIn - fixedOut;
  if (me.funds >= upkeep) {
    me.funds -= upkeep;
    expenses.push({ label: "Machinery upkeep", amount: upkeep });
  } else {
    for (const i of contested) me.machinery[i] *= 1 - ECONOMY.machineryDecayUnpaid;
    lines.push({ text: `Couldn't pay ${fmtRM(upkeep)} machinery upkeep: branch workers drift away in every seat.`, tone: "bad" });
  }
  if (me.funds < 0) lines.push({ text: `The party is ${fmtRM(-me.funds)} in debt. Raise funds or sell assets.`, tone: "bad" });

  // Presence: buzz fades, service holds, your MPs keep serving their seats
  for (let i = 0; i < SEATS.length; i++) {
    me.buzz[i] *= 1 - DECAY.buzz * diff.decay;
    const base = serviceBase(s.player, i);
    if (me.service[i] > base) me.service[i] -= (me.service[i] - base) * DECAY.service;
  }
  const perHeld = gov ? SEAT_SERVICE_PER_WEEK.gov : SEAT_SERVICE_PER_WEEK.opp;
  const plantation = me.assets.find((a) => a.type === "plantation");
  for (const i of held) {
    me.service[i] = clamp(me.service[i] + perHeld + (plantation && SEATS[i].demo.urbanity < 0.4 ? 0.1 * plantation.level : 0));
  }
  // States you govern build service in their parliamentary seats
  for (const [id, ruler] of Object.entries(stateRulers(s.dunHolders, s.government)))
    if (ruler === s.player) for (const seat of SEATS) if (seat.state === id) me.service[seat.index] = clamp(me.service[seat.index] + PRN.stateServicePerWeek);
  // As an MP, your constituency allocation keeps building service in your own seat.
  if (s.career.rung >= 2 && s.holders[s.career.homeSeat] === s.player) me.service[s.career.homeSeat] = clamp(me.service[s.career.homeSeat] + 0.5);
  const foundation = me.assets.find((a) => a.type === "foundation");
  if (foundation) for (const i of contested) me.buzz[i] = clamp(me.buzz[i] + 0.4 * foundation.level * (SEATS[i].demo.youth / 0.3));

  me.nationalBuzz *= 1 - DECAY.nationalBuzz * diff.decay;
  // Your team: a press secretary buries scandals, a lawyer calms MACC, a social media lead keeps the young listening.
  const skill = (r: keyof typeof ROLES) => s.team.filter((x) => x.role === r).reduce((m, x) => Math.max(m, x.skill), 0);
  me.scandal *= 1 - DECAY.scandal - skill("press") * 0.02;
  me.risk = clamp(me.risk - skill("legal") * 0.4);
  if (skill("social")) me.mood = { ...me.mood, youth: Math.min(0.08, (me.mood.youth ?? 0) + skill("social") * 0.002) };

  // Party
  me.unity += (DECAY.unityRest - me.unity) * DECAY.unityDrift;
  const koperasi = me.assets.find((a) => a.type === "koperasi");
  if (koperasi) {
    me.unity += 0.3 * koperasi.level;
    me.members = Math.round(me.members * (1 + 0.001 * koperasi.level));
  }
  me.unity = clamp(me.unity);
  me.integrity = clamp(me.integrity + (DECAY.integrityRest - me.integrity) * DECAY.integrityDrift);
  me.capital = clamp(me.capital + 1, 0, 200);
  me.fundFatigue = Math.max(0, me.fundFatigue - ECONOMY.fatigueRecovery);

  // MACC risk: opaque companies and crony CEOs keep it climbing
  const assetRiskSum = me.assets.reduce((sum, a) => sum + assetRisk(a, gov), 0);
  me.risk = clamp(me.risk + assetRiskSum - DECAY.riskPerWeek);
  const rng = new Rng(s.rng);
  const roll = rng.next(); // always one draw per week
  if (roll < (Math.max(0, me.risk - MACC.threshold) / MACC.divisor) * diff.raids * teamRaidMult(s)) {
    const fine = Math.round(Math.max(0, me.funds) * MACC.fineShare);
    me.funds -= fine;
    me.integrity = clamp(me.integrity - MACC.integrityHit);
    me.scandal = clamp(me.scandal + MACC.scandal);
    me.risk = clamp(me.risk - 20);
    lines.push({ text: `MACC raids a party office. Accounts frozen and ${fmtRM(fine)} seized; the scandal is front-page news.`, tone: "bad" });
  }

  // Markets
  const moved = marketWeek(me.assets, me.market, s.seed, s.week);
  me.assets = moved.assets;
  me.market = moved.market;

  // Public reactions and budget measures fade; the economy drifts back toward normal
  me.mood = decaySeg(me.mood, MOOD_DECAY);
  me.budget = decaySeg(me.budget, BUDGET.decay);
  // The country: indicators drift toward where policy, ministers, projects and crises push them
  const nw = nationWeek(s);
  lines.push(...nw.lines);
  const economy = economyScore(nw.nation);
  const fiscal = clamp(s.fiscal + (50 - s.fiscal) * ECONOMY_DRIFT.fiscal + nw.fiscal);
  // A project opening: the government that built it gets the credit in the seats it serves.
  if (gov) for (const def of nw.opened) for (const i of projectSeats(def)) if (contestingIn(SEATS[i]).includes(s.player)) me.service[i] = clamp(me.service[i] + 3);

  // Rival parties campaign, defend and attack, using this week's starting projections
  const ai = rivalsWeek({
    rivals: s.rivals,
    player: s.player,
    playerTrust: me.trust,
    playerBuzz: s.me.buzz,
    holders: s.holders,
    week: s.week,
    seed: s.seed,
    projections: before,
    weeksToElection: weeksToElection(s),
    campaignStates: campaignStates(s),
    rulers: stateRulers(s.dunHolders, s.government),
    government: s.government,
    aggression: diff.aiAggression,
  });
  me.nationalBuzz = clamp(me.nationalBuzz + ai.playerBuzzHit);
  me.scandal = clamp(me.scandal + ai.playerScandalHit);
  lines.push(...ai.lines);

  me.ap = me.apMax;
  let next: GameState = { ...s, me, rng: rng.state, week: s.week + 1, economy, fiscal, rivals: ai.rivals, nation: nw.nation };

  // The Budget: due in the second week of October; officials table a default if the government doesn't
  const year = weekDate(next.week).getFullYear();
  if (next.budgetDue !== null && next.week - next.budgetDue >= BUDGET.window) {
    if (gov) {
      const r = tableBudget(next, defaultAllocation(budgetEnvelope(next.fiscal)), true);
      if (r.ok) {
        next = r.state;
        lines.push({ text: r.message, tone: "info" });
      }
    } else {
      next = { ...next, budgetDue: null, budgetYear: year };
      lines.push({ text: "The Budget debate is over without a shadow budget from you.", tone: "info" });
    }
  }
  if (next.budgetDue === null && next.budgetYear !== year && isBudgetWeek(weekDate(next.week))) {
    next = { ...next, budgetDue: next.week };
    lines.push({ text: gov ? `Budget ${year + 1} is due in the Dewan. Allocate it in the Policy tab.` : `Budget ${year + 1} is being tabled. You can answer with a shadow budget.`, tone: "info" });
  }

  // Decision cards: expire old ones, then festivals and news
  const cards = cardsWeek(next);
  next = cards.state;
  lines.push(...cards.lines);

  // Dissolutions and polling days for Parliament and the state assemblies
  const polls = assembliesWeek(next, voterInputs(next));
  next = polls.state;
  lines.push(...polls.lines);
  if (next.night && next.night.week === next.week) {
    const ge = careerAfterGE(next, next.night.prevHolders);
    next = ge.state;
    lines.push(...ge.lines);
  }

  // Your team: experience, loyalty (unpaid staff sulk), poaching and leaks
  // Your money: shares, dividends, rent and mortgages (the party's land bank pays into the war chest)
  const wl = wealthWeek(next);
  next = wl.state;
  for (const def of nw.opened) next = projectOpened(next, def.id);
  next = { ...next, me: { ...next.me, funds: next.me.funds + wl.partyIncome, integrity: clamp(next.me.integrity + wl.integrity) } };
  if (next.personal.payTeam) next = { ...next, personal: { ...next.personal, cash: next.personal.cash - teamSalaries(next) } };
  lines.push(...wl.lines);

  const tw = teamWeek(next, next.personal.payTeam ? next.personal.cash >= 0 : s.me.funds >= 0);
  next = { ...tw.state, me: { ...tw.state.me, scandal: clamp(tw.state.me.scandal + tw.scandal) } };
  lines.push(...tw.lines);

  // Coalitions: partners' satisfaction, walkouts, and seat talks once Parliament is dissolved
  const coal = coalitionsWeek(next);
  next = coal.state;
  lines.push(...coal.lines);
  const CARD_NEWS: Record<string, string> = { seatTalks: "seat talks with your partners", partnerWalkout: "a partner threatens to walk out", deputyRestless: "your deputy is on the move", mpJump: "an MP is thinking of jumping", partyRace: "party elections are open", appointment: "a call from the party president", crisis: "a national crisis" };
  const addCard = (kind: string, party?: string, person?: number, seat?: number) => {
    const id = Math.max(0, ...next.cards.map((c) => c.id), next.week * 10) + 1;
    next = { ...next, cards: [...next.cards, { id, kind, week: next.week, deadline: next.week + 2, party, person, seat }], cardLast: { ...next.cardLast, [kind]: next.week } };
    lines.push({ text: `Needs you: ${CARD_NEWS[kind]}.`, tone: "info" });
  };
  if (coal.warn && next.cards.length < 4) addCard("partnerWalkout", coal.warn);
  if (nw.crisis) addCard("crisis");
  if (next.cards.length < 4 && next.parliament.status === "campaign" && next.coalitions[next.player].members.length > 1 && (next.cardLast.seatTalks ?? -99) < next.week - 12) addCard("seatTalks");

  // People: age, standing, retirements and successions
  const ppl = peopleMonth(next);
  next = ppl.state;
  lines.push(...ppl.lines);
  if (next.week % 4 === 2 && next.cards.length < 4) {
    const lead = next.coalitions[next.player].members[0];
    const mine = next.coalitions[next.player].members;
    const you = next.people.find((p) => p.id === next.youId);
    const deputy = next.people.find((p) => p.party === lead && p.rank === 4);
    const jumper = next.people.find((p) => p.seat !== null && p.id !== next.youId && mine.includes(p.party) && next.holders[p.seat] === next.player && p.loyalty < 18 && !p.retired);
    if (you?.rank === 5 && deputy && deputy.loyalty < 30 && deputy.ambition > 55 && (next.cardLast.deputyRestless ?? -99) < next.week - 26) addCard("deputyRestless", undefined, deputy.id);
    else if (jumper && hash01("jump", next.seed, next.week) < 0.35 && (next.cardLast.mpJump ?? -99) < next.week - 12) addCard("mpJump", undefined, jumper.id, jumper.seat!);
  }

  // Party elections: the race opens in mid-May; rivals campaign; the vote is at the AGM
  if (next.race?.result && next.week > next.race.voteWeek) next = { ...next, race: null };
  const race = raceWeek(next);
  next = race.state;
  lines.push(...race.lines);
  if (!next.race && raceOpens(next.week) && raceOnOffer(next) && next.cards.length < 4) addCard("partyRace");
  // Ministerial posts are in the president's gift: a loyal president appoints you once you have earned it.
  const c0 = next.career;
  if (next.week % 4 === 1 && (c0.rung === 2 || c0.rung === 3) && c0.points >= CONTEST_POINTS[c0.rung] && next.cards.length < 4 && (next.cardLast.appointment ?? -99) < next.week - 12) {
    const pres = leaderOfParty(next, next.coalitions[next.player].members[0]);
    if (pres && pres.id !== next.youId && pres.loyalty >= 45) addCard("appointment", undefined, pres.id);
  }

  // An unpopular government's partners may walk out; if it loses its majority, it falls.
  if (next.week % 4 === 1 && next.parliament.status === "sitting" && next.nation.approval < 32 && !next.formation) {
    const quitter = next.government.find((c) => c !== next.parliament.pm && c !== next.player && c !== "OTHERS" && hash01("quitgov", next.seed, next.week, c) < 0.12);
    if (quitter) {
      next = { ...next, government: next.government.filter((c) => c !== quitter) };
      lines.push({ text: `${cshort(quitter)} pulls out of the government, blaming its record.`, tone: next.government.includes(next.player) ? "bad" : "good" });
      if (govSeats(next) < MAJORITY) {
        lines.push({ text: "The government has lost its majority. The Agong calls party leaders to the palace.", tone: "info" });
        next = changeGovernmentMidTerm(next);
      }
    }
  }

  // Your career, term objectives and achievements
  const career = careerWeek(next);
  next = syncYou(career.state, lines);
  next = { ...next, me: { ...next.me, ap: next.me.apMax } };
  lines.push(...career.lines);
  // New opportunity bubbles (last week's expire unclaimed)
  next = { ...next, bubbles: newBubbles(next) };
  const goals = goalsWeek(next);
  next = goals.state;
  lines.push(...goals.lines);

  // Polls: a national poll every four weeks, branch reports where your machinery is strong
  const after = projectAllFor(next);
  next = { ...next, polls: pollsWeek(next.polls, after, next.seed, next.week, next.player, next.me.machinery, pollError(next)) };

  // Report (seat counts are what the latest national poll says, not the hidden truth)
  const seatsBefore = s.polls.national[0]?.seats[s.player] ?? 0;
  const seatsAfter = next.polls.national[0]?.seats[s.player] ?? 0;
  const movers = SEATS.map((seat) => ({ seatIndex: seat.index, delta: (after[seat.index].shares[s.player] ?? 0) - (before[seat.index].shares[s.player] ?? 0) }))
    .filter((m) => Math.abs(m.delta) > 0.0005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);
  const fadedBuzz = s.me.buzz.reduce((x, b) => x + b, 0) * DECAY.buzz * diff.decay;
  if (fadedBuzz > 5) lines.unshift({ text: `Buzz is fading: last week's rallies count for about ${Math.round(DECAY.buzz * diff.decay * 100)}% less.`, tone: "info" });
  const poll = next.polls.national[0];
  if (poll && poll.week === next.week && poll !== s.polls.national[0]) {
    const d = seatsAfter - seatsBefore;
    lines.unshift({ text: `New ${poll.pollster} poll: you would win about ${seatsAfter} seats${d ? ` (${d > 0 ? "+" : "−"}${Math.abs(d)} since the last poll)` : ", no change"}.`, tone: d > 0 ? "good" : d < 0 ? "bad" : "info" });
  }
  for (const i of contested) {
    if (me.machinery[i] < machineryBase(s.player, i) * 0.6 && s.me.machinery[i] >= machineryBase(s.player, i) * 0.6) {
      lines.push({ text: `Machinery in ${SEATS[i].name} has collapsed below 60% of its starting strength.`, tone: "bad" });
    }
  }

  next.report = { week: next.week, income, expenses, seatsBefore, seatsAfter, movers, lines };
  next.history = [...s.history, { week: next.week, funds: Math.round(me.funds), seats: seatsAfter }].slice(-HISTORY_LIMIT);
  return next;
}
