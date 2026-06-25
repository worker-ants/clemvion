# 유지보수성(Maintainability) 리뷰

리뷰 대상 커밋: `cbb39decd1f547865175da4a9afd0eacb3cc7795`

---

## 발견사항

### [INFO] ParsedMessage 인터페이스가 ParsedAiMessage 와 presentations 필드 중복
- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` — `ParsedAiMessage` / `ParsedMessage`
- 상세: 두 인터페이스 모두 `presentations?: Array<Record<string, unknown>>` 를 동일 JSDoc 과 함께 선언한다. 동일 필드 정의가 두 곳에 존재해 향후 타입을 바꿀 때 양쪽을 동시에 변경해야 하는 위험이 있다.
- 제안: 공통 `interface ParsedPresentations { presentations?: Array<Record<string, unknown>>; }` 를 base 로 두고 양쪽이 extend 하는 구조를 검토할 수 있다. 현 규모에서는 허용 범위이므로 강제 수정보다는 TODO 주석으로 충분하다.

### [INFO] `parseMessage` 와 `parseAiMessage` 의 presentations 정규화 로직 중복
- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` — `parseAiMessage` / `parseMessage` 구현부
- 상세: `Array.isArray(ev.presentations) && ev.presentations.length ? ev.presentations : undefined` 표현식이 두 함수에 동일하게 반복된다. 테스트도 이 규약을 `parseAiMessage 와 동일 규약` 으로 명시해 의도적 복제임을 알 수 있으나, 향후 정규화 정책(예: null 처리)이 변경되면 두 곳을 모두 수정해야 한다.
- 제안: `normalizePresentations` 같은 내부 헬퍼 함수로 추출하면 단일 변경점으로 유지할 수 있다. 현 규모에서는 INFO 수준.

### [INFO] `live-preview.tsx` 의 `postCommand`/`postBoot` 가 거의 동일한 패턴 반복
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` — `postBoot` / `postCommand`
- 상세: 두 함수 모두 `if (!widgetOrigin) return` 가드 + `iframeRef.current?.contentWindow?.postMessage(...)` 패턴을 공유한다. 내용이 달라 통합이 쉽지 않으며, 주석(`postBoot 와 동형`)도 이를 인식하고 있다. 패턴이 2개 이상으로 늘어날 경우 공통 헬퍼(`postToWidget`)로 묶는 것이 가독성에 유리하다.
- 제안: 지금은 2개라 INFO 수준. 향후 command 종류가 늘면 `postToWidget(msg: object)` 헬퍼 추출을 권장한다.

### [INFO] `use-widget.ts` 의 `apiRef` 객체 리터럴이 두 곳에서 동일 목록으로 반복
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `useRef` 초기화 / `useEffect` 내 갱신
- 상세: `apiRef` 초기화(`useRef`)와 `useEffect` 내 갱신 양쪽에 `{ open, close, submitMessage, closeStream, show, hide, updateProfile, newChat }` 목록이 그대로 반복된다. 함수가 추가될 때 두 곳을 동시에 변경해야 하는 구조다.
- 제안: `buildApiRef = () => ({ open, close, ... })` 처럼 팩토리를 추출하거나, `Object.assign(apiRef.current, ...)` 패턴으로 단일화할 수 있다. 기존 코드베이스 패턴을 깨는 변경이 있어 INFO 수준 유지.

### [INFO] 문자열 리터럴 `"resetSession"` 이 두 패키지에 산재
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` (onClick 인라인) / `codebase/channel-web-chat/src/widget/use-widget.ts` (case 분기)
- 상세: 프론트엔드 콘솔과 위젯 SPA 가 서로 다른 패키지이므로 공유 상수를 두기 어렵지만, 두 곳에서 문자열 `"resetSession"` 을 하드코딩해 오타 위험이 있다.
- 제안: 위젯 쪽에 `WIDGET_COMMANDS = { RESET_SESSION: "resetSession" }` 를 SDK 타입으로 export 하고 live-preview 가 이를 참조하는 구조가 장기적으로 유리하다. 현재는 서로 다른 패키지 경계라 강제 수정보다 INFO 기록.

### [INFO] `execution-engine.service.ts` 신규 블록의 인라인 주석이 과도하게 길다
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 신규 `EXECUTION_MESSAGE` emit 블록
- 상세: 추가된 7줄짜리 블록에 6줄의 인라인 주석이 붙어 코드 대비 주석 비율이 높다. 주석 내용 자체는 유용하나, spec 참조 링크와 설계 근거가 뒤섞여 읽는 중 집중이 분산된다.
- 제안: spec 참조 한 줄만 남기고 나머지 설계 근거(firehose 누출·chat-channel 중복 없음)는 `presentation.ts` 상수 파일 JSDoc 에 집중시키는 방식을 고려. 기능 영향 없으므로 INFO.

### [INFO] `ExecutionMessageEvent` 타입이 `AiMessageEvent` 와 구조적으로 거의 동일한 필드 중복
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` — `AiMessageEvent` / `ExecutionMessageEvent`
- 상세: 두 인터페이스는 `nodeId?`, `presentations?`, `seq?` 를 동일하게 가진다. 분리 자체는 의미상 올바르나(JSDoc 에서도 근거 명시), 공통 기저 타입 없이 필드가 각자 중복 선언돼 향후 wire 계약이 변경될 때 두 인터페이스를 동시에 수정해야 한다.
- 제안: `interface BaseEiaMessageEvent { nodeId?: string; presentations?: Array<Record<string, unknown>>; seq?: number; }` 를 추출해 양쪽이 extend 하는 구조를 고려할 수 있다. 현 규모에서는 INFO.

---

## 요약

이번 변경은 전반적으로 유지보수성 관점에서 양호하다. `PRESENTATION_NODE_TYPES` 를 공용 상수로 추출해 중복 정의를 제거한 결정과 JSDoc·spec 링크를 코드 곳곳에 배치해 의도를 문서화한 점은 긍정적이다. 발견된 항목은 모두 INFO 수준으로, `parseAiMessage`/`parseMessage` 의 presentations 정규화 로직 중복, `apiRef` 목록의 이중 관리, `ExecutionMessageEvent`/`ParsedMessage` 의 필드 중복이 주요 개선 후보다. 이들은 현재 동작에 영향을 미치지 않으나, 향후 이벤트 타입이나 커맨드 목록이 확장될 때 단일 변경점으로 관리하기 어려워지는 경향이 있다. Critical/Warning 수준의 항목은 없다.

## 위험도

NONE
