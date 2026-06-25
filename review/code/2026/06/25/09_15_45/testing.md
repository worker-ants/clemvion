# Testing Review — web-chat-preview-improvements (2026-06-25 09:15:45)

## 발견사항

### [INFO] presentation 노드 4종 개별 emit 테스트 — carousel/table/chart 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 신규 `describe('execution.message …')` 블록
- 상세: 백엔드 emit 테스트는 `template` 노드 1종(비차단) + `plain_node`(미발행) 2케이스만 커버한다. `carousel`·`table`·`chart` 각각이 `EXECUTION_MESSAGE`를 발행하는지는 직접 확인되지 않는다. 현재 구현은 `PRESENTATION_NODE_TYPES.has(node.type)` 단일 조건으로 4종 전체를 처리하므로 로직상 동일하나, 집합 자체가 정확히 4종을 포함하는지 검증하는 테스트는 없다.
- 제안: `presentation.ts` 상수 파일에 대한 별도 단위 테스트(또는 기존 spec 안에 케이스 추가)로 `PRESENTATION_NODE_TYPES`가 정확히 `{'carousel','table','chart','template'}`임을 고정하거나, 백엔드 emit 테스트에 `carousel` 케이스를 1개 추가하여 회귀를 잠근다.

### [INFO] blocking(버튼 포함) presentation 노드 미발행 케이스 테스트 부재
- 위치: 동일 `describe('execution.message …')` 블록
- 상세: 계획 문서(Phase 5)에서 "blocking(버튼) 케이스 미발행" 테스트를 명시했으나, 실제 추가된 테스트는 비-presentation 노드(plain_node) 미발행만 검증한다. presentation 노드이지만 버튼이 있어 `isBlocking=true`인 경로(예: carousel with buttons)에서 `execution.message`가 발행되지 않음을 확인하는 케이스가 없다.
- 제안: `output.status = 'waiting_for_input'`을 반환하는 carousel 핸들러 픽스처로 blocking 케이스 테스트를 추가한다. 코드 경로가 `isBlocking` 분기로 분기되므로 회귀 위험이 실재한다.

### [INFO] `parseMessage` — chart 노드 케이스 누락
- 위치: `codebase/channel-web-chat/src/lib/eia-events.test.ts` — `describe('parseMessage …')` 블록
- 상세: `template`·`carousel`·`table` 3종의 타입별 케이스는 있으나 `chart`는 없다. `parseMessage`가 passthrough라 로직 분기는 없지만, 약속된 4종 중 하나의 wire shape 회귀를 잠그지 못한다.
- 제안: `chart` 노드 픽스처(예: `config.chartType`, `output.data`)를 한 케이스 추가한다.

### [INFO] `use-widget.ts` `execution.message` → `AI_MESSAGE` dispatch 경로 단위 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `else if (name === "execution.message")` 분기
- 상세: `parseMessage` 자체는 `eia-events.test.ts`로 검증되나, `use-widget.ts`의 `handleEiaEvent` 내 새 분기가 실제로 `dispatch({ type: "AI_MESSAGE", text: "", presentations })`를 호출하는지 — 특히 `presentations`가 `undefined`일 때 dispatch를 건너뛰는지 — 를 검증하는 단위 테스트가 없다. 해당 위젯 훅 테스트 파일이 존재한다면 이 분기를 커버해야 한다.
- 제안: `use-widget.test.ts`(또는 동등 파일)에 `execution.message` 이벤트 수신 시 state에 presentation 말풍선이 추가됨을 검증하는 케이스를 추가한다. `presentations`가 비어 있을 때 dispatch가 생략됨도 함께 확인한다.

### [INFO] `resetSession` wc:command 핸들러 단위 테스트 없음
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `case "resetSession":` 분기
- 상세: `apiRef.current.newChat()`이 `resetSession` 커맨드 수신 시 호출되는지를 검증하는 테스트가 없다. `postCommand`→postMessage→onCommand 경로 전체가 테스트 미커버다.
- 제안: `use-widget.ts`의 커맨드 핸들러를 순수 함수나 별도 추출 함수로 분리하거나, 위젯 훅 테스트에서 `window.postMessage` mock을 통해 `resetSession` 커맨드가 `newChat()`을 트리거함을 검증한다.

### [INFO] `LivePreview.postCommand` — widgetOrigin 없을 때 전송 생략 단위 테스트 없음
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` — `postCommand` 함수
- 상세: `widgetOrigin`이 `null`/빈값일 때 `postMessage`를 호출하지 않는 보안 가드를 검증하는 테스트가 없다. `postBoot`와 동형이지만 별도 함수이므로 회귀 가드가 약하다.
- 제안: `live-preview.tsx` 컴포넌트 테스트(또는 `postCommand` 헬퍼 단위 테스트)에서 `widgetOrigin` 미확보 시 `contentWindow.postMessage`가 호출되지 않음을 검증한다.

### [INFO] e2e 테스트 계획은 있으나 미구현 — 차단 환경 이슈
- 위치: Plan Phase 5-2 (`make e2e-test`)
- 상세: 계획 문서에는 "캐러셀(버튼)→템플릿→AI 흐름에서 SSE로 `execution.message`가 템플릿 output.rendered를 운반함을 검증"하는 e2e 테스트가 명시되어 있으나, 커밋에는 포함되지 않았다. Docker VM 디스크 소진으로 인한 인프라 차단 이슈가 배경이나, e2e 커버리지가 없는 상태로 머지되는 점은 기록한다.
- 제안: Docker 환경 복구 후 e2e 케이스를 별도 커밋으로 추가하거나, 해당 플로우를 통합 테스트 수준으로 대체 커버한다.

---

## 요약

핵심 로직(`parseMessage`, 백엔드 `execution.message` emit 여부)은 단위 테스트로 커버되며 테스트 격리·가독성·mock 적절성 모두 양호하다. 주요 갭은 (1) blocking presentation 노드에서의 미발행 케이스가 계획에 명시되었으나 누락된 점, (2) `use-widget.ts`의 `execution.message` 분기와 `resetSession` 커맨드 핸들러가 단위 테스트로 직접 검증되지 않는 점, (3) chart 노드 parseMessage 케이스 누락, (4) e2e 커버 미구현 등 INFO 등급 6개로 CRITICAL/WARNING은 없다. 4종 모두를 단일 조건으로 처리하는 설계 덕분에 실수 가능성이 낮고, 기존 `parseAiMessage`와 동일 패턴을 재사용해 테스트 가독성과 의도 표현이 명확하다.

## 위험도

LOW
