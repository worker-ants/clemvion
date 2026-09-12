# 동시성(Concurrency) 리뷰

## 발견사항

해당 없음.

이번 변경 셋(`login-history.service.ts` / `background-runs.service.ts` 의 `decodeCursor` 에
`isUuidShaped(id)` 검증 추가, 관련 유닛/e2e 테스트, CHANGELOG·plan 문서)은 전부 다음 두 범주에
속하며 동시성 관점에서 검토할 표면이 없다.

1. **순수 동기 검증 로직 추가** — 두 `decodeCursor` 함수 모두 `async` 가 아니며, 인자로 받은
   지역 문자열(`raw`/`parsed.i`)만 읽어 형태를 검사하고 `null` 반환 또는 `throw` 하는 순수 함수다.
   공유 가변 상태·락·커넥션 풀·타이머 접근이 전혀 없다. `isUuidShaped` 자체도 정규식 매칭 함수로
   동기적이다 (`codebase/backend/src/common/utils/uuid.ts`).
2. **테스트 추가(unit/e2e)** — 신규 테스트는 모두 `async/await` 로 순차 실행되며(오히려 diff 주석이
   `.then()` 체이닝을 피하고 `async/await` 로 통일하라고 명시적으로 지적하고 있다 — 이미 반영됨),
   이 리뷰의 8개 관점(경쟁조건·데드락·동기화·스레드안전성·async 누락·원자성·이벤트루프·리소스풀링)
   중 새로 도입된 문제는 확인되지 않았다.

참고로 살펴본 인접 코드(이번 diff 범위 밖, 기존 코드) 중 동시성 관련 서술은 다음과 같으며 모두
**변경되지 않은 기존 로직**이라 이번 변경의 결함으로 보고하지 않는다:

- `login-history.service.ts` 최상단 docstring — `record()` 호출부는 반드시 `await` 해야 하고
  fire-and-forget 시 INSERT-before-SELECT 레이스가 재현된다는 기존 계약 문서. 이번 diff 는 이
  함수를 건드리지 않았고, `session-revocation.e2e-spec.ts` 테스트 E 가 이미 그 회귀를 캐너리로
  고정하고 있다.
- `background-runs.service.ts` `getBackgroundRun()` 의 `Promise.all([fetchBodyPage, aggregateBodyStatus,
  fetchNotifications])` (W-17 병렬화) — 세 조회가 서로 독립적이라는 기존 주석이 있고, 이번 diff 는
  `decodeCursor` 에 검증 분기 하나를 추가했을 뿐 이 병렬 구성을 바꾸지 않았다.
- e2e 테스트(`background-monitoring.e2e-spec.ts`, `session-revocation.e2e-spec.ts`)의 `db: Client`
  (pg 단일 커넥션)를 `describe` 블록 내 여러 `it` 이 순차 공유하는 기존 패턴 — Jest 는 같은
  describe 내 테스트를 순차 실행하므로 경쟁이 없고, 이번 diff 는 이 패턴을 그대로 따랐을 뿐이다.

## 요약

이번 변경은 keyset 커서의 `id` 성분에 대한 UUID-형태 검증(`isUuidShaped`)을 두 서비스의 동기
디코더 함수에 추가하고, 그에 대응하는 unit/e2e 테스트 및 plan/CHANGELOG 문서를 갱신한 것이 전부다.
공유 자원 접근, 락, 비동기 오케스트레이션, 커넥션/스레드 풀 구성 등 동시성에 영향을 주는 요소는
diff 범위에 없으며, 검토 결과 새로 도입된 동시성 결함은 없다.

## 위험도

NONE
