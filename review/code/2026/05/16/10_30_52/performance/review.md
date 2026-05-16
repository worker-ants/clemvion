# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `withSourceMarker` 함수: 매 호출마다 배열 전체를 `.map()` 으로 순회하며 객체 스프레드(`{ ...m, source: 'live' }`) 를 수행함
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` L96–104 (`withSourceMarker`)
  - 상세: `messagesAll.filter((m) => m.role !== 'system')` 이후 즉시 `withSourceMarker(...)` 를 체이닝하여 배열을 두 번 순회한다. 일반적인 대화 메시지 수(수십 건 수준)에서는 무시할 수 있는 수준이나, 매우 긴 multi-turn 컨텍스트(수백 턴 이상)에서는 두 번의 전체 순회와 각 메시지마다 스프레드 연산이 발생한다. `.filter().map()` 대신 단일 `.reduce()` 또는 for 루프로 병합하면 순회 횟수를 절반으로 줄일 수 있다.
  - 제안: 두 곳(`buildConversationConfigFromOutput`, `ExecutionEngineService` 내 `condMessages` 계산) 모두 단일 순회로 통합. 예:
    ```ts
    messages: messagesAll.reduce<Array<Record<string, unknown>>>((acc, m) => {
      if (m.role === 'system') return acc;
      acc.push(m.source === 'injected' || m.source === 'live' ? m : { ...m, source: 'live' as const });
      return acc;
    }, [])
    ```

- **[INFO]** `LlmService.chat` 에서 매 호출마다 `params.messages.map(({ source, ...rest }) => rest)` 로 메시지 배열 전체를 새 객체로 복사함
  - 위치: `backend/src/modules/llm/llm.service.ts` L222–228 (`sanitized` 생성)
  - 상세: `source` 필드가 없는 메시지(구형 페이로드나 `source` 를 설정하지 않은 경로)에서도 스프레드 복사가 항상 발생한다. 대부분의 메시지에 `source` 가 없거나 이미 제거된 상태라면 불필요한 객체 할당이 메시지 수만큼 발생한다. 또한 `void source;` 패턴은 사용하지 않는 변수를 명시적으로 무효화하는 방법이나, 린터 규칙에 따라 단순히 `const { source: _source, ...rest } = m` 또는 타입 레벨에서 `Omit` 처리가 더 명확하다.
  - 제안: `source` 필드가 실제로 존재하는지 확인 후 조건부로 복사하거나, 인터페이스 레벨에서 LLM 전달용 타입(`Omit<ChatMessage, 'source'>`)을 정의해 컴파일 타임에 처리하는 방식을 고려한다. 실용적으로는 현재 규모(수십~수백 메시지)에서 무시 가능한 수준.

- **[INFO]** `mapTurnsToChatMessages` 에서 모든 `case` 분기마다 객체 리터럴을 생성하며, `source: 'injected'` 를 각 분기에 중복 기술함
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L266–310 (`mapTurnsToChatMessages`)
  - 상세: 변경 전에도 동일한 구조였으나, 이번 변경으로 `source: 'injected'` 가 5개 분기 전체에 추가되어 중복이 증가했다. 기능상 문제는 없으나, 나중에 `source` 필드 이외의 공통 필드 추가 시 모든 분기를 수정해야 하는 유지보수 비용이 생긴다. 성능상으로는 `.map()` 내부의 객체 리터럴 생성이 매 턴마다 발생하므로, 대규모 주입(수백 턴)에서는 GC 압력이 생길 수 있다.
  - 제안: 공통 후처리로 빼는 것을 고려. 예: `return turns.map((t) => ({ ...buildBaseMessage(t), source: 'injected' as const }))`. 현재 규모에서는 성능 임팩트가 낮으므로 코드 정리 관점의 권고.

- **[INFO]** `messagesToConversationItems` (프론트엔드)에서 `items.find()` 를 테스트 코드에서 여러 번 호출하나, 실제 구현 코드는 단일 순회 for 루프로 적절히 구성됨
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` L84 이하 (`messagesToConversationItems`)
  - 상세: 구현 자체는 단일 for 루프로 messages 를 순회하므로 O(n) 복잡도를 유지한다. `isInjected` 조건 분기가 루프 안에 추가되었으나 분기 비용은 무시 가능. `debugByTurn?.get(turn)` Map 조회도 O(1) 이므로 전체 알고리즘 복잡도에 변화 없음.
  - 제안: 현재 구현으로 충분. 추가 최적화 불필요.

- **[INFO]** `turnIndex: currentTurn || 1` 폴백 처리가 루프 내부에서 반복 평가됨
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` L584 (`turnIndex: currentTurn || 1`)
  - 상세: `currentTurn` 이 0인 경우(injected 메시지가 live 메시지보다 먼저 나타날 때)의 폴백으로 `|| 1` 을 사용하는데, 이는 falsy 체크이므로 0일 때만 발동한다. 성능 이슈는 없으나, 동일 패턴이 assistant 블록의 `const turn = currentTurn || 1` 과 중복 존재한다. 이 값을 루프 상단에서 한 번만 계산하는 방식도 가능하나 가독성 우선 상황이므로 현재 방식도 무방.
  - 제안: 의미론적 일관성을 위해 `Math.max(currentTurn, 1)` 로 교체하거나 `turnIndex: currentTurn > 0 ? currentTurn : 1` 로 명시하면 falsy 체크 혼동을 피할 수 있다. 성능 영향 없음.

## 요약

이번 변경은 WebSocket 메시지의 `source` 마커(`'live'` / `'injected'`) 도입으로 구성된 소규모 기능 추가다. 핵심 로직인 `withSourceMarker`, `mapTurnsToChatMessages`, `LlmService` 의 sanitize 처리 모두 O(n) 배열 순회로 동작하며, 고비용 연산(DB 쿼리, 반복 API 호출, 메모리 누수)은 발견되지 않았다. 다만 `filter` + `map` 이중 순회와 `LlmService` 내 무조건적 스프레드 복사는 매우 긴 대화 컨텍스트에서 불필요한 반복 할당을 일으킬 수 있어 INFO 수준으로 기록한다. 캐싱, 블로킹 I/O, N+1 문제, 잘못된 자료구조 사용, 지연 로딩 누락은 해당 없다. 전반적으로 성능 관점에서 안전한 변경이며 현재 규모(수십~수백 메시지)에서는 실질적 임팩트가 없다.

## 위험도

LOW
