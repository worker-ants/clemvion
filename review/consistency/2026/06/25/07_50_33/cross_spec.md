# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상: 03-maintainability C-2 후속(W7 SPEC-DRIFT 해소) — `recordMultiTurnNonProviderToolResults` 의 condition deferral `toolCallCount++` 제거 + INFO cleanup

---

## 발견사항

### [INFO] multi-turn `meta.toolCalls` 정의가 single-turn 과 일관됨 — spec 변경 불요 확인

- target 위치: 구현 변경 (코드, spec 변경 없음)
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 table (`meta.toolCalls` 정의) 및 §6.1 단계 3.g
- 상세: `spec/4-nodes/3-ai/1-ai-agent.md` L524 에서 `meta.toolCalls` 는 **"KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"** 로 정의된다. Config 표 L48 의 `maxToolCalls` 도 **"KB·MCP·일반 합산"** 으로 조건 도구가 분리된다. 본 변경은 multi-turn 의 `recordMultiTurnNonProviderToolResults` 내부에서 condition deferral 경로에 잘못 포함된 `toolCallCount++` 를 제거해 multi-turn 도 single-turn 과 동일하게 spec 정의(`조건 도구 제외`)에 부합하도록 한다. spec 텍스트 자체는 이미 올바른 정의를 가지고 있으므로 spec 변경은 불요하며 코드가 spec 에 맞추는 버그 픽스다.
- 제안: 이상 없음. spec 의 단일 진실이 이미 정확하고, 이번 구현이 spec 에 수렴하므로 spec 갱신 불요.

### [INFO] `tool_call_budget_exceeded` 인라인 문자열 → `TOOL_BUDGET_EXCEEDED_ERROR` 상수화

- target 위치: `executeProviderToolBatch` L962 (추정)
- 충돌 대상: `spec/conventions/error-codes.md` (에러 코드 명명 규약)
- 상세: `tool_call_budget_exceeded` 는 LLM 에 돌려주는 `tool_result` 의 내부 content 문자열이며, 외부 API 에러 코드 규약(`UPPER_SNAKE_CASE`)이 적용되는 영역이 아니다. 인라인 문자열을 상수로 추출하는 것은 순수 코드 품질 개선이고, spec 에 노출되는 에러 코드 체계(`spec/4-nodes/3-ai/1-ai-agent.md` §10, `spec/conventions/error-codes.md`)와 다른 레이어다. `spec/4-nodes/3-ai/1-ai-agent.md` L1101 에서 `MAX_TOOL_CALLS_EXCEEDED` 는 예약 에러 코드로 "현재 핸들러는 `tool_call_budget_exceeded` tool_result 로 회신만 하므로 발생하지 않음"으로 명시되어 있으며, 이번 변경이 그 정책을 바꾸지 않으므로 충돌 없음.
- 제안: 이상 없음.

### [INFO] JSDoc §3.f-g 표기 정정

- target 위치: 코드 JSDoc 주석
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 3.f / 3.g
- 상세: JSDoc 표기 정정은 코드 내부 문서화 수준의 변경이며, spec 조항(§6.1 단계 3.g의 "maxToolCalls 초과 전까지 반복 (KB·MCP·표현·일반 호출 모두 합산)")과 충돌하지 않는다.
- 제안: 이상 없음.

### [INFO] condition-route `Date.now()` 이중 호출 → 단일 캡처

- target 위치: condition route 처리 경로
- 충돌 대상: 없음 (spec 에 Date.now 호출 횟수 명세 없음)
- 상세: 순수 코드 버그 픽스(시간 측정 race 제거). spec 에는 `Date.now` 호출 방식이 명세되지 않으므로 cross-spec 충돌 없음.
- 제안: 이상 없음.

---

## 요약

본 구현 변경(C-2 후속 W7 SPEC-DRIFT 해소)은 `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 의 `meta.toolCalls` 정의("KB·MCP·일반 도구 호출 횟수 합산, 조건 도구 제외")와 `maxToolCalls` config 설명("KB·MCP·일반 합산")이 이미 올바르게 기술되어 있는 상태에서 코드가 그 spec 에 수렴하도록 multi-turn 경로의 condition deferral `toolCallCount++` 를 제거하는 버그 픽스다. spec 전체 다른 영역(data-model, API 계약, RBAC, 상태 전이, 실행 엔진)과의 충돌이 없으며, INFO cleanup 3건(상수화, JSDoc, Date.now 단일캡처)도 각각 spec 에 정의된 인터페이스 레이어 외부의 코드 내부 개선으로 cross-spec 모순을 유발하지 않는다. 구현 착수에 차단 요소 없음.

## 위험도

NONE
