# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `CreateContextOptions` 인터페이스에 `conversationThread?` 옵션 추가 — 기존 호출자 영향 없음
- 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` — `CreateContextOptions` 인터페이스
- 상세: `conversationThread?: MutableConversationThread` 는 선택적(optional) 필드로 추가되었다. 기존의 모든 `createContext(...)` 호출자는 이 옵션을 전달하지 않아도 되며, 미지정 시 `createEmptyConversationThread()` 를 그대로 사용하므로 기존 동작이 완전히 보존된다. 시그니처 변경은 하위 호환성을 깨지 않는다.
- 제안: 없음 (의도된 설계, 회귀 없음).

### [INFO] `stageConversationThreadSnapshot` — 인자로 받은 `Execution` 엔티티 객체를 직접 변경(in-place mutation)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `stageConversationThreadSnapshot` 메서드 (라인 609–614)
- 상세: 헬퍼는 `execution.conversationThread = cloneThread(...)` 를 통해 호출자가 전달한 `Execution` 객체를 직접 변경한다. 이는 의도된 설계이며, TypeORM 이 `updateExecutionStatus` 내 트랜잭션에서 동일 `execution` 인스턴스를 persist 할 때 변경 내용이 자동으로 포함되어 별도 DB 왕복 없이 원자 commit 이 가능하다. 그러나 이 패턴은 호출자가 `stageConversationThreadSnapshot` 이후 반드시 `updateExecutionStatus` 를 호출해야만 스냅샷이 실제 DB 에 기록된다는 암묵적 의존성을 만든다. 현재 3개 park 지점(form/button/ai) 모두에서 `stageConversationThreadSnapshot` → `updateExecutionStatus` 순서가 지켜지고 있어 안전하다.
- 제안: 향후 park 진입 경로가 추가될 경우 `updateExecutionStatus` 호출 전 `stageConversationThreadSnapshot` 을 빠뜨리면 스냅샷이 커밋되지 않는다. 두 호출의 결합을 `updateExecutionStatus` 내부에서 수행하거나, JSDoc 에 "반드시 `updateExecutionStatus` 를 쌍으로 호출해야 한다"는 @seeAlso 를 명시하면 실수를 줄일 수 있다.

### [INFO] `rehydrateConversationThread` — 새 공개 export 함수 추가
- 위치: `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` — `rehydrateConversationThread` 함수
- 상세: 기존 파일에 새 공개 함수가 추가되었다. 이 함수는 외부 상태를 변경하지 않고 입력 `raw` 를 읽어 새로운 `MutableConversationThread` 를 반환하는 순수 함수(pure function)다. 입력 객체를 변경하지 않으며(`turns` 는 얕은 복사 `[...r.turns]`) 전역 상태 접근도 없다. 신규 export 이므로 기존 import 에 영향을 주지 않는다.
- 제안: 없음 (부작용 없음).

### [INFO] `Execution.conversationThread` 엔티티 컬럼 추가 — REST API / DTO 노출 여부 확인 권장
- 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` — `conversationThread: ConversationThread | null`
- 상세: TypeORM `@Column` 데코레이터로 신규 컬럼을 추가했다. `execution.entity.ts` 에 컬럼이 추가되면 해당 엔티티를 serialize 하는 `ExecutionsService` 또는 `/executions/{id}` REST 응답 DTO 가 `conversationThread` 를 그대로 클라이언트에 노출할 수 있다. 대화 이력(turn 텍스트, `runningSummary`) 은 사용자 데이터이므로 DTO 매핑 계층에서 의도치 않게 노출되는지 확인이 필요하다. 단 diff 범위 안에서는 DTO 변경이 없으며, 기존 DTO 가 `plainToClass` / `Exclude` 로 컬럼을 이미 선별 노출한다면 문제가 없다.
- 제안: `ExecutionResponseDto` 또는 `ExecutionController` 의 serialize 경로에서 `conversationThread` 가 API 응답에 포함되지 않는지 확인한다. 노출이 불필요하다면 `@Exclude()` 데코레이터를 entity 컬럼 또는 DTO 에 명시적으로 추가한다.

### [INFO] `rehydrateContext` docstring 에서 기존 "conversationThread 미복원" 주석 제거
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `rehydrateContext` JSDoc (라인 1163–1167)
- 상세: 기존 주석 `"conversationThread — 본 phase 에서는 빈 thread 로 시작"` 이 삭제되고 새 복원 설명으로 대체되었다. 이는 stale 주석 정정이며 동작 변경이 아니다.
- 제안: 없음.

### [INFO] SQL 마이그레이션 V083 — DDL 전용, DML 없음
- 위치: `codebase/backend/migrations/V083__execution_conversation_thread.sql`
- 상세: `ALTER TABLE execution ADD COLUMN conversation_thread JSONB NULL` 은 기존 row 에 `NULL` 을 채워 컬럼을 추가한다. `DEFAULT NULL` 이므로 배포 이전 row 는 자동으로 `NULL` 이 되어 기존 rehydration 경로(빈 thread 반환)가 그대로 유지된다. 배포 전 실행 중인 row 의 상태 전이에 영향을 주지 않는다. Flyway/Liquibase migration guard 통과가 커밋 메시지에서 확인된다.
- 제안: 없음 (DDL 전용, 회귀 없음).

---

## 요약

이번 변경은 `Execution.conversation_thread JSONB NULL` 컬럼 신설(V083 마이그레이션), TypeORM 엔티티 추가, park 직전 스냅샷 스테이징(`stageConversationThreadSnapshot`), 그리고 `rehydrateContext` 에서의 thread 복원(`rehydrateConversationThread`)으로 구성된다. 부작용 관점에서 주목할 점은 세 가지다. (1) `CreateContextOptions.conversationThread` 는 선택적 필드로 기존 호출자를 전혀 깨지 않는다. (2) `stageConversationThreadSnapshot` 이 `Execution` 객체를 in-place 변경하는 패턴은 의도적이고 현재 3개 park 지점 모두 `updateExecutionStatus` 와 쌍으로 호출되어 안전하지만, 향후 park 경로 추가 시 스냅샷 누락 위험이 존재한다. (3) 신규 `conversationThread` 엔티티 컬럼이 REST API DTO 를 통해 의도치 않게 클라이언트에 노출되지 않는지 serialize 경로 확인이 권장된다. 전역 변수 변경, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
