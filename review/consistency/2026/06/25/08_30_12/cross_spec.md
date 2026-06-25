# Cross-Spec 일관성 검토 결과

**검토 대상**: plan/in-progress/web-chat-preview-improvements.md
**검토 모드**: --impl-prep
**검토 일시**: 2026-06-25

---

## 발견사항

### [WARNING] execution.message 이벤트가 EIA spec 이벤트 매핑 테이블에 없음

- **target 위치**: Phase 1 §1·§3, Phase 4 §1 (EIA spec 갱신 계획)
- **충돌 대상**: `/spec/5-system/14-external-interaction-api.md` §8 이벤트 매핑 테이블 (line 848~866), §5.2 이벤트 종류 열거 (line 383~387), §3.1 EIA-NX-02
- **상세**: EIA spec §8 의 "내부 WS 이벤트 → SSE event → Outbound notification" 매핑 테이블에 `execution.message` 행이 없다. plan Phase 1 §3 은 "SSE 어댑터가 자동 buffer/replay" 한다고 기술하는데, SSE 어댑터가 `WebsocketService.executionEvents$` 단일 sink 를 구독하므로 `ExecutionEventType` enum 에 추가된 신규 이벤트는 spec 갱신 없이도 wire 에 노출된다. 즉 구현상 동작하더라도 spec §5.2 이벤트 목록 및 §8 매핑 테이블이 실제 wire 보다 뒤처지게 된다. plan Phase 4 §1 은 "SSE 이벤트 목록에 execution.message 추가"라고만 기술해 §5.2 와 §8 중 어느 절을 갱신하는지 모호하다.
- **제안**: Phase 4 §1 을 다음과 같이 보강 — (a) §5.2 이벤트 종류 열거에 `execution.message` 추가, (b) §8 매핑 테이블에 `execution.message` 행 (`SSE event: execution.message`, `Outbound notification: —`) 추가. plan §결정의 "outbound webhook notification 화이트리스트는 건드리지 않음" 의도와 정합.

---

### [WARNING] wc:command { action: resetSession } 이 SDK spec 허용 명령 열거에 없음

- **target 위치**: Phase 2 §3, Phase 3 §1
- **충돌 대상**: `/spec/7-channel-web-chat/2-sdk.md` §3 `wc:command` 페이로드 열거 (line 86), §5 `ChatInstance` 타입 블록
- **상세**: SDK spec §3 의 `wc:command` payload 는 `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` 7종으로 고정 열거된다. SDK spec §5 의 `ChatInstance` 타입이 "공개 메서드 계약의 타입 SoT" 이며 여기에도 `resetSession`/`newChat` 이 없다. plan 은 위젯 내부에 `case "resetSession"` 분기를 추가하고 운영 콘솔에서 `postCommand({ action:"resetSession" })` 을 보내도록 설계하나, SDK spec §3·§5 갱신 없이 구현하면 SDK 소비자(BYO-UI 고객)가 알 수 없는 undocumented 명령이 된다.
- **제안**: Phase 4 §2 에 다음 중 하나를 명시 — (A) 운영 콘솔 전용(internal-only) 이라면 `2-sdk.md §3` 에 "운영 콘솔 전용, 공개 SDK 미노출" 주석과 함께 열거하거나 `1-widget-app.md` 에 internal command 로 분리 기술. (B) 공개 API 로 노출할 경우 SDK spec §3 열거와 `ChatInstance §5` 타입에 `newChat()` 추가.

---

### [INFO] execution.message.presentations envelope 과 ai_message.presentations PresentationPayload 의 관계 미명시

- **target 위치**: Phase 1 §3 (payload 정의: `{ nodeId, nodeType, presentations: [{ config, output }] }`)
- **충돌 대상**: `/spec/5-system/6-websocket-protocol.md` §4.4 (line 189, 501), `/spec/5-system/14-external-interaction-api.md` §6.5, `/spec/4-nodes/3-ai/1-ai-agent.md` §7.10 (PresentationPayload SoT)
- **상세**: plan 본문 §핵심 단순화에서 "ai_message.presentations 와 동일 envelope 계약" 이라고 언급하나, WS spec §4.4 의 `presentations` 는 AI Agent `render_*` 경로의 `PresentationPayload[]` (SoT: AI Agent §7.10) 로 정의된다. `execution.message` 의 `presentations` item `{ config, output }` 이 이 타입과 동일한지, 또는 `NodeHandlerOutput` 의 서브셋인지 spec 갱신 시 명확히 기술해야 한다.
- **제안**: Phase 4 §1 EIA spec 갱신 시 `execution.message` payload `presentations` 항목의 shape 을 `{ config: object, output: object }` (`NodeHandlerOutput` 의 `config`/`output` 필드 그대로) 로 명시하고, AI Agent §7.10 `PresentationPayload` 와의 관계(동형 vs 별도)를 annotate.

---

### [INFO] 5-admin-console.md §6 미리보기 절에 레이아웃 명세가 없어 Phase 4 "갭 없으면 추가 없음" 조건이 오판 위험

- **target 위치**: Phase 4 §2 ("갭 없으면 추가 없음")
- **충돌 대상**: `/spec/7-channel-web-chat/5-admin-console.md` §6 (live-preview 섹션)
- **상세**: plan Phase 4 §2 는 "위젯 presentation 렌더는 기존 spec 본문에 이미 존재 — 갭 없으면 추가 없음" 이라고 조건부 기술한다. 그러나 현재 `5-admin-console.md §6` 에는 미리보기의 레이아웃 배치(2-column vs 세로 stack, xl breakpoint 등)와 세션 초기화 버튼에 대한 명세가 없으므로 갭이 존재한다 — 조건부 판단 없이 추가해야 한다.
- **제안**: plan Phase 4 §2 의 조건부 문구를 "현 spec §6 에 레이아웃·초기화 명세 없으므로 무조건 추가" 로 확정.

---

## 요약

Cross-Spec 일관성 관점에서 `plan/in-progress/web-chat-preview-improvements.md` 는 CRITICAL 충돌(데이터 모델·API 계약 직접 모순·요구사항 ID 중복·RBAC 위반)이 없으며, 신규 이벤트와 명령의 spec 동기화 누락 위험에 해당하는 WARNING 2건과 타입 참조 미명시·조건부 기술 오판 위험의 INFO 2건이 있다. WARNING 1(`execution.message` EIA 이벤트 매핑 테이블 동기화 누락)은 Phase 4 §1 기술의 모호성에서 비롯되며, Phase 4 실행 시 §5.2 와 §8 양쪽을 명시적으로 갱신해야 한다. WARNING 2(`wc:command resetSession` SDK spec 미포함)는 운영 콘솔 전용인지 공개 API 인지에 따라 처리 방향이 달라지므로 구현 전에 결정이 필요하다. spec 갱신 단계(Phase 4)가 plan 에 정식 포함되어 있어 구조적 위험은 낮으나, 위 2건의 WARNING 은 Phase 4 실행 범위를 지금 명확히 보강해야 구현 후 spec drift 를 막을 수 있다.

## 위험도

LOW
