# 동시성(Concurrency) 리뷰 결과

## 발견사항

### **[WARNING]** `start()` — TOCTOU(Check-Then-Act) 비원자 가드
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `start()` (라인 1387–1409)
- 상세: 가드 체크와 플래그 설정이 두 개의 분리된 문장으로 이루어져 있다.
  ```ts
  if (startedRef.current || sessionRef.current) return;
  startedRef.current = true;
  ```
  JavaScript 단일 스레드 모델에서 동일 이벤트 루프 tick 내의 두 동기 호출이라면 문제가 없다. 그러나 `open()` 이 `void start()` 를 호출하고, 동시에 `newChat()` 도 `void start()` 를 호출하는 경로가 존재한다. 두 호출이 동일 마이크로태스크 체인(같은 React render 배치 또는 `act()` 블록) 안에서 연속으로 실행될 경우, 첫 번째 `start()` 가 `startedRef.current = true` 를 세팅하기 전에 두 번째 `start()` 가 체크를 통과할 수 있다. 이는 테스트 시나리오(`use-widget-eager-start.test.ts` 라인 1029–1031: 동일 `act()` 에서 `open()` 두 번 호출)에서 실제로 검증되었고 통과하고 있으나, `newChat()` → `start()` 와 외부 `open()` 명령이 겹치는 경우는 테스트 커버리지 밖이다.
- 제안: `start()` 함수의 가드 체크와 세팅을 단일 동기 블록으로 분리(이미 단일 함수 내 동기 코드이므로 현 구조도 실용적으로 충분)하되, `newChat()` 에서 `startedRef.current = false` 직후 즉시 `void start()` 를 호출하는 패턴(라인 1470–1472)을 주의해야 한다. `newChat()` 자체가 동기적으로 플래그를 리셋하고 start 를 예약하므로, 외부에서 동시에 `open()` 이 불리면 두 `start()` 가 경쟁할 수 있다. 방어책으로 `newChat()` 내에서 `startedRef.current = false` 세팅 직후, `start()` 본문에서 플래그 세팅 전까지의 간극을 없애려면 `start()` 내의 두 줄을 Promise microtask 분기 전에 완전히 동기로 처리하도록 구조를 유지해야 한다 — 현 구조는 이를 충족하고 있으나, 향후 `start()` 에 `await` 전 비동기 작업이 삽입되면 즉시 경쟁 조건이 발생한다.

### **[WARNING]** `newChat()` — 상태 리셋과 `start()` 사이의 간극
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat()` (라인 1466–1473)
- 상세:
  ```ts
  sessionRef.current = null;
  startedRef.current = false;
  dispatch({ type: "NEW_CHAT" });
  void start();
  ```
  `sessionRef` 를 null 로 리셋한 후 `start()` 가 실행되기 전까지의 동기 구간에, `submitMessage()` 나 `sendCommand()` 가 이미 실행 중인 Promise(토큰 갱신 타이머 콜백, SSE 이벤트 핸들러)에서 `sessionRef.current` 에 새 값을 쓰거나 읽을 수 있다. 특히 `scheduleRefresh` 타이머 콜백은 `sessionRef.current` 를 읽어 갱신된 토큰을 기록하는데, `closeStream()` + `sessionRef.current = null` 이후에도 이미 예약된 `setTimeout` 이 발동할 수 있다(`clearTimeout(refreshTimerRef.current)` 를 호출하지만, `newChat()` 에서 `closeStream()` 을 먼저 호출하고 `clearTimeout` 은 `applyConfig` cleanup 에 의존하는 구조). `newChat()` 이 `refreshTimerRef` 를 직접 클리어하지 않아 timer 콜백이 null 된 `sessionRef` 에 쓰기를 시도할 수 있다.
- 제안: `newChat()` 내에서 `closeStream()` 직후 `refreshTimerRef.current` 도 클리어한다.
  ```ts
  const newChat = useCallback(() => {
    closeStream();
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (configRef.current) clearSession(configRef.current.triggerEndpointPath);
    sessionRef.current = null;
    startedRef.current = false;
    dispatch({ type: "NEW_CHAT" });
    void start();
  }, [closeStream, start]);
  ```

### **[INFO]** `submitMessage()` — 세션 null 체크 시점 래그
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage()` (라인 1430–1438)
- 상세: `if (!sessionRef.current) return;` 체크 후 `dispatch` 및 `void sendCommand(...)` 호출 사이에 `sessionRef.current` 가 null 이 될 가능성은 단일 스레드 특성상 낮다. 그러나 `sendCommand` 내부에서도 `sessionRef.current` 를 재참조하는데, 이미 `submitMessage` 체크 시점에 유효했던 세션이 그 사이 `newChat()` 에 의해 교체될 수는 없다(동기 실행 순서 보장). 이 패턴 자체는 큰 위험이 없으나, 코드의 의도(eager start 이후 세션 없으면 무시)가 주석으로 명시되어 있어 이해에 도움이 된다.
- 제안: 현재 수준으로 충분. INFO 수준 관찰.

### **[INFO]** `openStream()` — 이전 스트림 닫기 후 새 스트림 열기 원자성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream()` (라인 1345–1366)
- 상세: `closeStream()` 후 즉시 새 `EventSource` 를 할당하는 패턴은 브라우저 단일 스레드에서 안전하다. EventSource 이벤트는 macrotask 큐를 통해 도착하므로 닫기-열기 사이 간극에 이벤트가 처리될 가능성은 없다.
- 제안: 현 구조 적절. INFO 수준 관찰.

---

## 요약

이번 변경의 핵심 동시성 우려는 `use-widget.ts` 의 eager start 가드(`startedRef`)와 `newChat()` 의 상태 리셋 흐름에 집중된다. JavaScript 단일 스레드 특성 덕분에 일반적인 경쟁 조건은 발생하지 않으며, `startedRef` 가드는 동일 tick 의 중복 `open()` 호출을 효과적으로 차단한다(테스트로 검증됨). 다만 `newChat()` 이 `refreshTimerRef` 를 직접 클리어하지 않아 이미 예약된 타이머가 null 된 `sessionRef` 에 쓰기를 시도할 수 있는 잠재적 오류 경로가 존재한다(WARNING). 또한 `start()` 의 check-then-set 패턴은 현재 동기 구조에서 안전하지만, 향후 await 삽입 시 즉시 경쟁 조건이 생기는 구조적 취약점을 가지고 있다(WARNING). `widget-state.ts` 는 순수 reducer 패턴으로 동시성 위험이 없고, `eia-client.ts` 는 stateless HTTP/SSE 래퍼로 안전하다.

## 위험도

LOW

---

STATUS=success ISSUES=2
