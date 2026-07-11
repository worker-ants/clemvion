# Rationale 연속성 검토 결과

대상: `spec/data-flow/7-llm-usage.md` (--impl-done, diff-base=origin/main)

## 조사 방법 메모

`_prompts/rationale_continuity.md` 에 포함된 "관련 Rationale 발췌" 는 여러 spec 의 `## Rationale` 을
폭넓게 그러모은 것이며 파일 자체 크기 제한으로 끝부분이 잘려 있었다(`... (truncated due to size
limit) ...`, 파일 814줄). 이 발췌만으로는 target 문서 자신의 최신 `## Rationale` 이 충분히
확인되지 않아, HEAD 워킹트리에서 다음을 직접 재확인했다:

- `spec/data-flow/7-llm-usage.md` 전문 (Read, 절대경로)
- `git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` (변경 없음 확인)
- `git log origin/main..HEAD` (본 브랜치 커밋 4개 + 이전 커밋 확인)
- `plan/in-progress/ai-usage-attribution-hardening.md` (본 작업의 plan)
- `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/1-ai-agent.md §12.12`, `codebase/.../llm.service.ts` 의 `LlmCallContext` 정의 (교차 확인)
- `review/code/2026/07/10/02_09_15/SUMMARY.md` (직전 ai-review, 이 프로젝트의 "tracked follow-up" 관행 확인용)

## 발견사항

- **[WARNING]** 구현이 target 문서 자신의 Rationale "잔여 NULL (b)" 항목을 완결시켰지만 target 문서는 이 diff 에서 갱신되지 않음
  - target 위치: `spec/data-flow/7-llm-usage.md` §1.3 표 L107행("AI Agent 자동 메모리 롤링 요약 압축 ... 아직 미배선 — 잔여 갭"), §1.3 요약문 L113("**잔여 NULL** 은 ... 노드 내부지만 미배선인 AI Agent 메모리 롤링 요약 압축뿐"), §4 표 L162("Agent Memory | ... 롤링 요약 압축 chat (usage 적재, context NULL)"), `## Rationale` → "`llm_usage_log` 의 nullable context 컬럼들" 항 L204-208 ("(b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise grading, AI Agent 자동 메모리 롤링 요약 압축)")
  - 과거 결정 출처: `spec/data-flow/7-llm-usage.md` 자신의 `## Rationale` — "`llm_usage_log` 의 nullable context 컬럼들 — 의도 vs 실제 채움 현황" 항. 이 항은 attribution 배선 완료 caller(AI Agent/Text Classifier/Information Extractor 노드 핸들러, PR #519 + 2026-07 resume 턴)와 미배선 caller(`(b)` 그룹 — RerankService listwise grading, **AI Agent 자동 메모리 롤링 요약 압축**)를 명시적으로 이분한다.
  - 상세: 이번 diff(`agent-memory-injection.ts` / `ai-memory-manager.ts` / `ai-turn-executor.ts`)는 `buildSummaryBufferUpdate` 의 요약 압축 chat 에 `LlmCallContext`(`llmContext`)를 single-turn(`context.*`)·multi-turn resume(`state.*`) 양쪽 경로로 전달해, 정확히 위 Rationale 의 `(b)` 그룹 중 "AI Agent 자동 메모리 롤링 요약 압축" 항목을 완결시킨다. 이는 Rationale 이 이미 방향을 정해둔 "후속 배선 여지" 를 실현하는 것이라 **원칙 위반이나 기각된 대안의 재도입은 아니다.** 문제는 이 diff 가 `spec/data-flow/7-llm-usage.md` 자체는 전혀 건드리지 않는다는 점이다 (`git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` 결과 없음). 따라서 이 diff 가 그대로 merge 되면, target 문서의 `(b)` 그룹 서술(RerankService listwise + AI Agent 메모리 압축 둘 다 미배선)과 §1.3/§4 의 "context 미전달 → NULL" 서술이 실제 코드와 어긋나는 상태로 남는다 — Rationale 섹션 자체가 스스로 부정확해지는 창이 생긴다.
  - **완화 요인(severity 하향 근거)**: `plan/in-progress/ai-usage-attribution-hardening.md` §SPEC-DRIFT 가 이 정확한 drift 를 이미 인지·명문화하고 있다 — "C1 이 AI Agent 메모리 압축을 배선하므로 `spec/data-flow/7-llm-usage.md §1.3` 표 L107·요약문 L113·§4 표·Rationale 의 ... 서술이 stale 해진다" 라고 적시하고, 후속 PR-2(project-planner spec PR)에서 §1.3 row 정정을 약속하며 "병합 순서: PR-1 → PR-2 연속으로 drift window 최소화(리뷰 WARNING 반영)" 라는 명시적 근거를 제시한다. 즉 이번 diff 는 "무근거 번복" 이 아니라 **의도적으로 스코프를 좁힌, 추적되는 임시 drift** 다. 직전 `/ai-review`(`review/code/2026/07/10/02_09_15/SUMMARY.md`) 도 유사한 인접 문서 drift(#3, Text Classifier 서술)를 "follow-up (plan)" 으로 비차단 처리한 선례가 있어, 이 프로젝트의 기존 관행과 일치한다.
  - 제안: (1) 가능하면 이번 PR 에 `spec/data-flow/7-llm-usage.md` §1.3 L107/L113, §4 L162, `## Rationale` L204-208 을 함께 갱신해 drift window 를 0 으로 만드는 것이 가장 안전하다(텍스트 변경만이라 비용이 낮다). (2) 분리가 불가피하면 plan 의 PR-2 를 **즉시(같은 세션/같은 날)** 후속으로 머지해 "코드는 배선됨, spec 은 미배선으로 서술" 상태가 관측 가능한 기간 동안 남지 않도록 한다. (3) PR-2 에서 `(b)` 그룹을 "RerankService listwise grading" 단독으로 좁히고, "결정: 코드 수정 채택 (완료)" 서술에 메모리 압축 완결 사실을 추가해 Rationale 의 진행 이력(PR #519 → 2026-07 resume 턴 → 본 PR 메모리 압축)을 이어서 기록할 것을 권장한다.

- **[INFO]** 새 `llmContext: LlmCallContext` 파라미터 설계는 기존 아키텍처 원칙과 정합
  - target 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` (`BuildSummaryBufferArgs.llmContext`), `ai-memory-manager.ts` (`InjectMemoryContextArgs.llmContext`)
  - 과거 결정 출처: `spec/data-flow/7-llm-usage.md` §1.2 시퀀스 다이어그램의 `chat(config, params, context?, opts?)` 계약 + Rationale "잔여 NULL" 항의 "핸들러가 `ExecutionContext` 의 ID 를 `LlmCallContext` 로 전달하도록 고치는 코드 수정" 원칙. `spec/4-nodes/3-ai/1-ai-agent.md §12.12` "재번복 결정" 은 보조(요약/추출) LLM 콜이 "그 config 자신의 회계 경로로 집계되므로 회계 누락이 아니라 분리일 뿐" 이라고 명시해, 보조 콜에도 정상적인 usage 회계/attribution 이 기대됨을 뒷받침한다.
  - 상세: `codebase/backend/src/modules/llm/llm.service.ts` 에 이미 정의된 `LlmCallContext`(`workflowId?/executionId?/nodeExecutionId?`) 타입과 `LlmService.chat(config, params, context?, opts?)` 시그니처를 그대로 재사용하며, config 파생이 아니라 caller 명시 전달 방식을 택한 것도 target 문서 Rationale 의 기존 방향(§1.3 "핸들러가 ... `LlmCallContext` 로 전달")과 일치한다. plan 문서는 초기에 config 파생 시도가 있었고(리뷰가 Critical#1 로 지적) 명시 파라미터로 교정된 이력도 남아 있어, 결정 번복이 있었더라도 같은 브랜치 내에서 근거(ai-review Critical#1) 와 함께 처리되었다.
  - 제안: 없음 — 정합 확인용 기록.

## 요약

이번 diff(AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선)는 target 문서 `spec/data-flow/7-llm-usage.md` 의 `## Rationale`이 이미 정해둔 방향("핸들러가 `LlmCallContext` 를 전달하도록 고치는 코드 수정", "(b) 후속 배선 여지")을 그대로 실현하는 것으로, 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 다만 이 코드 diff 가 target 문서 자체는 전혀 갱신하지 않아, 병합 시점에 target 의 §1.3 표·§4 표·Rationale "잔여 NULL (b)" 서술이 실제 코드와 어긋나는 상태(코드는 배선 완료, 문서는 "미배선"으로 서술)가 발생한다. 이는 developer 의 plan(`ai-usage-attribution-hardening.md` §SPEC-DRIFT)이 이미 인지하고 후속 PR-2 로 명시적으로 이관해둔 의도적·추적된 drift 이며, 이 프로젝트의 기존 리뷰 관행(직전 02_09_15 리뷰에서도 유사한 인접 문서 drift 를 follow-up 으로 비차단 처리)과도 일치한다. 그럼에도 drift window 를 최소화하려면 가능한 한 이번 PR 에 target 문서의 관련 4개 지점을 함께 정정하거나, 최소한 PR-2 를 즉시 후속 병합할 것을 권장한다.

## 위험도

MEDIUM
