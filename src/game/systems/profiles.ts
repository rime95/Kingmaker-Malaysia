// Who your candidates are: every party member has a profession, two defining traits, a home state and a record.
// Profiles are worked out from the person (deterministically), so they need no saving and never change under you.
// Traits matter on the ballot: a religious teacher plays well in rural Malay seats, a technocrat in the cities, a
// local son or daughter at home, a youth icon where the voters are young. Some traits are risks (scandal, defectors).
// Real people never get the scandal trait. All numbers TEMPORARY.

import { hash01 } from "../rng";
import { PARTIES, SEATS, STATE_BY_ID, regionOf, type Seat } from "../world";
import { homeOf, type Person } from "./people";

export type Trait = "orator" | "grassroots" | "clean" | "local" | "technocrat" | "warlord" | "scandal" | "youth" | "religious" | "defector";

export const TRAITS: Record<Trait, { name: string; blurb: string; risk?: boolean }> = {
  orator: { name: "Orator", blurb: "Fills a padang and holds it" },
  grassroots: { name: "Grassroots", blurb: "Knows every ketua kampung by name" },
  clean: { name: "Clean record", blurb: "Not a whiff of scandal" },
  local: { name: "Anak tempatan", blurb: "Born and raised here" },
  technocrat: { name: "Technocrat", blurb: "Data, plans, and city voters like it" },
  warlord: { name: "Warlord", blurb: "Commands the division machine, and expects to be paid for it", risk: true },
  scandal: { name: "Scandal-prone", blurb: "There are stories, and rivals know them", risk: true },
  youth: { name: "Youth icon", blurb: "Big online, bigger with first-time voters" },
  religious: { name: "Religious credentials", blurb: "An ustaz or ustazah, trusted at the surau" },
  defector: { name: "Ex-defector", blurb: "Crossed over once; voters remember", risk: true },
};

const JOBS = ["Lawyer", "Doctor", "Engineer", "Teacher", "Ustaz", "Businessman", "Activist", "Ex-civil servant", "Accountant", "Journalist", "Farmer's son", "Lecturer", "Social media influencer", "Retired army officer", "Architect", "Pharmacist"];

/** Which traits a party's members tend to have. */
const PARTY_TRAITS: Record<string, Partial<Record<Trait, number>>> = {
  PAS: { religious: 3, grassroots: 2 },
  AMANAH: { religious: 2, clean: 1 },
  UMNO: { warlord: 2, grassroots: 2 },
  BERSATU: { warlord: 1, grassroots: 1 },
  DAP: { technocrat: 2, orator: 2, clean: 1 },
  PKR: { orator: 1, technocrat: 1, clean: 1 },
  MUDA: { youth: 3, clean: 2, technocrat: 1 },
  BERSAMA: { technocrat: 3, clean: 2 },
  GERAKAN: { technocrat: 1 },
  MCA: { technocrat: 1, grassroots: 1 },
  MIC: { grassroots: 2 },
  PBB: { grassroots: 2, local: 2 },
  GRS: { local: 2 },
  WARISAN: { local: 2, grassroots: 1 },
};

export interface Profile {
  job: string;
  traits: Trait[];
  /** State the person comes from. */
  home: string;
  /** 0–100. */
  integrity: number;
  bio: string;
}

const pick = <T>(list: T[], x: number) => list[Math.floor(x * list.length) % list.length];

/** A person's profile, the same every time you ask. */
export function profileOf(p: Pick<Person, "id" | "name" | "party" | "seat" | "real" | "rank" | "born" | "home">): Profile {
  const h = (k: string) => hash01("profile", p.id, p.name, k);
  // Their home town: their own seat if it is in their home state, else a seat there.
  const region = homeOf(p);
  const inRegion = SEATS.filter((s) => regionOf(s.state) === region);
  const homeSeat: Seat | undefined = p.seat !== null && regionOf(SEATS[p.seat].state) === region ? SEATS[p.seat] : inRegion[Math.floor(h("home") * inRegion.length)];
  const home = homeSeat?.state ?? "SGR";
  const weights: Partial<Record<Trait, number>> = { orator: 1, grassroots: 1, clean: 1, local: 1.2, technocrat: 1, warlord: 0.6, scandal: p.real ? 0 : 0.5, youth: 0.6, religious: 0.5, defector: 0.25 };
  for (const [t, w] of Object.entries(PARTY_TRAITS[p.party] ?? {})) weights[t as Trait] = (weights[t as Trait] ?? 0) + w;
  const traits: Trait[] = [];
  for (let k = 0; k < 2; k++) {
    const pool = (Object.entries(weights) as [Trait, number][]).filter(([t, w]) => w > 0 && !traits.includes(t) && !(t === "clean" && traits.includes("scandal")) && !(t === "scandal" && traits.includes("clean")));
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let x = h(`t${k}`) * total;
    for (const [t, w] of pool) {
      x -= w;
      if (x <= 0) {
        traits.push(t);
        break;
      }
    }
  }
  const religious = traits.includes("religious");
  const job = religious ? (h("rj") < 0.6 ? "Ustaz" : "Religious teacher") : traits.includes("youth") ? pick(["Activist", "Social media influencer", "Startup founder", "Student leader"], h("yj")) : pick(JOBS, h("job"));
  let integrity = 45 + Math.round(h("int") * 45);
  if (traits.includes("clean")) integrity = Math.max(integrity, 80);
  if (traits.includes("scandal")) integrity = Math.min(integrity, 35);
  if (traits.includes("warlord")) integrity -= 10;
  const town = homeSeat?.name ?? STATE_BY_ID[home]?.name ?? "the state";
  const party = PARTIES[p.party]?.name ?? p.party;
  const deed = pick(
    [
      `ran the ${party} service centre in ${town} for years`,
      `led the party's youth wing in ${STATE_BY_ID[home]?.name ?? "the state"}`,
      `built the division from a handful of members`,
      `made a name fighting a land case for the kampung`,
      `organised flood relief in ${town}`,
      `won a by-election nobody expected the party to win`,
      `came up through the student movement`,
    ],
    h("deed"),
  );
  const bio = `${job} from ${town}. ${deed[0].toUpperCase()}${deed.slice(1)}.`;
  return { job, traits, home, integrity, bio };
}

/** Personal vote from a candidate's traits in a seat (log-odds). */
export function traitVote(p: Pick<Person, "id" | "name" | "party" | "seat" | "real" | "rank" | "born" | "home">, seat: number): number {
  return traitVotes(p, seat).reduce((a, x) => a + x.v, 0);
}

/** Each trait's pull in a seat (log-odds), for the "why" list. */
export function traitVotes(p: Pick<Person, "id" | "name" | "party" | "seat" | "real" | "rank" | "born" | "home">, seat: number): { trait: Trait; v: number }[] {
  const prof = profileOf(p);
  const d = SEATS[seat].demo;
  const malay = d.ethnic.malay ?? 0;
  return prof.traits.map((t) => {
    let v = 0;
    if (t === "orator") v = 0.05;
    else if (t === "grassroots") v = 0.03 + (1 - d.urbanity) * 0.05;
    else if (t === "clean") v = 0.02 + d.urbanity * 0.04;
    else if (t === "local") v = regionOf(prof.home) === regionOf(SEATS[seat].state) ? 0.07 : 0;
    else if (t === "technocrat") v = d.urbanity * 0.08 - 0.02;
    else if (t === "warlord") v = 0.04;
    else if (t === "scandal") v = -0.05;
    else if (t === "youth") v = d.youth * 0.2 - 0.02;
    else if (t === "religious") v = malay * (1 - d.urbanity) * 0.12 - d.urbanity * 0.03;
    else if (t === "defector") v = -0.04;
    return { trait: t, v };
  });
}
