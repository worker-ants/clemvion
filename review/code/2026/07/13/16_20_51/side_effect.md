# 부작용(Side Effect) Review — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (2-edge.md §4/§5)

## 발견사항

- **[INFO]** `onEdgeMouseEnter`/`onEdgeMouseLeave` 콜백이 기존 `setHoveredEdge` 부작용에 새 부작용(타이머 예약/취소 + 모달 트리거)을 추가 — React Flow 로 넘기는 함수 타입 시그니처(`(event, edge) => void` / `() => void`)는 그대로라 호출자(React Flow) 영향은 없다.
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:250-266`
  - 상세: 이전에는 엣지 hover 가 `setHoveredEdge(edge.id)`(§3.3 하이라이팅)만 트리거했다. 이번 변경으로 모든 엣지 hover/leave 가 추가로 `edgeHoverPreview.show`/`scheduleHide`(타이머 예약·`setState`)를 항상 함께 트리거하도록 확장됐다. 두 상태(캔버스 hover store 의 `hoveredEdgeId`, 신규 로컬 `edgeHoverPreview` state)는 서로 독립적인 저장소라 상호 오염은 없고, 콜백의 외부 계약(파라미터 타입·반환 타입)도 변경되지 않아 React Flow 쪽 호출부에는 영향이 없다. 의도된 기능 확장이며 회귀는 아니다.
  - 제안: 조치 불필요 — 의도된 동작. 향후 유지보수 시 "엣지 hover 는 두 개의 독립 상태를 동시에 갱신한다"는 사실만 참고.

- **[INFO]** 신규 공개 selector `findLatestResultByNodeId` 가 `ExecutionState` 인터페이스에 additive 로 추가됨 — 기존 소비처·시그니처 영향 없음(실측 확인)
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts:295-304`(인터페이스), `:712-718`(구현)
  - 상세: `grep` 으로 전수 확인한 결과 이 신규 메서드의 유일한 소비처는 `edge-data-preview.tsx` `useEdgeFlowData` 뿐이며, 기존 `findNodeResult`/`lastIndexByNodeId`/`nodeResults` 등 기존 필드·메서드는 시그니처·동작 변경 없이 그대로 유지된다. 구현은 `get()` 을 통한 읽기 전용 조회이며 `set()` 을 호출하지 않아 store 상태를 변경하지 않는다(순수 selector). Zustand store 는 앱 전역 단일 인스턴스이므로 "전역 상태"에 해당하지만, 이번 변경은 그 전역 상태를 **읽는 새 방법**을 추가했을 뿐 기존 mutation 경로·다른 소비처의 동작에 영향이 없다.
  - 제안: 조치 불필요. 참고로만 기록.

- **[INFO]** `EdgeDataModal` 이 공유 `Dialog`(Radix) 프리미티브를 사용 — 열릴 때 포털 마운트·포커스 트랩·바디 스크롤 락 등 라이브러리 표준 부작용이 발생하나, 이는 기존에도 다른 컴포넌트(`container-delete-dialog.tsx` 등)가 동일하게 사용 중인 기존 라이브러리 동작이라 이번 변경이 새로 도입한 부작용 패턴은 아니다.
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataModal`, `Dialog`/`DialogContent`)
  - 상세: `open={edgeId !== null}` 로 모달을 제어하며 `onOpenChange` 를 통해서만 닫히므로 예상치 못한 자동 닫힘·상태 누출은 관찰되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 2개 파일이 실제 싱글턴 Zustand store(`useExecutionStore`)를 mock 없이 `setState` 로 직접 시딩
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx` (`seedResult`, `beforeEach`), `use-edge-hover-preview.test.ts` 는 store 를 건드리지 않음(해당 없음)
  - 상세: `edge-data-preview.test.tsx` 는 모듈 레벨 싱글턴 store 의 `nodeResults`/`lastIndexByNodeId` 를 `beforeEach` 에서 매번 빈 상태로 리셋하고 `afterEach(() => cleanup())` 으로 DOM 을 정리해, 파일 내부 격리는 확보돼 있다. 다만 스위트 종료 후 store 를 "이전 상태"로 복원하는 로직은 없다(다른 테스트 파일이 이 store 의 초기 상태에 의존한다면 실행 순서에 따라 영향받을 수 있으나, Vitest 는 기본적으로 파일 단위로 모듈을 격리 실행하므로 실질 위험은 낮다). 코드베이스에 이미 존재하는 패턴(다른 canvas 테스트도 동일하게 `setState` 직접 시딩)과 일치해 이번 PR 만의 새로운 리스크는 아니다.
  - 제안: 조치 불필요(기존 관례와 일치). 필요 시 `afterEach` 에 store 초기화를 추가해 완전한 대칭을 만들 수 있으나 낮은 우선순위.

- **[없음 — 확인된 정상 동작]** 이전 라운드(`review/code/2026/07/13/15_52_56/side_effect.md`) 가 지적한 "언마운트 시 pending hide-timer 미정리" 는 이번 diff 에 이미 반영되어 해소됨(`use-edge-hover-preview.ts` `useEffect(() => clearTimer, [clearTimer])`).
- **[없음 — 확인된 정상 동작]** `summarizeDataForPreview`/`formatBytes`(`lib/utils/edge-data-preview.ts`)는 입력을 변형하지 않는 순수 함수이며, `JSON.stringify` 실패(순환 참조 등)를 try/catch 로 흡수해 예외를 호출자에 전파하지 않는다.
- **[없음 — 확인된 정상 동작]** 신규 코드 전 구간에 `window`/`document`/`localStorage`/`sessionStorage`/`process.env` 직접 접근이 없음(grep 확인). 네트워크 호출(`fetch`/axios 등)도 없다 — `useExecutionStore.nodeResults` 를 read-only 로 구독할 뿐이다.
- **[없음 — 확인된 정상 동작]** i18n dict(`dict/ko|en/editor.ts`) 변경은 신규 키 4개 추가뿐이라 기존 키·기존 소비처에 영향 없음. `CHANGELOG.md`/`plan/*.md`/`spec/3-workflow-editor/2-edge.md`/mdx 변경은 문서 전용이라 런타임 부작용과 무관.

## 요약

이번 변경은 워크플로 편집기 캔버스에 엣지 hover 데이터 미리보기 툴팁 + 전체 데이터 모달을 추가하는 순수 프런트엔드 기능으로, 신규 파일(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`)은 전부 새로 도입돼 기존 함수/컴포넌트 시그니처를 깨지 않았고, 유일하게 확장된 기존 콜백(`onEdgeMouseEnter`/`onEdgeMouseLeave`)도 React Flow 로 노출되는 타입 계약은 그대로 유지한 채 내부 부작용(타이머 예약·모달 상태)만 추가했다. 스토어에 추가된 신규 selector(`findLatestResultByNodeId`)는 읽기 전용이며 grep 으로 전수 확인한 유일한 소비처가 이번 신규 컴포넌트뿐이라 기존 소비처에 영향이 없다. 전역 변수 신설, 파일시스템 부작용, 환경 변수 접근, 네트워크 호출, 공개 API 파괴적 변경은 발견되지 않았다. 이전 라운드(`15_52_56/side_effect.md`)에서 지적된 유일한 항목(언마운트 시 hide-timer 미정리)은 이번 diff 에서 이미 `useEffect` cleanup 으로 해소되었으며, 남은 항목은 모두 정보성(INFO) 관찰에 그친다.

## 위험도

LOW
