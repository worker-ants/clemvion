# Cross-Spec 일관성 검토 — `spec/data-flow/7-llm-usage.md` (impl-done)

## 발견사항

- **[WARNING]** target 문서 자신이 "단일 진실"로 선언한 attribution 현황 서술이 동일 PR 의 구현으로 이미 stale — 롤링 요약 압축 chat 의 잔여 NULL 갭이 닫혔는데 문서엔 미반영
  - target 위치:
    - `spec/data-flow/7-llm-usage.md` §1.3 caller 카탈로그 표, "AI Agent 자동 메모리 롤링 요약 압축" 행 (L107): `context` 미전달 → `workflow_id / execution_id / node_execution_id` 전부 NULL (노드 내부 실행이나 아직 미배선 — 잔여 갭)`
    - 동 §1.3 attribution 현황 요약 문단 (L113): "**잔여 NULL** 은 워크플로우 밖·non-node caller(...)와 **노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축**뿐이다" — 이 문단은 스스로 "단일 진실"이라 명시
    - §4 외부 의존, Agent Memory 행 (L162): "추출 processor chat + 롤링 요약 압축 chat (usage 적재, **context NULL**)"
    - §Rationale "`llm_usage_log` 의 nullable context 컬럼들" (L204–208): "**잔여 NULL** 은 (a) ... 와 (b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading, **AI Agent 자동 메모리 롤링 요약 압축**)뿐이다 — ... (b)는 **후속 배선 여지**"
  - 충돌 대상: 같은 target 문서 안의 서로 다른 절(§1.3 caller 카탈로그 / §4 외부 의존 / §Rationale)이 서로 다른 시점의 사실을 뒤섞어 놓은 상태이며, 이 절을 SoT 로 직접 인용하는 `spec/5-system/4-execution-engine.md:712`("AI·멀티턴 핸들러... `LlmCallContext` 로 `llm_usage_log.node_execution_id` 에 기록... [data-flow/7-llm-usage §1.3]") 도 간접적으로 stale 참조를 갖게 됨
  - 상세: 금번 diff(`ai-memory-manager.ts`, `ai-turn-executor.ts`, `agent-memory-injection.ts` — 모두 코드 주석에 `[Spec 7-llm-usage §1.3]` 를 명시적으로 인용)는 정확히 이 문서가 "잔여 갭"/"후속 배선 여지"로 지목한 항목(AI Agent 자동 메모리 롤링 요약 압축 chat 의 attribution)을 닫는다:
    - `ai-memory-manager.ts` `buildSummaryContext`/`callSummaryLlm` 인자에 `workflowId?` / `nodeExecutionId?` 를 추가하고 `llmContext: { workflowId, executionId, nodeExecutionId }` 를 `buildSummaryBufferUpdate` 로 전달 (L81-108 diff).
    - `ai-turn-executor.ts` 는 첫 턴/단발 경로에서 `context.workflowId` / `context.nodeExecutionId` 를, resume 경로에서 엔진 `buildRetryReentryState` 가 주입한 `state.workflowId` / `state.nodeExecutionId` 를 각각 전달 — 기존에 문서(§Rationale)가 이미 기술한 "첫 턴은 `context.*`, resume 턴은 재구성 `state.*`" 패턴을 메인 chat 뿐 아니라 요약 압축 chat 에도 대칭 적용한 것으로 확인됨(`git -C <worktree> show HEAD:codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 에서 `state.workflowId` / `state.nodeExecutionId` 가 실제로 필드로 존재함을 확인).
    - `agent-memory-injection.ts` `BuildSummaryBufferArgs.llmContext?: LlmCallContext` 를 추가하고 `llmService.chat(...)` 세 번째 인자로 전달, 테스트(`agent-memory-injection.spec.ts`)로 회귀 고정.
    이제 이 caller 의 usage_log 컨텍스트는 더 이상 "전부 NULL"이 아니며, "잔여 NULL(미배선)" 리스트에서도 빠져야 한다. 문서가 스스로를 "단일 진실"이라 선언한 상태로 방치되면, 이후 이 문서를 근거로 (a) 같은 갭을 다시 "미해결"로 오인해 중복 작업을 벌이거나 (b) Statistics/Alerts 의 `workflow_id`/`llm_cost` 집계 완결성 서술(§4 downstream 행)을 실제보다 과소평가하는 방향으로 오독할 위험이 있다.
  - 제안: 본 PR(또는 후속 spec-only PR)에서 `spec/data-flow/7-llm-usage.md` 를 함께 갱신 — (1) §1.3 표의 "AI Agent 자동 메모리 롤링 요약 압축" 행 서술을 "채움(context.\*/state.\* — 2026-07 확장)"으로 교정, (2) §1.3 요약 문단·§4 Agent Memory 행에서 이 caller 를 잔여 NULL 목록에서 제거(추출 processor chat 만 남김), (3) §Rationale (b) 목록에서 제거하고 "완료" 서술에 새 항목으로 편입(날짜·PR 근거 포함). 세 곳 모두 같은 사실을 서로 다른 절에서 반복 서술하는 구조라 누락 없이 함께 고쳐야 한다.

## 요약

금번 diff 는 신규 엔드포인트·데이터 모델 컬럼·요구사항 ID·상태 머신·RBAC 변경이 없는 순수 내부 attribution 배선 확장(AI Agent 자동 메모리 롤링 요약 압축 chat 에 기존 `LlmCallContext` 패턴을 대칭 적용)이며, 계층 책임 분할(handler → memory manager → shared helper → `LlmService.chat`)도 문서가 이미 기술한 첫 턴/resume 이원 패턴을 그대로 따라 기존 결정과 일치한다. `LlmService.chat(config, params, context?, opts?)` 시그니처, `resume-state.schema.ts` 의 `workflowId`/`nodeExecutionId` 필드 등 코드 근거도 문서 서술과 부합함을 확인했다. 유일한 실질 발견은 target 문서 자신이 "잔여 갭"/"후속 배선 여지"로 명시했던 바로 그 항목을 이번 PR 이 구현으로 닫았는데, 문서(§1.3/§4/§Rationale 세 곳)는 갱신되지 않아 스스로 모순된 "단일 진실"을 주장하는 상태로 남아 있다는 점이다. 기능적 파손은 없으나 spec 을 SoT 로 삼는 프로젝트 규약상 후속 조치가 필요하다.

## 위험도
MEDIUM
