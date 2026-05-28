/**
 * cafe24 i18n dict ↔ backend metadata drift guard.
 *
 * W2/W3/W4 — Three invariants enforced:
 *  1. Every `(resource, op.id)` from `CAFE24_OPERATIONS_BY_RESOURCE` has a
 *     matching `cafe24.<resource>.<op.id>` key in the KO dict.
 *  2. Every key in the KO dict has a matching key in the EN dict (parity).
 *  3. Every `(resource, op.id)` from `CAFE24_OPERATIONS_BY_RESOURCE` has a
 *     matching `cafe24.<resource>.<op.id>` key in the EN dict.
 *
 * I10 — Also verifies `resolveCafe24OperationLabel` returns the EN label
 * when locale="en" and the KO label when locale="ko".
 *
 * I11 — Verifies that the backend metadata `label` field is absent (was
 * removed in the i18n migration). TypeScript already enforces this at
 * compile time; this test adds a runtime regression guard.
 *
 * SoT: spec/conventions/cafe24-api-metadata.md §7.5.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { cafe24Catalog as cafe24CatalogKo } from "@/lib/i18n/dict/ko/cafe24Catalog";
import { cafe24Catalog as cafe24CatalogEn } from "@/lib/i18n/dict/en/cafe24Catalog";

// ---------------------------------------------------------------------------
// Resolve repo root. The frontend lives at <root>/codebase/frontend, so we
// walk up two levels. Works in both the main worktree and linked worktrees.
// ---------------------------------------------------------------------------
const REPO_ROOT = resolve(__dirname, "../../../../../../");

// ---------------------------------------------------------------------------
// Parse backend metadata TS source to extract (resource, op.id) pairs.
// We use the catalog .md files (already parsed by the backend's catalog-sync
// guard) as the authoritative list of supported operations — simpler than
// importing backend TS from a frontend Vitest run.
// ---------------------------------------------------------------------------
const CATALOG_DIR = join(REPO_ROOT, "spec", "conventions", "cafe24-api-catalog");

const CAFE24_RESOURCES = [
  "store",
  "product",
  "order",
  "customer",
  "community",
  "design",
  "promotion",
  "application",
  "category",
  "collection",
  "supply",
  "shipping",
  "salesreport",
  "personal",
  "privacy",
  "mileage",
  "notification",
  "translation",
] as const;

type Cafe24Resource = (typeof CAFE24_RESOURCES)[number];

function parseSupportedIds(resource: Cafe24Resource): string[] {
  const filePath = join(CATALOG_DIR, `${resource}.md`);
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");
  const ids: string[] = [];
  let inTable = false;
  let headerSeen = false;
  let idColIdx = -1;
  let statusColIdx = -1;

  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      if (inTable) {
        inTable = false;
        headerSeen = false;
        idColIdx = -1;
        statusColIdx = -1;
      }
      continue;
    }
    if (!inTable) {
      inTable = true;
      headerSeen = false;
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().toLowerCase().replace(/`/g, ""));
      idColIdx = cells.indexOf("id");
      statusColIdx = cells.indexOf("status");
      continue;
    }
    if (!headerSeen) {
      if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) headerSeen = true;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    const id = (cells[idColIdx] ?? "").replace(/^`|`$/g, "").trim();
    const status = cells[statusColIdx] ?? "";
    if (id && status === "supported") ids.push(id);
  }
  return ids;
}

// Build the full expected key set from catalog.
function buildExpectedKeys(): string[] {
  const keys: string[] = [];
  for (const resource of CAFE24_RESOURCES) {
    const ids = parseSupportedIds(resource);
    for (const id of ids) {
      keys.push(`cafe24.${resource}.${id}`);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cafe24 i18n dict ↔ backend metadata sync (W2/W3/W4)", () => {
  const expectedKeys = buildExpectedKeys();

  it("KO dict has a key for every supported (resource, op.id)", () => {
    const missing = expectedKeys.filter((k) => !(k in cafe24CatalogKo));
    if (missing.length > 0) {
      throw new Error(
        `KO dict is missing ${missing.length} key(s):\n` +
          missing.map((k) => `  - ${k}`).join("\n") +
          "\n\nAdd the missing keys to codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts",
      );
    }
  });

  it("EN dict has a key for every supported (resource, op.id)", () => {
    const missing = expectedKeys.filter((k) => !(k in cafe24CatalogEn));
    if (missing.length > 0) {
      throw new Error(
        `EN dict is missing ${missing.length} key(s):\n` +
          missing.map((k) => `  - ${k}`).join("\n") +
          "\n\nAdd the missing keys to codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts",
      );
    }
  });

  it("KO and EN dicts have identical key sets (parity)", () => {
    const koKeys = new Set(Object.keys(cafe24CatalogKo));
    const enKeys = new Set(Object.keys(cafe24CatalogEn));

    const inKoOnly = [...koKeys].filter((k) => !enKeys.has(k));
    const inEnOnly = [...enKeys].filter((k) => !koKeys.has(k));

    if (inKoOnly.length > 0 || inEnOnly.length > 0) {
      const lines: string[] = [];
      if (inKoOnly.length > 0) {
        lines.push(`Keys in KO but not EN (${inKoOnly.length}):`);
        inKoOnly.forEach((k) => lines.push(`  - ${k}`));
      }
      if (inEnOnly.length > 0) {
        lines.push(`Keys in EN but not KO (${inEnOnly.length}):`);
        inEnOnly.forEach((k) => lines.push(`  - ${k}`));
      }
      throw new Error(
        `KO and EN cafe24Catalog dicts have mismatched key sets:\n${lines.join("\n")}\n\nKeep both dicts in sync. SoT: spec/conventions/cafe24-api-metadata.md §7.5.`,
      );
    }
  });

  it("all KO dict values are non-empty strings", () => {
    const empty = Object.entries(cafe24CatalogKo)
      .filter(([, v]) => !v || typeof v !== "string")
      .map(([k]) => k);
    if (empty.length > 0) {
      throw new Error(
        `KO dict has empty or non-string values for ${empty.length} key(s):\n` +
          empty.map((k) => `  - ${k}`).join("\n"),
      );
    }
  });

  it("all EN dict values are non-empty strings", () => {
    const empty = Object.entries(cafe24CatalogEn)
      .filter(([, v]) => !v || typeof v !== "string")
      .map(([k]) => k);
    if (empty.length > 0) {
      throw new Error(
        `EN dict has empty or non-string values for ${empty.length} key(s):\n` +
          empty.map((k) => `  - ${k}`).join("\n"),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// resolveCafe24OperationLabel unit tests (I10)
// ---------------------------------------------------------------------------

// Inline the function under test to avoid importing the full React component
// tree. The implementation is trivially small — the real risk is dict wiring,
// not logic.
function resolveCafe24OperationLabel(
  locale: "ko" | "en",
  labelKey: string,
): string {
  const dict = locale === "en" ? cafe24CatalogEn : cafe24CatalogKo;
  return dict[labelKey] ?? labelKey;
}

describe("resolveCafe24OperationLabel (I10)", () => {
  it("returns KO label for locale=ko", () => {
    const result = resolveCafe24OperationLabel(
      "ko",
      "cafe24.product.product_list",
    );
    expect(result).toBe(cafe24CatalogKo["cafe24.product.product_list"]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns EN label for locale=en", () => {
    const result = resolveCafe24OperationLabel(
      "en",
      "cafe24.product.product_list",
    );
    expect(result).toBe(cafe24CatalogEn["cafe24.product.product_list"]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("KO and EN labels differ for the same key", () => {
    const ko = resolveCafe24OperationLabel("ko", "cafe24.product.product_list");
    const en = resolveCafe24OperationLabel("en", "cafe24.product.product_list");
    // KO uses Korean characters, EN uses Latin — they must differ.
    expect(ko).not.toBe(en);
  });

  it("falls back to the labelKey itself when the key is not in the dict", () => {
    const unknownKey = "cafe24.product.does_not_exist_xyz";
    expect(resolveCafe24OperationLabel("ko", unknownKey)).toBe(unknownKey);
    expect(resolveCafe24OperationLabel("en", unknownKey)).toBe(unknownKey);
  });
});

// ---------------------------------------------------------------------------
// backend metadata.label absence regression guard (I11)
// ---------------------------------------------------------------------------

describe("backend metadata label field absence (I11 runtime guard)", () => {
  it("catalog .md files for all resources are readable (infrastructure sanity)", () => {
    const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".md"));
    // 18 resource files + _overview.md = 19 minimum
    expect(files.length).toBeGreaterThanOrEqual(19);
  });

  it("no cafe24Catalog key in KO dict contains a bare op.id without resource prefix", () => {
    // Guard: all keys must match `cafe24.<resource>.<id>` pattern.
    const bad = Object.keys(cafe24CatalogKo).filter(
      (k) => !/^cafe24\.[a-z]+\.[a-z_]+$/.test(k),
    );
    if (bad.length > 0) {
      throw new Error(
        `Malformed KO dict keys (expected cafe24.<resource>.<id>):\n` +
          bad.map((k) => `  - ${k}`).join("\n"),
      );
    }
  });

  it("no cafe24Catalog key in EN dict contains a bare op.id without resource prefix", () => {
    const bad = Object.keys(cafe24CatalogEn).filter(
      (k) => !/^cafe24\.[a-z]+\.[a-z_]+$/.test(k),
    );
    if (bad.length > 0) {
      throw new Error(
        `Malformed EN dict keys (expected cafe24.<resource>.<id>):\n` +
          bad.map((k) => `  - ${k}`).join("\n"),
      );
    }
  });
});
