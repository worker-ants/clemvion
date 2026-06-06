# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** 마이그레이션 안전성 — nullable 컬럼 추가, 무중단 배포 안전
  - 위치: `codebase/backend/migrations/V087__execution_resume_call_stack.sql` L52-53
  - 상세: `ALTER TABLE execution ADD COLUMN resume_call_stack JSONB NULL` — nullable 컬럼 추가는 테이블 잠금 없이 즉시 완료(PostgreSQL 11+). 기존 row 는 자동 NULL, 배포 이전 row 도 NULL fallback 명시. 회귀 없음.
  - 제안: 해당 없음, 현재 패턴이 올바름.

- **[INFO]** 인덱스 — JSONB 컬럼에 인덱스 없음
  - 위치: `codebase/backend/migrations/V087__execution_resume_call_stack.sql`
  - 상세: `resume_call_stack` 는 rehydration 시 executionId PK 로 단건 조회 후 읽는 구조이므로 컬럼 자체 인덱스 불필요. JSONB 내 특정 key 로 필터링하는 쿼리 경로가 없으므로 GIN 인덱스도 불요하다. 조회는 항상 `execution.id` (PK) 기반 단건 fetch 이므로 인덱스 누락은 문제 아님.
  - 제안: 향후 `resume_call_stack IS NOT NULL` 조건의 bulk 모니터링 쿼리가 생기면 partial index 고려.

- **[INFO]** 스키마 설계 — JSONB 선택의 적절성
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` L94-95, `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
  - 상세: `ResumeCallStack`의 frames 배열은 구조가 고정적(`workflowId`, `invokerNodeId`, `recursionDepth` 세 필드)이고 중첩 깊이가 bounded(컨테이너 body blocking 금지로 선형 스택). `conversation_thread`/`user_variables`와 동일 패턴으로 단건 park/resume 시에만 읽고 쓰므로 JSONB 가 적합. `version` 필드(`CALL_STACK_SCHEMA_VERSION`)로 스키마 진화 대비도 있음.
  - 제안: 현재 설계 적절.

- **[INFO]** 트랜잭션 — 상태전이와 원자 commit (구현 단계 확인 필요)
  - 위치: `plan/in-progress/spec-draft-exec-park-b2-durable.md` C3 항목
  - 상세: spec-draft 에서 `waiting_for_input` 상태전이와 `resume_call_stack` 쓰기를 같은 트랜잭션에 묶도록 명시. 실제 서비스 코드는 이번 diff 에 미포함(PR-B2 구현 예정)이므로 현재 마이그레이션 단계 기준으론 SQL 추가만 된 상태.
  - 제안: PR-B2 구현 시 `stageDurableResumeSnapshot` 이 `resume_call_stack` 쓰기를 상태전이 트랜잭션 내에서 수행하는지 코드 리뷰에서 확인 필요.

## 요약

이번 변경의 DB 관련 코드는 `V087__execution_resume_call_stack.sql` 마이그레이션과 `execution.entity.ts` 엔티티 컬럼 추가, `resume-call-stack.types.ts` 타입 정의 세 파일이다. 마이그레이션은 `JSONB NULL` 컬럼 추가로 테이블 락 없이 안전하고, 기존 row NULL fallback 이 명시되어 무중단 배포 요건을 충족한다. 인덱스 추가는 불필요하고(PK 단건 조회 패턴), `conversation_thread`/`user_variables`와 동일한 durable snapshot 패턴을 따라 설계 일관성이 높다. `version` 필드로 스키마 진화 대비도 되어 있다. Critical 또는 Warning 수준의 DB 이슈는 발견되지 않았으며, 향후 PR-B2 서비스 구현 시 상태전이-call_stack 쓰기 원자성 트랜잭션 여부만 별도 확인을 권장한다.

## 위험도
NONE
