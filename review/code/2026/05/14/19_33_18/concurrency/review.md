## 발견사항

### **[WARNING]** 병렬 브랜치 간 `seq` 순서 비결정성

- **위치**: `execution-engine.service.ts` + `ParallelExecutor` + `conversation-thread.service.ts:appendInternal`
- **상세**: `appendInternal`의 `seq` 읽기 → push → `nextSeq++` → `totalChars +=` 시퀀스는 완전히 동기이므로 Node.js 단일 스레드 모델에서 데이터 손상은 발생하지 않는다. 그러나 `ParallelExecutor`가 자식 컨텍스트에 부모의 `conversationThread` 참조를 공유한다면, 각 브랜치가 `await` 경계 이후 `append*`를 호출하는 시점은 비결정적이다. `ConversationTurn.seq` 명세 주석("append 순서 == 시간 순서")과 `ConversationThread` SoT가 명시한 불변식이 병렬 실행에서 깨진다.
- **제안**: `ParallelExecutor`에서 자식 컨텍스트를 생성할 때 `conversationThread`를 shallow-clone하거나 (background 격리와 동일 방식), 병렬 완료 후 merge point에서 순서대로 재통합하는 정책을 spec에 명시한다.

---

### **[WARNING]** `getContext(executionId)?.conversationThread` — 정리된 컨텍스트 참조

- **위치**: `execution-engine.service.ts` ~2120번째 라인
  ```ts
  conversationThread:
    this.contextService.getContext(executionId)?.conversationThread,
  ```
- **상세**: `getContext`가 `undefined`를 반환하면 `conversationThread`도 `undefined`가 된다. WebSocket 페이로드 타입이 이를 허용하지 않는 경우 직렬화 오류 또는 프론트엔드 파싱 오류가 발생한다. 컨텍스트 정리와 이 emit 사이의 TOCTOU 간격이 존재한다.
- **제안**: `?? null` 또는 빈 thread 폴백을 추가하거나, 타입을 `ConversationThread | undefined`로 명시 선언해 누락을 컴파일 타임에 잡는다.

---

### **[INFO]** `ConversationTurn` 객체의 불변성 미강제

- **위치**: `execution-engine.service.ts` 배경 스냅샷 생성부
  ```ts
  const threadSnapshot = {
    ...context.conversationThread,
    turns: [...context.conversationThread.turns],
  };
  ```
- **상세**: `turns` 배열은 새 인스턴스로 복사되지만, 배열 내 `ConversationTurn` 객체 자체는 원본·스냅샷 양쪽에서 동일 참조를 가진다. 주석에 "ConversationTurn objects themselves are immutable once pushed"라고 명시되어 있으나 `Object.freeze` 등 런타임 강제 수단이 없다. 핸들러가 실수로 turn 객체를 수정하면 양쪽 흐름이 영향을 받는다.
- **제안**: `appendInternal` 마지막에 `Object.freeze(turn)`을 추가해 push 이후 mutation을 런타임에서 차단한다. 테스트 환경에서는 strict mode가 freeze 위반을 즉시 throw한다.

---

### **[INFO]** `applyCap`의 `while` 루프 — O(n²) 슬라이스

- **위치**: `thread-renderer.ts:applyCap`
  ```ts
  while (totalChars > MAX_INJECTED_CHARS && kept.length > 0) {
    kept = kept.slice(1); // 매 반복 새 배열
    ...
  }
  ```
- **상세**: `slice(1)` 반복은 O(n²). 최악 케이스는 `MAX_INJECTED_CHARS / MAX_TURN_TEXT_CHARS ≈ 50`회이므로 현재 상수값에서는 허용 가능하다. 다만 `MAX_TURN_TEXT_CHARS`를 줄이거나 `MAX_INJECTED_CHARS`를 늘리면 루프 횟수가 급증한다.
- **제안**: `findIndex`로 잘라낼 경계 인덱스를 먼저 계산한 후 단일 `slice`로 처리해 O(n)으로 개선할 수 있다.

---

## 요약

이번 변경은 `ConversationThread`를 실행 컨텍스트에 도입하고 `ConversationThreadService`를 단일 mutation 진입점으로 설계한 구조가 전반적으로 올바르다. Node.js 단일 스레드 모델 하에서 `appendInternal`의 동기적 시퀀스(seq 읽기 → push → nextSeq 증가 → totalChars 갱신)는 데이터 손상 없이 안전하며, background 실행을 위한 `turns` 배열 shallow-clone 격리도 의도한 설계에 맞게 구현되어 있다. 주요 위험은 병렬 브랜치가 동일 `conversationThread` 참조를 공유할 경우 `seq`의 시간 순서 불변식이 깨지는 **논리적 순서 비결정성**과, 컨텍스트 정리 직후 WebSocket emit 시점에 `getContext`가 `undefined`를 반환할 수 있는 TOCTOU 간격이다.

## 위험도

**LOW**