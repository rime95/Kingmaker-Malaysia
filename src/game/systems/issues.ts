// Local issues: every seat has one or two things its voters care about most (water cuts, floods, the road to town,
// housing prices). Take one up and it becomes your story there: a lasting boost, bigger if you are in government and can
// actually fix it. Issues are drawn with hash01 from the seat's profile, and new ones surface after each general election.

import { hash01 } from "../rng";
import type { GameState } from "../state";
import { SEATS, type Seat } from "../world";

export interface IssueDef {
  id: string;
  name: string;
  /** What taking it up looks like, in government and in opposition. */
  gov: string;
  opp: string;
  /** How likely this is to be a seat's issue. */
  weight: (seat: Seat) => number;
}

const FLOOD_STATES = ["KTN", "TRG", "PHG", "JHR", "KDH", "PLS", "SGR"];
const BORNEO = ["SBH", "SWK", "LBN"];

export const ISSUES: IssueDef[] = [
  {
    id: "water",
    name: "Water cuts",
    gov: "A new treatment plant is fast-tracked",
    opp: "You lead a residents' petition to the water board",
    weight: (s) => (BORNEO.includes(s.state) || s.state === "KTN" ? 3 : 0.8) * (1 - s.demo.urbanity * 0.5),
  },
  {
    id: "floods",
    name: "Floods",
    gov: "Flood mitigation money arrives before the monsoon",
    opp: "Your volunteers run the flood relief the government didn't",
    weight: (s) => (FLOOD_STATES.includes(s.state) ? 2.5 : 0.4),
  },
  {
    id: "roads",
    name: "The road to town",
    gov: "The trunk road is finally upgraded",
    opp: "You film the potholes and shame the ministry into acting",
    weight: (s) => 2.2 * (1 - s.demo.urbanity) + (BORNEO.includes(s.state) ? 1.5 : 0),
  },
  {
    id: "traffic",
    name: "Traffic and transit",
    gov: "A new feeder bus line and an LRT extension study",
    opp: "Your transit plan goes viral with commuters",
    weight: (s) => 3 * Math.max(0, s.demo.urbanity - 0.5),
  },
  {
    id: "housing",
    name: "House prices",
    gov: "Affordable flats are approved on state land",
    opp: "You expose a developer's broken promises",
    weight: (s) => 2.5 * s.demo.urbanity * (0.5 + s.demo.youth),
  },
  {
    id: "cost",
    name: "Cost of living",
    gov: "Targeted aid reaches every B40 household here",
    opp: "Your price-watch campaign names and shames",
    weight: (s) => 1 + 2 * s.demo.b40,
  },
  {
    id: "jobs",
    name: "Jobs for the young",
    gov: "A factory investment brings 800 jobs",
    opp: "Your job fair outdraws the ministry's",
    weight: (s) => 3 * s.demo.youth,
  },
  {
    id: "padi",
    name: "Crop and rubber prices",
    gov: "A price floor for smallholders",
    opp: "You march with the smallholders to Putrajaya",
    weight: (s) => 2.2 * (1 - s.demo.urbanity) * (s.state === "KDH" || s.state === "PLS" || s.state === "KTN" ? 1.6 : 1),
  },
  {
    id: "land",
    name: "Land titles",
    gov: "Native customary land is finally surveyed and titled",
    opp: "You take the villagers' land case to court",
    weight: (s) => (BORNEO.includes(s.state) ? 2.5 : 0.3) * (1 - s.demo.urbanity),
  },
  {
    id: "internet",
    name: "Internet and phone coverage",
    gov: "New towers go up across the district",
    opp: "Your coverage map shames the telcos",
    weight: (s) => 1.5 * (1 - s.demo.urbanity),
  },
];

export const ISSUE_BY_ID: Record<string, IssueDef> = Object.fromEntries(ISSUES.map((d) => [d.id, d]));

/** Log-odds an issue you have taken up is worth to you in that seat. */
export const ISSUE = {
  gov: 0.2,
  opp: 0.14,
  buzz: 10,
  ap: 2,
  costGov: 300_000,
  costOpp: 120_000,
};

/** A seat's issues this term (they change after each general election). */
export function seatIssues(s: Pick<GameState, "seed" | "geCount">, i: number): IssueDef[] {
  const seat = SEATS[i];
  const pool = ISSUES.map((d) => ({ d, w: d.weight(seat) }));
  const out: IssueDef[] = [];
  const count = hash01("issues", s.seed, s.geCount, i) < 0.45 ? 1 : 2;
  for (let n = 0; n < count; n++) {
    const left = pool.filter((x) => !out.includes(x.d));
    const total = left.reduce((a, x) => a + x.w, 0);
    let r = hash01("issue", s.seed, s.geCount, i, n) * total;
    const pick = left.find((x) => (r -= x.w) <= 0) ?? left.at(-1)!;
    out.push(pick.d);
  }
  return out;
}

/** Issues in a seat you haven't taken up yet. */
export const openIssues = (s: GameState, i: number) => seatIssues(s, i).filter((d) => !(s.issuesTaken[i] ?? []).includes(d.id));

/** Your lasting extra log-odds from the issues you've taken up in a seat. */
export function issueEffect(s: Pick<GameState, "issuesTaken">, i: number, gov: boolean): number {
  return (s.issuesTaken[i]?.length ?? 0) * (gov ? ISSUE.gov : ISSUE.opp);
}
