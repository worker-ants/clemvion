# Code Review 통합 보고서

검토 세션: `review/code/2026/05/21/08_39_39`
대상: cafe24 catalog `planned → supported` 전수 승격 (store 92 / product 49 / order 89 = 230 row)
검토 일시: 2026-05-21

## 전체 위험도

**LOW** — 정적 메타데이터 row 추가 작업. Critical 0건, Warning 9건 (모두 LOW 권고 수준).

## 라우터 결정 (routing=done)

- **실행**: security, maintainability, requirement, scope, side_effect, testing, documentation, api_contract (8명)
- **forced**: 위 7명 (router_safety)
- **router 판단 추가**: api_contract — 236 endpoint metadata 가 HTTP method/path/response shape 계약을 정의
- **skip**: performance, architecture, dependency, database, concurrency — metadata row 추가만, 무관

## Critical (0건)

발견 없음.

## Warning (9건)

| # | 카테고리 | 발견 | 위치 |
|---|---|---|---|
| W-1 | API Contract | `product_additionalimages_delete` — collection-level DELETE (개별 image 식별자 없음) | `product.ts` |
| W-2 | Security/API | `icon_no`/`memo_no`/`tag_no` 가 `type: 'string'` 으로 선언 (`product_no` 는 `number`) | `product.ts` |
| W-3 | Maintainability | `order.ts` 신규 항목의 `fields` 포맷 혼재 (멀티라인 vs 인라인) | `order.ts` |
| W-4 | Maintainability | `bundleproducts_create` 의 `fields: {}` — 빈 fields 의도 불명 | `product.ts` |
| W-5 | Maintainability | `orders_calculation_total` — POST + scopeType 'read' 직관 충돌, 규칙 미문서화 | `order.ts`, `types.ts` |
| W-6 | Testing | `fields: {}` + write operation 패턴 37+ 곳에 body schema 검증 없음 | `order.ts`, `product.ts` |
| W-7 | Testing | `responseShape: 'list'` + paginated 미선언 패턴 다수, 의도 검증 없음 | `order.ts` |
| W-8 | Documentation | `planned.ts` 의 `product: []`, `order: []` 빈 배열에 의도 주석 없음 | `planned.ts` |
| W-9 | Requirement | `orders_memos_list` label 이 `order_memos_list` (주문별) 와 UI 혼동 가능 | `order.ts` |

## Info (13건)

상세는 각 reviewer 의 개별 보고서 참조.

## 권장 조치

본 PR 안 fix: W-1, W-2 (icon/memo/tag → number), W-5 (types.ts 주석), W-8 (planned.ts 주석), W-9 (label/description 명확화) = **5건**

후속 plan 으로 분리:
- W-3 (`fields` 포맷 통일): 230 row 의 cosmetic 정리, 대규모 텍스트 작업 — `spec-update-cafe24-catalog-drift.md`
- W-4 (빈 `fields: {}` 의도 주석): 영향 row 37+ 곳 — `spec-update-cafe24-catalog-drift.md`
- W-6 (metadata.spec body schema 검증 보강): metadata.spec 개선 plan 필요 — 별도 plan
- W-7 (list-non-paginated 의도 명시): metadata.spec 개선 plan — 별도 plan
