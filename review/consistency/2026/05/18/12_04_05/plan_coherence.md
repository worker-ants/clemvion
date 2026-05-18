### 발견사항

- **[INFO]** `ai-thread-source-mark.md` Open Question — injection 메시지 UI 표시 여부 잠정 결정과 target draft 의 강제 매핑 관계
  - target 위치: `spec-draft-conversation-turn-render.md` §1 (D4), §3.1 §11.1 소스별 시각 매핑표
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Open Questions (Phase 3) — "injection 메시지를 UI conversation timeline 에 보여줄 것인지 vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외. inspector 에서 chip 으로 구분 표시는 추후 결정."
  - 상세: `ai-thread-source-mark` plan 은 injection 메시지의 chip/배경색 구분 표시를 "추후 결정"으로 열어두고 있다. target draft 는 `presentation_user` source 에 대해 🧩 회색 시스템 카드 + chip 표시를 **강제(mandatory)** 규약으로 §11.1 에 확정한다. 이는 open question 을 draft 단계에서 일방적으로 닫는 형태이나, draft 자체가 이 관계를 §3.4 에서 명시적으로 인식하고 "follow-up 의 정식 구체화"로 설명하고 있으므로 의도적 결정으로 볼 수 있다. 단, `ai-thread-source-mark.md` 의 Open Question 항목이 "추후 결정" 상태로 남아있어 plan 문서 자체가 갱신되지 않은 채 남는다.
  - 제안: target spec 이 write 되는 시점에 `ai-thread-source-mark.md` Open Question (Phase 3) 항목을 "결정 완료 — §11.1 강제 매핑 채택 (2026-05-18, spec-draft-conversation-turn-render)"로 업데이트하여 plan 이력을 닫는다.

- **[INFO]** `ai-thread-source-mark.md` Open Question — `output.messages` DB 영속 시 source 보존 여부와 target draft §1.5 결정의 관계
  - target 위치: `spec-draft-conversation-turn-render.md` §1 (D2), §3.1 §1.5 LLM payload prefix 컨벤션
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Open Questions (Phase 2) — "`output.messages` DB 영속화 시 source 보존 여부. **잠정 결정**: 보존. ... 영속 결정은 backend 구현 시점에 최종 확정."
  - 상세: `ai-thread-source-mark` plan 은 source 마커의 DB 영속화를 "잠정 보존, backend 구현 시점에 최종 확정"으로 열어두고 있다. target draft §1.5 는 "`output.messages[].content` (DB 영속)에는 prefix 가 포함되지 않은 raw 본문만 저장한다"고 결정하여 prefix 미포함을 spec 차원에서 확정하나, source 필드 자체의 영속 여부는 직접 언급하지 않는다. §11.3 의 "실행 이력 복원 view" 행에서 `output.messages[].content` 에 prefix 미포함임을 명시하므로 두 spec 간 충돌은 없다. 단, source 마커 영속 여부에 대한 최종 결정은 여전히 backend 구현 시점에 열려 있다.
  - 제안: 추가 조치 없어도 충돌은 아니나, backend 구현 plan(`conversation-turn-render.md` Phase 2) 작성 시 source 마커 영속 정책을 명시 항목으로 포함하도록 draft §4 Phase 2 에 한 줄 추가를 권장.

- **[WARNING]** `ai-thread-source-mark.md` Phase 2/3 미완료 상태에서 target draft 가 동일 코드 영역(`processMultiTurnMessageInner` / `mapTurnsToChatMessages` / frontend 변환기)의 행동 방식을 spec 레벨에서 재정의
  - target 위치: `spec-draft-conversation-turn-render.md` §1 (D2), §3.1 §1.5, §4 Phase 2
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 2 — `processMultiTurnMessageInner` / `mapTurnsToChatMessages` 에 `source: 'injected'/'live'` 마커 부여 미완료(`[ ]`). Phase 3 — frontend `messagesToConversationItems` / `use-execution-events.ts` / `execution-store.ts` 수정 미완료(`[ ]`).
  - 상세: `ai-thread-source-mark` 의 Phase 2(backend source 마커 부여)와 Phase 3(frontend 변환기 수정)는 모두 미완료 상태이며, worktree `ai-thread-source-mark-7c4f2a` 에서 진행 예정이다. target draft §4 Phase 2 는 같은 파일 `processMultiTurnMessageInner` / `mapTurnsToChatMessages` 에 대해 "[from <nodeLabel>] prefix 를 LLM payload prepend 단계에서만 적용"이라는 행동 규약을 명문화하고, `ai-thread-source-mark` Phase 2 와 "동선 통합"을 언급한다. 스펙 레벨에서 선제적으로 결정을 확정하고 구현을 단일 plan 에서 통합하려는 의도는 명확하나, 두 worktree가 동일 파일군의 변경을 각각의 미완 체크박스로 보유한 채 분리 진행될 경우 구현 단계에서 경합이 발생할 수 있다. target draft 가 §4 에서 "동선 통합"을 언급하지만 `ai-thread-source-mark.md` 의 Phase 2/3 항목을 명시적으로 취소하거나 이관하지는 않는다.
  - 제안: target spec 이 write 된 후 생성될 `conversation-turn-render.md` 구현 plan 에서 `ai-thread-source-mark.md` Phase 2/3 체크박스를 명시적으로 흡수(이관 또는 cross-link + 해당 phase 에서 완료 처리)하거나, `ai-thread-source-mark.md` 에 "Phase 2/3 는 conversation-turn-render plan 으로 이관" 주석을 추가해 plan 간 책임 경계를 확정한다. 현재 상태에서는 두 plan 이 동일 파일을 독립적으로 수정할 가능성이 열려 있다.

- **[INFO]** `ai-thread-source-mark.md` Follow-up chip 표시 항목이 target draft §3.4 에서 cross-link 업데이트로 처리되나, plan 의 Follow-up 항목 자체는 여전히 열린 상태로 남음
  - target 위치: `spec-draft-conversation-turn-render.md` §3.4
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Follow-up — "UI: 'injected context' chip 표시"
  - 상세: target draft §3.4 는 `ai-thread-source-mark.md` Follow-up 의 chip 표시 항목에 cross-link 를 추가하고 "정식 spec 화 완료"라고 표시하지만, 이 변경은 plan 문서 자체(markdown 원본)를 수정하는 것이 아니라 draft 에서 제안하는 내용이다. 실제 `ai-thread-source-mark.md` 의 Follow-up 항목은 spec write + plan update 가 이루어질 때까지 열려 있다.
  - 제안: spec write 와 함께 `ai-thread-source-mark.md` Follow-up 항목을 실제로 갱신(cross-link 추가 + "정식 spec 화 완료" 표시)해 plan 이 최신 상태를 반영하도록 한다. draft §3.4 의 제안 내용을 그대로 실행하면 충분하다.

- **[INFO]** worktree 분리 확인 — target plan 과 `ai-thread-source-mark` plan 은 서로 다른 worktree 에서 동시 진행 중
  - target 위치: `spec-draft-conversation-turn-render.md` frontmatter `worktree: conversation-turn-render-a8f3c1`
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` frontmatter `worktree: ai-thread-source-mark-7c4f2a`
  - 상세: 두 plan 은 서로 다른 worktree 에서 운영되고 있어 CLAUDE.md 의 worktree 기반 작업 정책을 준수하고 있다. target draft 는 현재 spec write 단계(일관성 검토 중)이며, 구현은 별도 plan 으로 분리 예정이다. `ai-thread-source-mark` 의 Phase 2/3 는 같은 worktree(`ai-thread-source-mark-7c4f2a`)에서 진행 예정이며, target draft 가 "동선 통합"을 언급하므로 향후 worktree 통합 또는 명시적 이관 결정이 필요하다.
  - 제안: 구현 plan(`conversation-turn-render.md`) 생성 시 `ai-thread-source-mark` Phase 2/3 의 worktree 귀속을 명확히 결정한다.

### 요약

target draft(`spec-draft-conversation-turn-render.md`)는 `ai-thread-source-mark.md` plan 과 전반적으로 정합하며, 후자의 follow-up 항목을 정식 spec 으로 구체화하는 역할을 한다. 두 plan 은 서로 다른 worktree 에서 운영되고 있어 직접적인 worktree 충돌은 없다. 주요 관심사는 `ai-thread-source-mark` Phase 2/3 의 미완료 체크박스가 target draft 의 구현 계획(Phase 2/3)과 동일 파일군(`processMultiTurnMessageInner` / `mapTurnsToChatMessages` / frontend 변환기)을 다루고 있다는 점이다. draft 가 "동선 통합"을 언급하지만 계획 단계에서 명시적 이관이 이루어지지 않으면 구현 단계에서 두 plan 이 경합할 수 있다. 이는 spec write 자체를 차단할 사유는 아니나, 구현 plan 생성 시 해소가 필요한 경계 결정 사항이다. `ai-thread-source-mark` plan 의 Open Question 두 건도 target draft 에 의해 사실상 결정되었으나 plan 문서에 반영되지 않아 plan 이 stale 상태로 남을 수 있다.

### 위험도

LOW
