# 신규 식별자 충돌 검토 — Durable Continuation & Graceful Shutdown

검토 범위: `spec/5-system/` (`--impl-prep`)
대상 변경 파일: `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`, `spec/1-data-model.md`, `spec/0-overview.md`, `spec/data-flow/3-execution.md`, `spec/4-nodes/6-presentation/0-common.md`

---

## 발견사항

### **[INFO]** BullMQ 큐 이름 `execution-continuation` — 폐기 채널명과 hyphen/colon 차이

- target 신규 식별자: BullMQ 큐 이름 `execution-continuation` (§9.3 신규 표, §7.4)
- 기존 사용처: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` line 34 — `export const CONTINUATION_CHANNEL = 'execution:continuation'` (Redis pub/sub 채널)
- 상세: 두 식별자는 의미적으로 동일한 개념(continuation fan-out 전달 채널/큐)이나, 분리자가 `:` → `-` 로 바뀌었다. spec 이 "폐기" 를 명확히 선언해 의미 중복 충돌은 없지만, 구현 시점에 `CONTINUATION_CHANNEL = 'execution:continuation'` 상수를 제거하지 않으면 코드베이스에 두 식별자가 공존하게 된다. 현재 `continuation-bus.service.spec.ts` line 223 이 `CONTINUATION_CHANNEL` 상수 값을 `'execution:continuation'` 로 단언하고 있어, 신규 큐 도입 후 이 테스트가 제거/갱신되어야 한다.
- 제안: 구현 PR 에서 `CONTINUATION_CHANNEL` 상수와 해당 pub/sub 구독·publish 코드를 동시에 제거. spec 의 폐기 선언(`§9.2`, §Rationale)은 충분하므로 spec 변경 불필요.

---

### **[INFO]** `ContinuationMessage` 신규 필드 `nodeExecutionId` — 기존 스키마 확장

- target 신규 식별자: `ContinuationMessage.nodeExecutionId: string` (§7.4 메시지 스키마)
- 기존 사용처: `continuation-bus.service.ts` line 23–26 — 현재 `ContinuationMessage` 는 `{ type, executionId, payload? }` 3필드. `nodeExecutionId` 없음.
- 상세: 신규 필드 추가이며 기존 필드명과 충돌하지 않는다. 단, 기존 코드에서 `ContinuationMessage` 를 구성·소비하는 모든 호출 지점(publisher: `execution-engine.service.ts`, subscriber: `continuation-bus.service.ts`)이 필드 추가에 맞춰 갱신되어야 한다. 스키마 누락 시 nodeExecutionId 가 undefined 로 전달되어 §7.5 rehydration 이 동작하지 않는다.
- 제안: 구현 착수 시 `ContinuationMessage` 타입 정의 + 모든 publisher 위치에서 `nodeExecutionId` 를 필수 필드로 선언. spec 변경 불필요.

---

### **[INFO]** ENV var `SIGTERM_GRACE_MS` — 유사 패턴 상수 `CAFE24_MODULE_SHUTDOWN_GRACE_MS` 존재

- target 신규 식별자: 환경변수 `SIGTERM_GRACE_MS` (§11 Graceful Shutdown 표)
- 기존 사용처: `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts` — `CAFE24_MODULE_SHUTDOWN_GRACE_MS` (코드 내부 상수, 환경변수 아님)
- 상세: `CAFE24_MODULE_SHUTDOWN_GRACE_MS` 는 하드코딩된 코드 상수(`REFRESH_JOB_WAIT_TIMEOUT_MS + 1_000`) 이고, `SIGTERM_GRACE_MS` 는 `process.env` 로 읽는 ENV var 이다. 두 식별자는 네임스페이스·타입이 다르므로 충돌하지 않는다. 다만 naming 패턴(`*_GRACE_MS`)이 같아 혼동 가능성은 낮으나 존재한다.
- 제안: 충돌 없음. 혼동 방지를 위해 `SIGTERM_GRACE_MS` 를 `.env.example` 에 기록할 때 "전역 앱 종료 유예 시간 (Cafe24 모듈의 CAFE24_MODULE_SHUTDOWN_GRACE_MS 와 무관)" 한 줄 주석 추가 권장(선택).

---

### **[INFO]** ENV var `RESUME_BULLMQ_ATTEMPTS` — 기존 BullMQ attempts 설정과 병존

- target 신규 식별자: 환경변수 `RESUME_BULLMQ_ATTEMPTS` (§11 표, §7.4)
- 기존 사용처: `background-execution` 큐의 attempts 는 코드 내부 상수로 관리 (`background-execution.queue.ts`). ENV 화되지 않음.
- 상세: `RESUME_BULLMQ_ATTEMPTS` 는 기존 어느 ENV var 와도 이름이 겹치지 않는다. spec 자체가 "현재 양쪽 모두 코드 상수, ENV 화는 후속" 을 명시해 구현 우선순위를 일치시켰다.
- 제안: 충돌 없음.

---

### **[INFO]** `STUCK_RECOVERY_STALE_MS` — 기존 코드 private 상수명 그대로 spec 에 노출

- target 신규 식별자: spec 본문에서 `STUCK_RECOVERY_STALE_MS` 를 임계값 이름으로 언급 (§7.4 Recovery 절)
- 기존 사용처: `execution-engine.service.ts` line 627 — `private static readonly STUCK_RECOVERY_STALE_MS = 30 * 60 * 1000` (ENV var 아님, class 내부 상수)
- 상세: spec 이 기존 코드 상수 이름을 그대로 참조하고 있어 의미 일치. 단, spec 은 이 값을 ENV var 처럼 표기하지 않았고("임계값 (`STUCK_RECOVERY_STALE_MS`)") 괄호 주석으로 설명한다. 충돌 없음.
- 제안: 충돌 없음.

---

### **[INFO]** WS ack 신규 필드 `queued: boolean` — 기존 WS ack payload 와 이름 충돌 없음

- target 신규 식별자: `queued: boolean` (§4.2 WS ack payload — `execution.click_button.ack` 등 4개 명령 공통)
- 기존 사용처: `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts` — `embeddingRequeued`, `graphRequeued` 필드. WS 프로토콜 ack 에는 `queued` 필드 없음.
- 상세: 기존 WS ack payload 에 `queued` 필드는 없다. KB DTO 의 `Requeued` suffix 와는 다른 문맥이라 충돌 없음.
- 제안: 충돌 없음.

---

### **[INFO]** WS 에러 코드 `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` — 기존 에러 코드와 충돌 없음

- target 신규 식별자: `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` (§4.2 버튼 클릭 에러 코드 표, 공통 적용)
- 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts` — `INTERACTION_TIMEOUT`, `INVALID_BUTTON_ID` 등 기존 코드 목록. `RESUME_` prefix 코드 없음.
- 상세: `RESUME_` prefix 는 기존 에러 코드 어휘에 없다. `spec/5-system/3-error-handling.md` 및 `node-output.md` 의 공통 에러 네임스페이스와도 겹치지 않는다.
- 제안: 충돌 없음. 구현 시 `error-codes.ts` 에 세 코드를 추가할 때 UPPER_SNAKE_CASE 컨벤션(`node-output.md Principle 3.2`) 이 그대로 적용됨을 확인.

---

### **[INFO]** Execution.error.code 신규 어휘 `SERVER_INTERRUPTED` — 기존 에러 코드와 충돌 없음

- target 신규 식별자: `SERVER_INTERRUPTED` (§1.3 / `spec/1-data-model.md §2.13`)
- 기존 사용처: `error-codes.ts` 및 기존 spec 에 `SERVER_` prefix 에러 없음.
- 상세: 충돌 없음.
- 제안: 충돌 없음. `SERVER_SHUTTING_DOWN` (`POST /api/executions/start` 503 응답 코드) 와 이름 패턴이 다르므로 혼동 낮음.

---

### **[INFO]** BullMQ 큐 목록 §9.3 의 `task-queue` — 이름 미확정 명시

- target 신규 식별자: `task-queue` (§9.3 표에 "구현 검증 후 본 행 확정/삭제" 단서 포함)
- 기존 사용처: `execution-engine.module.ts` 에 `task-queue` 명시 없음. 실제 큐 이름 확인되지 않음.
- 상세: spec 자체가 "현행 spec §4.2 에 큐 이름이 명시되지 않은 채로 운영 중 — Phase 2 구현 시 실제 이름 확인 후 §4.2 표 갱신" 이라고 단서를 달았다. 이름이 미확정이므로 충돌 분석 불가.
- 제안: 구현 Phase 2 에서 실제 큐 이름을 확인해 §9.3 과 §4.2 를 동시에 갱신. spec 의 단서 기재 자체는 적절함.

---

## 요약

이번 변경이 도입하는 신규 식별자(`execution-continuation` BullMQ 큐, `nodeExecutionId` 메시지 필드, `SERVER_INTERRUPTED` / `RESUME_*` 에러 코드, `SIGTERM_GRACE_MS` / `RESUME_BULLMQ_ATTEMPTS` ENV var, `queued: boolean` WS ack 필드)는 기존 코드베이스 및 spec 의 어떤 식별자와도 의미 충돌이 없다. 유일하게 주의가 필요한 지점은 폐기 대상인 Redis pub/sub 채널 상수 `CONTINUATION_CHANNEL = 'execution:continuation'` 으로, 구현 PR 에서 이 상수와 연관 구독·publish 코드를 함께 제거하지 않으면 두 식별자가 코드 내에 공존하게 된다. spec 은 폐기를 명확히 선언했으므로 spec 수준에서는 충돌이 없고, 구현 착수 체크리스트 항목으로 남긴다.

## 위험도

LOW
