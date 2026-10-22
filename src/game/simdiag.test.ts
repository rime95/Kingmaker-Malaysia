// Diagnostic: which factor makes a government snowball? (SIM=1 only)
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { EFFECT, GE } from "./config";
import { advanceTurn } from "./month";
import { newGame, type GameState } from "./state";
import { AGENDA } from "./systems/agenda";
import { NATION } from "./systems/nation";
import { testGeneralElection } from "./testTools";
import { botTurn } from "./sim.test";

const seatsOf = (s: GameState, c: string) => s.holders.filter((h) => h === c).length;

function run(label: string, bot: boolean) {
  let s = newGame("PH", 7);
  const row: Record<string, unknown> = { label };
  for (let ge = 1; ge <= 3; ge++) {
    const turns = ge === 1 ? 32 : 52;
    for (let t = 0; t < turns && !s.night; t++) s = advanceTurn(bot ? botTurn(s) : s);
    row[`appr${ge}`] = Math.round(s.nation.approval);
    row[`mom${ge}`] = Math.round(s.me.momentum);
    row[`nat${ge}`] = Math.round(s.me.nationalBuzz);
    s = testGeneralElection(s);
    row[`GE${15 + ge}`] = seatsOf(s, "PH");
    s = advanceTurn({ ...s, night: null });
    row[`gov${ge}`] = s.government.join("+");
  }
  return row;
}

it.skipIf(!process.env.SIM)("diag", { timeout: 900_000 }, () => {
  const rows = [];
  const save = { mom: EFFECT.momentum, fade: GE.calFade, agenda: AGENDA.monthlyApproval, appr: NATION.approvalSwingGov };
  rows.push(run("idle", false));
  rows.push(run("bot", true));
  EFFECT.momentum = 0;
  rows.push(run("bot, no momentum", true));
  EFFECT.momentum = save.mom;
  GE.calFade = 1;
  rows.push(run("bot, no calibration fade", true));
  GE.calFade = save.fade;
  NATION.approvalSwingGov = 0;
  rows.push(run("bot, no approval swing", true));
  NATION.approvalSwingGov = save.appr;
  writeFileSync(process.env.SIM_OUT!, JSON.stringify(rows));
});
