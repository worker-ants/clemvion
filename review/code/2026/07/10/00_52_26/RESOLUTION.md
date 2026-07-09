# RESOLUTION — ai-review (00_52_26, origin/main..HEAD rebased)

위험도 MEDIUM / **Critical 0** / Warning 3. 누락 3 reviewer(side_effect/documentation/
user_guide_sync)는 journal 로 전수 확인 → 전부 LOW/0 Critical.

## 조치 항목

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | testing | `$params` ROOT_VARIABLES 추가 → VariablePicker Built-in 노출 부수효과 미검증 | **FIX** — `variable-picker.test.tsx` 에 노출+클릭삽입(`onInsert("$params")`) 테스트 추가 |
| W2 | testing | `$params.` 방어 가드(array/null/primitive→{}) 미검증 | **FIX** — `parameters: null/[]/str/42` fallback 테스트 추가 |
| W3 | maintainability | `$params.` 분기 = 5번째 반복 패턴(DRY) | **후속(백로그)** — 리뷰어 "즉시 차단 아님". prefix→{getSample,getSchema} 디스패치 테이블은 기존 4분기 동반 리팩터라 별도 PR |
| INFO#1 | requirement | enricher JSDoc·plan "목표" 의 "$params 무관/별개 관심사" 서술이 본 PR 로 stale | **FIX** — JSDoc(`node-output-schema-enrichers.ts`)·plan 을 "직속 successor 한정 `$params.<name>` 에도 관여(같은 inputSchema.parameters 재사용)"로 정정 |
| INFO#5 | maintainability | `$params` BUILT_IN_PICKER 노출 의도 미문서 | **FIX** — ROOT_VARIABLES 항목에 1줄 주석(제외목록 미포함 이유) |
| INFO#6 | testing | `$params.` tokenStart/tokenEnd 회귀 테스트 부재 | **FIX** — leaf prefix 치환 범위 단언 테스트 추가 |
| doc(LOW) | documentation | CHANGELOG Unreleased 누락 | **FIX** — §7.1 항목 추가 |
| doc(LOW) | documentation | expression §7.1 트리거 조건 표에 `$params.` 행 부재 | **FIX** — 행 추가 |
| INFO#2/#3/#4/#7 | 다수 | picker 리터럴 삽입(기존 정책)·slice 매직넘버(기존 관행)·isPlainRecord 유틸 부재·병합 케이스 | 무조치/후속 — 기존 관행·저위험 |

## TEST 결과
- lint: 통과
- unit: 통과 (use-expression-suggestions + variable-picker = 62; 전체 스위트 §아래 재수행)
- build: 통과
- e2e: 통과 — 프론트 전용이나 화이트리스트상 `.ts` 포함이라 면제 불가 → 전체 e2e 수행(rebased base, 백엔드 무회귀)

## 보류·후속 항목
- W3 DRY 리팩터(prefix 디스패치 테이블) — 기존 4분기 동반이라 별도 PR
- INFO#4 공용 `isPlainRecord` 유틸 신설 — frontend 전역 백로그
- `spec/4-nodes/7-trigger/0-common.md §3` `output:$params` 표기(이전 PR 후속, project-planner)
