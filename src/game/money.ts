// RM formatting shared by the engine and the UI.

export function fmtRM(n: number): string {
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${sign}RM ${(a / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${sign}RM ${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 10_000) return `${sign}RM ${Math.round(a / 1000)}k`;
  return `${sign}RM ${Math.round(a).toLocaleString("en-MY")}`;
}
