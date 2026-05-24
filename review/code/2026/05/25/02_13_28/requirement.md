# 요구사항(Requirement) 리뷰 — fix-chat-channel-dispatcher-and-cafe24-warn

검토 대상: 9개 파일 (websocket.service.ts, execution-engine.service.ts, execution-event-emitter.service.ts, mcp-tool-provider.ts, 관련 spec.ts × 2, plan, consistency summary)

관련 spec: `spec/5-system/15-chat-channel.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/6-websocket-protocol.md`

---

## 발견사항

### [WARNING] Issue 1 수정 — `executeInline` / `executeAsync` / `executeSync` 경로에서 routing context 등록 누락

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `execute()` 메서드 (L767–773)
- **상세**: `registerExecutionRouting` 호출은 `execute()` 의 fire-and-forget 경로에만 삽입되어 있다. plan 의 "영향 영역" 섹션은 `runExecution / executeInline 진입 시 register` 라고 명시하지만, `executeInline()` (L797+), `executeSync()` (L1166+), `executeAsync()` (L1269+) 어느 것도 `registerExecutionRouting` 을 호출하지 않는다. 현 설계에서 chat-channel 트리거가 `executeSync` / `executeAsync` / Background Job 의 `executeInline` 경로로 진입하는 경우 dispatcher fanout envelope 에 routing context 가 첨부되지 않아 수정된 버그가 재현된다.
  - 이들 경로가 현재 실제로 chat-channel triggerId 를 전달하지 않는다면 (즉 HooksService 가 항상 `execute()` 만 호출한다면) 실질 버그는 없지만, plan 의 기술과 코드 범위가 불일치하므로 혼동 위험이 있다. HooksService 가 현재 어떤 경로를 사용하는지 확인해 plan 기술을 수정하거나, 아니면 해당 경로에도 `registerExecutionRouting` 을 삽입하는 것을 권장한다.
- **제안**: `HooksService.handleChatChannelWebhook` 가 어떤 execute 메서드를 사용하는지 확인해 커버리지를 결정할 것. plan 의 "영향 영역" 기술을 실제 구현과 일치시킬 것.

---

### [WARNING] `not_capable` skip 이 `serverSummaries` 에 기록되지 않음 — spec §6.2 진단 계약 미준수

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — `openServer()` L564–573, `buildTools()` L271–314
- **상세**: Spec MCP §6.2 의 `skipReason vocabulary` 는 `not_capable` 값을 `serverSummaries[]` 에 push 하는 것으로 정의된다. `Cafe24McpToolProvider` 는 모든 skip 경로마다 `pushMcpServerSummary(ctx.mcpDiagnostics, {..., skipReason: ...})` 를 호출한다. 그러나 `McpToolProvider.openServer()` 가 `null` 을 반환하는 `not_capable` 경로에서는 `ctx.mcpDiagnostics` 에 아무 항목도 push 하지 않는다 (실제로 `ctx.mcpDiagnostics` 를 `McpToolProvider` 전체 파일에서 단 한 번도 참조하지 않는다). 결과적으로 Cafe24 통합이 `mcpServers` 에 포함된 경우, `meta.mcpDiagnostics.serverSummaries` 에 해당 integration 항목이 나타나지 않아 사용자가 AI Agent 미리보기 패널에서 Cafe24 통합이 처리됐는지 여부를 확인할 수 없다.
  - 이는 WARN 노이즈 제거라는 fix 목표는 달성하지만, spec §6.2 에서 "사용자가 '통합이 보이지 않는다' 원인을 즉시 식별"하기 위해 도입된 `serverSummaries` 의 본래 목적을 `not_capable` 경로에서만 무력화한다.
- **제안**: `openServer()` 가 `null` 을 반환할 때, 혹은 `materializeServer()` 가 `null` entry 를 받았을 때 `pushMcpServerSummary(ctx.mcpDiagnostics, { integrationId: ref.integrationId, serviceType: integration.serviceType, status: 'skipped', skipReason: 'not_capable', toolCount: 0 })` 를 호출하도록 보완할 것. `materializeServer()` 에는 `ctx` 가 인자로 전달되지 않으므로, `ctx` 를 `materializeServer()` 에 전달하거나 `buildTools()` 루프에서 처리해야 한다.

---

### [WARNING] spec §3.2 에 명시된 "NotificationDispatcher in-process EventEmitter" 표현과 구현의 괴리 — consistency check I1 미처리

- **위치**: `spec/5-system/15-chat-channel.md §3.2`, `§7`, `CCH-AD-05`
- **상세**: Spec §3.2 는 "어댑터의 outbound subscription 은 NotificationDispatcher 가 노출하는 in-process EventEmitter 의 listener 로 attach" 라고 명시한다. 그러나 실제 구현은 `WebsocketService.executionEvents$` (RxJS Subject) 를 subscriber 로 사용하며 NotificationDispatcher EventEmitter 패턴이 아니다. 본 PR 은 이 spec 문언을 수정하지 않고 새 routing context 기능을 추가했다. Consistency check I1 에서 이미 "표현 정정 권장" 으로 기록되었으나 본 PR RESOLUTION 에서 별도 처리 여부가 불명확하다. spec 과 구현 간 괴리가 지속되면 후속 개발자가 "NotificationDispatcher EventEmitter" 를 구현 대상으로 오독할 수 있다.
- **제안**: `project-planner` 에 위임해 spec §3.2 / CCH-AD-05 / §7 의 "NotificationDispatcher EventEmitter" 표현을 `WebsocketService.executionEvents$ RxJS Subject` 로 정정하는 별도 spec PR 을 생성할 것.

---

### [INFO] `attachRoutingContext` — `ExecutionRoutingContext` 의 `triggerId` 가 falsy 이면 추가되지 않음

- **위치**: `codebase/backend/src/modules/websocket/websocket.service.ts` — `attachRoutingContext()` L410–411
- **상세**: `ctx.triggerId` 가 존재하지만 빈 문자열(`''`)인 경우 `additions.triggerId` 에 포함되지 않는다. `registerExecutionRouting()` 는 빈 `executionId` 만 가드하고 `triggerId` 빈 문자열은 가드하지 않아(`!executionId` 검사만), 빈 문자열이 등록된 후 `attachRoutingContext` 에서 무음 드롭된다. 실제 호출 사이트(`execution-engine.service.ts` L767: `if (options?.triggerId)`)에서 triggerId 가 있을 때만 등록하므로 실질 위험은 낮지만, 인터페이스 계약 문서가 명시하지 않는다.
- **제안**: 참고 사항 수준. 필요 시 `registerExecutionRouting` 에 `if (!executionId || !context.triggerId) return;` 등의 가드 추가 검토.

---

### [INFO] `extractChatChannelFromInput` — `channelUserKey` 를 검증하지 않고 raw 를 통과시킴

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `extractChatChannelFromInput()` L185–188 (코드 내 주석: "raw 전체를 그대로 통과")
- **상세**: 함수는 `provider` 와 `conversationKey` 만 검증하고 `channelUserKey` 는 type 검증 없이 raw 객체를 통과시킨다. 이는 의도된 설계(주석 명시)이고 `sanitizePayloadForWs` 가 fanout 첨부 시 적용된다. 다만 `chatChannel` 에 `channelUserKey` 가 없는 경우(spec §4.3 의 `channelUserKey: string` 필수 필드)도 dispatcher 가 받는다. ChatChannelDispatcher 가 내부적으로 `channelUserKey` 를 검증하는지 확인 필요.
- **제안**: 참고 사항 수준. 이미 WebsocketService 측 sanitize 로 커버. ChatChannelDispatcher 의 `channelUserKey` 의존성 유무만 확인할 것.

---

### [INFO] Spec `CCH-AD-05` 의 이벤트 목록과 테스트 커버리지

- **위치**: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — routing context 테스트 블록
- **상세**: Spec CCH-AD-05 는 `execution.waiting_for_input`, `execution.ai_message`, `execution.completed`, `execution.failed`, `execution.cancelled` 5종의 이벤트를 명시한다. 테스트는 `ExecutionEventType.AI_MESSAGE` 와 `ExecutionEventType.EXECUTION_COMPLETED` 만 사용하며 `EXECUTION_FAILED`, `EXECUTION_CANCELLED`, `waiting_for_input` 이벤트에 대한 라우팅 첨부 / 터미널 자동 release 검증은 없다. 실질 동작은 `TERMINAL_EXECUTION_EVENTS` Set 으로 보장되지만 테스트 커버리지 차원에서 미비.
- **제안**: 중요도 낮음. 별도 issue 또는 후속 PR 에서 보완 가능.

---

### [INFO] 테스트 spy 방식 — static `logger` 속성 직접 접근 (취약한 테스트 패턴)

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts` L870–876
- **상세**: `(McpToolProvider as unknown as { logger: { warn: jest.Mock } }).logger` 로 private static 멤버에 직접 접근하는 테스트 패턴은 클래스 내부 구현 변경(logger 명칭, 접근 제어자 변경) 시 컴파일 오류 없이 런타임에 `undefined` spy 가 되어 테스트가 의도치 않게 통과될 수 있다. `warnSpy.mockImplementation` 이 no-op 으로 적용되지 않아 실제 WARN 이 출력되더라도 `toHaveBeenCalled()` 가 spy 자체를 못 찾으면 `not.toHaveBeenCalled()` 가 통과한다.
- **제안**: 참고 사항. NestJS Logger 를 DI 로 주입하거나 module-level logger 를 export 해 테스트에서 안전하게 모킹하는 방향 검토.

---

## 요약

이번 변경은 두 가지 실제 회귀를 정확히 식별하고 적절한 방식으로 수정한다.

Issue 1 (chat-channel 응답 누락): `WebsocketService` 에 `executionRouting` Map 을 도입해 fanout envelope 에만 `triggerId`/`chatChannel` 을 첨부하고 wire envelope (frontend) 에는 미첨부함으로써 WS spec §4.4 wire shape 호환성을 유지하는 설계는 spec 의도와 부합한다. `TERMINAL_EXECUTION_EVENTS` 에서 자동 release 하는 lifecycle 관리도 올바르다. 비정상 종료 경로에서 `catch` 블록의 명시 `releaseExecutionRouting` 도 누수 방지 의도가 명확하다.

Issue 2 (Cafe24 WARN 노이즈): `openServer` 가 `throw` 대신 `null` sentinel 을 반환해 `Promise.allSettled` 의 `rejected` 경로를 타지 않게 한 것은 WARN 을 제거하는 올바른 접근이다.

그러나 두 가지 WARNING 이 존재한다: (1) `not_capable` 경로에서 `serverSummaries` push 가 누락되어 spec §6.2 진단 계약이 부분적으로 미준수되고, (2) plan 이 `executeInline` 경로의 routing 등록을 명시했지만 실제 구현에는 반영되지 않아 문서·코드 불일치가 있다. spec fidelity 측면에서는 spec §3.2 / CCH-AD-05 의 "NotificationDispatcher EventEmitter" 표현이 구현과 불일치하나, 이 gap 은 본 PR 이 아닌 별도 spec 갱신으로 해소되어야 하며 consistency check 에서 이미 I1 으로 추적 중이다.

---

## 위험도

MEDIUM
