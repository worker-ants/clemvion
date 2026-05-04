## 발견사항

### [WARNING] `ai_message` 스냅샷 도착 시 tool 상태 배지 소실

- **위치**: `use-execution-events.ts` — `handleAiMessage` 함수
- **상세**: 멀티턴 흐름에서 `tool_call_started` → `tool_call_completed` 순으로 `pending` → `success/error`로 패치된 tool 아이템이, 직후 도착하는 `ai_message` 의 `setConversationMessages` 호출로 전량 교체된다. `messagesToConversationItems` 호출에 `toolStatusByCallId`가 전달되지 않으므로, 교체 후 tool 아이템의 `toolStatus`는 `undefined`가 된다. 결과적으로 라이브 실행 중 success/error 배지가 일시 표시됐다가 스냅샷 도착과 함께 사라지는 UX 결함이 발생한다.

  ```typescript
  // handleAiMessage — toolStatusByCallId 누락
  const items = messagesToConversationItems(payload.messages, {
    debugByTurn,
    metaModel: payload.metadata?.model,
    // toolStatusByCallId: ??? — 전달 경로 없음
  });
  setConversationMessages(items);
  ```

  `execution.waiting_for_input` 핸들러의 초기 시드 경로도 동일 문제.
- **제안**: `ai_message` 페이로드에 `turnDebug.toolCalls`를 포함시키거나, `setConversationMessages` 직전에 현재 store의 `toolCallId` → `toolStatus` 매핑을 추출해 교체 후 재적용하는 후처리를 추가한다. 또는 스냅샷 도착 시 기존 pending/success/error 상태를 `toolCallId` 기준으로 병합하는 별도 로직을 고려한다.

---

### [WARNING] `ai_message` 테스트에서 `toolStatus` 미검증

- **위치**: `use-execution-events.test.ts` — `"ai_message snapshot supersedes prior pending tool items"` 테스트
- **상세**: 위 버그를 잡아낼 수 있는 테스트가 없다. 테스트는 중복 아이템 없음(count == 1)만 검증하며, `tool_call_completed` 이후 `ai_message`가 덮어쓸 때 `toolStatus`가 소실되는지 검증하지 않는다.
- **제안**: 아래 시나리오를 테스트에 추가한다: `toolStarted` → `toolCompleted` → `aiMessage` 순서 후, `conversationMessages`의 tool 아이템에 `toolStatus: 'success'`가 유지되는지 assert.

---

### [WARNING] 멀티턴 resume 경로의 `nodeId` 미보존 가능성

- **위치**: `ai-agent.handler.ts` — 멀티턴 `runProviderTool` 호출부
- **상세**: `nodeId: (state.nodeId as string | undefined) ?? ''` 는 이번 변경 이전에 생성된 resume state에 `nodeId`가 없을 때 `''`을 전달한다. 이 경우 `tool_call_started/completed` 이벤트는 `nodeId: ''`로 발행되며, 프론트엔드가 어느 그래프 노드 소속인지 특정할 수 없다. 주석("Acceptable for activity-tab readability")으로 acknowledged되어 있으나, 기능 요구사항인 "그래프 노드 키로 디버깅 타임라인 렌더링"이 구버전 resume state에서 충족되지 않는다.
- **제안**: 이번 배포 이후 생성된 resume state에만 `nodeId`가 존재하므로, 구 resume state 호환 기간 동안은 허용 가능하다. 단, 이 제한을 스펙 문서 또는 TODO 주석으로 명시하고, 향후 migration 시점을 지정한다.

---

### [INFO] `tryParseJson` 유틸 중복 정의

- **위치**: `conversation-utils.ts:54`, `use-execution-events.ts:12`
- **상세**: 동일한 함수가 두 파일에 독립적으로 정의되어 있다. 로직 변경 시 동기화 누락 위험이 있다.
- **제안**: 공용 유틸 모듈로 추출하거나, `conversation-utils.ts`에서 export하고 `use-execution-events.ts`에서 import하도록 통합한다.

---

### [INFO] `TOOL_CALL_COMPLETED` WS 이벤트에 `content` 전체 포함

- **위치**: `ai-agent.handler.ts` — `runProviderTool` 메서드
- **상세**: `result.content` (LLM에 전달되는 tool_result 전문)를 WS 이벤트에 그대로 포함한다. KB 검색 결과가 크거나 MCP 도구의 응답이 클 경우, WS 채널 트래픽이 증가한다. 현재 프론트엔드는 이를 `toolResult`로 파싱해 인스펙터에 표시하므로 기능상 필요하지만, 대용량 응답에서 부하가 될 수 있다.
- **제안**: 단기적으로는 현 구조 유지가 적절하다. 향후 `content`에 크기 상한 적용 또는 별도 조회 API 제공을 고려한다.

---

### [INFO] 테스트에서 `nodeId` 이벤트 페이로드 미검증

- **위치**: `ai-agent.handler.spec.ts` — `"emits TOOL_CALL_STARTED + TOOL_CALL_COMPLETED"` 테스트
- **상세**: `emittedEvents()` 검증 시 `nodeId` 필드가 포함되지 않는다. `baseContext`에 `nodeId`가 없어 `''`이 전달되므로, nodeId 라우팅 기능이 실제로 동작하는지 테스트로 커버되지 않는다.
- **제안**: `baseContext`에 `nodeId: 'node-123'` 추가 후, `started.payload.nodeId === 'node-123'` assertion을 추가한다.

---

### [INFO] `execution.completed` / `execution.failed` 시 pending tool 아이템 처리 미정의

- **위치**: `use-execution-events.ts` — `handleExecutionCompleted`, `handleExecutionFailed`
- **상세**: `tool_call_started` 이후 실행이 실패하면 `tool_call_completed`가 발행되지 않아 스토어에 `toolStatus: 'pending'` 아이템이 잔류할 수 있다. 이 상태에서 사용자가 타임라인을 보면 무한 스피너가 표시된다.
- **제안**: `handleExecutionFailed` / `handleExecutionCancelled`에서 `pending` 상태인 tool 아이템을 `error`로 일괄 전환하거나, `resetExecution`이 이 경우에도 호출되는지 확인한다.

---

## 요약

이번 변경은 AI Agent 노드의 도구 호출을 디버깅 타임라인에 실시간으로 가시화하는 기능을 구현하며, 백엔드(`runProviderTool` 추출, `turnDebug.toolCalls` 누적, WS 이벤트 발행)와 프론트엔드(store 액션, WS 핸들러, UI 배지)를 일관된 설계로 연결하고 있다. 핵심 기능 요구사항(pending → success/error 전환, 에러 회복 후 LLM 재호출)은 테스트를 포함해 충족되어 있으나, **멀티턴에서 `ai_message` 스냅샷이 도착할 때 tool 상태 배지가 소실되는 기능 결함**이 존재한다. 역사적 뷰(`parseHistoryMessages`)는 `toolStatusMapFromDebug`를 통해 정확하게 동작하지만, 라이브 뷰에서 `ai_message`가 전체 교체할 때 동일 정보가 누락된다. 이 부분을 보완하면 요구사항 완성도가 크게 높아진다.

## 위험도

**MEDIUM**