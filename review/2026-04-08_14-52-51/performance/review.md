### 발견사항

---

- **[CRITICAL]** `setTimeout` 핸들 미정리 — 타이머 누적 및 메모리 누수
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` while 루프
  - 상세: 매 턴마다 새 `setTimeout`을 생성하지만 반환 핸들을 저장하지 않아 `clearTimeout` 불가. Promise가 정상 resolve된 후에도 타이머가 최대 `turnTimeout`(기본 1800초)까지 메모리에 잔류. 동시 세션 수 × 턴 수만큼 좀비 타이머가 누적되며, 이전 타이머가 다음 턴의 `pendingContinuations` 항목을 삭제하는 hang 버그도 동반.
  - 제안:
    ```typescript
    const userData = await new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingContinuations.has(executionId)) {
          this.pendingContinuations.delete(executionId);
          resolve({ type: 'ai_timeout' });
        }
      }, timeoutMs);
      this.pendingContinuations.set(executionId, { nodeId: node.id, resolve, reject, timeoutId });
    });
    // continueAiConversation / endAiConversation에서:
    clearTimeout(pending.timeoutId);
    ```

---

- **[WARNING]** 매 턴 `llmService.resolveConfig` 재호출 — 불변 데이터 반복 I/O
  - 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` (~line 270)
  - 상세: `llmConfigId`와 `workspaceId`는 대화 내내 변경되지 않으나 사용자 메시지가 들어올 때마다 DB/캐시 조회가 발생. 10턴 대화라면 10회 반복.
  - 제안: `executeMultiTurn`에서 resolved llmConfig의 필수 필드(endpoint, apiKey 등)를 `_multiTurnState`에 직렬화하여 캐싱, `processMultiTurnMessage`에서 재사용.

---

- **[WARNING]** 매 턴 `buildTools` 재계산 — 불필요한 반복 연산
  - 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` (~line 293)
  - 상세: `toolNodeIds`/`toolOverrides`는 대화 중 불변임에도 매 턴 tool 배열을 재구성. 도구 수가 많을수록 overhead 증가. 추가로 현재 `_multiTurnState`에 `toolNodeIds`/`toolOverrides`가 포함되지 않아 실제로는 항상 빈 배열이 반환되는 기능 버그도 동반.
  - 제안:
    ```typescript
    // executeMultiTurn의 _multiTurnState에 추가:
    _multiTurnState: {
      ...
      toolNodeIds: config.toolNodeIds || [],
      toolOverrides: config.toolOverrides || [],
      tools: this.buildTools(config), // 최초 1회만 계산
    }
    // processMultiTurnMessage에서 state.tools를 직접 사용
    ```

---

- **[WARNING]** 핸들러 레지스트리 룩업이 while 루프 내 두 분기에서 반복
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` while 루프 내 `ai_end_conversation`, `ai_message` 분기 각각
  - 상세: `this.handlerRegistry.get('ai_agent') as unknown as AiAgentHandler`가 루프 반복마다 Map 조회 + 이중 캐스팅으로 실행됨.
  - 제안: 루프 진입 전 한 번만 추출:
    ```typescript
    const handler = this.handlerRegistry.get('ai_agent') as unknown as AiAgentHandler;
    while (!conversationEnded) { ... }
    ```

---

- **[WARNING]** 전체 `messages` 배열을 매 이벤트마다 직렬화 전송 — O(n²) 통신 비용
  - 위치: `execution-engine.service.ts` — `waitForAiConversation()` 내 `execution.ai_message` 및 `execution.waiting_for_input` 이벤트 emit
  - 상세: 매 턴 두 WebSocket 이벤트 모두 전체 `messages` 배열을 포함. 턴이 쌓일수록 단일 이벤트 크기가 선형 증가(O(n) per turn), 총 전송량은 O(n²). `maxTurns=0` 무제한 설정 시 수십 KB 이상의 페이로드 발생 가능.
  - 제안: `execution.ai_message`에는 최신 응답 메시지만 포함하고 클라이언트가 누적 관리. `execution.waiting_for_input`에도 전체 대신 최근 N개(예: 최근 10턴)만 포함하는 방식 검토.

---

- **[WARNING]** 매 턴 `_multiTurnState` 전체 shallow copy — 증가하는 배열 비용
  - 위치: `ai-agent.handler.ts` — `processMultiTurnMessage()` 반환값 (`{ ...state, messages, ... }`)
  - 상세: spread 연산으로 state 전체를 복사하며, `ragSources`는 `[...ragSources, ...ragContext.sources]`로 누산. 대화가 길어질수록 복사 비용과 메모리 사용량이 함께 증가. 동일 문서가 여러 턴에 걸쳐 중복 포함될 수 있음.
  - 제안: `ragSources`를 Set 기반으로 dedup하거나 최근 N턴분만 보관. state 중 변경되는 필드만 명시적 갱신.

---

- **[WARNING]** `executeMultiTurn`에서 토큰 카운팅 불완전 — 중간 tool call 토큰 누락
  - 위치: `ai-agent.handler.ts` — `executeMultiTurn()` tool call 루프 이후 `totalInputTokens = result.usage.inputTokens`
  - 상세: tool call 루프에서 여러 번 LLM을 호출하지만 마지막 `result.usage`만 기록. 중간 호출 토큰이 누락되어 메타데이터 집계 오류 발생. `processMultiTurnMessage`도 동일.
  - 제안: 루프 내에서 `+=` 누산 방식으로 변경:
    ```typescript
    totalInputTokens += result.usage.inputTokens;
    totalOutputTokens += result.usage.outputTokens;
    ```

---

- **[INFO]** `execution.submit_message`에 rate limiting 없음
  - 위치: `websocket.gateway.ts` — `handleSubmitMessage()`
  - 상세: 단일 연결에서 메시지를 연속 전송하면 각 메시지가 LLM API 호출을 유발. 기존 `pendingContinuations` 구조상 첫 메시지 처리 중에는 "No pending continuation" 오류로 차단되지만, 의도적 스팸에는 취약하며 LLM API 비용 폭증 위험이 있음.
  - 제안: executionId당 최소 처리 간격(예: 1초) 쓰로틀링 추가.

---

### 요약

Multi Turn AI 대화 구현의 핵심 성능 위험은 **타이머 누수**와 **불변 데이터에 대한 매 턴 반복 I/O**에 집중된다. `setTimeout` 핸들 미정리는 장기 운영 시 수백 개의 좀비 타이머를 누적시키고 대화 hang 버그를 동반하여 즉시 수정이 필요하다. `llmService.resolveConfig`와 `buildTools`의 매 턴 재호출은 불변 데이터에 대한 반복적인 I/O와 연산 낭비이며, 전체 `messages` 배열을 매 이벤트마다 직렬화 전송하는 구조는 대화가 길어질수록 O(n²) 통신 비용을 초래한다. 핸들러 레지스트리 룩업의 루프 내 반복은 상대적으로 경미하나 불필요한 연산이다. 타이머 누수를 제외한 나머지 이슈들은 동시 세션 수와 대화 길이가 증가함에 따라 점진적으로 문제가 가시화될 것이다.

### 위험도
**HIGH**