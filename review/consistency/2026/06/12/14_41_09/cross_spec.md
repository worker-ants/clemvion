# Cross-Spec 일관성 검토 결과

**Target**: `spec/conventions/chat-channel-adapter.md`
**검토 일시**: 2026-06-12
**검토 모드**: spec draft (--spec)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `ChatChannelConfig.botIdentity` 에 `teamId?` 필드 추가 — spec §4.1 예제에 미반영
  - target 위치: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`
  - 충돌 대상: `spec/5-system/15-chat-channel.md §4.1` JSONB 예제
  - 상세: target §2.3 는 `botIdentity?: { botId: number; username: string; teamId?: string }` 로 `teamId?` 를 정의한다. `spec/5-system/15-chat-channel.md §4.1` 의 JSONB 예제는 `botIdentity: { botId: 123456789, username: "myworkflow_bot" }` 로 `teamId` 가 없다. target 스스로 "구조는 Spec Chat Channel §4.1의 단일 진실을 따른다 (drift 회피)" 라고 선언하면서 §4.1 예제에 없는 필드를 추가했다. 단, `spec/4-nodes/7-trigger/providers/slack.md` 는 `botIdentity.teamId: team_id` 를 사용하며 "Convention §2.3 SoT" 라고 명시해 이미 target 을 SoT 로 인정하고 있다. 따라서 target 의 필드 자체는 올바르나, §4.1 예제가 누락된 상태로 두 문서 사이에 shape 불일치가 존재한다.
  - 제안: `spec/5-system/15-chat-channel.md §4.1` 의 `botIdentity` 예제에 `"teamId": "T012ABCDE" // workspace/team 개념 있는 provider 한정 (Slack workspace_id 등)` 주석을 추가해 Convention §2.3 SoT 와 동기화한다.

---

### 발견사항 2

- **[INFO]** `EiaEvent` 타입 내부 주석에서 EIA 외부 표면 spec 번호를 인용하나 실제 수신 경로(내부 이벤트)와 다름
  - target 위치: `spec/conventions/chat-channel-adapter.md §1.2 EiaEvent` — `execution.waiting_for_input` 행의 `/* EIA §6.2 */` 주석, `execution.cancelled` 행의 `/* EIA §6.5 (cancelled) */` 주석
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md §6.2` (interactionType 3종), `§6.5` (cancelled payload에 error? 미정의)
  - 상세: (a) `EiaEvent.execution.waiting_for_input` 은 `interactionType: "form" | "buttons" | "ai_conversation" | "ai_form_render"` 4종을 정의하며 주석은 "EIA §6.2" 를 인용한다. 그러나 EIA §6.2 외부 HTTP 표면은 `ai_form_render` 를 `ai_conversation` 으로 통합해 3종만 노출한다 (`interaction-type-registry §1` 명시). chat-channel dispatcher 는 EIA HTTP 표면이 아닌 내부 `WebsocketService.executionEvents$` (4종 포함) 를 구독하므로 4종 수신은 동작 상 옳다. (b) `EiaEvent.execution.cancelled` 는 `error?: { code: string; message?: string }` 를 포함하며 `/* EIA §6.5 */` 를 인용하나, EIA §6.5 는 `cancelledBy` 만 정의하고 `error?` 를 문서화하지 않는다. `error?` 는 WS §4.2 의 내부 이벤트 경로(`execution.cancelled` + `error.code = RESUME_*`)로 전달된다. 두 경우 모두 실제 동작은 올바르나 주석이 EIA 외부 표면 spec 번호를 인용해 혼란을 준다.
  - 제안: 주석을 "내부 `executionEvents$` 이벤트 shape" 을 명시하는 방향으로 수정한다. 예: `/* 내부 executionEvents$ — EIA §6.2 외부 표면은 3종, 내부는 4종 (ai_form_render 포함) */`, `/* 내부 executionEvents$ — EIA §6.5 외부 표면의 cancelledBy 외에 rehydration 실패 시 error? 추가 (WS §4.2 RESUME_*) */`. 동작 변경 없음, 주석만 정정.

---

### 발견사항 3 (확인 완료, 무충돌)

이하 항목은 검토 과정에서 잠재 충돌로 의심했으나 무충돌로 확인됨:

- **오류 코드 분류 표 (`§3.1`)** — `spec/5-system/3-error-handling.md §1.4` 의 엔진 레벨 코드 (`EXECUTION_TIMEOUT`, `EXECUTION_TIME_LIMIT_EXCEEDED` 등) 및 노드 레벨 코드 (`CODE_MEMORY_LIMIT`, `LLM_RATE_LIMIT` 등) 와 정합. EIA §6.4 는 양 레벨 코드 모두 `execution.failed.error.code` 로 전달한다고 명시해 분류 입력 범위 일치.
- **Rationale ID 네임스페이스** — target 은 `R-CCA-N` / 구 `R1~R4` 를 사용하고, `spec/5-system/15-chat-channel.md` 는 `R-CC-N` 을 사용. 겹치는 ID 없음.
- **EIA 5종 outbound 화이트리스트** — target 이 `ChatChannelInternalEvent` (`execution.node.completed`) 를 별도 타입으로 분리해 EIA §6.1 화이트리스트(5종)를 변경하지 않는다는 점이 EIA R10, CCH-AD-07 과 정합.
- **`WaitingInteractionType` enum** — target 이 내부 4종을 사용하고 외부 표면 3종으로의 매핑이 dispatcher 계층 책임임을 올바르게 기술. `interaction-type-registry §1` 의 "4→3 통합은 chat-channel.dispatcher 및 EIA 응답 DTO 계층 책임" 과 일치.
- **`parseUpdate` null 책임 분리** — 어댑터는 pure(null 반환), 호출자(`HooksService`)가 안내 발송. `spec/5-system/15-chat-channel.md CCH-CV-05` 와 일치.
- **`ChatChannelConfig` 필드 구조** — `formMode`, `visualNode`, `buttonLayout`, `rateLimitPerMinute`, `languageLocale`, `languageHints` 전체가 spec §4.1 JSONB 예제와 일치 (`teamId?` 예외 — 발견사항 1).
- **RBAC/권한** — 어댑터 인터페이스는 인증 계층에 의존하지 않음. 권한 관련 충돌 없음.
- **계층 책임** — `renderNode` (pure) / `sendMessage` (side-effect) 분리, `ackInteraction` vs `openFormModal?` 분리 모두 spec §3.1 CCH-AD-05/CCH-ERR-05 의 책임 분리와 일치.

---

## 요약

target `spec/conventions/chat-channel-adapter.md` 는 전반적으로 기존 spec 영역 (`spec/5-system/15-chat-channel.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/interaction-type-registry.md`, `spec/5-system/3-error-handling.md`) 과 정합한다. CRITICAL 충돌은 없다. 유의미한 발견사항은 WARNING 1건으로, `botIdentity.teamId?` 필드가 Convention §2.3 에 정의돼 있으나 `spec/5-system/15-chat-channel.md §4.1` JSONB 예제에 누락된 shape 불일치다. 이미 Slack 프로바이더 spec 이 Convention SoT 를 올바르게 참조하고 있어 런타임 영향은 없으나, §4.1 예제를 동기화하면 두 문서 사이의 명시적 drift 가 해소된다. INFO 1건은 `EiaEvent` 주석이 내부 `executionEvents$` 경로를 EIA 외부 표면 spec 번호로 잘못 인용하는 문서 오류다.

---

## 위험도

LOW
