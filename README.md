# Malam Pilihan Raya

A turn-based Malaysian politics strategy game. Build your power base, hold what you have, and win election night: from branch chief
to Prime Minister, through state elections, Budgets, scandals, rival parties and coalition talks. The design lives in
[docs/GAME_SPEC.md](docs/GAME_SPEC.md).

Stack: Next.js · React · TypeScript · Tailwind · Zustand · Vitest (same as Grounds Up). Runs in the browser, installs as an app (PWA)
and plays offline in production builds.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests
npm run typecheck
npm run build      # production build (offline play and install)
```

Or double-click `Start Game.bat`.

## What's in the game

- **The map**: the real map of Malaysia from DOSM boundary data, full screen and dark (map-first, like the GE16 Simulator).
  Smooth zoom and pan (wheel, pinch, buttons), seat names as you zoom in, the 600 state seats at close zoom, lenses (holder,
  today, your support, strongholds, rival pressure, ethnic, urban/rural, test election), pulses where rivals are working your
  seats, and gold **opportunity bubbles** (Plague Inc style) to click for free bonuses each week.
- **Clean, map-first UI**: a slim status bar (seat race to 112, war chest, AP, Next week), an icon rail that opens one panel at
  a time over the map (Campaign, Party, Policy, States, Dewan, Rivals, Money), a seat card when you click a seat, a news ticker,
  breaking-news decision alerts and a compact week in review. Phones get bottom navigation and sheets.
- **Voter model**: each seat's vote share comes from voter blocs × regional lean, calibrated so the untouched world reproduces GE15.
  Service (permanent), machinery (turnout, needs upkeep), buzz (fades), policies, the Budget and public mood all move it.
- **Weekly turns**: Skip 1 week / 1 month (exactly four weeks) / to the next event, action points, reports that explain changes.
- **Resources**: war chest, political capital, unity, coalition trust, integrity, MACC risk (raids), media reach, members.
- **Party holding company**: eight businesses with levels, crony or professional CEOs, tapping for the war chest, selling.
- **Policies & the Budget**: ten issues; government enacts them through Dewan votes (partners rebel when trust is low), opposition
  pledges them. The annual Budget in October, or a shadow budget.
- **Decision cards**: news events (floods, ringgit, leaked audio, flashpoints, by-elections that change seats), festival open
  houses and the June party AGM, each with numbered choices and a default.
- **Rival parties**: every other coalition earns money, targets close seats, builds early and campaigns late, defends where you
  campaign and attacks you when hostile.
- **State elections**: the real 600 state seats (names, boundaries and parliamentary seats from DOSM) starting from each state's
  real seat split; assemblies dissolve at the end of their term, early by an AI ruler, or by you.
- **Election Night**: seats declared one by one in counting order, the map filling in, race bars, upsets, recounts and "SEAT
  STOLEN!", optional sound. Then **coalition talks**: gather 112 statutory declarations as a candidate (offer DPM, ministries, MA63)
  or play kingmaker, and the Agong appoints the government. Results are graded Bronze to Diamond.
- **Career and dynasty**: leader mode (start as the real party president) or career mode (start as Ketua Cawangan, win your home
  seat, climb at the June AGM). Leaders age and hand over to a protégé; lose badly and the party challenges you. Term objectives,
  28 achievements and personal bests.
- **Scenarios and difficulty**: present day, snap election, underdog (unlocks after a Gold result); easy, normal, hard.
- **Advisor**: what deserves attention this week, with one-click moves ranked by the game's own preview.
- **Saves**: autosave, named save slots in the browser, and save files to move a game between computers.
- **Bahasa Malaysia / English** for navigation, controls and Election Night.

## Map data

`public/data/malaysia.topo.json` and `src/game/data/duns.ts` are built from the Department of Statistics Malaysia's open data
([dosm-malaysia/data-open](https://github.com/dosm-malaysia/data-open), DOSM Open Data License): `electoral_0_parlimen.geojson`,
`electoral_1_dun.geojson` and `state_parlimen_dun.csv`. To rebuild, download them into `data/raw/` and run
`node scripts/build-map.mjs` (simplified to about 280 KB, 75 KB compressed). This game is not an official DOSM product.

## Where things live

| Path | What |
|---|---|
| `src/game/config.ts` | All balancing numbers (temporary) |
| `src/game/world.ts` | States, parties, coalitions, the 222 seats and their estimated demographics |
| `src/game/voter.ts`, `election.ts` | Vote shares, GE15 calibration, projections; simulated polling days |
| `src/game/state.ts` | The saved game state, new games, save upgrades, voter-model inputs |
| `src/game/week.ts`, `month.ts` | Skip 1 Week (the only place time moves) and Skip 1 Month |
| `src/game/actions.ts` | Every player decision and its preview |
| `src/game/progress.ts`, `advice.ts` | Career, objectives and achievements each week; the advisor |
| `src/game/systems/` | Business, policies, Budget, events, segments, rivals, state seats (`dun.ts`), dissolution and polling (`assemblies.ts`), government formation, career, goals |
| `src/components/map/` | The zoomable map (`MalaysiaMap`), geometry loading (`geo.ts`) and lenses |
| `src/components/shell/` | Map-first layout: status bar, nav rail, side panel, seat card, news ticker, alerts, week in review |
| `src/components/` | Panel contents (policy, states, rivals, money, career, Dewan), Election Night, coalition talks, start screen |
| `src/store/` | Zustand store with autosave, save slots, cross-game profile |

Real parties and leaders are used for flavour; every result and event in the game is simulated, and scandals are never attributed
to real people.
