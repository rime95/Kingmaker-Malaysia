"use client";

import { useMemo, useState } from "react";
import {
  NATIONAL_POSTS,
  POSTS,
  POST_INFO,
  REGIONS,
  appointPostBlocked,
  chiefKey,
  chiefPull,
  holderOf,
  homeOf,
  missionBlocked,
  missionChance,
  postKeys,
  postOfPerson,
  postEligible,
  postPool,
  postSkill,
  regionName,
  treasurerIncome,
} from "@/game/systems/posts";
import { mbTitle } from "@/game/systems/stategov";
import { ECONOMY } from "@/game/config";
import type { Person } from "@/game/systems/people";
import type { GameState } from "@/game/state";
import { RANKS } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { COALITIONS, PARTIES, STATE_BY_ID } from "@/game/world";
import { fmtRM } from "../common";
import { PartyFlag } from "../flags";
import { Term } from "../Term";
import { CouncilSection } from "./Council";
import { PLOT, breakBlocked, plotOf, plotter } from "@/game/systems/plots";

/** Your lieutenants (national posts) and generals (state chiefs), and any rival party's. */
export function Leadership() {
  const game = useGame((s) => s.game)!;
  const mine = game.coalitions[game.player].members[0];
  const [party, setParty] = useState(mine);
  const yours = party === mine;
  const parties = useMemo(
    () =>
      [mine, ...COALITIONS.flatMap((c) => game.coalitions[c].members)].filter(
        (p, i, a) => p !== "IND" && a.indexOf(p) === i && game.posts[p],
      ),
    [game.coalitions, game.posts, mine],
  );
  const keys = postKeys(game, party);
  const regions = REGIONS.filter((r) => keys.includes(chiefKey(r)));

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="flex flex-wrap gap-1.5">
          {parties.map((p) => (
            <button
              key={p}
              className="chip !py-1 !px-2.5 text-xs"
              aria-pressed={party === p}
              onClick={() => setParty(p)}
            >
              <PartyFlag id={p} size={10} />
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--ink-2)" }}>
          {yours
            ? "The people who run the party with you. Appoint the best (it costs 2 political capital, and the ambitious people you pass over sulk), and send them on missions to build their trust. A lieutenant who loses faith in you only half does the job, and may turn on you."
            : `${PARTIES[party]?.name}'s leadership. Their state chiefs pull votes for them, just as yours do for you.`}
        </p>
      </section>

      {yours && <PlotCard />}
      <CouncilSection party={party} yours={yours} />

      <section>
        <h3 className="eyebrow mb-1.5">Lieutenants · national posts</h3>
        <div className="grid gap-2 @lg:grid-cols-2">
          {NATIONAL_POSTS.map((k) => (
            <PostCard key={k} party={party} postKey={k} yours={yours} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1.5">
          Generals · state chiefs (<Term word="Pengerusi Perhubungan" />)
        </h3>
        <div className="grid gap-2 @lg:grid-cols-2">
          {regions.map((r) => (
            <PostCard
              key={r}
              party={party}
              postKey={chiefKey(r)}
              yours={yours}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function effectText(
  game: GameState,
  key: string,
  p: Person | undefined,
): string {
  if (!p) return "Vacant";
  if (key.startsWith("chief:")) {
    const region = key.slice(6);
    const pull = chiefPull(game, p, region) * 25;
    return `${pull >= 0 ? "+" : "−"}${Math.abs(pull).toFixed(1)} pts in every ${regionName(region)} seat${homeOf(p) === region ? "" : " (parachuted: half strength)"}`;
  }
  const skill = postSkill(game, p);
  switch (key) {
    case "sg":
      return `Unity ${skill >= 0 ? "+" : "−"}${Math.abs(skill * POSTS.sgUnity).toFixed(2)} a week`;
    case "treasurer":
      return `${fmtRM(treasurerIncome(game, Math.round(game.me.members * ECONOMY.duesPerMember)))} a week`;
    case "info":
      return skill > 0
        ? "Your national buzz fades more slowly"
        : "No help with the message";
    case "director":
      return `${skill >= 0 ? "+" : "−"}${Math.abs(skill * POSTS.directorPull * 25).toFixed(1)} pts in every seat while an election is on`;
    default:
      return `Wing resting level ${skill >= 0 ? "+" : "−"}${Math.abs(skill * 0.3 * (key === "puteri" ? 0.5 : 1)).toFixed(0)}`;
  }
}

function PostCard({
  party,
  postKey,
  yours,
}: {
  party: string;
  postKey: string;
  yours: boolean;
}) {
  const game = useGame((s) => s.game)!;
  const { appointPartyPost, sendMission } = useGame();
  const [pick, setPick] = useState("");
  const p = holderOf(game, party, postKey);
  const chief = postKey.startsWith("chief:");
  const region = chief ? postKey.slice(6) : null;
  const info = chief ? null : POST_INFO[postKey as keyof typeof POST_INFO];
  const title = chief ? `${regionName(region!)} chief` : info!.name;
  const gov = region && region !== "WP" ? game.stateGov[region] : undefined;
  const isMb = !!p && gov?.mb === p.id;
  const pool = useMemo(
    () =>
      yours
        ? postPool(game, party)
            .filter((x) => postEligible(x, postKey, game.week))
            .sort(
              (a, b) =>
                b.competence +
                (region && homeOf(b) === region ? 20 : 0) -
                (a.competence + (region && homeOf(a) === region ? 20 : 0)),
            )
            .slice(0, 30)
        : [],
    [game, party, region, yours, postKey],
  );
  const mission = p && yours ? missionBlocked(game, p.id) : "x";
  const blocked = pick
    ? appointPostBlocked(game, postKey, Number(pick))
    : "Pick someone";

  return (
    <div
      className="inset px-3 py-2 flex flex-col gap-1.5"
      style={
        p && yours && p.loyalty < POSTS.sulk
          ? { borderLeft: "3px solid var(--bad)" }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold">
          {title}
          {info && (
            <span style={{ color: "var(--muted)" }}> · {info.malay}</span>
          )}
        </div>
        {isMb && region && (
          <span className="trait-chip">{mbTitle(region)}</span>
        )}
      </div>
      {p ? (
        <div className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold">{p.name}</span>
          <span style={{ color: "var(--muted)" }}>
            {p.chairman ? "Chairman" : RANKS[p.rank]} · comp{" "}
            {Math.round(p.competence)} ·{" "}
            {yours
              ? `trust ${Math.round(p.loyalty)}`
              : `ambition ${Math.round(p.ambition)}`}
            {region && homeOf(p) !== region
              ? ` · from ${regionName(homeOf(p))}`
              : ""}
          </span>
        </div>
      ) : (
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Vacant
        </div>
      )}
      <div className="text-xs" style={{ color: "var(--ink-2)" }}>
        {effectText(game, postKey, p)}
      </div>
      {yours && (
        <div className="flex flex-col gap-1.5">
          {p && (
            <button
              className="btn btn-ghost self-start"
              disabled={!!mission}
              title={
                mission ??
                `${Math.round(missionChance(p) * 100)}% chance of success`
              }
              onClick={() => sendMission(p.id)}
            >
              {chief
                ? game.stateTalks && region === game.stateTalks.state
                  ? "Work the assembly"
                  : "Rally the state"
                : info!.mission}{" "}
              · 1 AP
            </button>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="rounded-md px-1.5 py-1 text-xs min-w-0 flex-1"
              style={{
                background: "var(--surface-2)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
              }}
              aria-label={`Appoint ${title}`}
            >
              <option value="">Appoint…</option>
              {pool
                .filter((x) => x.id !== p?.id)
                .map((x) => {
                  const now = postOfPerson(game, x);
                  return (
                    <option key={x.id} value={x.id}>
                      {x.name} · comp {Math.round(x.competence)} · trust{" "}
                      {Math.round(x.loyalty)}
                      {region && homeOf(x) === region ? " · local" : ""}
                      {now
                        ? ` · now ${now.startsWith("chief:") ? `${regionName(now.slice(6))} chief` : POST_INFO[now as keyof typeof POST_INFO].name}`
                        : ""}
                    </option>
                  );
                })}
            </select>
            <button
              className="btn btn-ghost"
              disabled={!!blocked}
              title={blocked ?? undefined}
              onClick={() => {
                appointPartyPost(postKey, Number(pick));
                setPick("");
              }}
            >
              Appoint
            </button>
          </div>
        </div>
      )}
      {region && gov && !isMb && gov.party === party && gov.mb !== null && (
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {mbTitle(region)} of {STATE_BY_ID[region].name}:{" "}
          {game.people.find((x) => x.id === gov.mb)?.name}
        </div>
      )}
    </div>
  );
}

/** The rival camp's plot against you: how far along it is, and a way to break it. */
function PlotCard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const who = plotter(game);
  const p = plotOf(game);
  if (!who) return null;
  const why = breakBlocked(game);
  return (
    <section className="inset p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="eyebrow">The plot against you</h3>
        <span className="text-xs tabular-nums" style={{ color: p.strength >= PLOT.warn ? "var(--bad)" : "var(--muted)" }}>
          {Math.round(p.strength)} / 100
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--line)" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, p.strength)}%`, background: p.strength >= PLOT.warn ? "var(--bad)" : "var(--brass)" }} />
      </div>
      <p className="text-xs mt-1.5" style={{ color: "var(--ink-2)" }}>
        {who.name} has {Math.round(who.share * 100)}% of the divisions, you {Math.round(who.mine * 100)}%.{" "}
        {who.mine >= who.share ? "With your camp ahead, the plot is fading." : "It grows every month while they lead you. At 100 it pushes one of your appointees off the council, then has to start again."}
      </p>
      <button className="chip !py-1 text-xs mt-1.5" disabled={!!why} title={why ?? undefined} onClick={() => deep({ kind: "breakPlot" })}>
        Break it up · {PLOT.breakAp} AP, {PLOT.breakCapital} capital
      </button>
    </section>
  );
}
