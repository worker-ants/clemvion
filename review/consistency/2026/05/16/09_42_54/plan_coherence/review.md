# Plan 정합성 검토 — spec-draft-ai-thread-source-mark.md

검토 대상: `plan/in-progress/spec-draft-ai-thread-source-mark.md`
worktree: `ai-thread-source-mark-7c4f2a`
검토 일시: 2026-05-16

---

### 발견사항

- **[INFO]** `conversation-thread.md` plan 이 이미 merge 되어 선행 조건 충족됨
  - target 위치: 변경 대상 2 (`spec/conventions/conversation-thread.md`), §5.1 messages 모드 매핑 아래에 `source` 마커 보강 문단 추가
  - 관련 plan: `plan/in-progress/conversation-thread.md` — `conversation-thread-e509c5` worktree (PR #17, 이미 main 에 merge 됨)
  - 상세: target 이 참조하는 `spec/conventions/conversation-thread.md §5.1` 과 `spec/5-system/6-websocket-protocol.md §4.4.5` 는 `conversation-thread` plan 이 완료하여 main 에 반영된 상태다. 해당 worktree 는 더 이상 활성화되어 있지 않으며, 두 spec 파일에 동시 접근 중인 다른 worktree 도 없다. 선행 조건이 충족된 상태로 본 target 의 spec 수정이 충돌 없이 진행 가능하다.
  - 제안: 추가 조치 불필요. 이력 메모 수준.

- **[INFO]** `conversation-thread.md` plan 에 `output.messages` DB 영속화 여부가 열린 항목으로 표기되어 있으나, target 이 "잠정 결정: 보존" 으로 처리
  - target 위치: `plan/in-progress/ai-thread-source-mark.md` §Open Questions — "(Phase 2) source 마커를 `output.messages` (DB 영속화) 까지 보존할 것인지. **잠정 결정**: 보존."
  - 관련 plan: `plan/in-progress/conversation-thread.md` Phase 23-24 ("DB 컬럼 신설" — 별도 plan 으로 분리됨) 및 target plan 의 변경하지 않는 부분 주석: "`messages[].source` 가 `output.messages` (DB 영속) 에도 함께 들어갈지는 backend 구현 phase 의 결정 사항으로 둔다 (parseHistoryMessages 일관성 위해 권장하지만 spec 강제는 아님)"
  - 상세: `conversation-thread.md` 의 Phase 24 (DB 컬럼 신설) 는 별도 plan 으로 분리되어 있으며 아직 미착수 상태다. target 은 `output.messages` 의 영속화를 spec 강제 사항으로 두지 않고 "backend 구현 phase 의 결정 사항" 으로 명시했으므로, 현재 spec-draft 수준에서는 충돌을 유발하지 않는다. 다만 향후 DB 컬럼 신설 plan 착수 시 `source` 필드 영속 여부를 명시적으로 포함해야 하는 후속 항목이 생긴다.
  - 제안: target plan 의 Open Questions 에 이미 잠정 결정이 기록되어 있으므로 현 상태로 무방. 단, DB 컬럼 신설 plan 작성 시 `output.messages.source` 영속 정책을 명시하는 항목을 추가하도록 해당 plan 에 메모 권장.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미결 정책과 간접 연관
  - target 위치: 변경 대상 1 §4.4.6 — `source: 'live' | 'injected'` 의 `injected` 정의에서 `ai_user`/`ai_assistant` turn 이 §5.1 매핑으로 변환된 결과라고 명시
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — `tool_*` 도구 결과의 `ConversationThread` 누적 시 `ai_tool` vs `tool_call` source 신설 여부가 "결정 필요" 상태
  - 상세: target 의 `source: 'injected'` 정의는 현재 `ConversationTurnSource` enum 에 있는 값들(`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`)이 messages 배열에 prepend 될 때 emit 단계에서 2값(`live`/`injected`)으로 축약됨을 명시한다. `ai-agent-tool-connection-rewrite.md` 가 `tool_call` 이라는 신규 source 값을 추가할 경우, 그 값도 `injected` 범주로 처리될지 별도 분류가 필요한지는 본 spec-draft 가 결정하지 않는다. 그러나 target spec-draft 자체는 "emit 단계에서 2값으로 축약" 이라는 단순 모델을 채택하므로 신규 source 값이 추가되어도 enum 내부 분류만 달라지고 emit 페이로드의 `live`/`injected` 구분은 그대로 유지된다. 실질 충돌 없음.
  - 제안: 현재 충돌 없음. `ai-agent-tool-connection-rewrite.md` 의 tool source 결정이 나면 §4.4.6 의 `injected` 정의 예시에 `ai_tool` 항목이 올바르게 포함되는지 확인하는 정도의 후속 작업만 필요.

---

### 요약

`spec-draft-ai-thread-source-mark.md` 는 `spec/5-system/6-websocket-protocol.md` 와 `spec/conventions/conversation-thread.md` 두 파일을 수정 대상으로 삼는다. 두 파일 모두 선행 작업인 `conversation-thread-e509c5` plan 이 PR #17 로 main 에 merge 된 이후의 상태이며, 현재 동일 spec 파일을 동시에 손대는 다른 활성 worktree 는 없다. `ai-agent-tool-connection-rewrite.md` 의 미결 결정(`tool_call` source 신설 여부)과 간접적으로 연관되지만 target spec-draft 의 "emit 2값 축약" 설계가 신규 source 값 추가를 수용하는 구조이므로 직접적인 충돌은 발생하지 않는다. `output.messages` DB 영속화 결정은 spec 강제 사항으로 두지 않아 향후 DB 컬럼 plan 에 위임되며, 이에 대한 메모를 해당 plan 작성 시 포함하는 것을 권장한다. CRITICAL 및 WARNING 은 없으며 모두 추적 수준의 INFO 사항이다.

### 위험도

NONE
