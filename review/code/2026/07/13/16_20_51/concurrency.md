# 동시성(Concurrency) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달

대상: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`,
`use-edge-hover-preview.ts`, `workflow-canvas.tsx`(diff 부분),
`codebase/frontend/src/lib/utils/edge-data-preview.ts`,
`codebase/frontend/src/lib/stores/execution-store.ts`(`findLatestResultByNodeId`).
나머지(CHANGELOG/mdx/dict/plan/review 산출물/spec)는 서술·메타 변경이라 동시성 관점 대상 아님.

## 발견사항

- **[INFO]** 타이머 기반 hover 상태기계는 "단일 활성 타이머" 불변식을 정확히 유지한다
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts` `show`/`scheduleHide`/`keepAlive`/`dismiss`
  - 상세: `hideTimer`(단일 `ref`)에 대해 네 함수 모두 실행 전에 먼저 `clearTimer()`를 호출한 뒤에만 필요 시 새 `setTimeout`을 건다. 따라서 "엣지→다른 엣지로 빠르게 이동", "엣지→툴팁으로 커서 이동(`keepAlive`)", "툴팁에서 벗어남(`dismiss`)" 등 어떤 이벤트 순서로 들어와도 동시에 두 개 이상의 숨김 타이머가 살아있는 창이 생기지 않는다(스케줄 타이머 leak/중복 fire 없음). 언마운트 시에도 `useEffect(() => clearTimer, [clearTimer])`로 pending 타이머를 정리해, 컴포넌트가 사라진 뒤 `setPreview`가 뒤늦게 실행되는 경우(React 18에서 크래시는 아니지만 낭비되는 클로저/타이머)를 막는다. JS 이벤트 루프가 단일 스레드이므로 `setTimeout` 콜백과 `show`/`dismiss` 등 사용자 이벤트 핸들러가 실제로 인터리빙되며 `hideTimer.current`를 동시에 읽고 쓰는 진짜 레이스는 발생하지 않는다 — 다만 위와 같이 "먼저 지우고 다시 건다"는 규율을 지켰기 때문에 논리적 레이스(스케줄 누락/중복)도 없다는 점을 확인했다. 결함 아님(양호한 설계로 기록).

- **[INFO]** `findLatestResultByNodeId`의 "stale index" 방어 코드는 실제 앱 경로의 레이스가 아니라 테스트 seeding 시나리오를 겨냥한 것으로 확인됨
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `findLatestResultByNodeId`(신규) / `addNodeResult`(기존, 라인 567~690 부근)
  - 상세: `addNodeResult`는 `nodeResults`, `lastIndexByNodeId`(및 `nodeResultIndexByExecId`/`firstNoExecIdIndexByNodeId`)를 **하나의 `set()` 호출**로 함께 갱신한다(라인 605~690 부근에서 세 Map을 복제한 뒤 한 번의 `set({...})`로 커밋). Zustand의 `set`은 동기적이고 JS는 단일 스레드이므로, 이 인덱스와 배열이 서로 다른 상태를 가리키는(즉 `lastIndexByNodeId`가 가리키는 행의 `nodeId`가 실제로 다른) 윈도우는 정상 실행 경로(WS 이벤트 → `addNodeResult`)에서는 존재하지 않는다. `findLatestResultByNodeId`가 `row?.nodeId === nodeId` 로 재확인하는 방어 코드의 JSDoc 주석("raw setState seeding 등")대로, 실제로 이 불일치가 발생할 수 있는 유일한 경로는 테스트 코드가 `useExecutionStore.setState({ nodeResults, lastIndexByNodeId })`로 두 필드를 수동 구성할 때뿐이다(본 PR의 `edge-data-preview.test.tsx`/신규 테스트가 정확히 이 패턴을 사용). 즉 이 가드는 "동시성 버그의 완화"가 아니라 "프로덕션 불변식이 테스트 픽스처에서 깨질 수 있음을 방어"하는 코드이며, 올바르게 작성되어 있다. 결함 아님.

- **[INFO]** 엣지 hover 데이터 조회는 Zustand 반응형 selector라 렌더 중 읽기 일관성이 보장된다
  - 위치: `edge-data-preview.tsx` `useEdgeFlowData`(`useExecutionStore((s) => sourceId ? s.findLatestResultByNodeId(sourceId) : undefined)`)
  - 상세: 컴포넌트는 스토어의 스냅샷(`s`)에 대해 그 스냅샷의 액션(`s.findLatestResultByNodeId`)을 호출하므로, 같은 렌더/구독 통지 사이클 안에서 조회된 `nodeResults`/`lastIndexByNodeId`는 항상 동일 커밋의 것이다. 실행 중(Loop/ForEach로 같은 노드가 여러 번 결과를 보낼 때) 모달/툴팁이 열려 있는 동안 해당 노드의 최신 결과로 화면이 즉시 갱신되는 것은 의도된 반응성이며, "레이스"가 아니라 정상 동작이다.

## 확인된 정상 동작(결함 아님)

- 신규 코드에 async/await, Promise 체인, Web Worker, 스레드 풀, DB/네트워크 커넥션이 전혀 없다 — 순수 클라이언트 렌더링 + 1개의 `setTimeout` 기반 상태기계 + Zustand 동기 selector 뿐이다.
- 여러 락을 함께 잡는 코드, 공유 뮤터블 전역(모듈 스코프 `let`/카운터 등)이 없다 — 유일한 "공유 상태"는 Zustand 스토어이며 갱신은 각 액션 내부에서 단일 `set()` 호출로 원자적이다.
- 이벤트 루프 블로킹: `summarizeDataForPreview`/`JSON.stringify`가 hover/렌더 경로에서 무가드로 동기 실행되는 점은 실측했으나(대용량 데이터 시 프레임 드랍 가능), 이는 스레드 안전성·레이스·데드락 문제가 아니라 **성능** 이슈이므로 performance 리뷰어의 발견(WARNING)으로 이미 다뤄진 영역이다. 본 리뷰(동시성) 관점에서는 정답성에 영향 없음.

## 요약

이번 변경(엣지 hover 데이터 미리보기 툴팁 + 전체 데이터 모달)은 순수 프런트엔드 React/Zustand 코드로, 스레드·프로세스·DB 커넥션·비동기 I/O 를 다루지 않는다. 유일하게 동시성 관점에서 살펴볼 대상은 `use-edge-hover-preview.ts`의 `setTimeout` 기반 표시/숨김 상태기계와 `execution-store.ts`의 신규 `findLatestResultByNodeId` selector 인데, 둘 다 실제 코드를 대조 확인한 결과 (1) 매 전이마다 기존 타이머를 먼저 취소하는 규율로 타이머 leak/중복 fire가 없고 언마운트 cleanup도 갖췄으며, (2) 인덱스-배열 쌍은 `addNodeResult`의 단일 `set()` 호출로 원자적으로 갱신되어 정상 앱 경로에서 stale index 윈도우가 없다(방어 코드는 테스트 seeding 전용). 경쟁 조건·데드락·비원자적 복합 연산·await 누락 등 이 리뷰 관점의 실질 결함은 발견되지 않았다.

## 위험도
NONE
