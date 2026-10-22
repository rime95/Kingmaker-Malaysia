// Diagnostic: which factor makes a government snowball? (SIM=1 only)
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { DIFFICULTY, EFFECT } from "./config";
import { advanceTurn } from "./month";
import { newGame, type GameState } from "./state";
import { testGeneralElection } from "./testTools";
import { botTurn } from "./sim.test";
import { goToAgong } from "./actions";

const seatsOf = (s: GameState, c: string) => s.holders.filter((h) => h === c).length;

function run(label: string) {
  let s = newGame("PH", 7);
  const row: Record<string, unknown> = { label };
  for (let ge = 1; ge <= 3; ge++) {
    for (let t = 0; t < (ge === 1 ? 32 : 52) && !s.night; t++) s = advanceTurn(botTurn(s));
    row[`funds${ge}`] = Math.round(s.me.funds / 1e6);
    row[`mom${ge}`] = Math.round(s.me.momentum);
    s = testGeneralElection(s);
    row[`GE${15 + ge}`] = seatsOf(s, "PH");
    const r = goToAgong({ ...s, night: null });
    s = advanceTurn(r.ok ? r.state : s);
  }
  return row;
}

it.skipIf(!process.env.SIM)("diag", { timeout: 900_000 }, () => {
  const rows = [run("edge on")];
  const e = DIFFICULTY.normal.edge;
  DIFFICULTY.normal.edge = 1;
  rows.push(run("edge off"));
  DIFFICULTY.normal.edge = e;
  const sp = EFFECT.starPower;
  EFFECT.starPower = 0;
  rows.push(run("edge on, no star power"));
  EFFECT.starPower = sp;
  writeFileSync(process.env.SIM_OUT!, JSON.stringify(rows));
});
