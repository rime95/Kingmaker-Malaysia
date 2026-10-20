"use client";

// Bahasa Malaysia / English for the main navigation, controls and Election Night. Detailed game text is English.

import { useGame } from "@/store/gameStore";

const STRINGS = {
  overview: { en: "Overview", ms: "Ringkasan" },
  campaign: { en: "Campaign", ms: "Kempen" },
  career: { en: "Party", ms: "Parti" },
  people: { en: "People", ms: "Tokoh" },
  team: { en: "Team", ms: "Pasukan" },
  map: { en: "Seat map", ms: "Peta kerusi" },
  dewan: { en: "Dewan", ms: "Dewan" },
  states: { en: "States", ms: "Negeri" },
  policy: { en: "Policy", ms: "Dasar" },
  rivals: { en: "Rivals", ms: "Pesaing" },
  treasury: { en: "Money", ms: "Kewangan" },
  skipWeek: { en: "Next week", ms: "Minggu depan" },
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
  toTalks: { en: "Continue to coalition talks", ms: "Teruskan ke rundingan gabungan" },
  newTerm: { en: "Begin the new term", ms: "Mulakan penggal baharu" },
  verdict: { en: "General election verdict", ms: "Keputusan pilihan raya umum" },
  seatStolen: { en: "SEAT STOLEN!", ms: "KERUSI DIRAMPAS!" },
  sound: { en: "Sound", ms: "Bunyi" },
  start: { en: "Start", ms: "Mula" },
} as const;

export type StringKey = keyof typeof STRINGS;

export function useT(): (key: StringKey) => string {
  const lang = useGame((s) => s.lang);
  return (key) => STRINGS[key][lang];
}
