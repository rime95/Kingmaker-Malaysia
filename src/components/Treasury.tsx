"use client";

import { useState } from "react";
import { TAP_COOLDOWN, TAP_WEEKS } from "@/game/actions";
import { isGovernment, weekLabel, type HistoryPoint } from "@/game/state";
import { ASSETS, ASSET_ORDER, CEO, MAX_LEVEL, assetIncome, assetProfit, assetRisk, ceoPay, saleValue, upgradeCost, type Asset, type AssetType } from "@/game/systems/business";
import { weeklyCashFlow } from "@/game/week";
import { ALLOC, COLLECT, allocationLine, fullAllocations, yourPay } from "@/game/systems/funding";
import { useGame } from "@/store/gameStore";
import { fmtRM } from "./common";

export function Treasury() {
  const game = useGame((s) => s.game)!;
  const flow = weeklyCashFlow(game);
  const totalIn = flow.income.reduce((a, l) => a + l.amount, 0);
  const totalOut = flow.expenses.reduce((a, l) => a + l.amount, 0) + flow.upkeep;
  const net = totalIn - totalOut;
  const owned = game.me.assets;
  const available = ASSET_ORDER.filter((t) => !owned.some((a) => a.type === t) || t === "bursa");

  return (
    <div className="flex flex-col gap-4">
      <FundingCard />
      <div className="grid gap-4 @2xl:grid-cols-[1fr_1.3fr]">
        <section className="panel p-4">
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Party war chest
          </div>
          <div className="text-3xl font-bold tabular-nums">{fmtRM(game.me.funds)}</div>
          <div className="text-sm mt-1" style={{ color: net >= 0 ? "var(--good)" : "var(--bad)" }}>
            {net >= 0 ? "▲" : "▼"} {fmtRM(Math.abs(net))} a week before actions
            {net < 0 && game.me.funds > 0 ? ` · runs dry in ${Math.floor(game.me.funds / -net)} weeks` : ""}
          </div>
          <table className="w-full text-sm mt-3">
            <tbody>
              {flow.income.map((l) => (
                <Row key={l.label} label={l.label} amount={l.amount} />
              ))}
              {flow.expenses.map((l) => (
                <Row key={l.label} label={l.label} amount={-l.amount} />
              ))}
              <Row label="Machinery upkeep" amount={-flow.upkeep} />
            </tbody>
          </table>
        </section>
        <section className="panel p-4">
          <h2 className="font-semibold mb-2">War chest over time</h2>
          <FundsChart history={game.history} />
        </section>
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 mb-3">
          <h2 className="font-semibold">Party holding company</h2>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Businesses pay every week. Crony CEOs are cheap and loyal but raise MACC risk; professionals earn more and stay clean.
          </span>
        </div>
        {owned.length === 0 ? (
          <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
            The party owns nothing yet. Every business below keeps paying while you campaign.
          </p>
        ) : (
          <div className="grid gap-3 @lg:grid-cols-2 mb-4">
            {owned.map((a) => (
              <OwnedAsset key={a.type} asset={a} />
            ))}
          </div>
        )}
        <h3 className="text-sm font-semibold mb-2">Buy</h3>
        <div className="grid gap-2 @lg:grid-cols-2 @4xl:grid-cols-3">
          {available.map((t) => (
            <BuyCard key={t} type={t} owned={owned.some((a) => a.type === t)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className="border-t" style={{ borderColor: "var(--line)" }}>
      <td className="py-1 pr-2">{label}</td>
      <td className="py-1 text-right tabular-nums" style={{ color: amount < 0 ? "var(--ink-2)" : "var(--ink)" }}>
        {amount < 0 ? `−${fmtRM(-amount)}` : `+${fmtRM(amount)}`}
      </td>
    </tr>
  );
}

function OwnedAsset({ asset }: { asset: Asset }) {
  const game = useGame((s) => s.game)!;
  const business = useGame((s) => s.business);
  const gov = isGovernment(game);
  const def = ASSETS[asset.type];
  const tapWait = asset.tappedWeek === null ? 0 : Math.max(0, TAP_COOLDOWN - (game.week - asset.tappedWeek));
  return (
    <div className="card rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">{def.name}</span>
        {asset.type !== "bursa" && (
          <span className="text-xs whitespace-nowrap" aria-label={`Level ${asset.level} of ${MAX_LEVEL}`}>
            {"●".repeat(asset.level)}
            <span style={{ color: "var(--muted)" }}>{"○".repeat(MAX_LEVEL - asset.level)}</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Mini label="Profit / week" value={fmtRM(assetProfit(asset, gov, game.me.market))} />
        <Mini label="Worth if sold" value={fmtRM(saleValue(asset))} />
        <Mini label="Risk / week" value={`+${assetRisk(asset, gov).toFixed(1)}`} />
      </div>
      <div className="text-xs" style={{ color: "var(--ink-2)" }}>
        {def.effect}
        {asset.type === "plantation" ? ` · commodity index ${game.me.market.commodity.toFixed(2)}` : ""}
        {asset.type !== "bursa" ? ` · earns ${fmtRM(assetIncome(asset, gov, game.me.market))}, CEO takes ${fmtRM(ceoPay(asset, gov, game.me.market))}` : ""}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["pro", "crony"] as const).map((c) => (
          <button key={c} className="chip" aria-pressed={asset.ceo === c} onClick={() => business("ceo", asset.type, c)} title={`Takes ${Math.round(CEO[c].payShare * 100)}% of income (${fmtRM(Math.round(assetIncome({ ...asset, ceo: c }, gov, game.me.market) * CEO[c].payShare))}/week)${c === "pro" ? ", earns 15% more" : ", earns 5% less and raises MACC risk"}`}>
            {CEO[c].label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {asset.type === "bursa" ? (
          <button className="btn btn-ghost text-xs" onClick={() => business("buy", "bursa")}>
            Invest {fmtRM(def.price)} more
          </button>
        ) : (
          <>
            <button className="btn btn-ghost text-xs" disabled={asset.level >= MAX_LEVEL} onClick={() => business("upgrade", asset.type)} style={asset.level >= MAX_LEVEL ? { opacity: 0.4 } : undefined}>
              {asset.level >= MAX_LEVEL ? "Top level" : `Upgrade · ${fmtRM(upgradeCost(asset))}`}
            </button>
            <button
              className="btn btn-ghost text-xs"
              disabled={tapWait > 0}
              onClick={() => business("tap", asset.type)}
              title={`Take ${TAP_WEEKS} weeks of income now. MACC risk +15.`}
              style={tapWait > 0 ? { opacity: 0.4 } : undefined}
            >
              {tapWait > 0 ? `Tap again in ${tapWait} wks` : `Tap for war chest · +${fmtRM(assetIncome(asset, gov, game.me.market) * TAP_WEEKS)}`}
            </button>
          </>
        )}
        <button className="btn btn-ghost text-xs" onClick={() => confirm(`Sell ${def.name} for ${fmtRM(saleValue(asset))}?`) && business("sell", asset.type)}>
          Sell
        </button>
      </div>
    </div>
  );
}

function BuyCard({ type, owned }: { type: AssetType; owned: boolean }) {
  const game = useGame((s) => s.game)!;
  const business = useGame((s) => s.business);
  if (owned) return null;
  const def = ASSETS[type];
  const gov = isGovernment(game);
  const weekly = type === "bursa" ? (def.price * 0.04) / 52 : def.income * (type === "construction" && !gov ? 0.3 : 1);
  const short = def.price > game.me.funds;
  return (
    <div className="card rounded-lg border p-3 flex flex-col gap-1.5" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">{def.name}</span>
        <span className="text-xs tabular-nums">{fmtRM(def.price)}</span>
      </div>
      <div className="text-xs" style={{ color: "var(--ink-2)" }}>
        About {fmtRM(weekly)}/week{weekly > 0 ? ` · pays back in ~${Math.round(def.price / weekly)} weeks` : ""}
      </div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>
        {def.effect}
      </div>
      <div className="flex gap-1.5 mt-1">
        {type === "bursa" ? (
          <button className="btn text-xs" disabled={short} onClick={() => business("buy", type, "pro")} style={short ? { opacity: 0.4 } : undefined}>
            Buy
          </button>
        ) : (
          (["pro", "crony"] as const).map((c) => (
            <button key={c} className={c === "pro" ? "btn text-xs" : "btn btn-ghost text-xs"} disabled={short} onClick={() => business("buy", type, c)} style={short ? { opacity: 0.4 } : undefined}>
              Buy · {c === "pro" ? "pro CEO" : "crony CEO"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Single-series line of party funds by week, with a hover crosshair. */
function FundsChart({ history }: { history: HistoryPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520;
  const H = 180;
  const pad = { l: 56, r: 8, t: 8, b: 22 };
  if (history.length < 2)
    return (
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Skip a week to start the chart.
      </p>
    );
  const xs = history.map((h) => h.week);
  const ys = history.map((h) => h.funds);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(...ys) * 1.05 || 1;
  const x = (w: number) => pad.l + ((w - xs[0]) / Math.max(1, xs.at(-1)! - xs[0])) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - minY) / (maxY - minY)) * (H - pad.t - pad.b);
  const d = history.map((h, i) => `${i ? "L" : "M"}${x(h.week).toFixed(1)},${y(h.funds).toFixed(1)}`).join("");
  const ticks = [minY, (minY + maxY) / 2, maxY];
  const h = hover !== null ? history[hover] : null;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Party funds by week"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          history.forEach((p, i) => {
            if (Math.abs(x(p.week) - px) < Math.abs(x(history[best].week) - px)) best = i;
          });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
              {fmtRM(t)}
            </text>
          </g>
        ))}
        {minY < 0 && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--ink-2)" strokeWidth={1} />}
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        <text x={pad.l} y={H - 6} fontSize={10} fill="var(--muted)">
          {weekLabel(xs[0])}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize={10} fill="var(--muted)" textAnchor="end">
          {weekLabel(xs.at(-1)!)}
        </text>
        {h && (
          <g>
            <line x1={x(h.week)} x2={x(h.week)} y1={pad.t} y2={H - pad.b} stroke="var(--ink-2)" strokeDasharray="3 3" />
            <circle cx={x(h.week)} cy={y(h.funds)} r={4.5} fill="var(--ink)" stroke="var(--raised)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && (
        <div className="absolute top-0 right-0 text-xs rounded-md px-2 py-1 border" style={{ background: "var(--raised)", borderColor: "var(--line)" }}>
          {weekLabel(h.week)} · <b>{fmtRM(h.funds)}</b> · {h.seats} seats if held then
        </div>
      )}
    </div>
  );
}

/** Where the money comes from: your pay, your seats' allocations (and the MoU), the collection tin and the dark side. */
function FundingCard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const pay = yourPay(game);
  const monthly = pay.reduce((a, r) => a + r.monthly, 0);
  const gov = isGovernment(game);
  const strong = COLLECT.strong.includes(game.player);
  return (
    <section className="grid gap-2 @2xl:grid-cols-3">
      <div className="inset p-3 text-xs">
        <div className="eyebrow mb-1">Your pay</div>
        {pay.length ? (
          <>
            {pay.map((r) => (
              <div key={r.label} className="flex justify-between">
                <span style={{ color: "var(--ink-2)" }}>{r.label}</span>
                <span className="tabular-nums">{fmtRM(r.monthly)}/mo</span>
              </div>
            ))}
            <div className="mt-1" style={{ color: "var(--muted)" }}>
              {fmtRM(monthly)} a month into your own pocket (Your wealth). Give some to the party to earn its gratitude.
            </div>
          </>
        ) : (
          <span style={{ color: "var(--muted)" }}>No salary: you do not hold a seat or a post.</span>
        )}
      </div>
      <div className="inset p-3 text-xs flex flex-col gap-1">
        <div className="eyebrow">Allocations</div>
        <span style={{ color: "var(--ink-2)" }}>{allocationLine(game)}</span>
        <span style={{ color: "var(--muted)" }}>
          {fullAllocations(game) ? `+${ALLOC.govService} service a week in each seat.` : `Only +${ALLOC.oppService} service a week: the government starves opposition seats.`}
        </span>
        {!gov && (
          <button className="chip !py-1 self-start mt-1" onClick={() => deep({ kind: "mou" })} title="Full allocations for your MPs, but no no-confidence motion and softer attacks">
            {game.funding.mou ? "Tear up the MoU" : "Sign an MoU with the government"}
          </button>
        )}
      </div>
      <div className="inset p-3 text-xs flex flex-col gap-1">
        <div className="eyebrow">The party&apos;s other money</div>
        <span style={{ color: "var(--ink-2)" }}>
          Every ceramah passes the collection tin{strong ? " (your machine is famous for it: +60%)" : ""}. Merchandise sells when you are in the news; corporate donors
          back likely winners in election season.
        </span>
        <span style={{ color: "var(--muted)" }}>
          Quick money ({gov ? "kickbacks, GLC posts, " : ""}dedak, tycoons) is under Campaign → Plan. MACC is watching.
        </span>
      </div>
    </section>
  );
}
