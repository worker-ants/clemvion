---
title: 웹채팅 미리보기 개선 — presentation 노드 메시지(execution.message) + 세션 초기화 + 2-column 배치
worktree: web-chat-preview-improvements-fa0488
started: 2026-06-25
owner: developer
status: in-progress
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/7-channel-web-chat/5-admin-console.md
related_spec:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
  - spec/4-nodes/6-presentation
  - spec/7-channel-web-chat/5-admin-console.md
related_plans:
  - plan/complete/web-chat-preview-eia-race-fix.md
  - plan/complete/web-chat-console-management.md
---

# 배경

PR #698(EIA race fix) 머지 후 운영 미리보기 테스트에서 사용자가 3건 보고:

1. **[버그] 캐러셀 버튼 클릭 후 next node(템플릿 노드) 메시지가 미리보기에 표시 안 됨.**
   말을 걸면 템플릿 뒤의 AI 멀티턴 노드는 정상 동작 → SSE 는 흐르는데 그 사이 템플릿 출력만 누락.
2. **[기능 부재] 라이브 미리보기에 세션 초기화 수단이 없어** 테스트를 처음부터 다시 못 함.
3. **[UX] 미리보기가 페이지 최하단**이라 외형 변경 효과를 즉시 못 봄 — 외형 설정 우측 배치 검토 요청.

## 1번 root cause (코드 확정)

- presentation 노드 4종(carousel/table/chart/template)이 **버튼 없이 자동 진행(non-blocking)** 하면
  핸들러는 `status` 없이 `{ config, output }` 만 반환 (`template.handler.ts:70` 등).
- 엔진은 `isBlocking=false` 분기에서 **`execution.node.completed`(node-level)만 발행**
  (`execution-engine.service.ts:4547-4572`). 이 이벤트는 **모든 비차단 노드**(code/llm/logic …)에 대해
  나오는 firehose 다.
- SSE 어댑터/컨트롤러는 **이벤트 타입 필터가 없어**(`sse-adapter.service.ts:125`,
  `interaction-stream.controller.ts:152`) `execution.node.completed` 도 위젯까지 도달한다 —
  그러나 위젯 `handleEiaEvent`(`use-widget.ts:115-149`)는 node-level 이벤트 핸들러가 없어 **버린다**.
- 즉 "백엔드 미방출"이 아니라 **presentation 노드의 출력을 실어 나르는 execution-level 전용 이벤트가
  없다**는 설계 갭. firehose 인 node.completed 를 위젯이 직접 구독하면 내부 라이프사이클 누출·취약.

## 핵심 단순화 (변환기 불필요)

위젯 presentation 렌더러(`channel-web-chat/src/lib/presentation.ts` `classifyPresentation`/
`toCarousel`/`toTable`/`toChart`/`toTemplate`)는 모두 **flat `{ config, output }` envelope** 를 읽는다.
이는 노드 핸들러의 구조적 반환(`adaptHandlerReturn` 결과 `{config, output, meta}`)과 **정확히 일치**:
- template: `output.rendered` + `config.outputFormat`
- carousel: `output.items` + `config.layout/items/buttons`
- table: `output.rows`/`output.columns` + `config.columns/buttons`
- chart: `output.data` + `config.chartType/title/xAxis/yAxis/colors`

→ 타입별 변환 없이 `presentations: [{ config, output }]` 한 형태로 **4종 전체** 커버. (AI render_* 의
ai_message.presentations 와 동일 envelope 계약.)

---

# Phase 1 — 백엔드: `execution.message` 이벤트 신설

1. `websocket.service.ts` `ExecutionEventType` enum 에 `EXECUTION_MESSAGE = 'execution.message'` 추가
   (JSDoc: presentation 노드 4종 비차단 완료 시 발행하는 표시-전용 메시지 / AI 생성 아님 / 비권위 진행
   신호 아님 — 영속 outputData 가 SoT. **I8**: WS 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 와 무관함 명시).
2. **I9** presentation 노드 판별 상수: 엔진→chat-channel 의존 방향 위반 방지 위해 공용 모듈
   `codebase/backend/src/common/constants/presentation.ts` 에 `PRESENTATION_NODE_TYPES = {carousel,
   table, chart, template}` 신설하고, 엔진과 `chat-channel.dispatcher.ts:40`(기존 로컬 Set)이 **공유 import**.
   (검증: `nodes/presentation/index.ts` `PRESENTATION_COMPONENTS` 는 form 포함 → 메시지 대상 4종과 다르므로 재사용 불가.)
3. `execution-engine.service.ts` `else if (!isBlocking)` 분기(NODE_COMPLETED emit 직후, ~4572)에
   presentation 노드면 `this.eventEmitter.emitExecution(executionId, EXECUTION_MESSAGE, { nodeId, nodeType,
   presentations: [{ config: adapted.config, output: adapted.output }] })` 추가.
   - SSE 어댑터가 자동 buffer/replay (5분) → race·재연결에도 누락 없음.
   - chat-channel dispatcher 는 node.completed 를 별도 픽업 → 텔레그램 등 **중복 렌더 없음**(execution.message 미구독).
4. 회귀 점검(완료): `ExecutionEventType` 은 프론트 `use-execution-events.ts` 가 **per-event 구독**(`socket.on(name)`)
   으로 소비 → 미등록 신규 이벤트는 무시(에디터 타임라인 미표시, 의도된 동작). exhaustive switch(line 221)는
   `WaitingInteractionType` 대상이라 무관. 백엔드 exhaustive switch 없음.

# Phase 2 — 위젯: `execution.message` 수신 + 세션 초기화 command

1. **W6·W7** `eia-types.ts`: wire 타입을 `ExecutionMessageEvent` 로 명명(DOM 전역 `MessageEvent` shadowing
   회피, `AiMessageEvent` 컨벤션 준수) + `EiaEventName` 유니언(L46-54)에 `"execution.message"` 추가.
   `eia-events.ts` `parseMessage(ev: ExecutionMessageEvent)` 추가 → `{ presentations }` (ev.presentations passthrough).
2. `use-widget.ts` `handleEiaEvent` 에 `else if (name === "execution.message")` →
   `dispatch({ type: "AI_MESSAGE", text: "", presentations })` (presentation-only 말풍선; 기존 AI_MESSAGE
   reducer·렌더 경로 재사용, text 미설정으로 중복 텍스트 방지).
3. 세션 초기화: `apiRef`(line 400/402)에 `newChat` 추가 → onCommand switch(line 473) 에
   `case "resetSession": apiRef.current.newChat(); break;`.

# Phase 3 — 프론트 콘솔: 세션 초기화 버튼 + 2-column 배치

1. `live-preview.tsx`: `postCommand(action)` 헬퍼(widgetOrigin 가드, postBoot 와 동형) + 섹션 헤더에
   "새 세션" 버튼 → `wc:command {action:"resetSession"}`. ready 상태에서만 활성. i18n 키 추가.
2. `page.tsx` `WebChatDetail`: 외형+설치스니펫(좌) / 미리보기(우 sticky) 를 `xl:grid
   xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]` 로 분할, `xl` 미만은 현행 세로 stack(`space-y-6`).
   미리보기는 `xl:sticky xl:top-…`. 헤더/온보딩/다이얼로그는 풀폭 유지.

# Phase 4 — Spec 갱신 (정식 phase)

**W5 역할**: `spec/` 변경은 project-planner 규율을 따른다 — spec 본문 쓰기 **직전 `consistency-check --spec`**
선행, 본 구현 PR 내에서 수행(#698 선례: race fix 가 동일 spec 파일을 impl PR 에서 갱신). spec 편집이 hook 으로
차단되면 project-planner 에이전트에 위임.

1. **W1** `spec/5-system/14-external-interaction-api.md`:
   (a) §5.2 SSE 이벤트 목록(L383~)에 `execution.message` 행 추가 — 발행 시점(presentation 4종 비차단),
       payload(`{nodeId, nodeType, presentations:[{config,output}]}`), 외부 노출/5분 replay.
   (b) §8 매핑 테이블(L848~)에 `execution.message` 행 추가.
   (c) **I1** `presentations` shape 을 `{config, output}` flat envelope 로 명시하고 AI Agent §7.10
       `PresentationPayload` 와의 관계(동일 위젯 렌더 경로, 단 envelope 직접 운반) annotate.
   (d) **I7** `fix-webchat-sse-field-map.md` 가 §6.2 를 건드릴 예정 → 본 변경은 §6.2 구간 회피, 신규 절에만 추가.
   (e) **W3** Rationale 신규 항: 본 변경은 **SSE 표면만 additive** 추가이며, R-CC-16 기각 대상(outbound HTTP
       webhook 화이트리스트 확장)과 **별개**임을 명시. ai_message 재사용 기각 / node.completed 직접 구독 기각 근거 포함.
2. **W2** `resetSession` 커맨드: 운영콘솔 호스트→위젯 전용으로 분류. `spec/7-channel-web-chat/2-sdk.md §3`
   action 목록에 `resetSession` 추가(공개 SDK 호스트도 사용 가능) — 또는 internal-only 주석. **I3** 위젯이
   `AI_MESSAGE` reducer 재사용한 근거(text/presentations 분리 렌더 기존 지원, 이중 말풍선 방지) 명시.
3. **I2** `spec/7-channel-web-chat/5-admin-console.md` §6: 현 spec 에 미리보기 레이아웃·세션 초기화 명세가
   **없으므로 무조건 추가** — 세션 초기화 버튼 + 2-column(xl+ 외형 좌 / 미리보기 우 sticky) 배치.
   **I4** Rationale: xl 미만 세로 stack 유지(좌측 280px 목록 + 우측 detail 2분할이 좁은 화면에서 과밀) 근거.
4. **(완료)** `spec/5-system/6-websocket-protocol.md` §4 이벤트 카탈로그에 `execution.message` 행 추가
   (EIA §5.2 의 "페이로드는 WS §4.4 와 동일" cross-ref dangling 해소). + EIA §5.2 에 위젯이 node.completed 를
   무시하고 execution.message 만 소비한다는 불변식 명시(impl-done W3·W4 대응).

# Phase 5 — 테스트 (TDD)

1. 백엔드 unit: 엔진이 presentation 노드 비차단 완료 시 EXECUTION_MESSAGE 발행(4종), 비-presentation
   노드는 미발행, blocking(버튼) 케이스 미발행.
2. e2e: 캐러셀(버튼)→템플릿→AI 흐름에서 SSE 로 `execution.message` 가 템플릿 output.rendered 를
   운반함을 검증. `make e2e-test`(dockerized).
3. 위젯 unit: `parseMessage` 매핑, handleEiaEvent 가 presentation 말풍선 dispatch.

# Phase 6 — 리뷰 워크플로 (강제)

lint/build/test(앞) → `/ai-review` → resolution-applier(critical/warning fix, fix 커밋 배치) →
`consistency-check --impl-done` → review/** 전용 커밋으로 종결 → push → PR.

# 결정/주의

- **4종 전체 커버**: 변환기가 불필요해 균일 처리 가능하므로 template 만 부분 수정하지 않고 4종 모두 포함.
- `execution.message` 는 SSE/WS firehose 표면에만 추가(노출은 additive·하위호환). **outbound webhook
  notification 화이트리스트(notification-fanout)는 건드리지 않음** — SSE 표면 한정 버그이므로 범위 외.
- 세션 초기화는 위젯 `newChat()`(closeStream→clearSession→start) 재사용 — iframe 재마운트 불필요(플래시 없음).
