# 테스트(Testing) 리뷰 — orphan pending backstop (§8)

## 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit, 신규 3케이스)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`recoverOrphanPendingExecutions` 신규 + `recoverStuckExecutions` early-return 제거)
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (e2e, 신규 2케이스)

## 발견사항

- **[INFO]** `queued_at IS NULL`(레거시 pre-V104 row) 제외 동작이 구현 주석으로만 서술되고 테스트로 검증되지 않음
  - 위치: `execution-engine.service.ts:2908` 주석 "queued_at IS NULL(레거시 pre-V104 row)은 LessThan 이 자연 제외한다" / `execution-engine.service.spec.ts` 신규 3케이스 어디에도 `queuedAt: null` row 케이스 없음
  - 상세: TypeORM `LessThan`은 SQL `<` 로 컴파일되고 SQL 3-value 논리상 `NULL < x`는 매치되지 않아 주석의 주장은 타당하나, 이는 실제 DB 세션 없이는(unit mock 은 `find()` 자체를 스텁하므로 SQL 의미론을 검증 못함) 검증 불가능한 영역이다. e2e 에도 `queued_at IS NULL` row 를 심는 케이스가 없다.
  - 제안: e2e 에 `queued_at`을 명시적으로 NULL 로 둔 pending row 를 추가로 심어 `recoverStuck()` 이후에도 `pending` 상태가 유지됨을 확인하는 케이스를 하나 추가하면 이 회귀 지점(예: 향후 query builder 리팩터링으로 `IS NOT NULL` 가드가 실수로 빠지는 경우)을 실제로 잡아낼 수 있다. 현재는 "낮은 확률 엣지"라는 설계 문서 서술을 그대로 신뢰하는 상태.

- **[INFO]** unit 테스트 1이 `where.queuedAt`을 `toBeDefined()`로만 검증 — `LessThan` operator/threshold 값 자체는 미검증
  - 위치: `execution-engine.service.spec.ts:1207-1213` (`대기 한도 초과 pending... cancel 한다`)
  - 상세: `findArg.where.queuedAt`이 `LessThan(...)` 인스턴스인지, 그 안의 임계값이 `resolveQueueWaitTimeoutMs()` 기반으로 "현재 시각 - 타임아웃"에 근접한지까지는 검증하지 않는다. 현재는 `find`가 통째로 mock 되어 있어 쿼리 조건의 정확한 의미(예: `LessThan` 대신 실수로 `MoreThan`을 쓰는 회귀)를 unit 이 못 잡고 e2e 만 최종 방어선이 된다.
  - 제안: `expect(findArg.where.queuedAt).toBeInstanceOf(LessThan(new Date()).constructor)` 류의 좀 더 구체적인 타입 단언을 추가하거나, threshold 값이 합리적 범위(예: `Date.now() - 5*60*1000` 근방)인지 재구성해 검증하면 unit 레벨에서 오류 방향을 더 빨리 좁힐 수 있다. 다만 e2e 가 실제 DB 로 이 경로를 최종 검증하므로 CRITICAL 은 아니다.

- **[INFO]** `recoverOrphanPendingExecutions`가 워크스페이스/워크플로 범위 없이 전역 스캔 — e2e 교차 오염 가능성 (설계상 의도된 전역 스캔이나 테스트 격리 관점에서 주의 필요)
  - 위치: `execution-engine.service.ts:2909-2915` (`this.executionRepository.find({ where: { status: PENDING, queuedAt: LessThan(...) } })`, workflow/workspace 필터 없음) / `execution-concurrency-cap.e2e-spec.ts` 신규 2케이스
  - 상세: 이 스캔은 스펙상 의도적으로 전역이다(§8 "재큐 job 소실"은 workflow 특정적이지 않음). 다만 현재 e2e 스펙 파일 안에서는 앞선 3개 테스트가 모두 `poll`로 종결 상태까지 진행한 뒤 종료하므로 신규 2케이스 시점에 잔여 `pending` row 가 없음을 확인했다 — 파일 내부적으로는 안전하다. 그러나 같은 DB 를 공유하는 다른 e2e 스펙 파일이 동시/순차 실행 중 `pending` Execution 을 남긴 상태로 걸쳐 있으면(예: 실패한 테스트로 인한 좀비 row), 이 전역 스캔이 그 row 까지 `cancelled` 로 마감시켜 그 다른 테스트의 기대와 충돌할 잠재적 여지가 있다.
  - 제안: 현재로선 실질 위험이 낮다고 판단되나(각 e2e 스펙이 자기 자원을 격리된 workflow/workspace 로 생성하고 종결시키는 관례를 따름), 향후 새 e2e 스펙에서 의도적으로 `pending` Execution 을 오래 남겨두는 패턴이 생기면 이 backstop 이 예기치 않게 그 row 를 회수할 수 있다는 점을 테스트 작성자에게 문서화(주석)해두면 좋다. 코드 수정은 불필요.

- **[INFO]** e2e "한도 이내 pending" 테스트는 `recoverStuck()` 호출 자체가 동기적으로 스캔을 완료한 뒤 202 를 반환하므로 이후 `setTimeout(1000)` 이 사실상 불필요 (타이밍 의존성 아님, 사족)
  - 위치: `execution-concurrency-cap.e2e-spec.ts:322-327` (`한도 이내 pending 은 recovery backstop 이 건드리지 않는다`)
  - 상세: `_test/recover-stuck-executions` 컨트롤러가 `await this.executionEngineService.runStuckRecoveryScan()`(내부적으로 `recoverStuckExecutions` → `recoverOrphanPendingExecutions`까지 완전히 await)한 뒤 202 를 반환하므로, `recoverStuck()` 이 resolve 된 시점에 이미 스캔·markQueueWaitTimeout 판정이 끝나 있다. 뒤이은 1초 sleep 은 실질적으로 아무 것도 검증하지 않으며(이미 끝난 스캔 결과를 재차 폴링 없이 한 번 더 조회할 뿐), 테스트 의도("일정 시간이 지나도 안 건드림")를 오해하게 할 여지가 있다.
  - 제안: CRITICAL 은 아니나, sleep 을 제거하거나 "동기 스캔이 이미 끝났음"을 주석으로 명확히 하면 가독성이 향상된다. 큰 문제는 아님.

## 커버리지 평가

- **unit 3종**: `recoverOrphanPendingExecutions`의 (a) 대상 필터(`status=PENDING`+`queuedAt LessThan`) → cancel 호출, (b) 빈 결과 no-op, (c) `recoverStuckExecutions`가 stale RUNNING 0건이어도 orphan 스캔을 계속 수행(이번 diff 의 핵심 회귀 지점인 early-return 제거)을 각각 정확히 짚었다. 특히 (c)는 실제 `createQueryBuilder` 체인(`update→set→where→andWhere→returning→execute`)을 실제 구현과 동일한 형태로 mock 해 `reclaimedIds.length===0` 경로를 충실히 재현하고, `redriveSpy).not.toHaveBeenCalled()` + `mqtSpy` 호출 + `releaseLock` 호출까지 검증해 이번 변경의 존재 이유(early-return 제거)를 직접 회귀 방지한다. 이는 mock 적절성·의도 표현이 우수하다.
- **e2e 2종**: 대기 초과(10분 age)는 8초 타임아웃 대비 충분한 여유로 확정적, 대기 이내(1초 age)도 8초 대비 충분한 여유로 확정적 — 플래키 위험은 낮다. `recoverStuck()` 이 스캔을 동기적으로 완료시키므로(컨트롤러가 await) `poll(..., 20_000)`은 사실상 즉시 만족되거나 이벤트 emit 지연만 흡수하면 된다 — 별도 age 조정 없이도 결정적이다.
- **idempotency/race with concurrent admit**: 이번 diff 는 별도 테스트를 추가하지 않았으나, `markQueueWaitTimeout`이 기존에 이미 존재하던(재사용) 조건부 UPDATE(`WHERE status='pending'`)이고 이 멱등성 자체는 이번 변경의 신규 표면이 아니라 PR2b 에서 이미 커버된 부분이다. 새로 추가된 `recoverOrphanPendingExecutions`가 이 기존 멱등 경로를 "재사용"하는 것 자체가 설계 결정(§8 rationale)이므로, admission 이 동시에 pending→running 전이를 시도하는 실제 동시성 경합까지 이번 신규 테스트가 명시적으로 커버하진 않는다. 다만 이는 기존 `markQueueWaitTimeout` 유닛/e2e(PR2b)가 이미 검증했을 개연성이 높고, 이번 diff 범위에서 반드시 재검증이 필요한 신규 리스크는 아니라고 판단(추가 권장은 INFO 로 위 항목에 포함하지 않음 — 별도 findings 없음).
- **queued_at NULL 제외**: 명시적 테스트 없음 — 위 INFO 항목으로 기록.

## 정합성(구현 vs 테스트)

- unit 테스트가 검증하는 필터 조건(`status=PENDING`, `queuedAt: LessThan(threshold)`, `select:{id:true}` 는 미검증이나 무해)과 실제 구현(`execution-engine.service.ts:2906-2923`)이 정확히 일치한다.
- unit 테스트가 스텁하는 `markQueueWaitTimeout`의 시그니처(`(id: string) => Promise<void>`)와 실제 private 메서드 시그니처가 일치하며, e2e 는 실제 `markQueueWaitTimeout` 전체 경로(조건부 UPDATE + `EXECUTION_CANCELLED` emit + `error.code`)를 그대로 관통해 검증한다 — unit(로직 분기)과 e2e(실제 부수효과) 역할 분담이 적절하다.
- `recoverStuckExecutions`의 lock 획득/해제(`continuationBus.acquireLock/releaseLock`) mock 이 실제 사용 패턴과 일치하고, `finally` 블록에서의 `releaseLock` 호출이 unit 테스트 3에서 검증되어 lock 누수 회귀를 방지한다.

## 요약

신규 unit 3종은 이번 diff 의 핵심 변경(orphan pending 스캔 추가 + early-return 제거로 인한 "stale RUNNING 0건이어도 계속 진행")을 정확한 mock 체인으로 충실히 검증하며, 특히 세 번째 케이스는 이번 PR 의 존재 이유 자체를 직접 회귀 방지한다. e2e 2종은 8초 타임아웃 대비 10분/1초라는 충분한 마진의 age 값을 사용해 타이밍 플레이키니스가 낮고, `recoverStuck()` 테스트훅이 스캔을 동기적으로 완료시킨 뒤 202 를 반환하는 구조 덕에 폴링도 결정적이다. 발견된 갭은 모두 INFO 수준(legacy `queued_at IS NULL` 제외 동작의 미검증, `LessThan` 값 자체의 unit 미검증, 전역 스캔의 잠재적 교차 오염 가능성, 사족성 sleep)이며, CRITICAL/WARNING 급 결함은 없다.

## 위험도

LOW
