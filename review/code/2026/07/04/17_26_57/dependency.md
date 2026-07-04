# 의존성(Dependency) Review 결과

## 발견사항

- **[INFO]** 새 외부 의존성 없음 (이번 라운드 포함 누적 확인)
  - 위치: 전체 diff 32개 파일(`.env.example`, `V104__execution_queued_at.sql`, `V105__execution_workflow_status_index.{sql,conf}`, `execution-engine.service.{ts,spec.ts}`, `execution-limits.{ts,spec.ts}`, `execution.entity.ts`, `workspace-response.dto.ts`, `update-workspace-settings.dto.ts`, `workspaces.service.ts`, `execution-concurrency-cap.e2e-spec.ts`, `docker-compose.e2e.yml`, `spec/5-system/4-execution-engine.md`, `review/code/2026/07/04/16_58_32/**`)
  - 상세: 이번 17_26_57 라운드는 직전 16_58_32 ai-review 의 CRITICAL(TOCTOU)·Warning 픽스(advisory lock 도입, V105 인덱스, GET settings 필드 추가 등)를 반영한 재검토다. `package.json`/`pnpm-lock.yaml` 변경은 여전히 없다. 신규로 추가된 `pg_advisory_xact_lock` 호출(`execution-engine.service.ts` `admitExecutionOrDefer`)은 TypeORM `EntityManager.transaction()` 콜백 내 `m.query(...)` 로 실행되는 PostgreSQL 내장 함수 호출이며 별도 npm 패키지(`pg` 등)를 새로 import 하지 않는다 — 기존 TypeORM 연결 풀을 그대로 사용.
  - 제안: 해당 없음(현행 유지).

- **[INFO]** V105 마이그레이션(`CREATE INDEX CONCURRENTLY` + `.conf`) — 외부 패키지 아님, 내부 의존성 관점만 해당
  - 위치: `codebase/backend/migrations/V105__execution_workflow_status_index.sql`, `V105__execution_workflow_status_index.conf`
  - 상세: 신규 인덱스 마이그레이션과 이를 트랜잭션 밖에서 실행시키는 `executeInTransaction=false` 설정 파일이다. Flyway(또는 동등 마이그레이션 러너)의 기존 `.conf` 동봉 컨벤션을 그대로 재사용했으며 신규 마이그레이션 러너 플러그인/의존성 추가는 없다.
  - 제안: 없음.

- **[INFO]** `test/execution-concurrency-cap.e2e-spec.ts` 의 `pg` (`Client`) import 는 기존 e2e 의존성 재사용
  - 위치: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts:3` (`import { Client } from 'pg';`)
  - 상세: `pg` 패키지 자체는 신규 도입이 아니라 이미 백엔드 런타임 의존성(TypeORM 의 Postgres 드라이버)으로 존재하며, 다른 기존 e2e 스펙(`test/helpers/db.ts`)에서도 동일하게 직접 import 해 사용해온 선례 패턴이다. `package.json`/lockfile 변경 없이 기존 devDependency/이행 의존성 범위 내에서 재사용한 것으로 신규 리스크 없음.
  - 제안: 없음.

- **[INFO]** advisory lock 도입에 따른 런타임 의존성 변화 없음 (PostgreSQL 내장 기능)
  - 위치: `execution-engine.service.ts` `admitExecutionOrDefer` — `SELECT pg_advisory_xact_lock(hashtext($1))`
  - 상세: `pg_advisory_xact_lock`/`hashtext` 는 PostgreSQL 코어 내장 함수로 확장(extension) 설치나 별도 드라이버 기능이 필요 없다. 프로젝트가 이미 사용 중인 Postgres 버전(pgvector/pg18, docker-compose.e2e.yml 기준)에서 표준으로 제공되므로 버전 호환성 문제도 없다.
  - 제안: 없음.

- **[INFO]** 라이선스/취약점/번들 크기 해당 없음
  - 상세: 새 외부 패키지가 없으므로 라이선스 호환성 검토·CVE 스캔·번들 크기·빌드 시간 영향 항목은 모두 해당하지 않는다. 기존 의존성(class-validator, @nestjs/swagger, TypeORM, BullMQ, jest, pg)의 버전도 변경되지 않았다.

## 요약

이번 17_26_57 라운드는 직전 ai-review(16_58_32) 의 CRITICAL(TOCTOU)·Warning 항목을 반영한 후속 변경(advisory lock 직렬화, V105 인덱스 마이그레이션, GET settings 필드 동기화 등)이며, 신규 외부 패키지 도입이나 `package.json`/lockfile 변경은 전혀 없다. 새로 등장한 `pg_advisory_xact_lock`/`hashtext` 는 PostgreSQL 내장 함수이고, e2e 스펙의 `pg` `Client` import 도 기존에 이미 사용되던 의존성의 재사용이다. 따라서 버전 고정·라이선스·취약점·번들 크기·의존성 충돌 등 전통적 의존성 리스크는 발생하지 않는다. 유일하게 계속 주목할 지점은(이전 리뷰에서도 지적된) admission 로직의 raw SQL 이 테이블/컬럼명에 문자열로 결합된다는 내부 의존성 특성이나, 이는 기존 코드베이스 선례(`updateExecutionStatus`)와 일관되고 이미 architecture/database 리뷰에서 다뤄진 사안이라 dependency 관점에서는 추가 조치가 필요 없다.

## 위험도

NONE

STATUS: SUCCESS
