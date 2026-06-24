# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — `convention_compliance` 가 `processMultiTurnMessage` 내 condition deferral `toolCallCount++` 를 spec §7.1 직접 위반으로 확인. 해당 버그는 이번 구현이 수정할 대상이지만, 현재 코드베이스에 위반이 존재함을 공식 확인.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `processMultiTurnMessage` 내 condition deferral 루프에서 `toolCallCount++` 수행 — `meta.toolCalls` 가 spec 정의("조건 도구 제외")를 위반, single-turn 과 결과값 불일치 | `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` L2259–2261 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.toolCalls` 필드 정의 ("KB·MCP·일반 도구 합산, 조건 도구 제외") | L2260 `toolCallCount++` 를 제거. single-turn 경로(L1364)의 "Condition tool: does not count toward toolCallCount" 주석을 multi-turn 루프에도 추가. `[SPEC-DRIFT]` 주석 및 INVARIANT 동기화 금지 주석 함께 제거. |

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance / rationale_continuity / naming_collision | `'tool_call_budget_exceeded'` 인라인 리터럴 3곳 중복 — 상수 미추출 | `ai-turn-executor.ts` L922, L1392, L2287 | `TOOL_BUDGET_EXCEEDED_ERROR = 'tool_call_budget_exceeded'` 상수 추출 (모듈 내부 상수; `ErrorCode` enum 에 편입 금지). 상수 JSDoc 에 "LLM tool_result payload 내 error 값 — 공개 에러코드 `MAX_TOOL_CALLS_EXCEEDED` 와 별개" 명시. |
| 2 | convention_compliance / rationale_continuity | condition-route `Date.now()` 이중 호출 — `durationMs` 와 `finishedAt` 시각 불일치 가능 | `ai-turn-executor.ts` L1232–1234, L2115–2117, L1456–1458, L2354–2356 | `const finishedAtMs = Date.now()` 단일 캡처 후 `durationMs`/`finishedAt` 모두 참조. 4개 site 동일 적용. |
| 3 | convention_compliance / rationale_continuity | JSDoc 의 spec 섹션 참조가 `§3.f-g` 로 모호 — spec 파일·섹션 미특정 | `ai-turn-executor.ts` L1387 주석 | `spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g` 로 완전 경로 명시. |
| 4 | cross_spec | multi-turn 조건 도구 합산 비대칭이 spec §7.1 정의 내에서 코드가 수렴 중임을 확인 — spec 텍스트 변경 불요 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 | 이상 없음. 구현이 spec 에 맞추는 버그픽스. |
| 5 | naming_collision | `TOOL_BUDGET_EXCEEDED_ERROR`(신규 내부 상수) 와 `MAX_TOOL_CALLS_EXCEEDED`(예약 공개 에러코드) 간 이름 유사 — 레이어 다름, 실질 충돌 아님 | `ai-turn-executor.ts` (신규 상수) vs `spec/4-nodes/3-ai/1-ai-agent.md` L1101 | 모듈 주석으로 레이어 차이 명시하면 충분. spec 변경 불요. |
| 6 | plan_coherence | `plan/in-progress/refactor/03-maintainability.md` C-2 항목에 W7 SPEC-DRIFT 수정 슬라이스 추적 누락 | `plan/in-progress/refactor/03-maintainability.md` C-2 항목 | 구현 완료 후 C-2 항목에 "W7 SPEC-DRIFT 해소 슬라이스: recordMultiTurnNonProviderToolResults condition deferral toolCallCount++ 제거 (02-architecture W#1 defer 후속)" 한 줄 추가. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec §7.1 및 관련 영역 전체와 충돌 없음. 구현이 spec 에 수렴하는 버그픽스 확인. |
| rationale_continuity | NONE | W7 변경은 spec §7.1 합의 정책 복원. 기존 Rationale 어디에도 multi-turn 조건 도구 합산 결정 없음. |
| convention_compliance | CRITICAL | `processMultiTurnMessage` condition deferral `toolCallCount++` 가 spec §7.1 "조건 도구 제외" 직접 위반. single/multi-turn invariant 깨짐. |
| plan_coherence | NONE | 차단 요인 없음. 02-architecture W#1 defer 의 공식 후속 작업. plan 간 연결고리 명시 권장. |
| naming_collision | NONE | 신규 식별자 충돌 없음. `TOOL_BUDGET_EXCEEDED_ERROR` 상수는 내부 레이어로 공개 에러코드 네임스페이스와 분리. |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `ai-turn-executor.ts` L2259–2261 의 condition deferral 루프 내 `toolCallCount++` 제거. single-turn 경로(L1364) 주석을 multi-turn 루프에 동일하게 추가. `[SPEC-DRIFT]` 마커 주석 및 INVARIANT 동기화 금지 주석 제거.
2. **(INFO — 권장)** `'tool_call_budget_exceeded'` 인라인 리터럴 3곳을 `TOOL_BUDGET_EXCEEDED_ERROR` 상수로 추출. JSDoc 에 레이어 차이 명시.
3. **(INFO — 권장)** condition-route `Date.now()` 이중 호출 4개 site 를 단일 캡처 변수로 교체.
4. **(INFO — 권장)** `ai-turn-executor.ts` L1387 주석의 `§3.f-g` 를 `spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g` 로 완전 경로 명시.
5. **(INFO — 권장)** 구현 완료 후 `plan/in-progress/refactor/03-maintainability.md` C-2 항목에 W7 SPEC-DRIFT 수정 슬라이스를 한 줄 추가해 02-architecture W#1 defer 추적과 연결.