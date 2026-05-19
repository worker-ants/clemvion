# Code Review 통합 보고서

세션: `review/code/2026/05/19/09_38_26`
대상: `origin/main..HEAD` (requiredwhen-dsl-whitelist PR #204)

## 전체 위험도

**LOW** (즉시 fix 적용 후) — `requiredWhen` DSL 화이트리스트 정준화 자체는 안전. WARNING 6 중 6건 fix.

## Critical 발견사항

없음.

## 경고 (WARNING) — 처리 결과

| # | 항목 | 처리 |
|---|---|---|
| W-1 | `warningRule.when` 블랙리스트와 `requiredWhen` 화이트리스트 의미 불일치 | **FIXED** — switch.schema.ts 의 warningRules 주석에 "신규 mode 추가 시 두 곳 (requiredWhen.equals + warningRule.when) 동기화 필요" 명시. spec §8.2 step 4 도 동일 명문화 |
| W-2 | matchesVisible 의 equals 처리에 array 가드 부재 — array 전달 시 silent false | **FIXED** — matchesVisible JSDoc 에 "equals 는 strict equality only — array 화이트리스트는 oneOf 사용" 명시. requiredWhen 과의 비대칭 이유 함께 기록 |
| W-3 | config field 미설정 케이스 테스트 부재 | **FIXED** — visibility.test.ts 에 "requiredWhen returns false when the referenced field is missing from config" 단일/배열 2 케이스 추가 |
| W-4 | legacy notEquals/oneOf consumer grep 미실행 | **CONFIRMED OK** — `grep -rn "requiredWhen.*notEquals\|requiredWhen.*oneOf" codebase/` 결과 0건. legacy consumer 없음 |
| W-5 | JSDoc 인라인 날짜 이력 | **FIXED** — visibility.ts isFieldRequired JSDoc 의 "2026-05-19 정준화 —" 제거, spec cross-reference 로 대체 |
| W-6 | warningRule 주석 보강 | **FIXED** — W-1 와 함께 처리 (블랙리스트 유지 이유 + 신규 mode 추가 시 동기화 의무 명시) |

## 참고 (INFO) — 처리 결과

| # | 항목 | 처리 |
|---|---|---|
| I-1 | `equals: unknown \| readonly unknown[]` 타입 모호성 | TRACKED — 좁은 스칼라 유니온은 노드별 변경 비용 큼, 별 follow-up |
| I-2 | 에러 메시지에 item.id 포함 (위험 낮음) | OK |
| I-3 | `.passthrough()` 미정의 속성 허용 | OOS — 별 사안 |
| I-4 | visibleWhen / requiredWhen 타입 분리 권고 | TRACKED — visibleWhen 통합 정리 follow-up 시 함께 |
| I-5 / I-6 | node-component.interface.ts 구조 | OOS |
| I-7 / I-8 | 성능 (Set 전환 / 테스트 캐싱) | NOT NOW — 현재 size 작음 |
| I-9 | JSDoc 인라인 이력 중복 | **PARTIALLY FIXED** — visibility.ts 정리. switch.schema.ts/logic-ui-required.spec.ts 등 다른 파일은 "이유 + spec 참조" 형태로 유지 (의도된 추적성) |
| I-10 | sweep plan switch 적용 표 `notEquals` 잔존 | **FIXED** — `equals: ['value']` 로 갱신 + 마이그레이션 메모 |
| I-11 | requiredwhen plan 의 spec §8 링크 누락 | **FIXED** — §관련 문서 에 spec §8 Rationale + ai-review/consistency 산출물 링크 추가 |
| I-12 | matchesRequired JSDoc 부재 | **FIXED** — JSDoc 추가 (single value vs whitelist array 명시) |
| I-13 | 한·영 주석 혼재 | OOS — 프로젝트 정책 부재 |
| I-14 | UiHint 직렬화 의도 JSDoc | TRACKED — 별 follow-up |
| I-15 | 테스트 설명 한·영 혼재 | **FIXED** — "equals whitelist with empty array" 영문 통일 |
| I-16 | plan I-2 추적 불일치 | **FIXED** — W-1 처리로 warningRule 주석에 명시, plan 별 follow-up 으로 명시 분리 불요 |

## 라우터 결정

10명 실행: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract.
제외: dependency, database, concurrency.

## 에이전트별 위험도

| reviewer | 위험도 | 핵심 |
|---|---|---|
| security | LOW | INFO 5 |
| performance | NONE | matchesRequired O(1) |
| architecture | LOW (was MEDIUM) | W-1/W-2 fix |
| requirement | LOW | W-1 fix, I-16 OK |
| scope | LOW | W-1/W-6 fix |
| side_effect | LOW | W-1/W-2 fix |
| maintainability | LOW | W-1/W-6 fix |
| testing | LOW | W-3/W-4 fix |
| documentation | LOW | W-5/W-6 fix |
| api_contract | NONE | 0건 |

## 본 PR 처리 결과

- WARNING 6 → 6 fix
- INFO 16 → 6 fix + 10 OK/별 follow-up
- 테스트: backend 89 pass + frontend 14 pass (+1 신규 케이스)
