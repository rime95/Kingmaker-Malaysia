// How each party is run at the top: its supreme council's name, how many vice presidents it elects, how many council
// seats are elected at the party polls and how many the president appoints. Close to the real parties' constitutions
// as they stood in 2026, rounded where they vary: edit freely, like the rosters. Parties not listed follow their size.

export interface Structure {
  /** The council's own name. */
  council: string;
  /** What its vice presidents are called. */
  vpTitle: string;
  vps: number;
  /** Council seats elected at the party polls. */
  elected: number;
  /** Council seats the president fills. */
  appointed: number;
  /** Years between party polls. */
  termYears: number;
}

export const STRUCTURES: Record<string, Structure> = {
  UMNO: { council: "Majlis Tertinggi", vpTitle: "Naib Presiden", vps: 3, elected: 25, appointed: 12, termYears: 3 },
  PKR: { council: "Majlis Pimpinan Pusat", vpTitle: "Naib Presiden", vps: 4, elected: 20, appointed: 10, termYears: 3 },
  PAS: { council: "Jawatankuasa Kerja PAS Pusat", vpTitle: "Naib Presiden", vps: 3, elected: 18, appointed: 8, termYears: 3 },
  BERSATU: { council: "Majlis Pimpinan Tertinggi", vpTitle: "Naib Presiden", vps: 3, elected: 20, appointed: 10, termYears: 3 },
  DAP: { council: "Central Executive Committee", vpTitle: "Vice-Chairman", vps: 3, elected: 30, appointed: 5, termYears: 3 },
  AMANAH: { council: "Jawatankuasa Pimpinan Nasional", vpTitle: "Naib Presiden", vps: 3, elected: 15, appointed: 5, termYears: 3 },
};

const BIG: Omit<Structure, "council"> = { vpTitle: "Vice President", vps: 3, elected: 15, appointed: 5, termYears: 3 };
const MID: Omit<Structure, "council"> = { vpTitle: "Vice President", vps: 2, elected: 10, appointed: 3, termYears: 3 };
const SMALL: Omit<Structure, "council"> = { vpTitle: "Vice President", vps: 1, elected: 6, appointed: 2, termYears: 3 };

/** A party's structure: its own if listed, else one for its size (seats it won at GE15). */
export function structureOf(party: string, ge15Seats: number): Structure {
  return STRUCTURES[party] ?? { council: "Supreme Council", ...(ge15Seats >= 10 ? BIG : ge15Seats >= 3 ? MID : SMALL) };
}

/** The first party polls in the game, and every term after. */
export const FIRST_POLLS = 2027;
