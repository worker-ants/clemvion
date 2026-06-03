import { getNodeDefinition } from "@/lib/node-definitions";
import type { MakeshopNodeExtras } from "@/lib/node-definitions/types";
import type { Locale } from "@/lib/i18n/types";
import { makeshopCatalog as makeshopCatalogKo } from "@/lib/i18n/dict/ko/makeshopCatalog";
import { makeshopCatalog as makeshopCatalogEn } from "@/lib/i18n/dict/en/makeshopCatalog";

/**
 * Read the MakeShop node definition's `extras` (operation catalog) from the
 * loaded node-definitions registry. Returns `null` when definitions haven't
 * loaded yet (initial editor mount) or when the node ships without extras
 * (older backend deployed before the catalog payload) — consumers degrade
 * gracefully (Operation select shows a "definitions loading" placeholder,
 * Fields editor falls back to free-form text, allowlist editor shows a loading
 * line).
 *
 * Mirrors `readCafe24Extras` (`./cafe24-extras.ts`) minus the
 * `plannedByResource` channel — MakeShop has no planned tier, every operation
 * is supported.
 *
 * NOTE: reads the Zustand node-definitions store snapshot **directly** (not via
 * a hook) — call from a component render so React re-renders on store changes;
 * a call outside render context is not reactive.
 */
export function readMakeshopExtras(): MakeshopNodeExtras | null {
  const def = getNodeDefinition("makeshop");
  const extras = def?.extras;
  if (!extras || typeof extras !== "object") return null;
  const e = extras as Partial<MakeshopNodeExtras>;
  if (
    !e.operationsByResource ||
    typeof e.operationsByResource !== "object"
  ) {
    return null;
  }
  return e as MakeshopNodeExtras;
}

/**
 * Resolve a makeshop operation `labelKey` (`makeshop.<resource>.<id>`) to the
 * localized human label via the catalog dicts.
 *
 * dict 키 자체에 `.` 가 포함돼 일반 `useT(dotted.key)` 의 nested-lookup 흐름과
 * 충돌하므로 `makeshopCatalog` flat dict 를 직접 lookup 한다. dict 에 key 가 없으면
 * (catalog drift) key 자체를 그대로 반환 — 누락을 즉시 감지 가능. SoT:
 * `spec/conventions/makeshop-api-metadata.md` §2.
 */
export function resolveMakeshopOperationLabel(
  locale: Locale,
  labelKey: string,
): string {
  const dict = locale === "en" ? makeshopCatalogEn : makeshopCatalogKo;
  return dict[labelKey] ?? labelKey;
}
