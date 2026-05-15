### 발견사항

- **[INFO]** Zustand 스토어 read-then-write 비원자 패턴
  - 위치: `use-execution-events.ts` — `handleAiMessage` (변경된 섹션)
  - 상세: `useExecutionStore.getState().conversationMessages`를 읽고 `toolStatusMapFromItems`로 변환한 뒤 `setConversationMessages(items)`로 쓰는 패턴은 원자적이지 않다. JavaScript는 단일 스레드이므로 현재는 문제없지만, `handleToolCallCompleted`의 `existing` 체크–`upsertToolItem` 흐름과 동일한 check-then-act 구조가 반복된다. 향후 동일 패턴을 멀티스레드 환경(Web Worker, SharedArrayBuffer 등)에 이식할 경우 취약점이 된다.
  - 제안: 현재 아키텍처 범위 내에서는 안전하지만, Zustand의 `setState` 내부에서 `set(state => ...)` 형태의 함수형 업데이트로 리팩토링하면 read-write 쌍을 하나의 스토어 트랜잭션으로 묶을 수 있다.

- **[INFO]** `flushPromises()` 타이밍 불완전성 (기존 패턴, 이번 변경에서 확장)
  - 위치: `execution-engine.service.spec.ts` — 신규 두 테스트 케이스
  - 상세: `flushPromises()`는 `setImmediate` 기반으로 마이크로태스크 큐만 비운다. `execution-engine.service` 내부에서 `setTimeout` 또는 `setInterval`을 사용하는 경로가 있을 경우 `await flushPromises()` 이후에도 해당 비동기 작업이 미완료 상태로 남아 테스트가 간헐적으로 실패할 수 있다. 특히 `continueAiConversation`이 내부적으로 비동기 핸들러를 트리거하는 경우 두 번째 `flushPromises()` 호출만으로 완전한 정착이 보장되지 않는다.
  - 제안: Jest 환경에서 `jest.useFakeTimers()` 또는 `jest.runAllTimersAsync()`와 함께 사용하거나, `flushPromises`를 `process.nextTick` + 마이크로태스크 복합 드레이너로 교체해 타이밍 의존성을 줄이는 것을 권장한다.

- **[INFO]** `handleAiMessage`에서 `cancelledRef` 미확인
  - 위치: `use-execution-events.ts` — `handleAiMessage` 콜백
  - 상세: `handleSnapshot`은 `cancelledRef.current` 를 확인하지만 `handleAiMessage`, `handleToolCallStarted`, `handleToolCallCompleted` 등은 확인하지 않는다. `useEffect` cleanup에서 `client.off()`로 핸들러를 동기적으로 제거하므로 실제로 문제가 발생하지는 않지만, 이미 큐에 올라간 마이크로태스크가 cleanup 직후에 실행될 경우 언마운트된 컴포넌트의 스토어를 갱신하는 엣지 케이스가 이론적으로 존재한다.
  - 제안: `handleAiMessage` 진입부에 `if (cancelledRef.current) return;` 가드를 추가하면 `handleSnapshot`과 일관성을 맞출 수 있다.

---

### 요약

변경 코드는 단일 스레드 JavaScript 이벤트 루프 위에서 동작하므로 전통적인 의미의 경쟁 조건·데드락·스레드 안전성 문제는 해당 없다. `handleAiMessage`의 Zustand read-write 패턴, `flushPromises` 기반 테스트 타이밍, `cancelledRef` 미확인은 모두 현재 환경에서 실질적 결함을 유발하지 않으나, 코드 일관성과 미래 이식성 측면에서 개선 여지가 있다. 이번 변경의 핵심인 레거시 fallback 제거와 불변 위반 조기 탈출 로직은 동시성 관점에서 안전하다.

### 위험도
**LOW**