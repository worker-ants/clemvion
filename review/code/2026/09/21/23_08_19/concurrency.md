# 동시성(Concurrency) Review

## 대상 파악

이번 diff 는 동시 요청 e2e 헬퍼 `raceUnderHeldLock`(`codebase/backend/test/helpers/concurrency.ts`)이
내부에 갖고 있던 **순수 동기 가드 두 개**(`fires.length < 2` 입력 검사, `VACUITY_GUARD_MS <
KNOWN_LOCK_TIMEOUTS_MS` 검사)를 `codebase/backend/src/shared/testing/overlap-preconditions.ts` 로
추출하고, 그 자리에 self-spec(`overlap-preconditions.spec.ts`)을 추가한 **동작 보존 리팩터링**이다.
`PROJECT.md`·plan 문서·`review/consistency/**` 산출물은 문서/거버넌스 변경으로 동시성 로직과 무관하다.

## 동작 보존 검증

- `assertEnoughFiresForOverlap(fires.length)` 호출 위치는 리팩터링 전과 동일하게 `raceUnderHeldLock`
  본문 최상단, `await locker.query('BEGIN')` **이전**이다 — 가드가 던져도 트랜잭션이 열리기 전이므로
  롤백 누락 위험이 없다. (`codebase/backend/test/helpers/concurrency.ts:78`, 그 다음 `locker.query('BEGIN')` 은 `:81`)
- `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS)` 호출도 모듈 최상위,
  기존 `for` 루프와 같은 위치에서 같은 조건(`>=`)으로 실행된다 (`codebase/backend/test/helpers/concurrency.ts:31`).
  모듈 로드 시 1회만 평가되는 top-level side effect이고 공유 가변 상태가 없어 Jest worker 간 경쟁
  소지가 없다.
- 두 함수(`overlap-preconditions.ts`)는 순수 동기 함수(공유 자원·I/O·await 없음)이므로 그 자체에는
  경쟁 조건·데드락·비동기 오용 여지가 없다. self-spec 의 경계값 테스트(`>=` vs `>`, 첫 항만 검사하는
  뮤턴트, 빈 목록 vacuous pass)도 모두 동기 `expect(...).toThrow()` 로 async 오용 패턴이 없다.
- `raceUnderHeldLock` 의 핵심 오케스트레이션(락 획득 → `Promise.all(fires)` 발사 → `Promise.race`
  로 공허성 관측 → `COMMIT`/`ROLLBACK` → `finally` 에서 `pending` rejection 흡수, 전체 라인
  `codebase/backend/test/helpers/concurrency.ts:71-108`)은 이번 diff 의 대상이 아니며, 실제로
  변경되지 않았다. 락 순서·await 배치·finally 의 unhandled-rejection 흡수 로직 모두 그대로다.

## 발견사항

- **[INFO]** `Promise.race` 패자(loser) 타이머 미정리 — 이번 diff 로 도입된 것은 아님
  - 위치: `codebase/backend/test/helpers/concurrency.ts:91-97` (전체 파일 컨텍스트 게이트 기준,
    `raceUnderHeldLock` 함수 내부 — 이 구간은 이번 diff 의 변경 라인이 아니라 unchanged 문맥이다)
  - 상세: `Promise.race([pending.then(...), new Promise(resolve => setTimeout(...))])` 에서
    `pending` 이 `VACUITY_GUARD_MS` 이전에 먼저 settle 되어 race 를 이기더라도, 진 쪽의
    `setTimeout` 은 `clearTimeout` 되지 않고 `VACUITY_GUARD_MS`(1.5s) 동안 살아 있다가 만료된다.
    기능적 결함은 아니고(핸들이 unref 되지 않아도 테스트 프로세스 종료를 막을 정도는 아님, 또한
    e2e 테스트 스위트가 이미 통과 중이라는 plan 의 실측과 상충하지 않음) 다만 e2e 블록이 9파일
    11곳에서 이 헬퍼를 반복 호출하므로 누적 타이머가 늘어난다. 이번 PR 의 스코프(순수 함수 추출)
    밖이라 diff 결함으로 보고하지 않지만, 관측한 사실은 규약상 보고한다.
  - 제안: 필요하면 별도 후속으로 `setTimeout` 핸들을 저장해 승자 확정 후 `clearTimeout` 하거나
    `AbortController` 로 정리. 이번 PR 을 막을 사유는 아니다.

- **[INFO]** 리팩터링 자체는 동시성 관점에서 순수 개선 — 가드 로직이 처음으로 unit 레벨에서
  실제로 실행·검증됨
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts`, `overlap-preconditions.spec.ts`
  - 상세: plan 문서(`plan/in-progress/race-helper-guard-tests.md`)의 실측대로, 종전에는 이 두 가드가
    `test/helpers/` 안에 있어 unit jest(`rootDir: 'src'`)와 e2e jest(`testRegex: '.e2e-spec.ts$'`)
    어느 러너에도 걸리지 않아 "코드로 고정"했다는 주장이 미검증이었다. `src/shared/testing/` 로
    옮기고 self-spec 을 추가해 이제 실제로 수집·실행된다(뮤턴트 4종 예측=실측 기록 포함). 동시성
    e2e 가 의존하는 "겹침을 실제로 만들었는가"를 보증하는 방어선의 신뢰도를 높이는 변경이라
    긍정적으로 평가한다.

## 요약

이번 변경은 동시 요청 e2e 헬퍼(`raceUnderHeldLock`)가 쓰는 두 개의 순수 동기 전제조건 가드를
테스트 가능한 위치로 추출하고 self-spec 으로 고정한 리팩터링으로, 실제 락 획득·발사·공허성
관측·커밋/롤백 오케스트레이션 로직은 한 글자도 바뀌지 않았다. 추출된 함수는 순수 함수(I/O·공유
상태·await 없음)라 그 자체로 경쟁 조건이나 데드락 여지가 없고, 호출 순서·조건(`>=`)도 리팩터링
전후 동일함을 확인했다. `raceUnderHeldLock` 내부에 patch 대상 밖의 사전 존재 이슈(승자가 확정돼도
타이머 loser 를 clearTimeout 하지 않는 사소한 자원 정리 누락)를 관측했으나 이번 diff 가 만든 것도
아니고 정확성에 영향을 주지도 않아 INFO 로만 기록한다. 신규로 도입된 경쟁 조건·데드락·동기화
결함은 없다.

## 위험도
LOW
