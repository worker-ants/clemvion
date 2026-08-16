# 신규 식별자 충돌 검토 — spec-draft-ws-types-canonical-location.md

## 검토 범위 확인

target 문서(`plan/in-progress/spec-draft-ws-types-canonical-location.md`)의 성격을 먼저 확정한다:
이 draft 는 **새 요구사항 ID·엔티티·endpoint·이벤트·ENV·spec 파일을 신설하지 않는다.** #1175 로
이미 구현된 `websocket-events.types.ts` (companion plan `ws-event-types-extract.md` — 체크리스트
전항목 완료 확인) 로 정본 소재가 옮겨간 사실을, 7곳의 spec 본문 **참조 문구**가 아직
`websocket.service.ts` / `WebsocketService` 를 가리키고 있는 것을 정정하는 **포인터 교정**
draft 다. 따라서 "신규 식별자 충돌" 관점에서는 구조적으로 위험 표면이 작다.

실측으로 확인한 사실:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 실재 확인 (265줄).
  `export`: `ExecutionChannelEvent`, `ChatChannelRoutingInfo`, `ExecutionRoutingContext`,
  `ExecutionEventType`, `ToolCallStartedPayload`, `UserMessagePayload`,
  `ToolCallCompletedPayload`, `NodeEventType`, `BackgroundRunEventType`,
  `NotificationEventType`, `NotificationNewPayload`, `KbEventType` — target 이 언급하는
  `KbEventType`/`NodeEventType`/`ExecutionChannelEvent` 전부 실재.
- `spec/3-workflow-editor/3-execution.md:657` 의 현재 텍스트가 target 이 "현재" 로 인용한 문구
  (``websocket.service.ts``)와 정확히 일치 — ① 변경안이 실제 소스에 근거함을 확인.
- `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 에는 이미
  `websocket-events.types.ts` 가 등재돼 있다 (line 9) — target ①이 `3-execution.md` 에
  똑같이 등재하려는 것은 **기존 패턴과의 정합**이지 신규 도입이 아니다.
- `EIA §R10` — target ⑦이 인용하는 요구사항 ID. `spec/5-system/14-external-interaction-api.md`
  에 기 정의된 기존 ID(`### R10. WebsocketService 단일 sink 정책의 확장`)이며 `websocket-events.types.ts:26`
  JSDoc 에도 이미 인용돼 있다. target 은 이 ID 를 새로 만들지 않고 **인용 대상 파일**만 갱신한다
  — ID 자체의 신규 부여가 아니므로 충돌 없음.

## 발견사항

검토 관점 1~6 (요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 /
파일 경로) 전부에서 **target 이 새로 도입하는 식별자가 없다.** 다음은 검토 중 확인한, 이미
알려져 있고 target 이 스스로 범위 밖으로 명시한 항목이다 — 신규 발견이 아니라 교차확인 결과다.

- **[INFO]** `NotificationEventType` 동명 충돌은 이미 실재하며 target 도 인지하고 있다
  - target 신규 식별자: 없음 (target 은 이 이름을 다루지 않는다 — ①~⑦ 어디에도 등장하지 않음)
  - 기존 사용처: `codebase/backend/src/modules/websocket/websocket-events.types.ts:219`
    (`export enum NotificationEventType` — WS 인앱 알림 벨) vs
    `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:28`
    (`export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]` —
    webhook 구독 화이트리스트). 실측으로 두 정의 모두 실재 확인.
  - 상세: 동일 식별자가 서로 다른 의미(WS 알림 벨 enum ↔ webhook 구독 whitelist)로 이미
    공존한다. 이는 companion plan (`ws-event-types-extract.md`) 구현 중 발견되어 disambiguation
    JSDoc 으로 이미 완화됐고, target 문서 자신이 "범위 밖 — `NotificationEventType` 개명(동명
    충돌) — 별도 백로그" 로 명시적으로 배제했다. companion plan 의 "후속" 섹션에도 별도 항목으로
    등재돼 있어 추적 경로가 존재한다.
  - 제안: 조치 불필요. target 이 이 충돌을 새로 만들지 않고, 건드리지도 않으며, 별도 백로그로
    올바르게 위임했음을 확인했다는 취지의 기록.

## 요약

target 문서는 이미 구현된 파일(`websocket-events.types.ts`)로 정본 소재가 옮겨간 사실을 spec
7곳의 참조 문구에 반영하는 **포인터 교정 draft** 이며, 새 요구사항 ID·엔티티/DTO·API endpoint·
이벤트명·ENV/설정키·spec 파일 경로를 하나도 신설하지 않는다. 인용하는 파일 경로
(`websocket-events.types.ts`)와 요구사항 ID(`EIA §R10`)는 모두 실측으로 기존에 이미 존재함을
확인했고, `3-execution.md` frontmatter `code:` 등재는 이미 `6-websocket-protocol.md` 에 적용된
패턴과의 정합이다. 유일하게 관련 있는 동명 충돌(`NotificationEventType`)은 target 이 스스로
범위 밖으로 명시하고 별도 백로그로 이미 등재해 둔 기존 이슈이며, target 이 새로 만들거나 악화시키지
않는다. 신규 식별자 충돌 관점에서 차단 사유 없음.

## 위험도

NONE
