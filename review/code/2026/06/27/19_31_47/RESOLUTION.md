# RESOLUTION — swagger paginated single-wrap fix

ai-review SUMMARY(19_31_47): risk LOW, **Critical 0 / Warning 0** (clean). impl-done(19_31_47): BLOCK NO, WARNING W-1(§2-5 pass-through). ai-review 는 Warning 0 이라 강제 fix 불요였으나, impl-done W-1 + ai-review 의 cheap·high-value INFO(1·2·4·5)를 동일 브랜치에서 반영. 단일 resolution 커밋.

## 조치 항목

| 출처 | 분류 | 조치 | 위치 |
|---|---|---|---|
| impl-done W-1 (= ai-review INFO 5) | FIX | `swagger.md §2-5` 에 `TransformInterceptor` pass-through 예외 한 문장 추가(이미 `data` 키 보유 객체는 추가 래핑 없음 — `PaginatedResponseDto` 대표) | `spec/conventions/swagger.md §2-5` |
| impl-done W-1 sug.2 / I-2 | FIX | `## Rationale` 에 `§5 ApiOkPaginatedResponse single-wrap (pass-through 예외)` 항목 신설 — 구조·조건·wire shape·구 double-wrap=버그 근거·"되돌리지 말 것" | `spec/conventions/swagger.md ## Rationale` |
| ai-review INFO 4 | FIX | `§5-2` 표 셀 축약 — pass-through 근거를 §2-5 로 이전, 셀은 `{ data: <Dto>[], pagination }` + §2-5 참조 | `spec/conventions/swagger.md §5-2` |
| ai-review INFO 1 | FIX | 테스트에 `expect(schema.type).toBe('object')` 추가(sibling 테스트 정합) | `api-wrapped.spec.ts` |
| ai-review INFO 2 | FIX | `pagination` 서브스키마 deep-equal 단언으로 강화(type·각 필드 example) | `api-wrapped.spec.ts` |

## 보류·후속 항목

| 출처 | 사유 |
|---|---|
| ai-review INFO 3 | pagination 서브스키마 SoT 분산(DTO↔리터럴) — JSDoc 동기화 주의는 §5 Rationale 가 일부 흡수. DTO 참조 자동화는 중기 tech-debt |
| ai-review INFO 6/7 | `ApiOkPaginatedResponse` 데코레이터 통합 테스트·paginated e2e top-level 단언 — 별 트랙(현 단위 커버 충분) |
| ai-review INFO 8 | OpenAPI SDK codegen 재생성 — frontend 무영향 확인, 사용 시 안내 |
| ai-review INFO 9 | security reviewer 출력 파일 미존재(write isolation) — 8 reviewer 정상, 순수 메타데이터라 보안 무영향, 재실행 불요 |
| impl-done I-3/I-4/I-5 | swagger.md Overview 미존재·audit model_config·cafe24 §G-3l — 전부 pre-existing/범위 외 |

## TEST 결과

resolution 후 TEST WORKFLOW 재수행:
- lint: 통과 (`_test_logs/lint-20260627-194136.log`)
- unit: 통과 — backend 378 suites(강화된 api-wrapped.spec 포함) (`_test_logs/unit-20260627-194221.log`)
- build: 통과 (`_test_logs/build-20260627-194311.log`)
- e2e: 통과 — 215 (`_test_logs/e2e-20260627-194456.log`)
