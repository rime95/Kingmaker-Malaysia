"use client";

import { useEffect } from "react";
import { useGame } from "@/store/gameStore";

/** Action result pop-up. Errors stay a little longer. */
export function Toast() {
  const toast = useGame((s) => s.toast);
  const clear = useGame((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, toast.error ? 4000 : 2600);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg border max-w-[90vw]"
      style={{ background: "var(--raised)", borderColor: toast.error ? "var(--bad)" : "var(--line)", color: "var(--ink)" }}
    >
      <span aria-hidden style={{ color: toast.error ? "var(--bad)" : "var(--good)" }}>
        {toast.error ? "✕ " : "✓ "}
      </span>
      {toast.text}
    </div>
  );
}
