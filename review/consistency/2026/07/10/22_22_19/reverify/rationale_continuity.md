# Rationale 연속성 재검증 결과 (§1.3 Rationale 정정)

대상: `spec/data-flow/7-llm-usage.md` (--impl-done 재검증, diff-base=`origin/main`)

## 조사 방법 메모

- `git -C <worktree> show HEAD:spec/data-flow/7-llm-usage.md` 전문 재확인 (Rationale "`llm_usage_log`
  의 nullable context 컬럼들" 항 포함)
- `git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` — 이번 회차에 추가된 spec 정정 diff
  4곳 정밀 대조
- `git diff origin/main...HEAD -- codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts
  codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts
  codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` — 정정된 서술(단발 `context.*`/resume
  `state.*`)이 실제 코드와 부합하는지 교차 확인
- `plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT, `plan/in-progress/resume-llm-usage-attribution.md`
  갱신분 — 이번 정정이 어떤 처분 경로(최종 consistency CRITICAL → 같은 PR 포함)로 도출됐는지 확인
- `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/1-ai-agent.md §12.12` — 인접 spec Rationale 과의
  충돌 여부 재확인 (신규 충돌 없음)
- `review/consistency/2026/07/10/22_22_19/SUMMARY.md` — 직전 회차 CRITICAL(SoT 붕괴) 판정 및 처분 지시 확인

## 발견사항

- **[INFO]** 정정은 기존 결정과 완전히 연속적 — 새 위반 없음, 직전 WARNING 완전 해소
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 L107행, §1.3 콜아웃(잔여 NULL 문단), §4 Agent
    Memory 행(L162 부근), `## Rationale` → "`llm_usage_log` 의 nullable context 컬럼들" 항
  - 과거 결정 출처: 동일 문서 `## Rationale` — "**결정: 코드 수정 채택 (완료).**" ("핸들러가
    `ExecutionContext` 의 ID 를 `LlmCallContext` 로 전달하도록 고치는 코드 수정") + "(b) `LlmCallContext`
    가 아직 배선되지 않은 caller ... 는 후속 배선 여지"
  - 상세: 이번 diff 는 4개 위치를 정확히 아래처럼 정정했다.
    1. §1.3 표: "AI Agent 자동 메모리 롤링 요약 압축" 행이 "context 미전달 → 전부 NULL (... 잔여 갭)"에서
       "**채움**. 단발/첫 턴은 `context.*`, resume 턴은 재구성 `state.*` (AI Agent 메인 chat 과 동일
       패턴)"로 바뀜.
    2. §1.3 콜아웃: "잔여 NULL" 목록에서 "노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축"을
       제거하고, 채움 서술을 별도 문장으로 추가.
    3. §4 Agent Memory 행: "추출 processor chat + 롤링 요약 압축 chat (usage 적재, context NULL)"을
       "추출 processor chat(워크플로우 밖 — context NULL) + 롤링 요약 압축 chat(노드 발 — context 채움)"
       으로 분리.
    4. Rationale "(b)" 항: "잔여 NULL은 ... `RerankService` listwise grading, AI Agent 자동 메모리
       롤링 요약 압축뿐" → "... `RerankService` listwise grading뿐"으로 좁히고, 직전 문장에 "추가로
       AI Agent 자동 메모리 롤링 요약 압축 chat(`agent-memory-injection.ts` `buildSummaryBufferUpdate`)도
       2026-07 에 배선돼 단발/첫 턴은 `context.*`, resume 턴은 재구성 `state.*` 로 세 ID 를 채운다"는
       **새 근거 문장을 명시적으로 추가**했다.
    이는 (1) 과거 Rationale 이 기각한 대안을 재도입하는 것이 아니라 "핸들러가 `LlmCallContext` 를
    전달하도록 고치는 코드 수정"이라는 이미 채택된 원칙을 노드 발 helper(`agent-memory-injection.ts`)로
    **일관되게 확장**한 것이고, (2) 과거 결정을 뒤집으면서 새 Rationale 없이 방치한 것이 아니라 위처럼
    **정정과 동시에 근거 문장(배선 시점·배선 방식·caller)을 함께 기록**했으며, (3) `## Rationale` 이
    기록한 시스템 invariant(§1.2 "`workflowId/executionId/nodeExecutionId` 는 호출부가 `LlmCallContext`
    로 명시할 때만 채워진다")도 그대로 유지된다 — 우회가 아니라 그 invariant 를 만족시키는 새 caller 가
    하나 늘었을 뿐이다. 코드 diff(`ai-turn-executor.ts` L1159~/L2287~, `ai-memory-manager.ts`,
    `agent-memory-injection.ts`)를 직접 대조한 결과 "단발/첫 턴 = `context.*`, resume = 재구성
    `state.*`" 서술은 실제 구현과 정확히 일치한다(single-turn 은 `context.workflowId/executionId/
    nodeExecutionId`, resume 은 `state.workflowId/nodeExecutionId` + `executionId` 조립).
    그룹 (a)(`GraphExtractionService`·AgentMemory 추출 processor, 워크플로우 밖이라 애초에 컨텍스트
    없음)와 그룹 (b)(`RerankService` listwise, 아직 미배선)의 이분 구조 자체는 변경되지 않고
    유지되어, Rationale 의 분류 원칙과도 충돌하지 않는다.
  - 제안: 없음(정합 확인용 기록). 굳이 다듬자면, Rationale 본문의 "진행: PR #519(...) → 2026-07(...)"
    타임라인 목록과, 별도 문장으로 덧붙은 "추가로 ... 도 2026-07 에 배선돼 ..."가 같은 "2026-07"
    구간을 두 번 언급해 약간 나열형으로 읽힌다 — 다음 갱신 시 "진행:" 목록 안에 세 번째 항목으로
    통합하면 가독성이 좋아지나, 이는 순수 스타일 이슈이며 연속성 위반은 아니다.

- **[INFO]** 직전 회차 WARNING("target 미갱신")이 이번 회차에 완전히 해소됨을 확인
  - target 위치: 위와 동일 4개 위치
  - 과거 결정 출처: `review/consistency/2026/07/10/22_22_19/rationale_continuity.md` (직전 회차)
    WARNING — "구현이 target 문서 자신의 Rationale '잔여 NULL (b)' 항목을 완결시켰지만 target 문서는
    이 diff에서 갱신되지 않음"
  - 상세: 직전 회차는 이 drift 를 "무근거 번복"이 아닌 "추적되는 임시 drift"로 완화 평가하며 (1) 같은
    PR 에 4개 위치를 함께 갱신하거나 (2) 후속 PR-2 즉시 병합을 권고했다. 이번 회차는 직전 회차 이후
    `/consistency-check --impl-done` 원 회차가 convention_compliance 를 CRITICAL(SoT 붕괴, BLOCK:YES)
    로 승격시켰고, 그 처분으로 정확히 위 4개 위치가 같은 PR 에 반영됐다 — 권고안 (1)이 채택된 것과
    동일한 결과다.
  - 제안: 없음.

## 요약

`spec/data-flow/7-llm-usage.md` 의 이번 정정(Rationale "(b)" 항 + §1.3 표/콜아웃 + §4 표)은 문서
자신의 `## Rationale`이 이미 채택한 결정("핸들러가 `LlmCallContext` 를 전달하도록 고치는 코드 수정")의
연장선상에 있는 factual 업데이트로, 과거에 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다.
"(b) 후속 배선 여지" 그룹에서 AI Agent 메모리 압축 항목을 제거하면서 그 배선 시점·방식·caller 를 밝힌
새 근거 문장을 함께 추가했고, 코드 diff 대조 결과 서술(단발 `context.*`/resume `state.*`)도 실제
구현과 정확히 일치한다. §1.2 의 attribution invariant("caller 가 `LlmCallContext` 를 명시할 때만
채움")도 그대로 유지되며, 그룹 (a)/(b) 이분 구조와 인접 spec(`agent-memory.md`, `1-ai-agent.md §12.12`)
의 Rationale 과도 충돌이 없다. 직전 회차(22_22_19 최초)가 지적한 WARNING("구현 완결 vs target
미갱신")은 이번 diff 로 완전히 해소됐다.

## 위험도

NONE
