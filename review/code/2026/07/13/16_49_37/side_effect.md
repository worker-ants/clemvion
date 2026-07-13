# 부작용(Side Effect) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (§4/§5, 3회차 최종 상태)

본 라운드는 `review/code/2026/07/13/15_52_56`(1회차, CRITICAL)·`16_20_51`(2회차, MEDIUM)의 RESOLUTION 이 모두
반영된 최종 diff 를 대상으로 한다. 1회차 side_effect 리뷰가 지적한 "unmount 시 pending hide-timer 미정리"
항목이 실제로 해소됐는지 재확인하고, 그 위에서 신규/잔존 부작용을 점검했다.

## 이전 라운드 대비 해소 확인 (재검증)

- **[해소 확인]** unmount 시 pending 타이머 미정리 — `use-edge-hover-preview.ts` 에
  `useEffect(() => clearTimer, [clearTimer]);` 가 추가되어, 컴포넌트 언마운트 시 `show`/`scheduleHide` 가
  예약한 `setTimeout` 이 확실히 `clearTimeout` 된다. `use-edge-hover-preview.test.ts` "unmount 시 대기
  타이머가 정리된다" 케이스로 회귀 가드도 확보됨.

## 발견사항

- **[INFO]** hover 이벤트가 이제 부가 부작용(타이머 예약 + store 읽기)을 유발하도록 콜백이 확장됨 — 의도된 변경
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onEdgeMouseEnter`/`onEdgeMouseLeave`
  - 상세: 기존에는 `onEdgeMouseEnter`/`onEdgeMouseLeave` 가 `setHoveredEdge`(하이라이트 상태) 하나만 갱신했다.
    이번 diff 로 `onEdgeMouseEnter` 는 `edgeHoverPreview.show(edge.id, event.clientX, event.clientY)`(90ms 지연
    타이머 예약)를, `onEdgeMouseLeave` 는 `edgeHoverPreview.scheduleHide()`(200ms 지연 타이머 예약)를 추가로
    호출한다. `onEdgeMouseEnter` 의 첫 번째 파라미터도 `_`(미사용)에서 `event`(사용)로 바뀌었다. 두 콜백 모두
    React Flow 에 전달되는 **내부** prop 이라 외부 공개 시그니처·다른 소비처에 영향은 없고, 부가 부작용은
    `use-edge-hover-preview.ts` 내부에 캡슐화된 로컬 컴포넌트 state(`preview`)에만 국한된다. 전역 상태·DOM
    이벤트 리스너 직접 등록(`addEventListener`)·네트워크 호출은 없다. 기능 요구사항(§4/§5) 그대로의 확장이라
    결함은 아니며, 참고 목적으로 기록한다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 store selector `findLatestResultByNodeId` 는 순수 읽기 전용 — 상태 변경 없음
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `findLatestResultByNodeId`
  - 상세: `get()` 으로 현재 스냅샷만 읽고 `set()` 호출이 전혀 없다. `ExecutionState` 인터페이스에 메서드가
    하나 추가됐을 뿐 기존 필드·메서드 시그니처는 무엇도 변경되지 않아 순수 additive 변경이다(기존
    `findNodeResult` 등 다른 소비처에 영향 없음). 전역 변수 신설도 아니다(스토어 자체가 이미 존재하는 전역
    싱글턴이며, 이 diff 는 그 위에 읽기 전용 메서드만 얹는다).
  - 제안: 조치 불필요.

- **[INFO]** 테스트 파일들이 Zustand 전역 싱글턴 store 를 `setState` 로 직접 시딩 — 격리 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx`
    (`beforeEach(() => useExecutionStore.setState({ nodeResults: [], lastIndexByNodeId: new Map() }))`),
    `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts` (신규 `describe("findLatestResultByNodeId")`
    안에서 raw `setState({ nodeResults, lastIndexByNodeId })` 로 stale-index 케이스 시딩)
  - 상세: `useExecutionStore` 는 모듈 스코프 싱글턴이라 `setState` 직접 호출은 전역 공유 상태를 수정하는
    행위이지만, `execution-store.test.ts` 최상단에 이미 `beforeEach(() => useExecutionStore.setState(initialState))`
    (기존 코드, line 43)가 있어 매 테스트 전 전체 상태가 리셋되고, `edge-data-preview.test.tsx` 도 자체
    `beforeEach` 로 관련 두 필드를 리셋한다. vitest 는 테스트 파일별 모듈 컨텍스트가 분리되므로 파일 간
    상태 누수는 없고, 같은 파일 내에서도 각 `it` 전에 리셋되어 순서 의존성이 없음을 확인했다. 결함 아님.
  - 제안: 조치 불필요(참고: `edge-data-preview.test.tsx` 의 리셋은 `getInitialState()` 전체가 아니라 이
    테스트가 쓰는 두 필드만 리셋하는 좁은 리셋인데, 이는 해당 파일이 그 두 필드만 사용하므로 현재는 문제
    없으나, 향후 다른 필드를 참조하는 테스트가 이 파일에 추가되면 놓칠 수 있어 낮은 우선순위로만 기록).

- **[INFO]** `edges` 배열/`useExecutionStore` selector 구독이 모달이 닫혀 있어도 상시 활성 — 부작용 아님(성능 영역과 중복)
  - 위치: `edge-data-preview.tsx` `EdgeDataModal`(`dataModalEdgeId === null` 이어도 `useEdgeFlowData` 호출)
  - 상세: 상시 구독 자체는 상태를 변경하지 않는 읽기 전용 selector 라 부작용 관점에서는 문제가 없다(추가
    렌더 비용은 이미 performance 리뷰어가 별도로 다룬 영역).

## 확인된 정상 동작(참고)

- 신규 파일(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`)은 전부
  새 파일이라 기존 함수/컴포넌트의 시그니처를 변경하지 않는다.
- 환경 변수 읽기/쓰기, 네트워크 호출(fetch/axios/WebSocket), `document`/`window` 전역 객체 직접 조작, 파일시스템
  접근이 전 구간에서 전혀 없다(순수 클라이언트 렌더링 + `setTimeout` 상태기계 + Zustand 읽기 전용 selector).
- `summarizeDataForPreview`/`formatBytes` 는 입력을 변형하지 않는 순수 함수이며, 순환 참조 등 직렬화 실패도
  try/catch 로 흡수해 예외를 외부로 전파하지 않는다(부작용으로서의 미처리 예외 전파 없음).
- `CHANGELOG.md`/`plan/in-progress/spec-sync-edge-gaps.md`/`spec/3-workflow-editor/2-edge.md`/mdx 문서 변경은
  해당 작업(§4/§5 구현 완료 반영)에 정확히 대응하는 의도된 문서 갱신이며, 코드 실행 경로의 부작용이 아니다.
- `review/code/2026/07/13/{15_52_56,16_20_51}/*` 산출물은 이전 ai-review 라운드의 정식 기록물로, 프로젝트
  관례(`review/**`)에 따라 커밋 대상이며 예상치 못한 파일 생성이 아니다.

## 요약

이번 변경은 워크플로 편집기 캔버스에 엣지 hover 데이터 미리보기 툴팁 + 전체 데이터 모달을 추가하는 순수
프런트엔드 기능으로, 1회차 ai-review 가 지적한 "unmount 시 pending hide-timer 미정리" 가 이번 최종 상태에서
`useEffect` cleanup 추가로 실제로 해소되었음을 코드로 재확인했다. `onEdgeMouseEnter`/`onEdgeMouseLeave` 콜백이
새로운 부가 동작(타이머 예약)을 갖게 됐지만 이는 React Flow 에 전달되는 내부 콜백의 의도된 기능 확장이고
외부 공개 시그니처·다른 소비처에는 영향이 없다. 신규 store selector `findLatestResultByNodeId` 는 순수
읽기 전용 additive 메서드로 기존 API 를 변경하지 않는다. 전역 변수 신설, 예상치 못한 파일시스템 조작, 환경
변수 접근, 네트워크 호출, 이벤트/콜백의 의도치 않은 재배선은 발견되지 않았다. 테스트 파일들의 Zustand
전역 store 직접 `setState` 시딩도 기존/신규 `beforeEach` 리셋으로 격리가 확인된다.

## 위험도
NONE
