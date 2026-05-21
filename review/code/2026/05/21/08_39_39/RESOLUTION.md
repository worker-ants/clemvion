# RESOLUTION

세션: `review/code/2026/05/21/08_39_39`
SUMMARY: `SUMMARY.md` (Critical 0 / Warning 9 / Info 13)

## 조치 항목

| SUMMARY # | 조치 | commit |
|---|---|---|
| W-1 | `product_additionalimages_delete` description 에 "collection-level DELETE — individual image_no selector not supported" 명시 | 본 commit (refactor(cafe24): apply ai-review WARNING fixes) |
| W-2 | `product.ts` 의 `icon_no` / `memo_no` / `tag_no` 의 `type: 'string'` → `type: 'number'` (3 row 영향) | 본 commit |
| W-5 | `types.ts` 의 `Cafe24OperationMetadata` 주석에 "scopeType 은 HTTP method 와 무관, OAuth scope 기준 (read POST 가능)" 규칙 명시 | 본 commit |
| W-8 | `planned.ts` 의 `product: []`, `order: []` 직전에 "fully implemented as supported (2026-05-21). store still has 6 privacy_* rows pending" 주석 추가 | 본 commit |
| W-9 | `orders_memos_list` label 을 "관리자 메모 목록 (전체 주문)" 으로 정정 + description 에 "across all orders (no order_id filter), distinct from `order_memos_list`" 명시. catalog md row 동시 갱신 | 본 commit |

## TEST 결과

- **lint**: `cd codebase/backend && npm run lint` — pre-existing 22 problem (3 errors, 19 warnings) 잔존. **모두 본 PR 변경 파일과 무관** (`sessions.controller.ts` / `executions.service.ts` / `llm.service.ts` / `node-component.interface.ts` / `migrate-node-output-refs.ts`). `git diff origin/main -- codebase/backend/src/modules/auth/sessions.controller.ts` 로 동일 확인. 본 PR 의 `store.ts` / `product.ts` / `order.ts` / `planned.ts` / `types.ts` / catalog md 변경 자체는 lint clean. 후속 plan `lint-preexisting-fixes` 로 분리 권장.
- **unit (catalog-sync + metadata + public-meta + restricted-approval + cafe24-related)**: 5 suite / 73 tests / 통과 (0.21s)
- **build (nest build)**: 통과
- **e2e (`make e2e-test`)**: 통과 — 93 tests / 65s / log: `_test_logs/e2e-20260521-085152.log`

## 보류·후속 항목

별도 plan 으로 이관:

- **W-3** (`fields` 포맷 통일 — 멀티라인 vs 인라인): 230 row 의 cosmetic 정리, 본 PR scope 밖. 후속 plan `spec-update-cafe24-catalog-drift.md` 의 일부로 분리.
- **W-4** (`bundleproducts_create` 등 빈 `fields: {}` 의도 주석 — 영향 row 37+): 본 PR scope 밖. 후속 plan `spec-update-cafe24-catalog-drift.md` 일부.
- **W-6** (`metadata.spec.ts` 보강 — write operation with empty fields 검출 assertion): `metadata.spec.ts` 신규 검증 추가. 후속 plan `cafe24-metadata-spec-coverage.md` 분리.
- **W-7** (`metadata.spec.ts` 보강 — list-but-non-paginated 의도 명시 검증): 동일 후속 plan.

Info 13건은 모두 권고 수준 (모듈 JSDoc 추가, batch 주석 cleanup 등) — 일괄 후속 plan `spec-update-cafe24-catalog-drift.md` 안에 포함.

## 자가 점검

- [x] `## 조치 항목` 작성
- [x] `## TEST 결과` 작성 (lint/unit/build/e2e 4 줄)
- [x] e2e 줄이 4가지 형식 중 하나 (통과)
- [x] 보류 항목이 §보류·후속 항목 에 명시
