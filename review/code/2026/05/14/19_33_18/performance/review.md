## 발견사항

---

### [WARNING] `applyCap()` step 3 — while 루프 내 `slice(1)` 반복으로 O(n²) 패턴

- **위치**: `thread-renderer.ts` — `applyCap()` 함수 step 3 while loop
- **상세**: 합산 char cap 제거 시 `kept = kept.slice(1)`을 루프 안에서 반복 호출함. 각 `slice(1)`은 새 배열을 O(n) 비용으로 생성하므로 전체 복잡도는 O(n²). MAX_INJECTED_TURNS=100, MAX_INJECTED_CHARS=200,000 기준 최악의 경우(100턴 × 4,000자 = 400,000자) 약 50회 반복, 회당 최대 100개 원소 복사 → 5,000번 원소 이동. 현 제한 범위에서 큰 부하는 아니지만 antipattern이며 향후 상수 변경 시 부담이 커짐.
- **제안**:
  ```typescript
  // 인덱스 포인터로 O(n) 처리
  let startIdx = 0;
  while (totalChars > MAX_INJECTED_CHARS && startIdx < kept.length) {
    totalChars -= kept[startIdx].text.length;
    startIdx++;
    dropped++;
  }
  const finalKept = kept.slice(startIdx); // 단 1회 slicek
  ```

---

### [WARNING] `buildThreadView()` — 모든 expression 평가 시 전체 thread를 문자열로 즉시 렌더링

- **위치**: `expression-resolver.service.ts` — `buildThreadView()` → `renderThreadAsSystemText()` 호출
- **상세**: `buildExpressionContext()`는 노드 설정의 `{{expression}}`마다 호출됨. 그 안에서 `renderThreadAsSystemText(thread.turns)`를 무조건 실행하여 thread 전체를 문자열로 변환함. 노드 config에 expression이 10개 있고 thread에 50턴이 있다면, 해당 노드 실행 시 50턴 렌더링이 10번 발생. turns당 평균 100자로 가정해도 노드 1개당 50KB×10=500KB 문자열 생성. `$thread.text`를 실제로 참조하지 않는 expression이 대부분인 일반 워크플로에서 완전히 낭비되는 연산.

  코드 내 주석도 이를 인지하고 있음("Lazy via getter would be ideal"):
  ```typescript
  // evaluate()가 객체를 직렬화할 수 있어 pre-compute 선택
  text: renderThreadAsSystemText(thread.turns),
  ```

- **제안**: expression 평가 라이브러리가 getter를 직렬화하는지 확인하고, 가능하면 lazy getter로 전환. 불가능한 경우라도 `$thread.text`를 별도 symbol/key로 분리하여 명시적으로 요청될 때만 렌더링:
  ```typescript
  // 방법 1: Object.defineProperty로 lazy getter
  const view = { turns: thread.turns, length: thread.turns.length };
  Object.defineProperty(view, 'text', {
    get: () => renderThreadAsSystemText(thread.turns),
    enumerable: true,
  });
  
  // 방법 2: ExpressionResolverService가 빈 문자열을 기본으로,
  // $thread.text 참조가 감지될 때만 렌더링 (expression AST 분석 필요)
  ```

---

### [INFO] `lastN()` — `turns.length <= n` 분기에서 불필요한 배열 복사

- **위치**: `conversation-thread.service.ts` — `lastN()` 메서드
- **상세**: `turns.length <= n`일 때 `[...turns]`로 전체 배열을 복사함. `readonly` 반환 타입과 불변성 보장 의도는 이해하나, 서비스가 이미 `appendInternal()`을 통해서만 push를 허용하므로 turns 참조를 그대로 반환해도 내부 상태는 보호됨.
- **제안**: 호출 빈도가 낮으면 무시 가능. 빈번히 호출되는 hot path라면 `as readonly ConversationTurn[]` 캐스트로 복사 제거 고려.

---

### [INFO] `injectThreadContext()` messages 모드 — 시스템 메시지 존재 여부와 무관하게 `messages.map()` 실행

- **위치**: `ai-agent.handler.ts` — `injectThreadContext()`, system_text 브랜치
- **상세**: system_text 모드에서 `args.messages.map((m) => m.role === 'system' ? {...} : m)`으로 전체 messages 배열을 순회하여 새 배열을 생성함. 시스템 메시지가 없는 경우도 전체 순회 후 새 배열을 반환.
- **제안**: 시스템 메시지 인덱스를 먼저 찾고 없으면 원본 배열 그대로 반환:
  ```typescript
  const sysIdx = args.messages.findIndex(m => m.role === 'system');
  if (sysIdx === -1) return { messages: args.messages, ... };
  const newMessages = [...args.messages];
  newMessages[sysIdx] = { ...newMessages[sysIdx], content: newSystemPrompt };
  ```

---

## 요약

이번 변경은 ConversationThread를 실행 컨텍스트에 통합하는 작업으로, 대부분의 설계는 적절하다. `ConversationThreadService`의 단일 진입점 패턴, `totalChars` 캐시로 cap 판단을 O(1)에 처리하는 구조, 백그라운드 잡의 turns 배열 shallow clone 격리 등은 성능 관점에서 좋은 선택이다. 그러나 **`expression-resolver`에서 `$thread.text`를 모든 expression 평가 시 즉시 렌더링하는 부분이 가장 큰 실질적 비용 요소**로, thread 길이가 길어지고 expression이 많은 워크플로에서 반복 렌더링 부담이 누적된다. `applyCap()`의 while 루프 내 `slice(1)` 패턴은 현재 상수(n≤100) 기준으로 수치 부담은 작지만 antipattern으로 교체가 권장된다.

## 위험도

**MEDIUM**