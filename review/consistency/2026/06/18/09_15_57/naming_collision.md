# 신규 식별자 충돌 검토 — spec-sync C-1 엔진 분할

## 발견사항

### [INFO] target 의 신규 Rationale 항이 이미 기존 spec 에 존재
- target 신규 식별자: `§Rationale 신설 항 "C-1 god-class strangler-fig 분할"` (plan 본문 §변경 spec/5-system/4-execution-engine.md 첫 항목)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` L1456–L1467, 제목 `### C-1 god-class strangler-fig 분할 (2026-06-18, PR #622·#625·#626·#627)`
- 상세: target 이 "신설"로 기술하는 Rationale 섹션은 현재 spec 에 이미 완전히 기술돼 있다. 서비스명(`NodeBootstrapService`, `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`), 토큰명(`ENGINE_DRIVER`, `WORKFLOW_EXECUTOR`), `EngineDriver` 계약, `ExecutionEventEmitter` 불변 등 target 이 나열하는 내용이 전부 포함되어 있다.
- 제안: target 의 해당 항은 "기존 Rationale 확인/갱신" 임을 명확히 하거나, 기존 내용과 diff 가 없다면 변경 불요 항으로 이동. "신설"이 아닌 "확인(no-op)" 처리.

### [INFO] §1.3 / §7.5 메서드 소속 포인터 갱신 — 이미 반영 완료
- target 신규 식별자: `execution-engine.md §1.3` 의 메서드 → 추출 서비스 매핑 포인터
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` L193 (`> **구현 위치 (C-1 분할 후)**: ...`)
- 상세: `waitForAiConversation`·`processAiResumeTurn`·`handleAiResumeTurn`·`handleAiMessageTurn`·`finalizeAiNode`·`emitAiWaitingForInput` → `AiTurnOrchestrator`, `waitForFormSubmission`/`processFormResumeTurn` → `FormInteractionService`, `waitForButtonInteraction`/`processButtonResumeTurn` → `ButtonInteractionService`, `applyRetryLastTurn` 외 → `RetryTurnService` 등 목표 포인터가 L193 에 이미 서술돼 있다.
- 제안: target 이 요청하는 갱신이 이미 spec 에 존재. planner 는 실제 diff 를 확인한 후 추가 서술이 필요한지 판단.

### [INFO] `spec/4-nodes/0-overview.md §1.0` — NodeBootstrapService 트리거 명시 이미 반영
- target 신규 식별자: `NodeBootstrapService.onModuleInit` 이 `NodeComponentRegistry.bootstrap(…)` 을 호출한다는 서술
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/0-overview.md` L55 — 현재 문장 "서버 부팅 시 `NodeBootstrapService.onModuleInit`이 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출하고…" 로 이미 동일 표현 존재.
- 상세: target 이 요청하는 "bootstrap 주어 명확화" 가 이미 완료된 상태. 충돌 없음, 변경 불요.
- 제안: 변경 불요 항으로 처리.

### [INFO] `spec/4-nodes/6-presentation/0-common.md L426` — 구현 포인터 이미 갱신 완료
- target 신규 식별자: `ExecutionEngineService.continueAiConversation` → `AiTurnOrchestrator.processAiResumeTurn` 정정 포인터
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/6-presentation/0-common.md` L426 — 이미 `AiTurnOrchestrator.processAiResumeTurn (4 케이스 명시 매칭 — C-1 분할로 엔진에서 ai-turn-orchestrator.service.ts 로 이동, in-process EngineDriver 위임)` 로 표기돼 있다.
- 상세: target 이 "L426 정정"으로 요청한 내용이 이미 반영된 상태. 변경 없이 진행하면 no-op.
- 제안: 변경 불요 항으로 처리.

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` — ai-turn-orchestrator.service.ts 이미 포함
- target 신규 식별자: frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 추가
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/3-ai/1-ai-agent.md` L12 — 이미 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 가 frontmatter 에 포함.
- 상세: 중복 추가. 충돌 없음, 단순 no-op.
- 제안: 변경 불요 항으로 처리.

### [INFO] `spec/conventions/interaction-type-registry.md §1.2` — emit 위치 갱신 이미 반영
- target 신규 식별자: §1.2 행 `ai_conversation`/`ai_form_render` → `AiTurnOrchestrator`, `buttons` → `ButtonInteractionService` 위임 표기
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/conventions/interaction-type-registry.md` L45–L47 — 이미 `ButtonInteractionService — C-1 분할 후 엔진 위임`, `AiTurnOrchestrator.emitAiWaitingForInput (C-1 분할 후 엔진 위임)` 으로 모두 표기돼 있다.
- 상세: target 이 요청하는 갱신이 이미 완료. `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts` 도 frontmatter L7–L8 에 이미 포함.
- 제안: 변경 불요 항으로 처리.

### [INFO] `spec/conventions/node-output.md` — `button_continue` 필드 및 `previousOutput` 예외 이미 반영
- target 신규 식별자: §4.5 `button_continue` data shape 의 `selectedItem?`·`url?` optional; §4.2 `previousOutput` 보존 예외 명시
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/conventions/node-output.md` L259 (`url?`/`selectedItem?` 표기), L194 (`ButtonInteractionService` previousOutput 예외)
- 상세: 두 항목 모두 이미 현재 spec 에 반영되어 있다. 의미 중복 없음.
- 제안: 변경 불요 항으로 처리.

### [INFO] `spec/data-flow/3-execution.md` — 시퀀스 actor 갱신 이미 반영
- target 신규 식별자: actor `Eng->>AiTurnOrchestrator` 등 위임 표기
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/data-flow/3-execution.md` L172 — 이미 `FormInteractionService / ButtonInteractionService / AiTurnOrchestrator / RetryTurnService` in-process `EngineDriver` 위임 주석이 존재.
- 상세: 다이어그램 actor 자체가 변경됐는지는 본 행의 주석만 확인됐으나, 이미 C-1 분할 사실이 기술된 상태. 실제 mermaid 다이어그램 actor 행 갱신은 별도 확인 필요하나 신규 식별자 충돌은 없음.
- 제안: 충돌 없음. 플래너는 다이어그램 actor 라인만 실물 diff 확인 후 반영 여부 결정.

---

## 요약

target 문서(`plan/in-progress/spec-update-engine-split.md`)가 도입하려는 신규 식별자(서비스명·토큰명·메서드 소속 포인터·frontmatter 경로·enum 행 등)는 기존 spec 과 **의미상 충돌하지 않는다**. 오히려 조사 결과, target 이 "신설" 또는 "갱신"으로 기술한 대부분의 항목이 현재 spec 에 이미 반영된 상태다. `spec/5-system/4-execution-engine.md §Rationale C-1` (L1456), `spec/4-nodes/0-overview.md §1.0` (L55), `spec/4-nodes/6-presentation/0-common.md` (L426), `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter (L12), `spec/conventions/interaction-type-registry.md §1.2` (L45–47), `spec/conventions/node-output.md` (L194, L259) 모두 target 의 의도와 일치하는 내용을 이미 담고 있다. 식별자 수준의 충돌(동일 이름이 다른 의미로 사용)은 발견되지 않았다. 플래너는 실제 변경 전에 기존 텍스트와 실물 diff 를 수행해 어느 항목이 진정 no-op 인지, 실제로 추가 서술이 필요한 부분이 있는지 확인하는 것이 권장된다.

---

## 위험도

NONE
