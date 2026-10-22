"use client";

import { isGovernment, seatBreakdown } from "@/game/state";
import { ISSUE, seatIssues } from "@/game/systems/issues";
import { useGame } from "@/store/gameStore";

/** The seat's local issues, and which you have taken up. */
export function SeatIssues({ seat, compact }: { seat: number; compact?: boolean }) {
  const game = useGame((s) => s.game)!;
  const issues = seatIssues(game, seat);
  const taken = game.issuesTaken[seat] ?? [];
  if (compact)
    return (
      <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>
        Local issues: {issues.map((d) => (taken.includes(d.id) ? `${d.name} ✓` : d.name)).join(" · ")}
      </div>
    );
  return (
    <section>
      <h3 className="eyebrow mb-1">Local issues</h3>
      <div className="flex flex-wrap gap-1.5">
        {issues.map((d) => (
          <span
            key={d.id}
            className="chip !py-0.5 !px-2 text-[11px]"
            style={taken.includes(d.id) ? { outline: "1px solid var(--good)", color: "var(--good)" } : undefined}
          >
            {taken.includes(d.id) ? "✓ " : ""}
            {d.name}
          </span>
        ))}
      </div>
      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
        Take one up ({ISSUE.ap} AP): a lasting +{Math.round((isGovernment(game) ? ISSUE.gov : ISSUE.opp) * 100)} to your pull here. New issues surface after
        each general election.
      </p>
    </section>
  );
}

/** Why you stand where you do in a seat: your pull by source. */
export function WhyBreakdown({ seat }: { seat: number }) {
  const game = useGame((s) => s.game)!;
  const rows = seatBreakdown(game, seat).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.05);
  return (
    <details className="mt-2">
      <summary className="text-[11px] font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
        Why? Your pull here by source
      </summary>
      <div className="flex flex-col gap-0.5 mt-1">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_70px_34px] items-center gap-2 text-[11px]">
            <span className="truncate" style={{ color: "var(--ink-2)" }}>
              {r.label}
            </span>
            <span className="relative h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
              <span
                className="absolute top-0 bottom-0 rounded-full"
                style={{
                  left: r.value >= 0 ? "50%" : `${50 - (Math.abs(r.value) / max) * 50}%`,
                  width: `${(Math.abs(r.value) / max) * 50}%`,
                  background: r.value >= 0 ? "var(--good)" : "var(--bad)",
                }}
              />
            </span>
            <span className="tabular-nums text-right" style={{ color: r.value >= 0 ? "var(--good)" : "var(--bad)" }}>
              {r.value >= 0 ? "+" : "−"}
              {Math.abs(r.value * 100).toFixed(0)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10.5px] mt-1" style={{ color: "var(--muted)" }}>
        Points of pull (log-odds × 100). Roughly, +10 moves a close seat about 2.5 points of the vote.
      </p>
    </details>
  );
}
