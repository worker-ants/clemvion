# 정식 규약 준수 검토 결과

검토 대상: `ai-turn-executor.ts` 03 C-2 2차(최종) 리팩터 diff (origin/main...HEAD)
검토 기준: `spec/conventions/**`

---

## 발견사항

### [INFO] `tool_call_budget_exceeded` 문자열 — 에러 코드 규약 형식 검토
- **target 위치**: `ai-turn-executor.ts` (diff 신규 상수) `const TOOL_BUDGET_EXCEEDED_ERROR = 'tool_call_budget_exceeded';`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 `UPPER_SNAKE_CASE` 명명), `spec/conventions/node-output.md §3.2` (`output.error.code` 는 `UPPER_SNAKE_CASE`)
- **상세**: `'tool_call_budget_exceeded'` 는 `lower_snake_case` 이며 `error-codes.md` 가 요구하는 `UPPER_SNAKE_CASE` 형식이 아니다. 다만 이 문자열은 LLM 에 전달하는 tool_result 의 `{ error: ... }` 페이로드 내부 값이며, `NodeHandlerOutput.output.error.code` 로 노드 외부에 노출되지 않는다. `error-codes.md` 의 적용 범위("프로젝트 전체의 에러 코드 문자열 — API·통합·OAuth 등에서 인라인 문자열 리터럴로 발행되는 코드")는 클라이언트/외부 계약 surface 를 대상으로 한다. 본 값은 LLM 이 소비하는 내부 tool_result 콘텐츠로서, 외부 API 계약이나 node output envelope 에 직접 노출되지 않으므로 엄격한 CRITICAL 위반은 아니다.
- **제안**: 값을 `'TOOL_CALL_BUDGET_EXCEEDED'`(UPPER_SNAKE_CASE)로 변경하거나, JSDoc 에 "LLM-internal tool_result signal, not a public error code" 임을 명시한다. `error-codes.md §4` 의 "내부 전용 분류 코드" 패턴처럼 문서화하면 규약 표류 우려를 차단할 수 있다.

---

## 요약

이번 diff 는 `ai-turn-executor.ts` 의 god-method 두 개를 spec §6.1/§6.2 정렬 private 메서드 6개로 behavior-preserving 분해한 순수 리팩터로, 공개 API 계약·node output 형식·error code envelope·API 문서 규약에 변화를 주지 않는다. 새로 도입된 타입(`MultiTurnMemoryMeta`, `TurnOutputAccumulators`)과 메서드명(camelCase private)은 TypeScript 관례에 부합하며, 문서 구조나 spec 파일 frontmatter 변경도 없다. 유일한 주목 사항은 `tool_call_budget_exceeded` 상수 값이 `lower_snake_case` 라는 점이나, 이 값은 NodeHandlerOutput 외부에 노출되지 않는 LLM-internal tool_result 신호이므로 정식 error-codes 규약의 직접 적용 대상으로 보기 어렵다. 전반적으로 정식 규약을 준수하고 있으며 중대 위반 사항 없음.

---

## 위험도

NONE
