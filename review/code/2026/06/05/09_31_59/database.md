# Database Review

## 발견사항

### **[INFO]** JSONB 컬럼에 인덱스 없음 — 현재 설계 상 불필요
- 위치: `codebase/backend/migrations/V083__execution_conversation_thread.sql` L81
- 상세: `execution.conversation_thread` JSONB 컬럼은 rehydration 시 `Execution` 행을 `id` PK로 직접 조회한 후 컬럼 값을 읽는 구조다. `conversation_thread` 내부 필드를 조건 절(WHERE)로 사용하는 쿼리가 없으므로 GIN/BTREE 인덱스 추가는 불필요하며 올바른 설계다.
- 제안: 해당 없음. 향후 thread 내용 기반 검색 쿼리가 추가되는 경우 GIN 인덱스 검토.

### **[INFO]** 마이그레이션 안전성 — 무중단 배포 적합
- 위치: `codebase/backend/migrations/V083__execution_conversation_thread.sql` L80-84
- 상세: `ALTER TABLE execution ADD COLUMN conversation_thread JSONB NULL` 는 PostgreSQL에서 DEFAULT 없는 nullable 컬럼 추가이므로 테이블 리라이트 없이 카탈로그 메타데이터만 갱신한다(즉시 완료, AccessShareLock). 기존 row는 NULL로 남고 애플리케이션은 NULL을 빈 thread로 처리하도록 설계돼 있어 롤포워드·롤백 모두 회귀가 없다. `COMMENT ON COLUMN`도 DDL lock을 추가로 요구하지 않는다.
- 제안: 해당 없음.

### **[INFO]** 트랜잭션 원자성 — park 스냅샷과 상태 전이 동일 트랜잭션 보장
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L3416-3420, L4954-4958, L5931-5935
- 상세: `stageConversationThreadSnapshot`은 `execution.conversationThread`에 값을 메모리 레벨로 설정한 후, 곧이어 호출되는 `updateExecutionStatus(... WAITING_FOR_INPUT ...)`가 해당 `execution` 엔티티를 DB에 저장하는 트랜잭션 안에서 컬럼을 함께 기록한다. thread 스냅샷과 상태 전이가 원자적으로 commit 되므로 정합성이 보장된다. 다만, `stageConversationThreadSnapshot` 호출 후 `updateExecutionStatus` 호출 사이에 예외가 발생하더라도 메모리 객체만 변경된 것이고 DB commit은 되지 않으므로 영속 상태에는 영향 없다.
- 제안: 해당 없음.

### **[INFO]** JSONB 컬럼 크기 — 대용량 thread 주의
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/migrations/V083__execution_conversation_thread.sql`
- 상세: `conversation_thread` JSONB에 저장되는 데이터 크기는 turns 배열 길이와 각 turn의 text 크기에 비례한다. 코드에는 `STORAGE_MAX_TURNS` eviction 로직이 존재해 turns 수가 제한되므로 일반적인 케이스에서는 문제가 없다. 단, `runningSummary` 필드는 크기 제한이 별도로 명시되지 않아 이론적으로 큰 값이 저장될 수 있다. PostgreSQL JSONB는 행 크기 상한인 8KB(TOAST 경계)를 초과하면 자동으로 TOAST 처리하므로 기능상 오류는 없으나 읽기 성능에 영향을 줄 수 있다.
- 제안: 저위험. `runningSummary` 최대 길이 제한이 상위 로직(AI Agent 요약 생성)에서 이미 보장된다면 무시 가능.

### **[INFO]** SQL 인젝션 — 파라미터화된 쿼리 사용 확인
- 위치: `execution-engine.service.ts` 전반
- 상세: TypeORM 엔티티 기반 저장(`repository.save()`, `updateExecutionStatus`)을 사용하며 raw SQL이 없다. `rehydrateConversationThread`는 DB에서 읽어온 JSONB를 역직렬화(파싱)하는 함수로 SQL을 구성하지 않는다. SQL 인젝션 위험 없음.
- 제안: 해당 없음.

## 요약

이번 변경의 핵심 DB 작업은 `execution` 테이블에 nullable JSONB 컬럼(`conversation_thread`)을 추가하는 V083 마이그레이션이다. `ADD COLUMN ... JSONB NULL` 은 PostgreSQL에서 테이블 락 없는 즉시 완료 DDL이므로 무중단 배포에 안전하다. park 시 thread 스냅샷과 `waiting_for_input` 상태 전이가 동일 TypeORM 트랜잭션으로 원자적으로 commit 되며, NULL 회귀 처리 및 손상 graceful 복구 로직도 적절히 구현돼 있다. 인덱스 누락, N+1, SQL 인젝션, 커넥션 관리 등 다른 DB 관점의 문제는 발견되지 않았다.

## 위험도

NONE

---

STATUS=success ISSUES=0
