# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
대상: `plan/in-progress/web-chat-preview-improvements.md`  
검토일: 2026-06-25

---

## 발견사항

### [WARNING] `execution.message` 신설이 R-CC-16 의 기각 대안과 표면적으로 겹침 — SSE 전용임을 Rationale 에 미명시

- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` Phase 1 (1번 항 — `EXECUTION_MESSAGE` enum 추가), Phase 2 (1번 항 — `parseMessage`), Phase 4 (1번 항 — EIA spec 갱신)
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` §R-CC-16 ("기각된 대안" 단락):  
  > "EIA §6.1 outbound HTTP webhook 화이트리스트를 6종(`node.completed` 추가)으로 확장하는 안은 외부 SDK breaking change 라 chat-channel 전용 UX 갭에는 과하다."  
  그리고 `spec/5-system/14-external-interaction-api.md` §R10 마지막 문단:  
  > "외부 HTTP webhook(§6.1) 화이트리스트 5종은 변경 없음 (chat-channel-internal 한정, 외부 SDK 미노출)."
- **상세**: R-CC-16 에서 비-blocking presentation 출력을 외부 표면에 전달하는 방법으로 (1) outbound HTTP notification 화이트리스트 확장, (2) AI Agent `render_*` 를 별도 이벤트(`tool_call_completed` 등)로 발사하는 안을 명시 기각했다. 채택 경로는 chat-channel-internal listener(`CCH-AD-07`) 가 `execution.node.completed` 를 in-process 픽업하는 것이었다.

  plan 이 제안하는 `execution.message` 는 **SSE 스트림 전용** 신규 이벤트이고, "outbound webhook 화이트리스트(notification-fanout)는 건드리지 않음"을 plan 에서 명시하므로 R-CC-16 의 기각 대안(outbound HTTP notification 화이트리스트 확장)을 직접 재도입하지는 않는다. 그러나 SSE 표면에 신규 이벤트를 추가하는 것이 R-CC-16 의 기각 범위 밖임을 **Phase 4 Rationale 에서 명시하지 않으면** 차기 검토에서 "이전에 기각된 대안이 부분 복원된 것이 아닌가"라는 혼동이 반복될 수 있다.

- **제안**: Phase 4 `spec/5-system/14-external-interaction-api.md` Rationale 신규 항 작성 시, R-CC-16 의 기각 범위(outbound HTTP webhook 화이트리스트 확장)와 본 결정(SSE 전용 additive 이벤트)의 차이를 명시한다:  
  - "chat-channel 은 `execution.node.completed` in-process listener(R-CC-16/CCH-AD-07)를 유지하고 중복 없음"  
  - "`execution.message` 는 SSE 표면에만 additive 추가라 외부 SDK breaking change 없음 — R-CC-16 기각 범위(outbound HTTP 화이트리스트)와 별개"

---

### [INFO] 위젯 `AI_MESSAGE` reducer 재사용 — 설계 근거 미기재

- **target 위치**: Phase 2 — 2번 항 (`dispatch({ type: "AI_MESSAGE", text: "", presentations })`, "text 미설정으로 중복 텍스트 방지")
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` §6.5:  
  > "`execution.ai_message` 의 `presentations?` 필드는 AI Agent `render_*` 표현 도구 호출 turn 에서만 동봉"  
  그리고 R-CC-16:  
  > "text + presentations 가 서로 다른 event 로 분리돼 도착 순서 race 위험이 있어 … ai_message 와 같은 payload 에 담아 atomicity 를 보장한다."
- **상세**: 기존 spec 에서 `ai_message` 이벤트의 `presentations` 필드는 **AI Agent `render_*` turn 전용**으로 명시되어 있다. plan 은 presentation 노드 비차단 완료를 `AI_MESSAGE` reducer 로 dispatch 하지만("AI 생성 아님" 주석 포함), 왜 신규 action 타입(`PRESENTATION_MESSAGE` 등)을 쓰지 않고 기존 `AI_MESSAGE` 를 재사용했는지 근거가 없다. 위젯의 reducer 가 `text: ""`일 때 올바르게 빈-텍스트 말풍선을 처리하는지의 보장도 plan 에서 언급되지 않는다.
- **제안**: plan "결정/주의" 섹션 또는 Phase 4 spec 갱신 시 근거 추가: "위젯 `AI_MESSAGE` reducer 는 이미 `text`+`presentations` 분리 렌더를 지원하므로 신규 action 추가로 인한 reducer·렌더 경로 이중화를 피하고 재사용을 채택. `text: ""` 케이스는 빈 말풍선이 아닌 presentations-only 말풍선으로 처리."

---

### [INFO] `resetSession` 커맨드 추가 — `wc:command` 프로토콜 허용 커맨드 목록 spec 미등재

- **target 위치**: Phase 2 — 3번 항 (`case "resetSession": apiRef.current.newChat(); break;`), Phase 3 — 1번 항 (`wc:command {action:"resetSession"}`)
- **과거 결정 출처**: `spec/7-channel-web-chat/5-admin-console.md` Rationale R5·R6 — iframe 동봉·same-origin 결정을 다루나, 어드민이 위젯에 postMessage 로 보낼 수 있는 커맨드 목록은 spec 에 열거되어 있지 않다.
- **상세**: `wc:command` 프로토콜과 기존 커맨드(`postBoot` 등)가 spec 에 명시되어 있지 않다면, `resetSession` 추가 시 "허용 커맨드가 무엇인가"의 단일 진실이 없다. Phase 4 에서 `spec/7-channel-web-chat/5-admin-console.md` §6 미리보기를 갱신할 때 이 열거가 없으면 spec 공백이 된다.
- **제안**: Phase 4 spec 갱신 시 §6 미리보기 항에 어드민 → 위젯 커맨드 목록(boot 파라미터 전달, resetSession 등)과 세션 초기화 선택 근거("iframe 재마운트 대비 `newChat()` 재사용 — 플래시 없음")를 추가한다. Rationale 항(예: R7)으로 등재하면 추후 커맨드 추가 시 패턴이 명확해진다.

---

### [INFO] 2-column 레이아웃 — breakpoint 결정 근거 spec 미기재

- **target 위치**: Phase 3 — 2번 항 (`xl:grid xl:grid-cols-[…]`, `xl:sticky`)
- **과거 결정 출처**: `spec/7-channel-web-chat/5-admin-console.md` Rationale R1~R6 — 페이지 레이아웃 breakpoint 결정 없음.
- **상세**: 충돌 risk 는 낮다. 단, spec 이 레이아웃을 정의하지 않은 상태에서 `xl`(1280px) breakpoint 와 sticky 배치를 구현하면 Phase 4 갱신 없이는 코드 SoT 상태가 된다. `spec/2-navigation/13-user-guide.md` Rationale R-1 에 `/docs` 내부 사이드바 breakpoint 가 글로벌과 다른 이유를 명시한 선례가 있다.
- **제안**: Phase 4 spec 갱신 시 §6 미리보기 항에 2-column 배치 의도("외형 설정 변경 즉시 확인 — 스크롤 없이 우측 sticky, `xl` 이하는 현행 세로 stack 유지")를 Rationale 항으로 추가한다.

---

## 요약

target plan 은 과거 spec Rationale 에서 명시 기각된 대안(outbound HTTP notification 화이트리스트 확장)을 직접 재도입하지 않는다. `execution.message` SSE 이벤트 신설은 R-CC-16 기각 범위(outbound HTTP webhook)와 다른 표면(SSE 전용)을 대상으로 하며, outbound 화이트리스트를 건드리지 않는다는 점을 plan 에서 명시하고 있어 합의 원칙을 위반하지 않는다. 다만 Phase 4 spec 갱신 시 "SSE 추가는 R-CC-16 기각 범위 밖"임을 Rationale 에 명시하지 않으면 차기 검토에서 오독 위험이 남는 WARNING 1건, 위젯 `AI_MESSAGE` 재사용·`resetSession` 커맨드·2-column 레이아웃의 설계 근거가 spec·plan 어디에도 기록되지 않은 INFO 3건이 존재한다. CRITICAL 항목은 없으며 전체 위험도는 LOW 이다.

---

## 위험도

LOW
