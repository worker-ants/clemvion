## 발견사항

### [CRITICAL] `acquireLock` 완전 미테스트
- **위치**: `continuation-bus.service.spec.ts` 전체
- **상세**: `ContinuationBusService.acquireLock()`은 분산 recovery 정합성의 핵심 메서드임에도 `continuation-bus.service.spec.ts`에 단 한 건의 테스트도 없다. Redis `SET key value EX ttl NX` → `'OK'` / `null` 매핑, TTL 파라미터 전달 여부, publisher connection을 사용하는지 여부 모두 미검증.
- **제안**: `acquireLock` describe 블록 추가 — 반환 `'OK'` → `true`, 반환 `null` → `false`, NX/EX 옵션이 publisher에 올바른 인수로 전달되는지 spy 검증

---

### [CRITICAL] `findById`의 `executionPath` 신규 조회 경로 미테스트
- **위치**: `executions.service.spec.ts` — `findById` 관련 케이스 부재
- **상세**: `executions.service.ts`의 `findById`가 `executionNodeLogRepository.find({ where, order: { id: 'ASC' }, select: { nodeId: true } })`를 호출해 `executionPath`를 채우는 핵심 신규 경로가 `executions.service.spec.ts`에서 전혀 테스트되지 않는다. `executionNodeLogRepo` mock은 생성되어 주입되지만 어떤 테스트도 이를 검증하지 않는다.
- **제안**: `findById` describe 추가 — ① `executionNodeLogRepo.find` 호출 시 `{ where: { executionId }, order: { id: 'ASC' } }` 인수 확인, ② 반환 rows의 `nodeId` 배열이 응답 `executionPath`와 일치하는지 확인, ③ log rows가 비어있을 때 `executionPath: []` 반환 확인

---

### [WARNING] `select: { nodeId: true }` + `order: { id: 'ASC' }` 조합의 TypeORM 동작 미검증
- **위치**: `executions.service.ts:110`
- **상세**: TypeORM `find()`에서 `select: { nodeId: true }`로 `id`를 SELECT에서 제외하면서 `order: { id: 'ASC' }`를 적용하는 조합. SQL 레벨에서는 ORDER BY와 SELECT가 독립적이므로 동작하나, TypeORM 버전에 따라 SELECT 목록에 없는 컬럼의 ORDER BY가 쿼리 빌더 메타데이터 lookup 실패를 유발할 수 있다 (기존 `orderBy(snake_case)` 버그와 유사한 경로). 단위 테스트의 mock은 이 동작을 전혀 검증하지 못한다.
- **제안**: `find()` 인수 검증 테스트를 추가하고, 통합 테스트 또는 e2e에서 실제 쿼리 실행 확인

---

### [WARNING] `appendExecutionPath` 에러 핸들링(catch 블록) 미테스트
- **위치**: `execution-engine.service.spec.ts` — `appendExecutionPath` 관련 케이스 부재
- **상세**: 리팩토링된 `appendExecutionPath`의 catch 블록(insert 실패 시 warn 로그 후 계속 진행)이 테스트되지 않는다. 이 경로는 실행 흐름을 중단시키지 않는 best-effort 설계이므로 반드시 검증되어야 한다.
- **제안**: `mockExecutionNodeLogRepo.insert.mockRejectedValueOnce(new Error('DB error'))`로 insert 실패를 시뮬레이션 → 실행 흐름이 중단되지 않고 `logger.warn` 호출을 확인

---

### [WARNING] 동일 `executionId`에 continuation 메시지 중복 수신 미테스트
- **위치**: `execution-engine.service.spec.ts` — continuation handler 테스트
- **상세**: `continue` 핸들러가 `pendingContinuations`에서 키를 삭제한 뒤 같은 `executionId`로 두 번째 메시지가 도달하는 경우(silent skip)를 테스트하지 않는다. 분산 환경에서 중복 fan-out 가능성이 있는 경로다.
- **제안**: handler를 두 번 호출 → 첫 호출만 `resolve`, 두 번째는 no-op(resolveSpy 횟수 1) 검증

---

### [WARNING] `cancel` 핸들러의 silent skip 미테스트
- **위치**: `execution-engine.service.spec.ts`
- **상세**: `cancel` 핸들러가 로컬 Map에 키가 없을 때 silent skip하는 경로가 테스트되지 않는다. `continue` 핸들러의 silent skip은 테스트되어 있으나 `cancel`은 누락.
- **제안**: 동일 패턴으로 `cancel` 핸들러의 미등록 executionId에 대한 no-op 검증 추가

---

### [WARNING] `button_click` / `ai_message` 핸들러의 payload 누락 엣지케이스 미테스트
- **위치**: `execution-engine.service.spec.ts`
- **상세**: `button_click` 핸들러가 `(msg.payload as { buttonId? }).buttonId`를 추출하는데, payload가 `undefined`이거나 `buttonId`가 없는 경우 `{ type: 'button_click', buttonId: undefined }`로 resolve된다. `ai_message`의 `message` 필드도 동일. 이 동작이 의도인지 방어가 필요한지 테스트로 명시되지 않음.
- **제안**: `payload: undefined` 또는 `payload: {}` 케이스에서 resolve 값 확인

---

### [WARNING] `onModuleDestroy` 이중 호출 시나리오 미처리
- **위치**: `continuation-bus.service.spec.ts:173` (destroy 테스트) + `afterEach`
- **상세**: destroy 테스트에서 `bus.onModuleDestroy()`를 명시적으로 호출한 뒤 `afterEach`에서도 다시 호출된다. FakeRedis가 이를 무시하므로 현재는 통과하지만, 실제 ioredis에서 이미 quit된 connection에 `quit()`을 재호출하면 에러가 발생할 수 있다. 이 경우 `Promise.allSettled`가 보호하긴 하지만 명시적 테스트가 없다.
- **제안**: destroy 테스트 이후 afterEach에서 `onModuleDestroy`를 skip하거나, 이중 호출이 에러 없이 처리되는지 명시적으로 검증

---

### [INFO] `FakeExec` 타입에 삭제된 `executionPath` 필드 잔존
- **위치**: `executions.service.spec.ts:22`, `baseFake` 함수
- **상세**: `Execution` 엔티티에서 `executionPath` 컬럼이 제거됐으나 `FakeExec` 타입과 `baseFake`에 `executionPath: string[]`가 남아있다. 기능에 영향은 없으나(service가 entity에서 직접 읽지 않음) 스펙과 실제 엔티티 간 불일치를 유발해 혼란을 줄 수 있다.
- **제안**: `FakeExec`에서 `executionPath` 제거 및 `baseFake` 정리

---

### [INFO] migration 자동화 테스트 부재
- **위치**: `V035__execution_node_log.sql`
- **상세**: `UNNEST WITH ORDINALITY` 이행 로직의 정확성(배열 순서 보존, NULL/빈 배열 처리)을 검증하는 자동화 테스트가 없다. 현재 `WHERE e.execution_path IS NOT NULL AND array_length(e.execution_path, 1) > 0` 조건의 경계 처리가 테스트 외부에 있다.
- **제안**: CI 환경에서 Flyway 마이그레이션 integration test 또는 테스트 DB 기반 마이그레이션 검증 스크립트 추가 검토

---

## 요약

`ContinuationBusService` 자체 spec은 pub/sub round-trip, 타입별 dispatch, JSON 파싱 오류 흡수, cleanup 등 핵심 동작을 잘 커버한다. `execution-engine.service.spec.ts`도 분산 lock, 5개 continuation 진입점, 핸들러 resolve/silent-skip 패턴을 체계적으로 검증한다. 그러나 **`acquireLock` 전체 미테스트**, **`findById`의 신규 `executionPath` 조회 경로 완전 미테스트**, **`appendExecutionPath` catch 경로 미테스트** 3가지가 핵심 분산 정합성 로직의 테스트 공백으로 남아있으며, 특히 `acquireLock`은 서비스 파일에 구현이 있음에도 spec 파일에 단 한 줄의 테스트도 없다는 점에서 위험도가 높다.

## 위험도

**HIGH**