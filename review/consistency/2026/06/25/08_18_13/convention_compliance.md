# 정식 규약 준수 검토 결과

검토 대상: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` + `.spec.ts` (W7 SPEC-DRIFT 해소 — condition deferral toolCallCount++ 제거)
검토 기준: `spec/conventions/` 전체

---

## 발견사항

### INFO-1 — `tool_call_budget_exceeded` lower_snake_case 근거 주석이 규약 §4 를 직접 인용하지 않음
- target 위치: `ai-turn-executor.ts` 신규 JSDoc 블록 (`TOOL_BUDGET_EXCEEDED_ERROR` 상수 설명)
- 위반 규약: `spec/conventions/error-codes.md §4` (내부 전용 분류 코드 — §1 적용 범위 밖)
- 상세: 신규 JSDoc 은 `lower_snake_case 유지` 의 근거를 "LLM-internal 신호" / "외부 API 계약에 노출되지 않으므로" 라고 서술한다. 이 판단은 `spec/conventions/error-codes.md §4` 의 "클라이언트에 노출되지 않는 구현 내부 명칭이므로 §1 적용 범위 밖" 원칙과 정확히 일치하며 올바르다. 다만 주석이 규약 문서(`spec/conventions/error-codes.md §4`)를 명시적으로 cross-reference 하지 않아 향후 리뷰어가 근거를 재추적해야 한다.
- 제안: JSDoc 에 `// (spec/conventions/error-codes.md §4 — internal 전용, §1 적용 범위 밖)` 참조를 추가하면 가독성이 향상된다. 단 규약 위반은 아니므로 필수 아님.

---

## 요약

이번 변경(W7 SPEC-DRIFT 해소)은 정식 규약 직접 위반 항목이 없다. 핵심 변경인 `recordMultiTurnNonProviderToolResults` 의 condition deferral `toolCallCount++` 제거는 `spec/conventions/node-output.md` Principle 0/2 계열과 직교하고, `meta.toolCalls` "조건 도구 제외" 정책은 `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 에 명시된 SoT 를 준수한다. `TOOL_BUDGET_EXCEEDED_ERROR` 상수화(기존 인라인 `'tool_call_budget_exceeded'` 문자열 추출)는 `spec/conventions/error-codes.md §4` 의 "내부 전용 코드는 §1(UPPER_SNAKE_CASE) 적용 범위 밖" 조항이 적용되는 케이스이며, 신규 JSDoc 이 그 근거를 서술하고 있다. 문서 구조 관점에서 본 diff 는 spec 파일을 변경하지 않으므로 `_product-overview.md` / `0-` prefix / Overview-본문-Rationale 3섹션 등 spec 문서 구조 규약의 적용 대상 밖이다. `Date.now()` 단일 캡처(`condRouteDurationMs`) 와 JSDoc 대칭화 모두 규약 위반 패턴을 도입하지 않는다.

---

## 위험도

NONE
