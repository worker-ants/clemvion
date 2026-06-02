import { getNodeDefinition } from "@/lib/node-definitions";
import type { Cafe24NodeExtras } from "@/lib/node-definitions/types";
import type { Locale } from "@/lib/i18n/types";
import { cafe24Catalog as cafe24CatalogKo } from "@/lib/i18n/dict/ko/cafe24Catalog";
import { cafe24Catalog as cafe24CatalogEn } from "@/lib/i18n/dict/en/cafe24Catalog";

/**
 * Read the Cafe24 node definition's `extras` (operation/planned catalog) from
 * the loaded node-definitions registry. Returns `null` when definitions haven't
 * loaded yet (initial editor mount) or when the node ships without extras
 * (older backend) — callers degrade gracefully.
 *
 * Shared by the cafe24 node Operation form (`integration-configs.tsx`) and the
 * AI Agent allowlist editor (`cafe24-allowlist-editor.tsx`) so the structural
 * narrowing lives in one place (no drift).
 */
export function readCafe24Extras(): Cafe24NodeExtras | null {
  const def = getNodeDefinition("cafe24");
  const extras = def?.extras;
  if (!extras || typeof extras !== "object") return null;
  const e = extras as Partial<Cafe24NodeExtras>;
  if (
    !e.operationsByResource ||
    !e.plannedByResource ||
    typeof e.operationsByResource !== "object" ||
    typeof e.plannedByResource !== "object"
  ) {
    return null;
  }
  return e as Cafe24NodeExtras;
}

/**
 * Resolve a cafe24 operation/resource `labelKey` (`cafe24.<resource>.<id>`) to
 * the localized human label via the catalog dicts. Falls back to the raw key.
 */
export function resolveCafe24OperationLabel(
  locale: Locale,
  labelKey: string,
): string {
  const dict = locale === "en" ? cafe24CatalogEn : cafe24CatalogKo;
  return dict[labelKey] ?? labelKey;
}
