// What politicians want, and who they stand with. Goals are shown up front: give someone what they want and they're
// yours. Publicly reported allies warm to you along with their friends. Rivals never cost you loyalty: they're just
// there for you to know about. All numbers TEMPORARY.

import type { GameState, ReportLine } from "../state";
import { patrons } from "./camps";
import { remember, type Person } from "./people";
import { yourParty } from "./nominations";
import { profileOf } from "./realProfiles";

export const AMBITION = {
  /** Loyalty when someone gets what they wanted (banks a favour, and they join your camp). */
  delivered: 20,
  /** A friend this much warmer to you pulls someone along, by `pull` a month. */
  gap: 15,
  pull: 2,
};

export type Want = "cabinet" | "council";

/** What someone wants from you, if anything: what's reported about them, else what suits their standing. */
export function wantOf(p: Person): Want | null {
  if (p.chairman || p.retired || p.rank >= 4) return null;
  const said = profileOf(p.name)?.wants ?? "";
  if (/minist|cabinet|portfolio/i.test(said)) return p.seat !== null ? "cabinet" : "council";
  if (/president|deputy|vice|council|party/i.test(said)) return "council";
  if (p.rank === 3 && p.seat !== null) return "cabinet";
  if (p.rank <= 1 && (p.seat !== null || p.influence >= 40)) return "council";
  return null;
}

/** The goal shown on someone's card. */
export const goalOf = (p: Person): Want | null => p.want ?? wantOf(p);

export const wantText = (p: Person, w: Want) => profileOf(p.name)?.wants ?? (w === "cabinet" ? "A seat in the cabinet" : "A seat on the party's council");

export const delivered = (s: GameState, p: Person, w: Want) => (w === "cabinet" ? Object.values(s.cabinet).includes(p.id) : p.rank >= 2);

/** A person's publicly reported friends and rivals who are in the game. */
export function tiesOf(s: Pick<GameState, "people">, p: Person): { allies: Person[]; rivals: Person[] } {
  const profile = profileOf(p.name);
  const find = (names?: string[]) => (names ?? []).map((n) => s.people.find((x) => x.name === n && !x.retired)).filter((x): x is Person => !!x);
  return { allies: find(profile?.allies), rivals: find(profile?.rivals) };
}

/** Monthly: someone given what they wanted comes over to you; friends follow friends. */
export function ambitionsMonth(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (s.week % 4 !== 1) return { state: s, lines };
  const mine = s.coalitions[s.player].members;
  const lead = patrons(s, yourParty(s)).some((p) => p.id === s.youId);
  // The first pass only notes who already has what they want: nobody is thanked for what they had before you.
  const seeded = !!s.ambitionsSeeded;
  const byName = new Map(s.people.map((p) => [p.name, p]));
  const people = s.people.map((p) => {
    // A goal holds once set, even after they get it.
    const w = p.want ?? wantOf(p);
    let out = w && !p.want ? { ...p, want: w } : p;
    if (w && !p.wantDone && mine.includes(p.party) && delivered(s, p, w)) {
      out = seeded ? { ...remember(out, AMBITION.delivered, "You gave me what I wanted", s.week), wantDone: true, camp: lead && p.party === mine[0] ? s.youId : p.camp } : { ...out, wantDone: true };
      if (seeded) lines.push({ text: `${p.name} has what they wanted and is firmly in your corner.`, tone: "good" });
    }
    const friend = (profileOf(p.name)?.allies ?? []).map((n) => byName.get(n)).filter((x) => x && x.loyalty - out.loyalty >= AMBITION.gap);
    return friend.length ? { ...out, loyalty: Math.min(100, out.loyalty + AMBITION.pull) } : out;
  });
  return { state: { ...s, people, ambitionsSeeded: true }, lines };
}
