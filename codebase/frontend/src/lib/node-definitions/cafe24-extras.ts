import { getNodeDefinition } from "@/lib/node-definitions";
import type { Cafe24NodeExtras } from "@/lib/node-definitions/types";
import type { Locale } from "@/lib/i18n/types";
import { cafe24Catalog as cafe24CatalogKo } from "@/lib/i18n/dict/ko/cafe24Catalog";
import { cafe24Catalog as cafe24CatalogEn } from "@/lib/i18n/dict/en/cafe24Catalog";

/**
 * Read the Cafe24 node definition's `extras` (operation/planned catalog) from
 * the loaded node-definitions registry. Returns `null` when definitions haven't
 * loaded yet (initial editor mount) or when the node ships without extras
 * (older backend deployed before the catalog payload) — consumers degrade
 * gracefully (Operation select shows a "definitions loading" placeholder,
 * Fields editor falls back to free-form text, allowlist editor shows a loading
 * line).
 *
 * Shared by the cafe24 node Operation form (`integration-configs.tsx`) and the
 * AI Agent allowlist editor (`cafe24-allowlist-editor.tsx`) so the structural
 * narrowing lives in one place (no drift).
 *
 * NOTE: reads the Zustand node-definitions store snapshot **directly** (not via
 * a hook) — call from a component render so React re-renders on store changes;
 * a call outside render context is not reactive.
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
 * Resolve a cafe24 operation `labelKey` (`cafe24.<resource>.<id>`) to the
 * localized human label via the catalog dicts.
 *
 * dict 키 자체에 `.` 가 포함돼 일반 `useT(dotted.key)` 의 nested-lookup 흐름과
 * 충돌하므로 `cafe24Catalog` flat dict 를 직접 lookup 한다. dict 에 key 가 없으면
 * (catalog drift) key 자체를 그대로 반환 — 누락을 즉시 감지 가능. SoT:
 * spec/conventions/cafe24-api-metadata.md §7.5 "dict lookup miss fallback".
 */
export function resolveCafe24OperationLabel(
  locale: Locale,
  labelKey: string,
): string {
  const dict = locale === "en" ? cafe24CatalogEn : cafe24CatalogKo;
  return dict[labelKey] ?? labelKey;
}
