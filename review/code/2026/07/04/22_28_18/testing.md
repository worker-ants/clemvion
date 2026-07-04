# 테스트(Testing) Review — orphan pending backstop (fresh re-review)

대상: `recoverOrphanPendingExecutions` 신규 도입 + `recoverStuckExecutions` early-return
제거. unit 3건(`execution-engine.service.spec.ts`) + e2e 2건
(`execution-concurrency-cap.e2e-spec.ts`) + e2e 헤더 시나리오 목록 갱신.

## 발견사항

- **[INFO]** unit `queuedAt` 필터는 값 자체(threshold 정확성)를 검증하지 않는다
  - 위치: `execution-engine.service.spec.ts` `'대기 한도 초과 pending(...) 을 markQueueWaitTimeout 으로 cancel 한다'` 테스트, `expect(findArg.where.queuedAt).toBeDefined()`
  - 상세: `find()` 호출 인자에서 `where.status`는 정확한 값(`ExecutionStatus.PENDING`)을 assert 하지만, `where.queuedAt`은 `LessThan` 연산자 래퍼 객체가 존재하는지만 확인하고 내부에 담긴 threshold 값(`Date.now() - resolveQueueWaitTimeoutMs()` 근사치)은 검증하지 않는다. `resolveQueueWaitTimeoutMs()`가 오동작하거나 threshold 계산이 부호가 뒤집혀도(`+`로 오타) 이 unit 은 잡지 못한다 — 다만 e2e 두 건(10분 경과 → cancelled, 1초 경과 → pending 유지)이 실제 threshold 동작을 실측하므로 회귀 시 e2e 레벨에서는 잡힌다.
  - 제안: 필수 아님(e2e 로 보완됨, 이미 SUMMARY 에 기록된 기지 사항). 여유가 되면 `findArg.where.queuedAt` 내부 `_value`(TypeORM `FindOperator`) 가 threshold 근방인지 근사 비교하는 assertion 을 추가하면 unit 단독으로도 회귀를 잡을 수 있다.

- **[INFO]** early-return 제거 회귀 테스트의 QueryBuilder mock 이 다소 장황하지만 의도는 명확
  - 위치: `'recoverStuckExecutions 는 stale running 0건이어도 orphan pending 스캔을 수행한다'` 테스트
  - 상세: `update/set/where/andWhere/returning/execute` 체인을 5단으로 직접 쌓아 `reclaimStuckRunningExecution`의 `createQueryBuilder().update().set().where().andWhere().returning().execute()` 호출 형태를 그대로 흉내낸다. 실제 프로덕션 코드와 메서드 체인 형태가 정확히 결합(coupled)돼 있어, 추후 `reclaimStuckRunningExecution`의 체인 호출 순서가 리팩터링되면(의미는 동일해도) 이 mock 이 깨질 수 있다. 다만 이는 프로젝트 전반에 이미 퍼진 관례(다른 QueryBuilder mock 들도 동일 패턴)이고, 이 테스트의 핵심 검증 대상(`redriveSpy not called` + `mqtSpy called with 'op'` + `releaseLock called`)은 명확해 가독성 자체는 양호하다. 결함이 아닌 참고 사항.
  - 제안: 변경 불필요.

- **[INFO]** e2e 신규 케이스의 margin 설계는 적절, 다만 threshold 경계값(정확히 8초 근처) 테스트는 없음
  - 위치: `execution-concurrency-cap.e2e-spec.ts` 신규 두 테스트 — `10 minutes`(초과) vs `1 second`(이내), e2e 타임아웃 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS=8000`
  - 상세: 두 값 모두 8초 threshold 와 충분히 벌어져 있어(600배 초과 / 8배 이내) flaky 없이 안정적으로 통과하는 좋은 선택이다. 반대로 정확히 threshold 부근(예: 7.9초 vs 8.1초) 경계 테스트는 없으나, 이는 e2e 특성상 타이밍 flakiness 유발 위험이 커 의도적으로 회피한 것으로 보이며 unit 레벨에서도 정밀 경계 검증은 없다(위 첫 항목 참고). CRITICAL/WARNING 아님 — e2e 에서 정밀 경계값을 강제하면 오히려 테스트 안정성을 해친다.
  - 제안: 변경 불필요.

- **[INFO]** "한도 이내 pending 은 건드리지 않는다" 테스트의 대기 후 단정이 다소 약함(redundant 이지만 의미 있음)
  - 위치: `'한도 이내 pending 은 recovery backstop 이 건드리지 않는다'` 테스트, `await new Promise((r) => setTimeout(r, 1000))` 후 `getStatus(freshId)`
  - 상세: `recoverStuck()`(test-hook POST)가 이미 `await`으로 동기 처리를 마친 뒤 반환하므로(hook 이 `runStuckRecoveryScan`을 await 하는 구조), 이후의 1초 sleep 은 이론적으로 불필요(SUMMARY 의 "미조치 INFO"에도 이미 기록됨). 그러나 sleep 이 있어도 테스트 실행 시간에 미미한 영향만 주고 오탐(false negative) 위험은 없다 — 오히려 "즉시 확인"보다 약간의 지연 후에도 상태가 안 바뀜을 재확인하는 방어적 여유로 볼 수 있어 무해하다.
  - 제안: 필수 아님. 정리하고 싶다면 sleep 제거 후 즉시 assert 로 단순화 가능(behavior 변경 없음).

- **[INFO]** admission-backstop 동시 경합(레이스)을 직접 재현하는 e2e/unit 은 없음
  - 위치: 전체 신규 테스트 스위트
  - 상세: `concurrency.md`(prior review) 가 이미 지적했듯, admission(`admitExecutionOrDefer`)이 같은 row 를 pending→running 으로 승격시키는 시점과 backstop 이 그 row 를 cancel 시도하는 시점이 겹치는 실제 동시 경합 시나리오를 재현하는 테스트는 unit/e2e 어디에도 없다. 안전성 근거는 `markQueueWaitTimeout`의 조건부 UPDATE(`WHERE status='pending'`)가 PR2b 에서 이미 검증된 자산이라는 점에 의존한다. 새로운 동시성 메커니즘을 도입하지 않고 기존 검증된 CAS 를 재사용하는 구조이므로 신규 회귀 위험은 낮지만, "같은 row 를 향한 admission 승격과 backstop cancel 이 동시에 일어나도 정확히 한쪽만 성공"이라는 속성 자체를 직접 검증하는 테스트는 부재하다.
  - 제안: 필수 아님(low-probability edge, boot-only 트리거라 실제 동시 경합 창이 매우 좁음). 필요시 후속으로 두 비동기 호출(가상 clock/fake timer 이용한 unit, 또는 e2e 상에서 admission tick 과 recoverStuck 호출을 인위적으로 겹치는 시나리오)을 추가할 수 있으나 현재 스코프에서는 과설계로 보인다.

CRITICAL/WARNING 급 발견 없음. 위 5건은 전부 INFO 수준 참고 사항이며 이미 이전 세션(22_12_26)의 SUMMARY/RESOLUTION 에서도 "미조치(기록) INFO"로 동일 항목이 다뤄진 바 있다 — 이번 fresh re-review 에서도 새로운 CRITICAL/WARNING 을 추가로 발견하지 못했다.

## 요약

신규 unit 3건은 `recoverOrphanPendingExecutions`의 핵심 분기(초과 pending → cancel, 초과 없음 → no-op, early-return 제거로 running 0건이어도 orphan 스캔이 항상 수행됨)를 정확히 겨냥해 diff 의 실질 변경점(early-return 제거)을 회귀 검증한다. `markQueueWaitTimeout`을 스텁 처리해 호출 여부·인자만 검증하는 것은 단위 테스트 격리 원칙에 부합하는 적절한 mock 범위이며, 실제 DB 조건부 UPDATE 의 원자성·race 안전성은 e2e 2건이 실제 Postgres row 삽입("job 없이 심은 pending")을 통해 실행 경로 전체(부팅 backstop → wait-timeout cancel → error.code 확인)를 검증해 mock 과 실제 동작 사이 괴리를 잘 메운다. 두 e2e 케이스는 threshold 대비 충분한 margin(10분/1초 vs 8초)을 둬 flaky 위험이 낮고, e2e 헤더의 시나리오 목록 갱신도 실제 추가된 테스트와 일치한다. top-level `beforeEach`가 `mockExecutionRepo`를 매 테스트 재구성하고 신규 describe 블록도 자체 `beforeEach`/`afterEach`로 spy 를 정리해 테스트 간 격리가 유지된다. 발견된 사항은 전부 INFO 수준(threshold 값 자체 미검증·동시 경합 직접 재현 테스트 부재 등)이며, 이는 기존 검증된 `markQueueWaitTimeout` CAS 재사용이라는 설계상 신규 동시성 리스크가 낮다는 점과 e2e 의 실측 커버리지로 상쇄된다. 전체적으로 diff 의 핵심 변경(early-return 제거 + 신규 orphan 스캔 메서드)에 대한 테스트 커버리지는 양호하다.

## 위험도

LOW

STATUS: SUCCESS
