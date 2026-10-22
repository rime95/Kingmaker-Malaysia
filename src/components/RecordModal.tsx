"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/store/gameStore";
import { Career } from "./Career";

/** Your record: who you are, this term's objectives, election results and achievements (⋯ menu → Your record). */
export function RecordModal() {
  const open = useGame((s) => s.recordOpen);
  const setOpen = useGame((s) => s.setRecordOpen);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgb(5 7 14 / 0.6)" }} onClick={() => setOpen(false)}>
      <div className="w-full max-w-4xl mt-10 mb-10 @container" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your record">
        <div className="flex items-center mb-3">
          <h2 className="text-xl font-bold flex-1">Your record</h2>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <Career />
      </div>
    </div>,
    document.body,
  );
}
