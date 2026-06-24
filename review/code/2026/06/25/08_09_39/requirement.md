# Requirement Review — W7 multi-turn condition tool toolCalls 미합산 통일

리뷰 대상 커밋: `c7e9574f`
파일: `ai-turn-executor.spec.ts` (테스트 추가) / `ai-turn-executor.ts` (버그픽스 + cleanup)

---

## 발견사항

### [INFO] 기능 완전성 — 핵심 버그픽스 정확히 구현됨
- 위치: `ai-turn-executor.ts` L1990–1994 (`recordMultiTurnNonProviderToolResults`)
- 상세: 이전 코드는 `conditionToolCalls` 루프 안에서 `toolCallCount++` 를 수행해 condition deferral 이 budget 에 합산됐다. 수정 후 `toolCallCount++` 제거 — deferral 메시지만 push 하고 카운터는 건드리지 않아 single-turn 의 `recordSingleTurnNonProviderToolResults` 와 동일 정책이 됐다. 수정된 구현이 spec §7.1 "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)" 명세와 완전히 일치한다.

### [INFO] 테스트 추가 — 올바른 경로 검증
- 위치: `ai-turn-executor.spec.ts` L390–423 (파일 내 두 번째 동일 테스트 본체, diff 기준 L65–98)
- 상세: 테스트가 `processMultiTurnMessage` 를 직접 호출해 `result._resumeState.toolCalls === 1` 을 단언한다. 이 단언은 구현의 `_resumeState: { toolCalls: toolCallCount, ... }` (L2844) 에 직결되며, 수정된 `recordMultiTurnNonProviderToolResults` 를 거쳐온 `toolCallCount` 가 condition 제외 1이 되는 경로를 올바르게 고정한다.

### [INFO] spec fidelity — 구현이 spec 에 수렴함 (spec 변경 불요)
- 위치: spec/4-nodes/3-ai/1-ai-agent.md §7.1 L524, §6.1.f-g L384–385
- 상세: spec §7.1 `meta.toolCalls` 필드 정의 "KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)" 는 기존 spec 에 이미 존재하며 수정 없다. 이전 multi-turn 구현이 이 spec 을 위반하고 있었고, 이번 커밋이 코드를 spec 에 맞게 수정했다. JSDoc 갱신(단방향 INVARIANT 제거 → 통일 정책 표기) 도 spec 본문과 정합하며 혼동 여지를 제거했다.

### [INFO] `TOOL_BUDGET_EXCEEDED_ERROR` 상수화 — 기능에 무영향
- 위치: `ai-turn-executor.ts` L554, L966, L1191, L2020
- 상세: 인라인 문자열 `'tool_call_budget_exceeded'` 를 `const TOOL_BUDGET_EXCEEDED_ERROR` 로 교체했다. 값은 동일하므로 LLM-facing 동작·LLM 파싱 모두 무변경. JSDoc 에 "공개 에러코드 enum 과 다른 레이어" 설명 추가로 후속 개발자가 외부 에러코드와 혼용하는 실수를 예방한다.

### [INFO] condition-route `Date.now()` 단일 캡처 — 정확도 향상
- 위치: `ai-turn-executor.ts` L2143 (multi-turn), L1144 (single-turn)
- 상세: 이전에는 `totalDurationMs` 와 `turnDebug[].totalDurationMs` 두 곳에서 각각 `Date.now() - startedAt` 를 호출해, 두 측정값 사이에 수 μs~수 ms 의 drift 가 발생할 수 있었다. 이제 `condRouteDurationMs` 하나를 캡처해 두 위치에 공유해 동일 시각을 참조한다. 기능 의미에는 영향 없고 trace 일관성이 향상된다.

### [INFO] 테스트 fixture `resumeState.toolCalls` 초기값 0
- 위치: `ai-turn-executor.spec.ts` L353
- 상세: 신규 테스트에서 `state.toolCalls: 0` 으로 시작해 최종 `next.toolCalls === 1` 을 단언한다. `processMultiTurnMessage` 가 `let toolCallCount = state.toolCalls as number` (L2443) 에서 이를 수신해 수정 후 정상 누적하는 경로가 올바르다.

---

## 요약

이번 변경은 multi-turn condition deferral 이 `toolCallCount` 에 잘못 합산되던 pre-existing 버그를 제거하고, spec §7.1 "조건 도구 제외" 정책과 single-turn 의 동일 helper 에 수렴시켰다. spec 본문은 기존부터 "KB·MCP·일반 합산, 조건 도구 제외" 를 명시하고 있었으므로 spec 변경 없이 코드만 수정해도 정합이 달성된다. 테스트는 `_resumeState.toolCalls === 1` 를 직접 단언해 회귀를 고정하며, 경계값·에러 시나리오·반환값 경로 모두 기존 테스트군과 함께 충분히 커버된다. 동봉 cleanup(상수화·Date.now 단일 캡처·JSDoc 갱신)은 기능에 영향을 주지 않으며 의도와 구현 간 괴리를 해소한다. 전반적으로 요구사항을 완전히 충족하며 미완성 작업(TODO/FIXME)은 없다.

## 위험도

NONE
