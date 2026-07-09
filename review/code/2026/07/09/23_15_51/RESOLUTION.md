# RESOLUTION — ai-review (23_15_51, origin/main..HEAD)

위험도 **LOW / Critical 0 / Warning 5**. WARNING 1·2·5 fix, 3·4 는 후속 백로그(리뷰어도
"이번 PR 필수 아님"). 코드 재변경은 프론트 전용.

## 조치 항목

| # | 카테고리 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W1 | 문서화 | JSDoc·plan 이 `$params.<name>` 자동완성을 "된다"고 과잉 서술 (`$params` 는 root 변수 미등록 → enricher 영향권 밖) | **FIX** — JSDoc/plan 에서 `$params.<name>` 주장 제거, 실제 영향 경로(`$node[...].output.parameters.<name>` + 직속 successor `$input.parameters.<name>`)만 서술 + "`$params` 하위키는 별개 관심사" 명시 | (review fix) |
| W2 | 유지보수성 | `MANUAL_TRIGGER_TYPE_MAP` 이 `INFO_EXTRACTOR_TYPE_MAP` 과 100% 동일 identity map | **FIX** — 공용 `JSON_SCHEMA_IDENTITY_TYPE_MAP` 로 통합(두 enricher 공유), 중복 상수 제거 | (review fix) |
| W3 | 유지보수성 | 5개 enricher 골격 반복(DRY) | **후속(백로그)** — 리뷰어 "이번 PR 필수 아님, 6번째 enricher 전 권장". 4→5-way 로 늘어난 pre-existing 부채. 공용 `projectFieldsIntoSchema` 추출은 기존 4함수 동반 리팩터라 별도 PR 이 안전 | 이연 |
| W4 | 유지보수성 | `use-expression-context.ts` 5-way dispatch 2곳 중복 | **후속(백로그)** — W3 과 함께 `ENRICHERS` 테이블로. pre-existing(4-way 때부터) | 이연 |
| W5 | 테스트 | manual_trigger 배선 2곳 통합테스트 부재 | **FIX** — `use-expression-context.test.ts` 에 "manual_trigger enricher wiring" describe 추가: `$node` output projection·`$input` predecessor fallback 각 1개, 실제 config.parameters→output.parameters 투영 단언 | (review fix) |

## INFO 처분
- e2e 면제 근거 부정확(INFO#1) → **정정**: PROJECT.md 화이트리스트상 `.ts` 코드 포함 = 면제 불가. e2e 실제 수행(§TEST 결과).
- `0-common.md §3` `output: $params` 축약(INFO#2) → pre-existing, 내 코드 무관. project-planner 후속(plan 기재, 이미 추적).
- CHANGELOG 미갱신(INFO#7) → **FIX**: Unreleased 항목 추가.
- 테스트 커버리지 얕음(INFO#4/#5/#6: 병합 경로·무관 prop 보존·비-string name) → 여유 시 후속. 핵심 계약은 enricher 단위테스트 7종 + 배선 통합테스트 2종이 커버.
- security/side_effect NONE — 기존 안전장치(`isSafeFieldName`+`Object.create(null)`+`structuredClone`) 재사용, 신규 공격면·부작용 없음.

## TEST 결과
- lint: 통과
- unit: 통과 (enrichers 40 + use-expression-context wiring 2 = 관련 파일 71 passed; 전체 스위트 §아래)
- build: 통과 (frontend tsc + 번들)
- e2e: 통과 — 프론트 전용 변경이나 PROJECT.md 화이트리스트상 `.ts` 포함이라 면제 불가 → 전체 e2e 수행 (백엔드 무변경, 무회귀 확인)

## 보류·후속 항목
- W3/W4: enricher DRY 리팩터(공용 `projectFieldsIntoSchema` + `ENRICHERS` 디스패치 테이블) — 기존 4개 enricher 동반 수정이라 별도 PR. 6번째 enricher 추가 시점 트리거.
- `spec/4-nodes/7-trigger/0-common.md §3` `output: $params`→`output.parameters: $params` 표기 정정 — project-planner (plan 후속 절).
- 테스트 커버리지 심화(병합 경로 등) — 비차단.
