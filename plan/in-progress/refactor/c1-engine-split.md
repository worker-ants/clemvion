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
- [x] /ai-review — LOW · Critical 0 · Warning 4. W3(미사용 테스트 provider)·W4(onModuleInit 주석) fix(`0bd881c7`), W1·W2(레이어 배치·god-class 잔류) 수용. RESOLUTION.md(`review/code/2026/06/17/00_30_29`)
- [x] /consistency-check --impl-done — BLOCK: NO (INFO만). spec enrichment 2건(§1.0 주어·Rationale)은 비차단 → 체인 종료 시 일괄 (아래 spec 갱신 phase)
- [x] push + PR — **#622** (base `main`): https://github.com/worker-ants/clemvion/pull/622

**검증**: 부팅 시 핸들러 전수 등록 unit + e2e 스모크(`execution-park-resume.e2e-spec.ts`).
**회귀 위험**: bootstrap 시점이 dispatch 보다 늦는 race → `onApplicationBootstrap`(assertConsistency)
이 모든 `onModuleInit` 후 실행 보장으로 봉인 (Nest lifecycle 계약).

## PR2 — AiTurnOrchestrator + EngineDriver — ✅ 완료 (push/PR 대기)

청사진: [c1-pr2-aiturn-blueprint.md](./c1-pr2-aiturn-blueprint.md). 브랜치 `claude/engine-split-s2-aiturn` (base=PR1).
AI 멀티턴 생명주기 ~1,250줄을 god-class 에서 `AiTurnOrchestrator` 로 추출 — 엔진 9,657→8,411줄.

- [x] EngineDriver 인터페이스 + `ENGINE_DRIVER` 토큰(useExisting); 엔진 implements (7멤버)
- [x] AiTurnOrchestrator 신설 — 메서드 verbatim 이동 + `this.driver.X` 재배선; registry/dispatch-loop/retry 가 orchestrator 위임; forwardRef 순환 DI. `WaitingInteractionType` 미이동(§1.1). continue/endAiConversation 은 bus publisher 라 엔진 잔류(AI 생명주기는 bus→rehydration→orchestrator)
- [x] W3(ES module 순환): value helper 를 `ai-conversation-helpers.ts` (leaf) 로 분리, orchestrator→engine 은 `import type` 만 잔류
- [x] TEST — lint ✓ · unit ✓(30 suites/779 execution-engine) · build ✓(execution-engine clean) · e2e ✓(34/202, dockerized npm ci v12)
- [x] /ai-review — MEDIUM · C0 · W9. W1·2·3·5·7·8 fix(`d1386c07`), W4·6·9 수용. RESOLUTION.md(`review/code/2026/06/17/08_20_06`)
- [x] /consistency-check --impl-done — 1차 BLOCK:YES(Critical: RehydrationError re-export 체인) → 해소(`a894ad62`) 재실행 **BLOCK:NO**. 잔여 Warning 3(W-1/2/3) 비차단 → 후속/체인종료
- [x] push + PR — **#625** (base PR1 `claude/engine-split-s1-nodebootstrap` #622): https://github.com/worker-ants/clemvion/pull/625

**환경 노트**: otplib v13 공유(심링크) node_modules 오염(병렬 잡의 ^13 업그레이드)으로 호스트 build/full-unit 의 auth 부분 실패 — 본 PR 무관(`totp.service.ts` 미변경). dockerized e2e(npm ci=package-lock v12)는 면역·통과. 상세: RESOLUTION.md 환경 노트.

## PR3 — Form/Button InteractionService — ✅ 완료 (push/PR 대기)

Form/Button 블로킹 인터랙션을 god-class 에서 분리. 엔진 8,411→7,499줄. EngineDriver(7멤버) 재사용 — 신규 0.

- [x] FormInteractionService(waitForFormSubmission·processFormResumeTurn)+ButtonInteractionService(waitForButtonInteraction·processButtonResumeTurn) 신설 — verbatim 이동 + this.driver.X 재배선. `InteractionService` 명 회피(W-3). continueButtonClick·continueExecution(form publisher) 엔진 잔류. WaitingInteractionType 미이동
- [x] dispatch-loop 3쌍·resume registry form/buttons handle 위임. forwardRef 순환 DI(AiTurnOrchestrator 동일 패턴)
- [x] TEST — lint ✓ · unit ✓(32 suites/794 execution-engine) · build ✓(execution-engine clean) · e2e ✓(34/202 dockerized)
- [x] /ai-review — MEDIUM · C0. W-1/2/3(form spec emit·append·whitelist)+INFO-13(afterEach) fix(`77ae1522`); W-4/5(forwardRef) 일관 확인→INFO; SPEC-DRIFT→PR4. **security reviewer API 529×3 미생성** — 순수 추출(보안 surface 무변) transient gap 문서화. RESOLUTION.md(`review/code/2026/06/17/09_56_48`)
- [x] /consistency-check --impl-done — **BLOCK:NO**. Warning 2(`selectedItem`·`previousOutput`)는 git diff 실증 **verbatim 이동된 pre-existing SPEC-DRIFT** → PR4/planner
- [x] push + PR — **#626** (base PR2 `claude/engine-split-s2-aiturn` #625): https://github.com/worker-ants/clemvion/pull/626

## PR4 — RetryTurnService — ✅ 완료 (push/PR 대기)

retry-last-turn 생명주기를 god-class 에서 분리. 엔진 7,499→7,033줄 (PR1–4 누적 **9,670→7,033**). EngineDriver 재사용+5멤버 확장.

- [x] RetryTurnService 신설 — **이동**: `applyRetryLastTurn`·`completeRetryExecution`·`resumeGraphAfterRetry`·`failRetryExecution`. **엔진 잔류**: `retryLastTurn`(←websocket.gateway)·`applyRetryLastTurn`(←continuation processor) thin delegator; `publishRetryLastTurn`(publisher cluster, engine-private `buildPublishResult` 공유); `buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType`(EngineDriver 멤버, AI resume 공유). `_retryState`/`_resumeCheckpoint` allow-list 불변(§1.3)
- [x] EngineDriver +5멤버(rehydrateContext·loadAndBuildGraph·runNodeDispatchLoop·findActivatedBackEdge·clearLlmDefaultConfigCache) — retry 가 그래프 루프 구동. 엔진↔서비스 forwardRef 순환 DI
- [x] `ExecutionCancelledError` → leaf `workflow-errors.ts` 이동 (engine↔retry value cross-import 순환 선제 차단; PR2 RehydrationError 교훈)
- [x] TEST — lint ✓ · unit ✓(33 suites/805 execution-engine) · build ✓(execution-engine clean) · e2e ✓(34/202 dockerized)
- [x] /ai-review — MEDIUM · C0. W-5/6/7(retry 분기 테스트)+W-2/8(@internal JSDoc) fix(`cffd95c8`); W-1/3/9(strangler-fig 누적 구조)·W-4(completeRetryExecution verbatim pre-existing) 수용/이연. RESOLUTION.md(`review/code/2026/06/18/07_09_54`)
- [x] /consistency-check --impl-done — **BLOCK:NO**. Warning 1(본 plan PR4 절 stale)=본 갱신으로 해소. INFO(@internal 대칭·spec-sync)는 후속/체인종료
- [x] push + PR — **#627** (base PR3 `claude/engine-split-s3-formbutton` #626): https://github.com/worker-ants/clemvion/pull/627
- [x] 체인 종료 spec-sync: `spec-update-engine-split.md` → project-planner 가 spec **8개 파일** 반영(원안 7 + cross-spec 보강 `data-flow/15-external-interaction.md`) + /consistency-check --spec **BLOCK:NO** (`review/consistency/2026/06/18/09_27_06`; 1차 BLOCK:YES[plan frontmatter started 누락]→해소). plan 은 `plan/complete/spec-update-engine-split.md` 이동. (4 PR 머지 후 실행 — 전부 비차단: impl-done 4회 BLOCK:NO.)

**후속(impl-done INFO)** — ✅ **완료 (후속 ①, 2026-06-19)**: `ExecutionCancelledError`(workflow-errors)·EngineDriver 인터페이스 신규 5멤버 `@internal` JSDoc 대칭 추가 + `ExecutionGraphState`/`NodeDispatchLoopParams` → 신규 leaf `types/graph-dispatch.types.ts` 이동(engine-driver.interface.ts↔service.ts 타입 레벨 순환 해소). 커밋 `29e38a38`(impl)·`8a9d8a06`(ai-review INFO 주석). TEST lint·unit(805)·build·e2e(34/202) ✓. ai-review LOW·C0·W4(전부 수용/검증)·impl-done **BLOCK:NO**(`review/consistency/2026/06/19/01_58_07`). RESOLUTION `review/code/2026/06/19/01_41_04`(+ delta 재검토 `02_19_11`, review-gate 해소). **PR #629** (base main): https://github.com/worker-ants/clemvion/pull/629.

## spec 갱신 (formal phase)

- **PR1**: 기능적 spec 무변 (impl-done `BLOCK: NO`). 단 impl-done 이 **선택적 enrichment 2건**(INFO, 비차단) 식별 — 현재 spec 텍스트가 틀린 건 아니나 트리거 구조를 반영하면 명확:
  - `4-nodes/0-overview.md §1.0`: bootstrap 주어를 "`NodeBootstrapService.onModuleInit` 이 `NodeComponentRegistry.bootstrap` 호출" 로 명시 (현 텍스트도 NodeComponentRegistry 순회로 참).
  - `5-system/4-execution-engine.md §Rationale`: god-class 분리 결정 항 신설 — NodeBootstrapService 분리·`WORKFLOW_EXECUTOR` 용처(C-1 B옵션 "내부 통신 재사용" 기각과 구별)·forwardRef 자기참조 제거.
  → **체인 종료(PR4) 시 planner 가 일괄 반영하는 정식 phase**. 이유: Rationale 은 god-class split 전체(EngineDriver·AiTurnOrchestrator·Form/Button·Retry)를 아우를 때 일관되며 PR1-단독은 불완전. **PR4 DoD 에 "spec Rationale/§1.0 enrichment planner 반영 + /consistency-check --spec BLOCK:NO" 포함.**
- **PR2–4**: 추출 서비스를 `codebase/backend/src/modules/execution-engine/**` 글로브 내 유지 → 엔진
  spec `code:` 글로브 자동 커버. spec 무변 예상. spec-pinned 타입(`WaitingInteractionType`)은 이동 안 함.
  각 PR `/consistency-check --impl-done spec/5-system/4-execution-engine.md` 의무. 만약 추출 메서드가
  더 구체적 경로의 spec `code:` 로 참조되면 planner 위임 (developer 는 spec write 금지).
- **PR2 식별 spec-sync 항목** (impl-done INFO/Warning, 비차단 — 체인 종료 planner 일괄):
  - `4-nodes/3-ai/1-ai-agent.md §10` `classifyLlmError` 포인터 → `AiTurnOrchestrator.extractAiTurnErrorPayload`; frontmatter `code:` 에 `ai-turn-orchestrator.service.ts` 추가.
  - `conventions/interaction-type-registry.md §1.2` emit 위치 열에 `ai-turn-orchestrator.service.ts` 추가 + frontmatter `code:` 등재.
  - `5-system/4-execution-engine.md §1.3·§7.5` 의 `waitForAiConversation`/`processAiResumeTurn`/`handleAiResumeTurn` 소속을 `AiTurnOrchestrator` 로 명시; §Rationale 에 `EngineDriver` `useExisting`(in-process 전제) 명시; `4-nodes/6-presentation/0-common.md` L426 포인터 정정.
- **PR3 식별 spec-sync 항목** (impl-done Warning/INFO, **pre-existing SPEC-DRIFT** — verbatim 기존 행위, 체인 종료 planner 일괄):
  - `node-output.md §4.5` `button_continue` data shape 에 `selectedItem?`·`url?` optional 등재 (carousel item-level 링크 버튼 — git diff 로 verbatim 이동 실증).
  - `node-output.md §4.2` `previousOutput` Phase 3 유예 예외 등재 (presentation resume 경로 — 코드 주석 근거 존재, verbatim 이동).
  - `4-execution-engine.md §1.3·§7.5` form/button 메서드 소속을 `FormInteractionService`/`ButtonInteractionService` 로 명시; `interaction-type-registry.md §1.2` buttons emit 위치 + frontmatter `code:` 등재; `data-flow/3-execution.md` 시퀀스 actor 갱신.

## 후속 고려 (review 파생)

> **진행 현황 (2026-06-19~)**: 실행 순서 = 후속 ①(@internal 대칭 + 타입 leaf 이동 — ✅ **완료**, 위 PR4 절) → ② `LLM_API_ERROR` 테스트 → ⑤ ButtonInteraction 분해 → ③ LLM 기록 타입통합 → ★ assertSameWorkspace fail-closed(✅ **완료**) → ④ forwardRef 순환 DI 제거(고위험·단독·e2e 필수) → ⑥ `previousOutput` Phase 3(별도 plan 의존). 각 항목 독립 소 PR (base main).

- **`assertSameWorkspace` fail-open → fail-closed** (ai-review INFO-2; 후속 ① ai-review INFO #11 재확인) — ✅ **완료 (★, 2026-06-19, branch `assert-workspace-6215be`)**: sub-workflow 진입점(executeInline/executeSync/executeAsync) workspace 격리를 fail-open(누락 시 로그-후-통과)→fail-closed(누락 시 `WORKFLOW_FORBIDDEN_WORKSPACE` deny)로 전환. **착수 전 호출경로 전수 trace**(general-purpose subagent)로 프로덕션 3 호출처 전부 workspace 컨텍스트 공급 입증(executeInline×2=handler sync+background consumer, executeAsync×1=handler parentWorkspaceId; executeSync 프로덕션 호출자 0) → blanket fail-closed 안전 확정. 동일 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드 재사용(신규 코드 미도입). 커밋 `4ad33c8b`(impl)+`2d6f0de8`(ai-review fix: withWorkspace 헬퍼 공유화·sync/async mismatch 테스트). TEST lint·build·unit(execution-engine 319, +5 fail-closed 케이스)·dockerized e2e(34/202, 2회) ✓. impl-prep **BLOCK:NO**(`13_25_28`). ai-review 1차 LOW·C0·W4→fix, 2차 MEDIUM·C0·W3 전부 dispositioning 수렴(deploy-risk=trace 검증·nicety·pre-existing). RESOLUTION `review/code/2026/06/19/17_05_22`+`17_15_57`. **PR #637**: https://github.com/worker-ants/clemvion/pull/637.
  - **SPEC-DRIFT 후속(planner)**: fail-closed 행동(callerWorkspaceId 누락 시 throw)이 spec 미반영 — `spec/4-nodes/2-flow/1-workflow.md §2 W-6` callout + `spec/5-system/4-execution-engine.md` workspace-isolation 절에 "누락 시에도 fail-closed throw" 명시. + impl-prep WARNING(에러 카탈로그): `WORKFLOW_FORBIDDEN_WORKSPACE`·`SUB_WORKFLOW_NOT_FOUND`·`SUB_WORKFLOW_TIMEOUT`·`SUB_WORKFLOW_QUEUE_FAILED` 를 `spec/5-system/3-error-handling.md §1.4/§3.2` 등재 + `error-codes.ts` enum(dev). 비차단.
- **`LLM_API_ERROR` passthrough 정규화 테스트 보강** (PR2 impl-done W-1) — ✅ **완료 (후속 ②, 2026-06-19, branch `llm-error-passthrough`)**: `classifyLlmError` 의 미등록 코드
  passthrough 경로에 정규화 어서션 추가 — 기존 `LLM_API_ERROR` 테스트에 `result.code` 보존 단언 + 미등록 `LLM_PROVIDER_QUOTA` 전용 테스트(spec §10 L1099 "명시 code 보존" 회귀 가드). TEST lint·unit(806)·build·e2e(34/202) ✓. ai-review **C0/W0** · impl-done **BLOCK:NO**. **SPEC-DRIFT 후속(planner)**: impl-done Warning — 미등록 explicit code passthrough(vendor 코드 포함)는 pre-existing 행위이나 `spec/4-nodes/3-ai/1-ai-agent.md §10 L1099` 가 그 범위를 미명시 → planner 가 (a) 미등록 code passthrough 허용·retryable=false, (b) HTTP status 는 top-level `.status` 기준 명시. **PR #630**: https://github.com/worker-ants/clemvion/pull/630.
- **LLM 호출 기록 도메인 타입 통합** (PR2 impl-done W-3/I-7·I-8): `ai-conversation-helpers` 의
  `LlmCallRecord`/`AiTurnDebugEntry` 와 `information-extractor.handler` 의 `LlmCallTrace`/`TurnDebugEntry` 가
  동일 JSONB 도메인을 이름 분기로 중복 — `shared/` 승격·통일 별도 후속. `RehydrationError` 위치
  (`ai-conversation-helpers` vs `workflow-errors` 집중 패턴)도 함께 검토.
  - ✅ **완료 (후속 ③, 2026-06-19, branch `llm-record-types`)**: `shared/llm-tracing/llm-call-record.ts` 신설 — canonical `LlmCallRecord`(all-optional superset) + `TurnDebugEntry`. EE+IE 로컬 중복 제거·shared import. 커밋 `f70dbbfa`. TEST lint·unit(ee 822/ie 71/ai-agent 420)·build·e2e(34/202) ✓. ai-review LOW·C0·W2(deferrable)·impl-done BLOCK:NO. RESOLUTION `review/code/2026/06/19/08_42_57`. **PR #632**: https://github.com/worker-ants/clemvion/pull/632.
    - **`RehydrationError` 미이동** 결정: ai-conversation-helpers leaf = orchestrator↔engine 순환차단 의도(C-1 step3) 유지(workflow-errors 이동 시 순환 재발).
    - **후속(별도)**: (a) `ai-agent.handler.ts` inline llmCalls → shared 전환(범위밖·stricter shape loosen 평가) + StructuredInteraction(item⑤) 묶어 **type-consolidation**, (b) **SPEC-DRIFT(planner)**: `startedAt`/`finishedAt`·canonical SoT → `0-common.md §6`/`1-ai-agent.md §8` 반영 + frontmatter `code:` 에 shared 등록 + `TurnDebugEntry` spec full 진단필드 superset 확장, (c) frontend `TurnDebugEntry` 다중정의 rename(중기).
- **엔진→서비스 주입 방향 제거(caller-side 전환)** (PR2·PR3 architecture WARNING): 엔진↔추출서비스 양방향
  forwardRef 순환 DI 는 strangler-fig 의도된 중간상태. **체인 종료(엔진 슬림화 완료) 시** 엔진이 서비스를
  주입받는 방향을 제거하는 백로그. (현재 토큰 주입은 정상·일관 — AiTurnOrchestrator/Form/Button 동일.)
- **ButtonInteractionService 타입·분해** (PR3 INFO) — ✅ **완료 (후속 ⑤, 2026-06-19, branch `button-interaction`)**: `ButtonClickPayload` discriminated union + `isButtonClickPayload` 타입가드 + `resolveButtonInteraction`(payload→port/interaction 결정, 4 variant) + `buildResumedStructuredOutput` 순수함수 추출 (행위보존, I/O 순서 flat→structured→thread→DB→event 보존). 커밋 `4fb918d7`+`2ad44a71`. TEST lint·unit(execution-engine 33s/821; button-interaction 27)·build·e2e(34/202) ✓. ai-review 1차 MEDIUM(W6 fix)→2차 LOW(W7 전부 수용/이연·회귀 아님)·impl-done BLOCK:NO. RESOLUTION `review/code/2026/06/19/03_51_29`. **PR #631**: https://github.com/worker-ants/clemvion/pull/631.
  - **범위 재조정**: `EngineDriver` ISP 부분인터페이스 → **후속 ④(엔진 DI 재구조화)로 이연** (#629 @internal 충돌 + ENGINE_DRIVER 소비자 전수 변경 동반). `WaitingInteractionType` 이동 → **제외**(spec-pinned — `interaction-type-registry.md §1.1/§1.2` SoT, plan L88 "미이동" 명시).
  - **SPEC-DRIFT 후속(planner)**: (a) 순수함수 추출(resolveButtonInteraction/buildResumedStructuredOutput) → `4-execution-engine.md §Rationale C-1` 등재, (b) `node-output.md §4.2` interaction.type 열거에 `button_continue` 추가(§4.5 일관) + `4-nodes/6-presentation/0-common.md §4` button_continue `url?` 조건부 정정.
- **`previousOutput` Phase 3 완전 제거** (spec-sync plan-coherence INFO, 2026-06-18): `node-output.md §4.2` 의
  presentation resume(`ButtonInteractionService`) `previousOutput` 보존 예외는 transitional — `node-output-redesign`
  plan 재개 시 Phase 3 정리와 함께 제거 검토 (현재 충돌 없음, 기존 행위 verbatim).
- **spec §Rationale C-1 EngineDriver 멤버목록 갱신** (후속 ① ai-review SPEC-DRIFT INFO #1, 2026-06-19): `spec/5-system/4-execution-engine.md` §Rationale C-1 의 EngineDriver 멤버 예시가 3개인데 실제 **12개**(step2 7 + step4 5). 본문 staleness — **planner 후속**(developer spec read-only). "최소 seam 원칙으로 필요한 멤버를 추가" 산문 또는 전체 12개 목록으로 갱신. 코드 무변·비차단.

## 진행 로그

- 2026-06-16: plan 생성. 코드 구조 3-agent 매핑 완료. PR1 설계 확정 (spec 무변 실증).
- 2026-06-17: **PR1 구현·검증 완료.** TEST(lint·unit 350/7045·build·e2e 34/202) 통과 →
  commit `7e38716a`. /ai-review LOW(C0/W4) → W3·W4 fix `0bd881c7`, RESOLUTION.md. impl-prep·
  impl-done 모두 `BLOCK: NO`. 02-architecture.md C-1 step1·m-3 완료 표기·L401 배치 정정.
  **PR #622 생성 (base main) — PR1 완료.** 다음: PR2 `AiTurnOrchestrator` + `EngineDriver` (base = PR1 브랜치).
- 2026-06-17: **PR2 구현·검증 완료** (subagent 외과적 추출 + main 게이트). 엔진 9,657→8,411줄,
  AiTurnOrchestrator 1,332줄, EngineDriver 7멤버. TEST(lint·unit 30/779·build·e2e 34/202 dockerized).
  /ai-review MEDIUM(C0/W9)→fix `d1386c07`. impl-done BLOCK:YES(RehydrationError)→해소 `a894ad62`→BLOCK:NO.
  otplib v13 공유 node_modules 오염은 환경문제(본 PR 무관, dockerized 면역). push/PR 대기 → 이후 PR3 Form/Button.
- 2026-06-17: **PR3 구현·검증 완료** (subagent 추출 + main 게이트). 엔진 8,411→7,499줄, FormInteractionService
  355줄 + ButtonInteractionService 455줄, EngineDriver 신규멤버 0. TEST(lint·unit 32/794·build·e2e 34/202).
  /ai-review MEDIUM(C0)→form spec 어서션 fix `77ae1522`; security reviewer 529×3 미생성(순수추출 gap 문서화).
  impl-done BLOCK:NO(Warning 2 = verbatim pre-existing SPEC-DRIFT). push/PR 대기 → 이후 PR4 RetryTurnService.
- 2026-06-18: **PR4 구현·검증 완료** (주간 한도 리셋 후 재개; subagent 추출 + main 게이트). 엔진
  7,499→7,033줄(누적 9,670→7,033), RetryTurnService 654줄, EngineDriver +5멤버. `ExecutionCancelledError`
  를 leaf workflow-errors 로 선제 이동해 engine↔retry 순환 차단(PR2 교훈). TEST(lint·unit 33/805·build·e2e
  34/202). /ai-review MEDIUM(C0)→retry 분기 테스트+@internal JSDoc fix `cffd95c8`(W-1/3/4/9 수용/이연).
  impl-done BLOCK:NO(Warning 1=본 plan PR4 절 stale, 갱신 해소). **코드 4-PR 체인 완성** → push/PR4 + spec-sync(planner) 잔여.
- 2026-06-18: **4 PR 전체 머지 완료** (#622·#625·#626·#627 → origin/main `0c275dd7`). stacked 체인 cascade 충돌은 squash-머지마다 `rebase --onto origin/main`(중복 커밋 드롭)+force-push 로 순차 해소(#622→#625, #625→#626, #626→#627). 최종 병합상태 dockerized e2e 34/202 통과. **체인 종료 spec-sync 완료**(planner): spec **8개 파일**(원안 7 + `data-flow/15-external-interaction.md` cross-spec 보강) 코드정합 반영, `/consistency-check --spec` **BLOCK:NO**(`09_27_06`; 1차 09_15_57 BLOCK:YES[plan started 누락]→해소). 메서드 포인터 실측 정정 2건(classifyLlmError 존재·AiTurnOrchestrator 이동, L426=processAiResumeTurn). 엔진 최종 **7,035줄**(실측). `spec-update-engine-split.md` → `plan/complete/` 이동. **C-1 god-class 분할 로드맵 완료** — 잔여는 `## 후속 고려` review-파생 백로그(별도 후속).
