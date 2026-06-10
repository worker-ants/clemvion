# Cross-Spec 일관성 검토 결과

**Target**: `plan/in-progress/spec-update-ws-resumed-ack.md`
**검토 일시**: 2026-06-10
**검토 대상 spec 변경**: `spec/5-system/6-websocket-protocol.md` §4.2 · `spec/5-system/4-execution-engine.md` §7.5

---

## 발견사항

### 요약: 변경사항 이미 반영 완료

target plan 이 기술하는 두 가지 정정(모순 ① WS §4.2 `resumed` 정의, 모순 ② 엔진 §7.5 ↔ §7.5.1 직접 충돌)은 **현재 시점 양쪽 spec 파일 모두에 이미 반영되어 있다**. 아래는 cross-spec 관점의 잔여 일관성 점검 결과다.

---

### [INFO] `execution.resumed` WS 이벤트명 vs. ack `resumed` boolean — 명명 공존, 충돌 없음

- **target 위치**: plan §변경안 1 — ack `resumed` 재정의
- **관련 spec**: `spec/3-workflow-editor/3-execution.md` line 291, `spec/5-system/14-external-interaction-api.md` §6.4·§7, `spec/conventions/conversation-thread.md`
- **상세**: `execution.resumed`(서버→클라이언트 WS 이벤트 이름)와 ack payload 의 `resumed: boolean` 필드는 이름이 유사하지만 완전히 별개다. 현재 `3-execution.md`(line 291), EIA spec, chat-channel-adapter 등에서 전자는 이미 "실행 재개 이벤트"로 일관되게 서술되고 있으며, 후자(ack boolean)는 WS·엔진 spec 외에서 직접 정의하는 곳이 없다. 명명 혼동 위험이 존재하나 두 개념이 같은 spec 안에서 혼용된 사례는 없다.
- **제안**: 현행 유지. `6-websocket-protocol.md §4.2` 의 `> **ack `resumed`/`queued` 의 의미** …` 노트(line 234)가 이미 "후행 `execution.resumed` 이벤트" 를 구분 명시하므로 추가 조치 불요.

---

### [INFO] `NodeExecution.status = "resumed"` (내부 상태 enum) vs. ack `resumed` boolean — 별개 enum, 충돌 없음

- **target 위치**: plan §변경안 1
- **관련 spec**: `spec/conventions/node-output.md` line 27·171·246, `spec/conventions/data-hydration-surfaces.md`
- **상세**: `node-output.md` 는 `status: "resumed"` 를 NodeExecution 의 내부 흐름 제어 상태로 정의한다. 이는 WS ack 의 `resumed: boolean` 필드와 완전히 별개 도메인이다. target 변경이 node-output 규약에 아무 영향을 주지 않는다.
- **제안**: 현행 유지.

---

### [INFO] EIA / Chat Channel — `execution.cancelled` + `error.code = RESUME_*` 경로 일관성

- **target 위치**: plan §변경안 1·2 — `RESUME_*` 는 후행 `EXECUTION_CANCELLED` 이벤트
- **관련 spec**: `spec/4-nodes/7-trigger/providers/telegram.md` line 188, `spec/conventions/chat-channel-adapter.md` line 133·342, `spec/5-system/15-chat-channel.md`
- **상세**: telegram.md, chat-channel-adapter.md 는 이미 `execution.cancelled` 의 `error.code` 가 `RESUME_*` 로 시작하면 graceful 세션 만료 안내를 발송한다고 기술하고 있다. 이는 target plan 이 확정하는 "RESUME_* 는 ack 가 아닌 후행 EXECUTION_CANCELLED 이벤트" 와 **일치**한다. 모순 없음.
- **제안**: 현행 유지.

---

### [INFO] `spec/3-workflow-editor/3-execution.md` — WS 명령 ack 형태 미서술

- **target 위치**: plan §변경안 1
- **관련 spec**: `spec/3-workflow-editor/3-execution.md` §8.2 (line 302–309)
- **상세**: `3-execution.md` 의 WS 명령 표는 `click_button` / `submit_form` / `submit_message` / `end_conversation` 의 **ack payload 형태를 기술하지 않는다** — 이 역할은 `6-websocket-protocol.md §4.2` 가 전담한다. 따라서 `resumed` 재정의가 `3-execution.md` 에 영향을 주지 않으며, `3-execution.md` 를 함께 갱신할 필요도 없다.
- **제안**: 현행 유지.

---

## 요약

target plan(`spec-update-ws-resumed-ack.md`)이 기술하는 두 가지 spec 정정 — WS §4.2 `resumed` 의미("재개 성공" → "enqueue 수락")와 엔진 §7.5 `RESUME_*` 노출 방식("ack 동기 응답" → "후행 `EXECUTION_CANCELLED` 이벤트") — 은 현재 시점 양쪽 spec 파일에 이미 반영되어 있다. Cross-spec 관점에서 다른 영역(EIA, Chat Channel, 3-execution, node-output, data-hydration-surfaces, conversation-thread)을 점검한 결과, 어느 곳에서도 변경된 정의와 모순되는 기술이 없다. `execution.resumed` 이벤트명·`NodeExecution.status: "resumed"` 등 유사 명칭은 별개 도메인으로 이미 충분히 구분되어 있다. Critical 또는 Warning 수준의 충돌은 발견되지 않았다.

## 위험도

NONE
