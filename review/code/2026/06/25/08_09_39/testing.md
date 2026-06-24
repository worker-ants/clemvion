# Testing Review — ai-turn-executor (W7 SPEC-DRIFT fix)

## 발견사항

### [INFO] 새 테스트 케이스가 버그픽스의 핵심 동작을 정확하게 검증함
- 위치: `ai-turn-executor.spec.ts` 라인 389–422 (추가된 테스트)
- 상세: `'does not count condition tools toward toolCalls in multi-turn, only normal tools'` 테스트는 버그픽스(multi-turn condition deferral이 toolCallCount를 합산하지 않도록 수정)의 회귀를 방지하는 핵심 고정점이다. `cond_c1` + `do_thing` 혼합 시나리오에서 `_resumeState.toolCalls === 1`을 검증하는 방식은 정확하다.
- 제안: 유지. 기존 single-turn 대응 케이스(라인 278–312)와 대칭을 이루어 두 경로를 명확하게 커버한다.

### [INFO] condition-only(normal 도구 없음) multi-turn 케이스가 테스트되지 않음
- 위치: `processMultiTurnMessage (resume loop)` describe 블록
- 상세: single-turn에는 `'routes to the condition branch when the LLM calls only a condition tool'`(라인 248–273)이 있다. multi-turn에서 condition tool만 호출되고 normal 도구가 없는 경우(`conditionToolCalls.length > 0`, `normalToolCalls.length === 0`)의 toolCalls 카운트 고정 케이스는 없다. 추가된 테스트는 혼합(condition + normal) 시나리오만 다룬다.
- 제안: 낮은 우선순위. 현재 추가된 케이스에서 `toolCalls === 1`이 `cond_c1` 미합산에 의존하므로 간접 커버는 되나, 명시적인 condition-only multi-turn 케이스를 추가하면 회귀 탐지가 더 확실해진다.

### [INFO] condRouteDurationMs 단일 캡처 변경에 대한 시간 일관성 테스트 부재
- 위치: `ai-turn-executor.ts` — `handleSingleTurnConditionRoute`와 multi-turn condition-route 경로의 `Date.now()` 단일 캡처(INFO-3)
- 상세: `totalDurationMs`와 `turnDebug[].totalDurationMs`가 동일 `condRouteDurationMs` 값을 참조하도록 변경됐다. 기존 테스트에서 두 필드의 일치 여부를 검증하는 케이스가 없으므로 이 변경의 정확성을 테스트로 고정하지 않는다.
- 제안: 낮은 우선순위. 두 필드가 동일한지 검증하는 케이스가 있으면 이중 `Date.now()` 호출 회귀를 잡을 수 있다. 단, 시간 의존성 때문에 `jest.useFakeTimers()`를 사용해야 한다.

### [INFO] TOOL_BUDGET_EXCEEDED_ERROR 상수화에 대한 테스트 갭 — 기존 테스트가 커버
- 위치: `ai-turn-executor.ts` (`TOOL_BUDGET_EXCEEDED_ERROR` 상수 교체)
- 상세: `'tool_call_budget_exceeded'` 인라인 문자열이 상수로 교체됐다. 상수값 자체의 정확성은 `TOOL_BUDGET_EXCEEDED_ERROR = 'tool_call_budget_exceeded'` 선언에서 보장되므로 테스트 갭은 없다. 기존 도구 루프 테스트들이 이 경로를 간접적으로 통과한다.
- 제안: 해당 없음.

### [INFO] multi-turn toolCalls 합산 버그픽스의 경계값(maxToolCalls 소진 + condition 혼합) 케이스 미존재
- 위치: `processMultiTurnMessage (resume loop)` describe 블록
- 상세: `maxToolCalls` 예산이 거의 소진된 상태에서 condition + normal 혼합 호출이 오는 경우, condition 미합산이 budget 계산에 영향을 주지 않는지는 검증되지 않는다.
- 제안: 낮은 우선순위. 현재 추가 케이스(`maxToolCalls: 10`에서 `toolCalls: 1` 결과)로 기본 동작은 검증되나, `maxToolCalls: 1`과 condition+normal 혼합 시나리오는 더 날카로운 회귀 방지가 된다.

### [INFO] 테스트 격리 및 가독성 — 양호
- 위치: 전체 spec 파일
- 상세: `beforeEach`가 `mockLlmService`와 `mockEventEmitter`를 매 테스트마다 새로 초기화한다. `resumeState()` 팩토리 함수가 불변 기본값을 공유하면서 각 테스트가 필요한 필드만 spread 오버라이드한다. 테스트 간 상태 누출 없음. 테스트 이름이 검증 의도를 명확하게 표현한다.

## 요약

이번 변경은 multi-turn condition deferral의 `toolCallCount` 미합산 버그픽스를 동반하며, 대응 테스트(`does not count condition tools toward toolCalls in multi-turn, only normal tools`)가 정확히 추가되어 회귀를 방지한다. 기존 single-turn 대칭 케이스와 함께 버그픽스의 핵심 동작이 양쪽에서 고정된다. 미커버 영역으로는 condition-only multi-turn(normal 없음), `condRouteDurationMs` 시간 일관성, maxToolCalls 경계값 혼합 시나리오가 있으나 모두 낮은 우선순위다. 테스트 구조(격리·가독성·의존성 주입)는 기존 패턴을 잘 따른다.

## 위험도

LOW
