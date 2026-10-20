"use client";

import { useState } from "react";
import { BURSA, affordable, type Stock } from "@/game/systems/bursa";
import { PROPERTIES, PROPERTY_BY_ID, WEALTH, netWorth, unitPrice, type Owner } from "@/game/systems/wealth";
import { teamSalaries } from "@/game/systems/team";
import { useGame } from "@/store/gameStore";
import { STATES, STATE_BY_ID } from "@/game/world";
import { Treasury } from "../Treasury";
import { fmtRM, pct } from "../common";

type Tab = "party" | "bursa" | "property" | "wealth";
const TABS: { id: Tab; label: string }[] = [
  { id: "party", label: "Party" },
  { id: "bursa", label: "Bursa" },
  { id: "property", label: "Property" },
  { id: "wealth", label: "Your wealth" },
];

/** Money: the party's war chest and businesses, your share portfolio, property, and your own fortune. */
export function MoneyPanel() {
  const [tab, setTab] = useState<Tab>("party");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} className="chip" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "party" && <Treasury />}
      {tab === "bursa" && <Bursa />}
      {tab === "property" && <Property />}
      {tab === "wealth" && <Wealth />}
    </div>
  );
}

const rm2 = (v: number) => `RM ${v.toFixed(2)}`;

function Cash() {
  const game = useGame((s) => s.game)!;
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span style={{ color: "var(--muted)" }}>Your cash</span>
      <span className="font-semibold tabular-nums">{fmtRM(game.personal.cash)}</span>
    </div>
  );
}

// --- Bursa ---------------------------------------------------------------------------------------

function Bursa() {
  const game = useGame((s) => s.game)!;
  const [open, setOpen] = useState<string | null>(null);
  const held = Object.entries(game.personal.portfolio);
  return (
    <div className="flex flex-col gap-4">
      <Cash />
      {held.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">Your shares</h3>
          <ul className="flex flex-col gap-1">
            {held.map(([t, h]) => {
              const st = game.bursa.find((x) => x.ticker === t)!;
              const value = st.price * h.shares;
              const gain = value - h.cost;
              return (
                <li key={t} className="inset px-2.5 py-1.5 text-xs grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <button className="text-left font-semibold" onClick={() => setOpen(open === t ? null : t)}>
                    {t} <span className="font-normal" style={{ color: "var(--muted)" }}>{h.shares.toLocaleString("en-MY")} shares</span>
                  </button>
                  <span className="tabular-nums">{fmtRM(value)}</span>
                  <span className="tabular-nums w-16 text-right" style={{ color: gain >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {gain >= 0 ? "▲" : "▼"} {pct(Math.abs(gain) / Math.max(1, h.cost), 1)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h3 className="eyebrow mb-1.5">Bursa Malaysia</h3>
        <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
          Prices follow growth, the OPR, crises, projects and your own policies. Buying a sector right before your government moves it is insider trading.
        </p>
        <ul className="flex flex-col gap-1">
          {game.bursa.map((st) => (
            <li key={st.ticker} className="inset">
              <StockRow st={st} open={open === st.ticker} onToggle={() => setOpen(open === st.ticker ? null : st.ticker)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StockRow({ st, open, onToggle }: { st: Stock; open: boolean; onToggle: () => void }) {
  const h = st.history;
  const prev = h.length > 4 ? h[h.length - 5] : st.price;
  const ch = st.price / prev - 1;
  return (
    <>
      <button className="w-full px-2.5 py-1.5 grid grid-cols-[1fr_64px_auto_56px] gap-2 items-center text-xs text-left" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0 truncate">
          <b>{st.ticker}</b> <span style={{ color: "var(--muted)" }}>{st.sector}{st.glc ? " · GLC" : ""}</span>
        </span>
        <Spark values={h.slice(-26)} />
        <span className="tabular-nums">{rm2(st.price)}</span>
        <span className="tabular-nums text-right" style={{ color: Math.abs(ch) < 0.001 ? "var(--ink-2)" : ch > 0 ? "var(--good)" : "var(--bad)" }}>
          {Math.abs(ch) < 0.001 ? "•" : ch > 0 ? "▲" : "▼"} {pct(Math.abs(ch), 1)}
        </span>
      </button>
      {open && <Trade st={st} />}
    </>
  );
}

function Trade({ st }: { st: Stock }) {
  const game = useGame((s) => s.game)!;
  const money = useGame((s) => s.money);
  const [n, setN] = useState(1000);
  const [trigger, setTrigger] = useState(Math.round(st.price * 0.9 * 100) / 100);
  const held = game.personal.portfolio[st.ticker]?.shares ?? 0;
  const max = affordable(st, game.personal.cash);
  const pe = st.price / Math.max(0.0001, st.eps * 4);
  const yld = (st.eps * 4 * st.payout) / st.price;
  const orders = game.personal.orders.filter((o) => o.ticker === st.ticker);
  const input = "rounded-md px-2 py-1 text-xs w-24 tabular-nums";
  const inputStyle = { background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" };
  return (
    <div className="px-2.5 pb-2.5 flex flex-col gap-2 text-xs">
      <div style={{ color: "var(--ink-2)" }}>
        {st.name} · P/E {pe.toFixed(1)} · dividend yield {pct(yld, 1)} · results every quarter
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input type="number" min={1} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 0))} className={input} style={inputStyle} aria-label="Shares" />
        <button className="chip !py-1 text-xs" disabled={n > max} onClick={() => money({ kind: "buy", ticker: st.ticker, n })}>
          Buy ≈ {fmtRM(st.price * n * (1 + BURSA.fee))}
        </button>
        <button className="chip !py-1 text-xs" disabled={n > held} onClick={() => money({ kind: "sell", ticker: st.ticker, n })}>
          Sell
        </button>
        <span style={{ color: "var(--muted)" }}>
          you hold {held.toLocaleString("en-MY")} · can afford {max.toLocaleString("en-MY")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span style={{ color: "var(--muted)" }}>Standing order at RM</span>
        <input type="number" step={0.01} min={0.01} value={trigger} onChange={(e) => setTrigger(Number(e.target.value) || 0)} className={input} style={inputStyle} aria-label="Trigger price" />
        <button className="chip !py-1 text-xs" onClick={() => money({ kind: "order", ticker: st.ticker, order: "stopLoss", trigger, shares: n })}>
          Stop-loss
        </button>
        <button className="chip !py-1 text-xs" onClick={() => money({ kind: "order", ticker: st.ticker, order: "takeProfit", trigger, shares: n })}>
          Take profit
        </button>
        <button className="chip !py-1 text-xs" onClick={() => money({ kind: "order", ticker: st.ticker, order: "buyBelow", trigger, shares: n })}>
          Buy below
        </button>
      </div>
      {orders.map((o) => (
        <div key={o.id} className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
          {o.kind === "stopLoss" ? "Stop-loss" : o.kind === "takeProfit" ? "Take profit" : "Buy below"}: {o.shares.toLocaleString("en-MY")} at {rm2(o.trigger)}
          <button className="underline" onClick={() => money({ kind: "cancel", id: o.id })}>
            cancel
          </button>
        </div>
      ))}
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${18 - ((v - lo) / span) * 14}`).join(" ");
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-16 h-4" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--ink-2)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// --- Property ------------------------------------------------------------------------------------

function Property() {
  const game = useGame((s) => s.game)!;
  const money = useGame((s) => s.money);
  const [state, setState] = useState(STATES[0].id);
  const [owner, setOwner] = useState<Owner>("personal");
  const [ltv, setLtv] = useState(0);
  const listings = PROPERTIES.filter((p) => p.state === state);
  return (
    <div className="flex flex-col gap-4">
      <Cash />
      {game.personal.properties.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">Owned</h3>
          <ul className="flex flex-col gap-1">
            {game.personal.properties.map((h, i) => {
              const def = PROPERTY_BY_ID[h.id];
              const value = unitPrice(game, def) * h.units;
              return (
                <li key={i} className="inset px-2.5 py-2 text-xs flex flex-col gap-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold truncate">
                      {def.name} <span className="font-normal" style={{ color: "var(--muted)" }}>× {h.units} · {h.owner === "party" ? "party land bank" : "yours"}</span>
                    </span>
                    <span className="tabular-nums">{fmtRM(value)}</span>
                  </div>
                  <div style={{ color: "var(--ink-2)" }}>
                    Rent ≈ {fmtRM((value * def.yield * WEALTH.occupancy) / 52)}/wk{h.loan ? ` · mortgage ${fmtRM(h.loan.principal)} (${Math.ceil(h.loan.weeksLeft / 52)} yrs left)` : ""} · {value >= h.cost ? "▲" : "▼"} {pct(Math.abs(value / h.cost - 1), 1)} since bought
                  </div>
                  <div className="flex gap-1.5">
                    <button className="chip !py-1 text-xs" onClick={() => money({ kind: "sellProp", index: i })}>
                      Sell ({fmtRM(value * (1 - WEALTH.saleFee) - (h.loan?.principal ?? 0))} after fees)
                    </button>
                    {h.loan && (
                      <button className="chip !py-1 text-xs" onClick={() => money({ kind: "payoff", index: i })}>
                        Pay off mortgage
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h3 className="eyebrow mb-1.5">On the market</h3>
        <div className="flex flex-wrap gap-2 items-center text-xs mb-2">
          <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-md px-2 py-1" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}>
            {STATES.filter((s) => PROPERTIES.some((p) => p.state === s.id)).map((s) => (
              <option key={s.id} value={s.id} style={{ background: "var(--raised)" }}>
                {s.name} ({pct((game.personal.index[s.id] ?? 1) - 1, 1)})
              </option>
            ))}
          </select>
          <button className="chip !py-1 text-xs" aria-pressed={owner === "personal"} onClick={() => setOwner("personal")}>
            For you
          </button>
          <button className="chip !py-1 text-xs" aria-pressed={owner === "party"} onClick={() => setOwner("party")}>
            For the party
          </button>
          <button className="chip !py-1 text-xs" aria-pressed={ltv > 0} onClick={() => setLtv(ltv > 0 ? 0 : WEALTH.maxLtv)}>
            {ltv > 0 ? "70% mortgage" : "Cash"}
          </button>
        </div>
        <ul className="flex flex-col gap-1">
          {listings.map((def) => {
            const price = unitPrice(game, def);
            const left = def.units - game.personal.properties.filter((h) => h.id === def.id).reduce((n, h) => n + h.units, 0);
            return (
              <li key={def.id} className="inset px-2.5 py-2 text-xs flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{def.name}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {fmtRM(price)} a unit · yield {pct(def.yield, 1)} · {left} left
                  </span>
                </span>
                <button className="chip !py-1 text-xs" disabled={left <= 0 || price * (1 - ltv) > (owner === "party" ? game.me.funds : game.personal.cash)} onClick={() => money({ kind: "buyProp", id: def.id, units: 1, owner, ltv })}>
                  Buy 1 · {fmtRM(price * (1 - ltv))} down
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          Prices in {STATE_BY_ID[state].name} move with the economy and rise while your government builds projects there (and jump when they open). Mortgages cost the OPR + 2%; paying off in the first 3 years costs 2%.
        </p>
      </section>
    </div>
  );
}

// --- Your wealth ---------------------------------------------------------------------------------

function Wealth() {
  const game = useGame((s) => s.game)!;
  const money = useGame((s) => s.money);
  const [amount, setAmount] = useState(500_000);
  const p = game.personal;
  const worth = netWorth(game);
  const shares = Object.entries(p.portfolio).reduce((sum, [t, h]) => sum + (game.bursa.find((x) => x.ticker === t)?.price ?? 0) * h.shares, 0);
  const property = p.properties.filter((h) => h.owner === "personal").reduce((sum, h) => sum + unitPrice(game, PROPERTY_BY_ID[h.id]) * h.units, 0);
  const debt = p.properties.filter((h) => h.owner === "personal").reduce((sum, h) => sum + (h.loan?.principal ?? 0), 0);
  const gained = worth - p.startWorth;
  const declaredRecently = p.declaredWeek !== null && game.week - p.declaredWeek < WEALTH.declareEvery;
  return (
    <div className="flex flex-col gap-4">
      <section className="inset p-3">
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          Your net worth
        </div>
        <div className="text-2xl font-bold tabular-nums">{fmtRM(worth)}</div>
        <table className="w-full text-xs mt-2">
          <tbody>
            {[
              ["Cash", p.cash],
              ["Shares", shares],
              ["Property", property],
              ["Mortgages", -debt],
            ].map(([label, v]) => (
              <tr key={label as string}>
                <td style={{ color: "var(--muted)" }}>{label}</td>
                <td className="text-right tabular-nums">{fmtRM(v as number)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ color: "var(--muted)" }}>Dividends so far</td>
              <td className="text-right tabular-nums">{fmtRM(p.dividends)}</td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Party land bank</td>
              <td className="text-right tabular-nums">{fmtRM(netWorth(game, "party"))}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">Asset declaration</h3>
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          {gained > WEALTH.undeclaredGain && !declaredRecently
            ? `▲ Your fortune has grown ${fmtRM(gained)} since you last declared. The press is asking questions and integrity slips every week.`
            : declaredRecently
              ? "Declared this year. Clean."
              : `Undeclared gains above ${fmtRM(WEALTH.undeclaredGain)} start costing integrity.`}
        </p>
        <button className="chip !py-1 text-xs mt-1.5" disabled={declaredRecently} onClick={() => money({ kind: "declare" })}>
          Publish your assets (+{WEALTH.declareIntegrity} integrity)
        </button>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">Give to the party</h3>
        <div className="flex items-center gap-1.5 text-xs">
          <input type="number" step={100000} min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} className="rounded-md px-2 py-1 w-32 tabular-nums" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }} aria-label="Amount" />
          <button className="chip !py-1 text-xs" disabled={amount <= 0 || amount > p.cash} onClick={() => money({ kind: "donate", amount })}>
            Donate
          </button>
        </div>
        <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Goes into the war chest. Every {fmtRM(WEALTH.donationPerPoint)} earns a career point (up to 3 at a time).
        </p>
      </section>

      {game.team.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">Your team&apos;s salaries</h3>
          <div className="flex gap-1.5">
            <button className="chip !py-1 text-xs" aria-pressed={!p.payTeam} onClick={() => money({ kind: "payTeam", on: false })}>
              Party pays
            </button>
            <button className="chip !py-1 text-xs" aria-pressed={p.payTeam} onClick={() => money({ kind: "payTeam", on: true })}>
              You pay ({fmtRM(teamSalaries(game))}/wk)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
