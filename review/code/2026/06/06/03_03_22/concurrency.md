# 동시성(Concurrency) 리뷰

## 분석 범위

이번 변경(`93cae99e`)에서 실제로 추가된 런타임 코드:

1. `codebase/backend/migrations/V087__execution_resume_call_stack.sql` — DDL only (ALTER TABLE ... ADD COLUMN ... JSONB NULL)
2. `codebase/backend/src/modules/executions/entities/execution.entity.ts` — TypeORM 엔티티 필드 선언
3. `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` — TypeScript 인터페이스 정의 (순수 타입)

나머지 파일(plan/*.md, review/*.md, spec-draft/*.md)은 문서/산출물로 동시성 분석 대상이 아니다.

## 발견사항

해당 없음.

이번 변경에 동시성 관련 런타임 코드가 존재하지 않는다.

- **SQL 마이그레이션**: `ALTER TABLE execution ADD COLUMN resume_call_stack JSONB NULL` 은 PostgreSQL DDL 이며 동시성 제어가 DB 트랜잭션 레이어에서 이미 보장된다. 컬럼이 `NULL` 기본값으로 추가되므로 기존 row 읽기/쓰기에 락 경합이 없다(PostgreSQL ADD COLUMN NULL은 테이블 재작성 없이 카탈로그만 갱신).
- **엔티티 선언**: `@Column({ name: 'resume_call_stack', type: 'jsonb', nullable: true })` + `resumeCallStack: ResumeCallStack | null` 은 TypeORM 메타데이터 데코레이터이며 런타임 공유 상태를 변경하지 않는다.
- **타입 정의**: `ResumeCallStackFrame`·`ResumeCallStack` 인터페이스는 순수 TypeScript 타입으로 런타임에 존재하지 않는다.

`resumeCallStack` 을 실제로 읽고 쓰는 로직(park 시 `stageDurableResumeSnapshot` 확장, rehydration 시 재귀 재진입)은 이번 커밋에서 구현되지 않았다(commit 메시지 "[WIP — 빌드 검증 node_modules 부트스트랩 후]" 확인). 따라서 `pendingContinuations`/`firstSegmentBarriers` 등 기존 in-memory 동시성 구조에 대한 영향도 없다.

## 요약

이번 변경은 `resume_call_stack` 컬럼의 스키마 기반(DDL + 엔티티 + 타입) 을 추가하는 WIP 단계이다. 실제 read/write 로직이 없으므로 경쟁 조건·데드락·스레드 안전성·async/await 오용·원자성·이벤트 루프 블로킹 어느 관점에서도 신규 동시성 위험이 발생하지 않는다. 후속 커밋(park 시 call-stack 저장 + rehydration 재귀 재진입)이 추가될 때 `stageDurableResumeSnapshot` 의 DB 저장 트랜잭션 원자성, `resumeFromCheckpoint` 의 call-stack 재귀 재진입과 기존 `pendingContinuations` fast-path 의 경합, `CALL_STACK_SCHEMA_VERSION` 상수 미스매치 시 rehydration 실패 처리 등에 대해 별도 동시성 리뷰가 필요하다.

## 위험도

NONE

STATUS=success ISSUES=0 PATH=/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/review/code/2026/06/06/03_03_22/concurrency.md RESET_HINT=
