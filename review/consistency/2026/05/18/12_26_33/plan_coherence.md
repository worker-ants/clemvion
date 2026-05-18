### 발견사항

- **[WARNING]** `ai-thread-source-mark` 의 미완료 오픈 결정을 `conversation-turn-render` 가 일방적으로 확정
  - target 위치: `spec/conventions/conversation-thread.md` §8.1 Rationale ("emit messages 를 conversation Preview 에서 격리한 이유"), §9 신규 절 전체, §9.1 source 별 시각 매핑 강제 규정
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Open Questions — "(Phase 3) injection 메시지를 UI conversation timeline 에 보여줄 것인지 vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외. inspector 에서 chip 으로 구분 표시는 추후 결정."
  - 상세: `ai-thread-source-mark` plan 의 잠정 결정은 "injection 메시지를 timeline 에 표시 + chip 구분 (별도 PR)" 이었다. `conversation-turn-render` worktree 는 이 잠정 결정을 spec 에 반영 없이 "conversation Preview 1차 소스를 `conversationThread` snapshot 으로 교체 — emit messages 는 LLM debug 패널 전용으로 격리" 로 뒤집어 §9.3 D4 에 강제 규정으로 명문화했다. 또한 chip "권장"을 3중 신호 "강제"로 격상 (§9.2). `ai-thread-source-mark` plan 은 Phase 2/3 미완료 상태이며 해당 plan 의 frontend Phase 3 코드 변경 방향(messagesToConversationItems 의 currentTurn++ 제외만, isInjected chip 추가)이 이번 target 의 §9.3 D4 (emit messages 완전 배제) 와 구조적으로 충돌한다.
  - 제안: `ai-thread-source-mark` plan 의 Open Question "(Phase 3)" 항목에 최신 결정("conversation Preview 1차 소스 교체, emit messages debug 전용 격리")을 반영하고 `잠정 결정` 표기를 `결정 완료 (2026-05-18, conversation-turn-render)` 로 갱신한다. `ai-thread-source-mark` Phase 3 체크리스트도 새 아키텍처(conversationThread.turns 소비) 에 맞게 재작성 필요. target 의 spec 갱신 자체는 올바르지만, plan 의 Open Question 을 해소하지 않은 채 spec 을 확정한 것이 누락이다.

- **[WARNING]** `ai-thread-source-mark` Plan Phase 2/3 와 `conversation-turn-render` Phase 2/3 간 동일 파일 군 중복 작업 위험
  - target 위치: `conversation-turn-render.md` §"선행 작업 / 직렬화 의존성" — 이관 결정 (A) 가정 표기는 있으나 `ai-thread-source-mark` worktree 가 존재하지 않는 상태
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 2 — `ai-agent.handler.ts`, `thread-renderer.ts`, `execution-engine.service.ts`; Phase 3 — `conversation-utils.ts`, `use-execution-events.ts`, `execution-store.ts`
  - 상세: `conversation-turn-render` plan 은 worktree `ai-thread-source-mark-7c4f2a` 가 Phase 2/3 를 먼저 완료하거나 본 worktree 가 흡수하는 두 가지 시나리오 중 "(A) 흡수" 를 가정으로 작성됐다고 명시한다. 그런데 `ai-thread-source-mark-7c4f2a` worktree 는 현재 `git worktree list` 상 존재하지 않는다. `ai-thread-source-mark` plan 의 `worktree` 필드는 `ai-thread-source-mark-7c4f2a` 이고, 해당 Phase 2/3 는 미완료([ ]) 상태다. worktree 가 제거됐지만 plan 은 `in-progress` 에 남아 있는 상태 — branch 가 어디에 있는지, 또는 흡수 결정이 공식화됐는지 불명확하다.
  - 제안: `ai-thread-source-mark` plan 에 `conversation-turn-render` worktree 가 Phase 2/3 를 흡수한다는 사실을 명시하거나, plan 을 `complete` 로 이동하고 Phase 2/3 항목을 `conversation-turn-render.md` 로 마이그레이션한다. plan frontmatter `worktree` 필드도 `conversation-turn-render-a8f3c1` 으로 갱신 또는 폐기 처리 필요.

- **[WARNING]** `cafe24-store-privacy-prefix-rename` plan 의 "진행 조건" 이 target 변경에 의해 영향 받을 수 있음
  - target 위치: `spec/conventions/cafe24-api-catalog/` 하위 파일 전체 (target 의 impl-prep scope)
  - 관련 plan: `plan/in-progress/cafe24-store-privacy-prefix-rename.md` — `spec/conventions/cafe24-api-catalog/store.md` 의 6 planned row id 재명명. "결정 필요 사항" 이 아직 미결 (새 prefix 선택 미확정)
  - 상세: `cafe24-store-privacy-prefix-rename` plan 의 "결정 필요 사항 1" (새 prefix 선택) 이 아직 미결 상태다. 본 target impl-prep 이 `spec/conventions/cafe24-api-catalog/` 전체를 대상으로 하며, 향후 본 worktree 의 구현 작업 중 `store.md` 를 직접 건드리게 될 경우 해당 미결 결정과 충돌할 수 있다. 다만 현재 target spec 내용(cafe24-api-catalog) 은 catalog 표 row 를 수정하지 않으므로 즉각적 충돌은 없다.
  - 제안: `cafe24-store-privacy-prefix-rename` plan 의 "결정 필요 사항 1" 을 본 impl-prep 착수 전 해결하거나, plan frontmatter `worktree` 를 확정해 `store.md` 에 대한 소유권을 명확히 한다. target 의 현재 범위(catalog 표 열람만)는 충돌 없음.

- **[INFO]** `conversation-turn-render` 의 "결정 필요 (i6)" 항목이 plan 에 추적되지 않음
  - target 위치: `conversation-turn-render.md` Phase 2 — "결정 필요 (i6): `output.messages[].content` 에 prefix 미포함으로 통일. 기존 DB 데이터에 prefix 가 박혀있는지 grep + 필요시 일회성 strip 마이그레이션"
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Open Questions — "(Phase 2) source 마커를 `output.messages` (DB 영속화) 까지 보존할 것인지. **잠정 결정**: 보존."
  - 상세: `ai-thread-source-mark` 의 Open Question "(Phase 2)" 는 영속화 방향(보존)으로 잠정 결정됐으나 최종 확정 아님. `conversation-turn-render` Phase 2 의 "i6" 는 prefix 미포함 방향을 전제로 일회성 strip 마이그레이션 여부만 결정 사항으로 남겼다. prefix 미포함 자체가 `ai-thread-source-mark` 의 영속화 결정과 무관하게 단방향 결정됐으므로 plan 간 추적이 필요하다. 단, 이미 §1.5 가 spec 으로 명문화됐으므로 결정이 내려진 것으로 볼 수 있다.
  - 제안: `ai-thread-source-mark` Open Question "(Phase 2)" 에 "prefix 미포함은 §1.5 (2026-05-18)로 확정. 영속화 데이터 중 prefix 박힌 기존 행 처리는 conversation-turn-render Phase 2 i6 에서 결정" 메모 추가.

- **[INFO]** `ai-agent-multiturn-waiting-persist` plan 의 Critical 미해결 표기 잔존
  - target 위치: `plan/in-progress/ai-agent-multiturn-waiting-persist.md` — "BLOCK: YES 이지만 Critical 1건은 본 작업과 무관한 `spec/conventions/cafe24-api-catalog/_overview.md` 파일명 규약 위반 — project-planner 위임 사안이며 본 PR scope 밖. [ ] (consistency Critical) `spec/conventions/cafe24-api-catalog/_overview.md` 파일명 규약 위반 (언더스코어 prefix)"
  - 관련 plan: 해당 언더스코어 prefix 규약 위반 항목을 project-planner 에 위임했으나 해소된 plan 이 없음
  - 상세: `spec/conventions/cafe24-api-catalog/_overview.md` 의 파일명이 `언더스코어 prefix` 규약 위반이라는 Critical 이 `ai-agent-multiturn-waiting-persist` 에 미해결 체크박스로 남아 있다. target 의 impl-prep 범위가 `spec/conventions/` 전체인데, 해당 파일 (`_overview.md`)은 target 에 포함된다. 이 파일명 규약 위반이 본 impl-prep 을 block 하지는 않으나 추적 문서가 없다는 것이 INFO 수준의 누락이다.
  - 제안: `ai-agent-multiturn-waiting-persist` plan 의 해당 체크박스를 project-planner 위임 plan 으로 이관하거나, 파일명 규약 위반이 실제 문제인지 재확인 후 해소 또는 INFO 로 강등.

### 요약

target (`spec/conventions/`) 에 대한 이번 impl-prep 에서 가장 주요한 정합성 위험은 `ai-thread-source-mark` plan 의 미완료 Open Question 과 Phase 2/3 미구현 상태가 `conversation-turn-render` target spec 과 충돌·흡수 관계에 있으면서도 plan 문서 상 명시적으로 해소되지 않았다는 점이다. `ai-thread-source-mark` worktree 가 이미 제거됐고, spec 변경(§9 UI 렌더 규칙, §1.5·§1.6 신규 절) 은 `conversation-turn-render` 가 일방적으로 수행했으나, `ai-thread-source-mark` plan 의 Open Question 및 Phase 3 체크리스트는 구(舊) 설계를 그대로 기술하고 있어 추후 개발자가 혼동할 위험이 있다. `cafe24-api-catalog` 관련 plan 들(`cafe24-store-privacy-prefix-rename`)은 target 의 현재 변경 범위와 즉각적인 충돌은 없으나 미결 결정이 있어 직렬화 관리가 필요하다. CRITICAL 항목은 없으며 CRITICAL/WARNING/INFO 총 5건.

### 위험도

MEDIUM
