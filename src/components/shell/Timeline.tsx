"use client";

import { useMemo } from "react";
import { inWeeks, upcoming } from "@/game/calendar";
import { useGame } from "@/store/gameStore";

/** What's coming, soonest first: polls, nomination day, the Budget, Dewan votes, party elections. Click to go there. */
export function Timeline() {
  const game = useGame((s) => s.game)!;
  const { showPanel, focusState } = useGame();
  const items = useMemo(() => upcoming(game), [game]);
  return (
    <div className="timeline flex items-center gap-1.5 overflow-x-auto scroll-thin" role="list" aria-label="Coming up">
      <span className="eyebrow flex-none pr-1">Coming up</span>
      {items.map((x) => (
        <button
          key={x.key}
          role="listitem"
          className={`timeline-chip flex-none ${x.urgent ? "timeline-urgent" : ""}`}
          onClick={() => {
            showPanel(x.panel);
            if (x.state) focusState(x.state);
          }}
          title={`${x.label}: ${inWeeks(x.weeks)}`}
        >
          <span className="timeline-when num">{inWeeks(x.weeks)}</span>
          <span>{x.label}</span>
        </button>
      ))}
    </div>
  );
}
