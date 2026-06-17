# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
대상 diff: `claude/engine-split-s1-nodebootstrap...HEAD` — `execution-engine` god-class 분리 (C-1 step2/step3)
분석 파일: `ai-conversation-helpers.ts`, `ai-turn-orchestrator.service.ts`, `ai-turn-orchestrator.service.spec.ts`

---

## 발견사항

### [WARNING] `classifyLlmError` SoT 주석 — 스펙 포인터 구식화
- **target 위치**: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` L1045, L1081 (`classifyLlmError` / `extractAiTurnErrorPayload` 정적 메서드)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/3-ai/1-ai-agent.md` §10 에러 코드 표 끝 주석
  ```
  구현: `ExecutionEngineService.classifyLlmError`
  ```
- **상세**: 이번 구현 변경으로 `classifyLlmError` 와 `extractAiTurnErrorPayload` 가 `ExecutionEngineService` 에서 `AiTurnOrchestrator` 의 `private static` 메서드로 이동됐다. spec 의 "구현: `ExecutionEngineService.classifyLlmError`" 포인터는 이제 잘못된 파일을 가리킨다. 실행 엔진 spec (`spec/5-system/4-execution-engine.md`)에도 `applyContinuation` → `processAiResumeTurn` 경로를 서술하며 engine service 의 퍼블릭 메서드 목록을 참조하고 있으나, 그 처리 로직이 orchestrator 로 이전된 사실이 spec 에 반영되지 않았다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §10 의 "구현: `ExecutionEngineService.classifyLlmError`" 주석을 `AiTurnOrchestrator.classifyLlmError` (또는 `extractAiTurnErrorPayload`)로 갱신. `spec/5-system/4-execution-engine.md` §7.5/§Rationale 의 구현 파일 언급에서도 orchestrator 분리를 명시하는 것이 권장된다.

---

### [WARNING] `interaction-type-registry.md` §1.1 단일 진실 위치 — 구현 일치는 유지되나 명시적 핀이 필요
- **target 위치**: `ai-turn-orchestrator.service.ts` L1700 주석: "C-1 step3 (W3) — `WaitingInteractionType` 정의는 interaction-type-registry.md §1.1 핀에 따라 엔진 파일에 잔류한다."
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/conventions/interaction-type-registry.md` §1.1 단일 진실 표
  ```
  | Backend | codebase/backend/src/modules/execution-engine/execution-engine.service.ts |
  ```
- **상세**: `WaitingInteractionType` 의 정의 자체는 실제로 `execution-engine.service.ts` L192 에 그대로 잔류하고, orchestrator 는 `type`-only import 로 참조한다(`import type { WaitingInteractionType } from './execution-engine.service'`). 충돌은 없다. 그러나 `interaction-type-registry.md §1.1` 의 `code` 배열에는 `ai-turn-orchestrator.service.ts` 가 등록되지 않았고(신규 소비자), `interaction-type-registry.md` spec 의 `code:` frontmatter 에도 `execution-engine.service.ts` 만 나열된다. orchestrator 가 해당 타입의 **공개 소비자**가 됐으므로 매트릭스에 참조 표기가 없으면 향후 값 추가 시 동기화 누락 위험이 생긴다.
- **제안**: `spec/conventions/interaction-type-registry.md` §1.1 표에 `AiTurnOrchestrator` 가 `type`-import 로 소비한다는 비고를 추가하고, spec frontmatter `code:` 배열에 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 를 등재하는 것이 권장된다. 정의 위치(`execution-engine.service.ts`) 변경은 없으므로 CRITICAL 아님.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §10.9 구현 포인터 구식화 가능성
- **target 위치**: `ai-turn-orchestrator.service.ts` (processAiResumeTurn 4-케이스 분기 구현)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/4-nodes/6-presentation/0-common.md` L426
  ```
  backend `execution-engine.service.ts` `continueExecution` (wrap) · ContinuationExecutionProcessor →
  ExecutionEngineService.applyContinuation → rehydrateAndResume (forward) · processAiResumeTurn (4 케이스 명시 매칭)
  ```
- **상세**: spec 이 `processAiResumeTurn` 을 명시하지만 구현 파일을 `execution-engine.service.ts` 로 암묵 귀속하고 있다. 실제로는 `AiTurnOrchestrator.processAiResumeTurn` 이 처리한다. engine service 의 `continueAiConversation`/`endAiConversation` 은 여전히 public 진입점이며 orchestrator 로 위임하므로 기능 계약 자체의 모순은 없으나, 독자가 구현을 찾을 때 혼란을 줄 수 있다.
- **제안**: `spec/4-nodes/6-presentation/0-common.md` L426 의 포인터를 `ExecutionEngineService.continueAiConversation → AiTurnOrchestrator.processAiResumeTurn (4 케이스 명시 매칭)` 으로 정정.

---

### [INFO] `spec/5-system/4-execution-engine.md` §7.5 구현 경로 서술 — orchestrator 위임 언급 없음
- **target 위치**: `spec/5-system/4-execution-engine.md` L170: "`dispatchResumeTurn` … 경유로 `handleAiResumeTurn` → `processAiResumeTurn`"
- **충돌 대상**: 해당 메서드들이 이제 `AiTurnOrchestrator` 소속임 (이번 변경)
- **상세**: 기능 계약과 상태 머신 서술은 정확하다. 단, 구현 수준의 메서드 이름 언급이 engine service 소속으로 암시되어 있으나 실제로는 orchestrator 소속이다. 아키텍처 관점 서술(계층 책임)에는 영향이 없다.
- **제안**: spec §7.5 의 해당 서술에 "`handleAiResumeTurn` / `processAiResumeTurn` — `AiTurnOrchestrator` 소속, engine 은 `forwardRef` DI 경유 위임" 비고를 추가. 우선순위 낮음 — 계약 충돌 없음.

---

### [INFO] `data-flow/15-external-interaction.md` 구현 포인터 구식화
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/spec/data-flow/15-external-interaction.md` L108~109
  ```
  ExecutionEngineService.continueAiConversation(executionId, message)
  ExecutionEngineService.endAiConversation(executionId)
  ```
- **충돌 대상**: 실제로 이 메서드들은 `ExecutionEngineService` 에 public 진입점으로 잔류하며, 내부에서 `AiTurnOrchestrator` 에 위임한다. 외부 계약(메서드 시그니처)은 변경 없음.
- **상세**: 계약 충돌 없음. 단, spec 이 "엔진이 직접 처리" 를 시사하는 서술이라면 독자가 orchestrator 분리를 모를 수 있다.
- **제안**: 현재로서는 외부 진입점이 engine service 에 유지되므로 spec 변경 불필요. 단, 향후 engine service 가 thin façade 로만 남을 경우 data-flow spec 도 함께 갱신한다.

---

## 요약

이번 변경(C-1 step2/step3 — `AiTurnOrchestrator` 추출 + `ai-conversation-helpers` leaf 모듈 분리)은 **기능 계약 수준의 spec 모순을 만들지 않는다**. 상태 머신(`spec/5-system/4-execution-engine.md §1`)·에러 코드 taxonomy(`spec/4-nodes/3-ai/1-ai-agent.md §10`)·`WaitingInteractionType` enum 값(`spec/conventions/interaction-type-registry.md §1.1`)·WebSocket 이벤트 payload shape(`spec/5-system/6-websocket-protocol.md §4.4`) 모두 구현과 일치한다. 충돌은 **구현 파일 포인터** 수준에서만 발생했다 — `classifyLlmError` 의 소속 클래스가 `ExecutionEngineService` 에서 `AiTurnOrchestrator` 로 이동했으나 spec 주석이 구식화됐고, `interaction-type-registry.md §1.1` 에 새로운 소비자(`AiTurnOrchestrator`)가 등재되지 않아 미래 enum 추가 시 동기화 누락 위험이 있다. 두 항목 모두 WARNING 등급으로, 기능 동작을 막지는 않으나 spec 과 코드의 장기 정합을 위해 관련 spec 파일 갱신이 권장된다.

## 위험도

LOW
