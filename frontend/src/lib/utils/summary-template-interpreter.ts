import type { SummaryTemplate } from "@/lib/node-definitions/types";

type Config = Record<string, unknown>;

export type ConfigSummaryResult = {
  text: string;
  isWarning: boolean;
};

/**
 * Walks a dot-path into `config` and returns the leaf. Supports `.length` for
 * arrays and nested objects. Returns `undefined` for any missing segment.
 */
function getPath(config: Config, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = config;
  for (const part of parts) {
    if (cursor == null) return undefined;
    if (part === "length") {
      if (Array.isArray(cursor)) return cursor.length;
      if (typeof cursor === "string") return cursor.length;
      return undefined;
    }
    if (typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function applyFilter(value: unknown, filter: string): unknown {
  const [name, rawArg] = filter.split(":", 2);
  const arg = rawArg ?? "";
  switch (name) {
    case "upper":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "lower":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "default":
      if (value === undefined || value === null || value === "") return arg;
      return value;
    default:
      return value;
  }
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

/** Renders a `{{field|filter:arg}}` template against a config object. */
export function renderTemplate(template: string, config: Config): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    const [path, ...filters] = expr.split("|").map((s) => s.trim());
    let value: unknown = getPath(config, path);
    for (const filter of filters) {
      value = applyFilter(value, filter);
    }
    return stringify(value);
  });
}

/**
 * Evaluates a warnWhen predicate. Supported grammar (single expression only):
 *  - `!path`                — true when path is falsy/empty
 *  - `!path.length`         — true when array/string length is 0
 *  - `path==value`          — value compared as string (JSON-encoded)
 *  - `path!=value`
 *  - `path`                 — true when path is truthy (rarely useful; for completeness)
 */
export function evalWarnWhen(expr: string, config: Config): boolean {
  const trimmed = expr.trim();
  if (trimmed.length === 0) return false;

  if (trimmed.startsWith("!")) {
    const value = getPath(config, trimmed.slice(1).trim());
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && value === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === "number" && value === 0) return true;
    if (typeof value === "boolean" && value === false) return true;
    return false;
  }

  const neqIdx = trimmed.indexOf("!=");
  if (neqIdx > 0) {
    const path = trimmed.slice(0, neqIdx).trim();
    const rhs = trimmed.slice(neqIdx + 2).trim();
    return stringify(getPath(config, path)) !== rhs;
  }
  const eqIdx = trimmed.indexOf("==");
  if (eqIdx > 0) {
    const path = trimmed.slice(0, eqIdx).trim();
    const rhs = trimmed.slice(eqIdx + 2).trim();
    return stringify(getPath(config, path)) === rhs;
  }

  const value = getPath(config, trimmed);
  return Boolean(value);
}

/**
 * Renders a node's declarative `summaryTemplate` into the same
 * `{ text, isWarning }` shape the canvas consumes. Returns `null` when the
 * node has no template so the caller can fall back to legacy formatters.
 */
export function renderSummaryTemplate(
  spec: SummaryTemplate | undefined,
  config: Config,
): ConfigSummaryResult | null {
  if (!spec) return null;
  if (typeof spec === "string") {
    return { text: renderTemplate(spec, config), isWarning: false };
  }
  if (spec.warnWhen && evalWarnWhen(spec.warnWhen, config)) {
    const message = spec.warnMessage ?? renderTemplate(spec.template, config);
    return { text: `⚠ ${message}`, isWarning: true };
  }
  return { text: renderTemplate(spec.template, config), isWarning: false };
}
