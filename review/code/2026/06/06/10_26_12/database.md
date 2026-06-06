# 데이터베이스(Database) 코드 리뷰

## 발견사항

### **[INFO]** V087 마이그레이션 — `ADD COLUMN` 온라인 안전성
- **위치**: `/codebase/backend/migrations/V087__execution_resume_call_stack.sql`
- **상세**: `ALTER TABLE execution ADD COLUMN resume_call_stack JSONB NULL` 는 PostgreSQL에서 `NOT NULL DEFAULT` 없이 nullable 컬럼을 추가하므로 테이블 재작성 없이 카탈로그 업데이트만으로 완료된다. 기존 행은 자동으로 NULL이 되며 데이터 손실 없음. `COMMENT ON COLUMN` 도 단순 카탈로그 변경이라 lock 부담 없다.
  - V084(`conversation_thread`)·V085(`user_variables`)와 동일 패턴 — 이미 프로덕션에서 검증된 safe 경로.
  - 주의: `execution` 테이블이 대용량인 경우 `COMMENT ON COLUMN`도 매우 짧은 AccessShareLock을 획득하나 실질적 차단 없음.
- **제안**: 이슈 없음. 무중단 배포에 안전.

---

### **[INFO]** `cancelParkedExecution` — 두 UPDATE의 원자성 부재
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, L1074-1099
- **상세**: `Execution` UPDATE(`status=CANCELLED`)와 `NodeExecution` UPDATE(`status=CANCELLED`) 사이에 명시적 트랜잭션이 없다. 두 UPDATE는 순차 실행이며, Execution이 CANCELLED로 전이된 뒤 NodeExecution UPDATE 전에 worker가 재개 job을 pickup하면 NodeExecution이 WAITING_FOR_INPUT으로 잔류할 수 있다.
  - 단, 코드 주석은 "Execution UPDATE affected:1일 때만 NodeExecution UPDATE 실행"을 명시하며, NodeExecution의 `status = WAITING_FOR_INPUT` 가드가 resume으로 이미 전이된 row는 건드리지 않는다고 기재되어 있다.
  - 실제 경합: Execution이 CANCELLED로 전이된 직후 resume worker가 NodeExecution을 COMPLETED로 전이하면, 이후 cancelParkedExecution의 NodeExecution UPDATE는 `status=WAITING_FOR_INPUT` 가드에 걸려 no-op이 된다 — 정합 유지.
  - 반대 방향(resume worker가 먼저): `isNodeExecutionWaiting` 가드가 WAITING_FOR_INPUT이 아니면 false를 반환해 ack-and-discard. cancelParkedExecution이 이후 Execution UPDATE를 시도해도 `status=WAITING_FOR_INPUT` 가드에 걸려 affected=0 no-op.
  - 두 방향 모두 경합 안전해 보이나, 트랜잭션으로 묶으면 더 명확하다.
- **제안**: 필수 수정 아님. 향후 경합 케이스 추가 시 `dataSource.transaction` 으로 두 UPDATE를 묶는 것을 권장.

---

### **[INFO]** `stageDurableResumeSnapshot` — 스냅샷 스테이징과 DB 영속 사이 간격
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, L9020-9026
- **상세**: `stageDurableResumeSnapshot`은 `execution.conversationThread`·`execution.userVariables`를 in-memory로 세팅만 하고 즉시 save하지 않는다. 호출자가 곧바로 `updateExecutionStatus(..., WAITING_FOR_INPUT, linkedNodeExec)`를 호출하면 같은 트랜잭션으로 commit된다는 설계다(주석 기재). 현재 호출 지점 3곳(form park L3689, button park L5392, AI park L5476/L6477) 모두 스테이징 직후 `updateExecutionStatus`를 호출하므로 설계 의도가 지켜진다. `reparkAiResumeTurn` 내부도 동일.
  - 위험: 스테이징 후 `updateExecutionStatus` 호출 전에 예외가 발생하면 in-memory만 변경된 채 save가 안 되지만, 이 경우 실행 자체가 실패·롤백되므로 stale 스냅샷이 영속되지 않는다.
- **제안**: 이슈 없음. 설계가 명확히 문서화되어 있음.

---

### **[INFO]** `updateExecutionStatus` — 트랜잭션 사용 적절성
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, L9067-9075
- **상세**: `linkedNodeExec`가 있는 경우 `dataSource.transaction`으로 Execution + NodeExecution을 원자적으로 save한다. 이 단일 진입점을 통해 park(WAITING_FOR_INPUT 전이) 시 `conversation_thread`·`user_variables` 스냅샷과 상태 전이가 같은 트랜잭션에 포함된다 — 정합 보장.
  - `linkedNodeExec`가 없는 경우 단순 `executionRepository.save` — 이 경로는 NodeExecution 없이 상태만 전이하는 케이스로, 현재 코드상 RUNNING 진입 등에서 사용.
- **제안**: 이슈 없음.

---

### **[INFO]** `cancelParkedExecution` — `createQueryBuilder` 파라미터화 확인
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, L1074-1099
- **상세**: `.where('id = :id', { id: executionId })`와 `.andWhere('status = :waiting', { waiting: ... })` 형태로 TypeORM 파라미터 바인딩을 사용한다. SQL 인젝션 위험 없음.

---

## 요약

이번 변경의 DB 관련 핵심은 세 가지다. 첫째, V087 마이그레이션(`ADD COLUMN resume_call_stack JSONB NULL`)은 nullable 컬럼 추가로 무중단 배포에 완전히 안전하며 기존 row에 데이터 손실이 없다. 둘째, `stageDurableResumeSnapshot` + `updateExecutionStatus` 패턴은 park 시 상태 전이와 durable 스냅샷을 같은 트랜잭션으로 원자적으로 commit하는 올바른 설계다. 셋째, `cancelParkedExecution`은 두 UPDATE가 트랜잭션 없이 순차 실행되지만 각 UPDATE의 상태 가드(`status=WAITING_FOR_INPUT`)가 양방향 경합을 멱등하게 처리하므로 정합이 유지된다. 전반적으로 DB 설계·마이그레이션 안전성·트랜잭션 사용 모두 적절하며, CRITICAL/WARNING 수준의 문제는 없다.

## 위험도

LOW

STATUS=success ISSUES=4 PATH=/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/review/code/2026/06/06/10_26_12/database.md RESET_HINT=
