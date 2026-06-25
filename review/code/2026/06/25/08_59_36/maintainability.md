# 유지보수성(Maintainability) 리뷰

## 발견사항

### INFO — `parseMessage` 반환 타입 인라인 익명 객체

- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts` `parseMessage` 함수 반환 타입
- 상세: `parseMessage` 함수 반환 타입이 `{ presentations?: Array<Record<string, unknown>> }` 인라인 익명 타입으로 선언됐다. 같은 파일의 `parseWaitingForInput`은 `ParsedWaiting`, `parseAiMessage`는 `ParsedAiMessage` 등 명명된 interface 를 사용하는 패턴과 일치하지 않는다. 인라인 타입은 소비처에서 해당 shape 을 재사용하거나 참조할 때 중복 선언을 유발할 수 있다.
- 제안: `ParsedMessage` (또는 `ParsedPresentationMessage`) interface 를 `ParsedAiMessage` 직후에 선언하고 반환 타입으로 참조한다. `presentations` 필드 JSDoc 도 같이 이전하면 읽기 편의가 높아진다.

---

### INFO — `postCommand` 인자 타입이 `string` — 명령 유형 타입 보호 부재

- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` `postCommand(action: string)` 추가 함수
- 상세: `postCommand` 의 `action` 파라미터가 plain `string` 으로 선언돼 있어 임의 문자열을 전달할 수 있다. 현재 허용 명령은 `"resetSession"` 뿐이며, `use-widget.ts` 의 `onCommand switch` 역시 case 별로 구분된다. 미래에 명령이 추가될 경우 오타·잘못된 action 값을 컴파일 타임에 잡을 수 없다.
- 제안: `action` 파라미터 타입을 리터럴 유니온(예: `"resetSession"`)으로 좁히거나, `eia-types.ts` 에 공용 `WidgetCommandAction` 유니온 타입을 선언해 `use-widget.ts` onCommand switch 와 공유한다.

---

### INFO — `execution-engine.service.ts` 인라인 블록 주석 밀도

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 추가 블록 앞 주석(6행)
- 상세: 추가된 if 블록 앞의 주석이 의도·배경을 충실히 서술하지만, 이 파일의 다른 inline 주석(대체로 2–3행 요약)보다 길고 spec 링크가 마지막 행에 붙는 형식도 약간 다르다. 정보 자체는 충분해 Critical 이슈가 아니다.
- 제안: 주석을 2–3행 핵심 요약으로 압축하고 spec 링크는 `// spec: ...` 단 한 줄로 분리하는 것이 파일 내 기존 관례와 더 일치한다. 필수 변경 아님.

---

### INFO — `PRESENTATION_NODE_TYPES` 타입 파라미터 `new Set<string>` — 향후 리터럴 유니온 기회

- 위치: `codebase/backend/src/common/constants/presentation.ts`
- 상세: `PRESENTATION_NODE_TYPES = new Set<string>(...)` 으로 선언돼 있어 임의 문자열을 `has()` 인자로 허용한다. 소비처(`execution-engine.service.ts`, `chat-channel.dispatcher.ts`)가 모두 런타임 `string` 인 `node.type` 을 넘기므로 즉각적 결함은 없고, 코드베이스 내 다른 Set 상수와 같은 패턴을 따르고 있어 일관성 문제도 없다.
- 제안: 필수 아님. 향후 `node.type` 이 리터럴 유니온으로 강화될 때 `Set<PresentationNodeType>` 으로 함께 좁히면 타입 보호 효과가 생긴다.

---

### INFO — `use-widget.ts` `apiRef` 객체 리터럴 두 곳 중복 (`newChat` 추가로 확장)

- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `apiRef` 초기화(라인 ~404)와 `useEffect` 갱신(라인 ~406)
- 상세: `newChat` 추가로 `apiRef` 객체 리터럴 `{ open, close, submitMessage, closeStream, show, hide, updateProfile, newChat }` 이 두 곳에 동일하게 나열된다. 이 패턴은 기존(diff 이전 7개 프로퍼티)부터 존재하며 이번 변경이 기존 패턴을 일관되게 따랐다. 함수가 추가될 때마다 두 곳을 함께 수정해야 한다는 유지보수 부담이 있다.
- 제안: 즉각 수정 대상은 아니다. 향후 `apiRef` 타입을 interface 로 분리하고 객체를 별도 변수(`const api = { ... }`)로 구성한 뒤 `useRef(api)` 와 `apiRef.current = api` 로 통일하면 중복 제거 및 누락 방지에 유리하다.

---

## 요약

이번 변경은 유지보수성 측면에서 전반적으로 우수하다. `PRESENTATION_NODE_TYPES` 공용 상수 추출(단일 출처, 의존 방향 위반 방지), `EXECUTION_MESSAGE` enum 추가, `ExecutionMessageEvent` 명명된 타입 선언, `parseMessage` 분리(순수 함수, 단위 테스트 가능) 모두 유지보수성을 높이는 방향의 결정이다. 매직 넘버는 `READY_TIMEOUT_MS`·`PREVIEW_HEIGHT`·`PREVIEW_MAX_HEIGHT` 상수로 이미 명명됐으며, Tailwind 인라인 grid 값(`360px`/`400px`)은 JSX 레이아웃 관례상 허용 수준이다. 개선 여지는 `parseMessage` 반환 타입을 기존 `ParsedAiMessage` 패턴처럼 명명된 interface 로 승격하는 것과 `postCommand` action 파라미터를 리터럴 유니온으로 좁히는 것으로, 둘 다 즉각적 결함이 아닌 일관성·타입 안전성 향상 사항이다.

## 위험도

NONE
