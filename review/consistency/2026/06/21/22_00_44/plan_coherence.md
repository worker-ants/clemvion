# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/3-ai, diff-base=origin/main)
검토 대상: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)

---

## 발견사항

### [INFO] M-1 1단계 spec DRIFT 비차단 후속 미반영
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` §M-1 — "planner 후속(비차단 SPEC-DRIFT): §6.1 step 3a 구현 참조(`ai-agent.handler.ts classifyToolCalls` → evaluator) 갱신 + `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 등재"
- 상세: M-1 1단계(AiConditionEvaluator 추출, commit `24ca3340`)가 완료됐으나, 신설된 `ai-condition-evaluator.ts` 가 `1-ai-agent.md` frontmatter `code:` 목록에 추가되지 않았다. spec §6.1 step 3a 본문 참조("ai-agent.handler.ts classifyToolCalls")도 evaluator 위임 사실을 반영하지 않고 있다. 해당 plan 항목이 "비차단" 으로 표기돼 있으므로 진행 차단은 아니지만, frontmatter `code:` 가 spec 의 공식 구현 추적 위치이므로 누락 상태가 지속될 경우 coverage 검사에서 오탐 가능.
- 제안: plan 에 명시된 planner 후속 항목 처리 — `1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 등재 + §6.1 step 3a 참조 문구 갱신(플래너 영역). target spec 수정 필요.

### [INFO] ai-context-memory-followup-v2 미체크 spec 항목이 target 에 이미 반영됨
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.memory` 표
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` 76번 미체크 항목 — "`§7.1 meta.memory` 열거에 `compactedMessages?` + node-output Principle 2 에 meta.memory(impl-done W-1)"
- 상세: 해당 plan 항목이 미체크(`[ ]`) 상태이지만 target spec 내 `meta.memory` 표에 `compactedMessages?` 가 이미 존재한다. plan 의 체크박스가 실제 반영 완료 상태를 추적하지 못하고 있다. 충돌은 아니며 spec 내용은 정합하다.
- 제안: `ai-context-memory-followup-v2.md` 76번 항목을 체크(`[x]`)로 갱신하여 plan 상태를 실제에 맞게 동기화. plan 갱신 필요.

### [INFO] ai-context-memory-followup-v2 미체크 백로그 중 spec 외 위치 항목
- target 위치: 해당 없음 (target spec 범위 외)
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` 미체크 항목 — `_product-overview` ND-AG-30 에 `meta.memory.compactedMessages` 등재(67번), `injectMemoryContext` 이중 쿼리 단일화(64번), `ConversationThreadService.updateSummaryState()` 신설(65번), `_resumeState.lastExtractionTurnSeq` → `memoryState` 네임스페이스 이전(계속), AgentMemoryAdminService 분리 등
- 상세: 위 미체크 항목들은 `spec/5-system/`, `codebase/` 등 target(`spec/4-nodes/3-ai`) 외 영역이며, target spec 내용과 직접 충돌하지 않는다. 단 이 항목들이 향후 구현될 때 target spec 의 `meta.memory` 필드 서술이 최신 SoT 역할을 해야 하므로 plan 추적 연속성은 유지 필요.
- 제안: 별도 조치 불요. 추적 메모.

---

## 요약

Plan 정합성 관점에서 `spec/4-nodes/3-ai` 대상 검토 결과, CRITICAL 또는 WARNING 등급 발견사항은 없다. 가장 주목할 사항은 M-1 1단계(AiConditionEvaluator 추출) 완료 후 `plan/in-progress/refactor/02-architecture.md` 에 명시된 "비차단 SPEC-DRIFT" planner 후속 — `ai-condition-evaluator.ts` frontmatter 등재 및 §6.1 step 3a 참조 갱신 — 이 target spec 에 반영되지 않은 점이다. 이는 plan 이 이미 "비차단" 으로 분류한 항목이며 M-1 2단계(현재 worktree 작업 대상인 AiMemoryManager 추출) 진행의 전제 조건이 아니다. `ai-agent-tool-connection-rewrite.md` 의 5개 미해결 설계 결정(TBD)에 대해 target spec 은 해당 섹션을 적절히 "재작성 예정" 박스로 표시하고 일방적 결정을 내리고 있지 않다. `exec-park-durable-resume.md` 의 umbrella 잔여(PR3 rehydration 일반화)는 target spec 내용과 무충돌이다.

## 위험도

LOW
