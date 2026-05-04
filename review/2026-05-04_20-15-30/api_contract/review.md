### 발견사항

- **[WARNING]** `execution.ai_message` 페이로드에서 기존 필드 제거 — Breaking Change 가능성
  - 위치: `execution-engine.service.ts` diff, `-requestPayload / -responsePayload / -durationMs` 제거 라인
  - 상세: 변경 전 `waiting_for_input` 분기의 `execution.ai_message` 이벤트는 top-level에 `requestPayload`, `responsePayload`, `durationMs`(lastTurnDurationMs 기반)를 직접 포함했다. 변경 후 이 세 필드가 제거되고, 대신 `llmCalls[]` 배열 내부의 각 항목에 `{requestPayload, responsePayload, durationMs}`가 담기는 구조로 전환된다. 프론트엔드가 `payload.requestPayload` 또는 `payload.responsePayload`를 직접 참조하고 있었다면 런타임 오류 없이 `undefined`를 읽게 된다.
  - 제안: 프론트엔드 소비 코드를 확인해 `payload.requestPayload` / `payload.responsePayload` 직접 접근 여부를 점검할 것. 해당 필드가 스펙에 없던 undocumented 필드였다면 위험도는 낮지만, 실제 UI 탭(Response/Request)이 이를 읽고 있었을 가능성이 높다.

- **[WARNING]** `terminal emit` 분기의 동일 변경 여부 미확인
  - 위치: `execution-engine.service.ts` (diff 표시 범위 밖 — 대화 종료 시 final emit 코드)
  - 상세: 스펙과 주석은 "waiting_for_input emit과 terminal emit 두 분기 모두 동일 shape"임을 명시하지만, diff에는 `waiting_for_input` 분기만 포함된다. terminal emit 분기에서도 동일하게 `buildAiMessageDebugFromResumeState`를 사용하도록 변경되었는지 diff만으로는 확인되지 않는다.
  - 제안: `ExecutionEventType.AI_MESSAGE`를 emit하는 모든 지점(특히 대화 완료 terminal 분기)에서 동일한 helper를 사용하는지 검증. 한쪽만 변경되면 스펙과 달리 두 분기의 shape이 달라진다.

- **[INFO]** `llmCalls` 필드의 타입이 `unknown[]`로 느슨하게 정의됨
  - 위치: `execution-engine.service.ts:167` — 반환 타입 `{ llmCalls?: unknown[]; durationMs?: number }`
  - 상세: `llmCalls` 내부 항목은 스펙상 `{requestPayload, responsePayload, durationMs}` 구조를 가져야 하지만 타입 정보가 소실된다. `turnDebugHistory` 항목의 `llmCalls` 필드도 `as unknown[]`로 캐스팅되어 잘못된 shape이 WebSocket 페이로드로 전달되어도 컴파일 타임에 감지되지 않는다.
  - 제안: `turnDebugHistory` 엔트리와 `llmCalls` 항목에 대한 인터페이스를 정의하거나, 적어도 `Pick<TurnDebug, 'requestPayload' | 'responsePayload' | 'durationMs'>[]` 수준의 타입을 부여할 것.

- **[INFO]** `durationMs` 소스가 `lastTurnDurationMs` → `totalDurationMs`로 변경됨
  - 위치: `buildAiMessageDebugFromResumeState` 함수 내 `lastTurnDebug?.totalDurationMs`
  - 상세: 이전 코드는 `resumeState.lastTurnDurationMs`를 사용했고, 새 코드는 `turnDebugHistory` 마지막 항목의 `totalDurationMs`를 사용한다. 필드명이 다르므로 실제로 같은 값인지 (`totalDurationMs` = 해당 턴의 전체 duration = 이전의 `lastTurnDurationMs`) 명시적으로 확인이 필요하다.
  - 제안: `resumeState` 타입 정의와 `TurnDebugEntry` 타입 정의를 교차 확인해 두 필드가 동일한 의미임을 주석 또는 타입으로 명시할 것.

---

### 요약

`execution.ai_message` WebSocket 이벤트의 페이로드 shape이 변경된다. 스펙 미문서 필드였던 `requestPayload` / `responsePayload` / `durationMs`(단일 값)가 제거되고, tool loop 전체 호출 시퀀스를 담는 `llmCalls[]` 배열과 `durationMs`(총 duration)로 대체된다. 스펙-구현 정합성과 two-branch shape 동기화 측면에서는 개선이나, 프론트엔드가 제거된 top-level 필드를 직접 소비하고 있었다면 breaking change다. terminal emit 분기의 변경 여부 미확인과 느슨한 타입 정의도 보완이 필요하다.

### 위험도
**MEDIUM**