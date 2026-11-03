"use client";

import type { ReactNode } from "react";
import { GLOSSARY } from "./i18n";

// Longest first, so "Dewan Rakyat" wins over shorter terms; whole words only.
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const PATTERN = new RegExp(`\\b(${TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");

/** A Malay term with its meaning on hover. */
export function Term({ word, children }: { word: string; children?: ReactNode }) {
  const key = TERMS.find((t) => t.toLowerCase() === word.toLowerCase());
  return (
    <abbr className="term" title={key ? GLOSSARY[key] : undefined}>
      {children ?? word}
    </abbr>
  );
}

/** Text with every glossary term in it wrapped as a <Term>. */
export function TermText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push(<Term key={m.index} word={m[0]} />);
    last = m.index! + m[0].length;
  }
  if (!parts.length) return <>{text}</>;
  parts.push(text.slice(last));
  return <>{parts}</>;
}
