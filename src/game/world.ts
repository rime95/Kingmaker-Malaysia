// The fixed world: states, parties, coalitions and the 222 Dewan Rakyat seats.
// Seat holders are the GE15 (Nov 2022) results; later by-elections and defections are not modelled yet.
// Demographics are ESTIMATES built from state averages and each seat's GE15 result (see buildDemographics),
// not census figures. Swap in real data later without touching the engine.

import { hash01 } from "./rng";

export const COALITIONS = ["PH", "BN", "PN", "GPS", "GRS", "WARISAN", "MUDA", "OTHERS"] as const;
export type CoalitionId = (typeof COALITIONS)[number];

export interface Coalition {
  id: CoalitionId;
  name: string;
  short: string;
  color: string;
  /** Who leads it (Oct 2026 snapshot, editable). */
  leader: string;
  /** In the federal unity government (Oct 2026 snapshot). */
  inGovernment: boolean;
  blurb: string;
}

export const COALITION_INFO: Record<CoalitionId, Coalition> = {
  PH: { id: "PH", name: "Pakatan Harapan", short: "PH", color: "#d62839", leader: "Anwar Ibrahim", inGovernment: true, blurb: "Multiracial reformist coalition leading the unity government. Strong in urban and mixed seats." },
  BN: { id: "BN", name: "Barisan Nasional", short: "BN", color: "#1f3a93", leader: "Ahmad Zahid Hamidi", inGovernment: true, blurb: "The old governing coalition, now a unity-government partner. Rural Malay machinery and deep networks." },
  PN: { id: "PN", name: "Perikatan Nasional", short: "PN", color: "#0f8a4f", leader: "Muhyiddin Yassin", inGovernment: false, blurb: "The main opposition. Dominant in the Malay heartland of the north and east coast." },
  GPS: { id: "GPS", name: "Gabungan Parti Sarawak", short: "GPS", color: "#e8871e", leader: "Abang Johari Openg", inGovernment: true, blurb: "Sarawak's ruling bloc. Near-total grip on rural Sarawak and the classic kingmaker." },
  GRS: { id: "GRS", name: "Gabungan Rakyat Sabah", short: "GRS", color: "#8a4fd6", leader: "Hajiji Noor", inGovernment: true, blurb: "Sabah's governing coalition. Fights Warisan for the Land Below the Wind." },
  WARISAN: { id: "WARISAN", name: "Parti Warisan", short: "Warisan", color: "#17a2d8", leader: "Shafie Apdal", inGovernment: false, blurb: "Sabah-first party with strength on the east coast of Sabah." },
  MUDA: { id: "MUDA", name: "MUDA", short: "MUDA", color: "#3d3d3d", leader: "Amira Aisya Abdul Aziz", inGovernment: false, blurb: "Youth party. Tiny today, but the Undi18 generation is up for grabs." },
  OTHERS: { id: "OTHERS", name: "Independents & others", short: "Others", color: "#9a9a9a", leader: "—", inGovernment: true, blurb: "Independents and small parties (KDM, PBM). Most back the government." },
};

/** Parties as they appear on the ballot, each in a coalition. */
export interface Party {
  id: string;
  name: string;
  coalition: CoalitionId;
}

export const PARTIES: Record<string, Party> = {
  PKR: { id: "PKR", name: "Parti Keadilan Rakyat", coalition: "PH" },
  DAP: { id: "DAP", name: "Democratic Action Party", coalition: "PH" },
  AMANAH: { id: "AMANAH", name: "Parti Amanah Negara", coalition: "PH" },
  UPKO: { id: "UPKO", name: "UPKO", coalition: "PH" },
  UMNO: { id: "UMNO", name: "UMNO", coalition: "BN" },
  MCA: { id: "MCA", name: "MCA", coalition: "BN" },
  MIC: { id: "MIC", name: "MIC", coalition: "BN" },
  PBRS: { id: "PBRS", name: "PBRS", coalition: "BN" },
  BERSATU: { id: "BERSATU", name: "Parti Pribumi Bersatu Malaysia", coalition: "PN" },
  PAS: { id: "PAS", name: "Parti Islam Se-Malaysia", coalition: "PN" },
  PBB: { id: "PBB", name: "Parti Pesaka Bumiputera Bersatu", coalition: "GPS" },
  SUPP: { id: "SUPP", name: "SUPP", coalition: "GPS" },
  PRS: { id: "PRS", name: "Parti Rakyat Sarawak", coalition: "GPS" },
  PDP: { id: "PDP", name: "Progressive Democratic Party", coalition: "GPS" },
  GRS: { id: "GRS", name: "Gabungan Rakyat Sabah", coalition: "GRS" },
  WARISAN: { id: "WARISAN", name: "Parti Warisan", coalition: "WARISAN" },
  MUDA: { id: "MUDA", name: "MUDA", coalition: "MUDA" },
  KDM: { id: "KDM", name: "Parti KDM", coalition: "OTHERS" },
  PBM: { id: "PBM", name: "Parti Bangsa Malaysia", coalition: "OTHERS" },
  IND: { id: "IND", name: "Independent", coalition: "OTHERS" },
};

export type Region = "peninsula" | "sabah" | "sarawak";

export interface StateInfo {
  id: string;
  name: string;
  region: Region;
  /** State assembly (DUN) seats; 0 for federal territories. */
  dunSeats: number;
  /** Rough citizen ethnic mix used as the base for seat estimates. */
  mix: Demographics["ethnic"];
  urbanity: number;
  /** Centre of the state's cluster on the hex map (grid column, row). */
  hex: [number, number];
}

const mix = (malay: number, chinese: number, indian: number, sabah: number, sarawak: number, other: number) => ({ malay, chinese, indian, sabah, sarawak, other });

export const STATES: StateInfo[] = [
  { id: "PLS", name: "Perlis", region: "peninsula", dunSeats: 15, mix: mix(0.88, 0.08, 0.01, 0, 0, 0.03), urbanity: 0.35, hex: [3, 0] },
  { id: "KDH", name: "Kedah", region: "peninsula", dunSeats: 36, mix: mix(0.78, 0.13, 0.07, 0, 0, 0.02), urbanity: 0.4, hex: [4, 2] },
  { id: "KTN", name: "Kelantan", region: "peninsula", dunSeats: 45, mix: mix(0.95, 0.03, 0.005, 0, 0, 0.015), urbanity: 0.3, hex: [10, 2] },
  { id: "TRG", name: "Terengganu", region: "peninsula", dunSeats: 32, mix: mix(0.97, 0.02, 0.002, 0, 0, 0.008), urbanity: 0.4, hex: [13, 5] },
  { id: "PNG", name: "Pulau Pinang", region: "peninsula", dunSeats: 40, mix: mix(0.44, 0.44, 0.1, 0, 0, 0.02), urbanity: 0.85, hex: [0, 5] },
  { id: "PRK", name: "Perak", region: "peninsula", dunSeats: 59, mix: mix(0.56, 0.29, 0.13, 0, 0, 0.02), urbanity: 0.55, hex: [5, 7] },
  { id: "PHG", name: "Pahang", region: "peninsula", dunSeats: 42, mix: mix(0.77, 0.16, 0.05, 0, 0, 0.02), urbanity: 0.4, hex: [11, 9] },
  { id: "SGR", name: "Selangor", region: "peninsula", dunSeats: 56, mix: mix(0.58, 0.27, 0.13, 0, 0, 0.02), urbanity: 0.8, hex: [4, 12] },
  { id: "KUL", name: "Kuala Lumpur", region: "peninsula", dunSeats: 0, mix: mix(0.47, 0.41, 0.1, 0, 0, 0.02), urbanity: 0.98, hex: [8, 12] },
  { id: "PJY", name: "Putrajaya", region: "peninsula", dunSeats: 0, mix: mix(0.97, 0.01, 0.01, 0, 0, 0.01), urbanity: 0.95, hex: [7, 15] },
  { id: "NSN", name: "Negeri Sembilan", region: "peninsula", dunSeats: 36, mix: mix(0.6, 0.23, 0.15, 0, 0, 0.02), urbanity: 0.55, hex: [10, 15] },
  { id: "MLK", name: "Melaka", region: "peninsula", dunSeats: 28, mix: mix(0.68, 0.25, 0.06, 0, 0, 0.01), urbanity: 0.6, hex: [10, 18] },
  { id: "JHR", name: "Johor", region: "peninsula", dunSeats: 56, mix: mix(0.6, 0.32, 0.07, 0, 0, 0.01), urbanity: 0.65, hex: [15, 18] },
  { id: "LBN", name: "Labuan", region: "sabah", dunSeats: 0, mix: mix(0.25, 0.2, 0, 0.5, 0, 0.05), urbanity: 0.7, hex: [24, 4] },
  { id: "SBH", name: "Sabah", region: "sabah", dunSeats: 73, mix: mix(0, 0.12, 0, 0.78, 0, 0.1), urbanity: 0.35, hex: [30, 4] },
  { id: "SWK", name: "Sarawak", region: "sarawak", dunSeats: 82, mix: mix(0, 0.25, 0, 0, 0.74, 0.01), urbanity: 0.35, hex: [24, 12] },
];

export const STATE_BY_ID: Record<string, StateInfo> = Object.fromEntries(STATES.map((s) => [s.id, s]));

export const BLOCS = ["malay", "chinese", "indian", "sabah", "sarawak", "other"] as const;
export type Bloc = (typeof BLOCS)[number];
export const BLOC_LABEL: Record<Bloc, string> = {
  malay: "Malay",
  chinese: "Chinese",
  indian: "Indian",
  sabah: "Sabah Bumiputera",
  sarawak: "Sarawak Bumiputera",
  other: "Others",
};

export interface Demographics {
  ethnic: Record<Bloc, number>;
  /** 0 = deep rural, 1 = city centre. */
  urbanity: number;
  /** Share of voters aged 18–29. */
  youth: number;
  /** Share of B40 households. */
  b40: number;
}

export interface Seat {
  index: number;
  code: string; // "P.104"
  name: string;
  state: string;
  electorate: number;
  demo: Demographics;
  /** GE15 winner. */
  ge15Party: string;
  ge15Coalition: CoalitionId;
  ge15Majority: number;
}

// code number|name|state|GE15 winning party|majority (votes). Source: Wikipedia, GE15 results by constituency.
const SEAT_DATA = `1|Padang Besar|PLS|PAS|12514
2|Kangar|PLS|BERSATU|9192
3|Arau|PLS|PAS|23216
4|Langkawi|KDH|BERSATU|13518
5|Jerlun|KDH|PAS|20456
6|Kubang Pasu|KDH|BERSATU|31584
7|Padang Terap|KDH|PAS|10959
8|Pokok Sena|KDH|PAS|31751
9|Alor Setar|KDH|PAS|9931
10|Kuala Kedah|KDH|PAS|28061
11|Pendang|KDH|PAS|31289
12|Jerai|KDH|PAS|33192
13|Sik|KDH|PAS|21787
14|Merbok|KDH|BERSATU|21019
15|Sungai Petani|KDH|PKR|1115
16|Baling|KDH|PAS|29137
17|Padang Serai|KDH|BERSATU|16260
18|Kulim-Bandar Baharu|KDH|BERSATU|13061
19|Tumpat|KTN|PAS|34793
20|Pengkalan Chepa|KTN|PAS|38270
21|Kota Bharu|KTN|PAS|22613
22|Pasir Mas|KTN|PAS|30717
23|Rantau Panjang|KTN|PAS|20636
24|Kubang Kerian|KTN|PAS|40847
25|Bachok|KTN|PAS|29901
26|Ketereh|KTN|BERSATU|23107
27|Tanah Merah|KTN|BERSATU|44485
28|Pasir Puteh|KTN|PAS|29109
29|Machang|KTN|BERSATU|10154
30|Jeli|KTN|PAS|12464
31|Kuala Krai|KTN|PAS|25188
32|Gua Musang|KTN|BERSATU|163
33|Besut|TRG|PAS|18666
34|Setiu|TRG|PAS|19032
35|Kuala Nerus|TRG|PAS|29765
36|Kuala Terengganu|TRG|PAS|40907
37|Marang|TRG|PAS|41796
38|Hulu Terengganu|TRG|BERSATU|15734
39|Dungun|TRG|PAS|34105
40|Kemaman|TRG|PAS|27179
41|Kepala Batas|PNG|PAS|2867
42|Tasek Gelugor|PNG|BERSATU|12252
43|Bagan|PNG|DAP|49648
44|Permatang Pauh|PNG|PAS|5272
45|Bukit Mertajam|PNG|DAP|57685
46|Batu Kawan|PNG|PKR|40400
47|Nibong Tebal|PNG|PKR|16293
48|Bukit Bendera|PNG|DAP|42610
49|Tanjong|PNG|DAP|28754
50|Jelutong|PNG|DAP|38604
51|Bukit Gelugor|PNG|DAP|63112
52|Bayan Baru|PNG|PKR|34902
53|Balik Pulau|PNG|PKR|1582
54|Gerik|PRK|BERSATU|1377
55|Lenggong|PRK|UMNO|879
56|Larut|PRK|BERSATU|11598
57|Parit Buntar|PRK|PAS|5395
58|Bagan Serai|PRK|PAS|18551
59|Bukit Gantang|PRK|BERSATU|12756
60|Taiping|PRK|DAP|25529
61|Padang Rengas|PRK|BERSATU|3046
62|Sungai Siput|PRK|PKR|1846
63|Tambun|PRK|PKR|3736
64|Ipoh Timor|PRK|DAP|43888
65|Ipoh Barat|PRK|DAP|56667
66|Batu Gajah|PRK|DAP|53836
67|Kuala Kangsar|PRK|BERSATU|3566
68|Beruas|PRK|DAP|33971
69|Parit|PRK|PAS|2155
70|Kampar|PRK|DAP|14330
71|Gopeng|PRK|PKR|27148
72|Tapah|PRK|MIC|5064
73|Pasir Salak|PRK|PAS|5003
74|Lumut|PRK|BERSATU|363
75|Bagan Datuk|PRK|UMNO|348
76|Teluk Intan|PRK|DAP|15169
77|Tanjong Malim|PRK|PKR|3541
78|Cameron Highlands|PHG|UMNO|4544
79|Lipis|PHG|UMNO|6117
80|Raub|PHG|DAP|4357
81|Jerantut|PHG|PAS|8092
82|Indera Mahkota|PHG|BERSATU|8399
83|Kuantan|PHG|PAS|2866
84|Paya Besar|PHG|UMNO|1317
85|Pekan|PHG|UMNO|8949
86|Maran|PHG|PAS|1821
87|Kuala Krau|PHG|PAS|1024
88|Temerloh|PHG|PAS|5520
89|Bentong|PHG|DAP|692
90|Bera|PHG|UMNO|16695
91|Rompin|PHG|BERSATU|1438
92|Sabak Bernam|SGR|BERSATU|5056
93|Sungai Besar|SGR|BERSATU|2721
94|Hulu Selangor|SGR|PAS|1562
95|Tanjong Karang|SGR|BERSATU|2180
96|Kuala Selangor|SGR|AMANAH|1002
97|Selayang|SGR|PKR|23619
98|Gombak|SGR|PKR|12729
99|Ampang|SGR|PKR|29681
100|Pandan|SGR|PKR|48296
101|Hulu Langat|SGR|AMANAH|14896
102|Bangi|SGR|DAP|69701
103|Puchong|SGR|DAP|57957
104|Subang|SGR|PKR|115074
105|Petaling Jaya|SGR|PKR|50515
106|Damansara|SGR|DAP|124619
107|Sungai Buloh|SGR|PKR|2693
108|Shah Alam|SGR|AMANAH|18095
109|Kapar|SGR|PAS|11782
110|Klang|SGR|DAP|91801
111|Kota Raja|SGR|AMANAH|73998
112|Kuala Langat|SGR|PAS|1833
113|Sepang|SGR|AMANAH|8949
114|Kepong|KUL|DAP|61081
115|Batu|KUL|PKR|22241
116|Wangsa Maju|KUL|PKR|20696
117|Segambut|KUL|DAP|59684
118|Setiawangsa|KUL|PKR|12164
119|Titiwangsa|KUL|UMNO|4632
120|Bukit Bintang|KUL|DAP|38977
121|Lembah Pantai|KUL|PKR|13912
122|Seputeh|KUL|DAP|67187
123|Cheras|KUL|DAP|54448
124|Bandar Tun Razak|KUL|PKR|9817
125|Putrajaya|PJY|BERSATU|2310
126|Jelebu|NSN|UMNO|8125
127|Jempol|NSN|UMNO|5857
128|Seremban|NSN|DAP|30841
129|Kuala Pilah|NSN|UMNO|6483
130|Rasah|NSN|DAP|61987
131|Rembau|NSN|UMNO|19897
132|Port Dickson|NSN|PKR|23601
133|Tampin|NSN|UMNO|1276
134|Masjid Tanah|MLK|BERSATU|4411
135|Alor Gajah|MLK|AMANAH|890
136|Tangga Batu|MLK|PKR|8849
137|Hang Tuah Jaya|MLK|PKR|8638
138|Kota Melaka|MLK|DAP|46420
139|Jasin|MLK|PAS|322
140|Segamat|JHR|PKR|5669
141|Sekijang|JHR|PKR|1734
142|Labis|JHR|DAP|2833
143|Pagoh|JHR|BERSATU|10007
144|Ledang|JHR|PKR|9769
145|Bakri|JHR|PKR|19254
146|Muar|JHR|MUDA|1345
147|Parit Sulong|JHR|UMNO|2021
148|Ayer Hitam|JHR|MCA|2963
149|Sri Gading|JHR|AMANAH|4000
150|Batu Pahat|JHR|PKR|15972
151|Simpang Renggam|JHR|UMNO|1821
152|Kluang|JHR|DAP|26406
153|Sembrong|JHR|UMNO|10880
154|Mersing|JHR|BERSATU|2337
155|Tenggara|JHR|UMNO|2991
156|Kota Tinggi|JHR|UMNO|8390
157|Pengerang|JHR|UMNO|5010
158|Tebrau|JHR|PKR|30720
159|Pasir Gudang|JHR|PKR|31558
160|Johor Bahru|JHR|PKR|16041
161|Pulai|JHR|AMANAH|33174
162|Iskandar Puteri|JHR|DAP|60036
163|Kulai|JHR|DAP|36023
164|Pontian|JHR|UMNO|5758
165|Tanjung Piai|JHR|MCA|6360
166|Labuan|LBN|BERSATU|708
167|Kudat|SBH|IND|1967
168|Kota Marudu|SBH|KDM|8174
169|Kota Belud|SBH|WARISAN|4582
170|Tuaran|SBH|UPKO|233
171|Sepanggar|SBH|PKR|7042
172|Kota Kinabalu|SBH|DAP|23783
173|Putatan|SBH|UMNO|124
174|Penampang|SBH|UPKO|14410
175|Papar|SBH|GRS|12224
176|Kimanis|SBH|UMNO|3037
177|Beaufort|SBH|UMNO|2518
178|Sipitang|SBH|GRS|4691
179|Ranau|SBH|GRS|11092
180|Keningau|SBH|GRS|8056
181|Tenom|SBH|IND|1108
182|Pensiangan|SBH|PBRS|5412
183|Beluran|SBH|BERSATU|1594
184|Libaran|SBH|UMNO|12618
185|Batu Sapi|SBH|GRS|4821
186|Sandakan|SBH|DAP|11031
187|Kinabatangan|SBH|UMNO|4330
188|Lahad Datu|SBH|WARISAN|4376
189|Semporna|SBH|WARISAN|20810
190|Tawau|SBH|GRS|3860
191|Kalabakan|SBH|UMNO|9100
192|Mas Gading|SWK|DAP|5480
193|Santubong|SWK|PBB|38681
194|Petra Jaya|SWK|PBB|41363
195|Bandar Kuching|SWK|DAP|28891
196|Stampin|SWK|DAP|7158
197|Kota Samarahan|SWK|PBB|29445
198|Puncak Borneo|SWK|PBB|13338
199|Serian|SWK|SUPP|16697
200|Batang Sadong|SWK|PBB|14893
201|Batang Lupar|SWK|PBB|14463
202|Sri Aman|SWK|PRS|4039
203|Lubok Antu|SWK|PRS|100
204|Betong|SWK|PBB|11302
205|Saratok|SWK|BERSATU|8826
206|Tanjong Manis|SWK|PBB|13908
207|Igan|SWK|PBB|14662
208|Sarikei|SWK|SUPP|3697
209|Julau|SWK|PBM|1340
210|Kanowit|SWK|PRS|236
211|Lanang|SWK|DAP|11544
212|Sibu|SWK|DAP|7760
213|Mukah|SWK|PBB|15686
214|Selangau|SWK|PRS|4986
215|Kapit|SWK|PBB|12402
216|Hulu Rajang|SWK|PRS|7505
217|Bintulu|SWK|PDP|22168
218|Sibuti|SWK|PBB|11745
219|Miri|SWK|PKR|6159
220|Baram|SWK|PDP|7339
221|Limbang|SWK|PBB|9998
222|Lawas|SWK|PBB|5677`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A typical voter profile for the kind of seat each GE15 winner holds (peninsula). */
const WINNER_PROFILE: Record<string, Demographics["ethnic"]> = {
  DAP: mix(0.2, 0.65, 0.13, 0, 0, 0.02),
  PKR: mix(0.55, 0.28, 0.15, 0, 0, 0.02),
  AMANAH: mix(0.6, 0.24, 0.14, 0, 0, 0.02),
  MCA: mix(0.5, 0.42, 0.07, 0, 0, 0.01),
  MIC: mix(0.5, 0.25, 0.23, 0, 0, 0.02),
  MUDA: mix(0.62, 0.33, 0.04, 0, 0, 0.01),
  UMNO: mix(0.82, 0.12, 0.05, 0, 0, 0.01),
  PAS: mix(0.88, 0.08, 0.03, 0, 0, 0.01),
  BERSATU: mix(0.82, 0.12, 0.05, 0, 0, 0.01),
};

function buildDemographics(code: number, state: StateInfo, party: string): Demographics {
  const h = (k: string) => hash01("demo", code, k);
  let ethnic = { ...state.mix };
  if (state.region === "peninsula") {
    const profile = WINNER_PROFILE[party];
    if (profile) {
      const t = 0.45 + h("t") * 0.35;
      ethnic = Object.fromEntries(BLOCS.map((b) => [b, state.mix[b] * (1 - t) + profile[b] * t])) as Demographics["ethnic"];
    }
  } else if (party === "DAP" || party === "SUPP") {
    // Chinese-majority town seats in Borneo.
    const local = state.region === "sabah" ? "sabah" : "sarawak";
    ethnic = mix(0, 0.62 + h("c") * 0.1, 0, 0, 0, 0.03);
    ethnic[local] = 1 - ethnic.chinese - ethnic.other;
  } else {
    ethnic.chinese = state.mix.chinese * (0.3 + h("c") * 0.4);
  }
  const total = BLOCS.reduce((s, b) => s + ethnic[b], 0);
  for (const b of BLOCS) ethnic[b] /= total;

  let urbanity = state.urbanity + (h("u") - 0.5) * 0.3;
  if (party === "DAP") urbanity += 0.3;
  if (party === "PAS") urbanity -= 0.12;
  urbanity = clamp(urbanity, 0.05, 1);
  return {
    ethnic,
    urbanity,
    youth: clamp(0.22 + h("y") * 0.12 + urbanity * 0.04, 0.15, 0.45),
    b40: clamp(0.75 - urbanity * 0.45 + (h("b") - 0.5) * 0.1, 0.15, 0.85),
  };
}

function buildSeats(): Seat[] {
  return SEAT_DATA.split("\n").map((line, index) => {
    const [num, name, stateId, party, maj] = line.split("|");
    const n = Number(num);
    const state = STATE_BY_ID[stateId];
    const majority = Number(maj);
    const demo = buildDemographics(n, state, party);
    // Urban seats are bigger (malapportionment). A seat must be big enough to hold its majority.
    const base = 45000 + demo.urbanity * 120000 + hash01("elec", n) * 30000;
    const electorate = Math.round(Math.max(base, majority / 0.42) / 100) * 100;
    return {
      index,
      code: `P.${String(n).padStart(3, "0")}`,
      name,
      state: stateId,
      electorate,
      demo,
      ge15Party: party,
      ge15Coalition: PARTIES[party].coalition,
      ge15Majority: majority,
    };
  });
}

export const SEATS: Seat[] = buildSeats();
export const TOTAL_SEATS = SEATS.length; // 222
export const MAJORITY = Math.floor(TOTAL_SEATS / 2) + 1; // 112
export const SUPERMAJORITY = Math.ceil((TOTAL_SEATS * 2) / 3); // 148

/** Coalitions that field candidates in a region. */
export const CONTESTING: Record<Region, CoalitionId[]> = {
  peninsula: ["PH", "BN", "PN", "MUDA", "OTHERS"],
  sabah: ["PH", "BN", "PN", "GRS", "WARISAN", "OTHERS"],
  sarawak: ["GPS", "PH", "PN", "OTHERS"],
};

export function seatRegion(seat: Seat): Region {
  return STATE_BY_ID[seat.state].region;
}

export function contestingIn(seat: Seat): CoalitionId[] {
  const list = CONTESTING[seatRegion(seat)];
  // MUDA only fields candidates in young, urban seats or where it already holds the seat.
  return list.filter((c) => c !== "MUDA" || seat.ge15Coalition === "MUDA" || seat.demo.urbanity > 0.85);
}

/** The ballot party a coalition would field in a seat. */
export function candidateParty(seat: Seat, c: CoalitionId): string {
  if (seat.ge15Coalition === c) return seat.ge15Party;
  const e = seat.demo.ethnic;
  const region = seatRegion(seat);
  switch (c) {
    case "PH":
      if (e.chinese > 0.5) return "DAP";
      if (region === "sabah" && e.sabah > 0.6) return "UPKO";
      return hash01("ph", seat.index) < 0.75 ? "PKR" : "AMANAH";
    case "BN":
      if (e.chinese > 0.4) return "MCA";
      if (e.indian > 0.2) return "MIC";
      return "UMNO";
    case "PN":
      return ["KDH", "KTN", "TRG", "PLS"].includes(seat.state) || e.malay > 0.85 ? "PAS" : "BERSATU";
    case "GPS":
      return e.chinese > 0.5 ? "SUPP" : "PBB";
    case "GRS":
      return "GRS";
    case "WARISAN":
      return "WARISAN";
    case "MUDA":
      return "MUDA";
    default:
      return "IND";
  }
}

export function majorityBloc(seat: Seat): Bloc | "mixed" {
  let best: Bloc = "malay";
  for (const b of BLOCS) if (seat.demo.ethnic[b] > seat.demo.ethnic[best]) best = b;
  return seat.demo.ethnic[best] >= 0.5 ? best : "mixed";
}
