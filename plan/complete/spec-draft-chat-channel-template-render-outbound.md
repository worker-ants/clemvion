---
worktree: chat-channel-template-render-outbound-2f8164
started: 2026-05-25
owner: project-planner
type: spec-draft
---
# Spec Draft — chat-channel outbound 의 비-blocking presentation + AI render_* presentations[] 발화

## 회귀 원인 (사용자 보고 2026-05-25)

워크플로: `Manual Trigger → Carousel (buttons) → Template (본문 "카페24와 날씨에 대한 문의가 가능해요.") → AI Agent`

증상:
- Carousel waiting_for_input → 텔레그램 발화 ✓ (CCH-MP-02 정상)
- Template 실행 (3ms 완료, output.rendered 존재) → **텔레그램 발화 누락** ✗
- AI Agent ai_message 응답 → 텔레그램 발화 ✓ (CCH-MP-01 정상)
- AI Agent 가 `render_carousel`/`render_template` 등 도구 호출 → 텔레그램에 presentation 미노출 ✗

## 진단

### 회귀 ① — Template (비-blocking presentation) 발화 누락

- EIA §6.1 outbound 이벤트 화이트리스트 5종 (`waiting_for_input` / `completed` / `failed` / `cancelled` / `ai_message`) 에 `node.completed` 없음. `execution.node.completed` 는 SSE 디버깅 이벤트로만 정의 (EIA §5).
- `chat-channel.dispatcher.ts:24-30` `SUBSCRIBED_EVENTS` 도 동일 5종만 listen.
- `spec/conventions/chat-channel-adapter.md §3` 매핑 표가 **비-blocking presentation 본문 발화를 정의하지 않음**.
- 결론: spec 가 의도해 chat-channel 비발화로 결정한 게 아니라 **정의 부재 (gap)**. 사용자 보고는 자연스러운 챗봇 UX 기대 → spec 보완 필요.

### 회귀 ② — AI Agent `render_*` presentations[] 발화 누락

- **EIA §6.5 line 536 명시**: `WS payload 의 presentations?: PresentationPayload[] 필드 (AI Agent render_* 표현 도구 호출 turn 에서만 동봉) ... 도 그대로 전달된다 — 외부 클라이언트 (SDK) 는 본 필드 존재 시 chat UI 에서 텍스트와 함께 inline 렌더 가능.`
- 그러나 `EiaAiMessageEvent` variant (`spec/conventions/chat-channel-adapter.md §1.2` line 89) 에 `presentations` 필드 누락 + `chat-channel-adapter.md §3` 매핑 표의 `execution.ai_message` 행이 `text` 1건 만 정의.
- 결론: CCH-MP-01 최초 작성 시점에 EIA §6.5 `presentations` 약속이 선행·동시 도입되었으나 chat-channel spec 연동이 누락된 것 — **의도적 기각 아님, drift 회귀**. type 보강 + 매핑 정의 의무.

## 결정

### 결정 1 — Template (비-blocking presentation) 발화: `renderNode` union 시그니처 확장 + 별도 이벤트 타입 신설

**채택**: `EiaEvent` union 은 EIA §6 outbound 5종 그대로 유지 (drift 회피 원칙 보존). 별도 타입 `ChatChannelInternalEvent` (현재 단일 variant: `execution.node.completed` presentation 노드 한정) 신설. **`renderNode` 시그니처를 union 입력으로 확장** — `renderNode(event: EiaEvent | ChatChannelInternalEvent, config)`. **함수 개수는 6 그대로 유지** ([R-CCA-5 대안 2](../../spec/conventions/chat-channel-adapter.md#r-cca-5) 의 "새 함수 추가 = 인터페이스 drift" 정신 보존). chat-channel dispatcher 는 R8 의 in-process fan-out 경로 (NotificationDispatcher / `WebsocketService` 단일 sink) 를 그대로 사용하고 presentation 노드 한정 sub-filter 로 `execution.node.completed` 도 픽업. per-trigger `ChannelListenerRegistry` 가드 정책 (R8) 그대로 유지.

**EIA §6.1 outbound HTTP webhook 5종 화이트리스트는 변경 없음** — `ChatChannelInternalEvent` 는 chat-channel-internal 한정 (외부 SDK 미노출).

**EIA-RL-04 (TX commit 후 발송) 보장**: `WebsocketService.executionEvents$` Subject 는 `WebsocketService.emitToExecution` 이 단일 sink (실행 엔진 §4.4) 이며 모든 emit 은 TX commit 후 호출됨. NotificationDispatcher after-commit hook 와 동일 contract — R10 정합.

근거:
- 외부 HTTP webhook 표면 (EIA notification) 확장은 SDK breaking change 가능 — 5종 화이트리스트 안정성 유지.
- `EiaEvent` 라는 type 이름 자체가 EIA spec §6 약속 5종을 의미 — chat-channel-internal 이벤트를 동일 union 에 섞으면 의미 경계 붕괴 (round 1 C-2 발견).
- 새 함수 추가는 [R-CCA-5 대안 2](../../spec/conventions/chat-channel-adapter.md#r-cca-5) 가 명시 기각 ("6함수 인터페이스 drift, 모든 provider 어댑터 contract 변경"). 본 결정은 `renderNode` 시그니처를 `EiaEvent | ChatChannelInternalEvent` union 입력으로 확장해 함수 개수를 6 그대로 유지 — R-CCA-5 정신과 정합. `renderNode` 의 "pure / side-effect free" 책임도 그대로 유지 (union 입력만 확장).
- `renderNode` 가 union 입력을 받는 패턴은 이미 EIA §6 5종 union 을 처리하므로 신규 패턴 아님 (variant 1종 추가에 해당).

**범위 (어떤 비-blocking presentation 발화?)**:
- `Template` (non-blocking 모드, `output.rendered` 본문) — 핵심 회귀 케이스.
- `Carousel` / `Table` / `Chart` (non-blocking 모드 — buttons 없음 케이스). 사용자 시각 표시가 정상 UX. v1 fallback (`uiMapping.visualNode` 분기) 그대로 적용 — `CCH-MP-04` 의 카드/테이블/차트 렌더링 로직 재사용. SSR PNG 는 `chat-channel-visual-ssr-png` plan 별도 추적.
- `Form` 은 buttons 와 무관하게 항상 blocking — 본 결정 대상 아님.

**presentation 노드의 "non-blocking 완료" 판별 기준**: `nodeExec.outputData.status !== 'waiting_for_input'` (i.e., blocking 진입 안 한 경우만). blocking presentation 은 이미 `execution.waiting_for_input` (interactionType=buttons) 흐름이 처리. `0-common.md §2 포트 토폴로지` 의 non-blocking vs blocking 정의가 SoT.

**기각 대안**:
- (A) EIA §6.1 outbound notification 화이트리스트 6종으로 확장 (`node.completed` 추가) — 외부 webhook SDK breaking change. 모든 SDK 사용자가 새 이벤트 처리 의무. 본 회귀는 chat-channel 전용 UX 갭이므로 외부 표면 확장 불필요.
- (B) chat-channel 이 `execution.waiting_for_input` 의 conversationThread 안에 누적된 presentation turn 으로부터 역추론 — 비-blocking presentation 본문은 `conversationThread` 에 영속화되지 않으므로 (presentation_user 가 아님) 역추론 자체가 불가능한 케이스 존재.
- (C) Template 등 비-blocking presentation 노드에 dummy `buttons: [continue]` 추가 의무화 — UX 회귀. 사용자가 명시적 인터랙션 없이 본문만 보여주는 케이스 차단.
- (D) `EiaEvent` union 에 `execution.node.completed` variant 추가 — `EiaEvent` 의미 경계 붕괴 (consistency-check C-2). 별도 type 으로 분리한 본 결정이 더 깔끔.

### 결정 2 — AI Agent `render_*` presentations[] 발화: EiaAiMessageEvent variant 보강 + 매핑 정의

**채택**:
- `chat-channel-adapter.md §1.2` 의 `execution.ai_message` variant 에 `presentations?: PresentationPayload[]` 필드 추가 (EIA §6.5 line 536 약속 그대로 type 에 반영).
- `chat-channel-adapter.md §3` 매핑 표의 `execution.ai_message` 행 출력 spec 확장: `text` 1건 + (presentations 가 비어있지 않으면) 4종 display-only presentations (`carousel`/`table`/`chart`/`template`) 각각을 `CCH-MP-04` 의 v1 fallback 로 렌더해 ChannelMessage 시퀀스로 text 뒤에 sequential 추가 발송.
- `render_form` (interactive — `interactionType: 'ai_form_render'` 흐름) 은 본 결정 대상 아님 — 별 plan `chat-channel-form-native-modal` 가 추적.

근거:
- EIA spec §6.5 가 이미 `presentations?: PresentationPayload[]` 필드 약속 — chat-channel spec 미연동은 작성 시점 drift 회귀 (의도적 기각 아님). 본 결정은 그 drift 의 catch-up.
- 4종 display-only 의 텔레그램 렌더링 로직은 `CCH-MP-04` 의 v1 MarkdownV2 fallback (텔레그램 renderer 의 `renderCarouselFallback` / `renderTableFallback` / `renderChartFallback` / template plain text) 그대로 재사용 — 별도 인프라 도입 없이 즉시 구현 가능.
- 발송 순서는 **sequential `await`**: text → presentations[0] → presentations[1] → ... (병렬 `Promise.all` 금지 — provider 별 rate limit + 표시 순서 보장 필요). CCH-NF-02 (200ms 이내) 는 시작 시점 latency 기준 — 시퀀스 전체 합산 latency 는 본 spec 의 NF 대상 아님 (시퀀스 길이에 비례 자연 증가).

**기각 대안**:
- (A) chat-channel 가 ai_message 의 `messages[]` 배열 끝에서 tool_use 항목을 inspect 해 render_* 추론 — handler 가 이미 분리해 emit 한 top-level `presentations[]` 를 무시하고 messages 를 다시 파싱하는 것은 단일 진실 원칙 위반.
- (B) AI Agent 가 render_* 호출 시 별도 outbound 이벤트 (예: `execution.tool_call_completed`) 를 chat-channel 이 구독 — 동일 turn 의 text + presentations 가 서로 다른 event 로 분리되어 도착 순서 race 위험. 현재 `presentations` 가 ai_message 와 같은 payload 에 들어 있어 atomicity 보장.

## Spec 갱신안

### A. `spec/conventions/chat-channel-adapter.md`

#### §1.1 — 6함수 유지, `renderNode` 책임 문장만 보강

표 자체는 변경 없음. `renderNode` 행의 "책임" 컬럼 문장만 union 확장 명시로 보강:

| 함수 | 책임 (변경) | side-effect | 멱등성 |
|---|---|---|---|
| `renderNode` | `EiaEvent | ChatChannelInternalEvent` payload → `ChannelMessage[]`. side-effect free. 입력 union 은 §1.2 / §1.3 정의. | none | pure |

**동반 갱신**: `spec/conventions/chat-channel-adapter.md §1` 의 TypeScript `interface ChatChannelAdapter` 블록 안 `renderNode` 메서드 JSDoc/시그니처도 동시 보강 — 단일 spec 안 두 표현(§1 interface 블록 + §1.1 표) 의 drift 방지 (round 3 W-2).

#### §1.2 — `EiaEvent` union 5종 유지 + `EiaAiMessageEvent` 에 `presentations?` 추가

```typescript
type EiaEvent =
  | { type: "execution.waiting_for_input"; /* ... 기존 */ }
  | { type: "execution.ai_message";        /* EIA §6.5 (ai_message) + WS §4.4 */
      executionId: string; triggerId: string; workflowId: string;
      message: string; turnCount: number; messages: unknown[];
      metadata?: unknown; llmCalls?: unknown[];
      /** AI Agent `render_*` 표현 도구 호출 turn 에서만 동봉. SoT: Spec AI Agent §7.10. EIA §6.5 line 536 그대로 전달. */
      presentations?: PresentationPayload[];
      timestamp: string; seq: number }
  | { type: "execution.completed";         /* ... */ }
  | { type: "execution.failed";            /* ... */ }
  | { type: "execution.cancelled";         /* ... */ };
```

**§1.2 도입 문장은 그대로** ("EIA §6 outbound notification payload 의 5종 union") — drift 회피 원칙 보존.

#### §1.3 (신설) `ChatChannelInternalEvent` — chat-channel-internal in-process listener 입력

```typescript
/**
 * chat-channel 어댑터가 EIA outbound 5종 외에 추가로 구독하는 in-process 이벤트.
 * 외부 SDK 미노출 — EIA §6.1 outbound HTTP webhook 화이트리스트와는 별도 표면.
 * 구독 소스: `WebsocketService.executionEvents$` Subject (R8 catch-up 결정 경로).
 */
type ChatChannelInternalEvent =
  | { type: "execution.node.completed";
      executionId: string; triggerId: string; workflowId: string;
      node: { id: string; type: "carousel" | "table" | "chart" | "template"; label?: string };
      /** NodeHandlerOutput.output — 예: Template 의 `{rendered, ...}`, Carousel 의 `{items, ...}`. */
      output: Record<string, unknown>;
      meta?: Record<string, unknown>;
      timestamp: string; seq: number };
```

`node.type` 은 4종 display-only presentation 한정 (form 제외, AI Agent / LLM / code 등 비-presentation 노드 무시). filter 책임은 어댑터 (sub-filter).

#### §3 — 매핑 표

기존 `EiaEvent → renderNode` 매핑 표:

| EIA event type | 입력 payload | 출력 ChannelMessage 시퀀스 |
|---|---|---|
| `execution.ai_message` (갱신) | `message` (필수) + `presentations?[]` (옵션) | `text` 1건+ (provider 별 길이 제한 분할) + (presentations 가 비어있지 않으면) `presentations[i].type` 별 ChannelMessage 시퀀스 — `carousel`/`table`/`chart`/`template` 4종 display-only 만. 발송 순서: text → presentations[0] → presentations[1] → ... (**sequential await — Promise.all 금지**). `uiMapping.visualNode` 분기 적용 (CCH-MP-04 와 동일). `render_form` (presentations[*].type === 'form') 은 본 row 에서 무시 — interactive 는 `ai_form_render` interactionType 의 `waiting_for_input` 으로 별도 처리 (별 plan `chat-channel-form-native-modal`). |

**기존 §3 매핑 표에 행 추가** (§3.1 충돌 회피 — `classifyExecutionFailure` 가 이미 §3.1 점유, round 2 C-1 발견):

| EIA / Internal event type | 입력 payload | 출력 ChannelMessage 시퀀스 |
|---|---|---|
| `execution.node.completed` (presentation 노드 한정, **chat-channel-internal** — §1.3 `ChatChannelInternalEvent`) | `node.type ∈ {template, carousel, table, chart}` + `output` | `template`: `output.rendered` 를 `text` 1건 (MarkdownV2 escape). `carousel`/`table`/`chart`: `CCH-MP-04` v1 fallback 의 `renderCarouselFallback`/`renderTableFallback`/`renderChartFallback` 그대로 재사용. **buttons 가 있는 (blocking) 케이스는 `execution.waiting_for_input` 이 별도로 발사하므로 본 row 에서 제외** — 어댑터 sub-filter 가 `nodeExec.outputData.status === 'waiting_for_input'` 인 케이스를 사전 필터링. `form` 노드는 항상 blocking 이라 본 row 대상 아님. |

> 본 row 의 입력은 `ChatChannelInternalEvent` (§1.3 신설) — EIA outbound 5종 외 chat-channel-internal 한정. 표 헤더는 "EIA / Internal event type" 으로 명시. 외부 HTTP webhook 표면 (EIA §6.1) 은 변경 없음.

### B. `spec/5-system/15-chat-channel.md`

#### §3.1 — `CCH-AD-07` 신설 (CCH-AD-06 는 기존 정의 유지)

| ID | 요구사항 | 필수성 |
|---|---|---|
| CCH-AD-07 | chat-channel 어댑터는 EIA outbound 5종 (CCH-AD-05) 외에 **`execution.node.completed` (in-process `WebsocketService.executionEvents$` Subject 이벤트) 의 presentation 노드 (`carousel`/`table`/`chart`/`template`) 비-blocking 완료** 도 추가 in-process listener 로 attach. 외부 HTTP webhook (EIA §6.1) 화이트리스트는 변경 없음 — 본 listener 는 chat-channel-internal 한정. `WebsocketService.executionEvents$` 는 실행 엔진 §4.4 의 단일 sink 로서 TX commit 후에만 emit 됨 — EIA-RL-04 정합. presentation 노드가 blocking 으로 진입한 경우 (`nodeExec.outputData.status === 'waiting_for_input'`) 는 별도 `CCH-MP-02`/`CCH-MP-04` 흐름이 처리하므로 본 listener 는 비-blocking 케이스만 대상. | 필수 |

#### §3.3 — `CCH-MP-06` 신설

| ID | 요구사항 | 필수성 |
|---|---|---|
| CCH-MP-06 | 비-blocking presentation 노드 (`template` body, `carousel`/`table`/`chart` 의 buttons 없음 케이스) 의 `execution.node.completed` (CCH-AD-07 listener) → 채널 메시지로 변환. v1 fallback 정책은 `CCH-MP-04` (텔레그램 §5.4 MarkdownV2 fallback) 와 동일 — 시각형 (carousel/table/chart) 은 `uiMapping.visualNode` enum 분기 (`text` / `photo` / `auto`) 적용, `template` 은 `output.rendered` 텍스트 그대로. 본 룰은 EIA outbound HTTP notification 표면 (5종 화이트리스트, §6.1) 을 확장하지 않음 — chat-channel-internal listener 한정. | 필수 |

#### §3.3 — `CCH-MP-01` 보강

| ID | 요구사항 | 필수성 |
|---|---|---|
| CCH-MP-01 (갱신) | [AI Multi Turn](../4-nodes/3-ai/1-ai-agent.md) 의 `execution.ai_message` → 채널 텍스트 메시지 1건 이상으로 변환 (provider 별 길이 제한 분할). **payload 의 `presentations?: PresentationPayload[]` 필드 (AI Agent `render_*` 표현 도구 호출 turn 에서만 동봉, [AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반) / [EIA §6.5](./14-external-interaction-api.md#65-페이로드--executioncancelled--executionai_message))** 가 비어있지 않으면 4종 display-only presentation (`carousel`/`table`/`chart`/`template`) 각각을 `CCH-MP-04` 의 v1 fallback 로 렌더해 ChannelMessage 시퀀스로 text 뒤에 sequential 추가 발송. `render_form` (presentations[*].type === 'form') 은 별 plan `chat-channel-form-native-modal` 추적 — 본 룰 처리 대상 아님. | 필수 |

#### §Rationale — `R-CCA-7` 신설 (`renderNode` 시그니처 union 확장 근거)

신설 Rationale 위치: `spec/conventions/chat-channel-adapter.md §Rationale R-CCA-7` (R-CCA-6 다음).

> ### R-CCA-7. `renderNode` 시그니처 union 확장 — chat-channel-internal 이벤트 수용 (2026-05-25)
>
> chat-channel 어댑터가 EIA outbound 5종 외에 chat-channel-internal 이벤트 (`execution.node.completed` presentation 노드 한정) 도 처리해야 한다. 대안:
>
> 1. **(채택) `renderNode` 입력 union 확장** — `renderNode(event: EiaEvent | ChatChannelInternalEvent)`. 함수 개수 6 유지, [R-CCA-5 대안 2](#r-cca-5) 의 "새 함수 추가 = 인터페이스 drift" 정신 보존. union 패턴은 이미 EIA §6 5종 union 으로 확립 — variant 1종 추가에 해당.
> 2. **(기각) 7번째 함수 `renderPresentationNode` 신설** — R-CCA-5 대안 2 가 명시 기각한 "함수 개수 증가 = 모든 provider 어댑터 contract 변경" 패턴 재현. 본 결정의 layer 도 동일 — `ChatChannelInternalEvent` 처리는 provider 별로 다를 수 있지만 (Telegram MarkdownV2 vs Discord embeds), 그것은 함수 *내부* 분기로 흡수 가능하며 R-CCA-5 의 기각 논거가 그대로 적용된다.
> 3. **(기각) `EiaEvent` union 자체에 `execution.node.completed` 추가** — [R3](#r3-eiaevent-를-별-타입으로-정의하지-않고-eia-spec-위임-2026-05-21) "EIA spec §6 SoT, drift 회피" 위배. `EiaEvent` type name 자체가 EIA §6 outbound 5종을 의미하므로 의미 경계 붕괴.
>
> 본 결정으로 어댑터 구현체는 `renderNode` 안에서 `event.type` discriminated union 으로 분기하면 된다 (기존 EIA 5종 분기와 동일 패턴).

#### §Rationale — `R-CC-13` 보강 (Discord v1 유예 범위 명확화)

기존 `R-CC-13` 마지막에 한 줄 추가:

> 본 plan 의 `presentations[]` 처리 의무는 CCH-MP-01 보강분 — Discord v1 의 outbound `POST /channels/{id}/messages` 는 `presentations` 페이로드도 v1 MarkdownV2 fallback 으로 발송 가능하므로 본 보강이 Discord v1 의 outbound 의무 완전 충족 결론을 깨지 않는다 (R-D-3 의 inbound 분기 유예와는 별도 자원).

### C. `spec/5-system/14-external-interaction-api.md`

§6.5 의 `presentations?` 약속 (line 536) 은 그대로. **변경 없음**.

§R10 본문 마지막에 한 줄 보강 (chat-channel-internal 추가 listener 가 R10 위배 아님 명확화):

> chat-channel 어댑터가 `WebsocketService.executionEvents$` Subject 의 EIA outbound 5종 외 이벤트 (예: `execution.node.completed`) 를 sub-filter 로 추가 구독하는 것은 R10 허용 범위 — 단일 sink 자체는 `WebsocketService.emit*` 이며 어댑터는 그 sink 의 consumer 한정 (새 sink 도입 아님).

### E. `spec/4-nodes/7-trigger/providers/telegram.md §5.4` 동반 갱신

`chat-channel-adapter.md §7 변경 관리` 의무. 다음 갱신:

- §5.4 의 `template` 행에서 `(CCH-MP-04 범위 외 — v2 구현 대상)` 표기를 다음 한 줄로 교체:
  > `template`: `output.rendered` 를 MarkdownV2 escape 후 `text` ChannelMessage 1건으로 발송. CCH-MP-06 (비-blocking 본문 발화) 와 CCH-MP-01 보강 (AI Agent ai_message 의 presentations[]) 두 진입점 모두 동일 렌더러 재사용.
- §5.4 표 헤더 직전에 cross-ref 한 줄: "비-blocking presentation 본문 (CCH-MP-06) 과 AI Agent `render_*` presentations[] (CCH-MP-01 보강) 모두 본 표의 v1 fallback 정책을 그대로 적용한다."

### F. CHANGELOG 항목 추가

- `chat-channel-adapter.md` Changelog (2026-05-25 행)
- `15-chat-channel.md` CHANGELOG (2026-05-25 행)
- `14-external-interaction-api.md` (R10 본문 보강 행은 Rationale 변경이므로 별도 CHANGELOG 행 추가)
- `telegram.md §5.4` (E 항목 갱신 — 별도 CHANGELOG 가 있으면 행 추가, 없으면 §5.4 자체에 갱신일 표기)

## 영향 평가

- **외부 SDK / HTTP webhook 사용자**: 영향 없음 — EIA §6.1 outbound 화이트리스트 5종 그대로. `EiaAiMessageEvent.presentations?` 는 옵션 필드 — 기존 SDK 가 무시해도 정상 동작.
- **chat-channel 어댑터 구현**:
  - 새 listener (presentation 노드 한정 `execution.node.completed`) 추가
  - `EiaAiMessageEvent.presentations?` 처리 (chat-channel/types.ts 의 type 보강 + renderer 갱신)
  - **`renderNode` 시그니처 union 확장** (`EiaEvent | ChatChannelInternalEvent`) — 6함수 인터페이스 유지. Telegram/Slack/Discord adapter 의 `renderNode` 구현 갱신 의무 (discriminated union 분기 추가).
  - 기존 텔레그램 renderer (`renderCarouselFallback`/`renderTableFallback`/`renderChartFallback`) 재사용 가능
- **다른 spec 영역**:
  - `spec/4-nodes/3-ai/1-ai-agent.md §7.10` (AI render_* presentations payload SoT) — 변경 없음.
  - `spec/4-nodes/6-presentation/0-common.md` / `5-template.md` — 변경 없음. 비-blocking presentation 의 chat-channel 발화는 chat-channel spec 의 책임.
  - `spec/4-nodes/7-trigger/providers/telegram.md §5.4` — 동반 갱신 ( `chat-channel-adapter.md §7 변경 관리` 의무에 따라):
    - `template` 행의 `(CCH-MP-04 범위 외 — v2 구현 대상)` 표기 제거 또는 "CCH-MP-06 비-blocking 본문 발화로 텍스트 fallback 처리" 로 갱신.
    - §5.4 표 헤더에 CCH-MP-06 cross-ref 추가 ("비-blocking 케이스는 CCH-MP-06 참조").
    - AI Agent ai_message 의 presentations[] 도 같은 v1 MarkdownV2 fallback 으로 렌더된다는 cross-ref 추가 (CCH-MP-01 보강 행 인용).
  - 본 draft 의 §Spec 갱신안 **E** 항목으로 별도 명시 (아래).
  - `spec/5-system/14-external-interaction-api.md §R10` — 한 줄 보강 (위 C).

## Consistency-check 회차

### Round 1 (16_53_45) — BLOCK: YES, 4 CRITICAL

| # | CRITICAL | 해소 |
|---|---|---|
| C-1 | CCH-AD-06 ID 충돌 | → `CCH-AD-07` 로 교체. 본 revision 반영. |
| C-2 | EiaEvent union 5종 원칙 위반 | → `EiaEvent` 5종 유지 + 별도 `ChatChannelInternalEvent` type 신설. 본 revision 반영. |
| C-3 | renderNode 계층 책임 충돌 | → 새 함수 `renderPresentationNode` 신설 (§1.1 7함수 표). 본 revision 반영. |
| C-4 | 파일명 spec-draft- prefix 누락 | → `git mv` 로 rename 완료. `type: spec-draft` frontmatter 추가. |

### Round 2 (17_05_36) — BLOCK: YES, 2 새 CRITICAL

| # | CRITICAL | 해소 |
|---|---|---|
| C-5 | Convention §3.1 이 `classifyExecutionFailure` 에 점유 — 신규 §3.1 충돌 | → 별도 §3.1 신설 안 함. 기존 §3 매핑 표에 `execution.node.completed` row 추가. 본 revision 반영. |
| C-6 | 7함수 추가는 R-CCA-5 대안 2 기각 우회 | → `renderNode` 시그니처 union 확장 (`EiaEvent | ChatChannelInternalEvent`). 6함수 유지. 새 Rationale R-CCA-7 추가. 본 revision 반영. |

### Round 3 — 재실행 후 BLOCK: NO 기대 (본 revision 반영).

## 절차

- [x] draft 작성 (revision 1)
- [x] `/consistency-check --spec` round 1 → BLOCK: YES, 4 CRITICAL 발견
- [x] draft revision 2 (C-1~C-4 해소)
- [x] `/consistency-check --spec` round 2 → BLOCK: YES, 2 새 CRITICAL (C-5/C-6) 발견
- [x] draft revision 3 (C-5/C-6 해소 — §3 표 단일화, `renderNode` union 확장, R-CCA-7 신설)
- [x] `/consistency-check --spec` round 3 → BLOCK: NO 확인 (`review/consistency/2026/05/25/17_13_11/SUMMARY.md`)
- [x] spec 본문 반영 — 4 파일 갱신:
  - `spec/conventions/chat-channel-adapter.md` (§1 interface · §1.1 표 · §1.2 EiaAiMessageEvent · §1.3 ChatChannelInternalEvent 신설 · §3 매핑 표 · §R-CCA-7 신설 · CHANGELOG)
  - `spec/5-system/15-chat-channel.md` (§3.1 CCH-AD-07 신설 · §3.3 CCH-MP-01 보강 · §3.3 CCH-MP-06 신설 · R-CC-13 보강 · R-CC-16 신설)
  - `spec/5-system/14-external-interaction-api.md` (§R10 chat-channel-internal listener 허용 범위 보강)
  - `spec/4-nodes/7-trigger/providers/telegram.md` (§5.4 3 진입점 cross-ref + `template` 행 갱신)
- [x] plan complete + commit + push
- [ ] 구현 단계 안내 (별도 PR — developer skill)

## 담당

project-planner 역할 (본 PR 은 spec 만). 구현 (chat-channel adapter + 3 provider renderer 갱신 + chat-channel.dispatcher 의 SUBSCRIBED_EVENTS 확장) 은 별도 PR — developer 위임.
