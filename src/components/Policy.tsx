"use client";

import { useMemo, useState } from "react";
import { budgetVoters, dewanVote, policyBlocked, previewPolicy } from "@/game/actions";
import { ECONOMY_REST } from "@/game/config";
import { isGovernment, weekDate } from "@/game/state";
import { BUDGET, BUDGET_LINES, budgetEnvelope } from "@/game/systems/budget";
import { MULTIRACIAL, PLEDGE_WEIGHT, POLICIES, POLICY_COST, POLICY_SCALE, UNFUNDED_INTEGRITY_PER_FISCAL, type Policy as PolicyDef } from "@/game/systems/policies";
import { describeSeg } from "@/game/systems/segments";
import { useGame } from "@/store/gameStore";
import { isPresident } from "@/game/systems/career";
import { MAJORITY } from "@/game/world";

export function Policy() {
  const game = useGame((s) => s.game)!;
  const gov = isGovernment(game);
  const vote = dewanVote(game);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 @md:grid-cols-3">
        <Gauge label="Economy" value={game.economy} note={gov ? "Your government gets the credit and the blame" : "Hard times help the opposition a little"} rest={ECONOMY_REST} />
        <Gauge label="Fiscal space" value={game.fiscal} note={`Sets the Budget envelope: ${budgetEnvelope(game.fiscal)} points`} rest={50} />
        <div className="panel p-3">
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {gov ? "Dewan vote if held today" : "Your role"}
          </div>
          {gov ? (
            <>
              <div className="font-semibold tabular-nums" style={{ color: vote.passes ? "var(--ink)" : "var(--bad)" }}>
                {vote.passes ? "✓" : "✕"} {vote.yes} – {vote.no}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                {vote.rebels ? `${vote.rebels} government MPs likely to rebel. ` : ""}Bills need {MAJORITY}.
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold">Opposition</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                You can&apos;t pass laws, only pledge them. Pledges get {Math.round(PLEDGE_WEIGHT * 100)}% of the effect.
              </div>
            </>
          )}
        </div>
      </div>

      {game.budgetDue !== null && <BudgetPanel />}

      <section className="panel p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 mb-3">
          <h2 className="font-semibold">{gov ? "Government policy" : "Your pledges"}</h2>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Changing a position costs {POLICY_COST.ap} AP and {gov ? POLICY_COST.gov : POLICY_COST.opp} political capital
            {gov ? ", and needs a Dewan majority" : ""}. Voter effects in vote-share points among each group.
            {MULTIRACIAL.includes(game.player) ? " Identity plays strain your multiracial coalition." : ""}
          </span>
        </div>
        <div className="grid gap-3 @2xl:grid-cols-2">
          {POLICIES.map((p) => (
            <PolicyRow key={p.id} policy={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PolicyRow({ policy }: { policy: PolicyDef }) {
  const game = useGame((s) => s.game)!;
  const adopt = useGame((s) => s.policy);
  const gov = isGovernment(game);
  const current = game.me.policies[policy.id] ?? 0;
  const previews = useMemo(() => policy.options.map((_, i) => (i === current ? 0 : previewPolicy(game, policy.id, i))), [game, policy, current]);
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="font-semibold text-sm">{policy.name}</span>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {policy.area}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {policy.options.map((o, i) => {
          const active = i === current;
          const blocked = active ? null : policyBlocked(game, policy.id, i);
          const extras = [
            gov && o.economy ? `Economy ${signed(o.economy)}` : "",
            gov && o.fiscal ? `Fiscal ${signed(o.fiscal)}` : "",
            MULTIRACIAL.includes(game.player) && o.trustMultiracial ? `Partner trust ${signed(o.trustMultiracial)}` : "",
            o.integrity ? `Integrity ${signed(o.integrity)}` : "",
            !gov && (o.fiscal ?? 0) < 0 ? `Integrity −${Math.round(-o.fiscal! * UNFUNDED_INTEGRITY_PER_FISCAL)} (unfunded)` : "",
          ].filter(Boolean);
          return (
            <button
              key={o.id}
              disabled={active || !!blocked}
              onClick={() => adopt(policy.id, i)}
              className="text-left rounded-md border p-2 disabled:cursor-default"
              style={{ borderColor: active ? "var(--ink)" : "var(--line)", background: active ? "var(--surface-2)" : "transparent", opacity: blocked ? 0.6 : 1 }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {active ? "● " : ""}
                  {o.label}
                </span>
                {!active && previews[i] !== 0 && (
                  <span className="text-[11px] tabular-nums" style={{ color: previews[i] > 0 ? "var(--good)" : "var(--bad)" }}>
                    {previews[i] > 0 ? "▲ +" : "▼ −"}
                    {Math.abs(previews[i])} seat{Math.abs(previews[i]) === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: "var(--ink-2)" }}>
                {o.blurb}
              </div>
              {(Object.keys(o.voters).length > 0 || extras.length > 0) && (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {[describeSeg(o.voters, (gov ? 1 : PLEDGE_WEIGHT) * POLICY_SCALE), ...extras].filter(Boolean).join(" · ")}
                </div>
              )}
              {!active && blocked && (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {blocked}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BudgetPanel() {
  const game = useGame((s) => s.game)!;
  const submit = useGame((s) => s.budget);
  const gov = isGovernment(game);
  const envelope = budgetEnvelope(game.fiscal);
  const max = envelope + BUDGET.overspendMax;
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries(BUDGET_LINES.map((l) => [l.id, 0])));
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  const over = Math.max(0, total - envelope);
  const year = weekDate(game.week).getFullYear() + 1;
  const left = game.budgetDue! + BUDGET.window - game.week;
  const weight = gov ? 1 : BUDGET.shadowWeight;
  const vote = dewanVote(game);
  const set = (id: string, d: number) => setAlloc((a) => ({ ...a, [id]: Math.max(0, Math.min(max, a[id] + d)) }));
  const effect = budgetVoters(alloc, weight).voters;

  return (
    <section className="panel p-4" style={{ borderLeft: "4px solid var(--accent)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-semibold">{gov ? `Budget ${year}` : `Shadow Budget ${year}`}</h2>
        <span className="text-xs" style={{ color: left <= 1 ? "var(--bad)" : "var(--muted)" }}>
          {left <= 1 ? "Table it this week" : `${left} weeks left`}
          {gov ? " · otherwise officials table an even split" : ""}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--ink-2)" }}>
        {gov
          ? `Spend ${envelope} points. You may overspend by up to ${BUDGET.overspendMax}: each extra point costs ${BUDGET.overspendFiscal} fiscal space and ${BUDGET.overspendEconomy} economy. Effects last about a year.`
          : `Costs ${BUDGET.shadowAp} AP. No vote, ${Math.round(BUDGET.shadowWeight * 100)}% of the effect: voters judge your alternative.`}
      </p>
      <div className="grid gap-1.5 @lg:grid-cols-2">
        {BUDGET_LINES.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-md border p-2" style={{ borderColor: "var(--line)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{l.label}</div>
              <div className="text-[11px] truncate" style={{ color: "var(--muted)" }} title={l.blurb}>
                {describeSeg(l.voters, weight)} per point
              </div>
            </div>
            <button className="chip" aria-label={`Less ${l.label}`} onClick={() => set(l.id, -1)}>
              −
            </button>
            <span className="w-6 text-center tabular-nums font-semibold">{alloc[l.id]}</span>
            <button className="chip" aria-label={`More ${l.label}`} onClick={() => set(l.id, 1)} disabled={total >= max}>
              +
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <span className="text-sm tabular-nums">
          {total} / {envelope} points
          {over ? <span style={{ color: "var(--bad)" }}> · deficit {over}</span> : ""}
        </span>
        <span className="text-xs flex-1 min-w-[200px]" style={{ color: "var(--muted)" }}>
          {describeSeg(effect) || "Allocate points to see the effect."}
        </span>
        {gov && !vote.passes && (
          <span className="text-xs" style={{ color: "var(--bad)" }}>
            ✕ Would be defeated {vote.yes}–{vote.no}
          </span>
        )}
        {!isPresident(game.career) && (
          <span className="text-xs" style={{ color: "var(--bad)" }}>
            Only the party president tables it{gov ? "; officials will table an even split" : ""}.
          </span>
        )}
        <button className="btn" onClick={() => submit(alloc)} disabled={total === 0 || total > max || !isPresident(game.career)}>
          {gov ? "Table the Budget" : "Present shadow budget"}
        </button>
      </div>
    </section>
  );
}

function Gauge({ label, value, note, rest }: { label: string; value: number; note: string; rest: number }) {
  const diff = value - rest;
  return (
    <div className="panel p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {label}
        </span>
        <span className="font-semibold tabular-nums">
          {Math.round(value)}{" "}
          <span className="text-[11px]" style={{ color: diff >= 0 ? "var(--good)" : "var(--bad)" }}>
            {diff >= 0 ? "▲" : "▼"} {Math.abs(Math.round(diff))} vs normal
          </span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full mt-1.5" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: "var(--ink-2)" }} />
        <div className="absolute -top-1 -bottom-1 w-[2px]" style={{ left: `${rest}%`, background: "var(--ink)" }} />
      </div>
      <div className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
        {note}
      </div>
    </div>
  );
}

const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
