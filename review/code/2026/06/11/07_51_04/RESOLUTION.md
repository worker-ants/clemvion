# RESOLUTION — makeshop catalog 2차 ai-review (session 07_51_04)

risk LOW (Critical 0 + Warning 2 + INFO 11). Critical fix(1차 07_33_31) 이후 코드를 재리뷰한 2회차. **Warning 2건 모두 코드 수정으로 해소**, INFO 는 수정/자연정확/백로그 분류. 병행한 `/consistency-check --impl-done`(07_49_18) = **BLOCK: NO**.

## 발견 (2차 리뷰 중)

**cafe24Catalog dict 도 494 op 채워져 있음** — 1차 RESOLUTION·주석에서 "cafe24 dict 빈 상태"로 적었으나 실제 494 엔트리(#447 d9512d7b 충전). 즉 Critical(t() nested 순회 버그)은 cafe24 라벨도 못 띄우고 있었고, **flat-lookup fix 가 cafe24·makeshop 두 라벨을 함께 복구**한다. 관련 주석(activity-label.ts·page.tsx renderApiCell) 을 "두 dict 모두 채워짐"으로 정정.

## 조치 항목

| # | 카테고리 | 판정 | 근거·조치 |
|---|----------|------|-----------|
| Warning #1 | Requirement | **수정 완료** | `getServiceCatalog` 미지원 `:type` 404 미반환 — 테스트가 `'unknown'`(완전 미등록)을 빈배열 기대로 포함해 spec §9.3("미지원 `:type` 은 일반 404")과 모순되는 동작 정식화. **조치**: 테스트에서 `'unknown'` 제거, spec §9.3 의 known non-catalog 7종(http/database/email/**webhook**/mcp/google/github)으로 한정 + describe 정확화. 404 반환 자체는 behavior change(ActivityTab 이 모든 serviceType 에 catalog fetch)이고 V-06/V-08 범위 밖 pre-existing 이라 별도 백로그 — 테스트가 더 이상 잘못된 동작을 주장하지 않도록만 교정. |
| Warning #2 | Testing | **수정 완료** | `tryTranslateLabel` 분기 단위 테스트 부재. **조치**: 순수 함수를 `[id]/activity-label.ts` 로 추출(page.tsx 는 import) + `__tests__/activity-label.test.ts` 7 케이스 신설 (makeshop hit ko/en, cafe24 hit ko, makeshop/cafe24 miss→null, unknown prefix→null, prefix 없음→null). vitest 7 passed. |
| INFO #1 (SPEC-DRIFT) | — | **수정 완료 (spec)** | `spec/2-navigation/4-integration.md` Rationale L1147·표 L1132-1139·요약 L830 의 "cafe24 만" stale → cafe24·makeshop 병기로 갱신(consistency W-1 과 동일 지점, 4 checker 공통). 본문 §9.3 은 이미 정확했고 Rationale 동기화. |
| INFO #5/#6 (문서) | — | **코드 이미 정확 (reviewer 오인)** | `IntegrationMeta` JSDoc "Only Cafe24 emits" 는 `appType` 한정이고 appType 은 실제 cafe24 만 emit → 정확. `appUrl` JSDoc(IntegrationDerivedFields L204-209)은 이미 makeshop 명시(L207). pending-DTO 의 appUrl 은 cafe24 Private install 전용 흐름이라 정확. reviewer 가 옛 baseline 인용. |
| INFO #7 (문서) | — | **수정 완료** | `tryTranslateLabel` JSDoc `@see` dead link(`cafe24-catalog-i18n.md` 미존재, consistency W-2) 제거 + makeshop dict 완료·`makeshop-api-metadata §2`·`cafe24-api-metadata §7.5` 참조로 교체. |
| INFO #9 (테스트) | — | **수정 완료 (부분)** | makeshop `descriptionKey` 포맷 단언 추가(1차에서). 정확한 `length === 161` 단언은 brittle(메타데이터 증가 시 깨짐)이라 미채택 — `> 0` 유지. |
| INFO #2/#3/#4 (architecture/security) | — | **수용(현행) / 백로그** | `CATALOG_REGISTRY` Map 패턴(#2 — 2 provider 에서 과잉, tech-debt 기록), `buildOperationCatalog` 리터럴 union(#4 — registry 통합 시 자연해소), provider-prefix 분기가 page 레이어 잔류(#3 — `activity-label.ts` 추출로 부분 완화, 완전 중앙화는 `lib/node-definitions`) — provider 3개 이상 시 재검토 백로그. |
| INFO #10/#11 (security/architecture, pre-existing) | — | **백로그** | previewTest 에러 입력 반사(#10), oauthBegin providerMeta 조립(#11) — 본 PR 무관 pre-existing. integrations 모듈 정리 백로그. |

## consistency-check (07_49_18) 반영

- **BLOCK: NO** (Critical 0). W-1(Rationale stale) = 위 INFO #1 로 spec 갱신 완료. W-2(cafe24-catalog-i18n.md dead link) = `@see` 제거로 해소. I-1/I-2(문서 동기화)·I-3(@ApiParam example)·I-5(db-pool 브랜치 rebase)는 마이너/타 브랜치 영역 백로그.

## TEST 결과

- backend build : 통과
- backend unit  : 통과 (getServiceCatalog 3 passed — cafe24/makeshop/known-empty, descriptionKey 단언 포함)
- frontend unit : 통과 (activity-label.test.ts **7 passed**)
- frontend lint : 통과 (page.tsx·activity-label.ts·test)
- frontend tsc  : 통과 (전체 0 error)

## 후속·백로그

- 미지원 `:type` 404 반환(spec §9.3, W#1) — behavior change·scope 밖 pre-existing. ActivityTab catalog fetch 영향 분석 후 별도 plan.
- `CATALOG_REGISTRY` Map 패턴 — provider 3개 이상 시.
- previewTest 에러 sanitize / oauthBegin providerMeta 추출 — integrations 모듈 정리.
- frontend `renderApiCell` 통합(JSX) 테스트 — 핵심 `tryTranslateLabel` 은 본 PR 에서 커버.
