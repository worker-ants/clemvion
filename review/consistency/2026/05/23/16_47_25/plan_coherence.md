# Plan 정합성 검토 — multiturn-error-preserve

**STATUS**: PASS (WARNING 3건, INFO 1건)

---

## 검토 대상

- target plan: `plan/in-progress/multiturn-error-preserve.md` (worktree: `multiturn-error-preserve`)
- 검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] ai-presentation-tools 의 미완료 spec 항목과 동일 파일 동시 편집

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` — 영향 spec 표의 `spec/conventions/conversation-thread.md §1.1, §1.2, §9.1, §9.2, §9.6, §9.7, §9.9, §9.10, §10`
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) §4.1 미완료 항목 — `spec/conventions/conversation-thread.md §1.2` 갱신 (`[ ]` 미체크), `spec/conventions/node-output.md §4.5` 갱신 (`[ ]` 미체크), `spec/5-system/6-websocket-protocol.md §4.4` 갱신 (`[ ]` 미체크)
- **상세**: `ai-presentation-tools` plan 의 PR #269 는 main 에 머지 완료(2026-05-22)되었고, 해당 spec 변경 내용(presentations? 필드, data.via sentinel, WS §4.4 갱신 등)도 실제로 main spec 에 반영되어 있다. 그러나 `plan/in-progress/ai-presentation-tools.md` 는 아직 `plan/complete/` 로 이동되지 않았고 §4.1 spec 항목들이 `[ ]` 미체크 상태로 잔존한다. target plan 이 동일 파일(`spec/conventions/conversation-thread.md §1.2`)에 `system_error` source 의 `data?` payload shape 정의를 추가하는데, ai-presentation-tools 의 미완료 체크박스로 인해 plan 라이프사이클 추적이 혼선을 줄 수 있다. 실질적인 spec 충돌(두 plan 이 §1.2 에서 서로 다른 내용을 정의하는 것)은 없으나, ai-presentation-tools 의 미체크 항목이 실제로 이미 spec 에 반영되어 있으므로 plan이 stale 상태다.
- **제안**: `plan/in-progress/ai-presentation-tools.md` 의 §4.1 spec 체크박스를 `[x]` 로 갱신한 후 `plan/complete/` 로 git mv 이동. target plan 진행과 병행 가능하나, 동일 파일 편집 전에 ai-presentation-tools plan 을 closeout 하는 것이 history 명확성에 유리.

---

### [WARNING] spec-drift-ws-button-config plan 과 spec/5-system/6-websocket-protocol.md 동시 편집 가능성

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` — 영향 spec 표의 `spec/5-system/6-websocket-protocol.md §4.1, §4.2, §4.6`
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` (worktree: `pending-assignment`) — `spec/5-system/6-websocket-protocol.md §4.4` 수정 예정
- **상세**: target plan 은 §4.1(node.failed payload 명세), §4.2(retry_last_turn 신규 명령), §4.6(REST 외부 표면 매핑) 를 수정한다. `spec-drift-ws-button-config` plan 은 §4.4(buttonConfig 예시) 를 수정할 예정이다. 섹션이 다르므로 의미 충돌은 없으나, 두 plan 이 동일 파일을 손대므로 머지 순서에 따라 git conflict 가 발생할 수 있다. target plan 은 이미 `spec-drift-ws-button-config` 와의 관계를 "의존성·리스크" 절에서 인지하고 있고 섹션 분리를 명시했다. 그러나 `spec-drift-ws-button-config` plan 의 worktree 가 아직 `pending-assignment` 이므로 실제 동시 작업 경합 리스크는 낮다.
- **제안**: target plan 머지 직전 `spec-drift-ws-button-config` plan 의 진행 상태를 재확인. target plan 이 먼저 머지되면 `spec-drift-ws-button-config` 담당자가 rebase. 이미 target plan 의 "의존성·리스크" 절에 기록되어 있으므로 추가 조율 필요는 없으나, `spec-drift-ws-button-config` plan 에도 역방향 cross-ref 추가 권고.

---

### [WARNING] ai-agent-tool-connection-rewrite 의 _resumeState schema 변경과 _retryState 구조 의존

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` — §C ("_retryState 포함 필드: 기존 _resumeState 동일 구조 + expiresAt") 및 Rationale "_retryState 포함 필드 범위" 표
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — 작업 단위 §3 "Spec 작성", §4 "백엔드 구현" — `_resumeState` schema 변경 가능성("schema 변경의 비호환 케이스") 이 의존성·리스크 절에 명시됨
- **상세**: target plan 의 `_retryState` 는 `_resumeState` 와 "동일 구조 + expiresAt" 로 정의된다. `ai-agent-tool-connection-rewrite` 가 새 도구 모델 결정 후 `_resumeState` schema 에 비호환 필드를 추가하거나 기존 필드를 제거할 경우, `_retryState` 의 snapshot 구조가 암묵적으로 변경된다. target plan 은 이 리스크를 "의존성·리스크" 절에서 인지하고 있으나, 조율 의무가 어느 쪽에 있는지 명시되어 있지 않다 — "완료 시 _retryState 형식도 검토" 라고만 되어 있어 담당자 지정이 모호하다. `ai-agent-tool-connection-rewrite` 는 아직 디자인 결정 단계(§1 미완료)이므로 현재 경합은 없다.
- **제안**: target plan 의 "의존성·리스크" 절에 "ai-agent-tool-connection-rewrite 의 _resumeState schema 변경 완료 시 multiturn-error-preserve 구현 담당자(또는 project-planner)가 _retryState 구조 정합 검토를 책임진다" 라는 책임 귀속 한 문장 추가 권고.

---

### [INFO] ai-presentation-tools plan 의 pending spec 체크박스가 실제로 main spec 에 반영 완료됨 — plan stale 추적

- **target 위치**: `plan/in-progress/multiturn-error-preserve.md` — 의존성·리스크 절 "ai-presentation-tools.md: 이미 main 머지 완료 (PR #269)"
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §4.1 — `spec/conventions/conversation-thread.md §1.2`, `spec/5-system/6-websocket-protocol.md §4.4`, `spec/conventions/node-output.md §4.5` 모두 `[ ]` 미체크
- **상세**: target plan 의 판단(PR #269 머지 완료)은 정확하다. 실제 spec 확인 결과 `conversation-thread.md §1.2` 의 `presentations?` 필드, WS §4.4 의 `presentations`·`ai_form_render`·`pendingFormToolCall`, `node-output.md §4.5` 의 `data.via: 'ai_render'` sentinel 모두 main spec 에 반영되어 있다. 그러나 `ai-presentation-tools` plan 자체가 in-progress 에 남아 있어 후속 작업자가 "아직 진행 중인가?" 혼동을 줄 수 있다.
- **제안**: `plan/in-progress/ai-presentation-tools.md` 를 `plan/complete/` 로 git mv. 이는 target plan 진행과 독립적으로 처리 가능한 housekeeping.

---

## 요약

target plan (`multiturn-error-preserve`)은 Plan 정합성 관점에서 전체적으로 건전하다. 미해결 결정(OQ1, OQ3)은 모두 계획 내부에서 해소되어 있고, 미해결 OQ2(retry 회수 한도)는 명시적으로 "본 PR 외 결정 불필요" 로 처리했다. 동일 파일을 손대는 다른 plan(`spec-drift-ws-button-config`)과의 관계도 target plan 이 이미 인지하고 있다. 주요 우려는 `ai-presentation-tools` plan 이 in-progress 상태로 잔존하여 `conversation-thread.md §1.2` 편집 추적이 모호해지는 점(실제 충돌 없음), 그리고 `_retryState`가 `_resumeState` 구조에 의존하는데 `ai-agent-tool-connection-rewrite` 완료 시 책임 귀속이 불명확한 점이다. 두 항목 모두 작업 차단 사유는 아니며 plan 갱신으로 해소 가능하다.

## 위험도

LOW
