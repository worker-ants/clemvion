# 테스트(Testing) 리뷰 결과

## 발견사항

### [WARNING] `assertPairingIntact` 내부 두 번째 루프가 사실상 no-op
- 위치: `agent-memory-injection.spec.ts` lines 77–83 (`assertPairingIntact` 함수 하단)
- 상세: `for (const m of messages.slice(1))` 블록 내부에 `if (m.role === 'tool')` 가 있으나 블록 본문이 완전히 비어 있고 주석만 존재한다. `void openToolIds` 로 lint 오류를 억제하지만, 고아(orphan) tool 메시지가 시퀀스 시작 부분에 독립적으로 존재하는지 실제로 단언하지 않는다. 첫 번째 루프의 `expected.has` 체크와 중복된다는 주석은 맞지만, 이 구조는 "두 번째 루프가 검증을 수행한다"는 오해를 독자에게 줄 수 있다.
- 제안: 빈 루프와 `void openToolIds` 를 제거하고 주석으로 "첫 번째 루프에서 이미 모든 페어링을 검증함"을 한 줄로 정리하거나, 실제로 orphan 검사를 수행하는 단언을 추가한다.

### [WARNING] `compactMessagesToTail` — messages 배열이 시스템 메시지로 시작하지 않고 여러 system 메시지를 포함하는 케이스 미테스트
- 위치: `agent-memory-injection.spec.ts` — `compactMessagesToTail` describe 블록
- 상세: 구현(`agent-memory-injection.ts` line 749)은 `messages[0].role !== 'system'` 이면 무변경 반환한다. 테스트 중 `noSystem` 케이스(`compactMessagesToTail(noSystem, 1)`)는 이를 커버하나, messages 배열 내 여러 system 메시지(`[sys, sys2, user, asst]` 형태)가 끼어 있을 때 cut 위치 계산이 의도대로 동작하는지는 테스트되지 않는다. 실제 handler 경로에서는 thread-inject 후 system 이 여러 번 포함될 가능성이 있다.
- 제안: `[system, system, user, asst, user, asst]` 형태의 messages 로 `compactMessagesToTail` 를 호출해 첫 system 만 남기는지(현재 구현은 `messages[0]` 하나만 명시 보존) 검증하는 케이스를 추가한다.

### [WARNING] `ai-agent.memory.spec.ts` 물리 압축 테스트 — `persistent` 전략에서의 물리 압축 시나리오 미커버
- 위치: `ai-agent.memory.spec.ts` — `summary_buffer` describe 블록 내 신규 두 테스트
- 상세: 신규 두 테스트(물리 축소, manual 회귀)는 `summary_buffer` 전략만 커버한다. `persistent` 전략도 `injectMemoryContext` 의 동일 코드 경로(handler.ts lines 2323–2337)를 통해 `compactMessagesToTail` 를 호출하는데, `persistent` + 요약 압축 → 물리 축소 시나리오는 테스트가 없다. `persistent` 에서 요약이 발생(예산 초과)했을 때 `compactedMessages` 메타가 정상 기록되는지 검증되지 않는다.
- 제안: `memoryStrategy: 'persistent'` + 낮은 tokenBudget + 큰 seeded turns 조합으로 물리 압축이 실제 발생하는 통합 테스트를 `persistent` describe 블록 안에 추가한다.

### [WARNING] `keepUserExchanges` 도출 로직 — `conversationThreadService` 미주입 fallback 경로 미테스트
- 위치: `ai-agent.handler.ts` lines 1259–1271 (injectMemoryContext 내 keepUserExchanges 계산)
- 상세: `this.conversationThreadService && args.target` 이 falsy 이면 `fullTurns = turns` 로 fallback 한다. 이 분기는 `conversationThreadService` 없이 핸들러를 구성했을 때 발생하지만, 테스트에서는 항상 `conversationThreadService` 를 주입한다. 따라서 `turns` (self 제외) 를 기반으로 `keepUserExchanges` 를 계산하는 fallback 경로에서 엣지 케이스(예: turns 가 빈 경우 keepUserExchanges=0 → 압축 미발생)가 커버되지 않는다.
- 제안: `conversationThreadService` 를 생략한 핸들러 인스턴스로 `summary_buffer` + 예산 초과 시나리오를 실행해 압축이 보수적으로 skip 됨을 확인하는 테스트를 추가한다.

### [INFO] `compactMessagesToTail` — `keepUserExchanges` 가 실제 user 수와 정확히 같을 때 경계값 명시 부재
- 위치: `agent-memory-injection.spec.ts` line 167 (`returns unchanged when keepUserExchanges >= total user count`)
- 상세: `keepUserExchanges === 2`인 상황에서 user 가 정확히 2개일 때 반환 값이 원본 배열과 동일 참조인지(`toBe(messages)`) 확인한다. 이는 "==" 경계를 커버하나, user가 2개이고 keepUserExchanges=2 인 배열에서 cutIndex가 `messages[1]`(직후인 index 1)에 떨어지는지, 아니면 -1로 미발견(전체 user = keepUserExchanges)으로 처리되는지를 알고리즘상으로 명확히 설명하는 주석이 없다. 코드 자체는 `cutIndex < 0` 조건으로 올바르게 처리되지만 테스트 주석이 이 분기를 식별하지 않는다.
- 제안: 테스트 설명 또는 내부 주석에 "user 수 == keepUserExchanges → cutIndex=-1 경로(미발견)로 무변경"을 명시해 유지보수 시 혼동을 줄인다.

### [INFO] 통합 테스트(`ai-agent.memory.spec.ts`) — `compactedMessages` 가 0일 때(압축 미발생)의 negative case 미커버
- 위치: `ai-agent.memory.spec.ts` — 물리 압축 테스트
- 상세: 현재 테스트는 압축이 발생했을 때 `compactedMessages > 0` 을 검증한다. 압축이 발생하지 않았을 때(`summarized: false`) `compactedMessages` 필드가 undefined 인지 0 인지도 명시되어 있지 않다(구현에서는 `memoryMeta` 에 `compactedMessages` 를 할당하지 않으므로 undefined). 이 negative path는 기존 테스트에서 간접적으로만 커버된다.
- 제안: 예산 여유가 충분한 scenario 에서 `meta.memory.compactedMessages` 가 undefined 임을 명시 단언하는 테스트를 추가한다.

### [INFO] `assertPairingIntact` 헬퍼 — 도구 호출이 없는 assistant 뒤에 tool 메시지가 오는 비정상 케이스 미검증
- 위치: `agent-memory-injection.spec.ts` `assertPairingIntact` 함수
- 상세: 헬퍼는 "assistant.toolCalls 가 있을 때" tool_result 가 짝을 갖는지 검증하나, "assistant.toolCalls 가 없는데 tool role 메시지가 뒤에 오는" 비정상 케이스(즉 완전한 고아 tool_result)는 단언하지 않는다. 이는 `compactMessagesToTail` 가 이 케이스를 생성할 수 없다는 전제에 의존하는데, 함수 자체가 user 경계에서만 자르기 때문에 이론적으로는 안전하다. 그러나 헬퍼 계약이 이를 명시하지 않아 미래 변경 시 결함이 침투할 수 있다.
- 제안: assertPairingIntact 주석에 "tool.toolCallId 가 어느 assistant.toolCalls 에도 없는 경우는 현재 단언 범위 밖"이라는 한 줄을 추가하거나, 실제로 해당 케이스도 검증하는 단언을 넣는다.

---

## 요약

신규 `compactMessagesToTail` 함수의 단위 테스트는 핵심 알고리즘(시스템 메시지 보존, user 경계 절단, tool 페어링 유지, 방어적 무변경 경로, idempotency)을 7개 케이스로 체계적으로 커버하며, 통합 테스트(`ai-agent.memory.spec.ts`)는 실제 핸들러 경로에서 `summary_buffer` + 물리 압축이 작동함과 `manual` 회귀 불변식을 검증한다. 테스트 격리와 가독성은 양호하나, `assertPairingIntact` 내 빈 루프 구조가 혼란을 줄 수 있고, `persistent` 전략에서의 물리 압축 경로와 `conversationThreadService` 미주입 fallback 경로가 커버되지 않는 갭이 존재한다. 또한 여러 system 메시지 포함 시나리오와 `compactedMessages` undefined(압축 미발생) negative case가 명시적으로 검증되지 않아 향후 회귀 탐지력이 부분적으로 약화될 수 있다.

## 위험도

MEDIUM
