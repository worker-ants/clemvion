# 신규 식별자 충돌 검토 — web-chat-preview-improvements

> 검토 모드: `--impl-prep` (구현 착수 전)
> Target: `plan/in-progress/web-chat-preview-improvements.md`

---

## 발견사항

### 1. [WARNING] `execution.message` 이벤트명 — `EiaEventName` 유니언 미포함

- **target 신규 식별자**: `execution.message` (Phase 1 §1, Phase 4 §1)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/channel-web-chat/src/lib/eia-types.ts` L46-54 — `EiaEventName` 유니언 타입이 현재 허용 이벤트 이름을 열거 (`execution.started` / `execution.waiting_for_input` / `execution.ai_message` / `execution.resumed` / `execution.completed` / `execution.failed` / `execution.cancelled` / `execution.replay_unavailable`). 이 타입이 위젯 SSE 이벤트 라우팅 진입점(`eia-client.ts:144` `es.addEventListener(name, ...)`)에서 사용된다.
- **상세**: plan 이 신설하려는 `execution.message`(SSE 이벤트 이름)는 `EiaEventName` 에 없다. 의미 충돌은 없지만, `EiaEventName` 을 참조하는 코드가 exhaustive-type-check 를 사용하는 경우 새 이름 추가 시 compile error 가 발생하거나 silent-ignore 된다. 현재 `eia-client.ts` 는 string literal 타입 파라미터로 `addEventListener` 를 호출하므로 타입 체크가 취약한 편이나, 구현 시 `EiaEventName` 을 확장하지 않으면 타입 범위 밖의 이벤트를 처리하게 된다.
- **제안**: 구현 시 `EiaEventName` 유니언에 `"execution.message"` 를 추가하고, `eia-types.ts` 에 `ExecutionMessageEvent` 인터페이스(`{ nodeId, nodeType, presentations: Array<{config, output}> }`)를 함께 신설한다. plan Phase 2 §1 의 `MessageEvent`(또는 재사용) wire 타입 추가는 기존 DOM `MessageEvent` 와 이름이 겹치므로 아래 항목 2 참조.

---

### 2. [WARNING] `MessageEvent` 타입명 — DOM 전역 `MessageEvent` 와 충돌 가능

- **target 신규 식별자**: plan Phase 2 §1 "eia-types.ts 에 `MessageEvent`(또는 재사용) wire 타입 추가"
- **기존 사용처**: DOM 전역 `MessageEvent` 가 같은 코드베이스 내 광범위하게 사용됨 — `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:22-29`, `host-bridge.ts:45`, `eia-client.ts:15`, `demo-host.tsx:74` 등 수십 곳이 `MessageEvent`(DOM) 를 참조. `eia-types.ts` 가 같은 이름을 export 하면 import 시 namespace 충돌이 발생한다.
- **상세**: `eia-types.ts` 는 이미 `AiMessageEvent` 처럼 도메인-specific prefix 를 붙이는 컨벤션을 따른다 (L84). plan 이 단순히 `MessageEvent` 를 추가하면 shadowing/ambiguity 가 생긴다. "(또는 재사용)" 문구가 있어 plan 이 인지하고 있으나 명시적 결론이 없다.
- **제안**: `ExecutionMessageEvent` 로 명명해 기존 `AiMessageEvent` 네이밍 컨벤션과 일관되게 유지한다.

---

### 3. [INFO] `EXECUTION_MESSAGE` enum 멤버 — `EXECUTION_MESSAGE_TOO_LONG` 과 prefix 공유

- **target 신규 식별자**: `ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'` (Phase 1 §1)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/backend/src/modules/websocket/websocket.service.ts` L66-163 의 `ExecutionEventType` enum. 기존 멤버 중 `EXECUTION_MESSAGE_TOO_LONG`(에러 코드, `spec/5-system/3-error-handling.md` 및 `4-execution-engine.md`) 과 prefix 4글자까지 동일하다.
- **상세**: `EXECUTION_MESSAGE` (이벤트 타입 enum) 와 `EXECUTION_MESSAGE_TOO_LONG` (WS 에러 코드, `ws-error-codes.ts`) 는 서로 다른 네임스페이스에 존재해 직접 충돌은 없다. 그러나 코드 검색 시 함께 히트되어 혼동을 유발할 수 있다. 특히 plan §4(회귀 점검 grep) 에서 `ExecutionEventType` exhaustive switch 소비처를 grep 할 때 `EXECUTION_MESSAGE_TOO_LONG` 와 구분이 필요하다.
- **제안**: 충돌은 아니므로 수정 불필요. 단, JSDoc 에 "SSE/WS 이벤트 타입 — 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 와 무관" 을 명시하면 grep 혼동을 방지할 수 있다 (plan 에 이미 JSDoc 작성 지시가 있어 자연스럽게 포함 가능).

---

### 4. [INFO] `resetSession` command action — 기존 `wc:command` action 열거에 미등록

- **target 신규 식별자**: `wc:command { action: "resetSession" }` (Phase 2 §3, Phase 3 §1)
- **기존 사용처**: `spec/7-channel-web-chat/2-sdk.md` L86 — `wc:command` payload 의 `action` 허용값 목록: `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown`. `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/channel-web-chat/src/widget/use-widget.ts` L474-497 — `switch(cmd.action)` 이 동일 7개만 처리하고 default 없음(묵시 ignore). 기존 명칭 중 `resetSession` 과 동일한 것은 없다.
- **상세**: `resetSession` 은 기존 action 과 중복·충돌 없음. 그러나 spec `2-sdk.md` L86 의 `wc:command` action 목록과 `use-widget.ts` `onCommand` switch 양쪽 모두 업데이트가 필요하다. plan Phase 3 §1 은 위젯 side 추가만 언급하고 spec `2-sdk.md` 업데이트를 명시하지 않는다 (Phase 4 §2 는 `5-admin-console.md` 만 언급). 명명 충돌 문제는 아니나, 이 행동 명세가 누락되면 spec-impl 드리프트가 발생한다.
- **제안**: Phase 4 spec 갱신 항목에 `spec/7-channel-web-chat/2-sdk.md §3` 의 `wc:command` action 목록에 `resetSession` 추가를 포함한다.

---

### 5. [INFO] `postCommand` 헬퍼명 — `live-preview.tsx` 내 기존 `postBoot` 와 대칭적, 충돌 없음

- **target 신규 식별자**: `postCommand(action)` 헬퍼 (Phase 3 §1)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/frontend/src/components/web-chat/live-preview.tsx` L70 의 `postBoot`. `postCommand` 와 동일 파일 내 충돌 이름은 없다.
- **상세**: plan 이 `postBoot` 와 동형(widgetOrigin 가드)이라고 명시하여 패턴을 재사용한다. 기존 코드에 `postCommand` 가 없으므로 신설로 안전하다.
- **제안**: 없음 (단순 정보).

---

### 6. [INFO] `PRESENTATION_NODE_TYPES` 상수명 — 엔진 로컬 신설 시 `chat-channel.dispatcher.ts:40` 와 이름 중복

- **target 신규 식별자**: 엔진 레이어 내 `PRESENTATION_NODE_TYPES` (Phase 1 §2)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L40 에 동일명 `const PRESENTATION_NODE_TYPES = new Set<string>(['carousel','table','chart','template'])` 가 이미 모듈-로컬로 존재한다.
- **상세**: plan §2 가 먼저 이 상수의 기존 위치(`chat-channel.dispatcher.ts:40`)를 확인하도록 지시하고 있다. 이미 동일 이름·동일 내용의 상수가 chat-channel 모듈에 존재하므로, 엔진 레이어에 "엔진 로컬 상수"를 신설하면 두 곳에 동일 정보가 분산된다.
- **제안**: 공용 위치(예: `src/common/constants/presentation.ts` 또는 노드 registry) 로 이동·공유하거나, 기존 상수를 `chat-channel.dispatcher.ts` 에서 import 해 재사용한다. 엔진이 chat-channel 을 직접 import 하면 의존 방향 위반이므로 공용 모듈로 추출이 적합하다. plan 이 "없으면 엔진 로컬 상수" 라고 허용하고 있으나, 이미 존재하므로 추출·공유가 명확히 권장된다.

---

## 요약

target plan 이 도입하는 신규 식별자(`execution.message` 이벤트, `EXECUTION_MESSAGE` enum 멤버, `resetSession` command action, `postCommand` 헬퍼, `MessageEvent` wire 타입, `PRESENTATION_NODE_TYPES` 상수)는 기존에 동일 의미로 이미 쓰이는 식별자와 직접 충돌하지 않는다. 그러나 두 건의 WARNING 이 존재한다. (1) `execution.message` 가 `EiaEventName` 유니언에 추가되지 않으면 타입 경계 밖에서 처리되는 구현 위험, (2) plan 이 제안한 `MessageEvent` 타입명이 DOM 전역 `MessageEvent` 와 겹쳐 import shadowing 을 일으킬 수 있다 — `ExecutionMessageEvent` 로 이름을 확정하면 해소된다. 그 외 INFO 4건은 일관성 보완 제안(JSDoc 명시, spec `2-sdk.md` 업데이트, `PRESENTATION_NODE_TYPES` 공유, `postCommand` 충돌 없음 확인)이다.

## 위험도

LOW
