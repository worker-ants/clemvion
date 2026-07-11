# 신규 식별자 충돌 검토 — `spec/data-flow/7-llm-usage.md` (scope) / 코드 diff

## 발견사항

본 target(`spec/data-flow/7-llm-usage.md`)은 이번 diff 에서 텍스트 변경이 없다(`git diff origin/main...HEAD -- spec/data-flow/7-llm-usage.md` 결과 없음 — 최신 스펙 반영은 이전 커밋 `79669505c`에서 이미 완료됨). 즉 이번 diff 는 순수 코드 변경(`ai-memory-manager.ts`, `ai-turn-executor.ts`, `agent-memory-injection.ts` + 관련 `.spec.ts`)이며, spec 이 새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로는 없다. 따라서 신규 식별자 충돌 관점에서 점검할 대상은 diff 가 코드 레벨에서 새로 확산시키는 식별자 하나뿐이다: `llmContext` 파라미터(타입 `LlmCallContext`)를 `BuildSummaryBufferArgs`(`agent-memory-injection.ts`) 와 `AiMemoryManager.injectMemoryContext`(`ai-memory-manager.ts`) 인자에 추가한 것.

이 `llmContext`/`LlmCallContext` 는 신규 타입이 **아니다** — `codebase/backend/src/modules/llm/llm.service.ts:41`에 이미 정의돼 있고, `ai-turn-executor.ts`, `information-extractor.handler.ts`, `text-classifier.handler.ts` 가 기존에 동일한 이름·의미(`workflowId?/executionId?/nodeExecutionId?` — attribution 컨텍스트)로 이미 사용 중이다. 이번 diff 는 그 기존 규약을 memory-manager 계층으로 일관되게 확장한 것뿐이라 **충돌이 아니라 명명 일관성 강화**에 해당한다.

교차 검색 결과 다른 의미로 쓰이는 동명/유사명 충돌은 발견되지 않았다:
- 프론트엔드의 `HasDefaultLlmConfigContext`(React context, "기본 LLM Config 존재 여부" 플래그)는 이름이 유사하지만(`...LlmConfig...Context`) `llmContext`/`LlmCallContext` 와 표기·의미가 명확히 구분되어 실질적 혼동 가능성은 낮다.
- ENV var / config key 검색(`LLM_CONTEXT`, `llmContext` in `config/`, `.env*`) 결과 없음 — 설정키 충돌 없음.
- `spec/data-flow/7-llm-usage.md` 자체에는 요구사항 ID 패턴(`XX-NN` 형태)이 없고 이번 리뷰 대상 diff 도 신규 API endpoint·webhook/queue/sse 이벤트명·신규 spec 파일 경로를 도입하지 않는다.

참고(범위 밖 — 참고용): `plan/in-progress/ai-usage-attribution-hardening.md` 와 `plan/in-progress/resume-llm-usage-attribution.md` 에 이미 "본 PR(코드 배선)과 `spec/data-flow/7-llm-usage.md §1.3` 텍스트 정정(PR-2)의 시차"가 명시적으로 추적되어 있다. 이는 신규 식별자 충돌이 아니라 spec-code 서술 동기화(spec-drift) 문제이므로 본 checker 의 점검 관점 밖이며, 별도 consistency 관점(convention_compliance 등)에서 다룰 사안으로 판단해 이번 보고에서는 충돌 항목으로 등재하지 않는다.

## 요약

이번 diff 는 spec 문서 자체를 변경하지 않는 순수 코드 변경이며, 유일하게 확산된 식별자(`llmContext`/`LlmCallContext`)는 신규 정의가 아니라 `llm.service.ts` 에 이미 존재하는 타입·명명 규약을 memory-manager 계층까지 일관되게 재사용한 것이다. 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로 어느 항목에서도 기존 정의와 충돌하는 신규 식별자를 발견하지 못했다.

## 위험도

NONE
