# 신규 식별자 충돌 검토

## 발견사항

### 이벤트/메시지명 — `execution.message` 와 `EXECUTION_MESSAGE_TOO_LONG` 네임스페이스 근접

- **[WARNING]** `execution.message` SSE 이벤트명이 기존 WS 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 와 접두어 충돌
  - target 신규 식별자: `ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'` (`codebase/backend/src/modules/websocket/websocket.service.ts`)
  - 기존 사용처:
    - `EXECUTION_MESSAGE_TOO_LONG` — `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md`, `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md`, `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md`, `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` 에서 정의된 WS ack 에러코드
    - `MESSAGE_TOO_LONG` — REST 에러코드, EIA §5.1 에러표
  - 상세: `execution.message` 는 이벤트 스트림 이름이고 `EXECUTION_MESSAGE_TOO_LONG` 는 WS 에러 ack 코드로 레이어가 다른 별개 네임스페이스다. 의미 충돌은 없다. 그러나 코드의 JSDoc 주석도 "WS 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 와는 무관한 별개 네임스페이스다" 라고 명시하고 있어 혼동 가능성을 인식한 상태다. `execution.` prefix 를 공유하는 기존 이벤트 목록(`execution.waiting_for_input`, `execution.ai_message`, `execution.node.completed` 등)에 신규 이름이 추가되므로 컨벤션은 일관됨. 실질 충돌은 없으나 이름이 매우 일반적(`message`)이어서 DOM 전역 `MessageEvent` 와 혼동 가능성이 있다.
  - 제안: `execution.presentation` 이 더 명확하나, 코드 자체의 JSDoc 에 이미 충분한 명명 주의를 문서화했고 EIA spec §5.2 이벤트 목록에 추가하면 canonical 이름으로 확정된다. 현 이름 유지 시 spec(EIA §5.2 이벤트 종류 목록, EIA-NX-02 화이트리스트) 에 `execution.message` 를 명시 추가 필요.

---

- **[WARNING]** `PRESENTATION_NODE_TYPES` 상수명이 기존 `PRESENTATION_COMPONENTS` 와 같은 presentation 영역에서 다른 집합을 나타내어 혼동 가능
  - target 신규 식별자: `PRESENTATION_NODE_TYPES` (`codebase/backend/src/common/constants/presentation.ts`)
  - 기존 사용처: `PRESENTATION_COMPONENTS` — `/Volumes/project/private/clemvion/codebase/backend/src/nodes/presentation/index.ts:12`, `/Volumes/project/private/clemvion/codebase/backend/src/nodes/index.ts:8,32,46`
  - 상세: `PRESENTATION_COMPONENTS` 는 `form` 을 포함하는 4+1 종 노드 컴포넌트 배열이고, `PRESENTATION_NODE_TYPES` 는 `form` 을 제외한 비차단 4종 타입 문자열 집합이다. JSDoc 주석이 이 차이를 명시하고 있으므로 의미 충돌은 없다.
  - 제안: 현 이름 유지. 필요하다면 `NON_BLOCKING_PRESENTATION_NODE_TYPES` 로 더 명시적인 이름을 고려할 수 있다. (WARNING 수준으로 차단 요인 아님)

---

- **[INFO]** `resetSession` wc:command action 이 SDK / 기존 wc:command 목록에 없는 신규 action
  - target 신규 식별자: `"resetSession"` (`codebase/channel-web-chat/src/widget/use-widget.ts` 의 `case "resetSession":`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.ts` 기존 case 목록 — `open`, `close`, `sendMessage`, `shutdown`, `show`, `hide`, `updateProfile` (라인 475~493). `/Volumes/project/private/clemvion/codebase/packages/web-chat-sdk/src/index.ts` 는 기존 7종 action 만 문서화
  - 상세: 이름 자체의 기존 사용처와 충돌은 없다. live-preview 내부 전용(`postCommand("resetSession")`)이므로 SDK 노출 여부를 결정해야 한다.
  - 제안: live-preview 전용 내부 호출이므로 SDK 노출 생략이 적절하다. `use-widget.ts` JSDoc 에 "live-preview host 전용 내부 명령" 임을 명시하면 충분하다.

---

- **[INFO]** `ParsedMessage` 인터페이스 이름이 매우 일반적
  - target 신규 식별자: `ParsedMessage` (`codebase/channel-web-chat/src/lib/eia-events.ts`)
  - 기존 사용처: 동일 파일에 `ParsedAiMessage` (기존) 공존. 다른 파일에서 `ParsedMessage` 로 import 하는 기존 사용처 없음.
  - 상세: 모듈 내부 export 이고 타입스크립트 타입 네임스페이스는 모듈 단위로 격리되므로 실질 충돌은 없다.
  - 제안: `ParsedExecutionMessage` 또는 `ParsedPresentationMessage` 가 `ParsedAiMessage` 와 대칭적으로 더 명확하지만 INFO 수준이다.

---

- **[INFO]** i18n 키 `webChat.preview.reset` / `webChat.preview.resetHint` 신규 추가 — 기존 `assistant.newSession` 과 의미 유사하나 다른 네임스페이스
  - target 신규 식별자: `webChat.preview.reset`, `webChat.preview.resetHint` — `codebase/frontend/src/lib/i18n/dict/en/webChat.ts`, `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts`
  - 기존 사용처: `assistant.newSession = "New session"` (en) / `"새 대화 시작"` (ko) — `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/en/assistant.ts:6`, `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/ko/assistant.ts:4`
  - 상세: 키 이름 충돌은 없다(다른 네임스페이스). en 에서 `webChat.preview.reset = "New session"` 이 `assistant.newSession = "New session"` 과 동일한 영어 문자열을 사용하지만, 별도 spec 영역(admin console preview vs workflow assistant)이므로 허용 범위다.
  - 제안: 두 컨텍스트의 UX 의미가 다를 수 있어 별도 유지가 적절하다. INFO 수준으로 조치 불필요.

---

## 요약

target diff 가 도입하는 신규 식별자(`PRESENTATION_NODE_TYPES`, `ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'`, `ExecutionMessageEvent`, `ParsedMessage`, `parseMessage`, `resetSession` action, i18n 키 2종)는 기존 코드·spec 에서 동일 이름으로 다른 의미로 쓰이는 진성 충돌이 없다. 가장 주목할 사항은 (1) `execution.message` 이벤트명이 `EXECUTION_MESSAGE_TOO_LONG` 와 접두어를 공유해 처음 읽는 독자가 혼동할 가능성(코드 JSDoc 에 이미 경고 포함, spec 목록 갱신 필요), (2) `PRESENTATION_NODE_TYPES` 가 기존 `PRESENTATION_COMPONENTS` 와 같은 영역에서 다른 집합을 나타내지만 JSDoc 으로 구분됨, 이 두 가지다. 신규 파일 경로(`common/constants/presentation.ts`)는 기존 `common/constants/` 디렉터리가 존재하지 않아 신규 생성이며 명명 컨벤션 위반 없음. 전체적으로 명명 충돌 위험은 낮다.

## 위험도

LOW
