# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 파일:
- `spec/5-system/15-chat-channel.md`
- `spec/5-system/11-mcp-client.md`
- `spec/5-system/6-websocket-protocol.md`

---

## 발견사항

### 1. [INFO] `15-chat-channel.md §3.1 CCH-AD-05` 의 EventEmitter 출처 표현과 `Rationale R8` 의 실제 구조 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-05` 및 `§3.2 사이드 채널 명시`
- **충돌 대상**: 동일 파일 `Rationale R8` (2026-05-24)
- **상세**: CCH-AD-05 요구사항 본문은 "NotificationDispatcher 의 after-commit EventEmitter 에 in-process listener 로 attach" 라고 기술한다. 그러나 R8 에 따르면 실제 fan-out source 는 `WebsocketService.executionEvents$` RxJS Subject 이며 `ChatChannelDispatcher` 는 이 subject 의 subscriber 다 — `NotificationDispatcher` 가 직접 EventEmitter 를 노출하지 않는다. §3.2 도 "NotificationDispatcher 가 노출하는 in-process EventEmitter 의 listener" 라고 기술해 같은 오해를 유발한다.
- **제안**: CCH-AD-05 및 §3.2 의 "NotificationDispatcher 의 ... EventEmitter" → "WebsocketService.executionEvents$ RxJS Subject" 로 표현 정정. R8 이 이미 catch-up 완료된 사실을 CCH-AD-05 본문에도 반영.

---

### 2. [INFO] `15-chat-channel.md §7 구현 파일 구조` 의 경로가 R8 실제 구조와 부분 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §7 구현 파일 구조`
- **충돌 대상**: 동일 파일 `Rationale R8` (2026-05-24)
- **상세**: §7 의 `chat-channel.dispatcher.ts` 주석이 "NotificationDispatcher EventEmitter listener" 라고 명시되어 있으나, R8 에 의하면 실제 구현은 `WebsocketService.executionEvents$` 를 구독하는 `ChatChannelDispatcher` 다. 주석 표현이 R8 이전 가정을 유지한다.
- **제안**: §7 해당 행 주석 → "WebsocketService.executionEvents$ subscriber — per-trigger listener registry (R8)" 로 갱신.

---

### 3. [INFO] `spec/1-data-model.md §2.8 Trigger` 의 `config` JSONB 설명 cross-link 가 `hasBotToken` SoT 를 옳게 가리키나, `inboundSigningRef` 의 SoT 참조가 중복 선언됨

- **target 위치**: `spec/1-data-model.md §2.8 Trigger.config JSONB 설명` (prompt 에 포함된 관련 spec 본문)
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.1` / `spec/conventions/chat-channel-adapter.md §2.3`
- **상세**: `1-data-model.md §2.8` 의 `config` 필드 설명이 `chatChannel.inboundSigningRef` 의 SoT 를 "SoT: [conventions/chat-channel-adapter.md §2.3]" 라고 명시한다. 동시에 `15-chat-channel.md §4.1` 에서도 같은 ref 를 정의하고 있어 reader 에게 두 위치 중 어느 것이 원본인지 혼란을 줄 수 있다. 현재는 `chat-channel-adapter.md §2.3` 이 단일 진실이라고 표기하고 있어 논리적 충돌은 없으나, `15-chat-channel.md §4.1` 이 SoT 임을 오해하기 쉬운 전개다.
- **제안**: `15-chat-channel.md §4.1` 에 "`inboundSigningRef` provider 별 의미의 단일 진실 = conventions/chat-channel-adapter.md §2.3" 명시를 좀 더 눈에 띄는 위치에 배치하거나, `1-data-model.md` 의 cross-link 를 명확히 유지하는 것으로 충분.

---

### 4. [INFO] `spec/5-system/11-mcp-client.md §6.2 mcpDiagnostics.serverSummaries[].status` vocabulary 가 `spec/1-data-model.md §2.10 Integration.status` enum 과 다른 값 사용

- **target 위치**: `spec/5-system/11-mcp-client.md §6.2` — `serverSummaries[].status` 값: `connected` / `skipped`
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration.status` enum — `connected` / `expired` / `error` / `pending_install`
- **상세**: `mcpDiagnostics.serverSummaries[].status` 는 `connected` / `skipped` 두 값만 사용하는 런타임 진단 필드다. `skipped` 는 DB Integration.status 어느 값에도 없는 신조어이며, 이 필드가 Integration.status 를 그대로 재사용하는 것이 아님을 spec 에서 명시하지 않는다. 독자가 `status = 'skipped'` 를 DB 컬럼값으로 오해할 여지가 있다.
- **제안**: §6.2 에 "본 `status` 는 런타임 진단 전용 2값 enum (`connected` / `skipped`) 으로 `Integration.status` (DB 컬럼) 와 다른 값이다" 라고 인라인 주석 추가.

---

### 5. [INFO] `spec/5-system/6-websocket-protocol.md §4.6` 매핑 표의 `execution.cancelled` 행 Outbound Notification 항목

- **target 위치**: `spec/5-system/6-websocket-protocol.md §4.6 Server → Client 이벤트 매핑 표`
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-05` / `spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-02`
- **상세**: `6-websocket-protocol.md §4.6` 표에서 `execution.cancelled` 의 Outbound Notification type 이 `execution.cancelled` 로 표기되어 있다. EIA-NX-02 의 이벤트 화이트리스트는 `execution.waiting_for_input` / `execution.completed` / `execution.failed` / `execution.cancelled` / `execution.ai_message` 로 `cancelled` 포함이 일치한다. Chat Channel CCH-AD-05 도 `execution.cancelled` 를 구독 이벤트 목록에 포함시켜 세 곳 모두 정합 — 충돌 없음, 확인 완료.
- **제안**: 해당 없음 (정합 확인 목적).

---

### 6. [INFO] `spec/5-system/11-mcp-client.md §3.1` 의 `Integration.scope` 기본값 표기와 `spec/1-data-model.md §2.10` 간 동기화

- **target 위치**: `spec/5-system/11-mcp-client.md §3.1` — `Integration.scope` 기본 `organization`
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration` — `scope` 필드: `personal / organization`
- **상세**: `11-mcp-client.md` 는 외부 HTTP MCP Integration 의 기본 scope 를 `organization` 으로 기술한다. `1-data-model.md §2.10` 에는 `scope` Enum 의 가능 값 (`personal / organization`) 만 정의되어 있고 서비스별 기본값은 표기하지 않는다. 두 spec 이 직접 모순되지는 않으나, Integration 관리 화면 spec (`spec/2-navigation/4-integration.md §5.6`) 과 함께 삼자 교차 검토 시 `organization` 기본값 일관성을 확인할 필요가 있다. 이번 범위 내 파일에서는 충돌 없음.
- **제안**: 구현 착수 전 `spec/2-navigation/4-integration.md §5.6` MCP Server 섹션에서도 `scope = organization` 기본값이 명시되어 있는지 확인 권장.

---

## 요약

세 대상 spec (`15-chat-channel.md`, `11-mcp-client.md`, `6-websocket-protocol.md`) 은 각각 `spec/1-data-model.md`, `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md`, `spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/7-trigger/providers/_overview.md` 와의 교차 참조를 충분히 명시하고 있으며 **CRITICAL·WARNING 수준의 직접 모순은 발견되지 않았다**. 주요 INFO 사항은 두 가지 내부 표현 불일치(CCH-AD-05 / §3.2 의 "NotificationDispatcher EventEmitter" 표현이 R8 에서 확정된 "WebsocketService.executionEvents$ RxJS Subject" 구조와 불일치)와 `mcpDiagnostics.serverSummaries[].status` 가 DB `Integration.status` enum 과 다른 독자적 2값임을 명시하지 않는 문제다. 이 두 건은 구현 단계에서 코드-spec 간 drift 의 씨앗이 될 수 있으나 기능 자체를 작동 불가로 만드는 모순은 아니다. 나머지 발견사항은 cross-link 명확화 수준으로 구현 진행에 차단 요인이 없다.

## 위험도

LOW
