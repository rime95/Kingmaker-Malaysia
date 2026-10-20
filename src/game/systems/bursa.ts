// Bursa Malaysia: your personal share portfolio. Adapted from Grounds Up's market model (fair value × sentiment,
// mean-reverting sentiment, hash-drawn shocks, quarterly earnings surprises and dividends, price impact on fills,
// standing orders), with politics added:
// - Prices react to the nation: growth, approval, the OPR, crises, mega projects and the policies you enact.
// - Insider trading: buying a sector shortly before your own government moves it (a mega project for builders,
//   fuel or tax changes for consumer stocks) raises MACC risk and may be exposed.
// - Big personal gains you haven't declared slowly cost integrity (see wealth.ts).
// Shocks use hash01 (no game-RNG draws), so Skip 1 Month still equals four weeks. All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import type { Nation } from "./nation";

export type Sector = "Banking" | "Energy" | "Telco" | "Healthcare" | "Gloves" | "Construction" | "Plantation" | "Consumer" | "Gaming" | "Property" | "Logistics" | "Utilities";

interface ListedDef {
  ticker: string;
  name: string;
  sector: Sector;
  /** Government-linked company. */
  glc?: boolean;
  /** Shares outstanding, millions. */
  sharesM: number;
  annualEps: number;
  growth: number;
  volatility: number;
  payout: number;
  pe: number;
}

// Real Bursa companies, rough 2026 figures for flavour. Prices and results in the game are simulated.
const LISTED: ListedDef[] = [
  { ticker: "MAYBANK", name: "Malayan Banking", sector: "Banking", glc: true, sharesM: 12_000, annualEps: 0.8, growth: 0.04, volatility: 0.015, payout: 0.75, pe: 12.5 },
  { ticker: "PBBANK", name: "Public Bank", sector: "Banking", sharesM: 19_400, annualEps: 0.35, growth: 0.04, volatility: 0.015, payout: 0.55, pe: 12.5 },
  { ticker: "CIMB", name: "CIMB Group", sector: "Banking", glc: true, sharesM: 10_700, annualEps: 0.66, growth: 0.06, volatility: 0.02, payout: 0.55, pe: 11.5 },
  { ticker: "TENAGA", name: "Tenaga Nasional", sector: "Utilities", glc: true, sharesM: 5_800, annualEps: 0.84, growth: 0.05, volatility: 0.015, payout: 0.6, pe: 16 },
  { ticker: "PCHEM", name: "Petronas Chemicals", sector: "Energy", glc: true, sharesM: 8_000, annualEps: 0.25, growth: 0.03, volatility: 0.025, payout: 0.5, pe: 20 },
  { ticker: "PETDAG", name: "Petronas Dagangan", sector: "Energy", glc: true, sharesM: 993, annualEps: 1.0, growth: 0.03, volatility: 0.018, payout: 0.8, pe: 22 },
  { ticker: "CDB", name: "CelcomDigi", sector: "Telco", sharesM: 11_700, annualEps: 0.16, growth: 0.03, volatility: 0.015, payout: 0.9, pe: 24 },
  { ticker: "TM", name: "Telekom Malaysia", sector: "Telco", glc: true, sharesM: 3_840, annualEps: 0.45, growth: 0.04, volatility: 0.02, payout: 0.5, pe: 15 },
  { ticker: "IHH", name: "IHH Healthcare", sector: "Healthcare", glc: true, sharesM: 8_800, annualEps: 0.24, growth: 0.07, volatility: 0.018, payout: 0.3, pe: 30 },
  { ticker: "TOPGLOV", name: "Top Glove", sector: "Gloves", sharesM: 8_200, annualEps: 0.03, growth: 0.05, volatility: 0.04, payout: 0.5, pe: 35 },
  { ticker: "GAMUDA", name: "Gamuda", sector: "Construction", sharesM: 5_600, annualEps: 0.21, growth: 0.08, volatility: 0.025, payout: 0.4, pe: 22 },
  { ticker: "IJM", name: "IJM Corporation", sector: "Construction", sharesM: 3_500, annualEps: 0.15, growth: 0.06, volatility: 0.025, payout: 0.5, pe: 18 },
  { ticker: "YTL", name: "YTL Corporation", sector: "Utilities", sharesM: 11_000, annualEps: 0.18, growth: 0.06, volatility: 0.03, payout: 0.3, pe: 14 },
  { ticker: "SDG", name: "SD Guthrie", sector: "Plantation", glc: true, sharesM: 6_900, annualEps: 0.3, growth: 0.03, volatility: 0.022, payout: 0.6, pe: 16 },
  { ticker: "KLK", name: "Kuala Lumpur Kepong", sector: "Plantation", sharesM: 1_100, annualEps: 1.1, growth: 0.03, volatility: 0.022, payout: 0.5, pe: 20 },
  { ticker: "MRDIY", name: "Mr D.I.Y.", sector: "Consumer", sharesM: 9_500, annualEps: 0.065, growth: 0.08, volatility: 0.02, payout: 0.6, pe: 26 },
  { ticker: "NESTLE", name: "Nestlé (Malaysia)", sector: "Consumer", sharesM: 234.5, annualEps: 2.25, growth: 0.03, volatility: 0.015, payout: 0.9, pe: 40 },
  { ticker: "GENTING", name: "Genting", sector: "Gaming", sharesM: 3_850, annualEps: 0.25, growth: 0.04, volatility: 0.025, payout: 0.4, pe: 14 },
  { ticker: "SUNWAY", name: "Sunway", sector: "Property", sharesM: 6_200, annualEps: 0.15, growth: 0.07, volatility: 0.022, payout: 0.3, pe: 24 },
  { ticker: "MISC", name: "MISC", sector: "Logistics", glc: true, sharesM: 4_460, annualEps: 0.45, growth: 0.03, volatility: 0.018, payout: 0.7, pe: 17 },
];

export interface Stock {
  ticker: string;
  name: string;
  sector: Sector;
  glc: boolean;
  shares: number;
  /** Earnings per share this quarter. */
  eps: number;
  growth: number;
  growth0: number;
  pe0: number;
  basePE: number;
  nextEps: number;
  volatility: number;
  payout: number;
  sentiment: number;
  price: number;
  /** Weekly closes, last two years. */
  history: number[];
}

export interface Holding {
  shares: number;
  cost: number;
}

export interface StockOrder {
  id: number;
  ticker: string;
  kind: "stopLoss" | "takeProfit" | "buyBelow";
  trigger: number;
  shares: number;
}

export const BURSA = {
  fee: 0.001,
  /** Buying x% of a company moves the price up by impact × x. */
  impact: 2,
  marketVolatility: 0.015,
  reversion: 0.08,
  earningsNoise: 0.08,
  longRunGrowth: 0.04,
  growthReversion: 0.05,
  earningsReaction: 1,
  maxSurprise: 0.25,
  /** Buying a sector this many weeks before your own government moves it counts as insider trading. */
  insiderWeeks: 4,
  insiderRisk: 15,
  insiderIntegrity: -5,
  exposeChance: 0.3,
  exposeScandal: 12,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const peForGrowth = (s: Pick<Stock, "pe0" | "growth0" | "growth">) => (s.pe0 * (10 + 100 * s.growth)) / (10 + 100 * s.growth0);
export const fairValue = (s: Stock) => Math.max(0.05, s.eps * 4 * s.basePE);

export function initBursa(): Stock[] {
  return LISTED.map((d) => {
    const eps = d.annualEps / 4;
    const st: Stock = {
      ticker: d.ticker,
      name: d.name,
      sector: d.sector,
      glc: !!d.glc,
      shares: d.sharesM * 1_000_000,
      eps,
      growth: d.growth,
      growth0: d.growth,
      pe0: d.pe,
      basePE: d.pe,
      nextEps: d.growth / 4,
      volatility: d.volatility,
      payout: d.payout,
      sentiment: 1,
      price: 0,
      history: [],
    };
    st.price = Math.round(fairValue(st) * 100) / 100;
    return st;
  });
}

/** How this week's news moves a sector (on top of the market and the stock's own shocks). */
export function sectorDrift(sector: Sector, n: Nation, s: Pick<GameState, "me" | "government" | "player">): number {
  const gov = s.government.includes(s.player);
  const pol = (id: string) => (gov ? (s.me.policies[id] ?? 0) : 0);
  const building = n.projects.filter((p) => !p.done).length;
  const crisis = n.crisis?.kind;
  let d = (n.gdp - 4.4) * 0.002 + (n.approval - 50) * 0.0001 - (n.opr - 2.75) * 0.002;
  switch (sector) {
    case "Construction":
      d += building * 0.002 + (pol("infra") === 1 ? 0.002 : 0);
      break;
    case "Banking":
      d += (n.opr - 2.75) * 0.004;
      break;
    case "Property":
      d -= (n.opr - 2.75) * 0.004;
      break;
    case "Consumer":
      d -= (n.col - 50) * 0.0002 + (pol("fuel") === 2 ? 0.002 : 0) + (pol("tax") === 2 ? 0.002 : 0);
      break;
    case "Gloves":
    case "Healthcare":
      d += crisis === "pandemic" ? 0.01 : 0;
      break;
    case "Plantation":
    case "Energy":
      d += crisis === "boom" ? 0.006 : crisis === "recession" ? -0.004 : 0;
      break;
    case "Gaming":
      d -= pol("religion") === 1 ? 0.003 : 0;
      break;
  }
  if (crisis === "recession" || crisis === "ringgit") d -= 0.003;
  return d;
}

/** Weekly: prices move; at each quarter end, results and dividends. Returns dividends for your holdings. */
export function bursaWeek(s: GameState): { stocks: Stock[]; dividends: number; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  const marketShock = (hash01("mkt", s.seed, s.week) * 2 - 1) * BURSA.marketVolatility * 1.7;
  const quarter = s.week % 13 === 12;
  let dividends = 0;
  const stocks = s.bursa.map((st0) => {
    const st = { ...st0 };
    const shock = marketShock + (hash01("stk", s.seed, st.ticker, s.week) * 2 - 1) * st.volatility * 1.7 + sectorDrift(st.sector, s.nation, s);
    st.sentiment = clamp(st.sentiment + BURSA.reversion * (1 - st.sentiment) + shock, 0.5, 1.8);
    if (quarter) {
      const before = st.eps;
      st.eps = st.eps * (1 + st.nextEps);
      const change = Math.abs(before) > 1e-9 ? st.eps / before - 1 : 0;
      const surprise = clamp(change - st.growth / 4, -BURSA.maxSurprise, BURSA.maxSurprise);
      st.sentiment = clamp(st.sentiment + surprise * BURSA.earningsReaction, 0.5, 1.8);
      st.growth += (BURSA.longRunGrowth - st.growth) * BURSA.growthReversion;
      st.basePE = peForGrowth(st);
      st.nextEps = st.growth / 4 + (s.nation.gdp - 4.4) * 0.005 + (hash01("eps", s.seed, st.ticker, s.week) * 2 - 1) * BURSA.earningsNoise;
      const h = s.personal.portfolio[st.ticker];
      if (h && h.shares > 0) {
        const amount = Math.max(0, st.eps * st.payout) * h.shares;
        dividends += amount;
      }
    }
    st.price = Math.max(0.05, Math.round(fairValue(st) * st.sentiment * 100) / 100);
    st.history = [...st.history, st.price].slice(-104);
    return st;
  });
  if (dividends > 0) lines.push({ text: `Dividends paid into your personal account: RM ${Math.round(dividends).toLocaleString("en-MY")}.`, tone: "good" });
  return { stocks, dividends, lines };
}

export const buyFill = (st: Stock, n: number) => st.price * (1 + (BURSA.impact * n) / st.shares / 2);
export const sellFill = (st: Stock, n: number) => st.price * Math.max(0.5, 1 - (BURSA.impact * n) / st.shares / 2);

/** Most shares this much cash buys (the fill rises with order size). */
export function affordable(st: Stock, cash: number): number {
  let lo = 0;
  let hi = Math.floor(st.shares * 0.05);
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (buyFill(st, mid) * mid * (1 + BURSA.fee) <= cash) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Sectors your own government is about to move, for the insider-trading check. */
export const PROJECT_SECTOR: Sector = "Construction";
export const POLICY_SECTOR: Record<string, Sector> = { fuel: "Consumer", tax: "Consumer", infra: "Construction", wage: "Consumer" };
