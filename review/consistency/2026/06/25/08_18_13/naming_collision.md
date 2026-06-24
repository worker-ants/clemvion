# 신규 식별자 충돌 검토 결과

검토 범위: `03-maintainability C-2 후속 W7 SPEC-DRIFT 해소` — `ai-turn-executor.ts` 및 `ai-turn-executor.spec.ts`

## 발견사항

이번 변경이 도입하는 신규 식별자는 세 가지다.

1. **`TOOL_BUDGET_EXCEEDED_ERROR`** (module-level `const`, `ai-turn-executor.ts` line 554) — 값 `'tool_call_budget_exceeded'`. 이 상수는 해당 파일 외부로 export 되지 않으며, 기존 코드베이스 어디에서도 동일 이름의 상수·변수·export 가 존재하지 않는다. 값 문자열 `tool_call_budget_exceeded` 는 spec (`spec/4-nodes/3-ai/1-ai-agent.md` §6.1.g, `spec/5-system/9-rag-search.md`) 과 기존 코드(주석·JSDoc) 에서 이미 사용 중이나 이는 LLM-internal tool_result 페이로드 값이고, 상수명과 충돌하는 식별자는 없다.

2. **`condRouteDurationMs`** (지역 변수, 동일 파일 lines 1305, 2143) — `executeSingleTurn` 의 condition-route 종결 직전과 `processMultiTurnMessage` 의 condition-route 종결 직전 각각 별개 스코프에서 선언된다. 두 선언은 서로 다른 메서드 스코프에 있으므로 동명 충돌이 아니며, 기존 파일에 같은 이름의 지역 변수가 없음을 확인했다.

3. **신규 테스트 설명** `'does not count condition tools toward toolCalls in multi-turn, only normal tools'` (`ai-turn-executor.spec.ts` line 284) — 기존 테스트 `'counts only normal tools, not condition tools, toward toolCalls (single-turn)'` (line 173) 과 명칭이 구분되며 같은 `describe` 블록 내 중복 설명 없다.

**spec 섹션 참조 변경** (`§3.f-g` → `§6.1.f-g`) 은 코드 주석/JSDoc 내 텍스트 업데이트로, 식별자 도입이 아니며 실제 spec 문서의 섹션 번호(`spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g`)와 정렬된다.

충돌 관점에서 지적할 사항이 없다.

## 요약

이번 변경이 도입하는 신규 식별자(`TOOL_BUDGET_EXCEEDED_ERROR` 상수, `condRouteDurationMs` 지역 변수, 신규 테스트 설명)는 모두 단일 파일 스코프 내에 국한되며, 기존 코드베이스·spec·plan 에서 같은 이름이 다른 의미로 사용되는 사례가 없다. 값 문자열 `'tool_call_budget_exceeded'` 는 spec 에서 이미 정의된 LLM-internal 에러 코드이고 상수화가 오히려 일관성을 높인다. 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 충돌은 발견되지 않았다.

## 위험도

NONE
