// Your campaign message: one theme for the term, aimed at some voters and costing you with others. It grows stronger
// the longer you stick to it (message discipline, up to three months) and the louder you are nationally.
// Changing it costs political capital and looks like a flip-flop. Numbers TEMPORARY.

import type { GameState } from "../state";
import { segValue, type SegEffects } from "./segments";

export interface Theme {
  id: string;
  name: string;
  slogan: string;
  blurb: string;
  seg: SegEffects;
  /** Stronger when this holds (e.g. "economy" when prices hurt, in opposition). */
  boost?: (s: GameState) => number;
}

const opp = (s: GameState) => !s.government.includes(s.player);

export const THEMES: Theme[] = [
  { id: "economy", name: "Bread and butter", slogan: "Harga barang turun!", blurb: "Prices, wages and jobs. Strongest in opposition when the cost of living bites.", seg: { b40: 0.05, rural: 0.02, urban: 0.02 }, boost: (s) => (opp(s) ? 1 + Math.max(0, s.nation.col - 50) / 30 : 0.8) },
  { id: "reform", name: "Reformasi", slogan: "Bersih, cekap, amanah", blurb: "Clean institutions and the rule of law. Urban, young and Chinese voters respond.", seg: { urban: 0.04, youth: 0.03, chinese: 0.03, rural: -0.01 } },
  { id: "bangsa", name: "Bangsa, agama, tanah air", slogan: "Pertahankan hak kita", blurb: "Race and religion. Fires up the Malay heartland; alienates non-Malay and Borneo voters.", seg: { malay: 0.06, rural: 0.02, chinese: -0.05, indian: -0.04, sabah: -0.02, sarawak: -0.02 } },
  { id: "corruption", name: "Lawan rasuah", slogan: "Tangkap jerung!", blurb: "Hammer graft. Best in opposition, or when your own integrity is high.", seg: { urban: 0.04, youth: 0.03, all: 0.01 }, boost: (s) => (opp(s) ? 1.2 : 0.6) * (0.6 + s.me.integrity / 100) },
  { id: "development", name: "Pembangunan", slogan: "Rakyat didahulukan", blurb: "Roads, clinics and grants. The rural and Borneo vote; governments do it best.", seg: { rural: 0.04, sabah: 0.03, sarawak: 0.03 }, boost: (s) => (opp(s) ? 0.6 : 1.3) },
  { id: "borneo", name: "Borneo for Borneans", slogan: "Sabah untuk Sabahan", blurb: "MA63 rights and local control. Huge in Sabah and Sarawak, nothing on the peninsula.", seg: { sabah: 0.09, sarawak: 0.09 } },
  { id: "youth", name: "Undi18 generation", slogan: "Masa depan kita", blurb: "Jobs, housing and a voice for the young.", seg: { youth: 0.06, urban: 0.02, rural: -0.01 } },
];
export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export interface Strategy {
  theme: string | null;
  since: number;
  /** Your secretary-general runs the seat-by-seat ground campaign each turn. */
  autoGround?: boolean;
}

export const MESSAGE = { disciplineWeeks: 12, switchCapital: 10, switchBuzz: 3 };

/** 0–1: how established your message is. */
export const discipline = (s: Pick<GameState, "strategy" | "week">) => (s.strategy.theme ? Math.min(1, (s.week - s.strategy.since) / MESSAGE.disciplineWeeks) : 0);

/** The message's pull in one seat (log-odds). */
export function messageEffect(s: GameState, i: number): number {
  const t = s.strategy.theme ? THEME_BY_ID[s.strategy.theme] : null;
  if (!t) return 0;
  return segValue(i, t.seg) * discipline(s) * (0.6 + s.me.nationalBuzz / 125) * (t.boost?.(s) ?? 1);
}

export function setTheme(s: GameState, id: string): { state: GameState; message: string } | { error: string } {
  const t = THEME_BY_ID[id];
  if (!t) return { error: "Unknown message." };
  if (s.strategy.theme === id) return { error: "That's already your message." };
  const first = !s.strategy.theme;
  if (!first && s.me.capital < MESSAGE.switchCapital) return { error: `Changing message costs ${MESSAGE.switchCapital} political capital.` };
  const me = first ? s.me : { ...s.me, capital: s.me.capital - MESSAGE.switchCapital, nationalBuzz: Math.max(0, s.me.nationalBuzz - MESSAGE.switchBuzz) };
  return {
    state: { ...s, me, strategy: { theme: id, since: s.week } },
    message: first ? `Your message: “${t.slogan}”.` : `A new message: “${t.slogan}”. The press calls it a U-turn; it takes time to stick.`,
  };
}
