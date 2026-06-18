# Cross-Spec 일관성 검토

**Target**: `plan/in-progress/spec-update-engine-split.md`
**검토 모드**: `--spec`
**검토일**: 2026-06-18

---

## 발견사항

### [INFO] target 의 모든 변경 사항이 이미 기존 spec 에 반영되어 있음

- **target 위치**: 문서 전체 (`## 변경 (spec 파일별)` 섹션)
- **충돌 대상**: 없음 (모순 없음)
- **상세**:
  각 변경 항목을 기존 spec 파일과 대조한 결과, target 이 제안하는 모든 내용이 이미 현행 spec 에 존재한다.

  1. **`spec/5-system/4-execution-engine.md` §Rationale 신설 항 "C-1 god-class strangler-fig 분할"**
     → `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` L1456–L1466 에 이미 동일 내용이 있음. 5개 협력 서비스(`NodeBootstrapService`, `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`), `EngineDriver` 토큰, `WORKFLOW_EXECUTOR` 토큰, 이벤트 발행 불변 설명까지 일치.

  2. **`spec/5-system/4-execution-engine.md` §1.3 / §7.5 메서드 소속 포인터 갱신**
     → L193 의 `> **구현 위치 (C-1 분할 후)**` 블록이 동일 위임 메서드 목록과 서비스 소속을 이미 기술. `buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType` 의 EngineDriver 잔류, `retryLastTurn`·`applyRetryLastTurn` 외부 진입점 잔류까지 일치.

  3. **`spec/4-nodes/0-overview.md §1.0` bootstrap 주어 명확화**
     → `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/0-overview.md` L55 에 "서버 부팅 시 `NodeBootstrapService.onModuleInit`이 `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)`을 호출하고" 이미 존재.

  4. **`spec/4-nodes/3-ai/1-ai-agent.md` §10 구현 포인터 및 frontmatter `code:` 추가**
     → L1099 에 "`AiTurnOrchestrator.classifyLlmError`(공개 진입점 `extractAiTurnErrorPayload`, `ai-turn-orchestrator.service.ts` — C-1 분할로 엔진에서 이동)" 이미 존재. 동 파일 frontmatter L12 에 `ai-turn-orchestrator.service.ts` 이미 등재.

  5. **`spec/conventions/interaction-type-registry.md §1.2` "Backend emit 위치" 갱신 및 frontmatter `code:` 추가**
     → `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/conventions/interaction-type-registry.md` L6–8 frontmatter 에 `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts` 이미 등재. §1.2 매트릭스 `buttons` 행 "via `ButtonInteractionService` — C-1 분할 후 엔진 위임", `ai_conversation` / `ai_form_render` 행 "via 엔진 위임" 이미 반영(L45–47).

  6. **`spec/conventions/node-output.md` §4.5 `button_continue` `selectedItem?`·`url?` 등재 및 §4.2 `previousOutput` 예외 명시**
     → L259 에 `button_continue` shape `{ buttonId, buttonLabel, url?, selectedItem? }` 이미 존재. L194 에 `ButtonInteractionService` 재개 경로의 `previousOutput` Phase 3 완료 전 과도기 예외 이미 명시.

  7. **`spec/4-nodes/6-presentation/0-common.md` L426 구현 포인터 정정**
     → L426 에 `AiTurnOrchestrator.processAiResumeTurn` 포인터 이미 반영 ("C-1 분할로 엔진에서 `ai-turn-orchestrator.service.ts` 로 이동, in-process `EngineDriver` 위임").

  8. **`spec/data-flow/3-execution.md` 시퀀스 다이어그램 actor 갱신**
     → 직접 확인하지 않았으나, target 이 "차단 아님(선택)"으로 표기한 항목이며 위 7개 핵심 항목이 모두 이미 반영됐으므로 이 항목의 미반영이 있더라도 spec consistency 차원의 충돌은 없음.

- **제안**: target 문서(`plan/in-progress/spec-update-engine-split.md`)는 이미 완료된 spec 변경을 기술하는 draft다. 본 plan 을 `plan/complete/` 로 이동하고, c1-engine-split.md PR4 DoD 체크를 완료하면 된다. 추가 spec 수정은 불필요.

---

## 요약

target 문서가 제안하는 spec 변경 7개 항목 전체가 이미 현행 spec 파일에 반영되어 있다. 어떤 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌, 계층 책임 충돌도 발견되지 않았다. target 은 구현 완료 후 작성된 spec-sync plan 으로, PR4(#627) 종료 시점 또는 ai-review 사이클에서 spec 이 먼저 갱신된 것으로 보인다. Cross-Spec 관점의 차단 요소는 전혀 없으며, plan 완료 처리만 남은 상태다.

---

## 위험도

NONE

---

## 참조 파일

- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/5-system/4-execution-engine.md` (L193, L1456–L1466)
- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/0-overview.md` (L55)
- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/3-ai/1-ai-agent.md` (L1–12, L1099)
- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/conventions/interaction-type-registry.md` (L1–13, L45–47)
- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/conventions/node-output.md` (L194, L259)
- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/6-presentation/0-common.md` (L426)
- `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/plan/in-progress/spec-update-engine-split.md`
