#!/usr/bin/env node
// Static syntax check for ```mermaid blocks inside markdown files.
//
// Usage:   node lint-mermaid.mjs <file.md> [file2.md ...]
// Exit:    0 = no mermaid errors (incl. "no mermaid blocks at all")
//          1 = at least one block failed mermaid.parse()
//          2 = usage error (no file args)
//
// Validation is grammar-only: we call mermaid.parse(), the same parser the
// renderer runs first. It catches malformed arrows, unclosed nodes,
// unknown diagram types, keyword typos — NOT layout/render-time problems
// that only surface with a real browser. That tradeoff is intentional:
// the goal is a fast "does this even parse" gate, not a full render.
//
// mermaid is a browser library, so we stand up a jsdom DOM and expose the
// globals it touches at import time before importing it. Both the Claude
// PostToolUse hook and .githooks/pre-commit call this one script — single
// source of truth for the parse logic.

import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: lint-mermaid.mjs <file.md> [file2.md ...]");
  process.exit(2);
}

// --- extract ```mermaid blocks with 1-based start line numbers ----------
const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*mermaid\b/i;

function extractBlocks(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (e) {
    return { readError: e.message, blocks: [] };
  }
  const lines = text.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(FENCE);
    if (!m) continue;
    const indent = m[1];
    const fenceChar = m[2][0];
    const fenceLen = m[2].length;
    // Closing fence: same char, length >= opening, only whitespace after.
    const closeRe = new RegExp(`^[ \\t]*\\${fenceChar}{${fenceLen},}[ \\t]*$`);
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (closeRe.test(lines[j])) break;
      // Strip the opening indent so indented blocks (lists/quotes) parse.
      body.push(lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j]);
    }
    blocks.push({ startLine: i + 1, code: body.join("\n") });
    i = j; // resume after the closing fence
  }
  return { readError: null, blocks };
}

const scanned = files.map((f) => ({ file: f, ...extractBlocks(f) }));
const totalBlocks = scanned.reduce((n, s) => n + s.blocks.length, 0);

// Nothing to parse → don't pay the cost of importing mermaid.
if (totalBlocks === 0) {
  const readErrors = scanned.filter((s) => s.readError);
  if (readErrors.length) {
    for (const s of readErrors) console.error(`  ! cannot read ${s.file}: ${s.readError}`);
    process.exit(1);
  }
  process.exit(0);
}

// --- stand up a DOM, then import mermaid -------------------------------
const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// navigator is a read-only getter on modern Node — define, don't assign.
if (!("navigator" in globalThis)) {
  try {
    Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  } catch { /* fail open: mermaid.parse rarely needs navigator */ }
}
for (const key of ["HTMLElement", "SVGElement", "Node", "DOMParser", "getComputedStyle"]) {
  if (globalThis[key] === undefined && dom.window[key] !== undefined) {
    globalThis[key] = dom.window[key];
  }
}

const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });

// --- parse every block --------------------------------------------------
let errorCount = 0;
for (const { file, readError, blocks } of scanned) {
  if (readError) {
    console.error(`  ! cannot read ${file}: ${readError}`);
    errorCount++;
    continue;
  }
  for (const { startLine, code } of blocks) {
    if (!code.trim()) {
      console.error(`  ✗ ${file}:${startLine} — empty mermaid block`);
      errorCount++;
      continue;
    }
    try {
      await mermaid.parse(code);
    } catch (err) {
      const detail = (err && (err.str || err.message) ? (err.str || err.message) : String(err))
        .split("\n")
        .map((l) => "      " + l)
        .join("\n");
      console.error(`  ✗ ${file}:${startLine} — mermaid parse error:\n${detail}`);
      errorCount++;
    }
  }
}

if (errorCount > 0) {
  console.error(`\nmermaid-lint: ${errorCount} block(s) failed across ${files.length} file(s).`);
  process.exit(1);
}
process.exit(0);
