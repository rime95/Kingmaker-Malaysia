// Standing orders: moves you repeat every turn without clicking (a weekly ceramah in your marginal, a dinner, a TikTok
// push). At the start of each turn they run in order while you have the AP and money; the rest wait for next turn.

import type { Target } from "../actions";
import type { GameState, ReportLine } from "../state";
import { SEATS, STATE_BY_ID } from "../world";

export interface Order {
  id: string;
  target: Target;
}

export const MAX_ORDERS = 8;

export const sameTarget = (a: Target, b: Target) =>
  a.kind === b.kind && (a.kind !== "seat" || a.seat === (b as { seat: number }).seat) && (a.kind !== "state" || a.state === (b as { state: string }).state);

export const hasOrder = (s: Pick<GameState, "orders">, id: string, t: Target) => s.orders.some((o) => o.id === id && sameTarget(o.target, t));

export function toggleOrder(s: GameState, id: string, t: Target): { state: GameState; message: string } | { error: string } {
  if (hasOrder(s, id, t))
    return {
      state: {
        ...s,
        orders: s.orders.filter((o) => !(o.id === id && sameTarget(o.target, t))),
      },
      message: "Standing order cancelled.",
    };
  if (s.orders.length >= MAX_ORDERS) return { error: `You can keep up to ${MAX_ORDERS} standing orders.` };
  return {
    state: { ...s, orders: [...s.orders, { id, target: t }] },
    message: "Standing order set: this runs at the start of every turn.",
  };
}

export const targetName = (t: Target) => (t.kind === "seat" ? SEATS[t.seat].name : t.kind === "state" ? STATE_BY_ID[t.state].name : "nationwide");

/** Run every standing order you can afford. `apply` is applyAction (passed in to keep imports one-way). */
export function runOrders(
  s: GameState,
  apply: (s: GameState, id: string, t: Target) => { ok: true; state: GameState; message: string } | { ok: false; error: string },
  name: (id: string) => string,
): { state: GameState; lines: ReportLine[] } {
  let state = s;
  const done: string[] = [];
  const skipped: string[] = [];
  for (const o of s.orders) {
    const r = apply(state, o.id, o.target);
    const label = `${name(o.id)} (${targetName(o.target)})`;
    if (r.ok) {
      state = r.state;
      done.push(label);
    } else skipped.push(`${label}: ${r.error}`);
  }
  const lines: ReportLine[] = [];
  if (done.length)
    lines.push({
      text: `Standing orders done: ${done.join(", ")}.`,
      tone: "info",
    });
  for (const x of skipped) lines.push({ text: `Standing order skipped: ${x}`, tone: "bad" });
  return { state, lines };
}
