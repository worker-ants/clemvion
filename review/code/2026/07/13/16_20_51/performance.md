# 성능(Performance) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (재검토, 15_52_56 리뷰 fix 반영본)

대상: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`,
`use-edge-hover-preview.ts`, `workflow-canvas.tsx`(diff 부분),
`codebase/frontend/src/lib/utils/edge-data-preview.ts`,
`codebase/frontend/src/lib/stores/execution-store.ts`(`findLatestResultByNodeId`).

본 diff 는 직전 라운드(`review/code/2026/07/13/15_52_56`)의 performance WARNING 2건 + INFO 2건에 대한
`RESOLUTION.md` 반영분을 포함한다. 아래는 그 반영 상태를 실코드로 재확인하고, 잔여 항목을 재평가한다.

### 이전 라운드 대비 확인된 해소 사항 (결함 아님, 참고)

- **O(n) 역방향 스캔 → O(1) 인덱스 조회로 교체**: `execution-store.ts` 에 `findLatestResultByNodeId(nodeId)`
  (`lastIndexByNodeId` Map 조회 1회 + stale 방지 재확인)가 신설되었고, `useEdgeFlowData` 는
  `useExecutionStore((s) => sourceId ? s.findLatestResultByNodeId(sourceId) : undefined)` 로 이를
  반응형 selector 로 소비한다(`edge-data-preview.tsx:401-403`). 실제 O(1) 로 동작함을 스토어 구현(Map
  기반, `nodeResults[idx]?.nodeId === nodeId` 검증만 추가)으로 확인.
- **`EdgeDataModal` 의 무가드 `edges.find` 반복 스캔 제거**: `useEdgeFlowData` 내부 `edge` 계산이
  `edgeId ? edges.find(...) : undefined` 로 바뀌어(`edge-data-preview.tsx:396-399`), 모달이 닫혀
  `edgeId=""` 일 때는 스캔 자체가 스킵된다.
- **`useEdgeHoverPreview()` 반환 객체 참조 안정성**: `return useMemo(() => ({ preview, show, scheduleHide,
  keepAlive, dismiss }), [...])` 로 감싸져 `workflow-canvas.tsx` 의 `onEdgeMouseEnter`/`onEdgeMouseLeave`
  `useCallback` deps 무력화 문제 해소.
- **모달 인라인 `JSON.stringify` → 공용 `JsonContent` 재사용**: `EdgeDataModal` 이 자체 `<pre>` 마크업
  대신 `run-results/renderers/presentation-renderers.tsx` 의 `JsonContent` 를 재사용해 렌더 로직 중복이
  사라졌다.
- **툴팁 축약 계산 메모이제이션**: `const summary = useMemo(() => summarizeDataForPreview(data), [data]);`
  로, `data` 참조가 바뀔 때(= 다른 엣지를 hover 하거나 실제 실행 결과가 갱신될 때)만 재계산되며 무관한
  리렌더마다 재실행되지 않는다.

### 발견사항

- **[WARNING]** 바이트 크기 계산이 여전히 크기 상한·디바운스 없이 원본 전체를 동기 직렬화
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview` (`JSON.stringify(value)` 전체 + `new TextEncoder().encode(full)`)
  - 상세: 미리보기 문자열(`abbreviate()`)은 depth/개수로 잘 제한되지만, 바이트 크기 계산용 `JSON.stringify(value)` 는 **축약 전 원본 전체**를 대상으로 하고 크기 상한이 없다. 이번 라운드에서 `useMemo(() => summarizeDataForPreview(data), [data])` 로 감싸져 "같은 엣지를 hover 중 무관한 리렌더가 반복 계산을 유발"하는 경로는 사라졌지만, 근본 문제는 그대로 남는다 — **캔버스 위에서 마우스를 서로 다른 여러 엣지 위로 빠르게 스치면 `edgeId`/`sourceId`/`data` 참조가 매번 바뀌므로 `useMemo` 캐시가 매 엣지마다 새로 미스되어, hover 하는 엣지 수만큼 전체 직렬화+`TextEncoder` 인코딩이 그대로 동기 실행된다.** `show()` 는 `scheduleHide()` 와 달리 디바운스가 없어 즉시 트리거된다. 대용량 노드 출력(리포 컨벤션상 `render_table` 계열 등에서 MB 단위까지 허용)을 만드는 노드가 많은 워크플로에서는 여러 엣지를 빠르게 훑는 동안 누적된 메인스레드 블로킹으로 체감 버벅임이 발생할 수 있다.
  - 제안: (1) 바이트 크기 계산에 상한을 두어(예: `full.length > CAP` 이면 `TextEncoder` 인코딩 생략하고 `~`(근사치) 표시로 대체), 정확한 바이트 수보다 렌더 비용을 우선한다. (2) `edgeHoverPreview.show()` 호출에도 짧은(예: 80~120ms) 디바운스를 둬 스쳐 지나가는 hover 에서는 계산 자체가 트리거되지 않게 한다. (3) 이미 `abbreviate()` 가 순회하므로, 원한다면 바이트 계산과 미리보기 문자열 생성을 한 번의 순회로 합쳐 중복 순회(축약용 1회 + 바이트용 1회, 총 데이터를 2번 훑음)를 줄일 수도 있다.

- **[INFO]** `abbreviate()` 의 객체 분기가 슬라이스 전 전체 키를 eager 하게 열거
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `abbreviate` (`const entries = Object.entries(value as Record<string, unknown>);` 이후 `entries.slice(0, MAX_TOP_KEYS)`)
  - 상세: 배열 분기는 `value.slice(0, MAX_TOP_ARRAY)` 로 필요한 앞부분만 다루지만, 객체 분기는 `Object.entries(value)` 로 **전체 키를 먼저 열거**한 뒤에야 `slice(0, 20)` 으로 자른다. 필드 수가 매우 큰(수백~수천 개) 최상위 객체를 만드는 노드가 있다면, 실제로 화면에 쓰이는 20개를 위해 불필요하게 전체 키 배열을 메모리에 구성한다. 실무에서는 영향이 작겠지만 depth-1 재귀 호출마다 반복되는 패턴이라 짚어둔다.
  - 제안: 우선순위 낮음 — 필요 시 `Object.keys(value).length` 로 개수만 얻고 `for...in`/`Object.entries` 순회를 20개에서 조기 종료하도록 바꾸면 완전히 없앨 수 있다.

- **[INFO]** "nodeId → 최근 실행 결과" O(1) selector 신설에도 기존 중복 구현이 통합되지 않음
  - 위치: 신규 `execution-store.ts` `findLatestResultByNodeId` vs 기존 `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:508-513` (`InfoTab`, `for (let i = nodeResults.length - 1; i >= 0; i--) if (nodeResults[i].nodeId === nodeId) ...`)
  - 상세: 직전 라운드 architecture/performance 리뷰가 지적한 "O(n) 역방향 스캔이 이미 다른 곳(`node-settings-panel.tsx`)에도 존재" 이슈는, 이번 fix 로 **새 소비처(`useEdgeFlowData`)만** O(1) selector 로 옮겨졌을 뿐, 기존 `node-settings-panel.tsx` 의 동일 패턴은 그대로 남아 있다(`nodeResults` 가 커지는 Loop/ForEach 워크플로에서 설정 패널을 열어둔 채 실행하면 매 결과 도착마다 여전히 전체 역스캔). 새 결함은 아니고 이번 diff 범위 밖 파일이지만, 방금 만든 공유 selector 를 이 소비처에도 적용할 수 있는 기회가 이번엔 활용되지 않았다.
  - 제안: 이번 PR 스코프는 아니나, 후속으로 `node-settings-panel.tsx`(및 `use-expression-context.ts` 계열)를 `findLatestResultByNodeId` 로 이관하는 별도 정리 권장.

### 요약

직전 라운드(15_52_56)에서 지적된 성능 WARNING 2건(O(n) 역스캔 재도입, 무가드 직렬화/미메모이제이션)과 INFO
2건(훅 반환 객체 참조 불안정, 닫힌 모달의 무의미한 스캔)은 이번 diff 의 `RESOLUTION.md` 반영분에서 실코드
기준으로 확인 시 대부분 해소되었다 — 스토어에 O(1) `findLatestResultByNodeId` selector 가 신설·연결되었고,
`useEdgeHoverPreview` 반환값과 툴팁 요약 계산이 메모이제이션되었으며, 모달은 닫혀 있을 때 스캔을 건너뛰고
공용 `JsonContent` 를 재사용한다. 다만 바이트 크기 계산용 `JSON.stringify(value)` 는 여전히 크기 상한이나
hover 디바운스 없이 원본 전체를 동기 직렬화하므로, 대용량 노드 출력을 가진 여러 엣지를 빠르게 훑는
시나리오에서는 메인 스레드 블로킹이 누적될 수 있다(메모이제이션은 "같은 엣지 반복 hover"만 완화하고
"서로 다른 엣지를 스치는 sweep" 은 완화하지 못함). 이 외에 `abbreviate()` 의 eager 키 열거, 스토어 신규
selector 가 기존 중복 소비처(`node-settings-panel.tsx`)에는 아직 적용되지 않은 점은 경미한 참고 사항이다.
전반적으로 즉시 병합 차단 수준의 성능 결함은 없다.

### 위험도

LOW
