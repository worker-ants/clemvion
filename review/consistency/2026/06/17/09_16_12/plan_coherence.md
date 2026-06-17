### 발견사항

- **[INFO]** `refactor/02-architecture.md` C-1 step1 체크박스가 plan 파일(main 브랜치 버전)에서 미완료(`[ ]`)로 남아 있음
  - target 위치: diff 코드 주석 전반 — `C-1 step2 (strangler-fig)`, `C-1 step3 (W3)` 레이블
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-1 라인 21 `- [ ] 1. NodeBootstrapService`
  - 상세: main 브랜치의 `plan/in-progress/refactor/02-architecture.md` 는 step1 NodeBootstrapService 를 `- [ ]` 미착수로 표기 중이다. 그러나 engine-split 워크트리의 `plan/in-progress/refactor/02-architecture.md`(L13: `- [ ] 진행 중 … step1 … PR1 완료, step2–4 대기`)·`c1-engine-split.md`(L21: `- [x] 1. NodeBootstrapService ✅ PR1 완료`) 에서는 이미 완료로 표기되어 있고, PR #622 가 실제로 랜딩됐다. 즉 main 브랜치의 plan 파일이 step1 완료를 반영하지 않아 stale 상태이다. step2 AiTurnOrchestrator 는 step1 이 선행 완료된 위에서 실행되는 적법한 순서이므로, step2 이행 자체가 미해결 결정과 충돌하지는 않는다.
  - 제안: main 브랜치 `plan/in-progress/refactor/02-architecture.md` C-1 step1 항목을 `[x]` + PR #622 ref 로 갱신 (plan 갱신 — worktree 병합 시 자동 해소 가능).

- **[WARNING]** `interaction-type-registry.md` frontmatter `code:` 에 신규 `ai-turn-orchestrator.service.ts` 가 미등재
  - target 위치: `ai-turn-orchestrator.service.ts` 전반 — `WaitingInteractionType` 을 type-only import 로 참조하며, `emitAiWaitingForInput` 의 `initialInteractionType: WaitingInteractionType` 분기(L2012)가 4값 enum 을 소비
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/refactor/c1-engine-split.md` PR2 단락: "`WaitingInteractionType`(interaction-type-registry.md §1.1 이 위치 못박음)은 이동 안 함"
  - 상세: `interaction-type-registry.md §1.1 단일 진실 위치` 표는 백엔드 SoT 를 `execution-engine.service.ts` 로 못박고, frontmatter `code:` 에는 6개 파일만 열거한다. 신규 `ai-turn-orchestrator.service.ts` 는 `WaitingInteractionType` 을 type-only import(`import type { WaitingInteractionType } from './execution-engine.service'`)로만 참조하므로 단일 진실 위치 이동은 없다 — 규약 §1.1 위반은 아니다. 그러나 `emitAiWaitingForInput` 내부에서 `'ai_form_render'` / `'ai_conversation'` 리터럴을 직접 사용하는 분기 코드가 추가됐으므로, `interaction-type-registry.md §1.2` 의 "Backend emit 위치" 열 및 frontmatter `code:` 에 해당 파일이 등재되지 않으면 AST 가드(interaction-type-exhaustiveness.test.ts `REGISTRY_SITES`)와 매트릭스가 신규 파일을 감시 범위 밖으로 누락한다. `c1-engine-split.md` 는 이 점을 "spec-pinned 타입은 이동 안 함" 으로 처리하고 frontmatter 갱신을 PR4 완료 시 일괄로 미룬다고 명시하나, `§1.2` 매트릭스 emit 위치 열 갱신은 별도로 언급되지 않는다.
  - 제안: plan `c1-engine-split.md` PR2 DoD 에 "`interaction-type-registry.md §1.2` 매트릭스 `ai_conversation`·`ai_form_render` emit 위치 열에 `ai-turn-orchestrator.service.ts` 추가(planner 위임)" 항목을 명기하거나, PR4 완료 시 일괄 반영 대상에 포함시켜 gap 을 기록한다. frontmatter `code:` 는 `codebase/backend/src/modules/execution-engine/**` 글로브로 엔진 스펙이 자동 커버하므로 interaction-type-registry frontmatter 는 개별 파일 명시가 필요하다.

- **[INFO]** `exec-park-durable-resume.md` 잔여 미구현 표면(PR3 rehydration 일반화)이 본 AiTurnOrchestrator 추출과 직접 충돌 없음 확인
  - target 위치: 없음 (충돌 없음)
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/exec-park-durable-resume.md` L216 `umbrella 잔여: PR3 rehydration 일반화(ai_agent → 일반 노드)`
  - 상세: exec-park umbrella 의 미완료 항목(PR3 rehydration 일반화, node-cancellation §2)은 AI 멀티턴 경로가 아닌 비-ai 노드의 rehydration 확장이다. AiTurnOrchestrator 추출은 엔진 내 AI 멀티턴 코드를 서비스로 이동하는 것이므로 표면이 겹치지 않는다. exec-park PR3 착수 시 `AiTurnOrchestrator` 의존이 새로 생기지 않고 `ExecutionEngineService` 의 비-AI 경로가 대상이므로, 후속 plan 수정 없이 두 작업이 병렬 진행 가능하다.

- **[INFO]** `execution-engine-residual-gaps.md` G1/G2 BLOCKED 항목과 무충돌
  - target 위치: 없음 (충돌 없음)
  - 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/execution-engine-residual-gaps.md` G1(WS execution.start gate)·G2(errorPolicy continue)
  - 상세: G1·G2 는 shutdown gate / errorPolicy 분기이며 AI 멀티턴 추출 범위 밖이다. 본 PR 이 해당 BLOCKED 결정을 우회하거나 변경하지 않는다.

### 요약

Plan 정합성 관점에서 이번 변경(C-1 step2 AiTurnOrchestrator + EngineDriver 추출)은 `refactor/02-architecture.md` C-1 의 권장 방식(A — strangler-fig 단계별) 및 `c1-engine-split.md` 로드맵과 정합하다. `WaitingInteractionType` 정의는 `execution-engine.service.ts` 에 잔류해 `interaction-type-registry.md §1.1` 핀을 준수한다. 단 `ai-turn-orchestrator.service.ts` 가 `'ai_form_render'` / `'ai_conversation'` 리터럴을 직접 사용하는 분기를 가지므로, `§1.2` 매트릭스 "Backend emit 위치" 열 갱신이 현재 plan DoD 에 명시되지 않은 상태다 — 이를 plan 에 후속 항목으로 명기해야 한다. main 브랜치 plan 파일의 step1 stale 체크박스는 자연스럽게 PR 병합 시 해소되지만, 직접 갱신해도 무방하다. exec-park umbrella 잔여·G1/G2 BLOCKED 항목과의 충돌은 없다.

### 위험도

LOW
