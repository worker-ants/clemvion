# 동시성(Concurrency) 코드 리뷰

## 범위

이번 diff 는 프로덕션 코드 변경이 **0**이고, 아홉 개 e2e 동시성 테스트 파일에 손으로 복제돼 있던
`BEGIN → 락 쿼리 → 두 요청 발사 → 1.5초 공허성 가드(`Promise.race`) → COMMIT → 결과 반환,
`finally`: `ROLLBACK` + pending 흡수` 블록을 `codebase/backend/test/helpers/concurrency.ts` 의
`raceUnderHeldLock()` 로 추출하는 순수 리팩터다. 각 호출부 diff 는 인라인 코드를 헬퍼 호출로
치환할 뿐, 단언(assertion)·정렬 로직·발사 함수 반환 타입은 그대로 남아 있다.

## 검증 방법

10개 호출부(`auth-config-`, `integration-`, `member-remove-`(2블록), `model-config-`,
`schedule-`, `trigger-`, `webauthn-credential-`(2블록), `workflow-`, `workspace-delete-concurrency`)
의 diff 를 원본(삭제된 인라인 블록)과 신규 헬퍼 호출을 줄 단위로 대조했다. 저장소 파일은
건드리지 않았다(`git status --short` 로 확인할 변경 없음 — read-only 리뷰).

## 발견사항

- **[INFO]** 공허성 가드 대기시간(`VACUITY_GUARD_MS`)이 파일별 리터럴에서 헬퍼의 단일 모듈
  상수로 전역화됨
  - 위치: `codebase/backend/test/helpers/concurrency.ts:87` (`const VACUITY_GUARD_MS = 1_500;`),
    사용처는 같은 파일 `concurrency.ts:67` (`setTimeout(() => resolve('pending'), VACUITY_GUARD_MS)`)
  - 상세: 리팩터 전에는 각 호출부가 자신의 락 타임아웃(트리거 삭제 경로 `lock_timeout` 5초 등)에
    맞춰 `1_500` 을 별도로 하드코딩했다. 현재 9파일 11블록 전부 애플리케이션측 타임아웃이
    1.5초보다 충분히 크므로(가장 타이트한 것도 5초) 지금 당장은 안전하다. 다만 이제 이 값은
    **호출부별로 오버라이드할 수 없는 전역 상수**가 됐다 — 향후 락 타임아웃이 1.5초에 근접하거나
    더 짧은 열 번째 호출부가 추가되면, 가드가 대기하는 동안 요청이 "겹침 실패"가 아니라
    "애플리케이션 타임아웃"으로 먼저 정착(settle)해 `raced === 'settled'` 로 오탐(공허성 가드
    통과 실패)이 날 수 있다 — 이는 정확히 헬퍼 자신의 JSDoc(`concurrency.ts:61-63`)이 경고하는
    실패 모드이며, 그 경고가 파일별 상수에서 공유 상수로 바뀌며 "호출부가 그 전제를 스스로
    검증할 방법이 없다"는 형태로 바뀌었다.
  - 제안: 현재 9개 호출부에는 결함이 아니다(전부 문서화된 마진 안에 있음, `plan/in-progress/e2e-race-helper.md` §B 의 음성 대조군 실측으로도 11블록 전부 가드가 살아 있음을 확인). 다만 열 번째
    호출부를 추가할 사람을 위해, `raceUnderHeldLock()` 에 `guardMs` 같은 선택적 파라미터를
    허용하거나(기본값 1_500 유지), JSDoc 에 "새 호출부의 락 타임아웃이 1.5초에 근접하면 이
    상수를 조정해야 한다"는 체크 항목을 명시적으로 남기는 편이 안전하다.

## 확인했으나 결함 아닌 것 (근거만 기록)

- **발사 타이밍 보존**: 원본 `[fireDelete(), fireDelete()]`(배열 리터럴, 두 호출이 같은 tick 에
  동기적으로 평가됨) 대비 신규 `fires.map((fire) => fire())`(`Array.prototype.map` 도 콜백을
  순서대로 동기 실행) — 두 방식 모두 동일한 tick 에 순서대로 실행되어 발사 타이밍·순서에
  관측 가능한 차이가 없다.
- **락 획득 → 발사 순서**: 모든 호출부에서 `await locker.query(lock.sql, lock.params)` 완료 후에만
  `fires` 가 실행된다(추출 전후 동일) — 락 없이 요청이 먼저 나가는 경로 없음.
- **COMMIT/ROLLBACK 이중 실행**: `finally` 의 `ROLLBACK` 은 이미 `COMMIT` 을 탄 경로에서도 항상
  실행되지만, PostgreSQL 은 활성 트랜잭션이 없을 때의 `ROLLBACK` 을 에러 없이 no-op 처리하므로
  (`concurrency.ts:75-76` 주석의 전제) 안전하다 — 이는 추출 전 9개 파일 각각의 `finally` 블록에서도
  동일하게 존재하던 패턴이라 이번 추출이 만든 새 위험이 아니다.
- **unhandled rejection 흡수**: `fireDelete()` 계열 함수는 전부 `.then(onFulfilled, onRejected)`
  형태로 네트워크 오류까지 `{status:-1,...}` 값으로 변환하므로 `Promise.all(fires.map(...))` 자체가
  reject 하는 경로가 사실상 없고, 혹시 있더라도 `pending?.catch(() => undefined)` 가 흡수한다 —
  추출 전후 동일.
- **제네릭 스레딩**: 호출부마다 다른 발사 결과 타입(`number` / `{status}` / `{status, code}`)이
  `raceUnderHeldLock<T>` 의 `T` 로 올바르게 통과하고, 정렬 로직(`.sort(...)`)은 헬퍼가 아니라
  호출부에 남아 있다(헬퍼 JSDoc 이 명시한 설계 그대로) — 여러 파일이 서로 다른 정렬 기준을
  써도 안전하다.
- **가드 실패 시 트랜잭션 누수 없음**: `fires.length < 2` 가드는 `BEGIN` 이전에 동기적으로
  throw 하므로, 잘못된 호출(단일 thunk)이 열린 트랜잭션을 남기지 않는다.
- **음성 대조군(작업 plan `e2e-race-helper.md` §체크리스트)**: 락 쿼리를 제거하는 뮤턴트로
  11블록 전부 RED(정확히 `expect(raced).toBe('pending')` 실패, `Received: "settled"`)를 관측했다는
  기록이 있어 — 추출된 헬퍼에서도 공허성 가드가 죽지 않았다는 것을 뒷받침한다. (본 리뷰는
  저장소를 뮤테이션하지 않았으므로 이 결과는 직접 재현하지 않았고 plan 문서의 기재를
  그대로 인용한 것이다.)

## 요약

프로덕션 코드 변경이 없는 순수 테스트 헬퍼 추출이며, 원본 인라인 블록(락 획득 순서·발사
타이밍·`Promise.race` 공허성 가드·`finally` 의 `ROLLBACK`+pending 흡수)이 헬퍼로 그대로
이동했을 뿐 동시성 관련 동작 변화는 관측되지 않았다. 유일한 주목할 점은 가드 대기시간이
파일별 리터럴에서 전역 상수로 바뀌어, 현재 9개 호출부에는 안전하지만 향후 락 타임아웃이
더 짧은 호출부가 추가될 경우 파라미터화 부재로 공허성 가드가 조용히 무의미해질 수 있다는
확장성 관점의 INFO 사항이다. Critical/Warning 급 결함은 발견하지 못했다.

## 위험도

LOW
