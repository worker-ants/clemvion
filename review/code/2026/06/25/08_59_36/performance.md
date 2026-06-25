# 성능(Performance) 리뷰 결과

## 발견사항

- **[INFO]** `PRESENTATION_NODE_TYPES` Set 상수화 — O(1) 멤버십 검사
  - 위치: `codebase/backend/src/common/constants/presentation.ts`
  - 상세: 4개 원소 고정 `Set<string>`을 모듈 스코프 상수로 선언. 렌더마다 재생성되지 않고 싱글톤. `has()` 는 O(1). 이전에 `chat-channel.dispatcher.ts` 에 로컬 `Set` 으로 중복 정의되어 있던 것을 공용 상수로 일원화한 변경은 성능·메모리 양쪽에서 개선이다.
  - 제안: 현행 유지. 변경 불필요.

- **[INFO]** `execution-engine.service.ts` — presentation 노드 분기 추가 비용
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4567 이하 신규 분기
  - 상세: 비차단 노드 완료마다 `PRESENTATION_NODE_TYPES.has(node.type)` 하나의 O(1) Set 조회가 추가된다. 발행 대상인 경우에만 `emitExecution` 호출(새 객체 `{ nodeId, nodeType, presentations: [{ config, output }] }` 1회 생성). 워크플로우 하나에 presentation 노드가 수십 개 있어도 per-node 비용은 상수다. 성능 영향 무시 가능.
  - 제안: 현행 유지.

- **[INFO]** `presentations: [{ config: adapted.config, output: adapted.output }]` — 얕은 복사 여부
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4573-4378
  - 상세: `adapted.config` 와 `adapted.output` 은 이미 엔진이 구성한 객체 참조를 그대로 전달한다. 배열 래퍼 1개와 오브젝트 래퍼 1개만 추가로 할당되며, 내부 데이터를 deep-copy 하지 않는다. SSE 직렬화 시 JSON.stringify 가 1회 호출되므로 추가 메모리 누수 없음.
  - 제안: 현행 유지.

- **[INFO]** `parseMessage` 함수 — 불필요한 객체 생성 없음
  - 위치: `codebase/channel-web-chat/src/lib/eia-events.ts`
  - 상세: `Array.isArray` + 길이 체크 후 배열 참조 통과(pass-through). 새로운 배열을 생성하지 않으며 `undefined` 리터럴 반환도 가벼움. `parseAiMessage` 와 동일 패턴으로 일관성 있음.
  - 제안: 현행 유지.

- **[INFO]** `use-widget.ts` `apiRef` 확장 — 매 렌더 ref 갱신
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L1124-1128
  - 상세: `apiRef.current` 를 매 렌더마다 갱신하는 `useEffect(() => { apiRef.current = {..., newChat}; })` 패턴을 유지한다. deps 배열 없는 effect 라 렌더마다 실행되지만 ref 갱신은 DOM mutation 이 없고 microsecond 급의 object literal 할당이다. 스탈 클로저 회피를 위한 의도된 패턴.
  - 제안: 현행 유지.

- **[INFO]** `postCommand` useCallback — widgetOrigin 의존
  - 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`
  - 상세: `useCallback([widgetOrigin])` 으로 memoize. `widgetOrigin` 이 바뀌지 않는 한(환경 상수) 함수 인스턴스가 안정적이다. `postBoot` 와 동일한 deps 패턴. 버튼 클릭 핸들러라 렌더 부담 없음.
  - 제안: 현행 유지.

- **[INFO]** `window.addEventListener("message", onMessage)` — 매 iframeSrc/widgetOrigin 변경마다 교체
  - 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`
  - 상세: useEffect cleanup 에서 `removeEventListener` 로 이전 리스너를 제거한다. 이벤트 핸들러 누수 없음. `wc:resize` 처리 내 `clamp()` 호출은 단순 수치 연산이라 비용 무시 가능.
  - 제안: 현행 유지.

- **[INFO]** 2-column CSS 그리드 — 레이아웃 관련 성능
  - 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx`
  - 상세: `xl:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]` 는 정적 CSS 클래스로 브라우저 레이아웃 엔진이 처리한다. JS 실행 비용 없음. `xl:sticky xl:top-6` 도 순수 CSS 특성으로 JS 스크롤 리스너 불필요.
  - 제안: 현행 유지.

## 요약

이번 변경은 성능 관점에서 우려할 지점이 없다. 핵심 경로(`execution-engine` 비차단 완료 분기)에 추가된 비용은 모듈 스코프 Set 에 대한 O(1) 조회 1회와 소형 객체 리터럴 할당 1회뿐이며, 이는 기존 `emitNodeEvent` 직후에 조건부로만 실행된다. 프론트엔드 측(`parseMessage`, `postCommand`, `use-widget` apiRef 갱신)도 기존 코드베이스의 확립된 패턴을 동일하게 적용하여 추가 부담이 없다. 로컬 중복 Set 정의를 공용 상수로 통합한 것은 사소하지만 올바른 방향이다. 미리보기 2-column 레이아웃은 순수 CSS Grid + sticky 처리로 JS 런타임 비용이 없다.

## 위험도

NONE
