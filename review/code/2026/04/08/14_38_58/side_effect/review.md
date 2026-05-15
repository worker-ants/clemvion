## 코드 리뷰: 부작용(Side Effect) 분석

### 발견사항

---

#### execution-engine.service.ts

- **[WARNING]** `messages` 배열 직접 변이(mutation)
  - 위치: `waitForAiConversation` → `ai_message` 처리 블록
  - 상세: `processMultiTurnMessage` 내부에서 `messages.push(...)` 호출이 `state.messages`를 참조로 직접 수정함. `multiTurnState`는 `nodeOutput._multiTurnState`를 가리키므로 `nodeOutputCache`에 저장된 원본 객체가 함께 변이됨. 루프 내에서 `multiTurnState = resultObj._multiTurnState`로 교체하지만, 첫 번째 메시지 처리 전까지 원본 배열이 오염될 수 있음.
  - 제안: `processMultiTurnMessage` 진입 시 `messages: [...state.messages]`로 shallow copy 후 작업하거나, 핸들러 내에서 불변 방식으로 새 배열을 생성할 것.

- **[WARNING]** `setTimeout` leak 가능성
  - 위치: `waitForAiConversation` Promise 생성 블록 (약 line 800)
  - 상세: `setTimeout` 콜백에서 `pendingContinuations.has(executionId)` 확인 후 삭제하지만, `clearTimeout`이 없음. `continueAiConversation`/`endAiConversation`이 먼저 호출되어 Promise가 resolve된 후에도 타이머가 계속 실행됨. 타이머가 만료될 때 `pendingContinuations`에 해당 키가 없으면 무시되긴 하지만, 타이머 참조가 메모리에 남음.
  - 제안: `const timerId = setTimeout(...)`으로 참조를 캡처하고, Promise resolve 시 `clearTimeout(timerId)` 호출.

- **[WARNING]** `nodeExec` 변수의 클로저 캡처 후 재사용
  - 위치: `waitForAiConversation` 함수 말미 (`nodeExec.status = NodeExecutionStatus.COMPLETED`)
  - 상세: 루프가 여러 턴 진행되는 동안 `nodeExec` 객체는 DB에서 한 번만 조회된 상태로 유지됨. 동시에 다른 요청이 해당 `nodeExec`를 수정했을 경우 덮어쓰기 위험. 특히 `finishedAt`과 `durationMs` 계산이 루프 시작 시점의 `startedAt`을 기준으로 하므로 실제 대화 시간을 반영함 — 이는 의도된 동작이나 문서화 필요.

- **[INFO]** `buildTools(state)` 호출 — `state` 타입 재사용
  - 위치: `processMultiTurnMessage` 내 `buildTools(state)` 호출
  - 상세: `buildTools`는 `Record<string, unknown>` 타입을 받는데, `state` 객체에는 `toolNodeIds`/`toolOverrides`가 없을 수 있음. `buildTools` 내부에서 `|| []`로 방어하므로 런타임 오류는 없지만, 도구 호출이 무력화될 수 있음.
  - 제안: `_multiTurnState`에 `toolNodeIds`/`toolOverrides`를 명시적으로 포함하거나, `processMultiTurnMessage` 시그니처에 별도 tools 파라미터 추가.

---

#### ai-agent.handler.ts

- **[CRITICAL]** `messages` 배열 직접 변이 — 공유 참조 오염
  - 위치: `processMultiTurnMessage` 함수 전반
  - 상세: `const messages = state.messages as ChatMessage[]`로 참조만 복사한 후 `messages.push(...)`를 반복 호출. 호출자(`waitForAiConversation`)가 보관 중인 `multiTurnState.messages`와 동일한 객체이므로, 처리 중 예외 발생 시 절반만 변이된 messages가 상태에 남음.
  - 제안:
    ```typescript
    const messages = [...(state.messages as ChatMessage[])];
    ```

- **[WARNING]** `executeMultiTurn`에서 token 카운팅 불일치
  - 위치: `executeMultiTurn` 내 `totalInputTokens = result.usage.inputTokens`
  - 상세: tool call 루프에서 여러 번 LLM을 호출하지만, 마지막 `result.usage`만 기록함. 중간 tool call에서 소비된 토큰이 누락됨. `executeSingleTurn`도 동일한 문제가 있으나 기존 코드이므로 현재 변경 범위에서는 `executeMultiTurn` 신규 도입 시점에 수정 기회를 놓친 것.
  - 제안: tool call 루프 내에서 `totalInputTokens += result.usage.inputTokens` 누산.

- **[INFO]** `ragSources` 중복 누산 가능성
  - 위치: `processMultiTurnMessage`의 `ragSources = [...ragSources, ...ragContext.sources]`
  - 상세: 매 턴마다 RAG 소스를 누산하면 동일 문서가 여러 턴에 걸쳐 중복 포함될 수 있음. 최종 출력의 `ragSources`가 불필요하게 커질 수 있음.
  - 제안: Set 기반 dedup 또는 최신 턴의 소스만 기록하는 전략 선택.

---

#### websocket.gateway.ts

- **[WARNING]** `nodeId` 파라미터 미검증
  - 위치: `handleSubmitMessage`, `handleEndConversation`
  - 상세: `data.nodeId`를 받지만 실제 서비스 호출 시 사용하지 않음(`continueAiConversation(executionId, message)`, `endAiConversation(executionId)`). 클라이언트가 잘못된 `nodeId`를 보내도 서버가 감지하지 못하고 성공 응답을 반환함. 악의적 클라이언트가 다른 사용자의 `executionId`를 알면 대화를 가로챌 수 있음.
  - 제안: `executionId`와 `userId`를 매핑하는 권한 검증 추가. 최소한 `pendingContinuations`의 `nodeId`와 요청의 `nodeId`가 일치하는지 확인.

- **[INFO]** 이벤트 반환 방식 불일치
  - 위치: `handleSubmitMessage` 반환값 `event: 'execution.submit_message.ack'`
  - 상세: NestJS `@SubscribeMessage`의 반환 객체 형식이 `{ event, data }` 구조인데, 이는 클라이언트에게 직접 emit되는 방식. 기존 `handleClickButton`과 동일한 패턴이므로 의도된 것으로 보이나, ACK 이벤트가 채널 브로드캐스트가 아닌 해당 클라이언트에게만 전달됨을 확인 필요.

---

#### ai-configs.tsx (Frontend)

- **[INFO]** `mode` 전환 시 기존 값 잔존
  - 위치: `SelectField` onChange 핸들러
  - 상세: `multi_turn`에서 `single_turn`으로 전환해도 `maxTurns`, `turnTimeout` 값이 `config`에 잔존함. 서버의 `validate`에서 `mode !== 'multi_turn'`일 때 해당 필드를 무시하므로 런타임 오류는 없지만, 불필요한 데이터가 저장됨.
  - 제안: 의도된 설계라면 무시. 깔끔하게 하려면 mode 전환 시 관련 필드를 정리하는 핸들러 추가.

---

### 요약

이번 변경의 핵심 부작용 위험은 **`messages` 배열의 공유 참조 변이**다. `processMultiTurnMessage`에서 `state.messages`를 복사 없이 직접 `push`하므로, 처리 중 예외 발생 시 실행 컨텍스트의 `nodeOutputCache`에 저장된 원본 상태가 절반만 변이된 채 오염된다. 또한 WebSocket 핸들러에서 `nodeId`를 받지만 권한 검증 없이 `executionId`만으로 대화를 제어할 수 있어, 동일 서버에 접속한 인증된 사용자라면 타인의 AI 대화 세션을 종료시킬 수 있는 권한 검증 누락이 있다. `setTimeout` 미정리는 장시간 실행 서버에서 타이머 누적을 야기할 수 있다. 나머지 항목들은 토큰 카운팅 부정확, RAG 소스 중복 등 데이터 품질 문제로 기능적 오류는 아니다.

### 위험도

**MEDIUM** — 공유 참조 변이와 권한 검증 누락이 존재하나, 현재 단일 테넌트/신뢰된 클라이언트 환경에서는 실제 exploitable 위험이 낮음. 프로덕션 멀티테넌트 환경 전에 반드시 수정 필요.