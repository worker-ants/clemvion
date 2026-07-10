# Plan 정합성 검토 — `spec/data-flow/7-llm-usage.md` (--impl-done)

## 발견사항

- **[WARNING]** C1(AI Agent 메모리 압축 attribution 배선)이 만든 target 문서 stale 서술의 후속 항목이, 지정된 후속 plan 의 실제 체크리스트에는 없음
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 L107(`AI Agent 자동 메모리 롤링 요약 압축` row — "context 미전달 → NULL... 잔여 갭"), L113 콜아웃("... AI Agent 메모리 롤링 요약 압축뿐"), §4 표 L162("Agent Memory ... 롤링 요약 압축 chat (usage 적재, context NULL)"), §Rationale L204-208("(b) `LlmCallContext` 가 아직 배선되지 않은 caller(... AI Agent 자동 메모리 롤링 요약 압축)")
  - 관련 plan:
    - `plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT ("PR-2 로 이관 — cross-ref")
    - `plan/in-progress/resume-llm-usage-attribution.md` §"잔여 follow-up" (61~70행, A1~A4)
  - 상세: 이번 diff 의 C1(`ai-memory-manager.ts`/`agent-memory-injection.ts`/`ai-turn-executor.ts`)이 롤링 요약 압축 chat 에 `llmContext`(workflowId/executionId/nodeExecutionId, single-turn 은 `context.*`, multi-turn resume 은 `state.*`)를 실제로 배선했다 — 코드 근거는 diff 자체(`agent-memory-injection.ts` `llmService.chat(llmConfig, params, llmContext)` 3번째 인자 추가 + `ai-memory-manager.ts` `llmContext: { workflowId, executionId, nodeExecutionId }` 구성 + `ai-turn-executor.ts` 두 caller(single-turn/resume)가 각각 `context.*`/`state.*` 전달)로 확인됨. 그런데 target 문서 위 4곳은 여전히 "이 caller 만 미배선/NULL 잔여" 로 서술돼 이제 stale 하다.

    `ai-usage-attribution-hardening.md` 자신은 이 staleness 를 §SPEC-DRIFT 에서 이미 인지하고 "PR-2(A-track project-planner spec PR)에서 A1~A4(선행 plan `resume-llm-usage-attribution.md` §"잔여 follow-up" 61~70행)와 **함께** §1.3 row 를 반영" 한다고 명시한다. 그러나 실제로 `resume-llm-usage-attribution.md` §"잔여 follow-up"(61~70행)의 A1~A4 항목을 확인하면 (1) `6-knowledge-base.md`/`13-agent-memory.md` stale 문구, (2) `7-statistics.md`/`9-user-profile.md` attribution 갭 caveat, (3) `1-data-model.md` `LlmUsageLog` 서브섹션 신설, (4) `4-execution-engine.md`/`1-ai-agent.md` §7.4 credential/context-binding 문구 — 4건 모두 **C1 이 새로 만든 §1.3 L107/L113/§4/Rationale 의 메모리압축 row 정정과 무관**하다. 즉 "A1~A4 와 함께 반영" 이라는 서술은 실제로는 A1~A4 목록에 없는 **다섯 번째 항목을 암묵적으로 추가**하는 것인데, 그 추가가 `resume-llm-usage-attribution.md` 자체에는 체크박스로 반영돼 있지 않다.
  - 제안: `resume-llm-usage-attribution.md` §"잔여 follow-up" 에 A5 항목으로 "`spec/data-flow/7-llm-usage.md` §1.3 L107 row·L113 콜아웃·§4 표·Rationale 의 AI Agent 메모리 롤링 요약 압축 attribution 정정(C1, PR-1 완료분 반영)" 을 명시적으로 추가하거나, `ai-usage-attribution-hardening.md` 자체에 "PR-2 owner 인계 전 destination plan 에 항목 추가 완료" 체크박스를 넣어야 한다. 두 plan 모두 남은 워크플로 항목이 `[ ] PR` 뿐이라 곧 `plan/complete/` 로 이동할 수 있는데, 이동 시점에 prose cross-ref 만 있고 목적지 plan 의 실제 체크리스트에는 없는 이 항목이 유실될 위험이 있다 (project-planner 가 PR-2 착수 시 `resume-llm-usage-attribution.md` §"잔여 follow-up" 목록만 보고 작업 범위를 정할 가능성이 높음).

## 요약

이번 PR(`ai-usage-attribution-hardening.md`, B1+C1)의 C1 변경(메모리 압축 chat `llmContext` 배선)은 diff 로 확인되는 실제 구현이며, target 문서 `spec/data-flow/7-llm-usage.md` 는 그 결과 stale 해졌다는 사실을 plan 자신이 이미 인지·명시하고 있어 "미해결 결정 우회"나 "선행 plan 미해소" 수준의 문제는 없다. 다만 이 stale 화의 정정 의무를 "PR-2 에서 A1~A4 와 함께" 처리한다고 서술하면서, 실제 A1~A4(지정된 후속 plan `resume-llm-usage-attribution.md` §"잔여 follow-up")에는 해당 항목이 없어 **후속 항목 추적이 한 단계 느슨**하다. 두 plan 모두 `PR` 체크박스만 남아 곧 완료·아카이브될 수 있는 시점이라, 지금 destination 목록에 항목을 명시적으로 추가해두지 않으면 PR-2 범위에서 누락될 실질적 위험이 있다.

## 위험도

MEDIUM
