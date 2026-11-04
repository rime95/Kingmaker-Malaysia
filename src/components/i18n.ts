"use client";

// The game reads in English, with Malay political terms kept as they are used in Malaysia (ceramah, rampas, Agong).
// GLOSSARY gives each term one spelling and a short English gloss, shown as a tooltip wherever <Term> wraps it.

const STRINGS = {
  overview: { en: "Overview", ms: "Ringkasan" },
  campaign: { en: "Campaign", ms: "Kempen" },
  career: { en: "Party", ms: "Parti" },
  people: { en: "People", ms: "Tokoh" },
  team: { en: "Team", ms: "Pasukan" },
  nation: { en: "Nation", ms: "Negara" },
  map: { en: "Seat map", ms: "Peta kerusi" },
  dewan: { en: "Dewan", ms: "Dewan" },
  states: { en: "States", ms: "Negeri" },
  policy: { en: "Policy", ms: "Dasar" },
  rivals: { en: "Rivals", ms: "Pesaing" },
  treasury: { en: "Money", ms: "Kewangan" },
  skipWeek: { en: "Next turn", ms: "Giliran seterusnya" },
  skipMonth: { en: "Skip 1 month", ms: "Langkau 1 bulan" },
  skipEvent: { en: "To next event", ms: "Ke peristiwa seterusnya" },
  testElection: { en: "War-room simulation (RM 100k)", ms: "Simulasi bilik gerakan (RM 100k)" },
  newGame: { en: "New game", ms: "Permainan baharu" },
  saves: { en: "Saves", ms: "Simpanan" },
  warChest: { en: "War chest", ms: "Dana perang" },
  ap: { en: "Action points", ms: "Mata tindakan" },
  needsYou: { en: "Needs you", ms: "Perlukan anda" },
  advisor: { en: "Advisor", ms: "Penasihat" },
  government: { en: "Government", ms: "Kerajaan" },
  opposition: { en: "Opposition", ms: "Pembangkang" },
  liveResults: { en: "Malam Pilihan Raya · Live results", ms: "Malam Pilihan Raya · Keputusan langsung" },
  declared: { en: "declared", ms: "diumumkan" },
  allDeclared: { en: "All 222 seats declared", ms: "Kesemua 222 kerusi diumumkan" },
  pause: { en: "Pause", ms: "Jeda" },
  resume: { en: "Resume", ms: "Sambung" },
  speed: { en: "Speed", ms: "Kelajuan" },
  skipEnd: { en: "Skip to the end", ms: "Terus ke akhir" },
  toVerdict: { en: "See the verdict", ms: "Lihat keputusan" },
  toTalks: { en: "Continue to coalition talks", ms: "Teruskan ke rundingan gabungan" },
  newTerm: { en: "Begin the new term", ms: "Mulakan penggal baharu" },
  verdict: { en: "General election verdict", ms: "Keputusan pilihan raya umum" },
  seatStolen: { en: "SEAT STOLEN!", ms: "KERUSI DIRAMPAS!" },
  sound: { en: "Sound", ms: "Bunyi" },
  start: { en: "Start", ms: "Mula" },
} as const;

export type StringKey = keyof typeof STRINGS;

export function useT(): (key: StringKey) => string {
  return (key) => STRINGS[key].en;
}

/** Malay terms the game keeps, with what they mean. */
export const GLOSSARY: Record<string, string> = {
  Ceramah: "A political rally or talk, often at night",
  Rampas: "Seized: a seat taken from another party",
  Kekal: "Held: the party keeps the seat",
  Terlepas: "Lost: the seat slipped away",
  Agong: "The Yang di-Pertuan Agong, Malaysia's king, who appoints the Prime Minister",
  "Dewan Rakyat": "The lower house of Parliament: 222 seats, 112 for a majority",
  PRU: "Pilihan Raya Umum: a general election",
  PRN: "Pilihan Raya Negeri: a state election",
  "Wakil Rakyat": "An elected representative (MP or state assemblyman)",
  "Ketua Bahagian": "Division chief: runs the party in one parliamentary seat",
  "Ketua Cawangan": "Branch chief: the party's grassroots leader in a village or neighbourhood",
  "Menteri Besar": "Chief minister of a state with a ruler",
  "Ketua Menteri": "Chief minister of Melaka, Penang or Sabah (states without a ruler)",
  Premier: "Sarawak's head of government (its chief minister since 2022)",
  Exco: "The state cabinet: the MB's team of state ministers",
  "Pengerusi Perhubungan": "State liaison chief: runs the party machine in one state",
  Istana: "The palace",
  rakyat: "The people",
  Pengerusi: "Chairman",
};
