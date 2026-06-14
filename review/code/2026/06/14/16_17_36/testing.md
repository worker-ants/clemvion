# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] reconcile() 직접 호출 테스트 — process() 경유 중복 커버리지
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts` L71-87
- 상세: 이번 변경에서 추가된 `reconcile()` 직접 호출 테스트 2건(성공/throw swallow)은 의도한 fail-open 동작을 잘 검증한다. 단, `process({} as never)` 경유 테스트(L52-69)가 이미 동일 코드 경로를 커버하고 있어 커버리지 측면에서는 중복이다. `reconcile()` public 메서드 공개 이유(JSDoc에 명시)가 단위 테스트 직접 호출이므로 추가 테스트는 설계 의도에 부합하며, 두 방향 검증이 회귀 보호 측면에서 해롭지 않다.
- 제안: 현재 구조 유지 가능. 향후 `reconcile()` 을 `private` 으로 변경할 경우(아키텍처 리뷰 제안 반영 시) 이 테스트들은 `process()` 경유 방식으로 전환 필요.

### [INFO] bounded-concurrency 병렬 처리 경로의 실제 병렬 실행 테스트 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` reconcileTerminalRevocations describe 블록
- 상세: `reconcileTerminalRevocations`가 `RECONCILE_CONCURRENCY=20` 단위로 `Promise.allSettled` 청크 병렬 처리로 변경되었으나, 현재 테스트들은 2건(exec-1, exec-2) 수준이라 단일 청크(≤20건) 내에서만 동작한다. 청크 경계를 넘는 시나리오(예: 21건 이상)에 대한 테스트가 없어 다중 청크 처리 시 `revoked` 집계가 올바른지 검증되지 않는다. 실제 오작동 가능성은 낮으나(청크 순회 로직이 단순) 커버리지 갭이다.
- 제안: `RECONCILE_CONCURRENCY`(20)을 초과하는 executionId 목록(예: 25건)으로 다중 청크 처리 시 `swept`/`revoked` 집계가 정확한지 테스트 1건 추가.

### [INFO] batchLimit 하한값(1) clamp 테스트 누락
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L361-370
- 상세: `batchLimit` 상한(999_999 → 1000) clamp 테스트는 추가되었으나, 하한(0 이하 입력 → 1) clamp 테스트가 없다. 구현에서 `Math.max(1, Math.floor(batchLimit))` 로 하한 방어가 명시되어 있으므로 대칭적 테스트가 바람직하다.
- 제안: `reconcileTerminalRevocations(0)` 또는 `reconcileTerminalRevocations(-1)` 호출 시 `qb.limit`이 1로 호출되는지 검증하는 테스트 추가.

### [INFO] batchLimit 소수(float) 입력 floor 처리 테스트 없음
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` safeLimit 계산부
- 상세: `Math.floor` 적용이 구현에 있으나 테스트에서 `1.7`, `500.9` 등 소수 입력에 대한 케이스가 없다. 타입스크립트 시그니처가 `number`이므로 소수가 진입할 수 있다.
- 제안: INFO 수준. 현 사용 경로(BullMQ job에서 고정 기본값 사용)에서 실질 위험 없음. 선택적 추가.

### [INFO] 만료 토큰 테스트의 delete 호출 단언 누락
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L372-388
- 상세: "이미 만료된 jti(ttl<=0)는 revoked 에 미집계" 테스트에서 `redis.set`이 호출되지 않음을 검증하지만, `repo.delete`가 여전히 호출되는지(만료 토큰도 DB에서 삭제되어야 함) 단언이 없다. `revokeAllForExecution`의 내부 동작(SET 스킵 → DELETE 여전히 실행)이 명확히 검증되지 않는다.
- 제안: `expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-1' })` 단언 추가로 만료 토큰의 DB 정리가 실행됨을 명시적으로 확인.

### [INFO] 테스트 격리 — makeQB/makeService 헬퍼의 redis mock 공유
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — reconcileTerminalRevocations describe 블록 전체
- 상세: `redis` mock 객체가 상위 스코프에서 공유되며, `clearMocks` 설정에 의존해 각 테스트 간 상태가 초기화된다. 만료 토큰 테스트에서 `redis.set.mockResolvedValue('OK')`를 설정했으나 `not.toHaveBeenCalled()`를 단언하는데, 이는 `clearMocks`가 각 테스트 전에 호출 기록을 초기화한다는 가정에 의존한다. Jest 설정에 `clearMocks: true`가 설정되어 있다면 안전하지만, 해당 설정 유무가 spec 파일 자체에서 명확히 보이지 않는다.
- 제안: 명시적 `beforeEach(() => { redis.set.mockClear(); })` 추가 또는 Jest 설정에 `clearMocks: true` 문서화. 현재는 INFO 수준으로 동작상 문제 없음.

### [INFO] TerminalRevokeReconcilerService 테스트 — job opts 상수값 검증 없음
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts` L36-44
- 상세: `onModuleInit` 테스트가 `upsertJobScheduler` 호출을 검증하지만 `removeOnComplete`/`removeOnFail` age 값이 올바른 상수값으로 전달되는지 단언하지 않는다. 상수가 `REMOVE_ON_COMPLETE_AGE_SEC = 24 * 60 * 60`으로 추출되었으나 job opts 검증이 없어 오타/값 변경에 대한 회귀 보호가 없다.
- 제안: `expect(queue.upsertJobScheduler).toHaveBeenCalledWith(..., expect.objectContaining({ opts: { removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } } }))` 단언 추가.

## 요약

이번 변경에서 테스트 커버리지는 전반적으로 양호하다. `batchLimit` 상한 clamp, 만료 토큰 처리, `reconcile()` 직접 호출 fail-open, QueryBuilder `.select`/`.distinct`/`.limit` 체이닝 단언이 이번 변경으로 신규 추가되어 이전 리뷰에서 지적된 갭 대부분이 해소되었다. `Promise.allSettled` 기반 bounded-concurrency 병렬화로 구현이 변경되었으나 단일 청크(≤20건) 범위 내에서만 테스트가 이루어지고 있어 다중 청크 경계 케이스 검증이 남아있다. 또한 `batchLimit` 하한 clamp, 만료 토큰의 DB delete 실행 여부 단언, job opts 상수값 검증 등 소규모 갭이 존재하지만 모두 INFO 수준이며 즉각적 품질 위험은 없다. 테스트 격리는 공유 redis mock에 대한 암묵적 clearMocks 의존 외에 별다른 문제가 없고, 각 테스트는 독립적으로 실행 가능한 구조다. 테스트 가독성은 한국어 설명과 명확한 단언으로 의도 전달이 잘 된다.

## 위험도

LOW
