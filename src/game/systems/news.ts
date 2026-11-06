// The news: a running log the player can browse, with stories about what the country's politicians are doing, by name.
// Every report line worth keeping goes in; on top of those, one story most weeks from what is really happening in the
// game. Real politicians only get political stories (speeches, criticism, tours, feuds that are on the public record):
// never corruption or crime. All randomness is hash01, one story a week at most. All numbers TEMPORARY.
// Avoid the words month.ts treats as alarms ("retires", "by-election", "leadership", "state election"): a story must not
// stop quiet turns from skipping.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { WORLD } from "../data/world";
import { COALITIONS, cshort, type CoalitionId } from "../world";
import { coalitionLeader } from "./coalitions";
import { worldRank } from "./wawasan";
import { profileOf } from "./realProfiles";
import { POLICY_BY_ID } from "./policies";

/** The game's invented papers. */
export const OUTLETS = ["Warta Negara", "The Straits Courier", "Harian Rakyat", "Suara Merdeka", "The Peninsula Post", "Borneo Sentinel"];

export interface NewsItem {
  week: number;
  text: string;
  tone: "good" | "bad" | "info";
  /** The outlet carrying it (stories only). */
  paper?: string;
}

export const NEWS = {
  keep: 200,
  storyChance: 0.6,
};

/** The coalition leading the opposition (or, if you're in opposition, the government). */
function mainRival(s: GameState): CoalitionId | null {
  const seats = (c: CoalitionId) => s.holders.filter((h) => h === c).length;
  const you = s.government.includes(s.player);
  return COALITIONS.filter((c) => c !== s.player && c !== "OTHERS" && s.government.includes(c) !== you && s.coalitions[c].members.length).sort((a, b) => seats(b) - seats(a))[0] ?? null;
}

type Story = { text: string; tone: NewsItem["tone"] };

/** Stories that could run this week, from what is actually going on. */
export function storiesFor(s: GameState): Story[] {
  const n = s.nation;
  const out: Story[] = [];
  const rival = mainRival(s);
  const rivalName = rival ? coalitionLeader(s, rival) : null;
  const gov = s.government.includes(s.player);
  if (rival && rivalName) {
    const who = `${rivalName} (${cshort(rival)})`;
    if (gov) {
      if (n.col > 55) out.push({ text: `${who} says families are being squeezed and calls on the government to act on prices.`, tone: "bad" });
      if (n.debt > 66) out.push({ text: `${who} questions the government's borrowing as debt reaches ${n.debt.toFixed(0)}% of GDP.`, tone: "bad" });
      if (n.ringgit > 4.5) out.push({ text: `${who} blames the government for the weak ringgit, at RM ${n.ringgit.toFixed(2)} to the dollar.`, tone: "bad" });
      if (n.approval < 45) out.push({ text: `${who} tells a packed ceramah that the government has lost the people's trust.`, tone: "bad" });
    } else {
      if (n.gdp > 5) out.push({ text: `${who} credits the government's plan as growth reaches ${n.gdp.toFixed(1)}%.`, tone: "bad" });
      if (n.col > 55) out.push({ text: `${who} defends the government's record on prices against your attacks.`, tone: "info" });
    }
    out.push({ text: `${who} takes the party's message on tour, drawing crowds in the heartland.`, tone: "info" });
  }
  // Partners and friends speak up for you.
  for (const c of COALITIONS) {
    if (c === s.player || c === "OTHERS" || !s.government.includes(c) || !gov || !s.coalitions[c].members.length) continue;
    if (n.gdp > 4.8) out.push({ text: `${coalitionLeader(s, c)} (${cshort(c)}) praises the unity government's handling of the economy.`, tone: "good" });
  }
  // Politicians with a publicly reported rival: their spats are real news.
  const feuds = s.people.filter((p) => p.real && !p.retired && profileOf(p.name)?.status === "active" && (profileOf(p.name)?.rivals?.length ?? 0) > 0);
  if (feuds.length) {
    const p = feuds[Math.floor(hash01("newsfeud", s.seed, s.week) * feuds.length)];
    const r = profileOf(p.name)!.rivals!;
    out.push({ text: `${p.name} and ${r[Math.floor(hash01("newsfeudr", s.seed, s.week) * r.length)]} trade barbs in the press, the latest round of an old rivalry.`, tone: "info" });
  }
  // Your latest policy: politicians react according to where they stand.
  const last = s.policyLog?.[0];
  if (gov && last && s.week - last.week <= 2) {
    const pool = s.people.filter((p) => p.real && !p.retired && p.rank >= 2 && profileOf(p.name)?.status === "active" && profileOf(p.name)?.stance);
    if (pool.length) {
      const p = pool[Math.floor(hash01("newsreact", s.seed, s.week) * pool.length)];
      const name = POLICY_BY_ID[last.policy]?.name ?? "the new policy";
      const friendly = s.coalitions[s.player].members.includes(p.party);
      out.push(friendly ? { text: `${p.name} (${p.party}) defends the government's move on ${name.toLowerCase()}.`, tone: "good" } : { text: `${p.name} (${p.party}), speaking as a ${profileOf(p.name)!.stance} voice, questions the government's move on ${name.toLowerCase()}.`, tone: "info" });
    }
  }
  // The world.
  const c = WORLD[Math.floor(hash01("newsworld", s.seed, s.week) * WORLD.length)];
  out.push({ text: `${c.name}'s trade envoy visits Putrajaya. Malaysia ranks #${worldRank(s)} on Global Power.`, tone: "info" });
  if (n.gdp > 5.5) out.push({ text: `Foreign investors take note: analysts raise their Malaysia forecasts after growth of ${n.gdp.toFixed(1)}%.`, tone: "good" });
  return out;
}

/** This week's story, if any: it goes on the wire and in the log. */
export function newsWeek(s: GameState): ReportLine[] {
  if (hash01("story", s.seed, s.week) >= NEWS.storyChance) return [];
  const list = storiesFor(s);
  if (!list.length) return [];
  const pick = list[Math.floor(hash01("storypick", s.seed, s.week) * list.length)];
  return [{ text: pick.text, tone: pick.tone }];
}

/** Keep this week's lines in the log. */
export function logNews(s: GameState, lines: ReportLine[]): NewsItem[] {
  const seen = new Set((s.news ?? []).slice(0, 40).map((n) => n.text));
  const fresh: NewsItem[] = lines
    .filter((l) => !seen.has(l.text) && !/^Needs you|^Achievement|^Objective/.test(l.text))
    .map((l, i) => ({ week: s.week, text: l.text, tone: l.tone ?? "info", paper: OUTLETS[Math.floor(hash01("paper", s.seed, s.week, i) * OUTLETS.length)] }));
  return [...fresh.reverse(), ...(s.news ?? [])].slice(0, NEWS.keep);
}
