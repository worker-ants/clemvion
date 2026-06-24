# Testing Review — ai-turn-executor.ts (03 C-2 2차)

## 발견사항

### [WARNING] `recordSingleTurnNonProviderToolResults` — toolCallCount 미합산 의미론 테스트 없음
- 위치: diff 추출 메서드 (single-turn 조건 도구 루프, spec §3.f-g)
- 상세: multi-turn 의 동명 helper(`recordMultiTurnNonProviderToolResults`)는 조건 도구 호출 시 `toolCallCount++`를 수행하지만, single-turn 버전은 의도적으로 카운트를 늘리지 않는다. 이 "의도적으로 다른 동작"은 JSDoc 에 명시되어 있으나, 이를 직접 검증하는 단위 테스트가 존재하지 않는다. 현재 `ai-turn-executor.spec.ts`와 `ai-agent.handler.spec.ts` 어디에도 single-turn 조건 도구 루프에서 반환된 `toolCallCount`가 증가하지 않았음을 assertion 하는 케이스가 없다.
- 제안: `ai-turn-executor.spec.ts`에 `executeSingleTurn`을 통해 LLM 이 조건 도구 + 일반 도구를 동시에 호출하는 시나리오에서 조건 도구는 count 미증가, 일반 도구는 count 증가함을 검증하는 케이스를 추가한다 (현재 핸들러 spec 의 단일 조건 도구 케이스는 count 를 assertion 하지 않음).

### [WARNING] `handleSingleTurnConditionRoute` / `handleMultiTurnConditionRoute` — 추출 후 직접 단위 테스트 없음
- 위치: `handleSingleTurnConditionRoute` (신규 private 메서드), `handleMultiTurnConditionRoute` (신규 private 메서드)
- 상세: 두 메서드는 각각 큰 accumulator 인자를 받아 `buildConditionOutput`를 조립한다. 핸들러 spec(`ai-agent.handler.spec.ts`)에 condition route 통합 테스트가 존재하지만, 특히 `handleMultiTurnConditionRoute`에서 `finalInputTokens = totalInputTokens + result.usage?.inputTokens` 누적 계산이 caller scope 가 아닌 helper 내부로 이동했기 때문에, 토큰 누적이 올바르게 일어나는지(이전 turn 값 + 현재 turn 값)를 검증하는 executor 레벨 테스트가 없다.
- 제안: `ai-turn-executor.spec.ts` 의 `processMultiTurnMessage` describe 블록에 "routes to condition port on condition-only tool call" 케이스를 추가하고 `output.result.meta.totalInputTokens` 가 이전 turn 누적값을 올바르게 반영하는지 assertion 한다.

### [WARNING] `handleMultiTurnUserMessageEntry` — form bypass 분기 executor 레벨 테스트 누락
- 위치: `handleMultiTurnUserMessageEntry` private 메서드 (새로 추출된 helper)
- 상세: form bypass 분기(`source: 'ai_message'` + `pendingFormToolCall` 설정)에 대한 테스트는 `ai-agent.handler.spec.ts` 의 `render_form blocking — form bypass dispatch` describe 블록에 존재한다. 그러나 이 테스트는 핸들러를 통한 통합 경로를 검증하며, 추출된 helper 의 세 분기(form 제출 / bypass / fallback)를 executor 레벨에서 격리 검증하지는 않는다. 특히 messages + state in-place 변이 부작용(pendingFormToolCall delete, cancelled tool_result splice)을 executor spec 에서 직접 고정하는 케이스가 없다.
- 제안: `ai-turn-executor.spec.ts`에 `processMultiTurnMessage — form_bypass` describe 블록을 추가해 `source: 'ai_message'` + `pendingFormToolCall` 설정 시 cancelled tool_result 가 messages 에 삽입되고 pendingFormToolCall 이 클리어됨을 검증한다.

### [WARNING] `applyMultiTurnTurnMemory` — `keepUserExchanges=0` 분기 executor 레벨 단독 고정 없음
- 위치: `applyMultiTurnTurnMemory` private 메서드 (새로 추출된 helper)
- 상세: `ai-agent.memory.spec.ts`에 `compactedMessages > 0` 케이스와 `keepUserExchanges=0` skip 케이스가 이미 존재하고 `processMultiTurnMessage` 전체 흐름을 통해 간접적으로 검증한다. 새로 추출된 메서드 안으로 `messages.length = 0; messages.push(...compacted)` in-place 변이 패턴이 이동했으므로, caller 의 messages 배열 레퍼런스가 올바르게 변이되는지를 executor 레벨에서 단독 고정하는 것이 바람직하다. 단, 기존 memory spec 이 이를 간접 커버하므로 위험도는 낮다.
- 제안: 기존 `ai-agent.memory.spec.ts` 압축 테스트가 여전히 유효한지(회귀 없음) 확인하는 것으로 우선 충분하나, executor spec 에 메모리 압축 발생 시 `memory.compactedMessages` 가 설정되는 케이스를 추가하면 더욱 안전하다.

### [INFO] `executeSingleTurn` 조건 전용 경로 — executor spec 에 케이스 없음
- 위치: `ai-turn-executor.spec.ts` `executeSingleTurn` describe 블록
- 상세: executor spec 의 `executeSingleTurn` describe 는 plain text 응답, eventEmitter 미주입, system prompt ordering 3가지만 테스트한다. 조건 도구 전용(Case 1) 경로인 `handleSingleTurnConditionRoute` 는 핸들러 spec(`ai-agent.handler.spec.ts` 의 `conditions - single_turn` describe)에서 통합 경로로 커버되지만, executor 를 직접 구성해 검증하는 케이스는 없다.
- 제안: `ai-turn-executor.spec.ts`에 LLM 이 조건 도구만 호출하는 mock 응답을 주입해 `handleSingleTurnConditionRoute` 가 정상 포트(`condition.id`)를 반환하는지 검증하는 케이스 추가를 권장한다.

### [INFO] `MultiTurnMemoryMeta` 타입 선언 — 파일 내 중복 가능성
- 위치: diff 추가분 약 line 509 vs 전체 컨텍스트 약 line 1741-1755
- 상세: 전체 파일 컨텍스트에 `type MultiTurnMemoryMeta` 가 두 곳에서 선언된 것으로 보인다. TypeScript 는 같은 파일 내 동명 타입 재선언 시 컴파일 오류를 발생시키므로, 커밋의 "tsc PASS" 기재가 사실이라면 실제로는 중복이 아닌 교체일 가능성이 높다. 테스트 에 직접 영향은 없다.
- 제안: 빌드가 통과했으므로 무시 가능. 단, 코드 리뷰에서 실제 파일 확인 권장.

## 요약

이번 리팩토링은 `processMultiTurnMessage`(768→459줄)와 `executeSingleTurn`(545→395줄)의 god-method 에서 6개의 private helper 를 behavior-preserving 방식으로 추출했다. 커밋 메시지에 명시된 대로 lint·tsc·unit(474개)·e2e(214개) 모두 PASS 했으므로 기존 테스트로 커버되는 경로에 대한 회귀는 없다. 그러나 추출된 메서드들의 핵심 의미론적 차이(단일턴 조건 도구의 `toolCallCount` 미합산 vs 멀티턴 증가, `handleMultiTurnConditionRoute` 내부 토큰 누적 계산 이관)를 executor 단위에서 직접 고정하는 신규 테스트가 추가되지 않았다. 핸들러 통합 테스트만으로는 이 의도적 차이의 회귀를 조기에 잡기 어려우므로, WARNING 3건(§3.f-g 카운트 의미론, condition route 토큰 누적, form bypass executor 격리)에 대한 executor 레벨 단위 테스트 보강을 권장한다.

## 위험도

MEDIUM
