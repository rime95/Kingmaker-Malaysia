// Skip 1 Week: the only place time moves. Skip 1 Month is exactly four of these (see month.ts).

import { DECAY, ECONOMY, ECONOMY_DRIFT, ECONOMY_REST, MACC, MOOD_DECAY, SEAT_SERVICE_PER_WEEK } from "./config";
import { tableBudget } from "./actions";
import { BUDGET, budgetEnvelope, defaultAllocation, isBudgetWeek } from "./systems/budget";
import { cardsWeek } from "./systems/events";
import { decaySeg } from "./systems/segments";
import { fmtRM } from "./money";
import { Rng, hash01 } from "./rng";
import { isGovernment, machineryBase, projectAllFor, serviceBase, weekDate, type GameState, type ReportLine, type WeekReport } from "./state";
import { ASSETS, CEO, assetIncome, assetRisk, marketWeek } from "./systems/business";
import { SEATS, contestingIn } from "./world";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const HISTORY_LIMIT = 520;

/** This week's money in and out at the current state. Machinery upkeep is separate: it goes unpaid when money runs out. */
export function weeklyCashFlow(s: GameState): { income: WeekReport["income"]; expenses: WeekReport["expenses"]; upkeep: number } {
  const me = s.me;
  const gov = isGovernment(s.player);
  const held = s.holders.filter((h) => h === s.player).length;
  const income: WeekReport["income"] = [
    { label: "Party dues", amount: Math.round(me.members * ECONOMY.duesPerMember) },
    { label: `Seat allocations (${held} seats)`, amount: held * (gov ? ECONOMY.seatIncomeGov : ECONOMY.seatIncomeOpp) },
  ];
  for (const a of me.assets) income.push({ label: ASSETS[a.type].name, amount: assetIncome(a, gov, me.market) });
  const expenses: WeekReport["expenses"] = [{ label: "HQ & staff", amount: Math.round(ECONOMY.hqFixed + me.members * ECONOMY.hqPerMember) }];
  const salaries = me.assets.reduce((sum, a) => sum + CEO[a.ceo].salary, 0);
  if (salaries) expenses.push({ label: "Company CEOs", amount: salaries });
  const upkeep = Math.round(
    SEATS.reduce((sum, seat) => sum + (contestingIn(seat).includes(s.player) ? me.machinery[seat.index] : 0), 0) * ECONOMY.machineryUpkeep,
  );
  return { income, expenses, upkeep };
}

export function advanceWeek(s: GameState): GameState {
  const before = projectAllFor(s);
  const gov = isGovernment(s.player);
  const me = { ...s.me, service: [...s.me.service], buzz: [...s.me.buzz], machinery: [...s.me.machinery], assets: s.me.assets.map((a) => ({ ...a })), policies: { ...s.me.policies } };
  const lines: ReportLine[] = [];
  const contested = SEATS.filter((seat) => contestingIn(seat).includes(s.player)).map((seat) => seat.index);
  const held = s.holders.map((h, i) => (h === s.player ? i : -1)).filter((i) => i >= 0);

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
    me.buzz[i] *= 1 - DECAY.buzz;
    const base = serviceBase(s.player, i);
    if (me.service[i] > base) me.service[i] -= (me.service[i] - base) * DECAY.service;
  }
  const perHeld = gov ? SEAT_SERVICE_PER_WEEK.gov : SEAT_SERVICE_PER_WEEK.opp;
  const plantation = me.assets.find((a) => a.type === "plantation");
  for (const i of held) {
    me.service[i] = clamp(me.service[i] + perHeld + (plantation && SEATS[i].demo.urbanity < 0.4 ? 0.1 * plantation.level : 0));
  }
  const foundation = me.assets.find((a) => a.type === "foundation");
  if (foundation) for (const i of contested) me.buzz[i] = clamp(me.buzz[i] + 0.4 * foundation.level * (SEATS[i].demo.youth / 0.3));

  me.nationalBuzz *= 1 - DECAY.nationalBuzz;
  me.scandal *= 1 - DECAY.scandal;

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
  if (roll < Math.max(0, me.risk - MACC.threshold) / MACC.divisor) {
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
  const economy = clamp(s.economy + (ECONOMY_REST - s.economy) * ECONOMY_DRIFT.economy + (hash01("economy", s.seed, s.week) - 0.5) * ECONOMY_DRIFT.noise);
  const fiscal = clamp(s.fiscal + (50 - s.fiscal) * ECONOMY_DRIFT.fiscal);

  me.ap = me.apMax;
  let next: GameState = { ...s, me, rng: rng.state, week: s.week + 1, economy, fiscal };

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

  // Report
  const after = projectAllFor(next);
  const seatsBefore = before.filter((p) => p.leader === s.player).length;
  const seatsAfter = after.filter((p) => p.leader === s.player).length;
  const movers = SEATS.map((seat) => ({ seatIndex: seat.index, delta: (after[seat.index].shares[s.player] ?? 0) - (before[seat.index].shares[s.player] ?? 0) }))
    .filter((m) => Math.abs(m.delta) > 0.0005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);
  const fadedBuzz = s.me.buzz.reduce((x, b) => x + b, 0) * DECAY.buzz;
  if (fadedBuzz > 5) lines.unshift({ text: `Buzz is fading: last week's rallies count for about ${Math.round(DECAY.buzz * 100)}% less.`, tone: "info" });
  if (seatsAfter !== seatsBefore)
    lines.unshift({ text: `If the election were held today you would win ${seatsAfter} seats (${seatsAfter > seatsBefore ? "+" : "−"}${Math.abs(seatsAfter - seatsBefore)}).`, tone: seatsAfter > seatsBefore ? "good" : "bad" });
  for (const i of contested) {
    if (me.machinery[i] < machineryBase(s.player, i) * 0.6 && s.me.machinery[i] >= machineryBase(s.player, i) * 0.6) {
      lines.push({ text: `Machinery in ${SEATS[i].name} has collapsed below 60% of its starting strength.`, tone: "bad" });
    }
  }

  next.report = { week: next.week, income, expenses, seatsBefore, seatsAfter, movers, lines };
  next.history = [...s.history, { week: next.week, funds: Math.round(me.funds), seats: seatsAfter }].slice(-HISTORY_LIMIT);
  return next;
}
