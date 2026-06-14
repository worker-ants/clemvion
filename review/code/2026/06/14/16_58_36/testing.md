# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `RECONCILE_TERMINAL_STATUSES` 상수 rename — 단언값 불일치 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L341-348 (reconcileTerminalRevocations 테스트 내 `.where` 단언)
- 상세: 이번 diff 에서 `TERMINAL_STATUSES` 가 `RECONCILE_TERMINAL_STATUSES` 로 rename 되었다. 해당 상수는 `terminal` 파라미터로 QueryBuilder 에 전달되며, 테스트는 `expect.arrayContaining(['completed', 'failed', 'cancelled'])` 로 값 수준 단언을 한다. rename 자체는 `where` 파라미터 객체의 `terminal` 프로퍼티에 담기는 배열 값을 변경하지 않으므로 기존 테스트가 그대로 유효하다. 회귀 보호에 이상 없음.
- 제안: 없음.

### [INFO] `MONITORED_QUEUES` 등록 + e2e 목록 갱신 — 테스트 커버리지 추가 완료
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` + `codebase/backend/test/system-status.e2e-spec.ts` L37
- 상세: 이번 diff 에서 `MONITORED_QUEUES` 에 `{ name: TERMINAL_REVOKE_RECONCILE_QUEUE, group: 'system', concurrency: 1 }` 가 추가되었고, e2e `EXPECTED_QUEUE_NAMES` 배열에도 `'terminal-revoke-reconcile'` 이 추가됐다. e2e spec 은 실제 BullMQ API 응답의 큐 이름 목록과 `EXPECTED_QUEUE_NAMES` 를 정렬 후 엄격 동등 비교(`toEqual`) 한다. 신규 큐가 양쪽 모두에 등록되어 e2e 가 새 큐를 정확히 검증한다. 이전 일관성 리뷰(16_28_07 naming_collision WARNING)에서 지적된 모니터링 레지스트리·e2e 목록 미등록 항목이 이번 diff 로 해소됐다.
- 제안: 없음.

### [INFO] `reconcile()` 직접 호출 테스트 — process() 경유 커버리지와 중복이나 설계 의도 부합
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts` L71-87
- 상세: `reconcile()` 직접 호출 성공·throw swallow 테스트 2건이 이전 diff 에서 추가됐다. `process({} as never)` 경유 테스트(L52-69)가 이미 동일 코드 경로를 커버하므로 커버리지 중복이다. 단, JSDoc 에 "public 인 것은 단위 테스트가 직접 호출해 fail-open 동작을 검증하기 위함" 이라고 명시되어 있어 설계 의도에 부합한다. 향후 `reconcile()` 을 `private` 으로 변경할 경우 이 테스트들은 `process()` 경유 방식으로 전환이 필요하다.
- 제안: 없음 (설계 의도에 따른 중복 — 허용).

### [INFO] 다중 청크 경계 시나리오 테스트 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — reconcileTerminalRevocations describe 블록
- 상세: `RECONCILE_CONCURRENCY=20` 기반 bounded-concurrency 병렬 처리가 도입되었으나, 현재 테스트는 최대 2건(`exec-1`, `exec-2`) 수준으로 단일 청크(20건 이하) 내에서만 동작한다. 21건 이상의 executionId 로 다중 청크가 실행될 때 `swept`/`revoked` 집계가 정확한지 검증되지 않는다. 이전 리뷰(16_17_36 testing.md I11) 에서 제기된 갭이 이번 diff 에도 미해소다.
- 제안: `RECONCILE_CONCURRENCY`(20)를 초과하는 executionId 목록(예: 25건)으로 다중 청크 처리 시 `swept`/`revoked` 집계가 정확한지 테스트 1건 추가 (선택).

### [INFO] batchLimit 하한값(0 이하 → 1) clamp 테스트 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L361-370
- 상세: `batchLimit` 상한 clamp(999_999 → 1000) 테스트는 추가됐으나, 하한(0 이하 입력 → 1) clamp 테스트가 없다. 구현에서 `Math.max(1, Math.floor(batchLimit))` 로 하한 방어가 명시되어 있으므로 대칭적 테스트가 바람직하다. 이전 리뷰(16_17_36 testing.md I12) 에서 제기된 갭이 미해소다.
- 제안: `reconcileTerminalRevocations(0)` 또는 `reconcileTerminalRevocations(-1)` 호출 시 `qb.limit` 이 1 로 호출되는지 검증하는 테스트 추가 (선택).

### [INFO] 만료 토큰 테스트의 `repo.delete` 호출 단언 누락
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L372-388
- 상세: "만료된 jti(ttl<=0) 는 revoked 에 미집계" 테스트에서 `redis.set` 미호출을 단언하지만, `repo.delete` 가 여전히 호출되는지 단언이 없다. 만료 토큰도 DB 에서 삭제되어야 함을 명시적으로 검증하지 않아 `revokeAllForExecution` 의 내부 동작(SET 스킵 → DELETE 여전히 실행) 이 완전히 검증되지 않는다. 이전 리뷰(16_17_36 testing.md I13) 에서 제기된 갭이 미해소다.
- 제안: `expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-1' })` 단언 추가 (선택).

### [INFO] `onModuleInit` 테스트 — job opts age 상수값 검증 없음
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts` L36-44
- 상세: `onModuleInit` 테스트가 `upsertJobScheduler` 호출 여부와 `pattern: '* * * * *'` 를 검증하지만, `removeOnComplete`/`removeOnFail` age 값이 올바른 상수값(`86400`/`604800`)으로 전달되는지 단언하지 않는다. 상수가 `REMOVE_ON_COMPLETE_AGE_SEC = 24 * 60 * 60` 으로 추출되었으나 job opts 검증이 없어 오타/값 변경에 대한 회귀 보호가 없다. 이전 리뷰(16_17_36 testing.md I14) 에서 제기된 갭이 미해소다.
- 제안: `expect(queue.upsertJobScheduler).toHaveBeenCalledWith(..., expect.objectContaining({ opts: { removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } } }))` 단언 추가 (선택).

### [INFO] 테스트 격리 — redis mock 공유 + clearMocks 암묵적 의존
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — reconcileTerminalRevocations describe 블록
- 상세: `redis` mock 객체가 상위 스코프에서 공유되며 각 테스트 간 상태 초기화는 Jest 설정의 `clearMocks` 에 의존한다. 만료 토큰 테스트에서 `redis.set.mockResolvedValue('OK')` 후 `not.toHaveBeenCalled()` 를 단언하는데, 이는 `clearMocks: true` 설정 가정에 기반한다. `makeQB`/`makeService` 헬퍼가 테스트 간 독립 repo mock 을 구성해 사이드 이펙트 격리는 양호하나, redis mock 공유가 잠재적 교란 요인이다.
- 제안: Jest 설정 파일에 `clearMocks: true` 가 명시되어 있다면 현행 유지 가능. 불명확하다면 `beforeEach(() => { redis.set.mockClear(); redis.get.mockClear(); })` 추가 (선택).

## 요약

이번 변경의 테스트 관점 핵심은 두 가지다: (1) `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` rename 이 기존 단위 테스트의 값 수준 단언(`arrayContaining`)에 영향을 주지 않아 회귀 보호가 유지된다. (2) `MONITORED_QUEUES` 등록 + e2e `EXPECTED_QUEUE_NAMES` 동기화가 함께 이루어져 이전 일관성 리뷰의 WARNING 이 해소됐고, 신규 BullMQ 큐에 대한 e2e 커버리지가 확보됐다. 나머지 테스트 갭(다중 청크 경계·batchLimit 하한 clamp·만료 토큰 delete 단언·job opts age 검증)은 이전 리뷰(16_17_36)에서 INFO 수준으로 제기된 항목들로, 이번 diff 의 변경 범위(상수 rename + `MONITORED_QUEUES`/e2e 등록)가 이들을 직접 수정 대상으로 포함하지 않아 미해소 상태로 유지된다. 모두 선택 보강 항목이며 핵심 기능 경로는 기존 테스트가 커버하고 있다. CRITICAL·WARNING 수준의 테스트 결함은 없다.

## 위험도

LOW
