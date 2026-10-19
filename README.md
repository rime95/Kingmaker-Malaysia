# Malam Pilihan Raya

A turn-based Malaysian politics strategy game: build your power base, hold your seats and win election night.
The full design lives in [docs/GAME_SPEC.md](docs/GAME_SPEC.md).

Stack: Next.js · React · TypeScript · Tailwind · Zustand · Vitest (same as Grounds Up).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests
npm run typecheck
```

Or double-click `Start Game.bat`.

## Built so far (milestones 1–5)

- All 222 Dewan Rakyat seats with their GE15 winners and majorities. Seat demographics are estimates.
- Voter model: each seat's vote share comes from voter blocs × regional lean, calibrated so the untouched world reproduces GE15.
  National swing and per-seat offsets are the levers later systems will move.
- Seeded election simulation with national, state and seat noise, turnout, and the order seats are called on the night.
- Hex seat map (one hex per seat, grouped by state) with lenses: holder, projection, your support, ethnic majority, urban/rural, test election.
- Dewan Rakyat chart: hemicycle and chamber-bench views, today or after a test election.
- Weekly turn loop: Skip 1 Week / Skip 1 Month (exactly four weeks, enforced by tests), 6 action points a week, weekly and monthly reports.
- Resources: war chest, political capital, party unity, coalition trust, integrity, MACC risk (raids), media reach, members.
- Actions with live previews: seat (ceramah, walkabout, service project, machinery, handouts), state tours, national campaigns, party and money actions. Government and opposition get different tools.
- Per-seat presence: service (permanent, builds fortress levels), machinery (needs upkeep), buzz (fades 5% a week).
- Party holding company: eight businesses with levels, crony vs professional CEOs, tapping for the war chest, and selling.
- Policies: ten issues with stances that move voter groups. Government enacts them through a Dewan vote (partners rebel when trust is low) and moves the economy and public finances; opposition pledges them at half strength, and unfunded pledges cost integrity.
- The annual Budget (second week of October): allocate an envelope set by fiscal space, or table a shadow budget in opposition.
- Decision cards: about 16 news events (floods, ringgit, leaked audio, flashpoints, by-elections that really change seats...) plus festival open houses, each with numbered choices and a default after four weeks.

## Where things live

| Path | What |
|---|---|
| `src/game/world.ts` | States, parties, coalitions, the 222 seats and their estimated demographics |
| `src/game/config.ts` | All balancing numbers (temporary) |
| `src/game/voter.ts` | Vote shares per seat, GE15 calibration, projections |
| `src/game/election.ts` | One simulated polling day |
| `src/game/week.ts`, `src/game/month.ts` | Skip 1 Week (the only place time moves) and Skip 1 Month |
| `src/game/actions.ts` | Every player decision and its preview |
| `src/game/systems/business.ts` | Party holding company |
| `src/game/systems/policies.ts`, `budget.ts`, `events.ts`, `segments.ts` | Policies, the Budget, decision cards, and how effects land on voter groups |
| `src/game/state.ts` | Saved game state |
| `src/game/hexLayout.ts` | Hex cartogram layout and state borders |
| `src/components/` | Start screen, seat bars, map, seat panel, Dewan chart |
