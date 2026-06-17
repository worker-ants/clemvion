---
worktree: .claude/worktrees/engine-split
status: in-progress
owner: project-planner (developer 는 spec write 금지 — 본 draft 는 핸드오프용)
parent: plan/in-progress/refactor/c1-engine-split.md (C-1 strangler-fig 체인 종료 spec-sync)
created: 2026-06-18
---

# spec-sync — C-1 엔진 분할 (PR1–4 누적)

> C-1 god-class 분할(PR #622·#625·#626·PR4)은 **전부 behavior-preserving + spec 무변(impl-done 4회 모두
> `BLOCK: NO`)**. 단 각 impl-done 이 식별한 **비차단 SPEC-DRIFT/포인터 stale/Rationale 부재**를 체인 종료
> 시 planner 가 일괄 반영한다 (c1-engine-split.md §spec 갱신 phase 의 위임 대상). 모두 구현 코드는 정확하고
> spec 텍스트만 추출 후 구조를 덜 반영한 상태 — 즉 spec→code 정합을 코드 기준으로 맞추는 작업.

## 실행 절차 (planner)

1. 아래 파일별 변경을 `spec/` 에 반영 (developer 는 read-only 라 본 draft 가 핸드오프).
2. `/consistency-check --spec <이 draft 또는 변경 spec>` → `BLOCK: NO` 확인.
3. 반영 후 본 plan 을 `plan/complete/` 로 이동, c1-engine-split.md PR4 DoD 체크.

## 변경 (spec 파일별)

### `spec/5-system/4-execution-engine.md`
- **§Rationale 신설 항 "C-1 god-class strangler-fig 분할"**: `ExecutionEngineService`(9,670→~7,033줄)를
  4서비스로 분할한 결정 — `NodeBootstrapService`(bootstrap)·`AiTurnOrchestrator`(AI 멀티턴)·
  `FormInteractionService`/`ButtonInteractionService`(form/button park-resume)·`RetryTurnService`(retry).
  통신은 **엔진 내부 전용 `EngineDriver`**(token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`,
  **in-process 전제** — 분산 분리 아님) + bootstrap 의 `WORKFLOW_EXECUTOR` 토큰. `WorkflowExecutor` 재사용
  기각(engine↔노드 계약 과적), 이벤트 발행은 `ExecutionEventEmitter` 직접 주입 유지(§4.4 — 추상화 미도입).
  옵션 A(strangler-fig 단계별, PR #507 선례) 채택 사유 = 02-architecture.md C-1.
- **§1.3 / §7.5 메서드 소속 포인터 갱신** (현재 `ExecutionEngineService` 직속 암묵 표현 → 실제 위치):
  - `waitForAiConversation`·`processAiResumeTurn`·`handleAiResumeTurn`·`handleAiMessageTurn`·
    `finalizeAiNode`·`emitAiWaitingForInput` → `AiTurnOrchestrator`.
  - `waitForFormSubmission`·`processFormResumeTurn` → `FormInteractionService`;
    `waitForButtonInteraction`·`processButtonResumeTurn` → `ButtonInteractionService`.
  - `applyRetryLastTurn`·`resumeGraphAfterRetry`·`completeRetryExecution`·`failRetryExecution` →
    `RetryTurnService` (단 `retryLastTurn`·`applyRetryLastTurn` 외부 진입점은 엔진 thin delegator 잔류;
    `buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType` 는 EngineDriver 멤버로 엔진 잔류).
  - registry(`resume-turn-dispatch`)·dispatch-loop 는 엔진 잔류, 위 서비스로 위임.

### `spec/4-nodes/0-overview.md §1.0`
- bootstrap 주어 명확화: "`NodeComponentRegistry` 가 서버 부팅 시 순회·등록" → "**`NodeBootstrapService.onModuleInit`
  이** `NodeComponentRegistry.bootstrap(ALL_NODE_COMPONENTS, …)` 을 호출해 등록" (현 텍스트도 registry 순회로
  참이나 트리거 서비스 명시). (파일트리는 "주요 파일 발췌"라 신규 파일 추가 불요.)

### `spec/4-nodes/3-ai/1-ai-agent.md`
- §10 에러코드 표 하단 주석 `classifyLlmError` 구현 포인터 → `AiTurnOrchestrator.extractAiTurnErrorPayload`
  (`ai-turn-orchestrator.service.ts`, private static).
- frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 추가.

### `spec/conventions/interaction-type-registry.md §1.1·§1.2`
- §1.2 "Backend emit 위치" 열: `ai_conversation`/`ai_form_render` → `AiTurnOrchestrator`(via 엔진 위임),
  `buttons` → `ButtonInteractionService`(via 엔진 위임).
- frontmatter `code:` 에 `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts` 추가.
  (`WaitingInteractionType` 정의 위치는 `execution-engine.service.ts` 그대로 — 미이동.)

### `spec/conventions/node-output.md`
- §4.5 `button_continue` data shape 에 `selectedItem?`·`url?` optional 등재 (carousel item-level 링크 버튼 —
  PR3 이전부터 verbatim 존재, git diff 실증된 기존 행위).
- §4.2 `previousOutput` "폐기 예정" 항에 "presentation resume 경로(`ButtonInteractionService`)는 Phase 3
  완료 전 `previousOutput` 보존 예외" 명시 (코드 주석 근거 존재, 기존 행위).

### `spec/4-nodes/6-presentation/0-common.md`
- L426 구현 포인터 `ExecutionEngineService.continueAiConversation → AiTurnOrchestrator.processAiResumeTurn`
  로 정정 (메서드 이동 반영).

### `spec/data-flow/3-execution.md`
- 시퀀스 다이어그램 actor 갱신: `Eng->>AiTurnOrchestrator` / `Eng->>FormInteraction` / `Eng->>ButtonInteraction`
  / `Eng->>RetryTurn` (추출 후 위임 흐름 반영, 차단 아님).

### spec 무변 확인 항목 (변경 불요)
- `ExecutionCancelledError` 의 `workflow-errors.ts` 이동: spec 은 클래스 파일 위치 미정의 → 침묵 영역, 변경 불요.
- 추출 서비스는 모두 `codebase/backend/src/modules/execution-engine/**` 글로브 내 → 엔진 spec `code:` 자동 커버.

## 비고
구현은 4 PR 모두 정확·검증됨(TEST·ai-review·impl-done BLOCK:NO). 본 sync 는 문서 정합성만의 후속이며 코드 변경
불요. `data-flow/3-execution.md`·다이어그램은 선택(차단 아님). otplib v13 host 오염은 본 작업 무관(환경).
