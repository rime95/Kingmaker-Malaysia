// The party holding company: businesses that pay weekly income, each with its own side effects and risk.
// Pure functions over plain data. All numbers TEMPORARY.

import { hash01 } from "../rng";

export type AssetType = "newspaper" | "construction" | "plantation" | "property" | "koperasi" | "digital" | "foundation" | "bursa";
export type CeoKind = "crony" | "pro";

export interface AssetDef {
  type: AssetType;
  name: string;
  /** Price to buy level 1; each upgrade costs price × next level. */
  price: number;
  /** Weekly income at level 1 (before CEO and modifiers). */
  income: number;
  /** Weekly MACC risk added per level (opaque empires attract investigators). */
  risk: number;
  effect: string;
}

export const ASSETS: Record<AssetType, AssetDef> = {
  newspaper: { type: "newspaper", name: "Party newspaper & news portal", price: 3_000_000, income: 25_000, risk: 0, effect: "Media reach +8 per level" },
  construction: { type: "construction", name: "Construction & development company", price: 8_000_000, income: 110_000, risk: 0.4, effect: "Big income from government contracts (only 30% in opposition); high risk" },
  plantation: { type: "plantation", name: "Palm oil & rubber plantation", price: 6_000_000, income: 55_000, risk: 0.1, effect: "Income follows commodity prices; rural service +0.1/week in seats you hold" },
  property: { type: "property", name: "Property portfolio (shophouses, HQ)", price: 5_000_000, income: 30_000, risk: 0, effect: "Steady rent; value grows about 3% a year" },
  koperasi: { type: "koperasi", name: "Members' cooperative (koperasi)", price: 1_000_000, income: 8_000, risk: 0, effect: "Party unity +0.3/week and membership grows per level" },
  digital: { type: "digital", name: "Digital & social media agency", price: 2_500_000, income: 20_000, risk: 0, effect: "Social media actions 30% cheaper" },
  foundation: { type: "foundation", name: "Education foundation (scholarships)", price: 2_000_000, income: 4_000, risk: 0, effect: "Scholarship PR: youth buzz in every seat each week" },
  bursa: { type: "bursa", name: "Party investment fund", price: 2_000_000, income: 0, risk: 0, effect: "Market value moves weekly; ~4% yearly dividends. Buy more to add RM 2M each" },
};

export const ASSET_ORDER: AssetType[] = ["property", "newspaper", "digital", "koperasi", "foundation", "plantation", "construction", "bursa"];
export const MAX_LEVEL = 3;

/** CEOs are paid a share of what their company earns, so no business loses money because of its boss. */
export const CEO = {
  crony: { label: "Loyal crony", payShare: 0.04, incomeMult: 0.95, risk: 0.3 },
  pro: { label: "Professional CEO", payShare: 0.12, incomeMult: 1.15, risk: 0 },
} as const;

export interface Asset {
  type: AssetType;
  level: number;
  ceo: CeoKind;
  /** Money put in so far (purchase + upgrades), used for sale value. */
  invested: number;
  /** Bursa: current market value; property: appraised value. Other assets: book value. */
  value: number;
  /** Week of last "tap for election funds" (one per 26 weeks). */
  tappedWeek: number | null;
}

export interface Market {
  /** Commodity price index, 1 = normal. */
  commodity: number;
}

export function upgradeCost(asset: Asset): number {
  return ASSETS[asset.type].price * (asset.level + 1);
}

/** Weekly income of one asset (RM). */
export function assetIncome(asset: Asset, inGovernment: boolean, market: Market): number {
  const def = ASSETS[asset.type];
  if (asset.type === "bursa") return Math.round((asset.value * 0.04) / 52);
  let base = def.income * asset.level * CEO[asset.ceo].incomeMult;
  if (asset.type === "construction" && !inGovernment) base *= 0.3;
  if (asset.type === "plantation") base *= market.commodity;
  return Math.round(base);
}

/** What the CEO takes each week (the investment fund has no CEO). */
export function ceoPay(asset: Asset, inGovernment: boolean, market: Market): number {
  if (asset.type === "bursa") return 0;
  return Math.round(assetIncome(asset, inGovernment, market) * CEO[asset.ceo].payShare);
}

/** Weekly profit after the CEO is paid. */
export const assetProfit = (asset: Asset, inGovernment: boolean, market: Market) => assetIncome(asset, inGovernment, market) - ceoPay(asset, inGovernment, market);

export function assetRisk(asset: Asset, inGovernment: boolean): number {
  const def = ASSETS[asset.type];
  const gov = asset.type === "construction" && inGovernment ? 1.5 : 1;
  return def.risk * asset.level * gov + CEO[asset.ceo].risk;
}

/** What selling would bring in now. */
export function saleValue(asset: Asset): number {
  if (asset.type === "bursa") return Math.round(asset.value * 0.995);
  return Math.round(asset.value * 0.9);
}

/** Moves market values one week. Deterministic per seed and week (no game-RNG draws). */
export function marketWeek(assets: Asset[], market: Market, seed: number, week: number): { assets: Asset[]; market: Market } {
  const shock = (hash01("commodity", seed, week) - 0.5) * 0.06;
  const commodity = Math.min(1.6, Math.max(0.6, market.commodity + shock + (1 - market.commodity) * 0.03));
  const bursaMove = (hash01("bursa", seed, week) - 0.5) * 0.06 + 0.06 / 52;
  return {
    market: { commodity },
    assets: assets.map((a) => {
      if (a.type === "bursa") return { ...a, value: Math.round(a.value * (1 + bursaMove)) };
      if (a.type === "property") return { ...a, value: Math.round(a.value * (1 + 0.03 / 52)) };
      return a;
    }),
  };
}

export function newAsset(type: AssetType, ceo: CeoKind): Asset {
  const price = ASSETS[type].price;
  return { type, level: 1, ceo, invested: price, value: price, tappedWeek: null };
}
