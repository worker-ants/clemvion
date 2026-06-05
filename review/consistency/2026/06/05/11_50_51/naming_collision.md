# 신규 식별자 충돌 검토 — exec-park-durable-resume (spec/5-system/)

검토 대상: `plan/in-progress/exec-park-durable-resume.md` 가 도입한 신규 식별자 (A1·A2a 완료분 + Phase B 예고분) 및 연동 spec 갱신 (`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`).

검토 날짜: 2026-06-05

---

## 발견사항

### 요구사항 ID 충돌

발견 없음.

plan 내 단계 표기(Phase A1, A2a, A2b, A3, B1~B3, Phase 0)와 결정 레이블(D1~D5)은 plan 내부 식별자이며 spec 의 요구사항 ID 네임스페이스(`KB-GR-*`, `NAV-*`, `NF-*` 등)와 충돌하지 않는다.

---

### 엔티티/타입명 충돌

발견 없음.

- `rehydrateConversationThread` — `spec/shared/conversation-thread/` 신규 함수. 같은 이름으로 다른 의미를 가진 함수·인터페이스는 코드베이스 어디에도 없다.
- `stageConversationThreadSnapshot` — `execution-engine.service.ts` 내부 함수. 동명 충돌 없음.
- `CHECKPOINT_SCHEMA_VERSION` — `execution-engine.service.ts` 모듈 상수(값 1). 동일 이름으로 다른 목적에 사용된 상수는 없다.

---

### **[INFO]** `schemaVersion` 필드명 — checkpoint JSONB 내부 키 vs 범용 관행

- target 신규 식별자: `_resumeCheckpoint.schemaVersion` (정수 필드, `NodeExecution.outputData` JSONB 내부)
- 기존 사용처: `schemaVersion` 은 OpenAPI/JSON Schema 등에서 메타 버전 키로 자주 사용되는 범용 이름. 현재 이 코드베이스에서 `schemaVersion` 을 동일 이름으로 다른 JSONB 구조에 쓰는 사례는 확인되지 않는다.
- 상세: JSONB 내부 키이므로 충돌 표면이 작지만, 향후 다른 핸들러의 checkpoint(A2b `information_extractor` 등)가 같은 `schemaVersion` 필드를 공유하게 되므로 네임스페이스가 깨질 여지는 없다. 오히려 설계상 공유를 의도한 필드다.
- 제안: 현재는 충돌 없음. A2b 이후 추가 핸들러도 동일 `schemaVersion` 키를 사용할 것을 plan 이 명시(`buildRetryReentryState` 공유)하므로 정합.

---

### API endpoint 충돌

발견 없음.

Phase A1·A2a 는 신규 HTTP endpoint 를 도입하지 않는다. Phase B 또한 endpoint 를 추가하지 않으며 내부 큐/rehydration 경로만 변경한다.

---

### 이벤트/메시지명 충돌

발견 없음.

plan 이 도입한 식별자 중 새 WebSocket 이벤트는 없다. `document:graph_*` 이벤트군(기존)과의 이름 충돌도 없다. `execution-continuation` BullMQ 큐 이름은 기존 spec(`spec/5-system/4-execution-engine.md §7.4`)에서 이미 정의된 것을 그대로 사용하며 plan 이 새로 부여한 이름이 아니다.

---

### **[INFO]** `RESUME_BULLMQ_ATTEMPTS` — spec 에서 env 변수처럼 언급되나 `.env.example` 미등재

- target 신규 식별자: `RESUME_BULLMQ_ATTEMPTS` (spec `4-execution-engine.md §7.5`, `3-error-handling.md §93` 에서 참조)
- 기존 사용처: 코드(`continuation-execution.queue.ts`, `continuation-execution.processor.ts`)에서 상수로만 사용. `.env.example` 에는 없음.
- 상세: spec 에서 "환경변수 `RESUME_BULLMQ_ATTEMPTS`(기본 3)" 으로 표기되어 있으나 실제 구현은 코드 상수이며, `EXECUTION_MAX_ACTIVE_RUNNING_MS` 처럼 `.env.example` 에 등재되지 않았다. 운영자가 오버라이드 가능한 env 로 의도된 것인지 코드 상수로 고정된 것인지 spec 기술이 모호하다.
- 제안: spec 에서 "env 변수 override 가능"인지 "코드 상수"인지 한 곳에서 명확히 하고, 만약 override 가능하다면 `.env.example` 에 추가한다. 충돌은 아니며 명확화 권장.

---

### 파일 경로 충돌

발견 없음.

- `codebase/backend/migrations/V084__execution_conversation_thread.sql` — V083 에 이어지는 순번 사용, 기존 V084 파일 없음. 정상.
- spec 파일 변경은 기존 파일 업데이트(신규 파일 없음)이므로 경로 충돌 없음.

---

### **[INFO]** `conversationThread` vs `conversation_thread` 이중 표기

- target 신규 식별자: DB 컬럼 `conversation_thread`(V084, `spec/1-data-model.md §2.13`), TypeScript 필드/컨텍스트 프로퍼티 `conversationThread`
- 기존 사용처: `ExecutionContext.conversationThread` 는 기존 in-memory 프로퍼티, `ConversationThread` 타입 역시 기존 도메인 타입.
- 상세: snake_case(DB 컬럼)↔camelCase(TS) 이중 표기는 NestJS TypeORM 패턴에서 정상 관행이다. `execution.entity.ts` 에서 `@Column({ name: 'conversation_thread' })` + TS 프로퍼티 `conversationThread` 로 매핑하는 것이 확인된다. 네이밍 혼동 가능성은 있으나 충돌이 아닌 정상 패턴.
- 제안: 추가 조치 불필요.

---

## 요약

`exec-park-durable-resume` plan(A1·A2a 완료 + Phase B 예고)이 도입한 신규 식별자(`conversation_thread` 컬럼, `CHECKPOINT_SCHEMA_VERSION`, `schemaVersion` 체크포인트 필드, `rehydrateConversationThread`, `stageConversationThreadSnapshot`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `RESUME_FAILED`, `RESUME_BULLMQ_ATTEMPTS`)에서 기존 사용처와 의미상 충돌하는 항목은 없다. 모든 식별자는 실행 엔진 내부 전용 네임스페이스에 격리되어 있고, 기존 에러 코드 어휘(`WORKER_HEARTBEAT_TIMEOUT`, `INVALID_EXECUTION_STATE`)와도 의미·형식이 구별된다. 두 건의 INFO 는 `RESUME_BULLMQ_ATTEMPTS` 의 env/상수 역할 모호성과 `schemaVersion` 범용 이름 사용에 대한 명확화 권장 사항이며, 차단 사유는 아니다.

## 위험도

NONE
