"use client";

import { useMemo, useState } from "react";
import { appointBlocked } from "@/game/actions";
import { PORTFOLIOS, type PortfolioId } from "@/game/data/people";
import { coalitionOf, partyColor } from "@/game/systems/coalitions";
import { PEOPLE, RANKS, ageOf, byId, favourBlocked, favourOf, meetBlocked, partyPeople, postOf, titleOf, type Person } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { COALITIONS, PARTIES, SEATS, cshort } from "@/game/world";
import { fmtRM } from "../common";
import { DISCIPLINE } from "@/game/systems/partyorg";

/** Who's who: the cabinet, then any party's leadership from the President down to the branch chiefs. */
export function PeoplePanel() {
  const game = useGame((s) => s.game)!;
  const mine = game.coalitions[game.player].members;
  const [party, setParty] = useState(mine[0]);
  const [open, setOpen] = useState<number | null>(null);
  const [view, setView] = useState<"chart" | "list">("chart");
  const [q, setQ] = useState("");
  const parties = useMemo(
    () => [...mine, ...COALITIONS.filter((c) => c !== game.player).flatMap((c) => game.coalitions[c].members)].filter((p) => p !== "IND"),
    [game.coalitions, game.player, mine],
  );
  const all = partyPeople(game, party);
  const roster = q
    ? all.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.seat !== null && SEATS[p.seat].name.toLowerCase().includes(q.toLowerCase())))
    : all;
  const groups = [5, 4, 3, 2].map((rank) => ({ rank, people: roster.filter((p) => p.rank === rank && !p.retired) }));
  const mps = roster.filter((p) => p.rank <= 1 && p.seat !== null);
  const others = roster.filter((p) => (p.rank === 1 && p.seat === null) || p.retired);
  const branch = roster.filter((p) => p.rank === 0);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="eyebrow mb-2">Parties</h3>
        <div className="flex flex-wrap gap-1.5">
          {parties.map((p) => (
            <button key={p} className="chip !py-1 !px-2.5 text-xs" aria-pressed={party === p} onClick={() => setParty(p)}>
              <span className="swatch" style={{ background: partyColor(game, p), width: 8, height: 8 }} />
              {p}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--ink-2)" }}>
          {PARTIES[party]?.name} · {cshort(coalitionOf(game, party))} · {game.holderParties.filter((x) => x === party).length} MPs
        </p>
        <div className="flex gap-1.5 mt-2 items-center">
          <button className="chip !py-1 text-xs" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
            Org chart
          </button>
          <button className="chip !py-1 text-xs" aria-pressed={view === "list"} onClick={() => setView("list")}>
            List
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a name or seat"
            className="ml-auto rounded-md px-2 py-1 text-xs w-40"
            style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
          />
        </div>
      </section>

      {view === "chart" && <OrgChart roster={roster} open={open} onOpen={setOpen} />}

      {view === "list" &&
        groups.map(({ rank, people }) =>
          people.length ? (
            <section key={rank}>
              <h3 className="eyebrow mb-1.5">{rank === 3 ? "Vice Presidents" : rank === 2 ? "Supreme Council" : RANKS[rank]}</h3>
              <PeopleList people={people} open={open} onOpen={setOpen} />
            </section>
          ) : null,
        )}
      {view === "list" && mps.length > 0 && (
        <details className="inset px-3 py-2" open={mps.length <= 8}>
          <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
            MPs and division chiefs ({mps.length})
          </summary>
          <div className="mt-2">
            <PeopleList people={mps} open={open} onOpen={setOpen} />
          </div>
        </details>
      )}
      {view === "list" && others.length > 0 && (
        <details className="inset px-3 py-2">
          <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
            Without a seat ({others.length})
          </summary>
          <div className="mt-2">
            <PeopleList people={others} open={open} onOpen={setOpen} />
          </div>
        </details>
      )}
      {view === "list" && branch.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">Rising branch chiefs</h3>
          <p className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
            Tomorrow&apos;s leaders. When anyone above leaves, everyone moves up one rank and a new branch chief joins here.
          </p>
          <PeopleList people={branch} open={open} onOpen={setOpen} />
        </section>
      )}
    </div>
  );
}

/** The party as a pyramid: the President at the top, then each rank below; click anyone for their card. */
function OrgChart({ roster, open, onOpen }: { roster: Person[]; open: number | null; onOpen: (id: number | null) => void }) {
  const game = useGame((s) => s.game)!;
  const tiers = [5, 4, 3, 2].map((rank) => ({ rank, people: roster.filter((p) => p.rank === rank && !p.retired) })).filter((t) => t.people.length);
  const mps = roster.filter((p) => p.rank <= 1 && p.seat !== null);
  const sel = open !== null ? roster.find((p) => p.id === open) : undefined;
  return (
    <section className="flex flex-col items-center gap-2">
      {tiers.map((t) => (
        <div key={t.rank} className="w-full">
          <div className="text-[10px] text-center mb-1" style={{ color: "var(--muted)" }}>
            {t.rank === 3 ? "Vice Presidents" : t.rank === 2 ? "Supreme Council" : RANKS[t.rank]}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {t.people.map((p) => (
              <button
                key={p.id}
                className="card inset px-2 py-1.5 flex items-center gap-1.5 text-left max-w-[170px]"
                style={{ outline: open === p.id ? "1px solid var(--accent)" : undefined }}
                onClick={() => onOpen(open === p.id ? null : p.id)}
              >
                <Initials name={p.name} color={partyColor(game, p.party)} />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold truncate">{p.name}</span>
                  <span className="block text-[10px] truncate" style={{ color: "var(--muted)" }}>
                    {p.id === game.youId ? "you" : `♥ ${Math.round(p.loyalty)} · ${p.seat !== null ? SEATS[p.seat].name : "no seat"}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="mx-auto w-px h-2" style={{ background: "var(--line)" }} />
        </div>
      ))}
      {mps.length > 0 && (
        <div className="w-full">
          <div className="text-[10px] text-center mb-1" style={{ color: "var(--muted)" }}>
            MPs and division chiefs ({mps.length})
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {mps.map((p) => (
              <button
                key={p.id}
                title={`${p.name} · ${SEATS[p.seat!].name} · loyalty ${Math.round(p.loyalty)}`}
                onClick={() => onOpen(open === p.id ? null : p.id)}
                className="rounded-full"
                style={{ outline: open === p.id ? "2px solid var(--accent)" : undefined }}
              >
                <Initials name={p.name} color={partyColor(game, p.party)} />
              </button>
            ))}
          </div>
        </div>
      )}
      {sel && (
        <div className="inset w-full">
          <div className="px-2.5 pt-2 font-semibold text-sm">{sel.name}</div>
          <PersonCard p={sel} />
        </div>
      )}
    </section>
  );
}

function PeopleList({ people, open, onOpen }: { people: Person[]; open: number | null; onOpen: (id: number | null) => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {people.map((p) => (
        <li key={p.id}>
          <PersonRow p={p} open={open === p.id} onToggle={() => onOpen(open === p.id ? null : p.id)} />
        </li>
      ))}
    </ul>
  );
}

function PersonRow({ p, open, onToggle }: { p: Person; open: boolean; onToggle: () => void }) {
  const game = useGame((s) => s.game)!;
  const you = p.id === game.youId;
  const posts = postOf(game, p.id);
  return (
    <div className="inset">
      <button className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left" onClick={onToggle} aria-expanded={open}>
        <Initials name={p.name} color={partyColor(game, p.party)} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">
            {p.name}
            {you && <span style={{ color: "var(--accent)" }}> · you</span>}
          </span>
          <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>
            {posts.length ? PORTFOLIOS.find((x) => x.id === posts[0])!.name + " · " : ""}
            {p.seat !== null ? SEATS[p.seat].name : "No seat"} · {ageOf(p, game.week)}
          </span>
        </span>
        {!you && <LoyaltyDot v={p.loyalty} />}
      </button>
      {open && <PersonCard p={p} />}
    </div>
  );
}

function Initials({ name, color }: { name: string; color: string }) {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w) && !["Bin", "Binti", "Anak"].includes(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className="flex-none w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold text-white" style={{ background: color }}>
      {letters}
    </span>
  );
}

function LoyaltyDot({ v }: { v: number }) {
  const tone = v >= 60 ? "var(--good)" : v >= 30 ? "var(--ink-2)" : "var(--bad)";
  return (
    <span className="text-[11px] tabular-nums flex-none" style={{ color: tone }} title="Loyalty to you">
      ♥ {Math.round(v)}
    </span>
  );
}

function PersonCard({ p }: { p: Person }) {
  const game = useGame((s) => s.game)!;
  const { meet, favour, deep } = useGame();
  const own = p.party === game.coalitions[game.player].members[0];
  const you = p.id === game.youId;
  const meetWhy = meetBlocked(game, p.id);
  const favWhy = favourBlocked(game, p.id);
  const f = favourOf(game, p);
  return (
    <div className="px-2.5 pb-2.5 flex flex-col gap-2 text-xs">
      <div style={{ color: "var(--ink-2)" }}>{titleOf(game, p)}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Stat label="Standing" v={p.influence} />
        <Stat label="Competence" v={p.competence} />
        <Stat label="Ambition" v={p.ambition} />
        {!you && <Stat label="Loyalty to you" v={p.loyalty} />}
      </div>
      <div style={{ color: "var(--muted)" }}>
        {RANKS[p.rank]} since {p.since === 0 ? "before the game" : `week ${p.since + 1}`} · age {ageOf(p, game.week)}
        {p.retired ? " · retiring at the election" : ""}
      </div>
      {!you && (
        <div className="flex flex-wrap gap-1.5">
          <button className="chip !py-1 text-xs" disabled={!!meetWhy} title={meetWhy ?? undefined} onClick={() => meet(p.id)}>
            Meet · 1 AP · {fmtRM(PEOPLE.meetCost)}
          </button>
          <button className="chip !py-1 text-xs" disabled={!!favWhy} title={favWhy ?? f.text} onClick={() => favour(p.id)}>
            Ask a favour
          </button>
        </div>
      )}
      {!you && own && (
        <div className="flex flex-wrap gap-1.5">
          <button
            className="chip !py-1 text-xs"
            onClick={() => deep({ kind: "showCause", id: p.id })}
            title={`${DISCIPLINE.showCause.capital} capital: loyalty +${DISCIPLINE.showCause.loyalty}, unity −1`}
          >
            Show-cause letter
          </button>
          {p.rank < 4 && (
            <button
              className="chip !py-1 text-xs"
              style={{ color: "var(--bad)" }}
              onClick={() =>
                confirm(`Sack ${p.name} from the party? ${p.seat !== null ? "Their seat goes with them as an independent." : ""}`) &&
                deep({ kind: "sack", id: p.id })
              }
            >
              Sack from the party
            </button>
          )}
        </div>
      )}
      {!you && (
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          Favour: {f.text}. {favWhy ?? `Costs ${PEOPLE.favourLoyalty} loyalty.`}
        </div>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span className="tabular-nums">{Math.round(v)}</span>
      </div>
      <div className="h-1 rounded-full mt-0.5" style={{ background: "var(--surface-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: "var(--ink-2)" }} />
      </div>
    </div>
  );
}

/** The cabinet. As Prime Minister you can reshuffle it. */
export function Cabinet({ open, onOpen }: { open: number | null; onOpen: (id: number | null) => void }) {
  const game = useGame((s) => s.game)!;
  const appoint = useGame((s) => s.appoint);
  const canAppoint = appointBlocked(game, "finance", null) === null;
  const pool = useMemo(
    () =>
      game.people
        .filter((p) => !p.retired && p.rank >= 1 && game.government.some((c) => game.coalitions[c].members.includes(p.party)))
        .sort((a, b) => a.party.localeCompare(b.party) || b.rank - a.rank || b.influence - a.influence),
    [game.people, game.government, game.coalitions],
  );
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="eyebrow">Cabinet</h3>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {canAppoint ? "Yours to reshuffle" : `${cshort(game.parliament.pm)} government`}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {PORTFOLIOS.map((port) => {
          const p = byId(game, game.cabinet[port.id]);
          return (
            <li key={port.id} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-center gap-2 text-xs">
              <span style={{ color: "var(--muted)" }} className="truncate" title={port.name}>
                {port.name}
              </span>
              {canAppoint && port.id !== "pm" ? (
                <select
                  value={p?.id ?? ""}
                  onChange={(e) => appoint(port.id as PortfolioId, e.target.value ? Number(e.target.value) : null)}
                  className="rounded-md px-1.5 py-1 text-xs min-w-0"
                  style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
                >
                  <option value="">— Vacant —</option>
                  {pool.map((x) => (
                    <option key={x.id} value={x.id} style={{ background: "var(--raised)" }}>
                      {x.party} · {x.name}
                      {x.seat === null ? " (not an MP)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <button className="text-left truncate hover:underline" onClick={() => p && onOpen(open === p.id ? null : p.id)}>
                  {p ? (
                    <>
                      {p.name} <span style={{ color: "var(--muted)" }}>{p.party}</span>
                    </>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Vacant</span>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {open !== null &&
        postOf(game, open).length > 0 &&
        (() => {
          const p = byId(game, open);
          return p ? (
            <div className="inset mt-2">
              <PersonCard p={p} />
            </div>
          ) : null;
        })()}
    </section>
  );
}
