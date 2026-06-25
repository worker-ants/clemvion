# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 범위: `plan/in-progress/web-chat-preview-improvements.md` diff (origin/main...HEAD)
검토일: 2026-06-25

---

## 발견사항

### 발견사항 1
- **[WARNING]** `execution.message` 이벤트가 EIA §5.2 SSE 이벤트 목록에 미등재 — spec cross-ref 부정확
  - target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `EXECUTION_MESSAGE` enum JSDoc / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 주석 `spec: spec/5-system/14-external-interaction-api.md §5.2`
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md §5.2` 이벤트 종류 목록 (`execution.ai_message` / `execution.node.started` 등 열거) + EIA R10 단일 sink + facade 계층 원칙
  - 상세: 구현이 `execution.message` 신규 이벤트를 추가했으나, EIA §5.2 의 SSE 이벤트 종류 열거목록에 `execution.message` 가 없다. 코드 주석은 "spec: spec/5-system/14-external-interaction-api.md §5.2" 를 SoT 로 명시하는데, 해당 절 본문은 이 이벤트 타입을 포함하지 않는다. 반면 Rationale R17 (2026-06-25 결정)은 `getStatus` race fix 범위에서 추가됐고, 비-blocking presentation 노드용 신규 이벤트에 대한 spec 갱신 항목은 해당 Rationale 에 포함되지 않는다. 이는 결정 번복이 아니라 spec 갱신 누락에 가깝다.
  - 제안: `spec/5-system/14-external-interaction-api.md §5.2` 이벤트 종류 목록에 `execution.message` 를 추가하고, 해당 절 또는 `## Rationale` 에 "비-blocking presentation 노드(carousel/table/chart/template) 전용 EIA 표면 이벤트를 `execution.ai_message` 와 별도로 신설한 근거(내부 firehose 누출 방지, AI 생성 텍스트와 구분)"를 기술. 코드 주석의 `§5.2` cross-ref 도 해당 절로 정확히 수정.

### 발견사항 2
- **[WARNING]** `resetSession` (`wc:command`) 이 SDK spec 명세된 명령 목록에 없음 — 합의된 `wc:command` 계약 확장 시 Rationale 미기재
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `case "resetSession"` 분기, `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand("resetSession")`
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §3` `wc:command` 페이로드 목록 (`open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` 7종)
  - 상세: SDK spec §3 은 `wc:command` 의 `action` 값을 7종으로 명시한다. 구현이 `resetSession` 을 추가했으나 spec 목록에 반영되지 않았다. Rationale 에도 "live preview 전용 내부 명령이라 공개 SDK 계약 외부로 처리한다" 또는 "SDK 계약 확장을 채택한다" 중 어느 결정도 기술되지 않았다. `spec/7-channel-web-chat/2-sdk.md §3` 테이블과 §5 `ChatInstance` 공개 타입이 공개 계약의 SoT 인데 양쪽 모두 미갱신.
  - 제안: (a) `resetSession` 이 라이브 미리보기 전용 내부 명령이라면 spec §6(라이브 미리보기) 에 "콘솔 전용 비공개 명령" 으로 명시하고 §3 공개 목록 외로 명시적으로 분리. (b) 공개 SDK 명령으로 채택한다면 §3 표와 §5 `ChatInstance` 타입에 `newChat()` / `resetSession` 을 추가하고 Rationale 에 "기존 7종에서 신규 추가, 이유: 라이브 미리보기에서 대화 초기화 UX 제공" 기술. 어느 쪽이든 현재는 결정 미기재 상태.

### 발견사항 3
- **[INFO]** `newChat` 함수를 `apiRef` 에 등록 — SDK spec `ChatInstance` 공개 타입 미반영
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `apiRef` 초기화/갱신 (+ `newChat` 추가)
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §5 ChatInstance` 공개 타입 정의 (`open`/`close`/`show`/`hide`/`sendMessage`/`updateProfile`/`on`/`off`/`shutdown` 9종)
  - 상세: `newChat` 이 `apiRef` 에 등록됐으나 §5 타입에 없다. `resetSession` 명령과 내부적으로 연결되나, 공개 `ChatInstance` API 로서 외부 호스트에 노출될지 여부가 불분명하다. 사용처가 iframe 내부 `apiRef` 에 한정된다면 외부 타입 변경은 불필요하지만, 외부 SDK 에서 `chat.newChat()` 호출 경로가 열릴 경우 계약 갱신이 필요하다.
  - 제안: `newChat` 이 내부 전용임을 코드 주석으로 명시하거나, 공개 API 로 채택한다면 §5 타입과 Rationale 에 기술.

### 발견사항 4
- **[INFO]** 라이브 미리보기 2-column xl grid 레이아웃 — admin console spec 의 ASCII 화면 구조와 미묘한 차이
  - target 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` xl 2-column grid (`xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]`, sticky 미리보기)
  - 과거 결정 출처: `spec/7-channel-web-chat/5-admin-console.md §1` 화면 구조 (좌측 외형/콘텐츠 카드 + 설치 스니펫, 우측 라이브 미리보기가 같은 Card 블록으로 세로 stack 묘사)
  - 상세: spec 의 ASCII 다이어그램은 외형 카드·설치 스니펫·미리보기를 상하 스택으로 표현하나, 구현은 xl 이상 화면에서 2-column grid 로 분리하고 미리보기를 `xl:sticky xl:top-6` 로 우측에 고정한다. 이는 UX 개선 방향의 변경이나 spec 화면 구조 묘사와의 차이에 대한 Rationale 기록이 없다.
  - 제안: spec §1 화면 구조를 xl 2-column 레이아웃 반영으로 갱신하거나, §Rationale 에 "xl 이상에서 외형 설정 변경과 미리보기를 동시 확인 가능하도록 2-column sticky 레이아웃 채택" 한 줄 추가.

---

## 요약

이번 diff 의 주요 변경(① `execution.message` 신규 SSE 이벤트 추가, ② 비-blocking presentation 노드 경로 신설, ③ `resetSession` wc:command 추가, ④ 라이브 미리보기 UI 개선)은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지는 않는다. 다만 두 가지 WARNING 이 있다. 첫째, `execution.message` 를 EIA §5.2 cross-ref 로 표기했으나 해당 절 이벤트 목록에 미등재되어 있어, spec 갱신 없이 코드에서만 "spec 근거가 있는 것처럼" 기술되고 있다. 둘째, `wc:command` 에 `resetSession` 을 추가했는데 SDK spec §3 공개 명령 목록에 반영되지 않아 합의된 계약 목록 밖에 있으며, 이를 내부 전용 명령으로 처리할지 공개 API 로 채택할지에 대한 Rationale 기록이 없다. 두 항목 모두 구현 자체의 설계 방향은 기존 원칙(단일 sink facade 계층, EIA R10, R-CC-16 비-blocking presentation 처리)과 일관성이 있으나, spec 본문과 Rationale 갱신이 누락된 상태다.

---

## 위험도

MEDIUM
