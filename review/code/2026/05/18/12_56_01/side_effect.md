# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 4: conversation-utils.ts — `messagesToConversationItems` 동작 변경

- **[WARNING]** `messagesToConversationItems` 의 반환 content 가 변경됨 — 기존 호출자에게 투명하지 않은 변형이 적용됨
  - 위치: `conversation-utils.ts` diff `@@ -102,7 +257,10 @@` — user 항목 `content: msg.content ?? ""` → `content: stripInlineMarkers(msg.content)`; `@@ -157,7 +315,7 @@` — assistant 항목 동일 적용
  - 상세: 기존 함수는 `content` 를 raw 그대로 반환했다. 이번 변경으로 `[user-input]…[/user-input]` 마커가 조용히 제거된다. 주석에서는 "Raw payload(requestPayload/responsePayload) 는 unaffected" 라고 설명하고 있으나, content 필드를 직접 읽는 기존 호출자(LLM debug 패널, 히스토리 로드 경로 등)는 이제 stripped 된 값을 받게 된다. debug 패널이 실제로 requestPayload/responsePayload 만 참조한다면 영향 없지만, content 를 보조적으로 읽는 경로가 존재하면 마커가 소실된다.
  - 제안: 함수에 `strip?: boolean` 옵션(기본값 `true`)을 두어 호출자가 raw content 를 요청할 수 있도록 하거나, strip 전용 wrapper 함수를 별도로 두어 기존 함수 계약을 유지한다. 최소한 JSDoc 에 "returns stripped content" 를 명시해야 한다.

---

### 파일 7: execution-store.ts — `ConversationItem.type` 유니온 확장

- **[WARNING]** `ConversationItem.type` 의 공개 인터페이스가 `"user" | "assistant" | "tool"` 에서 `"user" | "assistant" | "tool" | "presentation" | "system"` 으로 확장됨
  - 위치: `execution-store.ts` diff `- type: "user" | "assistant" | "tool";` → `+ type: "user" | "assistant" | "tool" | "presentation" | "system";`
  - 상세: TypeScript exhaustiveness check(`switch` + `never` 타입 어서션, `if-else` 체인) 를 사용하는 기존 소비 코드가 두 신규 멤버를 처리하지 않으면 컴파일 오류 또는 런타임 누락(silent fallthrough)이 발생한다. `conversation-inspector.tsx` 내부는 이번 변경에서 처리 브랜치를 추가했지만, 동일 타입을 소비하는 다른 컴포넌트·유틸리티(예: 히스토리 파일 로드 경로, 잠재적 export 소비자)는 검토가 필요하다.
  - 제안: 프로젝트 전체에서 `ConversationItem` 의 `type` 을 switch/if 로 분기하는 모든 위치를 grep 하여 `presentation`·`system` 누락 분기를 보완한다. 특히 exhaustive switch 패턴을 사용한 곳에서 TypeScript 컴파일러가 오류를 표시할 것이므로 빌드 검증이 선행되어야 한다.

---

### 파일 7: execution-store.ts — 선택적 필드 `presentation` 추가로 인한 직렬화 영향

- **[INFO]** `ConversationItem` 에 신규 선택적 필드 `presentation?: { ... }` 가 추가됨
  - 위치: `execution-store.ts` diff `+ presentation?: { nodeLabel: string; nodeType: string; interactionType: "button_click" | "form_submitted" | "button_continue"; data?: Record<string, unknown>; };`
  - 상세: 인터페이스 확장 자체는 additive 이므로 기존 코드는 컴파일 통과한다. 단, `ConversationItem` 을 JSON 직렬화하여 LocalStorage, IndexedDB, 또는 API 로 전송하는 경로가 있다면 새 필드가 포함된 구조가 나가게 된다. 역직렬화 경로(옛 데이터 읽기)에서는 필드가 없어도 `undefined` 로 처리되므로 하위 호환성은 유지된다.
  - 제안: `presentation` 을 소비하는 렌더러가 항상 `?? fallback` 으로 처리하고 있음은 확인됨. 직렬화 영향은 저위험이지만, 해당 타입을 DB 또는 외부로 내보내는 코드가 있다면 schema 호환성을 명시적으로 문서화한다.

---

### 파일 8: use-execution-events.ts — `setConversationMessages` 호출 조건 변경

- **[WARNING]** `waiting_for_input` 이벤트 핸들러에서 `conversationMessages` 세팅 조건과 guard 로직이 변경됨
  - 위치: `use-execution-events.ts` diff `@@ -226,11 +238,24 @@` — 신규 경로: `threadTurns && threadTurns.length > 0` 이면 `setConversationMessages(items)` 를 **항상** 호출; 기존 경로: `conversationMessages.length === 0` 일 때만 호출
  - 상세: 기존 emit messages 경로는 "재연결 시 중복 방지"를 위해 store 에 이미 메시지가 있으면 스킵했다. 신규 `threadTurns` 경로에는 이 guard 가 없다. WebSocket 재연결 또는 `waiting_for_input` 이벤트가 복수 발화될 경우, `threadTurns` 가 있으면 매번 `setConversationMessages` 를 호출해 store 를 덮어쓴다. 사용자가 대화 도중 일부 메시지를 로컬에서 추가했다면 해당 상태가 소실될 수 있다.
  - 제안: `threadTurns` 경로에도 동일한 idempotency guard 를 적용하거나, `threadTurns` 의 `nextSeq` 등을 비교해 이미 동일한 snapshot 이 반영되어 있으면 skip 하는 로직을 추가한다. 최소한 재연결 시나리오를 단위 테스트로 커버한다.

---

### 파일 4: conversation-utils.ts — 모듈 레벨 정규식 객체 `USER_INPUT_MARKER_RE`

- **[INFO]** `USER_INPUT_MARKER_RE = /\[\/?user-input\]/g` 가 모듈 레벨 상수로 선언됨
  - 위치: `conversation-utils.ts` — `const USER_INPUT_MARKER_RE = /\[\/?user-input\]/g;`
  - 상세: `/g` 플래그를 가진 정규식은 `lastIndex` 상태를 가지며, `exec` 또는 `test` 를 반복 호출할 때 stateful 하다. 다만 `String.prototype.replace` 와 함께 사용할 때는 매번 처음부터 매칭이 수행되어 문제가 없다. 현재 `stripInlineMarkers` 에서 `s.replace(USER_INPUT_MARKER_RE, "")` 만 사용하고 있으므로 실제 부작용은 없다. 그러나 향후 `exec`/`test` 로 재사용할 경우 예상치 못한 상태 오염이 발생할 수 있다.
  - 제안: 의도가 replace 전용임을 주석으로 명시하거나, 재사용 위험 차단을 위해 `/\[\/?user-input\]/g` 를 함수 내부 리터럴로 인라인 처리한다.

---

### 파일 2: conversation-inspector.tsx — `SummaryView` 내부 `stripInlineMarkers` 추가 적용

- **[INFO]** `SummaryView` 의 `out.push({ type: "user", content: stripInlineMarkers(m.content) })` 와 assistant content 동일 적용
  - 위치: `conversation-inspector.tsx` diff `@@ -479,7 +607,7 @@`, `@@ -490,7 +618,7 @@`
  - 상세: `messagesToConversationItems` 에서 이미 strip 을 적용하는 변경(`conversation-utils.ts`)이 동시에 추가되었다. `SummaryView` 가 `messagesToConversationItems` 를 호출하는지 또는 독립적으로 메시지를 변환하는지에 따라 strip 이 두 번 적용될 수 있다. `stripInlineMarkers` 는 멱등(idempotent)이므로 이중 적용의 결과는 동일하지만, 불필요한 중복이 혼란을 줄 수 있다.
  - 제안: `SummaryView` 가 `messagesToConversationItems` 를 통하는 경로라면 해당 `stripInlineMarkers` 호출을 제거해 중복을 제거한다. 독립 경로라면 주석으로 "독립 변환 경로이므로 별도 strip 필요" 를 명시한다.

---

### 파일 4: conversation-utils.ts — 신규 export `threadTurnsToConversationItems`, `stripInlineMarkers`, `ConversationTurn`, `ConversationTurnSource`

- **[INFO]** 4개의 신규 public export 가 모듈에 추가됨
  - 위치: `conversation-utils.ts` — 함수 및 타입 export 신규 추가
  - 상세: 신규 export 는 additive 이므로 기존 import 는 영향 없다. `ConversationTurn` 인터페이스는 백엔드 wire format 을 미러링하므로 백엔드 스키마 변경 시 이 타입도 함께 갱신해야 한다. 이 의존성이 명시적으로 추적되지 않으면 드리프트가 발생할 수 있다.
  - 제안: `ConversationTurn` 타입에 "mirrors spec §1.2" JSDoc 은 이미 있음(양호). 백엔드 스키마 변경 시 이 파일도 함께 수정해야 함을 `CLAUDE.md` 또는 spec 에 명시한다.

---

### 파일 5·6: i18n dict (en/ko) — 신규 키 추가

- **[INFO]** `editor.conversation.cardButtonClicked`, `cardFormSubmitted`, `cardLinkContinue`, `cardSystemNote` 4개 키가 en·ko 사전에 추가됨
  - 위치: `en/editor.ts`, `ko/editor.ts` diff 각 `+4` 라인
  - 상세: 양 언어 사전에 동일 키가 추가되었으므로 missing key 오류는 없다. i18n 타입 시스템(있다면)이 `Dict["editor"]` 인터페이스를 강제하는 경우, 타입 체크가 통과해야 신규 키 참조가 안전하다. 현재 `useT(interactionLabelKey)` 호출이 정적 key literal 대신 변수로 이루어지는 곳이 있어 타입 검사에서 누락될 수 있다.
  - 제안: `interactionLabelKey` 의 타입을 `keyof typeof dict` 등으로 좁혀 컴파일 타임에 유효성을 확인한다.

---

## 요약

이번 변경은 `ConversationItem` 인터페이스 확장(두 신규 `type` 멤버), `messagesToConversationItems` 의 content strip 동작 변경, WebSocket `waiting_for_input` 핸들러의 store 세팅 경로 교체, 그리고 신규 변환 함수 `threadTurnsToConversationItems` 도입으로 구성된다. 가장 주목해야 할 부작용은 두 가지다. 첫째, `ConversationItem.type` 유니온이 확장되어 기존에 exhaustive 분기를 작성한 소비 코드에서 TypeScript 컴파일 오류 또는 런타임 누락 분기가 발생할 수 있다. 둘째, `waiting_for_input` 핸들러에서 `threadTurns` 경로는 기존 guard(`conversationMessages.length === 0`)를 우회해 재연결 시 store 를 항상 덮어쓰므로 idempotency 가 깨진다. `messagesToConversationItems` 내부의 content strip 도 기존 계약을 조용히 변경하므로 debug 패널 등 raw content 가 필요한 소비자를 점검해야 한다. 나머지 발견사항(정규식 `lastIndex` 잠재 위험, 이중 strip, i18n 타입 안전성)은 INFO 수준이며 현재 코드에서 실질적 오류를 일으키지는 않는다.

## 위험도

MEDIUM
