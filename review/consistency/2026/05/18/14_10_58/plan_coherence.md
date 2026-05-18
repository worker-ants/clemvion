### 발견사항

- **[WARNING]** `ai-thread-source-mark` 의 Open Question 을 target 이 일방적으로 결정
  - target 위치: `spec/conventions/conversation-thread.md` §9.3 D4, §9.4, §8.1 Rationale ("emit messages 를 conversation Preview 에서 격리한 이유")
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` § Open Questions — "(Phase 3) injection 메시지를 UI conversation timeline 에 보여줄 것인지 vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외."
  - 상세: `ai-thread-source-mark` plan 의 Open Question 은 "injection 메시지를 UI conversation timeline 에 보여주되 turn 카운팅에서만 제외" 를 잠정 결정으로 명시하고, chip 표시는 "추후 결정" 으로 남겨뒀다. target spec 의 §9.3 D4 / §9.4 는 이 잠정 결정을 재검토해 "conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 교체하고 emit messages 는 LLM debug 패널 전용으로 격리"하는 결정을 내렸다. 또한 §9.2 에서 chip 표시 3중 신호를 "강제(필수)"로 격상했다. 이 두 결정은 plan 의 "추후 결정" 항목을 plan 합의 없이 spec 단계에서 확정한 것이다. §8.1 Rationale 에 자체 근거가 명시되어 있어 일방적 결정의 의도가 명확하다.
  - 제안: `plan/in-progress/ai-thread-source-mark.md` 의 Open Questions 를 갱신해 위 두 결정이 target spec 에서 채택되었음을 명시하고, Phase 3 frontend 구현 항목(injection 메시지 표시 정책, chip 표시)을 확정된 내용으로 업데이트해야 한다. 특히 `messagesToConversationItems` 에서의 injection 메시지 처리 방식(숨김 vs 별도 소스 우선)과 Phase 4 Follow-up 의 "injected context chip 표시" 항목이 새 spec 의 §9.1~§9.2 와 정합하도록 갱신 필요.

- **[WARNING]** `ai-thread-source-mark` Phase 2~3 미완료 상태에서 §9 (UI 렌더 규칙) 가 spec 에 확정됨
  - target 위치: `spec/conventions/conversation-thread.md` §9 (미리보기 UI 렌더 규칙) 전체, 특히 §9.3 D4, §9.5
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 2 (Backend 구현), Phase 3 (Frontend 구현) — 모두 미체크 상태
  - 상세: target 의 §9 는 frontend 가 `conversationThread.turns` snapshot 을 1차 소스로 사용하고 `[user-input]…[/user-input]` 마커를 `threadTurnsToConversationItems` 에서 strip 해야 함을 강제 규약으로 명시한다. 그런데 `ai-thread-source-mark` 의 Phase 3 frontend 구현 (특히 `messagesToConversationItems` 변경) 이 아직 미완료다. Phase 3 의 현재 범위는 "emit messages 기반 turn 카운팅 보정"이었으나, target spec §9 는 "emit messages 를 conversation Preview 에서 완전히 분리하고 conversationThread snapshot 을 사용"하는 더 넓은 범위를 규정한다. Phase 3 의 체크박스 항목들이 이 새 범위와 불일치하게 됐다.
  - 제안: `ai-thread-source-mark.md` Phase 3 항목을 target spec §9 의 내용으로 재작성해야 한다. 특히 `messagesToConversationItems` 의 변경 방향이 "source=injected 인 항목의 turn 카운팅 제외" 에서 "conversationThread snapshot 을 primary source 로 사용하는 별도 변환기 경로 도입 + emit messages 는 debug 패널 전용" 으로 확장된다.

- **[WARNING]** `ai-thread-source-mark` Follow-up 이 target 에 흡수됐으나 plan 에 미반영
  - target 위치: `spec/conventions/conversation-thread.md` §8.1 Rationale — "chip 표시 '권장 → 필수' 격상 이유" 문단, §9.2 "시각 구분 신호 (3중 강제)"
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` §Follow-up — "UI: 'injected context' chip 표시 — 본 PR 은 데이터 레이어까지만 다룬다."
  - 상세: `ai-thread-source-mark` plan 은 chip 표시를 "Follow-up (별도 PR)" 로 미뤘다. target §8.1 은 이를 명시적으로 인지하면서("'ai-thread-source-mark' plan (2026-05-16, Phase 1 spec 완료) 이 chip 표시를 'Follow-up (별도 PR)' 로 미뤘으나, 본 작업이 그 Follow-up 을 정식 spec 으로 흡수") target spec 에 3중 강제 신호(§9.2)로 통합했다. 그러나 `ai-thread-source-mark.md` 의 Follow-up 항목은 "별도 PR" 로 여전히 남아있어, 이미 spec 으로 흡수된 항목을 별도로 처리해야 하는 것처럼 오인될 수 있다.
  - 제안: `ai-thread-source-mark.md` 의 Follow-up 항목을 "(target spec §9.2 로 흡수 완료 — 별도 PR 불필요, §9 구현이 해당 항목을 포함)" 으로 갱신해야 한다. 해당 plan 의 Phase 4 UI 점검 항목에도 3중 신호 검증 시나리오를 추가할 것.

- **[INFO]** `node-output-redesign` 의 AI Agent §7.5 "documented but unimplemented" 와 target 의 §4 영속화 표 연관
  - target 위치: `spec/conventions/conversation-thread.md` §4 영속화 표 — "실행 후" 행: `output.result.messages` (AI 멀티턴 누적, D6 2026-05-17 이후 단일 경로)
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` — "spec §7.5 의 `status:'resumed'` transient snapshot 이 handler·engine 어느 쪽에서도 emit 되지 않음 — documented but unimplemented."
  - 상세: target §4 는 `output.result.messages` 를 D6 단일 경로로 명시하고, UI 복원 시 이 경로를 통해 `conversationThread.turns` 와 동등한 view 를 재구성한다고 정의한다. `node-output-redesign/ai-agent.md` 의 미구현 항목(§7.5 transient snapshot 누락)이 이 재구성 경로에 영향을 줄 수 있다. 그러나 현재는 target 이 이를 "derived view (재구성 가능)" 로 다루고 있어 직접 충돌은 아니다. 다만 §9.3 의 "실행 이력 복원 view" 규약은 `EH-DETAIL-06` 에 위임하고 있는데, node-output-redesign 의 resumed transient 이슈가 해결되지 않으면 해당 복원 규약의 구현이 불완전해질 수 있다.
  - 제안: `node-output-redesign/ai-agent.md` 의 §7.5 미구현 항목 처리 시, target §9.3 의 실행 이력 복원 경로 (`output.result.messages` + `output.interaction` 합산 재구성) 정합성을 함께 검증하도록 해당 plan 에 메모를 추가한다.

- **[INFO]** `20260516-full-review` 의 의사결정 보류 항목 중 target 에 포함된 UI 관련 결정 추적
  - target 위치: `spec/conventions/conversation-thread.md` §9.3 / §9.4 — emit messages 의 raw 노출 금지, conversation Preview 탭 데이터 소스 분리
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` §의사결정 보류 — C-4 (`sanitizePayloadForWs` 설정 레이어 이동, emit hot path trust boundary 재설계)
  - 상세: target §9.4 는 emit messages 의 raw 노출을 debug 패널 전용으로 제한한다. full-review 의 C-4 는 `sanitizePayloadForWs` 의 trust boundary 재설계를 의사결정 보류로 남겨뒀다. 두 항목은 동일 영역(emit payload 처리 정책)을 다루지만, target 은 UI 렌더 규약(노출 금지) 을 다루고 C-4 는 backend emit 경로의 보안 아키텍처를 다루므로 직접 충돌은 아니다. 그러나 C-4 가 결정될 때 target §9.4 와의 정합성을 검증해야 한다.
  - 제안: `20260516-full-review/RESOLUTION.md` 의 C-4 보류 사유에 "결정 시 target spec/conventions/conversation-thread.md §9.4 와의 정합성 검토 필요" 메모를 추가한다.

---

### 요약

target(`spec/conventions/conversation-thread.md`)의 이번 개정(2026-05-18)은 `ai-thread-source-mark` plan 의 Phase 1 (spec 완료) 이후 추가로 UI 렌더 규칙(§9)과 LLM payload prefix 책임 경계(§1.5)·보안 마커(§1.6)를 명문화했다. 핵심 문제는 `ai-thread-source-mark` plan 에서 "Open Question(잠정 결정)" 과 "Follow-up(별도 PR)" 으로 미뤄둔 두 항목(injection 메시지 표시 정책, chip 표시 3중 신호)을 target 이 plan 갱신 없이 spec 에서 확정·흡수했다는 점이다. 이로 인해 `ai-thread-source-mark` 의 Phase 3 frontend 구현 범위 및 Follow-up 항목이 새 spec 내용과 불일치한 상태가 됐다. worktree 충돌이나 병렬 동시 작업 경합은 없으나(현재 worktree `conversation-turn-render-a8f3c1` 이 이 spec 을 작성 중이고, `ai-thread-source-mark-7c4f2a` 는 Phase 2/3 구현 단계로 다른 파일을 대상으로 함), Phase 3 구현 착수 전 `ai-thread-source-mark.md` 의 Open Questions·Follow-up·Phase 3 체크박스를 새 spec 내용으로 업데이트하지 않으면 구현 방향이 충돌할 수 있다.

---

### 위험도

MEDIUM
