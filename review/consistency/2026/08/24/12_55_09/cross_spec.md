# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-done)

대상 diff: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/conversation-thread.md`
(+ 함께 갱신된 `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`,
`spec/5-system/15-chat-channel.md`, `codebase/backend/.../websocket.service.ts`)

## 발견사항

### [WARNING] EIA §14 재정정 블록이 "webhook" 을 `execution.node.completed`/`.failed` 의 외부 수신 채널로 잘못 열거

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R17 "재정정 (2026-08-24)" 블록
  ("**외부 수신자에게는 동작 변경이다** … SSE/webhook/chat-channel 로 나가는
  `execution.node.completed`/`.failed` payload … **제3자 webhook 구독자는 확인 범위 밖**이다.")
  — 이 블록은 이번 diff 로 신설됐고, `plan/complete/node-output-envelope.md` 의 spec_impact 가
  이 파일을 명시적으로 planner-턴 대상으로 지목한 target 문서 세트에 포함된다.
- **충돌 대상**: 같은 파일의 기존 §R10 서술 (`spec/5-system/14-external-interaction-api.md:1311`,
  이번 diff 로 변경되지 않은 부분) — *"`execution.node.completed` … 외부 HTTP webhook (§6.1)
  화이트리스트 5종은 변경 없음 (chat-channel-internal 한정, **외부 SDK 미노출**)"*. 그리고 같은
  파일의 "채널별 봉투" 표(§6 도입부, `:600-610`) — webhook 채널은 **본 절(§6) 전용**이며 SSE 와
  분리된 표면으로 명시.
- **상세**: `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts` 의
  `FANOUT_EVENTS`(webhook enqueue 게이트)는 `execution.waiting_for_input` /
  `execution.completed` / `execution.failed` / `execution.cancelled` / `execution.ai_message`
  **5종만** 포함하며 `execution.node.completed`/`execution.node.failed` 는 이 집합에 없다 —
  즉 3rd-party **outbound HTTP webhook 은 이 이벤트를 애초에 절대 받지 않는다** (allowlist 변경과
  무관하게 코드 레벨에서 원천 배제). 반면 `SseAdapter`(§5.2 SSE 스트림)는 타입 필터가 없어
  `execution.node.completed`/`.failed` 를 그대로 전달하므로 (§5.2 본문 `:408`, `:1689`
  "SseAdapter 는 이벤트 타입 필터가 없다"), **SSE 와 chat-channel 은** 이번 allowlist 강화의
  실질 영향 대상이 맞지만, **webhook 은 애초에 대상이 아니다.** 새 블록이 "제3자 webhook
  구독자는 확인 범위 밖" 이라고 리스크를 남겨 두면, 실재하지 않는 노출 경로에 대한 잔여
  불확실성을 독자에게 심는다 — 반대로 실제로 걱정해야 할 대상(SSE 3rd-party 클라이언트)에
  대한 캐비엇은 없다.
- **제안**: 해당 문장에서 "webhook" 을 제거하고 "SSE/chat-channel" 로만 좁히거나, 명시적으로
  "webhook(§6.1 5종) 은 애초에 이 필드를 받지 않아 영향 밖 — 영향 범위는 SSE 3rd-party
  클라이언트와 chat-channel 렌더러뿐" 이라고 정정. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  에 항목으로 등재해 추적.

### [INFO] `chat-channel-adapter.md` §1.3 JSDoc 의 우선순위 서술이 §3 표/코드와 다름 (template 한정)

- **target 위치**: `spec/conventions/chat-channel-adapter.md` §1.3 (`ChatChannelInternalEvent.output`
  필드 JSDoc) — "렌더러(`renderPresentationByType`)가 `payload → output → config → flat`
  우선순위로 훑어 실제 파손은 없었지만…"
- **충돌 대상**: 같은 파일 §3 매핑 표의 같은 행 — "실제 `extractRendered` 는 `rendered` →
  `payload.rendered` → `output.rendered` 세 후보를 훑어 legacy flat shape 도 받는다."
  (이 표 서술은 코드 — `codebase/backend/src/modules/chat-channel/providers/{discord,slack,telegram}
  -message.renderer.ts` 의 `extractRendered` — 와 정확히 일치함을 확인했다.)
- **상세**: `payload → output → config → flat` 순서는 carousel/table/chart 에 쓰이는
  `extractVisualPayload` 의 실제 후보 순서(코드로 확인)이고, `template` 에 쓰이는
  `extractRendered` 는 **다른 순서**(`flat → payload.rendered → output.rendered`, `config`
  후보 없음)다. §1.3 JSDoc 은 `output` 필드 전체(4종 노드 공용)에 대해 단일 순서를 일반화해
  적어 같은 파일 §3 표의 더 정밀한 서술과 문면상 어긋난다. 이미
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
  *"provider spec 3곳의 `output.rendered` 가 wire 래퍼 기준인지 미확정"* 항목(`12_13_36`
  convention_compliance INFO 1)이 이 근방을 다루고 있으나, 그 항목은 provider 파일
  (`telegram.md`/`slack.md`/`discord.md`) 범위이고 이 §1.3/§3 내부 순서 서술 불일치는
  별도 지점이다.
- **제안**: §1.3 JSDoc 을 "표시 노드 종류별로 순서가 다르다 (template: flat→payload→output,
  carousel/table/chart: payload→output→config→flat)" 로 세분화하거나, §3 표로 위임하고
  §1.3 에서는 순서 예시를 제거.

## 요약

이번 diff (`chat-channel-adapter.md`/`conversation-thread.md` 및 그 짝 파일들)는 지난 몇 라운드
(`12_02_30`/`12_13_36`/`12_24_55`/`12_42_20`)에서 지적된 "wire `output` = `NodeHandlerOutput`
래퍼, 도메인 값은 `output.output`" 서술을 `chat-channel-adapter.md` §1.3/§3, `conversation-thread.md`
§8.4/§9.7, `spec/5-system/6-websocket-protocol.md` §4.1, `spec/5-system/15-chat-channel.md`
CCH-MP-06 네 곳에 **일관되게** 미러링했고, `websocket.service.ts` 의 allowlist 배선·canary
테스트 재작성도 이 서술과 정합함을 코드 대조로 확인했다. `extractRendered`/`extractVisualPayload`
후보 순서, DB 실측 표, emit 6곳 카운트 등 이번에 새로 적힌 수치·경로 주장은 코드로 재확인한
범위 내에서 정확했다. 다만 EIA §14 재정정 블록이 "webhook" 을 영향받는 외부 채널로 잘못
열거한 점(WARNING — 같은 문서의 기존 §R10/§6 서술 및 `notification-fanout.service.ts`
`FANOUT_EVENTS` 코드와 모순)과, `chat-channel-adapter.md` 내부에서 `output` 필드 후보 우선순위
서술이 JSDoc 과 표 사이에서 갈리는 점(INFO)을 제외하면 target 이 다른 spec 영역과 직접 모순되는
CRITICAL 은 발견되지 않았다.

## 위험도

LOW
