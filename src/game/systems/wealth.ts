// Two wallets: the party's war chest (me.funds) and your own money (personal).
// - Personal money buys shares and property, pays your team if you choose, and can be donated to the party.
// - Property is bought by state (condos, terraces, shoplots, kebun land, offices), earns rent, can be mortgaged, and
//   moves with the state's economy and the projects your government builds there. The party owns a land bank too.
// - Wealth you haven't declared draws whispers: once your fortune has grown by RM 5M, integrity slips every week
//   until you publish an asset declaration (good for a year).
// Property mechanics (prices × index, yield-based rent, occupancy, mortgages at the OPR + 2%, early-payoff fee, sale
// fee) are adapted from Grounds Up. Prices move with hash01. All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { SEATS, STATES, STATE_BY_ID, type CoalitionId } from "../world";
import { BURSA, POLICY_SECTOR, affordable, buyFill, bursaWeek, sellFill, type Holding, type Sector, type StockOrder } from "./bursa";
import { projectStates, PROJECT_BY_ID } from "./nation";

export type Owner = "personal" | "party";

export interface PropertyDef {
  id: string;
  name: string;
  state: string;
  kind: "condo" | "terrace" | "shoplot" | "kebun" | "office";
  unitPrice0: number;
  /** Gross rent a year, as a share of the price. */
  yield: number;
  /** Price growth a year. */
  appreciation: number;
  units: number;
}

export interface PropertyHolding {
  id: string;
  owner: Owner;
  units: number;
  cost: number;
  boughtWeek: number;
  loan: { principal: number; weeksLeft: number; startWeek: number } | null;
}

export interface Personal {
  cash: number;
  portfolio: Record<string, Holding>;
  orders: StockOrder[];
  nextOrderId: number;
  /** Recent buys, for the insider-trading check. */
  buys: { week: number; sector: Sector }[];
  properties: PropertyHolding[];
  /** Property price index by state (1 = start). */
  index: Record<string, number>;
  dividends: number;
  /** Net worth when the game began (to measure what you have gained). */
  startWorth: number;
  /** Week of your last public asset declaration. */
  declaredWeek: number | null;
  /** Pay your team's salaries from your own pocket. */
  payTeam: boolean;
}

export const WEALTH = {
  maxLtv: 0.7,
  mortgageSpread: 0.02,
  termWeeks: 20 * 52,
  lockInWeeks: 3 * 52,
  earlyFee: 0.02,
  saleFee: 0.02,
  upkeepPerYear: 0.0025,
  occupancy: 0.92,
  monthlyNoise: 0.012,
  projectBuildingBoost: 0.0015,
  projectOpenBoost: 0.04,
  undeclaredGain: 5_000_000,
  undeclaredIntegrity: 0.05,
  declareIntegrity: 3,
  declareEvery: 52,
  /** Career points for every RM 500k you donate to the party (up to 3 at a time). */
  donationPerPoint: 500_000,
  startCash: { leader: 3_000_000, career: 150_000 },
};

const STATE_PRICE: Record<string, number> = { KUL: 1.5, SGR: 1.2, PNG: 1.25, JHR: 1.0, PJY: 1.1, MLK: 0.85, NSN: 0.85, PRK: 0.75, KDH: 0.65, PLS: 0.55, KTN: 0.6, TRG: 0.65, PHG: 0.7, SBH: 0.8, SWK: 0.8, LBN: 0.75 };
const TEMPLATES: { kind: PropertyDef["kind"]; label: string; unitPrice: number; yield: number; appreciation: number; units: number; where: (id: string) => boolean }[] = [
  { kind: "condo", label: "Residensi", unitPrice: 450_000, yield: 0.05, appreciation: 0.035, units: 40, where: (id) => ["KUL", "SGR", "PNG", "JHR", "SBH", "SWK", "PJY"].includes(id) },
  { kind: "terrace", label: "Taman terrace homes", unitPrice: 520_000, yield: 0.045, appreciation: 0.04, units: 20, where: (id) => id !== "KUL" && id !== "PJY" },
  { kind: "shoplot", label: "Shoplots", unitPrice: 1_100_000, yield: 0.065, appreciation: 0.03, units: 12, where: () => true },
  { kind: "kebun", label: "Kebun sawit (10 acres)", unitPrice: 350_000, yield: 0.035, appreciation: 0.05, units: 30, where: (id) => !["KUL", "PJY", "PNG", "LBN"].includes(id) },
  { kind: "office", label: "Office block floor", unitPrice: 6_000_000, yield: 0.07, appreciation: 0.025, units: 10, where: (id) => ["KUL", "SGR", "PNG", "JHR"].includes(id) },
];

/** Every property on the market (the same in every game). */
export const PROPERTIES: PropertyDef[] = STATES.flatMap((st) =>
  TEMPLATES.filter((t) => t.where(st.id)).map((t) => {
    const town = SEATS.filter((s) => s.state === st.id).sort((a, b) => b.demo.urbanity - a.demo.urbanity)[t.kind === "kebun" ? 3 : 0] ?? SEATS.find((s) => s.state === st.id)!;
    return {
      id: `${st.id}-${t.kind}`,
      name: `${town.name} ${t.label}`,
      state: st.id,
      kind: t.kind,
      unitPrice0: Math.round((t.unitPrice * (STATE_PRICE[st.id] ?? 0.8)) / 1000) * 1000,
      yield: t.yield,
      appreciation: t.appreciation,
      units: t.units,
    };
  }),
);
export const PROPERTY_BY_ID: Record<string, PropertyDef> = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));

export const unitPrice = (s: Pick<GameState, "personal">, def: PropertyDef) => Math.round(def.unitPrice0 * (s.personal.index[def.state] ?? 1));

/** Where each party keeps its land bank (a stronghold state). */
const LAND_BANK_STATE: Partial<Record<CoalitionId, string>> = { PH: "SGR", BN: "PHG", PN: "KTN", GPS: "SWK", GRS: "SBH", WARISAN: "SBH", MUDA: "JHR" };

export function initPersonal(s: Pick<GameState, "player" | "career">): Personal {
  const cash = s.career.mode === "leader" ? WEALTH.startCash.leader : WEALTH.startCash.career;
  const landState = LAND_BANK_STATE[s.player] ?? "PRK";
  const land = PROPERTY_BY_ID[`${landState}-kebun`] ?? PROPERTY_BY_ID["PRK-kebun"];
  const properties: PropertyHolding[] = [{ id: land.id, owner: "party", units: 8, cost: land.unitPrice0 * 8, boughtWeek: 0, loan: null }];
  return { cash, portfolio: {}, orders: [], nextOrderId: 1, buys: [], properties, index: Object.fromEntries(STATES.map((x) => [x.id, 1])), dividends: 0, startWorth: cash, declaredWeek: null, payTeam: false };
}

/** Your personal net worth: cash, shares and property less mortgages. */
export function netWorth(s: Pick<GameState, "personal" | "bursa">, owner: Owner = "personal"): number {
  const p = s.personal;
  const shares = owner === "personal" ? Object.entries(p.portfolio).reduce((sum, [t, h]) => sum + (s.bursa.find((x) => x.ticker === t)?.price ?? 0) * h.shares, 0) : 0;
  const property = p.properties.filter((h) => h.owner === owner).reduce((sum, h) => sum + unitPrice(s, PROPERTY_BY_ID[h.id]) * h.units - (h.loan?.principal ?? 0), 0);
  return (owner === "personal" ? p.cash : 0) + shares + property;
}

const loanRate = (s: Pick<GameState, "nation">) => (s.nation.opr + WEALTH.mortgageSpread * 100) / 100;

/** Weekly: share prices and orders, dividends, rent and mortgages, monthly property prices, undeclared wealth. */
export function wealthWeek(s: GameState): { state: GameState; partyIncome: number; lines: ReportLine[]; integrity: number } {
  const lines: ReportLine[] = [];
  const b = bursaWeek(s);
  lines.push(...b.lines);
  let personal: Personal = { ...s.personal, cash: s.personal.cash + b.dividends, dividends: s.personal.dividends + b.dividends };
  let state: GameState = { ...s, bursa: b.stocks, personal };

  // Standing orders fill at this week's close.
  const keep: StockOrder[] = [];
  for (const o of personal.orders) {
    const st = state.bursa.find((x) => x.ticker === o.ticker)!;
    const held = state.personal.portfolio[o.ticker]?.shares ?? 0;
    if (o.kind === "buyBelow") {
      if (st.price > o.trigger) {
        keep.push(o);
        continue;
      }
      const n = Math.min(o.shares, affordable(st, state.personal.cash));
      if (n > 0) {
        const r = buyShares(state, o.ticker, n);
        if (r.ok) state = r.state;
        lines.push({ text: `Buy-below order filled: ${n.toLocaleString("en-MY")} ${o.ticker} at RM ${st.price.toFixed(2)}.`, tone: "good" });
      }
      continue;
    }
    const n = Math.min(o.shares, held);
    if (n <= 0) continue;
    const hit = o.kind === "stopLoss" ? st.price <= o.trigger : st.price >= o.trigger;
    if (!hit) {
      keep.push({ ...o, shares: n });
      continue;
    }
    const r = sellShares(state, o.ticker, n);
    if (r.ok) state = r.state;
    lines.push({ text: `${o.kind === "stopLoss" ? "Stop-loss" : "Take-profit"} sold ${n.toLocaleString("en-MY")} ${o.ticker} at RM ${st.price.toFixed(2)}.`, tone: o.kind === "stopLoss" ? "bad" : "good" });
  }
  personal = { ...state.personal, orders: keep };

  // Rent, upkeep and mortgages.
  let partyIncome = 0;
  const rate = loanRate(s);
  personal.properties = personal.properties.map((h) => {
    const def = PROPERTY_BY_ID[h.id];
    const value = unitPrice(state, def) * h.units;
    let net = (value * def.yield * WEALTH.occupancy - value * WEALTH.upkeepPerYear) / 52;
    let loan = h.loan;
    if (loan) {
      const repay = loan.principal / Math.max(1, loan.weeksLeft);
      net -= (loan.principal * rate) / 52 + repay;
      loan = loan.weeksLeft <= 1 ? null : { ...loan, principal: loan.principal - repay, weeksLeft: loan.weeksLeft - 1 };
    }
    if (h.owner === "party") partyIncome += net;
    else personal.cash += net;
    return { ...h, loan };
  });

  // Monthly property prices: the state's economy, noise, and projects being built there.
  if (s.week % 4 === 3) {
    const index = { ...personal.index };
    for (const st of STATES) {
      const building = s.nation.projects.filter((p) => !p.done && PROJECT_BY_ID[p.id].states.includes(st.id)).length;
      const growth = 0.035 / 12 + (s.nation.gdp - 4.4) * 0.001 - (s.nation.opr - 2.75) * 0.001 + building * WEALTH.projectBuildingBoost + (hash01("prop", s.seed, s.week, st.id) - 0.5) * WEALTH.monthlyNoise;
      index[st.id] = Math.max(0.5, (index[st.id] ?? 1) * (1 + growth));
    }
    personal.index = index;
  }
  personal.buys = personal.buys.filter((x) => s.week - x.week <= BURSA.insiderWeeks);
  state = { ...state, personal };

  // Undeclared wealth.
  let integrity = 0;
  const gained = netWorth(state) - personal.startWorth;
  if (gained > WEALTH.undeclaredGain && (personal.declaredWeek === null || s.week - personal.declaredWeek > WEALTH.declareEvery)) {
    integrity = -WEALTH.undeclaredIntegrity;
    if (s.week % 13 === 0) lines.push({ text: "The papers ask how you got so rich. Publishing your assets would quiet them.", tone: "bad" });
  }
  return { state, partyIncome, lines, integrity };
}

/** A project opening lifts property prices in the states it serves. */
export function projectOpened(s: GameState, projectId: string): GameState {
  const def = PROJECT_BY_ID[projectId];
  const index = { ...s.personal.index };
  for (const st of def.states) index[st] = (index[st] ?? 1) * (1 + WEALTH.projectOpenBoost);
  return { ...s, personal: { ...s.personal, index } };
}

// --- Trading -------------------------------------------------------------------------------------

type R = { ok: true; state: GameState; message: string } | { ok: false; error: string };

export function buyShares(s: GameState, ticker: string, n: number): R {
  const st = s.bursa.find((x) => x.ticker === ticker);
  if (!st) return { ok: false, error: "Not listed." };
  n = Math.floor(n);
  if (n <= 0) return { ok: false, error: "Enter a number of shares." };
  const fill = buyFill(st, n);
  const cost = fill * n * (1 + BURSA.fee);
  if (cost > s.personal.cash) return { ok: false, error: `That costs RM ${Math.round(cost).toLocaleString("en-MY")}; you have RM ${Math.round(s.personal.cash).toLocaleString("en-MY")}.` };
  const h = s.personal.portfolio[ticker] ?? { shares: 0, cost: 0 };
  const bursa = s.bursa.map((x) => (x.ticker === ticker ? { ...x, price: Math.round(x.price * (1 + (BURSA.impact * n) / x.shares) * 100) / 100 } : x));
  return {
    ok: true,
    state: {
      ...s,
      bursa,
      personal: {
        ...s.personal,
        cash: s.personal.cash - cost,
        portfolio: { ...s.personal.portfolio, [ticker]: { shares: h.shares + n, cost: h.cost + cost } },
        buys: [...s.personal.buys, { week: s.week, sector: st.sector }],
      },
    },
    message: `Bought ${n.toLocaleString("en-MY")} ${ticker} at RM ${fill.toFixed(2)}.`,
  };
}

export function sellShares(s: GameState, ticker: string, n: number): R {
  const st = s.bursa.find((x) => x.ticker === ticker);
  const h = s.personal.portfolio[ticker];
  n = Math.floor(n);
  if (!st || !h || h.shares < n || n <= 0) return { ok: false, error: "You don't own that many shares." };
  const fill = sellFill(st, n);
  const proceeds = fill * n * (1 - BURSA.fee);
  const portfolio = { ...s.personal.portfolio };
  if (h.shares === n) delete portfolio[ticker];
  else portfolio[ticker] = { shares: h.shares - n, cost: (h.cost * (h.shares - n)) / h.shares };
  const bursa = s.bursa.map((x) => (x.ticker === ticker ? { ...x, price: Math.max(0.05, Math.round(x.price * (1 - (BURSA.impact * n) / x.shares) * 100) / 100) } : x));
  return { ok: true, state: { ...s, bursa, personal: { ...s.personal, cash: s.personal.cash + proceeds, portfolio } }, message: `Sold ${n.toLocaleString("en-MY")} ${ticker} at RM ${fill.toFixed(2)}.` };
}

export function placeOrder(s: GameState, ticker: string, kind: StockOrder["kind"], trigger: number, shares: number): R {
  const st = s.bursa.find((x) => x.ticker === ticker);
  if (!st) return { ok: false, error: "Not listed." };
  const n = Math.floor(shares);
  if (n <= 0 || !(trigger > 0)) return { ok: false, error: "Enter shares and a trigger price." };
  if (kind === "stopLoss" && trigger >= st.price) return { ok: false, error: "A stop-loss must be below today's price." };
  if (kind === "takeProfit" && trigger <= st.price) return { ok: false, error: "A take-profit must be above today's price." };
  if (kind === "buyBelow" && trigger >= st.price) return { ok: false, error: "A buy-below order must be under today's price." };
  if (kind !== "buyBelow" && (s.personal.portfolio[ticker]?.shares ?? 0) < n) return { ok: false, error: "You don't hold that many." };
  const o: StockOrder = { id: s.personal.nextOrderId, ticker, kind, trigger: Math.round(trigger * 100) / 100, shares: n };
  return { ok: true, state: { ...s, personal: { ...s.personal, orders: [...s.personal.orders, o], nextOrderId: o.id + 1 } }, message: "Order placed." };
}

export function cancelOrder(s: GameState, id: number): R {
  return { ok: true, state: { ...s, personal: { ...s.personal, orders: s.personal.orders.filter((o) => o.id !== id) } }, message: "Order cancelled." };
}

/**
 * Insider trading: you bought into a sector in the weeks before your own government moved it.
 * MACC takes an interest, and sometimes the press finds out.
 */
export function insiderCheck(s: GameState, sector: Sector, why: string): { state: GameState; line: string | null } {
  if (!s.personal.buys.some((b) => b.sector === sector && s.week - b.week <= BURSA.insiderWeeks)) return { state: s, line: null };
  const exposed = hash01("insider", s.seed, s.week, sector) < BURSA.exposeChance;
  const me = { ...s.me, risk: Math.min(100, s.me.risk + BURSA.insiderRisk), integrity: Math.max(0, s.me.integrity + BURSA.insiderIntegrity), scandal: Math.min(100, s.me.scandal + (exposed ? BURSA.exposeScandal : 0)) };
  return {
    state: { ...s, me },
    line: exposed ? `Exposé: you bought ${sector.toLowerCase()} shares weeks before ${why}. MACC opens a file.` : `You bought ${sector.toLowerCase()} shares weeks before ${why}. MACC has noticed.`,
  };
}

export const policySector = (policyId: string) => POLICY_SECTOR[policyId];

// --- Property ------------------------------------------------------------------------------------

export function buyProperty(s: GameState, id: string, units: number, owner: Owner, ltv: number): R {
  const def = PROPERTY_BY_ID[id];
  if (!def) return { ok: false, error: "Not on the market." };
  units = Math.floor(units);
  const owned = s.personal.properties.filter((h) => h.id === id).reduce((n, h) => n + h.units, 0);
  if (units <= 0 || owned + units > def.units) return { ok: false, error: "Not that many units left." };
  ltv = Math.max(0, Math.min(WEALTH.maxLtv, ltv));
  const price = unitPrice(s, def) * units;
  const deposit = price * (1 - ltv);
  const cash = owner === "party" ? s.me.funds : s.personal.cash;
  if (deposit > cash) return { ok: false, error: `Needs RM ${Math.round(deposit).toLocaleString("en-MY")} down.` };
  const loan = ltv > 0 ? { principal: price * ltv, weeksLeft: WEALTH.termWeeks, startWeek: s.week } : null;
  const holding: PropertyHolding = { id, owner, units, cost: price, boughtWeek: s.week, loan };
  const me = owner === "party" ? { ...s.me, funds: s.me.funds - deposit } : s.me;
  const personal = { ...s.personal, cash: owner === "personal" ? s.personal.cash - deposit : s.personal.cash, properties: [...s.personal.properties, holding] };
  return { ok: true, state: { ...s, me, personal }, message: `Bought ${units} unit${units === 1 ? "" : "s"} of ${def.name}${loan ? ` with a ${Math.round(ltv * 100)}% mortgage` : ""}.` };
}

/** Sell a holding (the mortgage is paid off from the proceeds). */
export function sellProperty(s: GameState, index: number): R {
  const h = s.personal.properties[index];
  if (!h) return { ok: false, error: "Not owned." };
  const def = PROPERTY_BY_ID[h.id];
  const value = unitPrice(s, def) * h.units;
  const proceeds = value * (1 - WEALTH.saleFee) - (h.loan?.principal ?? 0);
  const properties = s.personal.properties.filter((_, i) => i !== index);
  const me = h.owner === "party" ? { ...s.me, funds: s.me.funds + proceeds } : s.me;
  const personal = { ...s.personal, properties, cash: h.owner === "personal" ? s.personal.cash + proceeds : s.personal.cash };
  return { ok: true, state: { ...s, me, personal }, message: `Sold ${def.name} for RM ${Math.round(proceeds).toLocaleString("en-MY")} after fees${h.loan ? " and the mortgage" : ""}.` };
}

export function payOffLoan(s: GameState, index: number): R {
  const h = s.personal.properties[index];
  if (!h?.loan) return { ok: false, error: "No mortgage on it." };
  const fee = s.week - h.loan.startWeek < WEALTH.lockInWeeks ? h.loan.principal * WEALTH.earlyFee : 0;
  const due = h.loan.principal + fee;
  const cash = h.owner === "party" ? s.me.funds : s.personal.cash;
  if (due > cash) return { ok: false, error: `Needs RM ${Math.round(due).toLocaleString("en-MY")}.` };
  const properties = s.personal.properties.map((x, i) => (i === index ? { ...x, loan: null } : x));
  const me = h.owner === "party" ? { ...s.me, funds: s.me.funds - due } : s.me;
  const personal = { ...s.personal, properties, cash: h.owner === "personal" ? s.personal.cash - due : s.personal.cash };
  return { ok: true, state: { ...s, me, personal }, message: `Mortgage paid off${fee ? ` (early settlement fee RM ${Math.round(fee).toLocaleString("en-MY")})` : ""}.` };
}

// --- Your money and the party --------------------------------------------------------------------

export function donate(s: GameState, amount: number): R {
  amount = Math.floor(amount);
  if (amount <= 0 || amount > s.personal.cash) return { ok: false, error: "Not enough personal cash." };
  const points = Math.min(3, Math.floor(amount / WEALTH.donationPerPoint));
  const career = points ? { ...s.career, points: s.career.points + points, log: [{ week: s.week, text: `+${points} career points: a donation to the party` }, ...s.career.log].slice(0, 30) } : s.career;
  return { ok: true, state: { ...s, career, me: { ...s.me, funds: s.me.funds + amount }, personal: { ...s.personal, cash: s.personal.cash - amount } }, message: `You give RM ${amount.toLocaleString("en-MY")} to the party.${points ? ` The party remembers (+${points} career points).` : ""}` };
}

export function declareAssets(s: GameState): R {
  const p = s.personal;
  if (p.declaredWeek !== null && s.week - p.declaredWeek < WEALTH.declareEvery) return { ok: false, error: "You declared this year already." };
  return { ok: true, state: { ...s, me: { ...s.me, integrity: Math.min(100, s.me.integrity + WEALTH.declareIntegrity) }, personal: { ...p, declaredWeek: s.week, startWorth: netWorth(s) } }, message: "You publish a full declaration of your assets. Good-government groups applaud." };
}

export function setPayTeam(s: GameState, on: boolean): R {
  return { ok: true, state: { ...s, personal: { ...s.personal, payTeam: on } }, message: on ? "You pay your team from your own pocket." : "Your team is paid from the party's funds." };
}

export const stateName = (id: string) => STATE_BY_ID[id]?.name ?? id;
export { projectStates };
