# 보안(Security) 코드 리뷰

**대상 커밋**: b8f2f18fa6e4eb1a8159b4bbc9ca1ca8fe706ae7
**리뷰 일시**: 2026-06-05
**범위**: PR-A1 — conversationThread durable park 영속 + rehydration 무손실 복원

---

## 발견사항

### [WARNING] JSONB 역직렬화 시 ConversationTurn 필드에 대한 구조 검증 미흡
- 위치: `/codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` — `rehydrateConversationThread` 함수 내 `turns` 처리 (라인 ~1001)
- 상세: `r.turns` 가 배열인지는 검사하지만, 개별 `ConversationTurn` 요소의 필드(`seq`, `nodeId`, `nodeType`, `source`, `text` 등)에 대한 타입·범위 검증이 없다. `r.turns as ConversationTurn[]` 로 단순 캐스트한 뒤 배열을 스프레드(`[...r.turns]`)하므로, 손상되거나 악의적으로 조작된 DB row 의 `turns` 배열에 비정상 값(예: `seq` 가 음수 BigInt, `text` 가 매우 큰 문자열)이 포함될 경우 downstream 소비처(AI 프롬프트 구성, totalChars 계산 등)에 오염된 데이터가 전달될 수 있다.
- 제안: 각 turn 요소에 대해 최소한 `typeof t.text === 'string'` 확인 외에 `seq` 가 안전한 정수 범위 내인지, `source` 가 허용된 enum 값인지, `text` 의 길이가 합리적 상한 이내인지를 검증하는 단계를 추가한다. 손상 turn 은 개별 skip 하거나 전체 리셋(현재 `turns` 배열 손상 시의 동작과 일관성 유지)한다.

### [WARNING] `runningSummary` 크기 상한 없음 — DB에서 unbounded 문자열 복원
- 위치: `/codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` — `rehydrateConversationThread` 내 `runningSummary` 복원 (라인 ~1020-1022)
- 상세: `typeof r.runningSummary === 'string'` 만 확인하고 길이 제한을 두지 않는다. `Execution.conversation_thread` JSONB 컬럼은 PostgreSQL 에서 크기 제한 없이 저장된다. DB 데이터가 비정상적으로 크거나(예: 디스크 직접 조작, 미래 버그에 의한 write) 악용 시나리오에서 매우 큰 `runningSummary` 가 rehydration 후 AI 프롬프트에 삽입될 수 있으며, 이는 DoS 성 토큰 과소비 또는 프롬프트 인젝션 위험을 내포한다.
- 제안: `runningSummary` 복원 시 합리적인 길이 상한(예: 스펙의 `MAX_SUMMARY_CHARS` 또는 별도 상수)을 초과할 경우 trim 하거나 경고 로그 후 빈 summary 로 폴백한다.

### [INFO] `conversationThread` 옵션이 caller 신뢰에 의존 — 호출 경로 검증 부재
- 위치: `/codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` — `createContext` 옵션 처리
- 상세: `CreateContextOptions.conversationThread` 는 rehydration 전용(`§7.5`)으로 문서화되어 있으나, 인터페이스 레벨에서 어떤 caller 라도 임의 thread 를 주입할 수 있다. 현재 코드베이스에서 이 옵션을 사용하는 경로가 `rehydrateContext` 하나뿐인지 명확하지 않으며, 향후 실수로 신뢰되지 않은 외부 입력 유래의 thread 가 주입될 수 있다.
- 제안: 내부 전용임을 `@internal` 주석으로 명시하거나, rehydration 전용 팩토리 메서드로 분리해 일반 `createContext` 에서 `conversationThread` 옵션을 사용할 수 없도록 타입 레벨에서 제한하는 것을 고려한다.

### [INFO] `stageConversationThreadSnapshot` 에서 cloneThread 실패 시 에러 전파 없음
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `stageConversationThreadSnapshot` (라인 ~8409-8614)
- 상세: `stageConversationThreadSnapshot` 는 `cloneThread(context.conversationThread)` 결과를 `execution.conversationThread` 에 직접 할당한다. `cloneThread` 가 예외를 던질 경우 park 전 트랜잭션이 실행되지 않아야 하는데, `stageConversationThreadSnapshot` 자체는 `void` 반환이라 호출자가 에러를 catch 하지 않으면 park 는 성공하되 snapshot 은 누락된 상태로 DB 에 커밋될 수 있다(현재 호출자 3곳은 `this.stageConversationThreadSnapshot(...)` 이후 `await this.updateExecutionStatus(...)` 를 호출하므로 TypeScript 런타임 예외는 전파되나, 향후 변경 시 의도치 않은 silent 실패 가능).
- 제안: 주석 수준에서 "예외 시 상위로 전파되며 park 트랜잭션을 차단한다"는 동작 보장을 명시하거나, try-catch 를 추가해 스냅샷 실패 시 명시적 오류 코드를 던지도록 한다.

### [INFO] JSONB 컬럼에 대한 접근 제어 및 API 노출 검토 필요
- 위치: `/codebase/backend/src/modules/executions/entities/execution.entity.ts` — `conversationThread` 컬럼 추가
- 상세: `Execution` 엔티티에 `conversationThread: ConversationThread | null` 컬럼이 추가되었다. `ExecutionsService.findById` 등 외부 API 응답 DTO 에서 이 컬럼이 직렬화되어 클라이언트에 노출되는지 확인이 필요하다. `runningSummary` 에는 사용자 대화 요약이 포함될 수 있으므로, 불필요한 API 노출 시 개인정보 노출 또는 정보 과다 공개(OWASP A01: Broken Access Control) 위험이 있다.
- 제안: Execution 응답 DTO 에서 `conversation_thread` 가 제외되는지 확인하고, 제외되어 있지 않다면 `@Exclude()` 또는 DTO 변환 레이어에서 명시적으로 제거한다.

### [INFO] 마이그레이션 파일(V083)에 인덱스 미추가
- 위치: `/codebase/backend/migrations/V083__execution_conversation_thread.sql`
- 상세: `conversation_thread JSONB NULL` 컬럼 추가만 있고 인덱스가 없다. 이는 직접적인 보안 취약점은 아니나, 향후 이 컬럼에 대한 쿼리가 전체 테이블 스캔으로 이어질 경우 DoS 성 느린 쿼리 위험이 있다. 현재 rehydration 은 `execution.id` 기반 조회에서 이 컬럼을 함께 로드하는 방식이므로 즉각적인 성능·보안 문제는 없다.
- 제안: rehydration 외에 `conversation_thread` 컬럼을 직접 필터링하는 쿼리가 추가될 경우 GIN 인덱스 추가를 고려한다.

---

## 요약

PR-A1 의 변경은 대화 스레드를 DB 에 영속화하고 복원하는 기능으로, 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션 등의 고전적 인젝션 취약점은 발견되지 않는다. 인증/인가 우회나 암호화 문제도 없다. 주요 보안 관심사는 두 가지다: (1) JSONB 역직렬화 시 `ConversationTurn` 개별 요소의 구조 검증이 미흡해 손상 데이터가 downstream(AI 프롬프트)으로 오염될 수 있고, (2) `runningSummary` 에 크기 상한이 없어 비정상적으로 큰 값이 AI 프롬프트에 그대로 삽입될 가능성이 있다. 두 항목 모두 직접 외부 공격자 제어 경로라기보다는 DB 데이터 손상 또는 내부 버그 시나리오에서 위험이 발현되는 간접적 취약성이다. `Execution` 엔티티의 `conversationThread` 컬럼이 API 응답 DTO 에 노출되는지 별도 확인이 권장된다.

---

## 위험도

LOW

---

STATUS: OK
