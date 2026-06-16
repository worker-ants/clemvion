---
worktree: .claude/worktrees/engine-split
status: in-progress
spec_area:
  - spec/5-system/4-execution-engine.md
  - spec/4-nodes/0-overview.md
created: 2026-06-16
parent_backlog: plan/in-progress/refactor/02-architecture.md (C-1 · m-3)
---

# C-1 엔진 분할 (strangler-fig, A 방식) — stacked PR 로드맵

> `ExecutionEngineService` (9,670줄 god-class) 를 [02-architecture.md](./02-architecture.md) **C-1 의 A 방식**
> (strangler-fig 단계별 분할 + 엔진 내부 전용 `EngineDriver` 통신)으로 분할. PR #507(resume dispatch
> registry) 선례의 연속 — 각 단계 독립 PR·독립 e2e 게이트로 회귀 격리.

## Stacked PR 전략 (연속 병합 체인)

2번째 PR 부터 base 는 `main` 이 아니라 **직전 PR 브랜치**:

| PR | 브랜치 | base | 내용 |
| --- | --- | --- | --- |
| PR1 | `claude/engine-split-s1-nodebootstrap` | `main` | NodeBootstrapService + WORKFLOW_EXECUTOR 토큰 (= m-3) |
| PR2 | `claude/engine-split-s2-aiturn` | PR1 브랜치 | AiTurnOrchestrator + EngineDriver 도입 |
| PR3 | `claude/engine-split-s3-formbutton` | PR2 브랜치 | Form/Button InteractionService |
| PR4 | `claude/engine-split-s4-retry` | PR3 브랜치 | RetryTurnService |

단일 worktree(`.claude/worktrees/engine-split`) 안에서 순차 브랜치 — 각 PR 은 직전 브랜치 HEAD 에서
분기하므로 자연 stacked. `gh pr create --base <직전브랜치>`. 직전 PR 머지되면 후속 base 는 GitHub 가
자동으로 main 으로 재타겟.

## 통신 방식 (A 방식 핵심 결정)

- **`WORKFLOW_EXECUTOR` 토큰** (PR1) — `handlerDeps.build(this)` 자기참조를 DI 바인딩으로 정리.
  spec 이 정의한 `WorkflowExecutor`(engine↔노드) 계약의 정확한 용처(m-3 본문).
- **`EngineDriver` 엔진 내부 전용 계약** (PR2 도입, PR3·4 재사용) — `WorkflowExecutor` 재사용
  금지(engine↔노드 계약 의미 과적 회피). 이벤트 발행은 `ExecutionEventEmitter` 직접 주입 유지
  (spec §4.4 — `IExecutionEventEmitter` 류 sink 추상화 도입 금지).

## PR1 — NodeBootstrapService + WORKFLOW_EXECUTOR 토큰 (= m-3) — 진행중

**spec 대조**: spec 무변 (D 판정). bootstrap SoT 는 `4-nodes/0-overview.md §1.0` "NodeComponentRegistry
는 서버 부팅 시 ALL_NODE_COMPONENTS 배열을 순회…등록" — **트리거 서비스는 무언급**(구현 재량).
`NodeBootstrapService` 가 호출해도 NodeComponentRegistry 가 여전히 순회 → 텍스트 그대로 유효. 엔진
spec 은 bootstrap 무언급. §1.0 파일트리는 "주요 파일 발췌"(line 35·48)라 신규 파일 추가 불요.

**배치 결정**: `NodeBootstrapService` 는 **execution-engine 모듈**에 둔다. bootstrap 은
nodes(ALL_NODE_COMPONENTS)+engine(NodeHandlerDependenciesProvider 가 ExecutionEventEmitter·
ConversationThreadService 등 **엔진 레이어 deps** 집약) 를 잇는 브리지 — nodes/core 거주 시 nodes→engine
순환 발생. 엔진 거주가 유일한 무순환 경로. god-class 서비스에서 bootstrap 책임·2개 의존·node 카탈로그
지식 제거라는 핵심 가치는 동일 달성. (full 레이어 역전은 dual-token + 인터페이스 필요 → step1 "소규모"
범위 밖, 효익 대비 과함.)

- [x] `WORKFLOW_EXECUTOR` 토큰 신설 (`workflow-executor.interface.ts` 에 co-locate)
- [x] `NodeBootstrapService`(OnModuleInit) 신설 — `componentRegistry.bootstrap(ALL_NODE_COMPONENTS, handlerDeps.build(workflowExecutor))`
- [x] 엔진 모듈: NodeBootstrapService provider + `{provide: WORKFLOW_EXECUTOR, useExisting: ExecutionEngineService}` 등록
- [x] 엔진 서비스 god-class 정리: ALL_NODE_COMPONENTS import·NodeComponentRegistry import/주입·NodeHandlerDependenciesProvider import/주입(+gratuitous forwardRef)·`registerHandlers`·onModuleInit bootstrap 호출 제거 (ctor 26→24 deps). `node-component.interface.ts` 의 stale wiring 주석 2건도 새 경로로 갱신
- [x] `nodes.module.ts:12` gratuitous forwardRef 제거 (no-cycle 실증: NodesModule→ExecutionEngineModule 은 NodeComponentRegistry 때문, NodesModule 을 import 하는 건 app.module 뿐 → 순환 없음)
- [x] 테스트: `node-bootstrap.service.spec.ts` (ALL_NODE_COMPONENTS 참조 동일성으로 전수 전달 단언 — 하드코딩 금지)
- [x] TEST WORKFLOW — lint ✓ · unit ✓(350 suites/7045) · build ✓ · e2e ✓(34 suites/202, 앱 부팅 정상)
- [ ] /ai-review + critical/warning fix
- [ ] /consistency-check --impl-done (engine 파일 변경 = spec code: 글로브 매칭 → 의무)
- [ ] push + PR (base main)

**검증**: 부팅 시 핸들러 전수 등록 unit + e2e 스모크(`execution-park-resume.e2e-spec.ts`).
**회귀 위험**: bootstrap 시점이 dispatch 보다 늦는 race → `onApplicationBootstrap`(assertConsistency)
이 모든 `onModuleInit` 후 실행 보장으로 봉인 (Nest lifecycle 계약).

## PR2 — AiTurnOrchestrator + EngineDriver — 대기

AI 멀티턴 생명주기 ~600줄 추출: `waitForAiConversation`·`processAiResumeTurn`·`handleAiMessageTurn`·
`finalizeAiNode`·`emitAiWaitingForInput`·`handleAiEndConversation`·`handleAiTurnError`·`reparkAiResumeTurn`
+ 정적 `extractAiTurnErrorPayload`. registry 의 `handleAiResumeTurn` 진입점을 신규 서비스로 위임.
EngineDriver 신설(콜백 표면: `_resumeCheckpoint`/`_resumeState` 컨텍스트, contextService, eventEmitter,
nodeExecutionRepository, conversationThreadService, segmentStartMs/llmDefaultConfigCache 접근).
`WaitingInteractionType`(interaction-type-registry.md §1.1 이 위치 못박음)은 **이동 안 함**.

## PR3 — Form/Button InteractionService — 대기

`waitForFormSubmission`/`processFormResumeTurn` + `waitForButtonInteraction`/`processButtonResumeTurn`
이동, registry 등록부만 엔진 잔류. EngineDriver 재사용.

## PR4 — RetryTurnService — 대기

`applyRetryLastTurn`/`buildRetryReentryState`/`resumeGraphAfterRetry`/`completeRetryExecution`/
`failRetryExecution`/`publishRetryLastTurn` 이동. `_retryState`/`_resumeCheckpoint` 는 spec §1.3 공유
계약 — allow-list 불변. EngineDriver 재사용.

## spec 갱신 (formal phase)

- **PR1**: 무변 (위 spec 대조).
- **PR2–4**: 추출 서비스를 `codebase/backend/src/modules/execution-engine/**` 글로브 내 유지 → 엔진
  spec `code:` 글로브 자동 커버. spec 무변 예상. spec-pinned 타입(`WaitingInteractionType`)은 이동 안 함.
  각 PR `/consistency-check --impl-done spec/5-system/4-execution-engine.md` 의무. 만약 추출 메서드가
  더 구체적 경로의 spec `code:` 로 참조되면 planner 위임 (developer 는 spec write 금지).

## 진행 로그

- 2026-06-16: plan 생성. 코드 구조 3-agent 매핑 완료. PR1 설계 확정 (spec 무변 실증).
