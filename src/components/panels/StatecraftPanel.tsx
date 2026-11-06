"use client";

import { useMemo, useState } from "react";
import { CRAFT, GROUPS, PARTNERS, PLANS, PROGRAMMES, PROGRAMME_BY_ID, SECTORS, TOP_POSTS, buildNeed, buildShort, craftOf, groupScores, programmeEta, type PlanId, type TopPost } from "@/game/systems/statecraft";
import { wz } from "@/game/systems/wawasan";
import { byId } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { STATES, STATE_BY_ID } from "@/game/world";
import { PORTFOLIOS } from "@/game/data/people";

const BOARDS = ["Plan", "Ministries", "States", "Industry", "Top posts", "World", "Groups"] as const;
type Board = (typeof BOARDS)[number];

function Bar({ value, color = "var(--brass)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full mt-1" style={{ background: "var(--line)" }}>
      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** A Prime Minister's standing boards: set them once and they keep working. */
export function StatecraftPanel() {
  const game = useGame((s) => s.game)!;
  const [board, setBoard] = useState<Board>("Plan");
  const pm = game.parliament.pm === game.player && game.career.rung >= 6;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {BOARDS.map((b) => (
          <button key={b} className="chip !py-1 text-xs" aria-pressed={board === b} onClick={() => setBoard(b)}>
            {b}
          </button>
        ))}
      </div>
      {!pm && (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Only you as Prime Minister set these. Nothing here builds under anyone else&apos;s government.
        </p>
      )}
      {board === "Plan" && <PlanBoard />}
      {board === "Ministries" && <MinistryBoard />}
      {board === "States" && <StateBoard />}
      {board === "Industry" && <IndustryBoard />}
      {board === "Top posts" && <TopBoard />}
      {board === "World" && <WorldBoard />}
      {board === "Groups" && <GroupBoard />}
    </div>
  );
}

function PlanBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const c = craftOf(game);
  const [picks, setPicks] = useState<PlanId[]>([]);
  const live = c.plan && game.week < c.plan.until ? c.plan : null;
  const toggle = (id: PlanId) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < CRAFT.plan.picks ? [...p, id] : p));
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        {live ? `Your plan runs for ${((live.until - game.week) / 52).toFixed(1)} more years.` : `Pick ${CRAFT.plan.picks} national priorities for the next ${CRAFT.plan.years} years.`}
      </p>
      <div className="grid gap-1.5 @md:grid-cols-2">
        {PLANS.map((p) => {
          const on = live ? live.ids.includes(p.id) : picks.includes(p.id);
          return (
            <button key={p.id} className="inset p-2.5 text-left text-xs" disabled={!!live} aria-pressed={on} style={{ outline: on ? "1px solid var(--brass)" : undefined }} onClick={() => toggle(p.id)}>
              <span className="block font-semibold text-[13px]">{p.name}</span>
              <span style={{ color: "var(--ink-2)" }}>{p.text}</span>
            </button>
          );
        })}
      </div>
      {!live && (
        <button className="btn self-start" disabled={picks.length !== CRAFT.plan.picks} onClick={() => deep({ kind: "setPlan", ids: picks })}>
          Table the Malaysia Plan
        </button>
      )}
    </section>
  );
}

function MinistryBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const c = craftOf(game);
  const posts = [...new Set(PROGRAMMES.map((p) => p.post))];
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Each ministry runs one programme at a time. A stronger minister and more fiscal space finish it sooner. Free to start; {c.finished.length} finished so far.
      </p>
      {posts.map((post) => {
        const run = c.programmes[post];
        const minister = byId(game, game.cabinet[post]);
        const options = PROGRAMMES.filter((p) => p.post === post && !c.finished.includes(p.id));
        return (
          <div key={post} className="inset p-2.5 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-[13px]">{PORTFOLIOS.find((p) => p.id === post)?.name}</span>
              <span style={{ color: "var(--muted)" }}>{minister ? `${minister.name} · competence ${Math.round(minister.competence)}` : "No minister"}</span>
            </div>
            {run ? (
              <div className="mt-1">
                <div style={{ color: "var(--ink-2)" }}>
                  {PROGRAMME_BY_ID[run.id].name}: about {programmeEta(game, post)} weeks left
                </div>
                <Bar value={run.progress * 100} />
              </div>
            ) : options.length ? (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {options.map((p) => (
                  <button key={p.id} className="chip !py-0.5 text-xs" title={p.blurb} onClick={() => deep({ kind: "startProgramme", id: p.id })}>
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-1" style={{ color: "var(--good)" }}>
                ✓ Every programme done
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function StateBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const c = craftOf(game);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Share out development money. Above 5, a state develops faster and your service grows in its seats; below 5 it falls behind. See the Development map lens.
      </p>
      <div className="inset p-2.5 text-xs flex flex-wrap items-center gap-2">
        <span className="font-semibold">MA63 share for Sabah and Sarawak</span>
        {CRAFT.ma63.levels.map((v) => (
          <button key={v} className="chip !py-0.5 text-xs" aria-pressed={c.ma63 === v} onClick={() => deep({ kind: "setMa63", share: v })}>
            {v}%
          </button>
        ))}
      </div>
      <div className="grid gap-1 @md:grid-cols-2">
        {STATES.map((st) => (
          <div key={st.id} className="inset px-2.5 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-semibold truncate">{st.name}</span>
              <span className="tabular-nums" style={{ color: "var(--muted)" }}>
                dev {Math.round(c.dev[st.id] ?? 0)}
              </span>
              <button className="chip !py-0 !px-2" aria-label={`Less for ${st.name}`} onClick={() => deep({ kind: "setStateWeight", state: st.id, weight: (c.weights[st.id] ?? 5) - 1 })}>
                −
              </button>
              <span className="w-5 text-center tabular-nums font-semibold">{c.weights[st.id] ?? 5}</span>
              <button className="chip !py-0 !px-2" aria-label={`More for ${st.name}`} onClick={() => deep({ kind: "setStateWeight", state: st.id, weight: (c.weights[st.id] ?? 5) + 1 })}>
                +
              </button>
            </div>
            <Bar value={c.dev[st.id] ?? 0} />
          </div>
        ))}
      </div>
    </section>
  );
}

function IndustryBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const c = craftOf(game);
  const w = wz(game);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Up to {CRAFT.build.slots} builds at once, {CRAFT.build.fiscal} fiscal space each, about a year. Each adds jobs, income and service in its state. Without the pillar behind it, a build runs at half speed.
      </p>
      {c.queue.length > 0 && (
        <div className="grid gap-1">
          {c.queue.map((b, i) => (
            <div key={i} className="inset px-2.5 py-1.5 text-xs">
              {SECTORS.find((x) => x.id === b.sector)!.name} in {STATE_BY_ID[b.state].name}
              {buildShort(game, b.sector) ? <span style={{ color: "var(--bad)" }}> · short of skills or support, half speed</span> : ""}
              <Bar value={b.progress * 100} />
            </div>
          ))}
        </div>
      )}
      {SECTORS.map((sec) => (
        <div key={sec.id} className="inset p-2.5 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-[13px]">{sec.name}</span>
            <span style={{ color: "var(--muted)" }}>
              Level {c.levels[sec.id] ?? 0} · needs {sec.pillar} {buildNeed(c, sec.id)} (now {Math.round(w[sec.pillar])})
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {sec.states.map((st) => (
              <button key={st} className="chip !py-0.5 text-xs" disabled={c.queue.length >= CRAFT.build.slots} onClick={() => deep({ kind: "queueBuild", sector: sec.id, state: st })}>
                Build in {STATE_BY_ID[st].name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function TopBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const c = craftOf(game);
  const pool = useMemo(() => {
    const mine = game.coalitions[game.player].members;
    const inCabinet = new Set(Object.values(game.cabinet));
    return game.people.filter((p) => mine.includes(p.party) && !p.retired && p.id !== game.youId && !inCabinet.has(p.id)).sort((a, b) => b.competence - a.competence).slice(0, 30);
  }, [game]);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Appointing is free and wins the appointee&apos;s loyalty. A capable hand keeps paying for as long as they stay.
      </p>
      {TOP_POSTS.map((t) => {
        const cur = byId(game, c.top[t.id]);
        return (
          <div key={t.id} className="inset p-2.5 text-xs flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-[180px]">
              <span className="block font-semibold text-[13px]">{t.name}</span>
              <span style={{ color: "var(--ink-2)" }}>{t.text}</span>
            </span>
            <select className="chip !py-0.5 text-xs max-w-[220px]" value={cur?.id ?? ""} aria-label={t.name} onChange={(e) => deep({ kind: "appointTop", post: t.id as TopPost, id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Vacant</option>
              {cur && !pool.includes(cur) && <option value={cur.id}>{cur.name}</option>}
              {pool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {Math.round(p.competence)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </section>
  );
}

function WorldBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const c = craftOf(game);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Warm relations bring investment. A trip costs {CRAFT.relation.visitAp} AP. Closer to Washington cools Beijing a little, and the other way round. At {CRAFT.relation.deal} you can sign a trade deal, which lifts growth and Global Power for good.
      </p>
      {PARTNERS.map((p) => {
        const r = c.relations[p.id];
        const done = c.deals.includes(p.id);
        return (
          <div key={p.id} className="inset p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 font-semibold text-[13px]">{p.name}</span>
              <span className="tabular-nums">{Math.round(r)}</span>
              <button className="chip !py-0.5 text-xs" onClick={() => deep({ kind: "visitPartner", id: p.id })}>
                Visit
              </button>
              <button className="chip !py-0.5 text-xs" disabled={done || r < CRAFT.relation.deal} onClick={() => deep({ kind: "signDeal", id: p.id })}>
                {done ? "✓ Deal signed" : "Sign a deal"}
              </button>
            </div>
            <Bar value={r} />
          </div>
        );
      })}
    </section>
  );
}

function GroupBoard() {
  const game = useGame((s) => s.game)!;
  const scores = groupScores(game);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        These follow what you actually do. At {CRAFT.group.line} or above, a group pays a steady bonus.
      </p>
      {GROUPS.map((g) => {
        const v = scores[g.id];
        const ok = v >= CRAFT.group.line;
        return (
          <div key={g.id} className="inset p-2.5 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-[13px]">{g.name}</span>
              <span className="tabular-nums" style={{ color: ok ? "var(--good)" : "var(--ink-2)" }}>
                {Math.round(v)} · {g.bonus}
              </span>
            </div>
            <Bar value={v} color={ok ? "var(--good)" : "var(--brass)"} />
            <div className="mt-1" style={{ color: "var(--muted)" }}>
              Likes: {g.likes}
            </div>
          </div>
        );
      })}
    </section>
  );
}
