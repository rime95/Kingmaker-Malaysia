// Party leaderships and the cabinet at the start of the game (October 2026 snapshot, from public reporting up to
// mid-2026). Edit freely: names, seats and birth years here only set the starting line-up.
// Every other MP comes from the GE15 results; everyone below the leadership is generated (see systems/names.ts).

/** [name, GE15 seat code (null if not an MP), year of birth] */
export type RosterEntry = [name: string, seat: string | null, born: number];

export interface PartyRoster {
  president: RosterEntry;
  deputy?: RosterEntry;
  vps?: RosterEntry[];
  /** Other supreme council members worth naming. */
  council?: RosterEntry[];
}

export const ROSTERS: Record<string, PartyRoster> = {
  PKR: {
    president: ["Anwar Ibrahim", "P.063", 1947],
    deputy: ["Nurul Izzah Anwar", null, 1980],
    vps: [
      ["Amirudin Shari", "P.098", 1980],
      ["Aminuddin Harun", null, 1967],
      ["Ramanan Ramakrishnan", "P.107", 1969],
    ],
    council: [
      ["Saifuddin Nasution Ismail", null, 1963],
      ["Ahmad Fahmi Mohamed Fadzil", "P.121", 1981],
      ["Rafizi Ramli", "P.100", 1977],
      ["Fadhlina Sidek", "P.047", 1977],
      ["Chang Lih Kang", "P.077", 1976],
      ["Nik Nazmi Nik Ahmad", "P.118", 1982],
    ],
  },
  DAP: {
    president: ["Anthony Loke Siew Fook", "P.128", 1977],
    deputy: ["Gobind Singh Deo", "P.106", 1973],
    vps: [
      ["Nga Kor Ming", "P.076", 1972],
      ["Teresa Kok Suh Sim", "P.122", 1964],
      ["Chong Chieng Jen", "P.196", 1971],
    ],
    council: [
      ["Lim Guan Eng", "P.043", 1960],
      ["Steven Sim Chee Keong", "P.045", 1982],
      ["Hannah Yeoh Tseow Suan", "P.117", 1979],
      ["Liew Chin Tong", "P.162", 1977],
    ],
  },
  AMANAH: {
    president: ["Mohamad Sabu", "P.111", 1954],
    deputy: ["Mujahid Yusof Rawa", null, 1964],
    vps: [
      ["Dzulkefly Ahmad", "P.096", 1956],
      ["Adly Zahari", "P.135", 1970],
    ],
  },
  UPKO: { president: ["Ewon Benedick", "P.174", 1980] },
  UMNO: {
    president: ["Ahmad Zahid Hamidi", "P.075", 1953],
    deputy: ["Mohamad Hasan", "P.131", 1956],
    vps: [
      ["Mohamed Khaled Nordin", "P.156", 1958],
      ["Johari Abdul Ghani", "P.119", 1964],
      ["Wan Rosdy Wan Ismail", null, 1959],
    ],
    council: [
      ["Ismail Sabri Yaakob", "P.090", 1960],
      ["Ahmad Maslan", "P.164", 1966],
    ],
  },
  MCA: { president: ["Wee Ka Siong", "P.148", 1968], deputy: ["Mah Hang Soon", null, 1974] },
  MIC: { president: ["S. A. Vigneswaran", null, 1968], deputy: ["Saravanan Murugan", "P.072", 1968] },
  PBRS: { president: ["Arthur Joseph Kurup", "P.182", 1980] },
  BERSATU: {
    president: ["Muhyiddin Yassin", "P.143", 1947],
    deputy: ["Hamzah Zainudin", "P.056", 1957],
    vps: [
      ["Radzi Md Jidin", "P.125", 1971],
      ["Ronald Kiandee", "P.183", 1961],
      ["Ahmad Faizal Azumu", null, 1970],
    ],
    council: [["Saifuddin Abdullah", "P.082", 1961]],
  },
  PAS: {
    president: ["Abdul Hadi Awang", "P.037", 1947],
    deputy: ["Tuan Ibrahim Tuan Man", "P.024", 1960],
    vps: [
      ["Takiyuddin Hassan", "P.021", 1961],
      ["Idris Ahmad", "P.058", 1960],
      ["Ahmad Samsuri Mokhtar", null, 1970],
    ],
  },
  GERAKAN: { president: ["Dominic Lau Hoe Chai", null, 1971] },
  PBB: {
    president: ["Abang Johari Openg", null, 1950],
    deputy: ["Douglas Uggah Embas", null, 1957],
    vps: [
      ["Fadillah Yusof", "P.194", 1962],
      ["Alexander Nanta Linggi", "P.215", 1964],
      ["Awang Tengah Ali Hasan", null, 1959],
    ],
  },
  SUPP: { president: ["Sim Kui Hian", null, 1964] },
  PRS: { president: ["Joseph Salang Gandum", null, 1951] },
  PDP: { president: ["Tiong King Sing", "P.217", 1961] },
  GRS: {
    president: ["Hajiji Noor", null, 1955],
    deputy: ["Jeffrey Kitingan", "P.180", 1948],
    vps: [["Armizan Mohd Ali", "P.175", 1974]],
  },
  WARISAN: { president: ["Mohd Shafie Apdal", "P.189", 1957], deputy: ["Darell Leiking", null, 1970] },
  MUDA: { president: ["Amira Aisya Abdul Aziz", null, 1993], council: [["Syed Saddiq Syed Abdul Rahman", "P.146", 1992]] },
  BERSAMA: { president: ["Rafizi Ramli", "P.100", 1977], deputy: ["Nik Nazmi Nik Ahmad", "P.118", 1982] },
  KDM: { president: ["Peter Anthony", null, 1970] },
  PBM: { president: ["Larry Sng Wei Shien", "P.209", 1979] },
};

/** Cabinet posts. Ministries without a named minister are filled by the usual rules at the start. */
export const PORTFOLIOS = [
  { id: "pm", name: "Prime Minister" },
  { id: "dpm", name: "Deputy Prime Minister" },
  { id: "dpm2", name: "Deputy Prime Minister (Borneo)" },
  { id: "finance", name: "Finance" },
  { id: "home", name: "Home Affairs" },
  { id: "defence", name: "Defence" },
  { id: "foreign", name: "Foreign Affairs" },
  { id: "economy", name: "Economy" },
  { id: "trade", name: "Investment, Trade and Industry" },
  { id: "education", name: "Education" },
  { id: "health", name: "Health" },
  { id: "transport", name: "Transport" },
  { id: "works", name: "Works" },
  { id: "communications", name: "Communications" },
  { id: "rural", name: "Rural and Regional Development" },
  { id: "housing", name: "Housing and Local Government" },
  { id: "youth", name: "Youth and Sports" },
] as const;

export type PortfolioId = (typeof PORTFOLIOS)[number]["id"];

/** The October 2026 cabinet as far as it is reported (others are filled by the game's rules). */
export const START_CABINET: Partial<Record<PortfolioId, string>> = {
  pm: "Anwar Ibrahim",
  dpm: "Ahmad Zahid Hamidi",
  dpm2: "Fadillah Yusof",
  finance: "Anwar Ibrahim",
  home: "Saifuddin Nasution Ismail",
  defence: "Mohamed Khaled Nordin",
  foreign: "Mohamad Hasan",
  education: "Fadhlina Sidek",
  health: "Dzulkefly Ahmad",
  transport: "Anthony Loke Siew Fook",
  works: "Alexander Nanta Linggi",
  communications: "Ahmad Fahmi Mohamed Fadzil",
  rural: "Ahmad Zahid Hamidi",
  housing: "Nga Kor Ming",
  youth: "Hannah Yeoh Tseow Suan",
};
