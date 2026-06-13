# 부작용(Side Effect) 리뷰 결과

## 발견사항

### **[WARNING]** `updateExecutionStatus` 반환 타입 변경 — 미탐지 호출자 존재 가능성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (diff: `): Promise<void>` → `): Promise<boolean>`)
- 상세: `private async updateExecutionStatus(...)` 의 반환 타입이 `void` → `boolean` 으로 변경되었다. `private` 이므로 클래스 외부 호출자는 없지만, 같은 파일 내 FAILED/CANCELLED 직접 마감 경로 및 `linkedNodeExec` 분기 호출부 중 반환값을 무시하는 경우가 있는지 diff 범위에서 확인이 필요하다. diff 상 COMPLETED 전이 호출부는 모두 `const completed = await ...` + `if (completed)` 패턴으로 처리되어 있다. 그러나 FAILED/CANCELLED 등 나머지 호출부(diff 미포함 구간)가 `await this.updateExecutionStatus(...)` 로 반환값을 버리는 경우, 런타임 에러는 없지만 `else 분기`의 `false` 반환이 나타나는 코드 경로가 있으면 emit 이 의도치 않게 skip 될 수 있다. 주석("linkedNodeExec 분기는 항상 true", "else 분기만 false")이 명시적으로 이를 구별하고 있어 실제 오진 위험은 낮지만, diff 외 FAILED/CANCELLED 호출부가 반환값을 묵시적으로 버리고 있다면 향후 유지보수 시 혼란을 줄 수 있다.
- 제안: FAILED/CANCELLED 직접 마감 경로 호출부에도 `void await` 또는 `/* always true for linkedNodeExec path */` 주석을 달아 의도를 명시하거나, 해당 경로가 항상 `true` 를 반환한다는 사실을 JSDoc에서 보강한다. 이미 JSDoc 에 설명이 있으므로 현재 코드는 허용 수준이나 명시적 표기 강화가 바람직하다.

---

### **[WARNING]** `reEmbedAll` — `documentCount` 의미 변경 (전체 대상 수 → 실제 enqueue 성공 수)
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (diff: `return { documentCount: docs.length, ... }` → `documentCount: enqueued`)
- 상세: 이전 구현에서 `documentCount` 는 UPDATE 로 pending 으로 전환된 전체 문서 수(`docs.length`)를 반환했다. 변경 후에는 큐 적재 성공 수(`enqueued`)를 반환한다. 큐 적재 실패 chunk 가 없을 때는 동일하지만, 실패 chunk 가 있는 경우 호출자가 받는 `documentCount` 가 실제 재임베딩 시작 수가 된다. 이 값을 API 응답으로 그대로 반환한다면 클라이언트(UI)에서 "xx개 문서를 재임베딩 시작했습니다" 메시지가 실제보다 적게 표시될 수 있다. 정상 경로에서는 차이가 없고, 실패 경우 오히려 더 정확한 정보를 제공하므로 의미 변경은 의도적인 것으로 보인다. 그러나 이 반환값을 소비하는 다른 코드(컨트롤러, 테스트, 클라이언트)에서 "전체 대상 수"로 가정하고 있다면 의도치 않은 부작용이 될 수 있다.
- 제안: API 응답 스펙 또는 컨트롤러에서 `documentCount` 가 "요청 전송(enqueue) 성공 수"임을 명시하거나, 필요하다면 `{ totalDocuments: reset.length, enqueuedCount: enqueued }` 형태로 분리 노출을 검토한다.

---

### **[WARNING]** `findByWorkflow` — `snapshot` 미포함으로 반환 타입(`WorkflowVersion[]`) 과 실제 객체 불일치
- 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
- 상세: `findByWorkflow` 는 `Promise<WorkflowVersion[]>` 를 반환하지만, `select` 에 `snapshot` 이 없어 반환된 객체에는 `snapshot` 이 `undefined` 다. TypeScript 반환 타입은 여전히 `WorkflowVersion[]` 이므로 이를 소비하는 내부 코드가 `version.snapshot` 에 접근하면 런타임에 `undefined` 를 얻는다. 새로 추가된 `WorkflowVersionListItemDto` 가 `snapshot` 을 제외하고 있어 컨트롤러 Swagger 스펙은 올바르지만, TypeScript 타입 레벨에서는 `WorkflowVersion` 엔티티가 `snapshot` 을 non-nullable 필드로 정의하고 있다면 타입 불일치가 발생한다. 호출 체인 내에 `findByWorkflow` 결과를 직접 serialize 하거나 snapshot에 접근하는 경로가 있을 경우 silent `undefined` 부작용이 생긴다.
- 제안: 반환 타입을 `Promise<WorkflowVersionListItemDto[]>` 또는 `Pick<WorkflowVersion, 'id'|'workflowId'|...>[]` 로 좁혀 TypeScript 레벨에서 `snapshot` 접근을 차단한다. 현재 구조는 런타임 동작은 올바르지만 타입 계약이 느슨하다.

---

### **[INFO]** `processCandidateBatch` 분리 — logger 호출 위치 변경
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- 상세: 이전 구현에서 `logger.log("Integration expiry scan created N notifications")` 는 `run()` 메서드 내 단일 호출이었다. 리팩터링 후 로그는 `run()` 에서 `totalNotifications` 집계 후 한 번 출력되도록 유지된다. `processCandidateBatch` 내부에서 로그를 제거하고 `run()` 에서 집계 후 출력하는 것은 올바른 구조다. 부작용 없음.

---

### **[INFO]** `computeChainDepth` — 재귀 CTE walk 상한이 `RERUN_CHAIN_WALK_MAX` 로 DB 파라미터 바인딩
- 위치: `codebase/backend/src/modules/executions/executions.service.ts`
- 상세: 이전 구현은 Node.js 루프(`for i < RERUN_CHAIN_WALK_MAX`)로 상한을 걸었고, 이제 DB 파라미터 `$2 = RERUN_CHAIN_WALK_MAX` 로 CTE 재귀 depth 를 제한한다. 두 방식 모두 같은 상수를 쓰므로 의미적 동치다. DB 수준에서 재귀 제한이 걸리므로 Node.js 측 추가 방어가 없어도 무한 루프는 없다. 부작용 없음.

---

### **[INFO]** `nonNegativeIntEnv` — 모듈 스코프 함수이나 export 없음
- 위치: `codebase/backend/src/common/config/database.config.ts`
- 상세: `nonNegativeIntEnv` 함수는 파일 스코프(모듈 private)이고 export 되지 않아 전역 오염 없음. `process.env` 를 읽기만 하고 쓰지 않으므로 환경 변수 부작용 없음. `registerAs` 팩토리는 NestJS ConfigModule 이 한 번만 호출하므로 반복 실행으로 인한 상태 변경 위험 없음.

---

### **[INFO]** `DB_POOL_MAX/IDLE/TIMEOUT` 기본값 — 배포 시 커넥션 풀 동작 변경 없음
- 위치: `codebase/backend/.env.example`, `codebase/backend/src/app.module.ts`
- 상세: `extra.max=10` 은 node-postgres 의 기본값과 동일하다. 이전에는 `extra` 가 없었으므로 TypeORM 이 pg Pool 기본값(max=10)을 사용했고, 변경 후에도 동일한 값이 명시적으로 전달되어 커넥션 풀 동작 변경 없음. 단, `extra` 객체를 추가함으로써 기존에 TypeORM/pg 가 내부적으로 관리하던 `idleTimeoutMillis`(기본값 10000)와 `connectionTimeoutMillis`(기본값 0)도 명시 세팅된다 — 이는 문서화된 pg 기본과 동일하므로 실질적 변경 없음.

---

### **[INFO]** `resolveRecipientsForBatch` — `findAdminUserIds` 제거, `findAdminUserIdsByWorkspaces` 신규 의존
- 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- 상세: `resolveRecipients(integration)` (per-integration) 을 `resolveRecipientsForBatch(integrations)` (batch) 로 교체했다. `WorkspacesService` 에 `findAdminUserIdsByWorkspaces` 를 추가하고 injection signature 변경 없이 기존 서비스 인스턴스에 메서드를 추가하는 방식이다. `IntegrationExpiryScannerService` 의 생성자 signature 변경 없음 — 부작용 없음.

---

### **[INFO]** V095 마이그레이션 — `CONCURRENTLY` + `.conf` 규약 준수
- 위치: `codebase/backend/migrations/V095__node_execution_exec_status_active_index.sql`, `.conf`
- 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `executeInTransaction=false` 조합은 기존 컨벤션(§4·§5)을 올바르게 따른다. `IF NOT EXISTS` 로 재실행 안전성 확보. `DOWN` 주석 포함. 단일 CONCURRENTLY statement 규약 준수. 부작용 없음.

---

## 요약

이번 변경의 핵심은 (1) DB 커넥션 풀 env 노출, (2) `updateExecutionStatus` lost-update guarded UPDATE 도입, (3) `computeChainDepth` 재귀 CTE 최적화, (4) 통합 만료 스캐너 배치 최적화, (5) `reEmbedAll` chunk 분할 및 `findByWorkflow` snapshot 비포함 최적화다. 대부분의 변경은 내부 private 메서드 또는 새 메서드 추가 형태라 외부 API/시그니처 영향이 최소화되어 있다. 주목할 부작용 위험은 두 가지다. 첫째, `updateExecutionStatus` 반환 타입 void→boolean 변경에서 diff 범위 밖의 FAILED/CANCELLED 경로 호출부가 반환값을 묵시적으로 버리는 경우 — 실제 로직 오류는 없으나 타입 계약과 실제 사용 패턴 불일치가 유지보수 위험이다. 둘째, `findByWorkflow` 가 TypeScript 타입상 `WorkflowVersion[]`을 반환하면서 실제 `snapshot` 필드가 `undefined` 인 점은 타입 안전성 관점의 잠재 위험이다. `reEmbedAll` 의 `documentCount` 의미 변경(전체 → 성공 수)은 실패 경로에서만 차이가 발생하며 더 정확한 정보를 제공하지만, API 소비자(클라이언트)가 이를 "전체 대상 수"로 가정한다면 기대와 다를 수 있다.

## 위험도

LOW
