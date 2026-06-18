---
worktree: engine-split
status: complete
owner: project-planner (developer 는 spec write 금지 — 본 draft 는 핸드오프용)
parent: plan/in-progress/refactor/c1-engine-split.md (C-1 strangler-fig 체인 종료 spec-sync)
started: 2026-06-18
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/4-nodes/0-overview.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/conventions/interaction-type-registry.md
  - spec/conventions/node-output.md
  - spec/4-nodes/6-presentation/0-common.md
  - spec/data-flow/3-execution.md
  - spec/data-flow/15-external-interaction.md
---

# spec-sync — C-1 엔진 분할 (PR1–4 누적)

> C-1 god-class 분할(PR #622·#625·#626·PR4)은 **전부 behavior-preserving + spec 무변(impl-done 4회 모두
> `BLOCK: NO`)**. 단 각 impl-done 이 식별한 **비차단 SPEC-DRIFT/포인터 stale/Rationale 부재**를 체인 종료
> 시 planner 가 일괄 반영한다 (c1-engine-split.md §spec 갱신 phase 의 위임 대상). 모두 구현 코드는 정확하고
> spec 텍스트만 추출 후 구조를 덜 반영한 상태 — 즉 spec→code 정합을 코드 기준으로 맞추는 작업.

## 실행 절차 (planner) — ✅ 완료 (2026-06-18)

0. PR #622·#625·#626·#627 GitHub 머지 완료 확인 ✅ (origin/main `0c275dd7` 에 4-PR 반영, 엔진 **9,670→7,035줄** 실측).
1. 아래 파일별 변경을 `spec/` 에 반영 ✅ — **8개 파일**(원안 7 + cross-spec 보강 `data-flow/15-external-interaction.md`). developer 는 spec read-only 라 본 draft 핸드오프대로 planner 가 반영.
2. `/consistency-check --spec` → ✅ `BLOCK: NO` (`review/consistency/2026/06/18/09_27_06`; 1차 `09_15_57` BLOCK:YES[plan frontmatter `started:` 누락]→해소 후 재검토 통과).
3. 본 plan 을 `plan/complete/` 로 이동 ✅, `c1-engine-split.md` PR4 DoD 박스 [x] ✅.

### 실측 정정 (draft 대비 — 코드 검증 기반)

- **`classifyLlmError`**: draft 는 "→ `extractAiTurnErrorPayload`" 이라 했으나, `classifyLlmError` 는 **존재**(`AiTurnOrchestrator.classifyLlmError`, private static)하고 `extractAiTurnErrorPayload` 가 공개 진입점. spec 문장이 "분류 로직"이라 `AiTurnOrchestrator.classifyLlmError`(공개 진입점 병기)로 반영.
- **6-presentation L426**: draft 는 "continueAiConversation" 이라 했으나 실제 L426 은 `processAiResumeTurn` 참조 → `AiTurnOrchestrator.processAiResumeTurn` 한정자로 반영.
- **`continueAiConversation` 은 엔진 잔류** (이동 아님 — bus publish 진입점, execution-engine.service.ts:3916). 실제 참조처는 `data-flow/15-external-interaction.md` L108 → 표는 정확, 다운스트림 turn 처리 위임 노트만 보강 (cross-spec checker WARNING 해소).
- **엔진 줄수 7,035** (draft·02-arch 의 7,033 추정 대신 실측).

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
