### 발견사항

---

- **[CRITICAL]** `setTimeout` 핸들 미정리 — 타이머 누수
  - 위치: `execution-engine.service.ts`, `waitForAiConversation` 내 while 루프
  - 상세: 매 턴마다 새 `setTimeout`을 생성하지만 반환된 핸들을 저장하지 않아 `clearTimeout`을 호출할 수 없음. Promise가 정상 resolve되어도 타이머는 최대 `turnTimeout`(기본 1800초)까지 메모리에 잔류. 동시 대화 세션이 수십 개라면 수백 개의 좀비 타이머가 누적됨
  - 제안:
    ```typescript
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const userData = await new Promise<unknown>((resolve, reject) => {
      this.pendingContinuations.set(executionId, { nodeId: node.id, resolve, reject });
      timeoutHandle = setTimeout(() => {
        if (this.pendingContinuations.has(executionId)) {
          this.pendingContinuations.delete(executionId);
          resolve({ type: 'ai_timeout' });
        }
      }, timeoutMs);
    });
    clearTimeout(timeoutHandle!);
    ```

---

- **[WARNING]** 매 턴 `llmService.resolveConfig` 호출 — 반복 DB/캐시 룩업
  - 위치: `ai-agent.handler.ts`, `processMultiTurnMessage` (line ~270)
  - 상세: 사용자 메시지가 들어올 때마다 `resolveConfig(llmConfigId, workspaceId)`를 호출. `llmConfigId`와 `workspaceId`는 대화 내내 불변이므로 매 턴 재조회는 낭비. 10턴 대화라면 10번 호출됨
  - 제안: `_multiTurnState`에 resolved llmConfig 객체를 저장하거나, 첫 실행 결과의 `llmConfig` (model, endpoint 등 필요한 필드)를 state에 직렬화해 보관

---

- **[WARNING]** 매 턴 `buildTools` 재계산 — 불필요한 반복 연산
  - 위치: `ai-agent.handler.ts`, `processMultiTurnMessage` (line ~293)
  - 상세: `toolNodeIds`와 `toolOverrides`는 대화 중 변경되지 않음에도 매 턴 `buildTools(state)`를 호출해 tool 배열을 재구성. 도구 수가 많을수록 overhead 증가
  - 제안: `executeMultiTurn`에서 tools 배열을 `_multiTurnState`에 캐싱:
    ```typescript
    _multiTurnState: {
      ...
      tools: this.buildTools(config),  // 최초 1회 계산
    }
    ```

---

- **[WARNING]** 핸들러 레지스트리 룩업이 루프 내부에서 반복
  - 위치: `execution-engine.service.ts`, `waitForAiConversation` while 루프 내 두 곳
  - 상세: `this.handlerRegistry.get('ai_agent')`가 `ai_end_conversation` 분기와 `ai_message` 분기 각각에서 호출됨. 루프 반복마다 Map 조회 + 타입 캐스팅이 발생
  - 제안: 루프 진입 전 한 번만 추출:
    ```typescript
    const handler = this.handlerRegistry.get('ai_agent') as unknown as AiAgentHandler;
    while (!conversationEnded) { ... }
    ```

---

- **[WARNING]** 전체 messages 배열을 매 이벤트마다 직렬화 전송 — 대역폭/메모리 증가
  - 위치: `execution-engine.service.ts`, `waitForAiConversation` 내 `execution.ai_message` 이벤트 + `execution.waiting_for_input` 이벤트
  - 상세: 매 턴 두 개의 WebSocket 이벤트 모두 전체 `messages` 배열을 포함. 턴이 쌓일수록 직렬화 크기가 선형 증가(O(n) per turn → O(n²) total). `maxTurns=0`(무제한) 설정 시 대화가 길어지면 단일 이벤트가 수십 KB가 될 수 있음
  - 제안: `execution.ai_message`에는 최신 응답 메시지만 포함하고, `messages` 전체는 클라이언트가 누적 관리하도록 설계 변경. 또는 `execution.waiting_for_input`에만 포함하고 `execution.ai_message`에서 제거

---

- **[WARNING]** 매 턴 `_multiTurnState` 전체 스프레드 복사
  - 위치: `ai-agent.handler.ts`, `processMultiTurnMessage` 반환값 (line ~340)
  - 상세: `{ ...state, messages, turnCount, ... }` 패턴으로 매 턴 state 전체를 얕은 복사. `messages` 배열이 커질수록 복사 비용 증가. 또한 `ragSources`가 턴마다 누적되는 구조(`[...ragSources, ...ragContext.sources]`)라 대화가 길어질수록 메모리 사용량 증가
  - 제안: ragSources는 최근 N턴만 보관하거나 별도 집계 카운터로 관리

---

- **[INFO]** `execution.submit_message`에 rate limiting 없음
  - 위치: `websocket.gateway.ts`, `handleSubmitMessage`
  - 상세: 인증된 클라이언트가 메시지를 빠르게 연속 전송하면 각 메시지가 LLM 호출을 유발. 기존 `pendingContinuations` 구조상 첫 메시지가 resolve한 후 다음 대기 Promise가 등록되기 전 사이에 두 번째 메시지가 오면 `No pending continuation` 에러로 처리되긴 하나, 고의적 스팸에 취약
  - 제안: WebSocket 레벨 rate limiting 미들웨어 또는 클라이언트별 마지막 전송 시각 추적

---

### 요약

Multi-Turn AI 대화 구현의 핵심 성능 위험은 **타이머 누수**와 **매 턴 반복되는 불필요한 연산**에 있다. `setTimeout` 핸들 미정리는 장기 운영 시 수백 개의 좀비 타이머를 누적시키며, `llmService.resolveConfig`와 `buildTools`의 매 턴 재호출은 불변 데이터에 대한 반복 I/O를 발생시킨다. 또한 전체 `messages` 배열을 매 이벤트마다 직렬화해 전송하는 구조는 대화가 길어질수록 O(n²) 통신 비용을 초래한다. 타이머 누수는 즉시 수정이 필요하며, 나머지 이슈들은 동시 세션 수와 대화 길이가 증가함에 따라 점진적으로 성능 저하를 유발할 수 있다.

### 위험도

**HIGH**