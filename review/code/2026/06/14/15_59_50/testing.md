# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] 모듈 등록 변경에 대한 테스트 없음 — 허용 가능
- 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts`
- 상세: `BullModule.registerQueue({ name: TERMINAL_REVOKE_RECONCILE_QUEUE })` 와 `TerminalRevokeReconcilerService` 추가는 NestJS 모듈 메타데이터 변경이다. 이에 대한 전용 모듈 통합 테스트는 없으나, `TerminalRevokeReconcilerService` 의 unit 테스트(`terminal-revoke-reconciler.service.spec.ts`)가 NestJS `Test.createTestingModule` 을 사용해 DI 와이어업 자체를 검증하고 있어 실질적 위험은 낮다.
- 제안: 현 수준 허용. e2e 테스트가 모듈 전체 부팅을 커버하므로 추가 조치 불필요.

### [INFO] `reconcileTerminalRevocations` — `batchLimit` 파라미터 경계값 테스트 미존재
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — `reconcileTerminalRevocations` describe 블록 전체
- 상세: `reconcileTerminalRevocations(batchLimit = 500)` 의 기본값/비기본값 동작 차이, `batchLimit=0`, `batchLimit=1` 같은 경계값은 테스트되지 않는다. `.limit(batchLimit)` 호출 검증도 현재 테스트에 없다.
- 제안: `expect(qb.limit).toHaveBeenCalledWith(500)` 단언을 핵심 테스트에 추가하거나, 비기본 `batchLimit` 를 넘기는 케이스 한 건을 추가. 위험도는 낮다(SQL LIMIT 버그는 쿼리빌더 mock 범위 밖이므로 integration/e2e 에서 검증).

### [INFO] `reconcileTerminalRevocations` — 이미 만료된 토큰(ttl <= 0)만 존재하는 케이스 미테스트
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — reconcile 테스트 블록
- 상세: 구현 `revokeAllForExecution` 내부에서 `ttl <= 0` 인 토큰은 blacklist 등록을 건너뛴다(`continue`). reconcile 테스트는 미래 expAt(`Date.now() + 60_000`)을 쓰는 케이스만 다룬다. 이미 만료된 jti 만 존재하는 execution 을 reconcile 할 경우 `revoked: 0` 이 반환돼야 하는데 이 경로가 확인되지 않는다.
- 제안: `expAt: new Date(Date.now() - 1)` 인 토큰을 반환하는 mock 케이스를 추가해 `revoked: 0` 반환을 단언. 낮은 우선순위.

### [INFO] `TerminalRevokeReconcilerService.reconcile` — `swept > 0` 분기 로그 경로 테스트 없음
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts`
- 상세: `reconcileTerminalRevocations` 가 `{ swept: 3, revoked: 2 }` 를 반환할 때 `logger.log` 가 호출되는 분기가 있으나, 현재 테스트에서 `swept: 0` 케이스만 사용하므로 이 로그 경로가 테스트 외 영역에 있다. 기능적 결함을 유발하지는 않는다.
- 제안: `tokenService.reconcileTerminalRevocations.mockResolvedValue({ swept: 3, revoked: 2 })` 케이스를 추가해 성공 경로 로그 분기를 커버. 필수는 아님.

### [WARNING] `process` 테스트가 `reconcile` 공개 메서드를 직접 검증하지 않음
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts` — `process 는 reconcileTerminalRevocations 로 위임` / `reconcile 실패는 swallow` 두 테스트
- 상세: `process` 는 `this.reconcile()` 을 호출하고 `reconcile` 은 내부에서 try/catch 로 swallow 한다. 테스트가 `process` 를 통해 swallow 를 검증하는 것은 올바르다. 그러나 `reconcile` 이 public 메서드임에도 단독 테스트가 없어, scheduler 외부에서 직접 호출될 때의 동작이 명시적으로 검증되지 않는다. 실운영에서 위험은 낮으나 public API 계약으로서 단독 커버가 권장된다.
- 제안: `service.reconcile()` 을 직접 호출하는 테스트 케이스 추가(swept>0 성공, throw 시 swallow). 현재 `process` 를 통한 테스트로 실질 커버되므로 필수 아님.

### [INFO] `makeQB` helper — `select`, `distinct`, `limit` 호출 체이닝 단언 부재
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — `makeQB` 헬퍼 함수
- 상세: `makeQB` 는 `innerJoin`, `where`, `select`, `distinct`, `limit` 를 체이닝 가능 mock 으로 구성하지만, `where` 를 제외하면 나머지 체이닝 메서드가 실제로 호출됐는지 단언이 없다. 특히 `.select('et.executionId', 'executionId').distinct(true)` 는 중복 제거의 핵심 쿼리 특성이다.
- 제안: 핵심 테스트에 `expect(qb.select).toHaveBeenCalledWith('et.executionId', 'executionId')` 와 `expect(qb.distinct).toHaveBeenCalledWith(true)` 단언 추가.

### [INFO] 테스트 격리 — `redis.set.mockResolvedValue('OK')` 가 일부 케이스에서만 설정됨
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` — reconcile 테스트 블록
- 상세: `redis.set` mock 설정이 모든 reconcile 테스트 케이스에 일관되게 적용되지 않는다. `잔존 토큰 없음` 케이스는 해당 경로에 도달하지 않으므로 현재 문제없으나, outer `beforeEach` 에서 `jest.clearAllMocks()` 없이 각 테스트가 개별 mock 상태를 설정해 실행 순서에 따라 잔존 mock 상태가 생길 수 있다.
- 제안: outer `beforeEach` 또는 describe 레벨에 `jest.clearAllMocks()` 추가 또는 `redis.set.mockResolvedValue('OK')` 를 outer `beforeEach` 로 이동해 일관성 보장.

---

## 요약

신규 추가된 `TerminalRevokeReconcilerService` 와 `InteractionTokenService.reconcileTerminalRevocations` 는 각각 4건씩 총 8건의 unit 테스트로 핵심 동작 경로(scheduler 등록, fail-fast 부팅 실패, 위임, fail-open swallow, no-op, terminal execution sweep, per-execution 실패 fail-open, 잔존 토큰 없음)를 커버한다. 테스트는 NestJS `TestingModule` 기반으로 DI 격리되어 있고, mock 구조가 의도를 명확히 표현하며 각 테스트 제목이 Spec 조항(EIA §3.4 EIA-RL-06 / R15)을 참조해 가독성이 높다. 중요 결함은 없으나 이미 만료된 토큰 경로(`ttl <= 0`) 미테스트, `select`/`distinct` 쿼리 체이닝 단언 부재, `reconcile` 공개 메서드 단독 테스트 부재, mock 초기화 일관성 미흡이 소규모 커버리지 갭을 형성한다. 모두 LOW 위험이며 기능적 결함으로 이어질 가능성은 낮다.

## 위험도

LOW
