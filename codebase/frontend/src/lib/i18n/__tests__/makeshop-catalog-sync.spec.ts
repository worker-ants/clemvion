/**
 * makeshop i18n dict ↔ backend catalog drift guard. Mirror of the cafe24
 * counterpart (`./cafe24-catalog-sync.spec.ts`) adapted to MakeShop:
 *
 *  1. Every `(resource, op.id)` from the supported catalog rows has a matching
 *     `makeshop.<resource>.<op.id>` key in the KO dict.
 *  2. Every supported `(resource, op.id)` has a matching key in the EN dict.
 *  3. KO and EN dicts have identical key sets (parity).
 *  4. All dict values are non-empty strings.
 *  5. `resolveMakeshopOperationLabel` returns the EN label for locale="en" and
 *     the KO label for locale="ko", falling back to the labelKey on miss.
 *
 * MakeShop differences from cafe24: operation ids contain hyphens + digits
 * (e.g. `get-brand_product`, `get-order-1`), so the well-formedness regex is
 * looser than cafe24's `[a-z_]+`. There is no planned tier — every catalog row
 * is `supported`.
 *
 * SoT: spec/conventions/makeshop-api-metadata.md §2,
 *      spec/conventions/makeshop-api-catalog/<resource>.md.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { makeshopCatalog as makeshopCatalogKo } from "@/lib/i18n/dict/ko/makeshopCatalog";
import { makeshopCatalog as makeshopCatalogEn } from "@/lib/i18n/dict/en/makeshopCatalog";

// Resolve repo root — frontend lives at <root>/codebase/frontend.
const REPO_ROOT = resolve(__dirname, "../../../../../../");
const CATALOG_DIR = join(REPO_ROOT, "spec", "conventions", "makeshop-api-catalog");

const MAKESHOP_RESOURCES = [
  "shop",
  "product",
  "order",
  "member",
  "benefit",
  "board",
  "cpik",
] as const;

type MakeshopResource = (typeof MAKESHOP_RESOURCES)[number];

// REST table header order (makeshop-api-catalog `_overview.md`):
// `id | 라벨 (한) | method | path | scope | paginated | status | docs`.
// The webhook table (`id | 라벨 (한) | event_code | docs`) lacks path/scope so
// it is skipped as non-REST.
const REST_HEADERS = [
  "id",
  "라벨 (한)",
  "method",
  "path",
  "scope",
  "paginated",
  "status",
  "docs",
];

function parseSupportedIds(resource: MakeshopResource): string[] {
  const filePath = join(CATALOG_DIR, `${resource}.md`);
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");
  const ids: string[] = [];
  let inTable = false;
  let headerSeen = false;
  let isRest = false;
  let idColIdx = -1;
  let statusColIdx = -1;

  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      inTable = false;
      headerSeen = false;
      isRest = false;
      idColIdx = -1;
      statusColIdx = -1;
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
      const methodColIdx = cells.indexOf("method");
      const pathColIdx = cells.indexOf("path");
      const scopeColIdx = cells.indexOf("scope");
      // REST table requires id + method + path + scope columns. Webhook
      // tables lack path/scope, so they are excluded.
      isRest =
        idColIdx >= 0 &&
        methodColIdx >= 0 &&
        pathColIdx >= 0 &&
        scopeColIdx >= 0;
      continue;
    }
    if (!headerSeen) {
      if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) headerSeen = true;
      continue;
    }
    if (!isRest) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < REST_HEADERS.length) continue;
    const id = (cells[idColIdx] ?? "").replace(/^`|`$/g, "").trim();
    const status = cells[statusColIdx] ?? "";
    if (id && status === "supported") ids.push(id);
  }
  return ids;
}

function buildExpectedKeys(): string[] {
  const keys: string[] = [];
  for (const resource of MAKESHOP_RESOURCES) {
    for (const id of parseSupportedIds(resource)) {
      keys.push(`makeshop.${resource}.${id}`);
    }
  }
  return keys;
}

describe("makeshop i18n dict ↔ catalog sync", () => {
  const expectedKeys = buildExpectedKeys();

  it("catalog parsing precondition — finds all 161 supported operations", () => {
    expect(expectedKeys.length).toBe(161);
  });

  it("KO dict has a key for every supported (resource, op.id)", () => {
    const missing = expectedKeys.filter((k) => !(k in makeshopCatalogKo));
    if (missing.length > 0) {
      throw new Error(
        `KO dict is missing ${missing.length} key(s):\n` +
          missing.map((k) => `  - ${k}`).join("\n") +
          "\n\nAdd the missing keys to codebase/frontend/src/lib/i18n/dict/ko/makeshopCatalog.ts",
      );
    }
  });

  it("EN dict has a key for every supported (resource, op.id)", () => {
    const missing = expectedKeys.filter((k) => !(k in makeshopCatalogEn));
    if (missing.length > 0) {
      throw new Error(
        `EN dict is missing ${missing.length} key(s):\n` +
          missing.map((k) => `  - ${k}`).join("\n") +
          "\n\nAdd the missing keys to codebase/frontend/src/lib/i18n/dict/en/makeshopCatalog.ts",
      );
    }
  });

  it("KO and EN dicts have identical key sets (parity)", () => {
    const koKeys = new Set(Object.keys(makeshopCatalogKo));
    const enKeys = new Set(Object.keys(makeshopCatalogEn));
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
        `KO and EN makeshopCatalog dicts have mismatched key sets:\n${lines.join("\n")}`,
      );
    }
  });

  it("all KO dict values are non-empty strings", () => {
    const empty = Object.entries(makeshopCatalogKo)
      .filter(([, v]) => !v || typeof v !== "string")
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("all EN dict values are non-empty strings", () => {
    const empty = Object.entries(makeshopCatalogEn)
      .filter(([, v]) => !v || typeof v !== "string")
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("all dict keys match the makeshop.<resource>.<id> shape", () => {
    // ids contain lowercase letters, digits, hyphens and underscores.
    const KEY_RE = /^makeshop\.[a-z]+\.[a-z0-9_-]+$/;
    const bad = Object.keys(makeshopCatalogKo).filter((k) => !KEY_RE.test(k));
    if (bad.length > 0) {
      throw new Error(
        `Malformed KO dict keys (expected makeshop.<resource>.<id>):\n` +
          bad.map((k) => `  - ${k}`).join("\n"),
      );
    }
    expect(bad).toEqual([]);
  });

  it("catalog .md files for all resources are readable (sanity)", () => {
    const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".md"));
    // 7 resource files + _overview.md = 8 minimum
    expect(files.length).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// resolveMakeshopOperationLabel unit tests
// ---------------------------------------------------------------------------

function resolveMakeshopOperationLabel(
  locale: "ko" | "en",
  labelKey: string,
): string {
  const dict = locale === "en" ? makeshopCatalogEn : makeshopCatalogKo;
  return dict[labelKey] ?? labelKey;
}

describe("resolveMakeshopOperationLabel", () => {
  it("returns KO label for locale=ko", () => {
    const result = resolveMakeshopOperationLabel("ko", "makeshop.product.get-product");
    expect(result).toBe(makeshopCatalogKo["makeshop.product.get-product"]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns EN label for locale=en", () => {
    const result = resolveMakeshopOperationLabel("en", "makeshop.product.get-product");
    expect(result).toBe(makeshopCatalogEn["makeshop.product.get-product"]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("KO and EN labels differ for the same key", () => {
    const ko = resolveMakeshopOperationLabel("ko", "makeshop.product.get-product");
    const en = resolveMakeshopOperationLabel("en", "makeshop.product.get-product");
    expect(ko).not.toBe(en);
  });

  it("falls back to the labelKey itself when the key is not in the dict", () => {
    const unknownKey = "makeshop.product.does_not_exist_xyz";
    expect(resolveMakeshopOperationLabel("ko", unknownKey)).toBe(unknownKey);
    expect(resolveMakeshopOperationLabel("en", unknownKey)).toBe(unknownKey);
  });
});
