# Plan 정합성 검토 — spec/4-nodes/3-ai/ (--impl-done)

> 검토 대상: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md` (diff-base `origin/main`)
> 대조 plan: `plan/in-progress/ai-agent-tool-payload-budget-followups.md`(항목 A, 본 diff 의 근원 plan) · `ai-agent-tool-payload-budget-guardrail.md`(선행, 머지됨) · `ai-agent-tool-connection-rewrite.md`(별개 미해결 plan) · `cafe24-backlog-residual.md`(간접 배경)

## 조사 방법

1. `git diff origin/main --stat -- spec/ plan/` 로 실제 변경 범위 확인 → `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/cross-node-warning-rules.md`, `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 3파일만 변경. 변경 내용은 두 spec 문서에서 "⚠ 구현 현황(Planned)" 마커 제거 + `pending_plans` 정리 + `status: partial→implemented` + `code:` 리스트에 `tool-payload-save-warning.ts` 추가.
2. `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 의 실행 체크리스트(항목 A)와 diff 내용을 1:1 대조.
3. 코드 SoT 워킹트리에서 claim 된 구현물 실재 확인: `tool-payload-save-warning.ts`, `WorkflowsController.getGraphWarnings`(`:id/graph-warnings`), `GRAPH_WARNING_KO['ai_agent:tool-payload-budget']`, `backend-labels.test.ts` 의 `BACKEND_ONLY_GRAPH_WARNING_RULE_IDS` 등록 — 모두 실재 확인.
4. `plan/in-progress/ai-agent-tool-connection-rewrite.md`(별도 미해결 plan, `tool_*` 일반 도구 재설계) 와 diff 충돌 여부 확인 — 이 diff 는 해당 영역을 건드리지 않음.
5. `plan/in-progress/node-output-redesign/ai-agent.md` 의 미해결 CRITICAL("single-turn `llmService.chat` 미try/catch → `port:'error'` 미도달")과, target §4.2/§10 의 신규 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` single-turn try/catch 범위가 겹치는지 코드로 직접 확인(`buildSingleTurnToolsOrError`, `ai-turn-executor.ts:1471-1522`) — `buildTools` pre-flight 만 감싸고 `llmService.chat` 호출(§7.3 일반 LLM 에러 라우팅 CRITICAL 대상)은 여전히 try/catch 밖에 있음을 확인.

## 발견사항

- **[INFO]** `tool-payload-save-warning.ts` 가 `ai-agent.md` frontmatter `code:` 목록에 없음
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` (라인 4-17)
  - 관련 plan: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 실행 체크리스트 5-6번(`tool-payload-save-warning.ts` 신설)
  - 상세: 이번 diff 로 `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` 가 신설되어 `cross-node-warning-rules.md` 의 `code:` 목록에는 추가됐으나, 같은 파일이 구현하는 §10 "config 경고 계약"(D3, `ai_agent:tool-payload-budget`)의 1차 SoT 문서인 `ai-agent.md` 자신의 `code:` 목록에는 빠져 있다. plan-coherence 3대 관점(미해결 결정 충돌·선행 plan 미해소·후속 항목 누락) 중 어디에도 정확히 들어맞지는 않는 경미한 spec-impl-evidence 누락이라 INFO 로 분류.
  - 제안: `ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` 한 줄 추가 (후속 PR 또는 본 PR 마무리 커밋에서 손쉽게 처리 가능).

## 정합성 확인 (문제 없음으로 판정한 항목)

- **cross-node-warning-rules.md `status: partial → implemented`**: 문서 전체에 다른 "Planned/미구현" 마커가 남아있지 않음을 확인 — 승격이 정당함.
- **ai-agent.md `pending_plans`에서 `ai-agent-tool-payload-budget-followups.md` 제거**: 항목 A(config-time 저장 경고)가 실제로 구현·확인됐으므로 정당. 항목 B(resume 턴 timeoutMs+signal)는 spec 본문 어디에도 언급되지 않아(grep 무결과) 미해결 상태가 정확히 반영됨 — "이미 완료된 것처럼 스펙에 선반영"하는 성급한 클로징이 없음.
- **`ai-agent-tool-connection-rewrite.md`(별도 in-progress, TBD 결정 다수)**: 이번 diff 가 건드리는 영역과 완전히 분리(§4.2 도구 정의 payload 예산 vs §Tool Area 도구 연결 모델) — 충돌 없음. `ai-agent.md`의 유일한 잔존 `pending_plans` 항목으로 정확히 유지됨.
- **`node-output-redesign/ai-agent.md` 의 single-turn error-routing CRITICAL**: target 의 신규 §4.2/§10 JSDoc·spec 문구("이 return-vs-throw 계약은 ... 통일은 후속 plan 범위")가 "이 CRITICAL 이 해소됐다"고 오인시키지 않도록 스코프를 명확히 좁혀 서술(`TOOL_DEFINITION_PAYLOAD_EXCEEDED` 1개 에러코드만 명시 라우팅, 일반 `llmService.chat` 에러는 여전히 미해결)함을 코드로 재확인. 선행 plan 을 우회·무효화하지 않음.
- **`cafe24-backlog-residual.md`(G-1-remaining, 도구 필드셋 전량 확장·완료)**: guardrail plan 배경에 이미 근본 원인으로 정확히 인용돼 있고, 이번 diff 로 인한 새로운 상호작용 없음(해당 항목은 이미 완료 상태).

## 요약

이번 diff 는 `ai-agent-tool-payload-budget-followups.md` 항목 A(config-time 저장 경고)의 구현 완료를 spec 에 반영하는 좁은 범위의 변경으로, 실제 코드(`tool-payload-save-warning.ts`/`getGraphWarnings`/`GRAPH_WARNING_KO`/backend-labels 테스트)가 모두 실재해 spec 의 "Planned" 제거·`status: implemented` 승격·`pending_plans` 정리가 정확히 근거를 갖는다. 다른 in-progress plan(`ai-agent-tool-connection-rewrite.md`, `node-output-redesign/ai-agent.md`)의 미해결 결정·CRITICAL 을 우회하거나 무효화하지 않으며, 남은 후속 항목(item B: resume timeoutMs+signal)도 spec 에 성급히 반영되지 않고 정확히 미착수로 남아있다. 유일한 흠은 신설 파일이 `cross-node-warning-rules.md` 의 `code:` 목록에는 반영됐으나 `ai-agent.md` 자신의 `code:` 목록에는 빠진 경미한 spec-impl-evidence 누락(INFO)뿐이다.

## 위험도

LOW
STATUS=success FILE_WRITTEN=/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/review/consistency/2026/07/16/09_13_49/plan_coherence.md CRITICAL=0
