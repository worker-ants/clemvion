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
/** 카탈로그 dict 가 있는 provider 표. 접두와 라벨 조회 함수를 한곳에 둔다. provider 를 더할 때 여기만 고친다. */
const CATALOG_PROVIDERS: ReadonlyArray<{
  prefix: string;
  resolve: (locale: Locale, key: string) => string;
}> = [
  { prefix: "makeshop.", resolve: resolveMakeshopOperationLabel },
  { prefix: "cafe24.", resolve: resolveCafe24OperationLabel },
];

function findCatalogProvider(key: string) {
  return CATALOG_PROVIDERS.find((p) => key.startsWith(p.prefix));
}

export function tryTranslateLabel(
  catalogKey: string,
  locale: Locale,
): string | null {
  const provider = findCatalogProvider(catalogKey);
  if (!provider) return null;
  const label = provider.resolve(locale, catalogKey);
  return label === catalogKey ? null : label;
}

/**
 * 활동 탭 API 칸에 굵게 보일 라벨 글자.
 *  - 카탈로그 키(`cafe24.*` · `makeshop.*`)는 {@link tryTranslateLabel} 로 바꾼다. dict 에 없으면 null 이라
 *    endpoint 한 줄로 넘긴다.
 *  - 카탈로그가 없는 통합의 라벨은 그대로 쓴다. 외부 MCP 서버의 도구 호출이 `apiLabel` 에 도구 이름을 싣는다
 *    (CLE-INT-DATA-ENTITY 「호출 API 식별 채우기 규칙」).
 */
export function resolveActivityApiLabel(
  labelKey: string,
  locale: Locale,
): string | null {
  if (findCatalogProvider(labelKey)) {
    return tryTranslateLabel(labelKey, locale);
  }
  return labelKey;
}
