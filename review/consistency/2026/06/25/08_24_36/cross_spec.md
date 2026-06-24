# Cross-Spec 일관성 검토 결과

검토 대상: C-2 후속 W7 SPEC-DRIFT 해소 — `recordMultiTurnNonProviderToolResults` condition toolCallCount++ 제거  
검토 기준: `spec/4-nodes/3-ai/1-ai-agent.md` 및 관련 spec 영역  
diff-base: origin/main

---

## 발견사항

### INFO-1: 이전 코드 주석의 §3.f-g 참조 → §6.1.f-g 로 정정 (이번 diff 에서 이미 완료)

- target 위치: `ai-turn-executor.ts` 다수 주석
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.f-g`
- 상세: 이전 코드 주석이 `§3.f-g` 로 참조하던 spec 절 번호가 실제 spec 문서에는 `§6.1.f-g` 로 존재한다. diff 를 보면 이 참조가 이미 `spec §6.1.f-g` 로 정정되었다.
- 제안: 이번 변경에서 이미 수정 완료. 추가 조치 불필요.

---

## 핵심 검토 결과

### 1. 데이터 모델 충돌

없음. 변경 대상은 `recordMultiTurnNonProviderToolResults` 의 내부 `toolCallCount` 누적 로직이다. 이는 내부 상태 변수로, `_resumeState.toolCalls` 로 반영되어 최종적으로 `meta.toolCalls` 출력 필드에 영향을 준다. `meta.toolCalls` 의 정의는 spec §7.1 에 명확히 규정되어 있다:

> `meta.toolCalls` | number | handler accumulator | KB·MCP·일반 도구 호출 횟수 합산 **(조건 도구 제외)**

이번 변경(multi-turn condition 도구를 toolCallCount 에서 제외)은 이 정의와 정확히 일치한다. 변경 전 코드(toolCallCount++)가 spec 과 불일치였고 이번 변경이 spec 에 맞추는 수정이다. `spec/1-data-model.md` 의 어떤 엔티티 정의와도 충돌 없음.

### 2. API 계약 충돌

없음. `meta.toolCalls` 는 AI Agent 노드 출력 페이로드의 필드로, REST API 또는 WebSocket 프로토콜 계약에 직접 노출되는 endpoint·method·shape 변경이 없다. `spec/5-system/` 영역의 API 규칙 문서(`1-auth.md`, `6-websocket-protocol.md` 등)에 기술된 계약과 충돌 없음.

### 3. 요구사항 ID 충돌

없음. 이번 변경은 신규 요구사항 ID 를 부여하지 않는다. 참조된 spec 절 번호(§7.1, §6.1.f-g)는 `spec/4-nodes/3-ai/1-ai-agent.md` 에 실존하며 해당 의미로 사용 중인 것과 동일하다. 다른 영역에서 동일 ID 를 다른 의미로 사용하는 사례 없음.

### 4. 상태 전이 충돌

없음. `toolCallCount` 는 multi-turn 루프 내 내부 누적 변수이며, spec 에 정의된 상태 머신 포트(`out`, `{condition.id}`, `user_ended`, `max_turns`, `error`, `waiting_for_input`)에 대한 전이 조건을 바꾸지 않는다. condition toolCallCount 제외는 `maxToolCalls` 초과 판단에만 영향을 주는데, spec §6.1.g 는 "KB·MCP·표현·일반 호출 모두 합산" 이라고 명시하고 있으며 조건 도구는 이 합산에서 명시적으로 제외된다(§7.1 `meta.toolCalls` 정의 참조). single-turn 과 multi-turn 이 이제 동일 정책을 따르므로 상태 전이 일관성 향상.

### 5. 권한·RBAC 모델 충돌

없음. 변경 범위가 AI Agent 노드 내부 turn executor 로직이며 RBAC 권한 체계와 무관.

### 6. 계층 책임 충돌

없음. `AiTurnExecutor.recordMultiTurnNonProviderToolResults` 는 AI Agent 노드 실행 계층의 책임이며, spec 이 정의하는 계층 분리(핸들러 facade → `AiTurnExecutor` → `AiConditionEvaluator` → `AiMemoryManager`) 와 일치한다. `spec/4-nodes/3-ai/1-ai-agent.md §5.2 / §6.1` 의 "조건 도구 분류 및 처리" 는 `AiConditionEvaluator.classifyToolCalls` 의 책임이고, 분류된 결과를 `recordMultiTurnNonProviderToolResults` 가 처리하는 것은 spec 이 명시한 위임 구조와 일치한다.

---

## 추가 관찰

### TOOL_BUDGET_EXCEEDED_ERROR 상수화 (INFO)

- target 위치: `ai-turn-executor.ts` — `JSON.stringify({ error: 'tool_call_budget_exceeded' })` → `TOOL_BUDGET_EXCEEDED_ERROR` 상수 사용
- 충돌 대상: `spec/conventions/error-codes.md` 참조 가능성 검토
- 상세: 코드 주석에서 "LLM-internal 신호이며 외부 API 계약에 노출되지 않으므로 lower_snake_case 유지" 로 명시했다. spec §11 에러 코드 표에서 `MAX_TOOL_CALLS_EXCEEDED` 는 `UPPER_SNAKE_CASE` 공개 에러코드로 별도 레이어에 존재하며, `tool_call_budget_exceeded` 는 LLM 에 돌려보내는 tool_result 내부 error 값으로 네임스페이스가 다르다. 모순 없음. INFO 수준.

### condRouteDurationMs 단일 캡처 (INFO)

- target 위치: `ai-turn-executor.ts` — condition route 분기에서 `Date.now() - singleTurnStartedAt` / `Date.now() - turnStartedAt` 를 `condRouteDurationMs` 상수로 단일 캡처
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §7.2 / §7.6 — meta.durationMs`
- 상세: `meta.durationMs` 와 `meta.turnDebug[].totalDurationMs` 가 동일 시각을 참조해야 한다는 요건은 spec 에 명시된 제약이 아니나, 두 필드가 서로 다른 `Date.now()` 호출 결과를 사용할 경우 미세 차이가 발생한다. 이번 변경은 동일 캡처로 일관성을 높이는 방향이다. spec 출력 필드 정의 위반 없음.

---

## 요약

이번 변경(`recordMultiTurnNonProviderToolResults` 에서 condition tool 의 `toolCallCount++` 제거)은 `spec/4-nodes/3-ai/1-ai-agent.md §7.1` 이 명시한 `meta.toolCalls` 정의("KB·MCP·일반 도구 호출 횟수 합산, 조건 도구 제외")에 multi-turn 경로를 정렬한 버그픽스다. single-turn 의 `recordSingleTurnNonProviderToolResults` 는 이미 동일 정책(조건 도구 미합산)을 구현하고 있었으며, 이번 변경으로 single/multi 경로가 spec 의 단일 정의로 통일된다. 검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 어디에서도 기존 spec 영역과의 직접 모순이 발견되지 않았다. spec 문서(`spec/4-nodes/3-ai/1-ai-agent.md`) 변경 없이 코드를 기존 spec 에 맞추는 작업이므로 cross-spec 일관성 위험도는 NONE 이다.

---

## 위험도

NONE
