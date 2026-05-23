// Shared helpers for impl-anchor-existence / integrations-coverage /
// triggers-coverage tests. SoT: spec/conventions/user-guide-evidence.md

import fs from "node:fs";
import path from "node:path";

export type ImplAnchorKind =
  | "ui-entry"
  | "component"
  | "api-endpoint"
  | "e2e-scenario";

export interface ImplAnchorMatch {
  kind: ImplAnchorKind;
  file: string;
  symbol: string;
  describes: string;
  raw: string;
}

const ANCHOR_RE = /<ImplAnchor\b([\s\S]*?)\/>/g;
const ATTR_RE = /(\w+)\s*=\s*"([^"]*)"/g;

const VALID_KINDS: ImplAnchorKind[] = [
  "ui-entry",
  "component",
  "api-endpoint",
  "e2e-scenario",
];

export function parseImplAnchors(mdx: string): ImplAnchorMatch[] {
  const out: ImplAnchorMatch[] = [];
  let m: RegExpExecArray | null;
  ANCHOR_RE.lastIndex = 0;
  while ((m = ANCHOR_RE.exec(mdx)) !== null) {
    const body = m[1] ?? "";
    const attrs: Record<string, string> = {};
    let a: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((a = ATTR_RE.exec(body)) !== null) {
      attrs[a[1]] = a[2];
    }
    const kind = (attrs["kind"] ?? "") as ImplAnchorKind;
    const file = attrs["file"] ?? "";
    const symbol = attrs["symbol"] ?? "";
    const describes = attrs["describes"] ?? "";
    out.push({ kind, file, symbol, describes, raw: m[0] });
  }
  return out;
}

export function isValidKind(kind: string): kind is ImplAnchorKind {
  return (VALID_KINDS as string[]).includes(kind);
}

export interface GuiFlowSection {
  heading: string;
  body: string;
}

// Identify h2/h3 sections that promise a GUI flow. Detection signals
// (either suffices):
//   (1) heading text itself contains the bareword "GUI"
//   (2) section body (after heading, until next h2/h3 or EOF) contains a
//       bold strong tag whose text includes "GUI" — matches our convention
//       guide pattern: `**GUI 등록 흐름 (권장)**` / `**GUI flow (recommended)**`.
//
// Sections inside fenced code blocks are not considered (curl examples
// often use `## ` inside backticks unintentionally).
export function findGuiFlowSections(mdx: string): GuiFlowSection[] {
  const lines = mdx.split("\n");
  const rawSections: { heading: string; bodyLines: string[] }[] = [];
  let current: { heading: string; bodyLines: string[] } | null = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      if (current) current.bodyLines.push(line);
      continue;
    }
    if (inFence) {
      if (current) current.bodyLines.push(line);
      continue;
    }
    const h = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (h) {
      if (current) rawSections.push(current);
      current = { heading: h[2], bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    }
  }
  if (current) rawSections.push(current);

  return rawSections
    .filter((sec) => {
      if (/\bGUI\b/.test(sec.heading)) return true;
      const body = sec.bodyLines.join("\n");
      // bold strong containing "GUI" — accept either `**...GUI...**` or
      // `__...GUI...__` markdown forms.
      return /(\*\*[^*]*\bGUI\b[^*]*\*\*|__[^_]*\bGUI\b[^_]*__)/.test(body);
    })
    .map((sec) => ({ heading: sec.heading, body: sec.bodyLines.join("\n") }));
}

export function collectMdxFiles(rootDir: string, subPath: string): string[] {
  const dir = path.join(rootDir, subPath);
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_")) continue;
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".mdx")) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

// repo root = 3 levels up from codebase/frontend/src/lib/docs/__tests__
export function repoRoot(): string {
  return path.resolve(__dirname, "../../../../../..");
}
