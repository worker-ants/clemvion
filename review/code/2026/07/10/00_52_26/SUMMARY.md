# Code Review 통합 보고서 (origin/main..HEAD, rebased)

## 전체 위험도
**MEDIUM** — Critical 0. WARNING 3(테스트 커버리지 2 + DRY 1). 3개 reviewer(side_effect/documentation/user_guide_sync)는 파일 미기록(FS-flakiness)이나 journal 로 전수 확인 → 전부 **LOW, 0 Critical**.

## Critical
없음.

## WARNING (3) — 처분
| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| 1 | testing | `$params` ROOT_VARIABLES 추가로 VariablePicker Built-in 섹션에도 노출되는데 `variable-picker.test.tsx` 미검증 | **FIX** — picker 노출/삽입 테스트 추가 |
| 2 | testing | `$params.` 방어 가드(array/null/primitive→{}) 미검증 | **FIX** — `parameters:null`/`[]` fallback 테스트 추가 |
| 3 | maintainability | `$params.` 분기가 `$input.`/`$sourceItem.`/`$dataSource.` 패턴 5번째 반복(DRY) | **후속(백로그)** — 리뷰어 "즉시 차단 아님". prefix→{getSample,getSchema} 디스패치 테이블 추출은 기존 4분기 동반이라 별도 PR |

## INFO — 처분
- requirement #1: `node-output-schema-enrichers.ts` JSDoc·enricher plan "목표"의 "$params 무관" 서술이 본 PR 로 stale → **FIX**(직속 successor 한정 관여로 정정).
- documentation: CHANGELOG Unreleased 누락 → **FIX**. expression §7.1 표에 `$params.` 행 → **FIX**(있으면).
- INFO #5: BUILT_IN_PICKER `$params` 노출 의도 주석 → **FIX**(1줄).
- INFO #6: `$params.` tokenStart/tokenEnd 회귀 테스트 → **FIX**.
- INFO #2(picker 리터럴 삽입=기존 정책)/#3(slice 매직넘버=기존 관행)/#4(isPlainRecord 유틸 부재)/#7(병합 케이스): 후속/무조치.

## 누락 reviewer (journal 확인, 전부 LOW/0 Critical)
- side_effect: LOW — VariablePicker 전파, 의도된 단일소스 설계, 신규 위험 없음.
- user_guide_sync: LOW — doc-sync matrix 매치 없음(순수 프론트 autocomplete).
- documentation: LOW — cross-ref 정확, "spec 변경 불필요" 타당. CHANGELOG 누락만 실질 갭.

## 스킵 reviewer
performance/architecture/dependency/database/concurrency/api_contract — 순수 프론트 문자열 매칭이라 해당 없음.
