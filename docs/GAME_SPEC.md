# "Malam Pilihan Raya": Malaysian Parliament Strategy Game: Design & Build Plan

> Status (Oct 2026): milestones 1–10 are implemented. Not yet built: real constituency-boundary map and real state-seat names, historical start dates, full Bahasa Malaysia translation of all game text.

## Context
The user wants a political strategy game about Malaysian politics. The climax is **election night**, and the game around it is about preparing to win: money, support, policy and political standing. The player can be **in government or in opposition**, and both sides have to gain control and win the next election. **State elections (PRN)** are included as well as the **general election (PRU)**. The project folder is empty, so this is a new build.

Decisions so far: **web browser game**, **real parties and politicians**, **turn-based (1 turn = 1 week)**, **single player vs AI**.

> Realism guardrail: the real parties/leaders are used with their real names. Scandal or crime events are **never pinned on a real person as fact**. They are generic ("a deputy minister from your party…") or caused by the player's own choices. The opening screen states "data snapshot as of Oct 2026", and the roster lives in an editable JSON file so it is easy to update.

---

## 0. The empire-building feel (modelled on Grounds Up)
Grounds Up (`Downloads\Claude Coffee\grounds-up`) is satisfying because: **one café grows into the richest person in the world**, every asset keeps paying out every week, the player's role rises **operator → CEO → investor** through delegation, rivals have **strength and mood** and can be **taken over** (with a trophy wall), and the **rich list** is a fixed target to climb. This game copies that structure, with **seats as the cafés**:

| Grounds Up | Malam Pilihan Raya equivalent |
|---|---|
| One café → chain → IPO → holding company → richest in world | **Ketua Cawangan → Ketua Bahagian → ADUN → MP → Minister → Party President → PM → Elder statesman / kingmaker** |
| Branches earn weekly profit | **Every seat you hold is an asset**: it pays weekly Funds (allocation), machinery and influence. Strongholds compound like cafés. |
| Local reputation, word of mouth | **Seat loyalty / incumbency**: each term held, a seat gets harder to steal (fortress levels: Marginal → Leaning → Safe → **Kubu Kuat** (stronghold)) |
| Managers → COO/CTO/CMO/CFO autopilot | **Division chiefs** run seats on autopilot; **Party Secretary-General, Treasurer, Information Chief, Election Director, Youth/Women chiefs** run whole areas with ratings and autopilot switches |
| Rival chains: strength 0–100, confident → rattled → desperate → for sale | **Rival parties** have strength and mood: confident → rattled → desperate → **collapsing** (members and branches defect to you, or **merge/absorb the party** as a takeover), with a trophy wall of rivals you broke |
| Rich list as a fixed target | **Power Ranking / history list**: beat real records (GE seat totals, longest-serving PM, biggest swing, two-thirds majority) |
| Property empire, stocks, holding company | **Party holding company** (§2a): businesses, property, investments |
| Skyline banner grows with branches | **Party HQ / rally crowd banner** grows with seats and members |
| Decision cards, "explain why it changed" reports | Same: weekly report explains *why* support moved, plus political decision cards |
| Nothing locked, just expensive early | Same: you can contest any seat from week 1; doing it too early just wastes money |

**"Hold what you have, propel to the top":** the loop is **win a seat → fortify it → it funds the next push**. Losing a stronghold hurts like losing a flagship café, so defending matters as much as attacking. State governments are the "holding company" layer: holding a state unlocks state budget, state GLCs and appointments, which fund the federal push.

**Same design rule as Grounds Up:** every system must (1) create a meaningful decision, (2) stay relevant when you're large, and (3) be automatable later.

## 1. Core loop
1. **Pick a side**: a coalition/party (PH, BN, PN, GPS, GRS, Warisan, MUDA…), Government or Opposition, and a start mode:
   - **Career (main mode)**: start small as a branch chief and climb the ladder in §0.
   - **Leader**: start as party president.
2. **Weekly turns**: spend **Action Points (AP)** on actions, then **Skip 1 Week / Skip 1 Month** (as in Grounds Up). Events and AI moves resolve, polls update, and a report explains why things changed. AP grows as you climb, and delegation frees AP for bigger moves.
3. **State elections** happen during the term (fixed dates or triggered by dissolution).
4. **Dissolution**: the PM picks the timing, or the term expires after 5 years.
5. **Campaign period** (about 2 to 4 turns) with nomination day, ceramah and debates.
6. **Election Night** (the climax), then **coalition-building** if there is a hung parliament.
7. Win: form government with **112 of 222** Dewan Rakyat seats (or win and hold the target states).

## 2. Resources (the "much has to be done" list)
| Resource | What it does | Gained from | Lost to |
|---|---|---|---|
| **Dana (Funds)** | Pays for campaigns, ads, machinery, handouts | Donors, tycoons, party dues, GLC links (gov), fundraising dinners | Every action; MACC fines |
| **Sokongan (Public Support)** | Per-demographic per-seat approval | Policies, ceramah, media, local projects | Scandals, price hikes, unpopular policy |
| **Political Capital** | Spent to push bills or force party discipline | Wins, by-election victories, strong speeches | U-turns, failed bills |
| **Party Unity** | Low unity means factions, sabotage, defections | Fair seat allocation, cabinet posts | Leadership challenges, snubbed warlords |
| **Coalition Trust** | Per partner; decides seat-allocation fights and post-election loyalty | Honouring deals, sharing posts | Fighting over seats, ignoring partners |
| **Integrity / Risk meter** | High risk means MACC probes and leaks | Clean governance | Money politics, dodgy donors |
| **Machinery (Jentera)** | Ground game strength per state | Hiring branch workers, recruiting members | Underfunding, defections |
| **Media Reach** | How strong messaging is (TV, newspapers, TikTok, WhatsApp groups) | Ads, influencers, owning outlets | Fake-news backlash |

### 2a. Party business empire & investments (finance depth)
The party owns a **holding company** (a real-life pattern: parties have historically held media, construction and investment arms). Each asset gives weekly income and has its own risk and side effects:
| Asset | Income | Side effect |
|---|---|---|
| **Party newspaper / news portal / TV slot** | Low | Media Reach up in owned language markets |
| **Construction & development company** | High, needs gov contracts | Risk up a lot when the party is in government; gives jobs (local support) |
| **Plantation (palm oil / rubber)** | Medium, tied to the commodity price event | Settler/FELDA-style rural vote bonus |
| **Property portfolio (party HQ, shophouses)** | Steady rent | Can be sold in a crisis |
| **Cooperative (koperasi) for members** | Low | Party Unity and membership up |
| **Tech/digital agency** | Medium | Cheaper social media campaigns |
| **Stock portfolio (Bursa)** | Volatile, follows economy events | Market-crash events can wipe it out |
| **Unit trust / education foundation** | Low | Youth support and scholarships PR |
- Actions: buy, sell, invest to upgrade a level, appoint a CEO (a loyal crony is cheap but risky; a professional costs more but is clean), use the asset as election funding (Funds up big, Risk up).
- **Exposure system**: the more opaque the empire, the higher the MACC/journalist investigation chance. Government parties get bigger contract income but more scrutiny.
- **Donor network**: individual tycoons each have a personal agenda (e.g. a tycoon wants a highway approved). Accepting creates a "favour owed" that comes due later as an event.
- **Party treasury dashboard**: income/expense chart per week, a war-chest target before dissolution, and the legal spending cap per candidate (ceiling per seat; exceeding it gives election-petition risk after you win).

## 3. Voter model
- **222 parliamentary seats** and **600 state seats** with real names and codes (P.001 Padang Besar to P.222 Semporna).
- Each seat has a demographic mix: **Malay, Chinese, Indian, Sabah Bumiputera, Sarawak Bumiputera, Others** × **Urban / Semi-urban / Rural** × **Youth (Undi18) / Adult / Senior** × **B40 / M40 / T20**.
- Each bloc has **issue weights**: cost of living, religion, race policy, corruption, economy, MA63/Borneo autonomy, education, development.
- **Malapportionment** matters: rural seats are smaller, so they are worth more per vote.
- **Turnout** model: rain, festive timing, outstation voters returning home, and youth apathy.

## 3a. How you win voters (the support formula)
Every seat × voter bloc has a support % computed weekly:

`support = base loyalty + issue match + candidate + local service + buzz + money effect − scandal − fatigue`, and then **turnout** decides how much of that support becomes votes.

| Lever | Speed | Lasts | Cost | Catch |
|---|---|---|---|---|
| **Issue match** (your policy stances vs the bloc's issue weights) | Slow | Permanent while you keep the stance | Political Capital | Blocs disagree: what wins rural Malay seats can lose urban Chinese seats. **No party can please everyone alone, so coalitions exist.** |
| **Local service** (clinics, roads, flood relief, a "pusat khidmat" office) | Slow | **Permanent** and compounds into fortress level | Funds | This is the "café reputation" of the game: boring but the strongest long-term lever |
| **Candidate quality** (local hero vs parachute, age, ethnicity fit) | Instant at nomination | One term | Party Unity (snubbed incumbents may sabotage you) | Dropping a weak incumbent can cause them to run as an independent |
| **Buzz** (ceramah, TikTok, rallies, viral moments) | Fast | **Fades about 5% a week** | AP + Funds | Worthless if spent too early; it must **peak on polling day** |
| **Handouts / cash aid** | Instant | Short | Lots of Funds; Integrity/economy damage | Diminishing returns, and a chance voters "take the money and vote elsewhere" (much higher in urban/young blocs) |
| **Machinery** (branch workers, transport for voters, PACA polling agents) | Medium | Builds up | Funds | Does not change minds; it **raises your supporters' turnout**. Many close seats are won here. |
| **Identity plays** (race/religion messaging) | Fast, strong | Medium | Free | Big gains in homogeneous seats, big losses in mixed seats, and it **damages coalition trust** with partners from other communities |
| **Economy / cost of living** | Slow | Ongoing | — | Top issue in most seats. Government gets credit **and blame**; the opposition can only attack. |
| **Trust / promises kept** | Slow | Very long | — | Broken manifesto promises cost support for the whole next term |

**The intended winning play:** build permanent support (service + issue match) between elections, keep the coalition covering complementary blocs, save buzz and money for the last 8 weeks, and use machinery to win the close seats. The preview tool (from Grounds Up's `preview.ts`) shows the estimated gain before every action, so the system is learnable rather than random.

## 3b. The path to the top (career progression)
Two engines feed each other, like Grounds Up's company cash and personal wealth:
- **Money loop:** Funds → machinery and projects → support → seats → state/federal allocations and business income → more Funds.
- **Power loop:** seats → **faction** (MPs/ADUNs loyal to you) → party posts → more AP, policy control and candidate picks → more seats.

| Rung | How you climb to the next rung | What unlocks |
|---|---|---|
| **1. Ketua Cawangan** (branch chief) | Recruit members, run kenduri, win the **division election** (delegate votes) | Local machinery, a small fund |
| **2. Ketua Bahagian** (division chief) | Get your division's delegates behind you and become "winnable" in party polls, so the president nominates you | You pick your branch chiefs (your first "managers") |
| **3. ADUN / MP** | Win the seat, then fortify it with service | Seat allocation money, a Dewan voice, constituency office |
| **4. Faction builder** | Fund and campaign for allies' seats, so they owe you loyalty | Faction size becomes a currency in party elections |
| **5. State EXCO / Deputy Minister / Shadow Minister** | Portfolio performance events build national profile | Policy actions, media reach |
| **6. Party VP → Deputy President → President** | Win party elections (faction + delegate deals + unity); **internal rivals are AI too** | Control of the party treasury, business empire and candidate list |
| **7. Coalition leader** | Seat-allocation deals and partner trust | Leads GE negotiations |
| **8. Menteri Besar / Prime Minister** | Hold 112 SDs; Agong appoints | Budget, dissolution timing, GLCs, appointments |
| **9. Hold the top** | Survive no-confidence motions, keep partners, win re-election, aim for a **two-thirds majority** | Constitutional amendments; the "dynasty" score |

**Holding what you have:** at every rung you have something to defend: your seat, your faction, your post, your state. Rival AI attacks those (challengers at party AGMs, rival parties targeting your strongholds). The satisfaction comes from fortifying assets so they keep producing while you push higher, the same way cafés kept earning while you bought stocks in Grounds Up.

## 4. Actions (spend AP each week)
**Campaign and support**
- Ceramah in a seat or state · Walkabout at pasar malam/pasar tani · Kenduri / open house (festive turns) · Visit a mosque/temple/church (bonus within a bloc, risk outside it) · TikTok/social media push · Hire influencers · Billboard/print ads · Door-to-door with branch machinery · Rally (risks a police permit issue) · Recruit candidates (local hero vs parachute candidate)

**Finance**
- Fundraising dinner · Court a tycoon donor (Funds up, Risk up) · Party membership drive · Use GLC networks (gov only, Risk up) · Declare finances transparently (Integrity up)

**Political standing / party**
- Shore up a division chief (ketua bahagian) · Handle a factional "warlord" · Seat-allocation negotiation with partners · Reshuffle cabinet / shadow cabinet · Fight off a leadership challenge at the party AGM · Court a defector (limited by the **2022 anti-hopping law**: party-level moves only)

**Policy (Government)**
- Table the **Budget** (annual turn, a big event) · Subsidy rationalisation (fuel/electricity: economy up, popularity down) · Cash aid (Rahmah/STR-style) · Minimum wage · Raise/cut SST · Infrastructure projects in specific states (ECRL-style, Pan Borneo) · Education/language policy · Religious-affairs policy · MA63 concessions to Sabah/Sarawak · Anti-corruption reforms · Mega projects (Risk up)

**Policy (Opposition)**
- Shadow budget · Motion of no confidence · Parliamentary questions to embarrass ministers · Expose a scandal (needs an investigation action first) · Promise manifesto items (cheap now, the cost comes later if you win) · Run the state governments you hold as a showcase · Street protest / petition

## 5. Government vs Opposition asymmetry
| Government | Opposition |
|---|---|
| Controls the budget and allocations (pork-barrel spending to seats) | Freer to promise; nothing to defend |
| **Chooses when to dissolve Parliament** (a major strategic lever) | Can force a crisis with a no-confidence motion |
| Handles crises (floods, the ringgit, global shocks), which are blamed on them | Exploits those crises |
| Takes the blame for incumbency fatigue over time | Constant fight for funding |
| Can appoint allies to GLCs and posts | Uses its state governments as a power base |

## 6. Events (random + scripted)
- **Monsoon floods** (east coast, Nov to Jan): relief response tests competence.
- Ringgit drop, oil price swing, chip-industry boom.
- Generic party scandals (leaked audio, misused funds) with responses: deny / sack / apologise / sue.
- Palace intervention, Agong/Sultan statements (handled respectfully).
- Racial or religious flashpoint: choose to calm or exploit it (exploiting gives short-term gains with long-term costs).
- **By-elections** from a death or resignation, which act as mini-tests.
- Viral moment: an MP's gaffe in the Dewan.
- Coalition partner threatens to leave.
- Court verdicts in generic "high-profile cases".
- Festivals: Hari Raya, CNY, Deepavali, Gawai, Kaamatan (open-house opportunities).

## 7. State elections (PRN)
- **13 states with assemblies** (KL, Putrajaya and Labuan only have parliamentary seats).
- Real cycles: **Sabah, Sarawak, Melaka and Johor** run off-cycle; **Selangor, Penang, NS, Kedah, Kelantan and Terengganu** are synced (the 2023 pattern). Perak, Pahang and Perlis are usually held with the GE.
- A state Menteri Besar/Chief Minister can **dissolve early** (AI or the player, if you hold the state).
- Effects: winning a state gives **state funds, machinery, a showcase bonus and momentum** for the GE. Losing one damages Party Unity.
- The player chooses whether to **sync the state polls with the GE** (saves money, nationalises the campaign) or keep them separate.
- **Sabah and Sarawak** have their own local-party dynamics (GPS, GRS, Warisan). They are often kingmakers, and the MA63 issue is huge there.

## 8. The climax: Election Night
1. **Polling day**: watch live turnout percentages by state through the day.
2. **Polls close at 6pm**. A results ticker shows seats called in rough count order (smaller rural seats first, big urban seats later).
3. A **live map of Malaysia** colours seats as they are called, with a seat counter racing toward 112.
4. Drama beats: recount requests, "too close to call", a TV analyst panel, surprise upsets of big names, concession calls.
5. **Hung parliament phase** (likely, as in real life since 2018): negotiate with other coalitions and Borneo blocs. Offer DPM posts, ministries and MA63 promises, and collect **Statutory Declarations (SDs)**.
6. **Audience with the Agong**: present your SDs; the Agong appoints the PM who commands a majority.
7. Ending screen: sworn in as PM, or an opposition-leader epilogue, with a newspaper headline summary.

## 8a. Interactive maps
**A. National map (main game screen)**
- A real Malaysia map with **actual constituency boundaries** (222 parliamentary + 600 state seats), built from open GeoJSON boundary data (e.g. Tindak Malaysia's published electoral-boundary datasets; check the licence before bundling), simplified with mapshaper so it loads fast.
- Zoom levels: **Country → State → Parliament seat → State (DUN) seats inside it**. Peninsular and Borneo are shown side by side with a toggle.
- **Map lenses** (toggle buttons): current holder party · your support % (heatmap) · swing since last election · ethnic majority · urban/rural · machinery strength · where your money is being spent · predicted result (safe / leaning / tossup).
- Click a seat to open a side panel with: MP, majority, demographics, top issues, rival candidates, and quick actions ("Ceramah here", "Allocate funds", "Change candidate").
- **Cartogram toggle**: equal-size hex per seat, so KL's tiny seats are as clickable as huge Sarawak seats.

**B. Dewan Rakyat seating chart**
- An interactive chamber with 222 seats: **government benches to the Speaker's right, opposition to the left**, with crossbench/independents shown. A **hemicycle view** is also available (the classic "parliament chart").
- Seats are coloured by party; hover shows MP name, constituency and loyalty. Click to view or court the MP (needed for no-confidence votes and SDs).
- **Live during play**: seats shift colour when there are defections, by-elections, or a coalition partner walking out.
- **Vote mode**: when a bill or no-confidence motion is tabled, each seat lights Aye / No / Abstain as the division happens.
- Also used for **each State Assembly (DUN)** with its own chart (e.g. Selangor 56, Sarawak 82).
- On **Election Night** the chamber fills up live as results are called, next to the map.

## 8b. Playtime & satisfaction (how to make it last without being frustrating)
**Win tiers, so every election feels like progress, not pass/fail:**
| Tier | Example condition | Reward |
|---|---|---|
| Bronze | Gain more seats than last time / "steal" X seats | Momentum bonus next term |
| Silver | Win or hold a state government | State funds + showcase |
| Gold | Deny the rival a majority (hung parliament) | Kingmaker negotiations |
| Platinum | Form the federal government | PM ending |
| Diamond | Two-thirds supermajority (148 seats) | Constitutional amendment powers |
- **Seat-level celebrations**: every flipped seat on Election Night gets a "SEAT STOLEN!" pop with the margin. A **Personal Bests** list tracks things like biggest swing ever and narrowest win.
- **Multi-term career / dynasty mode** (the main source of playtime): after the election the game continues. Govern or rebuild in opposition, then fight the next GE. A full run is about 3 to 4 terms (15 to 20 years). Leaders age and retire, so you groom successors.
- **Run length estimate**: one term is about 260 weekly turns, which can be compressed with "fast-forward to next event" and auto-resolve for quiet weeks. That gives about 2 to 4 hours per GE cycle, and 8 to 15+ hours per full campaign.
- **Replayability**: about 10 playable parties, each with unique traits/abilities (e.g. Borneo parties have an MA63 leverage power; an Islamist party has strong ulama networks in Kelantan/Terengganu; multiracial parties get an urban bonus), plus randomised events, a seeded "world" and scenarios.
- **Objectives / missions** per term (e.g. "Win back Johor", "Pass the Budget without a revolt") with rewards.
- **Achievements** (around 50) such as "Tsunami Politik", "Kingmaker" and "Undi18 Darling".
- **Unlocks**: winning with one party unlocks harder scenarios and other parties' unique traits. (Historical start dates are left out for now.)
- **Losing still progresses**: you keep your branch machinery and some influence. The opposition-leader epilogue sets up a "comeback" next term.
- **Anti-tedium**: an advisor recommends actions, bulk actions ("Ceramah tour across Perak"), auto-manage per state, and a week-summary digest instead of many popups.

## 8c. More feature suggestions
- **Career mode**: start as a backbencher or Youth wing chief and climb (division chief, MP, minister, party president, PM).
- **Party internal elections**: win the party presidency first, with delegate vote-buying temptation.
- **Manifesto builder** before each GE: promises are tracked, and broken promises cost trust next term.
- **Live news feed + fake social media** ("X/TikTok trending" ticker reacting to your moves).
- **Debates and Question Time minigame**: pick responses for a quick support swing.
- **Polling agency**: pay for accurate polls; free polls are noisy or biased.
- **Bilingual BM/English** (Bahasa Malaysia is essential for flavour), with optional Mandarin/Tamil later.
- **Photo-op generator / election posters** using party colours and logos.
- **Sandbox/"what if" mode**: edit seat demographics and simulate.

## 9. Difficulty / scenarios
- **Scenarios**: "Present Day (2026 snapshot)", "Underdog: start with 10 seats", "Hung Parliament Crisis", "Borneo Kingmaker" (play GPS/GRS).
- **Difficulty**: AI aggressiveness, starting Funds, event severity.

---

## 10. Technical plan (web)
**Stack (TypeScript + React). Match Grounds Up so its proven patterns carry over:**
- **Next.js + React + TypeScript + Tailwind + Zustand + Recharts + Vitest**: the same as Grounds Up, so the save system, PWA, mobile shell and engine layout can be adapted directly.
- **Patterns to copy from Grounds Up** (copy and adapt, not import):
  - `src/game/week.ts` / `month.ts`: Skip 1 Week / Skip 1 Month, with month = 4 weeks enforced by tests.
  - `src/game/rng.ts`: seeded RNG.
  - `src/game/config.ts`: all balance numbers in one file.
  - `src/game/explain.ts`: "why it changed" text.
  - `src/game/preview.ts`: what-if estimates (e.g. "this ceramah ≈ +1.2% in P.105").
  - `src/game/systems/decisions.ts`: hash-drawn decision cards with defaults.
  - `systems/rivalry.ts`: strength and mood, applied to rival parties.
  - `systems/milestones.ts` + `AchievementsPanel.tsx`.
  - `migrate.ts`: save upgrades.
  - `store/saveDb.ts` + `saveFile.ts`: IndexedDB save slots and file export.
  - `components/mobile/*` + `Sections.tsx`: phone navigation.
  - `ReportModal.tsx`, `Toast.tsx`, `InboxDrawer.tsx`.
  - PWA files: `manifest.ts`, `sw.js`.
  - `balance.bot.test.ts`: a scripted player runs many terms.
- **Zustand (+ Immer if wanted)**: game state.
- **d3-geo + topojson-client**: renders the real constituency GeoJSON as SVG with zoom/pan (react-zoom-pan-pinch). It switches to **Canvas/PixiJS** only if the 822 polygons get slow.
- **Framer Motion**: Election Night animations, seat flips and the ticker.
- **Recharts**: polls, treasury and swing charts.
- **Tailwind CSS**: fast UI styling for menu-heavy screens.
- **i18next**: BM/English toggle.
- **IndexedDB save slots**: adapted from Grounds Up's `saveDb.ts`.
- **Vitest**: engine tests. **Playwright** (later): UI smoke tests.
- **Tauri** (later, optional): package as a desktop app for itch.io/Steam from the same code.
- Engine runs in a **Web Worker** for big simulations (AI turns, 100-run balance tests) so the UI never freezes.
- No backend.

**Folder layout (new; mirrors Grounds Up):**
```
src/
  app/                    Next.js layout, page, manifest, globals.css
  game/
    config.ts             all balance numbers
    world.ts              states, 222 + 600 seats, parties, leaders, demographics
    week.ts / month.ts    the only places time moves
    actions.ts            every player decision (pure functions)
    voter.ts              per-seat support from demographics × issues × actions
    election.ts           polling day, counting order, results
    explain.ts / preview.ts / rng.ts / migrate.ts
    systems/              career, party, coalition, rivalry (party mood), treasury, business, donors,
                          policies, budget, events/decisions, media, machinery, stateElections, aiParties, milestones
  components/             tabs (Overview, Map, Dewan, Party, Treasury, Business, Policy, Campaign), ElectionNight,
                          CoalitionTalks, ReportModal, map/ (MalaysiaMap, SeatPanel, Lenses), dewan/ (Chamber, Hemicycle)
  store/                  gameStore, saveDb, saveFile
public/data/              constituencies.topojson (simplified)
```
The engine is pure TypeScript with no React, so it is testable and deterministic with a seeded RNG.

**Milestones**
1. **Skeleton**: Vite project, data files for states and 222 seats (demographics approximated), party/leader roster.
2. **Voter model + election sim**: compute the seat result from demographics × support × turnout. Vitest checks that results are sane.
3. **Interactive national map + Dewan seating chart** (lenses, zoom, seat panel).
4. **Turn loop + resources + actions + party business empire**: Dashboard UI, AP spending, weekly resolution, treasury.
5. **Policies, Budget, events system** (data-driven from JSON).
6. **AI parties**: simple utility AI that picks actions toward its target seats.
7. **State elections** + the dissolution mechanic.
8. **Election Night screen** (animated ticker + map + filling chamber) + **coalition/SD/Agong phase** + win tiers.
9. **Multi-term career loop**, objectives, achievements, unlocks.
10. Polish: scenarios, save slots, BM/English, sound, advisor, fast-forward.

**First build session goal = milestones 1 to 3**: a playable map and seating chart driven by real seat data and a working election sim. This is the foundation everything else plugs into.

## 10a. Endless play & performance budget
**Endless play:** there is no end date. After any election the game continues, either with the next term or a comeback from opposition. When your leader ages or retires, you **hand over to a protégé** you groomed (their stats come from the faction you built), so the party "dynasty" keeps going. Win tiers and records keep giving goals, and play continues freely after reaching the top (like Grounds Up after #1 on the rich list).

**Weight: the plan fits easily in a browser/PWA.**
- Grounds Up's 1 GB on disk is almost all dev tooling: `.next` build cache (640 MB) and `node_modules` (486 MB). The actual game source is **1.2 MB**, and the shipped app is a few MB. This game will be similar.
- The simulation is small: 822 seats × about 15 voter blocs is about 12k numbers per week, which takes milliseconds.
- Budgets to hold to:
  - **Map:** the constituency TopoJSON is simplified to **≤ 2 MB**, loaded once and cached by the service worker. The SVG redraws only changed seats; it switches to Canvas if zoomed-out redraws get slow.
  - **Saves:** like Grounds Up, keep full detail for the last 13 weeks only. Older history is cut to totals, and each past election keeps the seat results only, so a 50-year save stays under about 1 MB (IndexedDB, compressed export).
  - **Turn speed:** AI parties + the weekly sim run in a **Web Worker**, with a target of < 100 ms per week (so Skip 1 Month feels instant).
  - **Election Night:** results are precomputed, and only the animation plays live.
- The balance bot test also checks performance: 200 simulated years must run in under a minute.

## 11. Verification
- `npm run test`: unit tests for the voter model (a 100% Malay rural seat responds to the right issues), the election sim (seat totals = 222, majority logic), and coalition math (SD count ≥ 112 lets you form the government).
- `npm run dev`, then play through in the browser pane: start as opposition, run 10 turns, trigger a PRN, dissolve, and watch Election Night through to the Agong screen. Check that the map colours and seat counter match the computed results.
- A balance check: a script runs 100 AI-only simulated elections and checks the outcomes vary (no coalition wins every time).
