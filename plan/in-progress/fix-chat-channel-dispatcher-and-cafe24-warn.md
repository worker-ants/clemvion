---
name: fix-chat-channel-dispatcher-and-cafe24-warn
status: in-progress
worktree: .claude/worktrees/fix-chat-channel-dispatcher-and-cafe24-warn-68da78
branch: claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78
created: 2026-05-25
owner: developer
related_specs:
  - spec/5-system/15-chat-channel.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/11-mcp-client.md
---

# fix(chat-channel + mcp): 응답 누락 + Cafe24 통합 WARN 노이즈

두 회귀를 단일 PR 로 묶어 수정.

## 배경

사용자 보고 (2026-05-25):
- Telegram bot 에 메시지 보내도 답장 안 옴. AI Agent preview 패널에서는 정상 응답.
- Cafe24 통합이 mcpServers 에 포함된 워크플로 실행 시 매 turn 마다 `MCP server … is not service_type='mcp' (got cafe24)` WARN.

## Issue 1 — Telegram/Slack/Discord 응답 전체 누락

### 원인

`ChatChannelDispatcher.handle()` (`codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:78-90, 118-122`) 와
`NotificationFanout.handle()` (`codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:78-85`) 는
- `event.payload.triggerId` 가 string 이어야 통과
- `chatChannel.conversationKey` 가 string 이어야 통과

하지만 `ExecutionEngineService.execute()` 는 `options.triggerId` 와 `input.chatChannel` 을 받아도 그 값을 `Execution` row 의 컬럼(`triggerId`)/`inputData` 에만 저장하고 emit 되는 이벤트 payload 에는 절대 주입하지 않음.

증거:
- `execution-engine.service.ts` 전체에서 `triggerId` 등장 위치는 type 선언(L379-381) + row 저장(L729) 단 2곳.
- AI_MESSAGE emit payload (L2391-2413, L2507-2530) 는 `{nodeExecutionId, nodeId, message, turnCount, messages, presentations?, metadata}` 만.

결과: 모든 chat-channel outbound 발송이 silent 차단. NotificationFanout 도 같은 회귀.

### Preview 가 작동하는 이유

Frontend 가 `execution:<id>` 채널 직접 join → `WebsocketGateway.broadcastToChannel` envelope 그대로 받음. dispatcher 경로 미경유.

### 수정 방향

`WebsocketService` 에 `(executionId → {triggerId, chatChannel})` 등록 API 추가:
- `registerExecutionRouting(executionId, {triggerId?, chatChannel?})` — `runExecution` 진입 직후 호출
- `releaseExecutionRouting(executionId)` — `releaseSeqCounter` 와 동일 lifecycle (terminal event 후)

`emitExecutionEvent` 안에서:
- wire envelope (frontend 노출): 기존 그대로 — `triggerId/chatChannel` 미주입 (spec §4.4 wire shape 보존)
- fanout envelope (internal subscriber): 등록된 routing context 가 있으면 첨부 → `executionEventSubject.next` 에만

wire / facade 분리는 spec §4.4 wire shape 호환성 유지를 위한 보수적 선택. dispatcher / fanout 는 fanout envelope 에서 가드 통과.

### Spec 정합

- spec/5-system/15-chat-channel.md §3 "어댑터의 outbound subscription 은 NotificationDispatcher 가 노출하는 in-process EventEmitter 의 listener" — dispatcher 가 trigger 식별 가능해야 한다는 implicit requirement. 본 fix 가 그 wire 를 구현. spec 본문 변경 불필요.

## Issue 2 — Cafe24 통합 시 `is not service_type='mcp'` WARN

### 원인

`McpToolProvider.openServer` (`codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:559-563`) 가 `serviceType !== 'mcp'` 일 때 `throw new Error(...)`. `Promise.allSettled` 가 잡아 L306-310 에서 WARN 으로 기록.

`Cafe24McpToolProvider` 는 비대칭으로 `serviceType !== 'cafe24'` 일 때 silent `continue`. 카페24 통합이 mcpServers 에 한 건이라도 있으면 매 turn 마다 WARN 노이즈.

### 수정 방향

`McpToolProvider.openServer` 에서 `serviceType !== 'mcp'` 분기:
- throw 제거 → silent skip (caller 에 `null` 반환)
- `materializeServer` 에서 null 받으면 `[]` 반환
- `buildTools` 에서 fulfilled value 가 `[]` 면 그대로 spread (변경 없음)
- WARN 미발생

### Spec 정합

- spec/5-system/11-mcp-client.md §6.2 `skipReason` vocabulary 에 이미 `not_capable` 정의 — "본 provider 가 처리할 대상 아님 (provider 라우팅 정상 동작 확인용)". 두 provider 가 자기 service_type 외에는 silent skip + serverSummaries push 안 함 (Cafe24McpToolProvider 의 현 동작) 패턴이 spec 의도. 본 fix 가 이 invariant 회복.

## 진행 체크

- [x] 0. worktree 생성 + plan 작성
- [x] 1. 스펙 분석 (spec/5-system/15-chat-channel + 11-mcp-client + 6-websocket-protocol) — spec 변경 불필요
- [x] 2. consistency-check --impl-prep — BLOCK: NO, 본 fix 범위와 무관한 W1~W5 (별 PR 책임)
- [x] 3. DOCUMENTATION 매트릭스 점검 — 매칭 0건 (backend 회귀 fix only, 사용자 가시 변경 없음)
- [ ] 4. Issue 1 TDD (WebsocketService routing context + emit envelope)
- [ ] 5. Issue 1 구현
- [ ] 6. Issue 2 TDD (McpToolProvider silent skip)
- [ ] 7. Issue 2 구현
- [ ] 8. TEST WORKFLOW (lint / unit / build / e2e)
- [ ] 9. REVIEW WORKFLOW (/ai-review + RESOLUTION)
- [ ] 10. PR 생성·push (단일 PR)

## Consistency-check 결과

세션: `review/consistency/2026/05/25/01_36_06/SUMMARY.md`

- BLOCK: NO
- 본 fix 범위와 무관한 WARNING 5건만 검출 (별 PR 책임):
  - W1/W2/W3 (plan-coherence): `6-websocket-protocol.md §4.2/§4.4` 에 다른 plan 들 (workflow-resumable-execution / spec-drift-ws-button-config / retry-handler-followup) 이 결정 대기. 본 fix 는 envelope wrapper 보강만으로 §4.2/§4.4 wire shape 미변경 → 영향 없음
  - W4 (convention): `15-chat-channel.md` frontmatter pending_plans 정리 — 별 PR
  - W5 (naming): `R8` Rationale ID 충돌 (EIA R8 vs CCH R8) — 별 PR

## DOCUMENTATION 매트릭스 점검 결과

PROJECT.md §변경 유형 → 갱신 위치 매핑 17개 항목 점검 — 매칭 0건:

- 새 노드 / 노드 schema / UI 문자열 / 통합 / 가이드 섹션 / API 추가 / warning·errorCode / cross-cutting enum / ui.label / handler output field / 인증·권한·세션 흐름 / 표현식 언어 / 실행·디버깅 흐름 / 환경 변수 / spec 변경 / user-guide GUI 흐름 → **전부 해당 없음**

근거: backend 내부 회귀 fix — frontend 가 보는 wire envelope shape 보존 (WebSocket spec §4.4 호환), 사용자 가시 라벨/가이드 변경 없음, spec 본문 변경 없음 (consistency-check 에서도 확인), partial-implementation 분리 개념 N/A (회귀 fix).

## 영향 영역

- `codebase/backend/src/modules/websocket/websocket.service.ts` — routing context 등록 API + fanout envelope 보강
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — runExecution / executeInline 진입 시 register, terminal 시 release
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` — openServer/materializeServer silent skip 패턴
- 단위 테스트: 세 파일의 `.spec.ts` 보강

frontend / spec / 사용자 가이드 / i18n 영향 없음 (backend 회귀 fix only).
