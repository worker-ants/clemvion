# 의존성(Dependency) Review 결과

## 발견사항

- **[INFO]** 새 외부 의존성 없음
  - 위치: 전체 diff (12개 파일: `.env.example`, `V104__execution_queued_at.sql`, `execution-engine.service.{ts,spec.ts}`, `execution-limits.{ts,spec.ts}`, `execution.entity.ts`, `update-workspace-settings.dto.ts`, `workspaces.service.ts`, `execution-concurrency-cap.e2e-spec.ts`, `docker-compose.e2e.yml`, spec 문서)
  - 상세: 신규 npm/pnpm 패키지 추가나 `package.json`/`pnpm-lock.yaml` 변경이 없다. 사용된 import 는 모두 기존 의존성(`class-validator`의 `IsInt`/`Min`, `@nestjs/swagger`의 `ApiPropertyOptional`, TypeORM `createQueryBuilder`/raw `query()`, `@nestjs/bullmq` 큐 API, jest)뿐이며 신규 라이브러리 도입이 필요 없는 순수 로직/스키마 변경이다.
  - 제안: 해당 없음 (현행 유지).

- **[INFO]** DB 스키마 의존성 추가 — `queued_at` 컬럼 (내부 의존성 관점)
  - 위치: `codebase/backend/migrations/V104__execution_queued_at.sql`, `execution.entity.ts` (`queuedAt` 컬럼)
  - 상세: `ALTER TABLE execution ADD COLUMN queued_at TIMESTAMPTZ DEFAULT NOW()` 는 외부 패키지가 아니지만 애플리케이션-DB 스키마 간 새 결합을 만든다. `admitExecutionOrDefer`(execution-engine.service.ts)의 raw SQL이 `execution`/`workflow` 테이블명과 컬럼명(`status`, `workflow_id`, `workspace_id`)에 문자열로 직접 의존한다. TypeORM 엔티티 필드명이 바뀌어도 raw SQL 문자열은 컴파일 타임에 감지되지 않는다.
  - 제안: 기존 코드베이스 관행(예: `updateExecutionStatus`의 raw UPDATE)과 일관되므로 문제 아님. 다만 향후 `execution`/`workflow` 테이블/컬럼명 리네임 시 이 raw SQL 블록도 함께 갱신해야 한다는 점을 인지 필요 (grep 커버리지 확인 권장).

- **[INFO]** 내부 모듈간 의존 확장 — `execution-limits.ts` → `execution-engine.service.ts`
  - 위치: `execution-engine.service.ts` import 블록 (`resolveConcurrencyCap`, `resolveQueueWaitTimeoutMs`, `DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS`, `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS`, `EXECUTION_ADMISSION_RETRY_DELAY_MS`)
  - 상세: 기존 `resolveMaxActiveRunningMs` 패턴을 그대로 확장한 것으로, PR2a 선례와 동일한 구조. 순환 의존성이나 새 계층 위반 없음. `workspaces.service.ts` → `update-workspace-settings.dto.ts`(`maxConcurrentExecutions`) 결합도 기존 DTO 패턴과 일관.
  - 제안: 없음.

- **[INFO]** e2e 인프라 env 값 — `docker-compose.e2e.yml`
  - 위치: `docker-compose.e2e.yml` (`EXECUTION_QUEUE_WAIT_TIMEOUT_MS: "8000"`)
  - 상세: 새 이미지/버전 pin 이 아니라 기존 서비스(`backend-e2e`)에 env var 1개만 추가. Postgres/Redis/MinIO/Playwright 이미지 버전은 변경 없음(모두 기존 pin 유지: `pgvector/pgvector:${POSTGRES_VERSION:-pg18}`, `redis:7-alpine`, `minio/minio:RELEASE.2025-04-22T22-12-26Z` 등).
  - 제안: 없음.

- **[INFO]** 라이선스/취약점 해당 없음
  - 상세: 새 외부 패키지가 없으므로 라이선스 호환성·CVE 스캔 대상이 없다. 기존 의존성(class-validator, TypeORM, BullMQ 등) 버전도 변경되지 않았다.

## 요약

본 변경(§8 동시성 cap admission gate — 큐 대기 타임아웃 + workspace/workflow cap)은 순수하게 기존 의존성(class-validator, @nestjs/swagger, TypeORM, BullMQ, jest)만을 사용하는 내부 로직/스키마 확장이며, `package.json`/lockfile 변경이나 신규 외부 패키지 도입이 전혀 없다. 따라서 버전 고정·라이선스·취약점·번들 크기·의존성 충돌 등 전통적 의존성 리스크는 발생하지 않는다. 유일하게 주목할 지점은 raw SQL(`admitExecutionOrDefer`)이 테이블/컬럼명에 문자열로 결합된다는 내부 의존성 특성인데, 이는 기존 코드베이스의 선례(`updateExecutionStatus`)와 일관된 패턴이라 신규 리스크로 보기 어렵다.

## 위험도

NONE
