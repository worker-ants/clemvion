# Code Review 통합 보고서 (origin/main..HEAD rebased)

## 전체 위험도
**LOW** — `use-expression-suggestions.ts` 의 4개 중복 drill if-block(`$input.`/`$params.`/`$sourceItem.`/`$dataSource.`)을 `NESTED_DRILL_SOURCES` 테이블 + 단일 dispatch loop 로 통합한 behavior-preserving 순수 리팩터. 8 reviewer 전원 기존 56 테스트 전수 통과·line-level 대조로 회귀 없음 확인, **Critical 0 / Warning 1**.

## Critical
없음.

## WARNING (1) — 처분
| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| 1 | maintainability | `$sourceItem.`/`$dataSource.` `getSample` 이 옵셔널 필드를 `as Record` 강제 캐스팅, 안전성이 별도 `available` 게이트 평가 순서라는 타입 미강제 암묵 계약에 의존 | **FIX** — `available` 제거, `getSample` 반환 타입을 `Record<string,unknown> \| undefined` 로. loop 가 `sample === undefined` 를 fall-through 신호로 게이팅(타입 안전, 순서 의존 제거) |

## INFO — 처분
- testing #4: `$dataSource.nested.` drill 테스트 부재 → **FIX**(parity 테스트 추가).
- requirement #1: `$sourceItem`/`$dataSource` 트리거 spec §7.1/§8.4.2 미기재 → 수용(pre-existing, project-planner 백로그).
- perf #2 / maint #3/#5 / doc #6: prefix 순서·잔여 대칭 중복·gate pin·필드 JSDoc → 수용(저위험; getSample 통합으로 #3/#6 상당 완화).

## 스킵 reviewer
architecture/dependency/database/concurrency/api_contract/user_guide_sync — 단일 파일 내부 순수 리팩터라 해당 없음.
