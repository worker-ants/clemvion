# 신규 식별자 충돌 검토 — chat-channel outbound 비-blocking presentation + AI render_*

검토 대상: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 일시: 2026-05-25

---

## 발견사항

### 1. 요구사항 ID 충돌

**[INFO] CCH-AD-07 — 기존 코퍼스에 부재 확인, 충돌 없음**
- target 신규 식별자: `CCH-AD-07`
- 기존 사용처: `spec/5-system/15-chat-channel.md §3.1` 에 `CCH-AD-01`~`CCH-AD-06` 까지만 존재. `CCH-AD-07` 은 어디에도 미등재.
- 상세: Round 1 에서 C-1 (`CCH-AD-06` 중복) 을 발견·수정한 결과 `CCH-AD-07` 로 교체한 것이 올바르게 반영되었다. 기존 `CCH-AD-06` 은 "인터랙션 응답 처리 — `InteractionService.interact` in-process 직접 호출" 의미로 이미 등재되어 있으므로 target 이 이를 사용하지 않은 것은 정합하다.
- 제안: 이상 없음.

**[INFO] CCH-MP-06 — 기존 코퍼스에 부재 확인, 충돌 없음**
- target 신규 식별자: `CCH-MP-06`
- 기존 사용처: `spec/5-system/15-chat-channel.md §3.3` 에 `CCH-MP-01`~`CCH-MP-05` 만 존재. `CCH-MP-06` 은 미등재.
- 상세: 충돌 없음.
- 제안: 이상 없음.

**[INFO] CCH-MP-01 (갱신) — 기존 ID 재사용, 의미 확장**
- target 신규 식별자: `CCH-MP-01 (갱신)` — presentations[] 처리를 추가하는 보강.
- 기존 사용처: `spec/5-system/15-chat-channel.md §3.3 line 76`, `spec/4-nodes/7-trigger/providers/telegram.md §5.1`, `spec/4-nodes/7-trigger/providers/slack.md §5.1`, `spec/4-nodes/7-trigger/providers/discord.md §5.1` — 모두 같은 의미("AI Multi Turn `execution.ai_message` → 채널 텍스트 메시지 변환")의 동일 ID.
- 상세: ID 자체의 의미 충돌이 아니라 기존 정의를 superset 으로 확장하는 패턴. R-CC-13 의 Discord v1 유예 cross-ref 도 CCH-MP-01 을 참조하고 있어 보강 후 cross-ref 는 유효하게 유지된다.
- 제안: target 의 갱신 정책 자체는 올바르나, `spec/4-nodes/7-trigger/providers/discord.md §5.1` 의 CCH-MP-01 언급 행도 함께 갱신하여 "`presentations[]` 처리 의무가 Discord v1 outbound `POST /channels/{id}/messages` 에 적용 가능" 여부를 명시할 것. 현재 target 은 `§Rationale R-CC-13 보강` 항에서 Discord v1 포함을 언급하고 있으나, 개별 provider spec 의 §5.1 반영은 대상으로 명시하지 않았다.

---

### 2. 엔티티/타입명 충돌

**[WARNING] `ChatChannelInternalEvent` — 기존 코퍼스에 부재하나 naming 패턴 일관성 점검 필요**
- target 신규 식별자: `ChatChannelInternalEvent` (TypeScript type, `spec/conventions/chat-channel-adapter.md §1.3` 신설)
- 기존 사용처: 없음 (`grep -rn ChatChannelInternalEvent spec/ codebase/` 결과 0건). `EiaEvent`, `EiaWaitingForInputEvent`, `EiaAiMessageEvent` 등 기존 타입은 `spec/conventions/chat-channel-adapter.md §1.2` 및 `codebase/backend/src/modules/chat-channel/types.ts` 에 선언되어 있으나, `ChatChannelInternalEvent` 는 신규.
- 상세: 기존 type 명명은 `Eia*Event` (EIA 기원 이벤트) 패턴. 신규 타입은 `ChatChannelInternal*` prefix 로 명확히 구분되어 혼동 가능성은 낮다. 다만 `codebase/backend/src/modules/chat-channel/types.ts` 에 같은 이름의 타입이 미래에 다른 의미로 먼저 구현될 경우 drift 위험이 있으므로 spec 갱신과 구현 PR 을 동일 ticket 으로 묶도록 플랜에 명시 권장.
- 제안: 이상 없음 (충돌 없음). 구현 PR 에서 `types.ts` 에 동명 타입이 선언되지 않았음을 확인 후 신설.

**[INFO] `EiaAiMessageEvent` — 기존 코드에 존재, target 의 필드 추가는 확장(superset)**
- target 신규 식별자: `EiaAiMessageEvent.presentations?: PresentationPayload[]` 필드 추가
- 기존 사용처: `codebase/backend/src/modules/chat-channel/types.ts:199` — `EiaAiMessageEvent` 인터페이스 이미 선언. 현재 `presentations?` 필드 없음 (line 199~206 기준).
- 상세: target 이 기존 인터페이스에 optional 필드를 추가하는 superset 확장이므로 기존 코드 호환성은 유지된다. spec 의 `§1.2` type 블록과 코드의 `EiaAiMessageEvent` 사이의 drift 가 신설 필드로 해소된다.
- 제안: 이상 없음.

**[INFO] `renderPresentationNode` — 기존 코퍼스에 부재 확인, 충돌 없음**
- target 신규 식별자: `renderPresentationNode` 함수 (ChatChannelAdapter 인터페이스 §1.1 7번째 행 추가)
- 기존 사용처: `spec/conventions/chat-channel-adapter.md §1.1` 6함수 표에 `renderNode` 는 있으나 `renderPresentationNode` 는 없음. `codebase/` 에도 0건.
- 상세: `renderNode` 와 이름이 유사하나 역할이 구별된다 (`renderNode` = `EiaEvent` → `ChannelMessage[]`, `renderPresentationNode` = `ChatChannelInternalEvent` → `ChannelMessage[]`). 입력 타입이 서로 달라 서명(signature) 수준에서 구분 가능하다. 단, §1.1 표의 제목이 "6함수 책임 / 부작용 / 멱등성" 으로 고정되어 있는데 target 이 이를 "7함수"로 교체하는 제목 갱신을 명시해야 한다 — target 본문에는 "6함수 → 7함수 표 확장" 으로 서술하고 있어 표 제목 자체도 갱신 대상임을 명확히 표기할 것.
- 제안: 이상 없음.

---

### 3. API endpoint 충돌

**[INFO] 신규 API endpoint 없음 — 해당 없음**
- target 은 새 HTTP endpoint 를 도입하지 않는다. 변경은 모두 in-process 이벤트 처리 및 spec 타입 정의 범위에 한정된다.

---

### 4. 이벤트/메시지명 충돌

**[WARNING] `execution.node.completed` — 기존 이벤트 이름을 chat-channel-internal 용도로 재사용**
- target 신규 식별자: `ChatChannelInternalEvent` variant `{ type: "execution.node.completed"; ... }` — chat-channel-internal 구독 전용 신규 용도.
- 기존 사용처:
  - `spec/5-system/14-external-interaction-api.md line 347, 752` — SSE 디버깅 이벤트로 정의 (`execution.node.started / execution.node.completed / ...` 디버깅 이벤트 집합).
  - `spec/5-system/6-websocket-protocol.md line 89, 184, 187, 709` — WebSocket 프로토콜의 `execution.node.completed` 이벤트. payload: `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }`.
  - `spec/5-system/4-execution-engine.md line 1125` — "재개 사실은 `execution.node.completed` / `execution.node.started` 이벤트로 충분히 관측 가능" 언급.
  - `spec/data-flow/8-notifications.md line 323` — 예시로 사용.
- 상세: `execution.node.completed` 이름 자체는 기존에 존재하나 **다른 context** (WebSocket 프로토콜 / EIA SSE 디버깅 이벤트)에서 사용 중. target 은 이 이름을 `ChatChannelInternalEvent` union 의 variant type 으로 재사용하면서 payload shape 이 다르다. 기존 WS 이벤트 payload 는 `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` (6-websocket-protocol.md §4.1·§4.4), target 의 `ChatChannelInternalEvent` payload 는 `{ executionId, triggerId, workflowId, node: { id, type, label? }, output, meta?, timestamp, seq }`. 두 payload 가 다른 표면(WS vs internal Subject)에 존재하므로 **런타임 혼용 위험은 없으나**, 검토자가 이름만 보고 두 이벤트를 같은 것으로 오해할 수 있다.
  - target 은 이를 의식하여 "외부 SDK 미노출 — chat-channel-internal 한정" 을 명시하고 있으며, 구독 소스(`WebsocketService.executionEvents$`)가 WS 브로드캐스트와 같은 Subject임을 명시하고 있다.
  - 그러나 `WebsocketService.executionEvents$` Subject 가 emit 하는 payload shape 이 `6-websocket-protocol.md §4.4` 기준인지, 아니면 target 의 `ChatChannelInternalEvent` shape 인지가 spec 에 명확히 정의되어 있지 않다. R8 (15-chat-channel.md §542) 에 따르면 `WebsocketService.executionEvents$` 는 `ChatChannelDispatcher` 가 구독하는 RxJS Subject 로 이미 사용 중이나, 그 Subject 가 emit 하는 `execution.node.completed` payload 의 SoT 가 어디인지 target spec 이 명시하지 않는다.
- 제안: `spec/conventions/chat-channel-adapter.md §1.3` 의 `ChatChannelInternalEvent` type 선언에 주석을 추가하여 "payload shape 은 `WebsocketService.executionEvents$` 가 emit 하는 raw 이벤트 형식 그대로 (SoT: `spec/5-system/6-websocket-protocol.md §4.1`)이며, EIA SSE 디버깅 이벤트 (`14-external-interaction-api.md §5.2`)와 동명이지만 별도 표면" 임을 명시할 것. 또한 payload field `triggerId` / `workflowId` 가 WS 프로토콜 §4.1 의 `execution.node.completed` 에 실제로 포함되는지 확인 후 spec 과 구현이 일치하도록 기재할 것 (WS §4.1 payload 에는 `triggerId` / `workflowId` 가 명시되어 있지 않음 — `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` 6필드만).

**[INFO] `ChatChannelInternalEvent` 의 `execution.node.completed` 에 `triggerId` / `workflowId` 필드 — WS §4.1 payload 미포함 필드**
- target 신규 식별자: `ChatChannelInternalEvent.execution.node.completed` 의 `triggerId`, `workflowId` 필드.
- 기존 사용처: `spec/5-system/6-websocket-protocol.md §4.1 line 184` — `execution.node.completed` payload 는 `{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }`. `triggerId` / `workflowId` 없음.
- 상세: `WebsocketService.executionEvents$` Subject 가 `triggerId`/`workflowId` 를 포함하지 않는다면 어댑터가 sub-filter 에서 이 두 필드에 접근할 수 없다. chat-channel 어댑터가 `triggerId` 로 trigger 를 특정해야 할 경우 `executionId` → trigger lookup 이 필요하다. EIA 5종 이벤트 payload 는 `triggerId` / `workflowId` 를 포함하나 (CCH-AD-05 경로), `execution.node.completed` WS 이벤트는 이를 포함하지 않는다.
- 제안: target 은 `WebsocketService.executionEvents$` 에서 `triggerId` / `workflowId` 가 제공되지 않을 경우를 대비하여 `executionId` 기반 trigger 조회 방식을 명시하거나, `ChatChannelInternalEvent` type 의 해당 필드를 optional 로 선언하거나, Subject emit payload 에 두 필드가 포함됨을 WS 프로토콜 spec 에서 근거를 인용하도록 수정할 것.

---

### 5. 환경변수·설정키 충돌

**[INFO] 신규 ENV var / config key 없음 — 해당 없음**
- target 은 새 환경변수나 config 키를 도입하지 않는다.

---

### 6. 파일 경로 충돌

**[INFO] 신규 spec 파일 없음 — 갱신 대상 파일만**
- target 이 갱신하는 파일:
  - `spec/conventions/chat-channel-adapter.md` (기존 존재)
  - `spec/5-system/15-chat-channel.md` (기존 존재)
  - `spec/5-system/14-external-interaction-api.md` (기존 존재)
- 신규 파일 경로 없음. 파일명/경로 충돌 해당 없음.

---

### 7. Rationale ID 충돌

**[INFO] 신규 Rationale ID 부재 — 기존 R-CC-13 보강만**
- target 은 기존 `R-CC-13` 에 한 줄을 추가하는 방식으로 기술하고 있으며, 신규 `R-CC-N` ID 를 부여하지 않는다.
- 기존 R-CC-15 이후 연번 `R-CC-16` 이 미사용 상태이므로, 만약 결정 근거를 별도 Rationale 항목으로 분리하려 한다면 `R-CC-16` 이 사용 가능하다.
- 제안: 기존 R-CC-13 보강 방식을 유지한다면 충돌 없음. 별도 ID 신설 시 `R-CC-16` 사용 가능.

---

### 8. Section anchor 충돌 (보조 관점)

**[WARNING] `chat-channel-adapter.md §3.1` — 기존 섹션에 신규 매핑 표 추가 시 cross-link 단절 위험**
- target 신규 식별자: `chat-channel-adapter.md §3.1 신설 — ChatChannelInternalEvent → renderPresentationNode 매핑` (별도 표)
- 기존 사용처: `spec/conventions/chat-channel-adapter.md §3.1` 은 이미 "Execution Failed 분류 알고리즘" 으로 정의되어 있고, `spec/5-system/15-chat-channel.md line 94`, `line 155`, `line 221`, `line 662`, `line 665` 가 `[conventions/chat-channel-adapter.md §3.1]` 을 "Execution Failed 분류 알고리즘" 으로 cross-link 하고 있다.
- 상세: target 의 "§3.1 신설" 이라는 표현은 혼란을 유발한다. 실제로 target 이 도입하려는 것은 **§3 매핑 표에 별도 sub-table 추가** (ChatChannelInternalEvent → renderPresentationNode 매핑)로, 이는 §3 본문 확장이지 §3.1 을 대체하거나 신설하는 것이 아니다. target 의 "**§3.1 신설 — `ChatChannelInternalEvent → renderPresentationNode` 매핑**" 이라는 헤딩은 기존 `§3.1 Execution Failed 분류 알고리즘` 과 **anchor 충돌**을 일으킨다.
- 제안: "§3.1 신설" 이 아닌 "§3.2 신설" 또는 "§3 에 별도 표 추가" 로 명칭을 변경하여 기존 §3.1 anchor 를 보존할 것. 기존 §3.1 에 대한 15-chat-channel.md 내 5곳의 cross-link 가 깨지지 않도록 anchor 를 유지해야 한다.

---

## 요약

target 이 도입하는 주요 식별자(`CCH-AD-07`, `CCH-MP-06`, `ChatChannelInternalEvent`, `renderPresentationNode`)는 기존 코퍼스에 없으며 의미 충돌은 없다. `EiaAiMessageEvent` 의 `presentations?` 필드 추가는 기존 코드에 대한 superset 확장으로 호환성이 유지된다. 그러나 두 가지 주의 사항이 있다. 첫째, `execution.node.completed` 이벤트 이름은 기존 WS 프로토콜(`6-websocket-protocol.md §4.1`) 및 EIA SSE 디버깅 이벤트에서 이미 사용 중이며, `ChatChannelInternalEvent` payload (`triggerId`, `workflowId` 포함)가 `WebsocketService.executionEvents$` Subject 가 실제로 emit 하는 WS §4.1 payload (`{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` 6필드)와 일치하는지가 spec 에서 근거 없이 전제되어 있다. 둘째, target 이 `chat-channel-adapter.md §3.1 신설` 이라고 기술한 부분이 기존 `§3.1 Execution Failed 분류 알고리즘` anchor 와 충돌하며, 이는 15-chat-channel.md 의 5곳 cross-link 단절로 이어질 수 있다.

## 위험도

MEDIUM
