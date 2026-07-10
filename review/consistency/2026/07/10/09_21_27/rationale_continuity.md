# Rationale 연속성 검토 — spec/data-flow/7-llm-usage.md (--impl-done)

## 검토 범위

- target: `spec/data-flow/7-llm-usage.md` (diff-base `origin/main`, 해당 PR 에서 이 spec 파일 자체는 변경되지 않음 — `git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` 결과 없음)
- 구현 diff: `ai-agent.memory.spec.ts` / `ai-memory-manager.ts` / `ai-turn-executor.ts` / `agent-memory-injection.ts` / `agent-memory-injection.spec.ts` — AI Agent 자동 메모리 롤링 요약 압축 chat 에 `llmContext`(workflowId/executionId/nodeExecutionId) 전달 배선 추가
- 대조 대상: target 문서 `## Rationale` §"`llm_usage_log` 의 nullable context 컬럼들 — 의도 vs 실제 채움 현황", §1.3 caller 카탈로그 표

## 발견사항

- **[WARNING]** 구현이 Rationale 이 명시한 "후속 배선 여지" 항목을 완결했는데 target 문서(§1.3 표 · Rationale)가 갱신되지 않아 현재 코드 상태와 어긋남
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 caller 카탈로그 표의 "AI Agent 자동 메모리 롤링 요약 압축 (`nodes/ai/shared/agent-memory-injection.ts`)" 행 (107행), 및 `## Rationale` → "`llm_usage_log` 의 nullable context 컬럼들" 항의 "잔여 NULL은 ... (b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading, AI Agent 자동 메모리 롤링 요약 압축)" 서술(204~206행), 그리고 §1.3 하단 "attribution 채움 현황" 요약문(113행)
  - 과거 결정 출처: 같은 문서 `## Rationale` § "`llm_usage_log` 의 nullable context 컬럼들" 항 — "**결정: 코드 수정 채택 (완료).**" 문단이 "AI 노드 호출은 세 ID 를 모두 채운다"를 실현하는 방식으로 **핸들러가 `ExecutionContext`/재구성 `state` 의 ID 를 `LlmCallContext` 로 전달하도록 고치는 코드 수정**을 채택했고, "(b)는 후속 배선 여지"로 AI Agent 자동 메모리 롤링 요약 압축을 명시적으로 미완료 항목으로 남겨 두었다. 문서는 PR #519(첫 턴/단발) → 2026-07(멀티턴 resume 턴) 식으로 완료 시점을 점진적으로 기록해 온 패턴을 이미 갖고 있다.
  - 상세: 이번 구현(diff)은 정확히 그 Rationale 이 예고한 "후속 배선"을 실행한다 — `ai-memory-manager.ts` 의 `compressSummary` 인자에 `workflowId`/`nodeExecutionId` 를 추가하고 `agent-memory-injection.ts` 의 `buildSummaryBufferUpdate` 가 `llmContext` 를 `llmService.chat` 세 번째 인자로 전달한다. `ai-turn-executor.ts` 는 single-turn 은 `context.workflowId`/`context.nodeExecutionId`, multi-turn resume 은 재구성 `state.workflowId`/`state.nodeExecutionId` 를 공급한다 — 이는 Rationale 이 이미 확립한 "첫 턴은 context.*, resume 턴은 재구성 state.*" 원칙과 정확히 대칭이며, "config 에서 파생하지 않는다"(단일 turn 의 config 는 사용자 노드 config 라 이 키가 없음)는 코드 주석도 동일 Rationale 의 "spec 차원 집계 의미 재정의가 아니라 코드 수정으로 실현" 원칙을 위반하지 않는다. 즉 **원칙·설계 방향은 완전히 준수**했다. 문제는 target 문서 자체가 이 완료를 반영하지 않아, §1.3 표는 여전히 "context 미전달 → 전부 NULL (아직 미배선 — 잔여 갭)"이라고 서술하고, Rationale 은 이 caller 를 여전히 "(b) 아직 배선되지 않은 caller" 목록에 포함시키고 있다는 점이다. 이 상태로 두면 (a) 향후 다른 checker/독자가 "spec 이 선언한 갭이 실제로는 해소됐다"는 사실을 놓치고, (b) 반대로 향후 리뷰가 "코드가 spec 미기재 동작을 도입했다"고 오판할 여지가 생긴다.
  - 제안: `## Rationale` § "`llm_usage_log` 의 nullable context 컬럼들"에 기존 패턴("진행: PR #519(첫 턴/단발 경로) → 2026-07(멀티턴 resume 턴)")을 이어 "→ 2026-07(AI Agent 자동 메모리 롤링 요약 압축 chat, 본 PR)" 식 완료 로그를 추가하고, "잔여 NULL" 목록에서 해당 caller 를 (b) 목록에서 제거(또는 "(b) 배선 완료" 로 재분류). §1.3 표의 해당 행도 다른 완료 caller 행과 동일한 문구("**채움**. ...")로 갱신. §1.3 하단 "attribution 채움 현황" 요약문의 "잔여 NULL 은 워크플로우 밖·non-node caller ... 와 노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐" 부분에서 후자를 제외하도록 수정. 이 갱신은 `developer` 스킬의 구현 phase 에 spec 갱신을 포함하는 관례(§0 CLAUDE.md 정보 저장 위치 원칙)와도 일치한다.

## 요약

이번 구현(AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선)은 target 문서 `spec/data-flow/7-llm-usage.md` 의 `## Rationale` 이 이미 확정해 둔 설계 원칙("코드 수정으로 ExecutionContext/재구성 state 의 ID 를 LlmCallContext 로 전달", "config 에서 attribution 을 파생하지 않는다", "단발은 context.*, resume 은 state.*") 을 정확히 계승하며, 과거에 기각된 대안을 재도입하거나 합의 원칙을 우회하는 지점은 발견되지 않았다. 유일한 이슈는 이 구현이 바로 그 Rationale 이 "후속 배선 여지"로 예고했던 항목을 완결했음에도 target 문서(§1.3 표·Rationale "잔여 NULL" 서술)가 그 완료를 반영하도록 갱신되지 않아, 문서가 현재 코드 상태보다 뒤처진 상태로 남아 있다는 점이다 — 결정 자체의 번복이 아니라 완료 사실의 미기록이므로 WARNING 으로 분류한다.

## 위험도
LOW
