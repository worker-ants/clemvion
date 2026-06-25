# Testing Review — web-chat-preview-improvements

## 발견사항

### [INFO] `PRESENTATION_NODE_TYPES` 상수 자체에 대한 직접 테스트 없음
- 위치: `codebase/backend/src/common/constants/presentation.ts`
- 상세: 공용 상수 파일은 신규 생성이며 소비처 2곳(엔진·chat-channel)이 import 한다. 상수 내용 자체를 검증하는 테스트는 없고, 엔진 테스트에서 간접 검증(template 노드가 이벤트를 발행하는지 확인)만 존재한다. 단순 상수이므로 Critical 이슈는 아니다.
- 제안: 필요 시 `form` 이 집합에 없음을 assertion 하는 1줄 테스트(`expect(PRESENTATION_NODE_TYPES.has('form')).toBe(false)`) 추가로 회귀를 고정할 수 있다. 현재 coverage 는 엔진 spec 의 "미발행" 케이스로 간접 충족.

---

### [INFO] `chat-channel.dispatcher.ts` 변경에 대한 직접 단위 테스트 부재
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- 상세: 변경 내용은 로컬 `const PRESENTATION_NODE_TYPES` 정의를 삭제하고 공용 모듈 import 로 교체한 것이다. 기능 로직은 동일하므로 기존 chat-channel dispatcher 테스트가 회귀 보호 역할을 한다. 단, dispatcher 테스트에서 공용 상수가 올바르게 참조되는지 명시적으로 확인하는 케이스가 없으면 import 경로 오류가 런타임까지 지연될 수 있다. 빌드(tsc)가 통과하면 대부분 충족되므로 Critical 이슈는 아니다.
- 제안: dispatcher 의 기존 단위 테스트 파일이 있다면 `presentation.ts` import 를 module mock 으로 교체해 상수 조작 시나리오(예: 집합 외 타입 무시)를 명시하면 더 견고해진다.

---

### [INFO] 엔진 테스트 — blocking(버튼) 케이스 미발행 검증 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (신규 describe 블록)
- 상세: plan Phase 5 에서 "blocking(버튼) 케이스 미발행" 을 테스트 요건으로 명시했으나(`plan/in-progress/web-chat-preview-improvements.md §Phase5`), 추가된 두 케이스는 ① 비차단 presentation 발행, ② 비-presentation 비차단 노드 미발행만 커버한다. presentation 노드가 버튼이 있어 `output.status === 'waiting_for_input'` 으로 blocking 전환되는 경우, `execution.message` 가 발행되지 않음을 검증하는 케이스가 없다.
- 제안: `blocking presentation(carousel with button)` 픽스처로 `isBlocking=true` 분기를 진입시키고 `emitExecutionEvent` 가 `'execution.message'` 로 호출되지 않음을 assertion 하는 세 번째 케이스 추가.

---

### [INFO] `use-widget.ts` — `execution.message` 핸들러 경로의 위젯 단위 테스트 부재
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`
- 상세: plan Phase 5 는 "handleEiaEvent 가 presentation 말풍선 dispatch" 를 위젯 unit 테스트 요건으로 포함했다. `eia-events.test.ts` 는 `parseMessage` 순수 함수만 커버하고, `use-widget.ts` 내 `else if (name === "execution.message")` 분기 — `dispatch({ type: "AI_MESSAGE", text: "", presentations })` 호출 — 의 테스트는 없다. 특히 `presentations` 가 undefined 일 때(`parseMessage` 반환값이 presentations 미포함) dispatch 자체가 스킵되는 경로(`if (presentations)` 조건)도 미검증이다.
- 제안: `use-widget.test.ts` 또는 별도 `handleEiaEvent.test.ts` 에서 `execution.message` 이벤트를 SSE mock 으로 주입해 state 가 `AI_MESSAGE` 를 포함하는지, presentations 없을 때 dispatch 가 호출되지 않는지 검증하는 케이스 추가.

---

### [INFO] `resetSession` 커맨드 핸들러의 위젯 단위 테스트 부재
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (line ~501)
- 상세: `case "resetSession": apiRef.current.newChat(); break;` 로직이 추가되었으나 `wc:command { action: "resetSession" }` postMessage 수신 시 `newChat()` 이 호출됨을 검증하는 단위 테스트가 없다. 세션 초기화 기능의 주요 경로(closeStream→clearSession→start 시퀀스 포함)가 회귀 보호 밖에 있다.
- 제안: `postMessage` mock + `newChat` spy 를 사용해 `resetSession` 커맨드 수신 시 `newChat` 이 호출됨을 assertion. 단순 통합보다 훅 수준의 단위 테스트로도 충분하다.

---

### [INFO] `live-preview.tsx` — `postCommand` 및 버튼 상태 테스트 부재
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`
- 상세: `postCommand` 헬퍼와 "새 세션" 버튼 렌더링 변경(disabled 조건 `status !== "ready"`)은 UI 컴포넌트 레이어 로직이다. `status` 별 버튼 활성/비활성, `widgetOrigin` 미확보 시 `postMessage` 미전송, `postCommand("resetSession")` 클릭 시 `contentWindow.postMessage` 호출 여부를 검증하는 테스트가 없으면 회귀 탐지 blind spot이 된다.
- 제안: `@testing-library/react` 기반으로 status="loading" 시 버튼 `disabled`, status="ready" + 클릭 시 `postMessage` 호출되는 케이스 추가.

---

### [INFO] `parseMessage` 테스트 — carousel/table/chart 타입 변형 케이스 부재
- 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts`
- 상세: 신규 `parseMessage` 테스트 3건은 template 타입 한정 fixture 를 사용하고, carousel·table·chart 의 envelope shape 차이(각기 다른 config/output 필드)를 검증하지 않는다. `parseMessage` 자체는 envelope 를 passthrough 하므로 함수 수준에서는 영향이 없지만, 위젯 classifyPresentation 과의 계약이 실제 4종 전부에 대해 성립하는지 확인하는 회귀 픽스처가 없다.
- 제안: carousel(`config.items`, `output.items`), table(`output.rows`) 를 포함한 최소 픽스처 1건 추가해 4종 렌더 경로의 회귀를 고정. 단순 passthrough 이므로 추가 부담이 낮다.

---

### [INFO] e2e 테스트 미작성 (plan 계획 대비)
- 위치: plan Phase 5 §2 (`plan/in-progress/web-chat-preview-improvements.md`)
- 상세: plan 은 "캐러셀(버튼)→템플릿→AI 흐름에서 SSE 로 `execution.message` 가 템플릿 output.rendered 를 운반함을 검증하는 e2e" 를 Phase 5 요건으로 포함한다. 이번 커밋에는 e2e 파일 변경이 없다. 커밋 메시지는 e2e 를 언급하지 않고 unit 만 언급(`lint·unit(backend 7396·web-chat 198)·build PASS`). 환경 제약으로 차단된 경우는 이해할 수 있으나, e2e 케이스 자체가 미작성 상태로 남아 있으면 해당 흐름의 회귀 보호가 없다.
- 제안: `execution.message` SSE 수신 후 위젯 DOM 에 presentation 말풍선이 렌더되는 흐름을 e2e 케이스로 추가. Docker e2e 인프라가 가용한 시점에 작성.

---

## 요약

테스트 관점에서 이 변경의 핵심 로직(백엔드 엔진이 presentation 노드 비차단 완료 시 `execution.message` 를 발행하는 것, `parseMessage` 순수 함수 매핑)은 단위 테스트로 커버되어 있어 기본 회귀 보호가 갖춰져 있다. 그러나 세 가지 주요 경로 — ① blocking presentation 케이스 미발행, ② 위젯 `handleEiaEvent` 내 `execution.message` 분기 dispatch 로직, ③ `resetSession` 커맨드 핸들러 — 의 단위 테스트가 없어 plan 에서 명시한 테스트 요건이 완전히 이행되지 않았다. `live-preview.tsx` 의 버튼 상태 로직과 carousel/table/chart envelope 회귀 픽스처도 부재한다. 공용 상수 추출과 enum 추가 같은 리팩터링 부분은 빌드·lint 통과로 대부분 보호되므로 Critical 이슈는 없으나, 위젯 핵심 경로의 단위 테스트 부재가 가장 시급한 보완 사항이다.

## 위험도

LOW
