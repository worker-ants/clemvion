# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/web-chat-preview-improvements.md` (구현 diff, --impl-done)
검토 일자: 2026-06-25
검토 범위: `spec/**` 전 영역 대비 구현 변경사항 6개 파일

---

## 발견사항

### 발견사항 1
- **[WARNING]** `execution.message` 이벤트가 EIA §5.2 SSE 이벤트 목록에 없음
  - target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'` 신규 추가; `codebase/channel-web-chat/src/lib/eia-types.ts` — `EiaEventName` union 에 `"execution.message"` 추가
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.2 "이벤트 종류" 열거 및 §6 (내부 WS 이벤트 ↔ SSE 이벤트 매핑 표, 라인 848–866)
  - 상세: EIA §5.2 SSE 스트림 이벤트 목록에는 `execution.started` / `execution.node.started` / ... / `execution.ai_message` / `execution.user_message` 등이 열거되어 있으나 `execution.message` 는 등장하지 않는다. §6 의 내부 WS 이벤트 ↔ SSE event name 매핑 표에도 동 이벤트 행이 없다. 구현은 이 이벤트를 실행 엔진이 신규 발행하고 위젯이 SSE 스트림에서 수신하는 경로로 동작하지만, spec 표면에 정의가 없어 SDK 소비자나 외부 채널 어댑터가 참조할 canonical 계약이 누락된 상태다.
  - 제안: `spec/5-system/14-external-interaction-api.md` §5.2 이벤트 목록과 §6 매핑 표에 `execution.message` 행 추가. 단, 본 이벤트는 EIA SSE 표면(위젯 전용)에만 노출되고 외부 HTTP notification 화이트리스트(§6.1)에는 포함하지 않는다는 점을 명시해야 한다(chat-channel-internal 전용 설계와 대칭). payload shape `{ nodeId, nodeType, presentations: [{config, output}] }` 와 "non-blocking presentation 노드 전용" 제약도 spec 에 고정해야 한다.

### 발견사항 2
- **[WARNING]** `wc:command` action `"resetSession"` 이 SDK spec 의 명령 목록에 없음
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `case "resetSession": apiRef.current.newChat()` 추가; `codebase/frontend/src/components/web-chat/live-preview.tsx` — `postCommand("resetSession")` 호출
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md` §3 host ↔ iframe postMessage 프로토콜 표 (`wc:command` payload 열: `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown`)
  - 상세: SDK spec §3 표에 `wc:command` 의 허용 action 집합이 7종으로 고정 열거되어 있으나 `resetSession` 은 목록에 없다. 구현은 이 명령을 `closeStream` → `clearSession` → `start` 시퀀스(= `newChat()`)로 매핑해 동작시키지만, spec 계약에 정의되지 않아 host SDK 사용자가 이 명령을 사용할 수 없다(SDK ChatInstance 타입에도 없음). Admin console 의 라이브 미리보기 전용 내부 명령인지 공개 SDK 명령으로 격상할 것인지 결정이 필요하다.
  - 제안: (a) 공개 SDK 명령으로 격상: `spec/7-channel-web-chat/2-sdk.md` §3 표에 `resetSession` 행 추가, `ChatInstance` 타입에 `newChat(): void` 메서드 추가. (b) 콘솔 내부 전용으로 유지: spec §5 (`ChatInstance`) 변경 없이, admin-console spec(`spec/7-channel-web-chat/5-admin-console.md`)에 "콘솔 전용 `wc:command` action" 주석 추가. 어느 쪽이든 spec 업데이트가 필요하다.

### 발견사항 3
- **[WARNING]** `execution.message` 와 chat-channel-internal `execution.node.completed` 경로 간 이중 발송 리스크 미검토
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `PRESENTATION_NODE_TYPES.has(node.type)` 시 `execution.message` 발행; `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — 동일 `PRESENTATION_NODE_TYPES` 로 `execution.node.completed` sub-filter
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-AD-07 / CCH-MP-06; `spec/5-system/14-external-interaction-api.md` §5.2 (SSE 스트림에 `execution.node.completed` 도 fanout됨)
  - 상세: 비-blocking presentation 노드 완료 시 두 개의 별개 이벤트가 동일 fanout 채널에서 발행된다 — (1) `execution.message` (신규, 실행 엔진에서 직접) + (2) `execution.node.completed` (기존, 위젯·SSE·chat-channel 모두 수신). chat-channel 어댑터(CCH-AD-07)는 `execution.node.completed` 를 픽업해 채널 메시지로 변환하고, 위젯은 `execution.message` 를 `AI_MESSAGE` dispatch 한다. 현재 위젯이 `execution.node.completed` 를 presentation 렌더 목적으로 처리하지 않는다면 중복이 없지만, EiaEventName 에 `execution.node.completed` 가 포함되어 있으므로 미래 핸들러 추가 시 동일 presentation 을 두 번 렌더할 위험이 있다. spec 에 "위젯은 비-blocking presentation 렌더를 `execution.message` 에서만 소비하며 `execution.node.completed` 는 무시한다" 는 invariant 가 명문화되어 있지 않다.
  - 제안: `spec/7-channel-web-chat/1-widget-app.md` 또는 EIA §5.2 에 "위젯은 비-blocking presentation 노드 렌더를 `execution.message` 에서만 소비하며 `execution.node.completed` 는 무시한다" 는 구분 주석 추가.

### 발견사항 4
- **[INFO]** `PRESENTATION_NODE_TYPES` 코드 SoT 위치 변경
  - target 위치: `codebase/backend/src/common/constants/presentation.ts` — `PRESENTATION_NODE_TYPES: Set<string> = {carousel, table, chart, template}` 신규 공유 상수
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-AD-07 / `spec/conventions/chat-channel-adapter.md` §1.3 — 동일 4종 노드 타입 정의
  - 상세: 코드 상수 집합의 4종 노드 타입은 spec 정의와 일치한다. chat-channel.dispatcher.ts 의 모듈-로컬 Set 이 common/constants 로 이동됐으므로, spec 이 코드 경로를 구체적으로 참조하고 있다면 갱신 필요. 의미 충돌은 없음.
  - 제안: `spec/5-system/15-chat-channel.md` CCH-AD-07 등에 코드 SoT 경로 참조가 있으면 `codebase/backend/src/common/constants/presentation.ts` 로 교체.

### 발견사항 5
- **[INFO]** `newChat` 함수가 `apiRef` / effect 에 추가됐으나 `ChatInstance` 공개 타입에 미반영
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `apiRef.current = { ..., newChat }` (기존 6종 → 7종)
  - 충돌 대상: `spec/7-channel-web-chat/2-sdk.md` §5 `ChatInstance` 인터페이스
  - 상세: `newChat` 은 `apiRef` 내부에만 추가되어 있고 `ChatInstance` 공개 타입에는 없다. `resetSession` 명령(발견사항 2)의 처리 함수이므로 내부 전용으로 의도된 것으로 보인다. 발견사항 2 의 결정에 따라 연동 처리.
  - 제안: 발견사항 2 공개 격상 결정 시 `spec/7-channel-web-chat/2-sdk.md` §5 에 `newChat(): void` 추가.

### 발견사항 6
- **[INFO]** 라이브 미리보기 xl 2-column sticky 레이아웃이 admin-console spec 에 미반영
  - target 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` — xl breakpoint 에서 외형 설정(좌) / 미리보기(우 sticky) 2-column grid
  - 충돌 대상: `spec/7-channel-web-chat/5-admin-console.md` §5 / §6 — 레이아웃 세부 미규정
  - 상세: 직접 모순 없음. spec 이 레이아웃 세부를 규정하지 않으므로 구현 자유도 안의 선택이다.
  - 제안: 선택 사항. spec 변경 불필요. 원하면 admin-console spec §5 에 2-column sticky 배치 한 줄 추가 가능.

---

## 요약

Cross-Spec 일관성 관점에서 CRITICAL 충돌은 없다. 가장 유의미한 위험은 신규 `execution.message` SSE 이벤트가 EIA §5.2 공식 이벤트 목록과 내부 WS ↔ SSE 매핑 표에 등록되지 않아 외부 SDK 소비자·문서 독자가 이 이벤트를 알 수 없는 상태(WARNING 1)와, `wc:command` `"resetSession"` 이 SDK spec 의 허용 action 열거에 없어 공개/내부 전용 여부 결정이 필요한 상태(WARNING 2)다. 두 항목 모두 기능 동작 중단 수준의 CRITICAL 모순은 아니지만, spec 을 단일 진실로 유지하는 프로젝트 원칙에 따라 구현 직후 spec 갱신이 필요하다. 이중 발송 리스크(WARNING 3)는 현재 위젯이 `execution.node.completed` 를 presentation 렌더 목적으로 처리하지 않는 한 실제 중복은 없으나, 미래 핸들러 추가 시 충돌 가능성을 spec 에 명문화해 두는 것이 권장된다.

---

## 위험도

**MEDIUM**

(CRITICAL 0 / WARNING 3 / INFO 3 — 기능 동작에는 문제 없으나 spec 미갱신으로 인한 외부 계약 누락·명령 목록 불일치가 향후 확장 시 혼선 유발 가능)
