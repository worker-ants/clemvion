## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `runProviderTool` 내 `turnIndex` 하드코딩**
- 위치: `ai-agent.handler.ts`, single-turn path — `turnIndex: 1`
- 상세: single-turn 실행 경로에서 `turnIndex: 1`이 하드코딩되어 있음. multi-turn 경로는 올바르게 `turnCount`를 전달하는데, 단일 호출 경로와의 불일치가 향후 혼란을 야기할 수 있음.
- 제안: `const SINGLE_TURN_INDEX = 1`로 상수화하거나, 단일 turn 경로에서도 명시적으로 `turnCount` 변수를 사용하도록 통일.

---

**[WARNING] `toolCallTraces` 배열이 두 곳에서 독립 선언됨 (중복)**
- 위치: `ai-agent.handler.ts` — single-turn `execute` 함수(~L415)와 multi-turn resume 함수(~L812) 각각 `const toolCallTraces: ToolCallTrace[] = []` 선언
- 상세: 두 경로의 `toolCallTraces` 누적 → spread → turnDebug 주입 로직이 완전히 동일. 각각 3회씩 spread 패턴 `...(toolCallTraces.length > 0 ? { toolCalls: [...toolCallTraces] } : {})` 반복됨 (총 5회).
- 제안: `buildTurnDebug(traces, ...기존파라미터)` 같은 헬퍼로 turnDebug 객체 구성 로직 추출하면 변경 시 단일 지점만 수정하면 됨.

---

**[WARNING] `tryParseJson` 함수 두 파일에 중복 정의**
- 위치: `use-execution-events.ts` (신규 추가), `conversation-utils.ts` (기존 존재)
- 상세: 동일한 함수가 두 파일에 각각 정의되어 있음. 변경 시 양쪽 수정 필요.
- 제안: `conversation-utils.ts` 또는 별도 `json-utils.ts`에서 export 후 `use-execution-events.ts`에서 import.

---

**[WARNING] `handleToolCallCompleted`의 `patch` 타입이 `Record<string, unknown>`**
- 위치: `use-execution-events.ts`, `handleToolCallCompleted` 콜백
- 상세: `updateToolItem`의 매개변수 타입은 `Partial<ConversationItem>`인데, `patch` 변수를 `Record<string, unknown>`으로 선언 후 동적으로 속성을 추가함. 타입 안전성이 없고, `ConversationItem`에 없는 키도 silently 허용됨.
- 제안: `const patch: Partial<ConversationItem> = { toolStatus: ..., toolResult: ... }`로 타입 직접 사용.

---

**[INFO] `nodeId`가 `ExecutionContext`에 optional로 추가되었으나 fallback이 빈 문자열**
- 위치: `ai-agent.handler.ts` — `nodeId: context.nodeId ?? ''`, `nodeId: (state.nodeId as string | undefined) ?? ''`
- 상세: `runProviderTool`의 `nodeId` 파라미터가 `string` (non-optional)인데, 실제로는 `''`이 들어올 수 있음. 이 경우 WS 이벤트의 `nodeId` 필드가 빈 문자열이 되어 클라이언트가 잘못 라우팅할 수 있음.
- 제안: `runProviderTool`의 `nodeId`를 `string | undefined`로 변경하고, WS emit 시 존재하는 경우만 포함하도록 조건부 처리.

---

**[INFO] `setConversationMessages` 내 선택 인덱스 보존 로직**
- 위치: `execution-store.ts`, `setConversationMessages`
- 상세: 기능 자체는 올바르나, snapshot으로 교체 시 이전 pending tool item이 다른 인덱스로 이동할 수 있어 사용자가 선택한 항목이 달라질 수 있음. 현재 길이 기반 체크만으로는 항목 동일성 보장 불가.
- 제안: 단기적으로는 현재 구현으로 충분하나, 향후 `toolCallId` 기반 선택 인덱스 복원 고려.

---

**[INFO] `ai_message` 이벤트 처리에서 `execution.waiting_for_input`과의 디버그 파싱 경로 이원화**
- 위치: `use-execution-events.ts`, `handleWaitingForInput` 내 `turnDebug` 파싱 vs `handleAiMessage` 내 `debugByTurn` 구성
- 상세: 두 이벤트 핸들러 모두 `messagesToConversationItems`를 호출하지만, `debugByTurn` Map 구성 방식이 다름. `waiting_for_input`은 단일 turn 진입점을 가정하고 hardcode하는 반면, `ai_message`는 `payload.turnCount`를 사용함. 향후 multi-turn waiting 시나리오에서 불일치 가능.
- 제안: `buildDebugByTurnFromPayload(payload)` 헬퍼로 추출하여 두 경로가 동일한 로직 공유.

---

**[INFO] `KbToolProvider.execute` — 성공 경로에 `status` 필드 미설정**
- 위치: `kb-tool-provider.ts`, `execute` 메서드의 성공 반환 경로 (마지막 `return` 문)
- 상세: 오류 경로에는 `status: 'error'`가 명시되어 있지만, 성공 경로에는 `status`가 없음. 핸들러가 `result.status ?? 'success'`로 폴백 처리하지만, 인터페이스를 읽는 사람에게 일관성이 떨어짐.
- 제안: 성공 경로에도 `status: 'success'`를 명시하거나, 인터페이스 JSDoc에 "미설정 시 success로 간주" 의도가 이미 있으므로 현행 유지 중 하나를 팀 컨벤션으로 정함.

---

### 요약

전체적으로 변경사항은 잘 구조화되어 있고, `runProviderTool`로 텔레메트리 로직을 추출한 점, `messagesToConversationItems`를 live/history 양쪽에서 공유한 점, 그리고 `upsertToolItem`/`updateToolItem`으로 store 연산을 명확히 분리한 점은 유지보수성 측면에서 긍정적이다. 주요 우려사항은 `toolCallTraces` 누적·주입 패턴이 두 실행 경로에 걸쳐 5회 반복되는 중복, `tryParseJson` 함수의 이중 정의, 그리고 `handleToolCallCompleted`의 느슨한 타입 처리이며, 이들은 중간 복잡도의 유지보수 부채를 형성한다. 나머지 발견사항은 낮은 위험도의 일관성 개선사항이다.

### 위험도

**LOW**