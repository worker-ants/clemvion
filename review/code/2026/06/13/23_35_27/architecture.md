# 아키텍처(Architecture) 리뷰

## 발견사항

### **[WARNING]** `updateExecutionStatus` — 비즈니스 레이어에서 raw SQL 직접 실행 (ORM 추상화 누출)
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` 메서드 else 분기
- **상세**: `executionRepository.query(...)` 로 칼럼명(`active_running_ms`, `finished_at` 등) 을 하드코딩한 raw SQL UPDATE를 서비스 레이어에 직접 작성했다. TypeORM의 엔티티 매핑을 우회하므로, DB 컬럼 리네임·엔티티 변경 시 컴파일 오류 없이 런타임에서만 발견된다. 또한 `execution.status = newStatus` 를 메모리 엔티티에 먼저 set한 뒤 SQL을 별도 발행하여 메모리 상태와 DB 상태의 일관성이 SQL 성공 여부에 달려 있다(중간 실패 시 엔티티 객체가 잘못된 status를 보유).
- **제안**: 낙관적 잠금(TypeORM `@Version`)이나 조건부 `QueryBuilder.update().where('status IN (...)')` 형태로 ORM 레이어 안에서 처리하거나, 별도 `ExecutionRepository` 클래스로 raw 쿼리를 격리해 서비스가 ORM 추상화를 직접 의존하지 않도록 분리한다. 현재 구현 자체는 기능적으로 타당(guarded UPDATE)하지만 레이어 책임 경계 위반이다.

### **[WARNING]** `computeChainDepth` — 재귀 CTE raw SQL이 서비스 레이어에 노출
- **위치**: `/codebase/backend/src/modules/executions/executions.service.ts` — `computeChainDepth` 메서드
- **상세**: 재귀 CTE(`WITH RECURSIVE chain AS ...`)를 `executionRepository.query(...)` 로 직접 서비스 레이어에 작성하는 패턴이다. 이전 N+1 walk를 단일 쿼리로 개선한 목적(C-2)은 정당하나, 데이터 접근 로직이 비즈니스 서비스에 산재한다. DB 특정 문법(PostgreSQL 재귀 CTE)과 비즈니스 로직이 혼재.
- **제안**: `ExecutionRepository` 커스텀 클래스를 만들어 `computeChainDepth` 쿼리를 data 레이어로 이동. 서비스는 `repository.computeChainDepth(id)` 형태로만 호출한다.

### **[WARNING]** `KnowledgeBaseService.enqueueEmbedChunked` — 큐 오류를 삼키고 집계 반환하는 패턴의 모호한 책임
- **위치**: `/codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `enqueueEmbedChunked`, `finalizeReembedIfDrained`
- **상세**: `enqueueEmbedChunked`가 내부에서 `embedding_status='failed'` DB UPDATE를 직접 실행하고 에러를 집계해 반환한다. 이 메서드가 큐 적재(infrastructure 관심사) + DB 롤백 보상(persistence 관심사) + 집계(비즈니스 정책)를 동시에 수행하므로 단일 책임 원칙(SRP) 위반이다. 호출부(`reEmbedAll`, `retryFailedDocuments`)에서 에러 처리 정책이 다르게 분기되어(한쪽은 `throw firstError`, 다른쪽은 lock 해제) 메서드 계약이 호출부별로 달리 해석될 위험이 있다.
- **제안**: `enqueueEmbedChunked`는 적재 + 실패 chunk 식별만 담당하고, 보상 DB UPDATE는 호출부가 명시적으로 수행하도록 책임을 분리한다. 또는 `ChunkEnqueueResult`를 반환하는 순수 헬퍼와 보상 헬퍼를 분리.

### **[WARNING]** `WorkflowVersionsService.findByWorkflow` 반환 타입 불일치 — 타입 안전성 갭
- **위치**: `/codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findByWorkflow`
- **상세**: 메서드 시그니처가 `Promise<WorkflowVersion[]>`를 반환하지만 실제로는 `select` 옵션으로 `snapshot`이 제외된 부분 필드만 로드한다. TypeScript 타입과 런타임 데이터가 불일치하며, 호출부나 테스트에서 `snapshot`에 접근하면 `undefined`를 받지만 컴파일 오류가 없다. 별도 `WorkflowVersionListItemDto`가 정의되었음에도 서비스 레이어 반환 타입이 전체 엔티티로 선언되어 있어 추상화가 불완전하다.
- **제안**: `findByWorkflow`의 반환 타입을 `Promise<WorkflowVersionListItemDto[]>` (또는 `Pick<WorkflowVersion, ...>` 유틸리티 타입)으로 변경해 컴파일 타임에 snapshot 접근 시도를 차단한다.

### **[INFO]** `IntegrationExpiryScannerService` — 배치 분리(processCandidateBatch)로 응집도 향상
- **위치**: `/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- **상세**: keyset 페이지네이션(m-1) + 배치별 admin 일괄 조회(M-2, `resolveRecipientsForBatch`) 도입으로 N+1 제거 및 책임 분리가 이루어졌다. `processCandidateBatch`가 단일 배치의 처리를 캡슐화한 구조는 SRP 측면에서 개선이다. 다만 `run` → `processCandidateBatch` → `resolveRecipientsForBatch` 의 3단계 호출 체인에서 `processCandidateBatch`가 여전히 알림 생성, 상태 업데이트, 수신자 집계 등 다수의 관심사를 보유하고 있다. 현 규모에서는 허용 가능.

### **[INFO]** `app.module.ts` — pool 튜닝이 ConfigService를 통해 올바르게 추상화됨
- **위치**: `/codebase/backend/src/app.module.ts`
- **상세**: DB 커넥션 풀 파라미터를 `extra` 옵션으로 주입하는 구조가 `database.config.ts`의 `nonNegativeIntEnv` 파싱을 통해 명확히 분리되어 있다. 설정 레이어(config) → 모듈 조립(app.module) → 인프라(TypeORM) 의 책임 분리가 적절하다.

### **[INFO]** `databaseConfig` — `nonNegativeIntEnv` 헬퍼가 모듈 내부에 선언됨
- **위치**: `/codebase/backend/src/common/config/database.config.ts`
- **상세**: `nonNegativeIntEnv` 함수가 `database.config.ts` 내에 file-private 함수로 선언되었다. 동일 패턴이 다른 config 파일(예: `redis.config.ts`)에서도 필요할 경우 중복이 발생할 수 있다. 현재로는 단일 사용처라 과도한 추상화 없이 적절하다.

### **[INFO]** 마이그레이션 전략 문서(README.md §6) — 아키텍처 결정이 문서화됨
- **위치**: `/codebase/backend/migrations/README.md`
- **상세**: 테이블-rewrite형 `ALTER COLUMN TYPE` 처리 패턴(shadow column 3-step)이 운영 절차로 공식화되어 개발자 가이드라인으로 정착된 것은 데이터 레이어 변경 전략의 아키텍처적 결정을 코드 레벨에 명시한 좋은 사례다.

---

## 요약

이번 변경은 크게 세 가지 아키텍처 개선을 포함한다: (1) DB 커넥션 풀 튜닝의 env 외부화, (2) 실행 엔진의 lost-update 방지를 위한 guarded UPDATE 도입(M-3), (3) N+1 쿼리 제거(M-2, C-2, m-1, m-3). 성능과 정확성 측면의 개선은 명확하다. 그러나 구조적 결함이 두 곳에 집중된다. `updateExecutionStatus` 와 `computeChainDepth` 에서 raw SQL이 서비스 레이어에 직접 노출되어 ORM 추상화 경계가 무너졌고, `KnowledgeBaseService.enqueueEmbedChunked`가 큐·DB·에러 정책을 단일 메서드에 혼재시켜 SRP를 위반한다. 또한 `WorkflowVersionsService.findByWorkflow`의 반환 타입이 실제 로드 필드와 불일치해 타입 안전성 갭이 존재한다. 이 세 항목은 기능 정확성에는 영향이 없으나 향후 유지보수·리팩터 시 회귀 위험 진원지가 된다.

---

## 위험도

MEDIUM
