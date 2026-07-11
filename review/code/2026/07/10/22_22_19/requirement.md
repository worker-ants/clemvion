# 요구사항(Requirement) Review

대상: `claude/ai-usage-attribution-hardening-358929` (merge-base `origin/main` = `cc3dafa8c`, base 최신 — stale-base 아님, `git diff --stat` 9 파일 확인)
요구사항 SoT: `spec/data-flow/7-llm-usage.md` §1.3
plan: `plan/in-progress/ai-usage-attribution-hardening.md` (B1 타입 하드닝 + C1 메모리 압축 attribution 배선)

## 발견사항

- **[SPEC-DRIFT]** `spec/data-flow/7-llm-usage.md` §1.3 이 이번 배선으로 stale 해짐 — 코드가 옳고 spec 갱신만 누락
  - 위치: `spec/data-flow/7-llm-usage.md:107`(§1.3 표 "AI Agent 자동 메모리 롤링 요약 압축 ... `context` 미전달 → ... 전부 NULL ... 잔여 갭"), `:113`(요약문 "노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐"), `:162`(§4 Agent Memory 행 "롤링 요약 압축 chat (usage 적재, context NULL)"), `:206`(Rationale "(b) `LlmCallContext` 가 아직 배선되지 않은 caller ... AI Agent 자동 메모리 롤링 요약 압축")
  - 상세: 이번 diff(`ai-memory-manager.ts` / `agent-memory-injection.ts` / `ai-turn-executor.ts`)가 실제로 롤링 요약 압축 chat 에 `workflowId`/`executionId`/`nodeExecutionId` 를 채우도록 배선했음을 코드·테스트로 확인했다(single-turn `context.*`, multi-turn resume `state.*` — `ai-agent.memory.spec.ts:516-521`, `ai-memory-manager.spec.ts:480-522`, `agent-memory-injection.spec.ts:1177-1203`이 회귀로 고정). §1.3 이 명시했던 "잔여 attribution 갭 해소" 방향과 정확히 부합하는 의도된 개선이므로 코드는 맞고 spec 본문 서술만 낡았다.
  - 제안: 코드는 그대로 유지. `plan/in-progress/ai-usage-attribution-hardening.md` 의 "SPEC-DRIFT (PR-2 로 이관)" 섹션이 이미 이 정확한 위치(L107·L113·§4 표 L162·Rationale L189~206)를 cross-ref 로 추적하고 있어 처리 경로가 명확하다 — `project-planner` 가 후속 PR(plan 이 지칭하는 "PR-2")에서 "전부 NULL/미배선/잔여 갭" 서술을 "첫 턴/단발은 `context.*`, resume 은 `state.*` 채움"으로 갱신해야 한다. 본 PR(PR-1) 자체를 이 사유로 차단할 필요는 없다 — plan 이 이미 병합 순서(PR-1 → PR-2 연속)를 명시했다.

- **[WARNING]** multi-turn resume 경로의 요약 압축 chat attribution(`state.workflowId`/`state.nodeExecutionId` → `llmContext` 조립) 자체가 end-to-end 로 회귀 고정되지 않음 — 이전 라운드(WARNING#2)의 후속 조치가 부분적
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2296-2302`(`applyMultiTurnTurnMemory` 의 `llmContext: { workflowId: state.workflowId as ..., executionId: executionId ?? undefined, nodeExecutionId: state.nodeExecutionId as ... }` 조립부), `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts:480-522`(신규 테스트)
  - 상세: 신규 추가된 `ai-memory-manager.spec.ts` 테스트("multi-turn(system-only) 압축 시 요약 chat 에 caller 의 llmContext 를 그대로 전달한다")는 테스트 코드가 **직접 만든** `llmContext` 객체(`{workflowId:'wf-x', ...}`)를 `injectMemoryContext` 인자로 넘기고, `AiMemoryManager` 가 그것을 `buildSummaryBufferUpdate` 로 정확히 forward 하는지만 검증한다. `ai-turn-executor.ts:2296-2302` 의 실제 `state.workflowId`/`state.nodeExecutionId` **추출·조립 로직**(캐스트 3줄)은 이 테스트로도, `ai-agent.memory.spec.ts` 의 기존 multi-turn 통합 테스트(`multi_turn: first turn over budget sets runningSummary...`, 213~290행 — turn1 이 실제로 요약 콜을 트리거함에도 `mock.calls[0][2]` 미단언)로도 실행/단언되지 않는다. `ai-turn-executor.spec.ts` 는 이 노드의 `summary_buffer`/`persistent` 케이스를 아예 다루지 않는다(`memoryStrategy: 'manual'` 만 존재, 442~468행). 신규 테스트의 인라인 주석("WARNING#2 대칭 커버 ... 여기서 injectMemoryContext→요약 chat forwarding 을 고정한다")은 "multi-turn resume 경로(state.* 조립)" 를 고정한다고 서술하지만, 실제로는 `state.*` 조립 자체가 아니라 manager 의 순수 forwarding 만 검증한다는 점에서 실제 커버리지와 코멘트 사이에 약간의 괴리가 있다. 다만 해당 조립 로직은 이미 `ai-turn-executor.spec.ts:445`(메인 chat 의 동일 패턴 `state.workflowId`/`state.nodeExecutionId` → `llmContext`)로 검증된 것과 완전히 동형인 3줄 property read 라 실패 가능성 자체는 낮다.
  - 제안: 이전 라운드 제안대로 기존 `multi_turn: first turn over budget...` 테스트(`ai-agent.memory.spec.ts:213`)의 turn1 요약 콜 직후에 `expect(mockLlmService.chat.mock.calls[0][2]).toMatchObject({ workflowId: expect.any(String), nodeExecutionId: expect.any(String) })` 한 줄만 추가하면 저비용으로 실제 `state.*` 조립 경로까지 닫힌다. 저위험이므로 본 PR 을 막을 사유는 아니나, PR-3(선택적 후속) 트랙에 명시적으로 이관 기록을 권장.

- **[INFO]** 기능 완전성 — 나머지 범위(단발 경로 교정, 하위호환, 타입 하드닝)는 결함 없음
  - 위치: `ai-turn-executor.ts:1149-1167`(single-turn `context.workflowId`/`context.nodeExecutionId` 전달, `ExecutionContext.workflowId` 는 필수 string · `nodeExecutionId` 는 엔진이 dispatch 직전 항상 주입 — `node-handler.interface.ts:32-51`), `ai-memory-manager.ts:117-124,652-661,929-934`(`llmContext?: LlmCallContext` 명시 파라미터로 `config` 파생 방식을 대체 — 이전 라운드가 발견한 Critical#1(단발 노드 config 에 workflowId/nodeExecutionId 키 자체가 없어 항상 NULL) 이 구조적으로 재발 불가), `agent-memory-injection.ts:2484-2494`(`llmService.chat(config, params, llmContext)` — `LlmService.chat` 시그니처 `(config, params, context?, opts?)` 와 위치 일치, `llm.service.ts:152-157` 확인), `ai-turn-executor.ts:2614`(`const llmContext: LlmCallContext = {...}` 명시 타입 주석 — excess-property check 컴파일 타임 활성화, 런타임 동작 불변)
  - 상세: `buildSummaryBufferUpdate` 의 `llmContext` 는 optional 이라 미전달 시 `chat(..., undefined)` 로 호출되고, 이는 `agent-memory-injection.spec.ts:1761-1762`("llmContext 미전달(하위호환) 시 chat 3번째 인자는 undefined") 로 회귀 고정됐다 — 하위호환 계약이 명시적으로 검증됨. `manual` 전략(`injectMemoryContext` 자체를 거치지 않음)·서비스 미주입 graceful degrade 등 기존 불변식은 이번 diff 로 변경되지 않았다. CHANGELOG(`CHANGELOG.md:36-40`)·plan(`plan/in-progress/ai-usage-attribution-hardening.md`) 서술이 실제 구현(single-turn=`context.*`, multi-turn resume=`state.*`)과 line-level 로 일치한다. TODO/FIXME/HACK/XXX 신규 도입 없음(`git diff` grep 확인).

## 요약

이번 PR 의 고유 의도 — AI Agent 자동 메모리(summary_buffer/persistent) 롤링 요약 압축 chat 이 `llm_usage_log` 의 `workflow_id`/`execution_id`/`node_execution_id` 를 채우도록 배선 — 는 9개 파일 범위에서 정확히 구현됐다. 이전 라운드가 발견한 Critical#1(single-turn 이 `config` 에서 파생해 항상 NULL 이던 실기능 버그)은 명시 파라미터 전달 방식으로 구조적으로 재발 불가능하게 교정됐고 회귀 테스트로 고정됐으며, 하위호환(llmContext 미전달 시 undefined)도 테스트로 고정됐다. base 는 origin/main 과 완전히 동기화되어 있어(merge-base = origin/main HEAD) 이전 라운드가 지적한 stale-base CRITICAL(무관 파일 revert 위험)은 이번 라운드 payload 에서 재현되지 않는다. 다만 (a) spec 본문(`7-llm-usage.md` §1.3)은 이 개선을 아직 반영하지 못해 SPEC-DRIFT 상태이나 plan 이 PR-2 로 이관 경로를 명확히 추적하고 있고, (b) multi-turn resume 경로의 `state.*` → `llmContext` 조립 로직 자체를 exercise 하는 end-to-end 단언이 여전히 없어(신규 유닛 테스트는 manager 의 forwarding 만 검증) 이전 WARNING#2 가 부분적으로만 해소됐다 — 둘 다 저위험·이미 문서화된 잔여 항목으로, 본 PR 을 차단할 사유는 아니다.

## 위험도

LOW
