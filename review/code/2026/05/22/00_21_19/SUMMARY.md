# Code Review 통합 보고서

Session: `review/code/2026/05/22/00_21_19`
Branch: `claude/llm-retry-after-a24e5e`
Date: 2026-05-22

## BLOCK: NO

## 전체 위험도

**LOW** — 보안·기능·범위·동시성 관점에서 CRITICAL/HIGH 이슈 없음. 테스트 커버리지 갭(경계값·예외 경로) 및 React updater 패턴 위반이 WARNING 수준으로 존재하며, 일부 유지보수성 개선이 권장된다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `setTimeout` spy assertion 이 호출 순서를 특정하지 않아 향후 오탐 여지 있음 (`toHaveBeenCalledWith` 사용) | `llm.service.spec.ts` 신규 테스트 3건 | `toHaveBeenNthCalledWith(1, ...)` 또는 `toHaveBeenLastCalledWith(...)` 로 순서 명시 |
| 2 | 테스트 | cap 경계값(60s 미만) 케이스 미검증 | `llm.service.spec.ts` `it('caps Retry-After...')` | `Retry-After: '59'` → 59_000ms, `'60'` → 60_000ms |
| 3 | 테스트 | `'rate limit'` 문자열 분기 검증 케이스 없음 | `llm.service.spec.ts` `describe('withRetry')` | `'rate limit exceeded'` 메시지 에러로 retry 동작 확인 |
| 4 | 테스트 | max-retry 소진 후 throw, non-429 에러 즉시 throw 경로 미검증 | `llm.service.spec.ts` `describe('withRetry')` | 3회 연속 rate-limit 에러 / non-rate-limit 에러 즉시 throw |
| 5 | 테스트 | `handleClickOutside` 경로에서 `closeNotif()` 로 닫힐 때 필터 리셋 미검증 | `sidebar.tsx` · `sidebar.test.tsx` | `fireEvent.mouseDown(document.body)` 후 popover 재열기 시 filter `"all"` 확인 |
| 6 | 동시성 / 부작용 | `toggleNotif` 내 `setNotifOpen` updater 함수 안에서 `setNotifFilter("all")` 호출 — React 순수 updater 원칙 위반 | `sidebar.tsx` `toggleNotif` useCallback | `setNotifOpen`과 `setNotifFilter`를 updater 밖에서 순차 호출 |
| 7 | 요구사항 | `useEffect` 의존성 배열에 `closeNotif` 누락 — `exhaustive-deps` 위반 | `sidebar.tsx` `handleClickOutside` useEffect | deps 배열에 `closeNotif` 추가 |
| 8 | 유지보수성 | 테스트 픽스처(`config`/`params`) 및 성공 응답 객체 리터럴이 3개 케이스에 중복 선언 | `llm.service.spec.ts` `describe('Retry-After header behavior')` | describe 상단에 공통 `retryConfig`, `successResponse` 추출 |
| 9 | 범위 | `sidebar.tsx` 수정이 plan 명시 범위 밖에 있어 추적 가능성 낮음 | `plan/in-progress/llm-retry-after.md` | plan 에 §ISSUE FIX 섹션 추가 |

## 참고 (INFO)

14건 — 상세는 각 reviewer 출력 참조 (security/requirement/scope/side_effect/maintainability/testing/concurrency).

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/High 취약점 없음 |
| requirement | LOW | `closeNotif` deps 누락 WARNING 1건 + spec 동기화 갭 INFO |
| scope | LOW | sidebar 수정 §ISSUE FIX 추적 보강 권장 |
| side_effect | LOW | `toggleNotif` updater 내 setState 호출 패턴 |
| maintainability | LOW | 테스트 픽스처 중복 |
| testing | MEDIUM | 4건 (cap 경계·rate limit 문자열·종단 경로·외부 클릭 회귀) |
| concurrency | LOW | toggleNotif updater (side_effect 와 동일) |

## 라우터 결정

`routing_status=done` — 14개 reviewer 중 7개 선별 실행.

- **실행**: security, requirement, scope, side_effect, maintainability, testing, concurrency (router_safety 강제)
- **Skip**: performance, architecture, documentation, dependency, database, api_contract, user_guide_sync

## 권장 조치

자동 fix 처리됨 — `RESOLUTION.md` 참조. W2~W5, W8 은 후속 plan `plan/in-progress/llm-retry-after-test-coverage.md` 로 이관.
