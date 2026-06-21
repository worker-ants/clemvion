# 유지보수성(Maintainability) 리뷰

## 발견사항

### AiMemoryManager 신규 파일 (`ai-memory-manager.ts`)

- **[INFO]** 클래스 doc-comment가 한/영 혼용으로 상세히 작성되어 있고, 메서드별 JSDoc도 충분히 기술되어 있다. 의도 파악에 어려움이 없다.
  - 위치: `/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 전체

- **[WARNING]** `injectMemoryContext` 함수가 145~350줄 범위로 약 205줄에 달한다. 함수 내부에서 5단계(회수 → 요약 → stable prefix → volatile tail → messages 조립)가 순차적으로 수행되며, 각 단계 간 공유 변수가 많아 단독 추출이 쉽지 않은 구조다. 현재는 인라인 섹션 주석(`// ── [5a] ... ──`)으로 단계를 구분하고 있어 가독성을 어느 정도 보완하고 있지만, 함수 자체가 너무 많은 책임을 갖고 있다.
  - 위치: `ai-memory-manager.ts:99-350`
  - 상세: 단일 함수 내에서 ① persistent recall, ② summary buffer 갱신, ③ stable prefix 조립, ④ volatile tail 선택, ⑤ messages 배열 조립(3가지 분기)을 모두 처리한다. 현재 동작보존(behavior-preserving) 리팩토링 범위 내이므로 즉각 분할은 필요하지 않으나, 후속 수정 시 진입 장벽이 높다.
  - 제안: 향후 `#recallPersistentMemory`, `#updateSummaryBuffer`, `#assemblePrefixAndTail` 등 private 헬퍼로 단계별 분리를 고려한다. 당장은 현 인라인 섹션 주석이 최소 안전선 역할을 한다.

- **[WARNING]** `injectMemoryContext` 내부에서 `conversationThreadService.getThreadExcludingNode`와 `conversationThreadService.getThread`를 별도로 두 번 호출한다 (라인 152, 273). 두 호출이 다른 목적(요약용 vs. 물리 압축 경계 계산)임은 주석으로 설명되어 있으나, 서비스 호출이 중복처럼 보여 유지보수 시 혼동 여지가 있다.
  - 위치: `ai-memory-manager.ts:150-156` (getThreadExcludingNode), `ai-memory-manager.ts:271-277` (getThread)
  - 상세: 두 호출의 의도 차이가 주석에 충분히 기술되어 있으나, 함수 길이가 길어질수록 맥락을 잃기 쉽다.
  - 제안: 두 변수명(`turns`, `fullTurns`)과 그 목적 차이를 변수 선언 위치 주석에서 명시하는 것은 현재도 되어 있다. 추가로 `fullTurns` 도출 섹션 바로 앞에 섹션 구분 주석(`// ── [keepUserExchanges 도출] ──`)을 상단의 다른 섹션 헤더와 동일 패턴으로 추가하면 스캔성이 향상된다.

- **[INFO]** `injectMemoryContext` 매개변수 객체가 12개 필드를 갖는 단일 `args` 객체다. 필드별 JSDoc이 inline으로 잘 문서화되어 있고, args bag 패턴은 코드베이스 기존 스타일과 일치한다.
  - 위치: `ai-memory-manager.ts:99-145`

- **[INFO]** `scheduleMemoryExtraction`에서 `selfNodeId`를 인자로 받지만 실제로는 내부에서 사용하지 않고 공유 헬퍼에도 전달하지 않는다. 해당 사실이 주석에 명시되어 있어 독자가 혼동하지 않도록 처리되어 있다.
  - 위치: `ai-memory-manager.ts:380-382`
  - 제안: 인터페이스 명확성을 위해 장기적으로는 이 파라미터를 제거하거나, 헬퍼가 추적 목적으로 수용하도록 변경하는 것을 고려할 수 있다. 현 상태에서는 "동작 보존" 범위 내이므로 INFO 수준이다.

- **[INFO]** `recalled` 변수가 `let`으로 선언된 후 try/catch 내에서 할당된다. `[]` 초기값을 갖는 패턴은 catch 절에서 재할당이 사실상 중복이다. 사소한 스타일 관찰이며 동작에는 영향이 없다.
  - 위치: `ai-memory-manager.ts:159-207`
  - 제안: 초기값 `[]`를 `const recalled = ...` + try/catch 내 `return` 혹은 값 재사용 패턴으로 리팩토링 가능하나, 현 코드베이스 스타일과 일치하는 방식이라면 현상 유지도 무방하다.

- **[INFO]** `mode` 변수(`'messages' | 'system_text'`)가 함수 중반부(285번째 줄)에 선언되어 있어 실제 사용 시점(317번째 줄)과 떨어져 있다. `system-only` early return 이후에 선언해도 동작은 동일하나, 현 위치는 함수 흐름상 `tokenBudgetUsed` 계산 직전이라 일관성이 있다.
  - 위치: `ai-memory-manager.ts:285-287`

---

### AiAgentHandler 변경 (`ai-agent.handler.ts`)

- **[INFO]** 핸들러에서 3개 메서드(`resolveMemoryStrategy`, `injectMemoryContext`, `scheduleMemoryExtraction`)가 `this.memoryManager.*` 위임으로 교체되었다. 호출부 변경이 기계적이고 일관성이 있다.
  - 위치: diff 전체 (라인 490, 499, 508, 526, 544, 562)

- **[INFO]** 생성자에서 `memoryManager`를 `new AiMemoryManager(...)` 로 직접 생성하는 패턴은 `conditionEvaluator = new AiConditionEvaluator()` 선례와 동형이다. 코드베이스 내 일관성이 유지된다.
  - 위치: `ai-agent.handler.ts:542-144` (생성자 블록)

- **[INFO]** `memoryManager` 필드 선언의 doc-comment(라인 122-127)가 상세하며 책임 범위, 생성자 주입 방식, manual 전략 비관여 원칙을 명확히 기술한다.

---

## 요약

이번 변경은 `AiAgentHandler` god-handler에서 메모리 관리 로직을 `AiMemoryManager` 무상태 collaborator로 추출한 behavior-preserving 리팩토링이다. 유지보수성 관점에서 가장 두드러진 우려는 `injectMemoryContext` 함수의 길이와 책임 과부하로, 약 205줄에 걸쳐 5단계 파이프라인을 단일 함수에서 처리한다. 다만 각 단계를 인라인 섹션 주석으로 명확히 구분하고 있으며, 변수명과 JSDoc이 충실해 현 상태에서 가독성이 완전히 붕괴된 수준은 아니다. 네이밍은 코드베이스 컨벤션을 준수하고, 중복 코드는 없다. `selfNodeId` 미사용 파라미터와 `getThread`/`getThreadExcludingNode` 이중 호출은 주석 보완이 되어 있어 즉각적인 위험은 낮다. 전반적으로 이전 핸들러 대비 유지보수성이 개선되었으나, `injectMemoryContext` 내부 단계별 헬퍼 분리는 후속 작업에서 검토할 것을 권장한다.

## 위험도

LOW
