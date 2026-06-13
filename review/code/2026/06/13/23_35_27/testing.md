# Testing Review — refactor-05-database

## 발견사항

### [INFO] database.config.spec.ts: 테스트 커버리지 양호, 단 `poolMax=0` 경계값 케이스 누락
- 위치: `/codebase/backend/src/common/config/database.config.spec.ts`
- 상세: `nonNegativeIntEnv`는 `n >= 0`으로 0을 유효값으로 허용한다. `connectionTimeoutMs=0`은 테스트가 있지만, `poolMax=0`(연결 0개 — 사실상 애플리케이션 기동 불가) 케이스가 유효값으로 통과하는지 명시된 테스트가 없다. 운영 실수로 `DB_POOL_MAX=0`을 설정했을 때 기본값으로 폴백하지 않고 그대로 통과한다는 사실이 테스트에서 드러나지 않는다.
- 제안: `DB_POOL_MAX=0` 을 설정한 케이스를 별도 it 로 추가해 "0이 유효값임"을 명시하거나, 0을 invalid로 처리해야 한다면 `n > 0` 로직으로 수정 후 테스트를 갱신한다.

### [INFO] database.config.spec.ts: 부동소수 문자열(`"3.7"`) 파싱 동작 미검증
- 위치: `/codebase/backend/src/common/config/database.config.spec.ts`
- 상세: `parseInt("3.7", 10) = 3`으로 유효한 정수가 된다. 이 동작이 의도적인지 테스트로 명시되어 있지 않다. `.env`에 실수를 입력했을 때 자동으로 잘리는 동작은 혼란을 유발할 수 있다.
- 제안: `DB_POOL_MAX=3.7` → 3으로 파싱되는 케이스를 INFO 수준 테스트로 추가한다.

### [WARNING] execution-engine.service.spec.ts: `updateExecutionStatus` else 분기 — RUNNING 전이(선점 케이스) 테스트 부재
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`, 추가된 2개의 it
- 상세: 추가된 테스트는 `RUNNING → COMPLETED` 전이만 커버한다. else 분기는 `PENDING → RUNNING` 전이(실행 시작 진입점)도 처리하는데, 이 경우에도 guarded UPDATE의 0행 반환이 올바르게 `false`를 반환하는지 테스트가 없다. 또한 query mock이 예외를 throw하는 케이스(DB 연결 오류)도 미검증이다.
- 제안: `PENDING → RUNNING` 전이의 동시 선점(0행 반환) 케이스와, `query()` 자체가 reject하는 케이스를 추가한다.

### [WARNING] execution-engine.service.spec.ts: 기존 `expect(mockExecutionRepo.save)` → `expect(mockExecutionRepo.query)` 일괄 교체 — 파라미터 검증 느슨함
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (6개 교체 사이트)
- 상세: 교체된 assertion은 `expect.stringMatching(/UPDATE execution/)` + `expect.arrayContaining([ExecutionStatus.COMPLETED])`를 사용한다. `status IN ('pending', 'running', 'waiting_for_input')` 가드 문자열이나 `RETURNING id` 절이 포함되었는지는 **추가된 2개 케이스에서만** 검증하고, 6개 교체 사이트에서는 검증하지 않는다. 가드 누락 시 lost-update 버그가 재발해도 6개 기존 테스트는 그냥 통과한다.
- 제안: 6개 교체 사이트에도 `expect.stringMatching(/status IN/)` 를 추가하거나, 공용 matcher 상수를 도입한다.

### [INFO] executions-rerun.service.spec.ts: `computeChainDepth` CTE — 빈 결과(`[]`) 방어 케이스 미검증
- 위치: `/codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- 상세: `computeChainDepth`는 `rows[0]?.depth ?? 1`로 방어한다. `query` mock이 `[]`를 반환할 때 depth가 1로 폴백되는 경우가 명시적으로 테스트되지 않는다.
- 제안: `execRepo.query.mockResolvedValueOnce([])` 케이스를 추가해 depth=1로 처리되고 reRun이 정상 진행함을 검증한다.

### [INFO] executions-rerun.service.spec.ts: `getRawOneQueue` 변수가 테스트 파일에 잔류
- 위치: `/codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`, `makeQb()` 내 `getRawOne`
- 상세: `getRawOneQueue`는 더 이상 `computeChainDepth`에서 소비되지 않지만, `makeQb()` 내 `qb.getRawOne`과 `getRawOneQueue` 변수가 파일에 그대로 남아 있다. dead code로서 테스트 가독성을 저하하고 다른 경로에서 getRawOne을 실수로 사용하면 큐가 의도치 않게 소비된다.
- 제안: `getRawOneQueue` 선언 및 `makeQb()`의 `getRawOne` 항목이 테스트 내 다른 경로에서 여전히 필요한지 확인하고, 불필요하면 제거한다.

### [WARNING] integration-expiry-scanner.service.spec.ts: `paginates candidates by id keyset` 테스트 — `tokenExpiresAt: null` 로 실제 알림 경로 미통과
- 위치: `/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts`, "paginates candidates" it
- 상세: 페이징 동작 검증 테스트의 모든 candidate가 `tokenExpiresAt: null`이라 실제 알림 처리(threshold 분류, claim, 알림 발송)를 거치지 않는다. 페이징이 2회 fetch를 수행하는지만 검증하고, 배치 경계에서 알림이 중복 발행되지 않는지(idempotency)는 검증하지 않는다.
- 제안: 배치 경계(마지막 배치 첫 번째 항목)에 실제 만료 임박 integration을 포함한 별도 테스트를 추가해 dedup이 배치 분할 후에도 작동하는지 확인한다.

### [INFO] integration-expiry-scanner.service.spec.ts: `scope='personal'` + `scope='organization'` 혼합 배치 테스트 부재
- 위치: `/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts`
- 상세: `resolveRecipientsForBatch`는 personal(createdBy) 과 organization(admin 배치 조회)을 동일 배치 내에서 분기 처리한다. 그러나 테스트는 둘이 섞인 배치 케이스를 다루지 않는다. personal만, organization만 케이스는 있지만 혼합 배치에서 `findAdminUserIdsByWorkspaces`가 정확히 organization scope인 workspace만 인자로 받는지 검증되지 않는다.
- 제안: 동일 배치에 personal + organization integration이 섞인 케이스를 추가하고, `findAdminUserIdsByWorkspaces` 호출 인자에 personal의 workspaceId가 포함되지 않음을 verify한다.

### [WARNING] knowledge-base.service.spec.ts: `enqueueEmbedChunked` — 중간 chunk 실패 시 이후 chunk 계속 처리 검증 부재
- 위치: `/codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts`
- 상세: `enqueueEmbedChunked`는 chunk 실패 시 즉시 throw하지 않고 전 chunk를 시도한 뒤 집계를 반환하는 것이 핵심 설계다. 하지만 `retryFailedDocuments` 테스트의 "rolls back the failed chunk"는 단일 chunk 1개 실패로만 테스트한다. 3 chunk 중 2번째 실패 시 1번째와 3번째가 정상 처리되는지(즉, 중간 실패가 이후 chunk를 막지 않는지) 검증하는 테스트가 없다.
- 제안: 150개 doc(2 chunk) 중 1번째 chunk 실패 + 2번째 정상 케이스를 추가해, 양쪽 chunk가 시도되고 enqueued=50, failed=100 집계가 정확한지 확인한다.

### [INFO] knowledge-base.service.spec.ts: `finalizeReembedIfDrained` 직접 테스트 부재
- 위치: `/codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts`
- 상세: `finalizeReembedIfDrained`는 private이지만, NOT EXISTS CAS 쿼리를 직접 검증하는 코드 경로가 `reEmbedAll` 실패 케이스 테스트에서만 간접 검증된다. 진행 중 child가 있을 때 no-op가 되는지(NOT EXISTS가 false → UPDATE 0행)는 테스트에 포함되지 않는다.
- 제안: `reEmbedAll` chunk 실패 케이스에서, 마지막 `query` 호출이 `NOT EXISTS` 조건을 포함하는 SQL인지 `expect.stringMatching`으로 확인하는 assertion을 추가한다. (이미 일부 추가되어 있으나 "NOT EXISTS" 자체를 검증하는 매처가 적절한지 확인 필요)

### [INFO] workflow-versions.service.spec.ts: `findOne`이 여전히 `relations: ['creator']` 배열 문법 — `findByWorkflow`의 객체 문법(`{ creator: true }`)과 불일치
- 위치: `/codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts`, `findOne` 테스트
- 상세: `findByWorkflow`는 `relations: { creator: true }` (객체) 로 변경되었지만, `findOne`은 `relations: ['creator']` (배열) 그대로다. 실제 서비스 코드의 `findOne`도 `relations: ['creator']` 배열 문법을 사용하므로 기능 불일치는 아니지만, 동일 패턴에서 혼용이 발생한다.
- 제안: `findOne`도 `relations: { creator: true }` 로 통일하거나, 배열 문법 유지가 의도적이라면 주석으로 이유를 명시한다.

### [INFO] WorkflowVersionListItemDto: 직렬화 결과 검증 테스트 부재
- 위치: `/codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts`
- 상세: 새로 추가된 `WorkflowVersionListItemDto`가 `snapshot`을 포함하지 않는다는 계약은 서비스 레벨 `select` 옵션으로 강제한다. 그러나 컨트롤러가 응답을 `WorkflowVersionListItemDto`로 직렬화했을 때 `snapshot` 필드가 실제로 응답 본문에 포함되지 않는지를 확인하는 e2e 또는 컨트롤러 단위 테스트가 없다.
- 제안: 컨트롤러 레벨 테스트 또는 e2e에서 `GET /workflows/:wfId/versions` 응답에 `snapshot` 키가 없음을 confirm한다.

### [INFO] migrations.spec.ts: V095 파일 네이밍 컨벤션 자동 검증 범위 확인 필요
- 위치: `/codebase/backend/src/migrations.spec.ts` (기존 파일 — 변경 없음)
- 상세: `migrations.spec.ts`가 V번호 중복 및 alphanumeric suffix를 CI에서 자동 검증하는데, V095가 새로 추가되었다. 신규 파일이 기존 V번호와 충돌하지 않는지 테스트가 자동 커버하므로 별도 수작업 없이 CI에서 검증된다. 다만, `.conf` 파일이 `.sql` 파일과 1:1로 대응하는지 검증하는 테스트가 `migrations.spec.ts`에 포함되어 있는지는 확인이 필요하다.
- 제안: `migrations.spec.ts`에 `.conf`와 `.sql` 파일이 항상 쌍으로 존재하는지를 검증하는 규칙이 없다면 추가를 고려한다.

---

## 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. `databaseConfig` pool 설정(M-5), `updateExecutionStatus` guarded UPDATE(M-3), `computeChainDepth` 재귀 CTE(C-2), 배치 페이징(m-1), admin 배치 조회(M-2), `reEmbedAll` chunk 분할(M-1), `findByWorkflow` snapshot 비적재(m-3) 등 핵심 변경 사항에 대응하는 테스트가 각각 추가·수정되었다. 그러나 몇 가지 커버리지 갭이 남아 있다: `updateExecutionStatus` else 분기의 6개 기존 assertion이 guarded 가드 문자열을 검증하지 않아 lost-update 가드 누락을 놓칠 수 있고(WARNING), `enqueueEmbedChunked`의 중간 chunk 실패 후 이후 chunk 계속 처리 계약이 직접 검증되지 않는다(WARNING). 페이징 테스트는 실제 알림 경로를 통과하지 않아 배치 경계 idempotency가 미검증된다(WARNING). 나머지 발견사항은 INFO 수준으로 즉각적인 버그 위험은 낮다.

## 위험도

LOW

---

STATUS: SUCCESS
