/**
 * Cafe24 catalog key → 사람 친화 라벨 dict (KO).
 *
 * `GET /api/integrations/services/cafe24/catalog` 응답의 `labelKey`
 * (= `cafe24.<resource>.<operation>`) 를 lookup 키로 사용한다.
 *
 * 현재 빈 dict — 본 PR 은 인프라 (3컬럼 + catalog endpoint + dict 슬롯)
 * 도입에 집중하고, 100+ cafe24 operation 의 KO/EN 라벨 이주는 별 follow-up
 * plan `cafe24-catalog-i18n.md` 에서 처리한다. lookup 실패 시 ActivityTab 은
 * endpoint subtext (`{method} {path}`) 한 줄로 fallback (spec §4.6 정책).
 *
 * 채울 때 key 형식: `"cafe24.<resource>.<operation>": "주문 목록 조회"`
 *
 * SoT: spec/conventions/cafe24-api-metadata.md §7.5,
 *      spec/2-navigation/4-integration.md §4.6 / §9.3
 */
export const cafe24Catalog: Record<string, string> = {};
