# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/web-chat-preview-improvements.md` (구현 완료 diff, diff-base=origin/main)

---

## 발견사항

### 1. [INFO] `PRESENTATION_NODE_TYPES` — 상수 이름 충돌 없음, 이전(extract) 방향 정확

- target 신규 식별자: `PRESENTATION_NODE_TYPES` (exported from `codebase/backend/src/common/constants/presentation.ts`)
- 기존 사용처: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 의 line 40 에 module-private `const PRESENTATION_NODE_TYPES = new Set<string>([...])` 로 이미 존재했다.
- 상세: diff 는 `chat-channel.dispatcher.ts` 의 local 상수를 삭제하고 공유 상수로 교체하는 패턴이다. 충돌이 아니라 의도된 단일화(DRY). 새 파일 경로 `common/constants/presentation.ts` 는 기존 `common/constants/` 하위 파일 목록과 겹치지 않는다.
- 제안: 이슈 없음.

### 2. [INFO] `EXECUTION_MESSAGE` enum 멤버 / `execution.message` 이벤트 이름 — 기존과 무충돌

- target 신규 식별자: `ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'` (websocket.service.ts)
- 기존 사용처: `ExecutionEventType` 에 동일 이름이 없었다. 이벤트 문자열 `'execution.message'` 는 기존 enum 전체(`execution.started` / `.resumed` / `.completed` / `.failed` / `.cancelled` / `.waiting_for_input` / `.user_message` / `.ai_message` / `.tool_call_started` / `.tool_call_completed` / `.snapshot`)에 없는 신규 값이다.
- 상세: `EXECUTION_MESSAGE_TOO_LONG` (에러 코드 — `backend/src/nodes/core/error-codes.ts:86`) 과 표기가 유사하지만 enum 멤버 이름(TypeScript identifier)과 WS 에러 코드(문자열 상수)는 별개 네임스페이스이고, 코드 내 JSDoc 에도 "WS 에러코드 `EXECUTION_MESSAGE_TOO_LONG` 과는 무관한 별개 네임스페이스" 라고 명기되어 있다. 실제 와이어 값(`'execution.message'`)도 에러 코드 문자열(`'EXECUTION_MESSAGE_TOO_LONG'`)과 다르므로 런타임 충돌 없음.
- 제안: 이슈 없음.

### 3. [INFO] `ExecutionMessageEvent` 인터페이스 — 기존 DOM `MessageEvent` 와 이름 유사하나 충돌 아님

- target 신규 식별자: `ExecutionMessageEvent` (channel-web-chat/src/lib/eia-types.ts)
- 기존 사용처: 브라우저 DOM `MessageEvent` (전역)가 `live-preview.tsx`, `live-preview.test.tsx` 등에서 사용되고 있다. 그러나 DOM built-in 타입과 project-local 인터페이스는 완전히 다른 이름이다.
- 상세: JSDoc 에 "DOM 전역 `MessageEvent` 와도 별개" 라고 명기. 충돌 없음.
- 제안: 이슈 없음.

### 4. [INFO] `ParsedMessage` 인터페이스 — 기존 `ParsedAiMessage` 와 병존, 충돌 없음

- target 신규 식별자: `ParsedMessage` (channel-web-chat/src/lib/eia-events.ts)
- 기존 사용처: 같은 파일에 `ParsedAiMessage` 인터페이스가 이미 존재. `ParsedMessage` 이름은 codebase 전체에서 이전에 정의된 바 없다.
- 상세: 두 타입이 서로 다른 이벤트 소스를 파싱한다. 이름 충돌 없음.
- 제안: 이슈 없음.

### 5. [INFO] `parseMessage` 함수 — 기존 사용처 없음, 신규 함수

- target 신규 식별자: `parseMessage` (channel-web-chat/src/lib/eia-events.ts)
- 기존 사용처: codebase 전체에서 `parseMessage` 라는 이름의 export 함수가 없었다.
- 상세: 이름이 매우 일반적이지만 같은 모듈 내에서만 사용되므로 충돌 없음.
- 제안: 이슈 없음.

### 6. [INFO] `resetSession` host-bridge 명령 이름 — 기존 명령과 충돌 없음

- target 신규 식별자: `case "resetSession"` (channel-web-chat/src/widget/use-widget.ts 의 `wc:command` 라우터)
- 기존 사용처: 기존 명령 목록은 `open` / `close` / `sendMessage` / `show` / `hide` / `updateProfile`. `resetSession` 은 이전에 없었다.
- 상세: 충돌 없음.
- 제안: 이슈 없음.

### 7. [INFO] i18n 키 `webChat.preview.reset` / `webChat.preview.resetHint` — 기존 키 미사용

- target 신규 식별자: `webChat.preview.reset`, `webChat.preview.resetHint` (en/ko webChat.ts)
- 기존 사용처: `webChat.preview` 섹션에는 `title`, `unavailable` 만 있었다.
- 상세: 충돌 없음.
- 제안: 이슈 없음.

### 8. [INFO] `postCommand` 함수 — live-preview.tsx 내 신규 로컬 함수, 외부 충돌 없음

- target 신규 식별자: `postCommand` (frontend/src/components/web-chat/live-preview.tsx)
- 기존 사용처: channel-web-chat 의 테스트 파일 `use-widget-commands.test.ts:8` 에 같은 이름의 테스트 헬퍼 함수가 있으나, 이는 다른 패키지의 파일-로컬 테스트 유틸리티다. 다른 컴파일 단위이므로 런타임·빌드 충돌 없음.
- 제안: 이슈 없음. 단, 두 패키지를 동시에 읽는 개발자가 이름 혼동을 일으킬 수 있으나 INFO 수준.

### 9. [INFO] `EiaEventName` 유니온에 `"execution.message"` 추가 — 기존 이벤트 집합과 충돌 없음

- target 신규 식별자: `"execution.message"` (channel-web-chat/src/lib/eia-types.ts EiaEventName 유니온)
- 기존 사용처: 기존 유니온 멤버 8종 중 `"execution.message"` 는 없었다.
- 상세: 충돌 없음.
- 제안: 이슈 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자(`PRESENTATION_NODE_TYPES` 공유 상수, `EXECUTION_MESSAGE` enum 멤버 / `'execution.message'` 이벤트, `ExecutionMessageEvent`, `ParsedMessage`, `parseMessage`, `resetSession` 명령, `webChat.preview.reset*` i18n 키, `postCommand` 함수)는 모두 기존 코드베이스의 다른 의미 식별자와 충돌하지 않는다. `EXECUTION_MESSAGE_TOO_LONG` 에러 코드와 유사 표기가 우려될 수 있으나 TypeScript enum identifier vs 문자열 에러 코드로 네임스페이스가 분리되어 있고 코드 내 주석으로도 명기되어 있어 실질적 혼선 위험은 없다.

## 위험도

NONE
