### 발견사항

**[WARNING] `assertPairingIntact` 내부 빈 `for` 블록 — dead code**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` 라인 77-82 (`for (const m of messages.slice(1)) { if (m.role === 'tool') { // ... } }`)
- 상세: `for` 루프 내 `if (m.role === 'tool')` 블록이 완전히 비어 있다. 주석만 있을 뿐 실제 검증 코드가 없어 고아 tool 시작 방지 의도가 코드로 전혀 집행되지 않는다. `void openToolIds;` 도 컴파일러 경고 억제용 suppress 에 불과하다. 이 패턴은 검증 의도가 주석에만 있고 실제로는 아무것도 하지 않아 향후 유지보수자에게 오해를 준다.
- 제안: 빈 블록을 제거하거나, 고아 tool 시작 방지를 실제로 검증하는 assertion 으로 대체한다. `openToolIds` 변수도 실제 assertion 이 없으면 함께 제거한다.

**[WARNING] `assertPairingIntact` 함수의 의도-구현 불일치 — 전체 messages 의 "고아 tool 시작 방지" 미검증**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` 라인 54-84
- 상세: JSDoc 에서 "고아 tool_result 0, 고아 tool_use 0" 을 검증한다고 설명하지만, 실제로 함수는 `assistant.toolCalls` 가 있는 경우만 검증한다. assistant.toolCalls 가 없는 상황에서 등장하는 고아 tool 메시지(예: 배열 시작이 `tool` 역할로 시작하는 경우)는 걸리지 않는다. 설명과 구현의 간극이 있다.
- 제안: "고아 tool 시작 방지" assertion 을 실제 코드로 구현하거나(첫 비-system 메시지가 tool 이면 fail), 주석/JSDoc 에서 해당 보장을 제거해 명확하게 한다.

**[WARNING] `injectMemoryContext` 메서드 내 `keepUserExchanges` 도출 로직 중복 — 동일 코드 두 위치**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff `@@ -937` 구간과 `injectMemoryContext` 내부 라인 2285-2306
- 상세: `keepUserExchanges` 를 계산하는 블록(fullThread 취득 → `selectVolatileTail(fullTurns, update.summarizedUpToSeq).filter(...)` → `.length`)이 `injectMemoryContext` 내부에 한 번 있고, diff 의 `@@ -937` 패치도 동일한 로직을 동일하게 추가한다. 두 위치에서 동일한 fullThread/fullTurns 도출 및 filter 로직을 반복한다. 이미 `injectMemoryContext` 의 반환 타입에 `keepUserExchanges` 가 포함되어 있으므로 외부 중복 계산은 불필요하다.
- 제안: 구조상 `injectMemoryContext` 반환값의 `keepUserExchanges` 를 그대로 사용하는지 확인하고, 외부 중복 블록 제거를 검토한다.

**[INFO] 테스트 헬퍼 함수 `queueAnswer` / `queueSummary` 두 개의 테스트 케이스에서 각각 중복 정의**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts` 라인 2608-2623 과 3039-3054 (각 `it` 블록 내부)
- 상세: 두 `it` 블록이 거의 동일한 `queueAnswer` / `queueSummary` 헬퍼를 각자 내부에서 동일하게 정의한다. `describe` 스코프로 추출하면 중복을 제거할 수 있다.
- 제안: `queueAnswer` / `queueSummary` 를 `describe('summary_buffer (multi_turn)', ...)` 스코프로 추출하거나, `beforeEach` 에서 인스턴스를 초기화하는 패턴으로 공유한다.

**[INFO] `compactMessagesToTail` 의 변수명 `seen` — 명확성 부족**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` 라인 1134 (`let seen = 0;`)
- 상세: `seen` 은 "끝에서부터 세어 온 user 메시지 수" 를 의미하지만 이름만으로는 의도가 불분명하다. 인접 주석이 설명하긴 하나 변수명 자체에 의미가 없다.
- 제안: `userCountFromTail` 또는 `tailUserCount` 처럼 의미를 담은 이름을 사용한다.

**[INFO] `ai-agent.handler.ts` 에서 `getThread` 호출이 `injectMemoryContext` 내부와 외부에서 모두 발생**
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` diff `@@ -959` 와 `injectMemoryContext` 내부 라인 2295
- 상세: `this.conversationThreadService.getThread(args.target)` 가 `injectMemoryContext` 안에서도 호출되고, 핸들러 외부 패치에서도 동일하게 호출된다. `getThread` 가 캐시 없이 매번 thread 를 반환하는 경우 중복 조회가 발생한다.
- 제안: `injectMemoryContext` 반환값의 `keepUserExchanges` 를 그대로 사용하는지 확인하고, 외부 중복 블록 제거를 검토한다.

**[INFO] spec 문서(`1-ai-agent.md`) 에 `d.6` 항목이 들여쓰기 깊이 없이 `d.5` 와 동일 레벨로 추가됨 — 일관성**
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` diff 라인 3650
- 상세: `d.6.` 이 `d.5` 와 동일한 줄 들여쓰기로 추가됐으나, 다른 d.x 항목들의 줄바꿈·들여쓰기 패턴과 일치하는지 확인이 필요하다 (기능적 문제는 없음).
- 제안: 인접 항목들의 마크다운 들여쓰기 패턴을 확인해 맞춘다.

---

### 요약

이번 변경은 `compactMessagesToTail` 순수 함수와 그 핸들러 배선·테스트를 추가한 것으로, 알고리즘 자체는 명확하고 주석이 충실하다. 주된 유지보수성 우려는 두 가지다. 첫째, `assertPairingIntact` 내부의 빈 `for` 블록이 의도만 주석으로 남기고 실제 검증 코드가 없어 함수가 선언한 보장을 온전히 집행하지 못한다(silent no-op). 둘째, `keepUserExchanges` 도출 로직이 `injectMemoryContext` 내부와 핸들러 외부 두 곳에 중복되어 있어 향후 로직 수정 시 한쪽을 빠뜨릴 위험이 있다. 나머지 발견사항은 테스트 헬퍼 중복 정의와 변수명 명확성 등 경미한 수준이다.

### 위험도

LOW
