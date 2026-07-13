# 동시성(Concurrency) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달

대상(동시성 관점 유의미 파일): `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`,
`codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts`,
`codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(diff 부분),
`codebase/frontend/src/lib/utils/edge-data-preview.ts`,
`codebase/frontend/src/lib/stores/execution-store.ts`(신규 `findLatestResultByNodeId`, 및 이를
검증하기 위해 대조한 기존 `addNodeResult`). 나머지(CHANGELOG/mdx 문서/dict/plan/이전 라운드
review 산출물(RESOLUTION·SUMMARY·각 카테고리 md·meta.json·_retry_state.json)/spec)는 서술·메타
변경이라 동시성 분석 대상이 아니다.

## 발견사항

- **[INFO]** `setTimeout` 기반 hover 표시/숨김 상태기계는 "단일 활성 타이머" 불변식을 정확히 유지한다
  - 위치: `use-edge-hover-preview.ts` `show`/`scheduleHide`/`keepAlive`/`dismiss`
  - 상세: 단일 `timer` ref 에 대해 네 함수 모두 진입 시 먼저 `clearTimer()`를 호출한 뒤에만 필요 시
    새 `setTimeout`을 건다. 따라서 "엣지→다른 엣지로 빠르게 스침(sweep)", "엣지→툴팁으로 커서
    이동(`keepAlive`)", "툴팁에서 벗어남(`dismiss`)" 등 어떤 이벤트 순서가 들어와도 동시에 두 개
    이상의 타이머가 살아있는 창이 생기지 않는다(중복 fire·누수 없음). 언마운트 시에도
    `useEffect(() => clearTimer, [clearTimer])`로 대기 타이머를 정리해 언마운트 후 `setPreview`
    호출을 막는다(테스트 `unmount 시 대기 타이머가 정리된다` 로 회귀 가드됨). JS 이벤트 루프는
    단일 스레드이므로 `setTimeout` 콜백과 사용자 이벤트 핸들러가 `timer.current`를 동시에
    읽고-쓰는 실제 데이터 레이스는 발생하지 않으며, "먼저 지우고 다시 건다"는 규율 덕분에
    논리적 레이스(의도치 않은 스케줄 누락/중복)도 없다. 결함 아님 — 양호한 설계로 기록.

- **[INFO]** `findLatestResultByNodeId`의 stale-index 재확인은 실제 앱 경로가 아니라 테스트 seeding
  전용 방어임을 소스 대조로 확인
  - 위치: `execution-store.ts` `findLatestResultByNodeId`(신규, `row?.nodeId === nodeId` 가드) /
    `addNodeResult`(기존, `nodeResults`/`nodeResultIndexByExecId`/`lastIndexByNodeId`/
    `firstNoExecIdIndexByNodeId` 갱신)
  - 상세: 위 `addNodeResult` 전체를 읽어 확인한 결과, target-index 갱신 분기와 신규 append 분기
    양쪽 모두 `nodeResults` 배열과 세 인덱스 Map 을 **하나의 `set(state => ({...}))` 호출**로
    함께 커밋한다(중간에 다른 리듀서가 끼어들 수 있는 별도의 `set()` 호출로 쪼개져 있지 않음).
    Zustand `set` 은 동기적이고 JS 는 단일 스레드이므로, 정상 실행 경로(WS 이벤트 →
    `addNodeResult`)에서는 `lastIndexByNodeId` 가 가리키는 슬롯의 `nodeId` 가 실제와 어긋나는
    윈도우가 존재하지 않는다. `findLatestResultByNodeId` 의 재확인 가드가 실제로 발동하는
    유일한 경로는 테스트가 `useExecutionStore.setState({ nodeResults, lastIndexByNodeId })` 로
    두 필드를 수동 구성해 의도적으로 어긋내는 경우뿐이다(신규 테스트
    `execution-store.test.ts` "인덱스가 stale(다른 nodeId 가 그 슬롯에) 이면 undefined" 가
    정확히 이 패턴). 방어 코드 자체는 "동시성 버그 완화"가 아니라 "프로덕션 불변식이 테스트
    픽스처에서 깨질 수 있음을 fail-safe 로 처리"하는 용도이며 올바르게 작성되어 있다.
    결함 아님.

- **[INFO]** 엣지 hover 데이터 조회는 Zustand 반응형 selector 이므로 렌더 중 읽기 일관성이 보장된다
  - 위치: `edge-data-preview.tsx` `useEdgeFlowData`
    (`useExecutionStore((s) => sourceId ? s.findLatestResultByNodeId(sourceId) : undefined)`)
  - 상세: 컴포넌트는 스토어의 한 스냅샷(`s`)에 대해 그 스냅샷의 메서드(`s.findLatestResultByNodeId`)
    를 호출하므로, 같은 구독 통지 사이클 안에서 `nodeResults`/`lastIndexByNodeId` 는 항상 동일
    커밋에서 읽힌다. 실행 중(Loop/ForEach 로 같은 노드가 여러 번 결과를 보낼 때) 툴팁/모달이 열려
    있는 동안 최신 결과로 화면이 즉시 갱신되는 것은 의도된 반응성이며 레이스가 아니다.

- **[INFO]** `onOpenModal` 콜백의 이중 상태 갱신(`edgeHoverPreview.dismiss()` + `setDataModalEdgeId(id)`)
  은 단일 이벤트 핸들러 내 동기 실행이라 원자적으로 처리됨
  - 위치: `workflow-canvas.tsx` `onOpenModal={(id) => { edgeHoverPreview.dismiss(); setDataModalEdgeId(id); }}`
  - 상세: 두 상태(하나는 `useEdgeHoverPreview` 훅 내부 `preview`, 하나는 캔버스 컴포넌트의
    `dataModalEdgeId`)를 갱신하지만, 같은 클릭 이벤트 핸들러 안에서 순차 동기 호출되고 React 18
    자동 배칭으로 한 커밋에 반영된다. 두 상태 사이에 중간 렌더가 끼어들어 "툴팁은 닫혔는데 모달은
    아직 안 열린" 가시적 불일치 프레임이 생기지 않는다. 결함 아님.

## 확인된 정상 동작(결함 아님, 참고)

- 이번 변경에 async/await, Promise 체인, Web Worker, 백엔드 스레드 풀·DB/네트워크 커넥션이
  전혀 관여하지 않는다 — 순수 클라이언트 렌더링 + 1개의 `setTimeout` 기반 상태기계 + Zustand
  동기 selector 뿐이다. 따라서 데드락·커넥션 풀 크기·await 누락류 항목은 해당 없음.
- 여러 락을 함께 잡는 코드, 모듈 스코프의 공유 뮤터블 변수(전역 `let`/카운터 등)가 없다. 유일한
  "공유 자원"은 Zustand 스토어이며 모든 갱신이 각 액션 내부 단일 `set()` 호출로 원자적이다.
- `summarizeDataForPreview`(`lib/utils/edge-data-preview.ts`)의 바이트 계산(`JSON.stringify(value)`)
  은 hover 경로에서 동기 실행되며 대용량 노드 출력에서는 프레임 드랍을 유발할 수 있음을 코드
  검토로 확인했다. 다만 이는 스레드 안전성·레이스·데드락·원자성 문제가 아니라 **성능**(이벤트
  루프 블로킹 시간) 이슈이므로 본 리뷰(동시성) 판정에는 반영하지 않는다(별도 performance
  리뷰어 영역, 실제로 이전 라운드(`review/code/2026/07/13/16_20_51/performance.md`)에서 다뤄진
  이력이 이번 changeset 에 포함돼 있다).

## 요약

이번 변경(엣지 hover 데이터 미리보기 툴팁 + 전체 데이터 모달, 그리고 이를 포함한 이전 두 라운드
ai-review 산출물의 커밋)은 순수 프런트엔드 React/Zustand 코드로 스레드·프로세스·DB 커넥션·
비동기 I/O 를 다루지 않는다. 동시성 관점에서 살펴볼 실질 대상은 `use-edge-hover-preview.ts` 의
`setTimeout` 기반 표시/숨김 상태기계와 `execution-store.ts` 의 신규 `findLatestResultByNodeId`
selector 두 가지뿐이며, 소스를 직접 대조 확인한 결과 (1) 모든 전이 함수가 기존 타이머를 먼저
취소한 뒤에만 재스케줄해 타이머 leak·중복 fire 가 없고 언마운트 cleanup 도 갖췄으며, (2) 인덱스와
배열은 `addNodeResult` 의 단일 `set()` 호출로 항상 함께 원자적으로 갱신되어 정상 앱 경로에서
stale-index 윈도우가 없다(재확인 가드는 테스트 seeding 전용). 경쟁 조건·데드락·비원자적 복합
연산·await 누락 등 이 리뷰 관점의 실질 결함은 발견되지 않았다.

## 위험도
NONE
