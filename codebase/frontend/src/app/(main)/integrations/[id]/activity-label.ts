import type { Locale } from "@/lib/i18n";
import { resolveCafe24OperationLabel } from "@/lib/node-definitions/cafe24-extras";
import { resolveMakeshopOperationLabel } from "@/lib/node-definitions/makeshop-extras";

/**
 * `<provider>.<resource>.<operation>` catalog key 를 사람 친화 라벨로 변환한다.
 * provider prefix 로 flat catalog dict 를 직접 lookup 한다:
 *  - `makeshop.*` → makeshopCatalog dict (161 op)
 *  - `cafe24.*`  → cafe24Catalog dict (485 op)
 * 두 dict 모두 채워져 있어, 매핑이 있으면 라벨·miss 면 null
 * (endpoint-only fallback 으로 위임).
 *
 * 주의: catalog dict 키는 `"makeshop.shop.get-authority"` 같은 flat dotted-key 라
 * i18n `t()` (점 분리 nested 순회) 로는 조회되지 않는다 — provider 전용 flat
 * lookup 헬퍼(`resolve{Cafe24,Makeshop}OperationLabel`)를 써야 한다.
 * SoT: dict/{ko,en}/{cafe24,makeshop}Catalog.ts,
 *      spec/conventions/makeshop-api-metadata.md §2 · cafe24-api-metadata.md §7.5.
 */
export function tryTranslateLabel(
  catalogKey: string,
  locale: Locale,
): string | null {
  if (catalogKey.startsWith("makeshop.")) {
    const label = resolveMakeshopOperationLabel(locale, catalogKey);
    return label === catalogKey ? null : label;
  }
  if (catalogKey.startsWith("cafe24.")) {
    const label = resolveCafe24OperationLabel(locale, catalogKey);
    return label === catalogKey ? null : label;
  }
  return null;
}
