# 유지보수성(Maintainability) 코드 리뷰

리뷰 대상: AI 대화 messages[].source 마커 구현 (ai-thread-source-mark-7c4f2a)
검토 파일: 11개 코드 파일 + 2개 문서 파일

---

## 발견사항

### 파일 5: backend/src/modules/llm/llm.service.ts

- **[WARNING]** `void source` 관용구 — 의도가 불분명한 코드 패턴
  - 위치: `llm.service.ts` +224 (`void source;`)
  - 상세: destructuring 후 `void source`로 "사용됨"을 표시해 lint 경고를 억제하는 패턴은 TypeScript 생태계에서 흔하지 않다. 코드를 처음 읽는 개발자는 이 한 줄의 목적을 즉시 파악하기 어렵다. ESLint `no-unused-vars` 억제가 목적이라면 `_source`로 변수명을 바꾸는 것이 더 관용적이다.
  - 제안:
    ```ts
    messages: params.messages.map(({ source: _source, ...rest }) => rest),
    ```
    또는 `eslint-disable-next-line` 주석 대신 네이밍 컨벤션으로 해결한다.

---

### 파일 6: backend/src/nodes/ai/ai-agent/ai-agent.handler.ts

- **[WARNING]** `mapTurnsToChatMessages` — 모든 case 에 `source: 'injected'` 를 반복 기재하는 중복 패턴
  - 위치: `ai-agent.handler.ts` +265~308 (switch 내 각 case)
  - 상세: `switch` 6개 브랜치(presentation_user, ai_user, ai_assistant, ai_tool, system, default) 모두 `source: 'injected'`를 수동으로 추가한다. 브랜치가 추가될 때마다 이 필드를 빠뜨릴 위험이 있다. 함수의 책임이 "source 마커를 붙인다"는 공통 후처리를 각 분기에 산재시키는 구조다.
  - 제안: switch 결과를 변수에 담고 함수 마지막에 일괄 적용하거나, 함수 반환 직전에 `.map(m => ({ ...m, source: 'injected' as const }))` 를 적용해 중복을 제거한다.
    ```ts
    function mapTurnsToChatMessages(turns): ChatMessage[] {
      return turns.map((t): Omit<ChatMessage, 'source'> => {
        switch (t.source) { /* source 없이 구조만 */ }
      }).map(m => ({ ...m, source: 'injected' as const }));
    }
    ```

- **[INFO]** `as ChatMessage` 타입 단언 반복
  - 위치: switch 각 case 반환문
  - 상세: 모든 return 문에 `as ChatMessage` 단언이 붙어있다. `ChatMessage` 인터페이스가 `source` 필드를 optional로 가지게 된 이상, 단언 없이도 구조적으로 호환될 가능성이 높다. 단언을 남발하면 타입 안전성이 약화된다.
  - 제안: `as ChatMessage` 를 제거하고 타입 추론이 성립하는지 확인한다. 성립하지 않을 경우 구체적인 타입 불일치 원인을 해소한다.

---

### 파일 2: backend/src/modules/execution-engine/execution-engine.service.ts

- **[INFO]** `withSourceMarker` 함수 — 타입 시그니처가 너무 넓음
  - 위치: `execution-engine.service.ts` +96~104
  - 상세: 파라미터 타입이 `Array<Record<string, unknown>>`이다. `ChatMessage[]`나 최소한 `Array<{ role?: unknown; source?: unknown }>` 같은 좁은 타입을 쓰면 함수가 어떤 구조를 기대하는지가 명확해지고 잘못된 인자 전달을 컴파일 시점에 잡을 수 있다.
  - 제안: `ChatMessage` 인터페이스가 이미 정의되어 있으므로 해당 타입을 사용한다.
    ```ts
    function withSourceMarker(messages: ChatMessage[]): ChatMessage[]
    ```

- **[INFO]** `withSourceMarker` 내 하드코딩된 문자열 리터럴 `'injected'`, `'live'`
  - 위치: `execution-engine.service.ts` +100~102
  - 상세: 같은 리터럴이 `llm-client.interface.ts`, `ai-agent.handler.ts`, `conversation-utils.ts`, `use-execution-events.ts` 등 최소 5개 파일에 산재한다. 현재는 `source?: 'live' | 'injected'` 유니온 타입으로 정의되어 있어 오타를 컴파일러가 잡아주므로 심각도는 낮다. 그러나 값이 추가될 경우 모든 파일을 일일이 갱신해야 한다.
  - 제안: 필요 시 `const SOURCE = { LIVE: 'live', INJECTED: 'injected' } as const` 형태의 공용 상수를 두고 참조하는 방식으로 중앙화할 수 있다. 현재 규모에서는 유니온 타입만으로도 충분하므로 INFO 등급.

---

### 파일 9: frontend/src/lib/conversation/conversation-utils.ts

- **[WARNING]** `messagesToConversationItems` — 함수 내 인라인 주석의 밀도가 높아 가독성 저하
  - 위치: `conversation-utils.ts` +84~186 (변경된 블록 전체)
  - 상세: 변경된 구간에 6개의 블록 주석이 삽입되었다. 각 주석은 spec 섹션 번호를 참조하며 의도 설명이 충실하지만, 실제 로직 라인 대비 주석 라인 비율이 지나치게 높아 코드 흐름을 따라가기 어렵다. 특히 `if (!isInjected)` 분기 전후의 주석이 코드보다 길어 역전 현상이 발생한다.
  - 제안: 핵심 불변식(invariant) 설명은 함수 JSDoc으로 올리고, 인라인 주석은 한 줄 요약 수준으로 압축한다. spec 참조는 JSDoc `@see` 태그를 활용하면 IDE에서도 접근하기 쉽다.

- **[INFO]** `turnIndex: currentTurn || 1` — 매직 숫자 `1`
  - 위치: `conversation-utils.ts` +584 (`turnIndex: currentTurn || 1`)
  - 상세: `|| 1`의 의미가 "injected 메시지가 첫 live user 메시지보다 앞에 오면 turnIndex를 1로 초기화"임을 코드만으로 파악하기 어렵다. 상수나 주석이 있지만 같은 패턴이 `const turn = currentTurn || 1`로도 반복된다.
  - 제안: `const INITIAL_TURN = 1` 상수를 추출하거나, 변수 선언 시점에 초기값을 `1`로 설정해 `|| 1` 폴백이 필요 없게 한다.

---

### 파일 11: frontend/src/lib/websocket/use-execution-events.ts

- **[WARNING]** 인라인 타입 중복 선언
  - 위치: `use-execution-events.ts` +222~684 및 +319~693 (두 블록 모두)
  - 상세: 동일한 메시지 형태의 인라인 타입(`{ role?: string; content?: string; toolCalls?: ...; toolCallId?: string; source?: "live" | "injected" }`)이 두 곳에서 따로 선언된다. 이미 `RawMessage` 인터페이스가 `conversation-utils.ts`에 존재하는데 이를 재사용하지 않고 인라인 반복한다. `source` 필드를 추가할 때도 각각 따로 추가해야 했다.
  - 제안: `RawMessage` 타입을 export하거나, 별도 공용 타입 파일로 추출해 `use-execution-events.ts`에서 import하도록 한다. 향후 필드 추가 시 한 곳만 수정하면 된다.

---

### 파일 1: backend/src/modules/execution-engine/execution-engine.service.spec.ts

- **[INFO]** 테스트 케이스 설명이 충실하나 주석과 `it()` 문자열의 내용이 일부 중복
  - 위치: `execution-engine.service.spec.ts` +35~37, +46
  - 상세: `it()` 블록 직전에 멀티라인 주석으로 동일 내용을 설명하고 `it()` 문자열에서도 같은 내용을 반복한다. 주석은 "why"를, `it()` 문자열은 "what"을 담으면 중복을 줄일 수 있다.
  - 제안: `it()` 문자열을 간결하게 유지하고 배경 설명은 주석으로만 둔다.

---

### 파일 7: backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts

- **[INFO]** 복잡한 타입 단언 체인
  - 위치: `ai-agent.thread.spec.ts` +353~367
  - 상세: `(first as { _resumeState: Record<string, unknown> })._resumeState` 와 `(await handler.processMultiTurnMessage(...)) as { output: { messages: Array<{...}> } }` 형태의 중첩 단언이 있다. 테스트 코드에서 타입 단언은 불가피한 경우가 있지만, 타입 단언 대상이 되는 구조를 로컬 테스트 헬퍼 타입으로 정의해두면 반복 사용 시 재활용이 쉽다.
  - 제안: 테스트 파일 상단에 `type MultiTurnResult = { output: { messages: Array<{ role: string; content: string; source?: 'live' | 'injected' }> } }` 와 같이 정의하고 단언에 사용한다.

---

### 파일 8: frontend/src/lib/conversation/__tests__/conversation-utils.test.ts

- **[INFO]** `describe` 블록 이름이 구현 함수명과 spec 절 참조를 함께 포함해 길어짐
  - 위치: `conversation-utils.test.ts` +414
  - 상세: `describe("messagesToConversationItems — source marker (spec/5-system/6-websocket-protocol.md §4.4.6)", ...)` — spec 경로를 describe 문자열에 직접 포함하면 spec 경로가 바뀔 때 테스트 파일도 갱신해야 한다.
  - 제안: describe 문자열은 `"messagesToConversationItems — source marker"` 수준으로 유지하고 spec 참조는 블록 상단 주석으로 이동한다.

---

### 파일 4: backend/src/modules/llm/interfaces/llm-client.interface.ts

- **[INFO]** JSDoc이 충실하고 양호함 — 특이사항 없음
  - 위치: `llm-client.interface.ts` +183~194
  - 상세: `source` 필드에 대한 JSDoc이 spec 참조, 의미 정의, 레이어 책임까지 명확히 기술되어 있다. 인터페이스 수준에서 이 정도의 문서화는 모범적이다.

---

### 파일 10: frontend/src/lib/stores/execution-store.ts

- **[INFO]** `isInjected?: boolean` — optional 처리 일관성
  - 위치: `execution-store.ts` +660
  - 상세: `isInjected`가 optional(`?`)로 선언되어 있어 소비 측에서 `undefined` 처리를 해야 한다. `conversation-utils.ts`에서 항상 값을 채워 넣는다면 `boolean`(필수)으로 선언하는 편이 소비 측 코드를 단순하게 유지한다. 단, 과거 persist 데이터 호환성을 위해 optional로 둔 것이라면 JSDoc에 그 이유를 명시하는 것이 좋다.
  - 제안: JSDoc에 "older persisted data may omit this field, treat undefined as false" 수준의 설명을 추가한다.

---

## 요약

이번 변경은 WebSocket 메시지의 `source` 마커(`'live' | 'injected'`) 를 전 스택(backend 인터페이스 → 핸들러 → 서비스 → frontend 유틸·스토어)에 일관되게 전파한 작업으로, 전반적인 유지보수성은 양호하다. JSDoc과 spec 참조 주석이 충실하게 작성되어 있고, `withSourceMarker` 같은 단일 책임 헬퍼를 추출해 중복 적용 지점을 최소화한 설계는 긍정적이다. 주요 개선 여지는 세 곳이다. 첫째, `mapTurnsToChatMessages`의 switch 각 브랜치에 `source: 'injected'`를 반복 기재하는 구조는 브랜치 추가 시 누락 위험이 있으므로 후처리 일괄 적용 패턴으로 리팩토링하면 안전하다. 둘째, `use-execution-events.ts`에서 인라인 타입을 두 곳에 중복 선언하는 대신 공용 타입을 참조하도록 개선하면 `source` 필드 추가처럼 횡단 변경이 필요한 상황에서 누락이 줄어든다. 셋째, `llm.service.ts`의 `void source` 관용구는 `_source` 네이밍 컨벤션으로 대체하는 것이 가독성에 유리하다. 전반적으로 코드 복잡도는 낮고 중첩 깊이도 적절하며, 매직 넘버 사용은 경미한 수준이다.

## 위험도

LOW
