"use client";

import { useMemo, useState } from "react";
import { appointBlocked } from "@/game/actions";
import { PORTFOLIOS, type PortfolioId } from "@/game/data/people";
import { coalitionOf, partyColor } from "@/game/systems/coalitions";
import { PEOPLE, RANKS, ageOf, byId, favourBlocked, favourOf, meetBlocked, partyPeople, postOf, titleOf, type Person } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { COALITIONS, PARTIES, SEATS, STATE_BY_ID, cshort } from "@/game/world";
import { fmtRM } from "../common";
import { DISCIPLINE } from "@/game/systems/partyorg";
import { PartyFlag } from "../flags";
import { postName, postOfPerson } from "@/game/systems/posts";
import { LAWS, hoppingLaw, poachBlocked, poachChance } from "@/game/systems/laws";
import { mbTitle } from "@/game/systems/stategov";
import { CAMPS, bringBlocked, campName, campsOf, divisionOf, patrons, replaceBlocked } from "@/game/systems/camps";
import { regionName } from "@/game/systems/posts";
import { regionOf } from "@/game/world";
import { UNALIGNED, campColors } from "../campColors";

/** Who's who: the cabinet, then any party's leadership from the President down to the branch chiefs. */
export function PeoplePanel() {
  const game = useGame((s) => s.game)!;
  const mine = game.coalitions[game.player].members;
  const [party, setParty] = useState(mine[0]);
  const personFocus = useGame((s) => s.personFocus);
  const [open, setOpen] = useState<number | null>(null);
  // Opened on someone (from the seat card): show their party with their card open.
  const [focusSeen, setFocusSeen] = useState(0);
  if (personFocus && personFocus.n !== focusSeen) {
    setFocusSeen(personFocus.n);
    const p = game.people.find((x) => x.id === personFocus.id);
    if (p) {
      setParty(p.party);
      setOpen(p.id);
    }
  }
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
  const chair = roster.find((p) => p.chairman);
  const groups = [5, 4, 3, 2].map((rank) => ({ rank, people: roster.filter((p) => p.rank === rank && !p.retired && !p.chairman) }));
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
              <PartyFlag id={p} size={10} />
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

      {chair && party === mine[0] && (
        <section className="inset p-3 flex gap-3 items-center">
          <PartyFlag id={party} size={26} />
          <div className="text-xs min-w-0">
            <div className="font-semibold text-sm">
              {game.career.name} &amp; {chair.name}
            </div>
            <div style={{ color: "var(--ink-2)" }}>
              You lead {party}; {chair.name} stays on as Party Chairman. A loyal chairman keeps the party behind you, campaigns for you once a week (seat card) and offers
              counsel. Leave them out of your cabinet and they drift. Loyalty {Math.round(chair.loyalty)}.
            </div>
          </div>
        </section>
      )}

      {!q && <CampsBar party={party} />}
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
          <p className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>
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
  const party = roster[0]?.party;
  const colors = party ? campColors(game, party) : new Map<number, string>();
  const ring = (p: Person) => (p.camp != null ? (colors.get(p.camp) ?? UNALIGNED) : UNALIGNED);
  const yours = party === game.coalitions[game.player].members[0];
  const tiers = [6, 5, 4, 3, 2]
    .map((rank) => ({ rank, people: rank === 6 ? roster.filter((p) => p.chairman) : roster.filter((p) => p.rank === rank && !p.retired && !p.chairman) }))
    .filter((t) => t.people.length);
  const mps = roster.filter((p) => p.rank <= 1 && p.seat !== null);
  const sel = open !== null ? roster.find((p) => p.id === open) : undefined;
  return (
    <section className="flex flex-col items-center gap-2">
      {tiers.map((t) => (
        <div key={t.rank} className="w-full">
          <div className="text-xs text-center mb-1" style={{ color: "var(--muted)" }}>
            {t.rank === 6 ? "Party Chairman" : t.rank === 3 ? "Vice Presidents" : t.rank === 2 ? "Supreme Council" : RANKS[t.rank]}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {t.people.map((p) => (
              <button
                key={p.id}
                className="card inset px-2 py-1.5 flex items-center gap-1.5 text-left max-w-[170px]"
                style={{ outline: open === p.id ? "1px solid var(--accent)" : undefined }}
                onClick={() => onOpen(open === p.id ? null : p.id)}
              >
                <Initials name={p.name} color={partyColor(game, p.party)} ring={ring(p)} />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold truncate">{p.name}</span>
                  <span className="block text-xs truncate" style={{ color: "var(--muted)" }}>
                    {p.id === game.youId ? "you" : `♥ ${Math.round(p.loyalty)} · ${p.seat !== null ? SEATS[p.seat].name : "no seat"}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="mx-auto w-px h-2" style={{ background: "var(--line)" }} />
        </div>
      ))}
      {yours && Object.keys(game.divisions ?? {}).length > 0 && <Divisions open={open} onOpen={onOpen} ring={ring} />}
      {!yours && mps.length > 0 && (
        <div className="w-full">
          <div className="text-xs text-center mb-1" style={{ color: "var(--muted)" }}>
            MPs ({mps.length})
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
                <Initials name={p.name} color={partyColor(game, p.party)} ring={ring(p)} />
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
          <span className="block text-xs truncate" style={{ color: "var(--muted)" }}>
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

/** A party's camps: who leads each, and how many divisions (delegates) and council seats they hold. */
function CampsBar({ party }: { party: string }) {
  const game = useGame((s) => s.game)!;
  const c = campsOf(game, party);
  if (!c.camps.length) return null;
  const colors = campColors(game, party);
  const mine = party === game.coalitions[game.player].members[0];
  return (
    <section className="inset p-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="eyebrow">Camps</h3>
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {mine ? `${c.total} divisions vote at the AGM` : `${c.total} leaders and MPs`}
        </span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }} role="img" aria-label="Camp strength">
        {c.camps.map((x) => (
          <div key={x.patron} style={{ width: `${x.share * 100}%`, background: colors.get(x.patron) }} title={`${x.name}: ${x.divisions}`} />
        ))}
        <div style={{ width: `${(c.unaligned / c.total) * 100}%`, background: UNALIGNED }} title={`Unaligned: ${c.unaligned}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {c.camps.map((x) => {
          const pt = game.people.find((p) => p.id === x.patron)!;
          return (
            <span key={x.patron} className="inline-flex items-center gap-1.5">
              <span className="swatch" style={{ background: colors.get(x.patron), width: 9, height: 9 }} />
              <b>{x.name}</b>
              <span style={{ color: "var(--muted)" }}>
                {x.yours ? "you" : x.leader ? "the leader" : pt.rank === 4 ? "Deputy" : "VP"} · {x.divisions} {mine ? "div." : "people"} · {x.council} on council
              </span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <span className="swatch" style={{ background: UNALIGNED, width: 9, height: 9 }} />
          Unaligned · {c.unaligned}
        </span>
      </div>
      {mine && (
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Division chiefs vote at the AGM, build or neglect your machinery, and expect the seat. A rival camp with {Math.round(CAMPS.challengeShare * 100)}% of the divisions, and more than you, will challenge you.
        </p>
      )}
    </section>
  );
}

/** Your party's divisions, state by state: each chief ringed in their camp's colour. Click one for their card. */
function Divisions({ open, onOpen, ring }: { open: number | null; onOpen: (id: number | null) => void; ring: (p: Person) => string }) {
  const game = useGame((s) => s.game)!;
  const [only, setOnly] = useState<"all" | "yours" | "rivals" | "unaligned" | "hostile">("all");
  const byState = useMemo(() => {
    const m = new Map<string, { seat: number; p: Person }[]>();
    for (const [k, id] of Object.entries(game.divisions ?? {})) {
      const p = game.people.find((x) => x.id === id);
      if (!p) continue;
      const seat = Number(k);
      const r = regionOf(SEATS[seat].state);
      m.set(r, [...(m.get(r) ?? []), { seat, p }]);
    }
    return [...m].sort((a, b) => b[1].length - a[1].length);
  }, [game.divisions, game.people]);
  const keep = (p: Person) =>
    only === "all" ||
    (only === "yours" && p.camp === game.youId) ||
    (only === "rivals" && p.camp != null && p.camp !== game.youId) ||
    (only === "unaligned" && p.camp == null) ||
    (only === "hostile" && p.loyalty < 35);
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs mr-1" style={{ color: "var(--muted)" }}>
          Divisions ({Object.keys(game.divisions).length})
        </span>
        {(["all", "yours", "rivals", "unaligned", "hostile"] as const).map((k) => (
          <button key={k} className="chip !py-0.5 !px-2 !text-[11px]" aria-pressed={only === k} onClick={() => setOnly(k)}>
            {k === "all" ? "All" : k === "yours" ? "Your camp" : k === "rivals" ? "Rival camps" : k === "unaligned" ? "Unaligned" : "Hostile"}
          </button>
        ))}
      </div>
      {byState.map(([region, list]) => {
        const shown = list.filter((x) => keep(x.p));
        if (!shown.length) return null;
        return (
          <div key={region} className="flex gap-2 items-start">
            <div className="text-[11px] w-24 flex-none pt-2" style={{ color: "var(--ink-2)" }}>
              {regionName(region)} <span style={{ color: "var(--muted)" }}>{list.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shown.map(({ seat, p }) => (
                <button
                  key={seat}
                  title={`Bahagian ${SEATS[seat].name}: ${p.name}${p.seat === seat ? " (MP)" : ""} · loyalty ${Math.round(p.loyalty)}`}
                  onClick={() => onOpen(open === p.id ? null : p.id)}
                  className="rounded-full relative p-0.5"
                  style={{ outline: open === p.id ? "2px solid var(--accent)" : undefined }}
                >
                  <Initials name={p.name} color={partyColor(game, p.party)} ring={ring(p)} hollow={p.seat !== seat} />
                  {p.loyalty < 35 && <span className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: "var(--bad)" }} />}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Solid: the MP leads their own division. Hollow: a local organiser where you have no MP. Ring: their camp. Red dot: hostile.
      </p>
    </div>
  );
}

function Initials({ name, color, ring, hollow }: { name: string; color: string; ring?: string; hollow?: boolean }) {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w) && !["Bin", "Binti", "Anak"].includes(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span
      className="flex-none w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white"
      style={{ background: hollow ? "var(--surface-2)" : color, color: hollow ? color : undefined, boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 4px ${ring}` : undefined, border: hollow ? `1.5px solid ${color}` : undefined }}
    >
      {letters}
    </span>
  );
}

function LoyaltyDot({ v }: { v: number }) {
  const tone = v >= 60 ? "var(--good)" : v >= 30 ? "var(--ink-2)" : "var(--bad)";
  return (
    <span className="text-xs tabular-nums flex-none" style={{ color: tone }} title="Loyalty to you">
      ♥ {Math.round(v)}
    </span>
  );
}

function PersonCard({ p }: { p: Person }) {
  const game = useGame((s) => s.game)!;
  const { meet, favour, deep, poach } = useGame();
  const own = p.party === game.coalitions[game.player].members[0];
  const you = p.id === game.youId;
  const meetWhy = meetBlocked(game, p.id);
  const favWhy = favourBlocked(game, p.id);
  const f = favourOf(game, p);
  const post = postOfPerson(game, p);
  const mbState = Object.keys(game.stateGov).find((id) => game.stateGov[id].mb === p.id);
  return (
    <div className="px-2.5 pb-2.5 flex flex-col gap-2 text-xs">
      <div style={{ color: "var(--ink-2)" }}>
        {titleOf(game, p)}
        {post ? ` · ${postName(post)}` : ""}
        {mbState ? ` · ${mbTitle(mbState)} of ${STATE_BY_ID[mbState].name}` : ""}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Stat label="Standing" v={p.influence} />
        <Stat label="Competence" v={p.competence} />
        <Stat label="Ambition" v={p.ambition} />
        {!you && <Stat label="Loyalty to you" v={p.loyalty} />}
      </div>
      <CampLine p={p} />
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
      {!you && !own && p.seat !== null && hoppingLaw(game) === "none" && (
        <div className="flex flex-wrap gap-1.5">
          <button
            className="chip !py-1 text-xs"
            disabled={!!poachBlocked(game, p.id)}
            title={poachBlocked(game, p.id) ?? `RM ${LAWS.poach.cost / 1e6}M and ${LAWS.poach.capital} capital: ${Math.round(poachChance(p) * 100)}% chance they cross, seat and all`}
            onClick={() => poach(p.id)}
          >
            Woo them across the floor
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
                confirm(`Sack ${p.name} from the party? ${p.seat !== null ? (hoppingLaw(game) === "strict" ? "Under the tightened anti-hopping law their seat falls vacant: a by-election follows." : "Their seat goes with them as an independent.") : ""}`) &&
                deep({ kind: "sack", id: p.id })
              }
            >
              Sack from the party
            </button>
          )}
        </div>
      )}
      {!you && (
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Favour: {f.text}. {favWhy ?? `Costs ${PEOPLE.favourLoyalty} loyalty.`}
        </div>
      )}
    </div>
  );
}

/** Which camp someone follows and which division they run, with your moves on both. */
function CampLine({ p }: { p: Person }) {
  const game = useGame((s) => s.game)!;
  const { deep } = useGame();
  const own = p.party === game.coalitions[game.player].members[0];
  const patron = p.camp != null ? game.people.find((x) => x.id === p.camp) : undefined;
  const division = own ? divisionOf(game, p.id) : undefined;
  const leads = patrons(game, p.party).some((x) => x.id === p.id);
  const bring = own ? bringBlocked(game, p.id) : "x";
  const replace = division !== undefined ? replaceBlocked(game, division) : "x";
  const you = p.id === game.youId;
  return (
    <div className="flex flex-col gap-1.5">
      <div style={{ color: "var(--ink-2)" }}>
        {leads ? `Leads ${campName(p)}` : patron ? `In ${campName(patron)}${patron.id === game.youId ? " (your camp)" : ""}` : "Unaligned: in no camp"}
        {division !== undefined ? ` · ${p.seat === division ? "leads their own division" : "division chief"} in ${SEATS[division].name}` : ""}
      </div>
      {own && !you && !leads && (
        <div className="flex flex-wrap gap-1.5">
          {p.camp !== game.youId && (
            <button className="chip !py-1 text-xs" disabled={!!bring} title={bring ?? `${CAMPS.bring.ap} AP, ${CAMPS.bring.capital} capital: they bring their delegates to you`} onClick={() => deep({ kind: "bringCamp", id: p.id })}>
              Bring into your camp
            </button>
          )}
          {division !== undefined && (
            <button
              className="chip !py-1 text-xs"
              disabled={!!replace}
              title={replace ?? `${CAMPS.replace.capital} capital: someone from your camp takes over; ${p.name} goes to a rival camp`}
              onClick={() => confirm(`Replace ${p.name} as division chief in ${SEATS[division].name}? They will go over to a rival camp.`) && deep({ kind: "replaceChief", seat: division })}
            >
              Replace as division chief
            </button>
          )}
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
        <span className="text-xs" style={{ color: "var(--muted)" }}>
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
