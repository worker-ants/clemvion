# 성능(Performance) 리뷰 — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (3-workflow-editor/2-edge §4/§5, 3라운드 누적 fix 반영본)

대상: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`,
`use-edge-hover-preview.ts`, `workflow-canvas.tsx`(diff 부분),
`codebase/frontend/src/lib/utils/edge-data-preview.ts`,
`codebase/frontend/src/lib/stores/execution-store.ts`(`findLatestResultByNodeId`).

본 diff 는 이미 두 차례 ai-review(`15_52_56`, `16_20_51`)를 거쳐 성능 관련 WARNING(O(n) 역스캔 재도입,
훅 반환 객체 참조 불안정, sweep 시 무가드 직렬화)이 대부분 반영된 상태다. 최종 코드를 기준으로 재확인한다.

## 확인된 해소 사항 (결함 아님, 참고)

- **O(1) selector 재사용**: `execution-store.ts` `findLatestResultByNodeId(nodeId)` 가 `lastIndexByNodeId`
  Map 조회 1회(+ stale-index 재확인)로 동작하고, `useEdgeFlowData` 가 이를 반응형 selector 로 소비한다
  (`edge-data-preview.tsx` `useExecutionStore((s) => sourceId ? s.findLatestResultByNodeId(sourceId) : undefined)`).
  기존 `nodeResults` 전체 역방향 선형 스캔 반패턴은 이 소비처에서는 제거됐다.
- **sweep 방어(entry debounce)**: `use-edge-hover-preview.ts` `show()` 에 `SHOW_DELAY_MS=90` 진입 지연이
  추가돼, 커서가 여러 엣지를 빠르게 스치는 동안에는 `setPreview` 자체가 호출되지 않는다. `EdgeDataPreviewTooltip`
  은 `preview` 가 설정된 뒤에만 마운트되므로(`{edgeHoverPreview.preview && <EdgeDataPreviewTooltip .../>}`),
  `summarizeDataForPreview` 의 무거운 직렬화도 정착한 엣지 1개에만 실행된다 — sweep 시나리오의 누적 메인스레드
  블로킹은 사실상 해소.
- **훅 반환 참조 안정성**: `useEdgeHoverPreview` 가 `useMemo` 로 반환 객체를 감싸 `workflow-canvas.tsx`
  `onEdgeMouseEnter`/`onEdgeMouseLeave` 의 `useCallback` deps 무력화가 해소됐다.
- **모달 닫힘 시 스캔 스킵**: `EdgeDataModal` 이 `edgeId=""` 일 때 `edges.find` 자체를 건너뛴다(닫혀 있는 동안
  무의미한 O(E) 스캔 없음).
- **모달 렌더 재사용**: `EdgeDataModal` 이 인라인 `JSON.stringify` 재작성 대신 공용 `JsonContent` 를 재사용해
  중복 렌더 로직이 사라졌다.
- **툴팁 요약 메모이제이션**: `const summary = useMemo(() => summarizeDataForPreview(data), [data]);` 로
  무관한 리렌더마다 재계산되지 않는다.

## 발견사항

- **[WARNING]** 바이트 크기 계산이 여전히 크기 상한 없이 원본 전체를 동기 직렬화 (2라운드 전부터 지적된 항목, debounce 만 반영되고 cap 은 미반영)
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview` — `const full = JSON.stringify(value); if (full) bytes = new TextEncoder().encode(full).length;`
  - 상세: `abbreviate()` 는 depth/개수로 미리보기 문자열을 제한하지만, 바이트 크기 계산용 `JSON.stringify(value)` 는 **축약 전 원본 데이터 전체**를 대상으로 하고 상한이 없다. 이번 라운드에서 추가된 `SHOW_DELAY_MS=90` 진입 지연은 "커서가 여러 엣지를 스치는" sweep 케이스는 막아주지만, "커서가 실제로 한 엣지에 정착했는데 그 노드의 출력이 매우 큰(리포 컨벤션상 render_table 계열 등 MB 단위 출력이 허용됨)" 케이스는 여전히 해결하지 못한다 — 정착 즉시 툴팁이 마운트되고 `summarizeDataForPreview` 가 1회 실행되며, 그 안의 `JSON.stringify`+`TextEncoder.encode` 는 출력 크기에 비례해 동기적으로 메인 스레드를 블로킹한다. 즉 "여러 엣지를 스치는" 문제는 해소됐지만 "큰 데이터를 가진 엣지 하나에 머무는" 문제는 근본적으로 남아 있다.
  - 제안: 바이트 크기는 정확한 값이 필수가 아니므로 (1) `full.length`(코드 유닛 근사치, `TextEncoder` 인코딩 생략)로 대체하거나 (2) 일정 길이(예: 100KB) 초과 시 `TextEncoder` 인코딩을 생략하고 `> N` 근사 표기로 전환. `abbreviate()` 가 이미 한 번 순회하므로, 원한다면 축약 생성과 크기 측정을 한 순회로 합쳐 원본 데이터를 2번 훑는 비용(축약용 1회 + 바이트 산정용 1회)도 함께 줄일 수 있다.

- **[INFO]** `abbreviate()` 의 객체 분기가 슬라이스 전 전체 키를 eager 하게 열거
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts` `abbreviate` — `const entries = Object.entries(value as Record<string, unknown>);` 이후 `entries.slice(0, MAX_TOP_KEYS)`
  - 상세: 배열 분기는 `value.slice(0, MAX_TOP_ARRAY)` 로 필요한 앞부분만 다루지만, 객체 분기는 `Object.entries(value)` 로 전체 키를 먼저 열거한 뒤에야 20개로 자른다. 필드 수가 매우 큰(수백~수천 개) 최상위 객체를 만드는 노드가 있으면 실제 사용되는 20개를 위해 불필요한 전체 키 배열을 메모리에 구성한다. depth-1 재귀 호출마다 반복되는 패턴이라 영향은 작지만 짚어둔다.
  - 제안: 우선순위 낮음. 필요 시 `for...in` 또는 iterator 기반 순회로 20개에서 조기 종료하면 없앨 수 있다.

- **[INFO]** `edges` 배열 전체 prop-drilling으로 인해 hover/모달 열림 상태에서 `edges` 참조 변경 시마다 O(E) `.find()` 재실행
  - 위치: `edge-data-preview.tsx` `useEdgeFlowData` — `edges.find((e) => e.id === edgeId)` (deps `[edges, edgeId]`) / `workflow-canvas.tsx` 가 `EdgeDataPreviewTooltip`·`EdgeDataModal` 양쪽에 전체 `edges` 배열을 전달
  - 상세: `onEdgeMouseEnter` 시점에 캔버스는 이미 `RFEdge`(따라서 `edge.source`)를 쥐고 있는데도 `edgeId` 문자열만 하위로 넘기고 있어, 툴팁/모달이 각자 전체 `edges` 배열에서 `.find()` 를 수행한다. 같은 파일의 `useEdgeExecutionState`/`useEdgeHighlighting` 형제 훅들은 "실행 tick·드래그 시 전체 엣지 재생성을 피하는 per-edge bail-out"을 성능 관례로 채택하고 있는데, 그 결과로 `edges` 배열 참조가 바뀌는 빈도가 낮게 유지되긴 하지만, 상태 스타일이 변하는 엣지가 있을 때마다(§3.2 실행 흐름 중) `edges` 참조가 갱신되고, 이때 툴팁/모달이 열려 있으면 매번 새로 O(E) 스캔이 재실행된다. 엣지 수가 적은 일반적인 워크플로에서는 무시할 수준이나, 엣지가 많은 대형 워크플로에서 실행 중 hover 를 유지하면 불필요한 재탐색이 누적된다.
  - 제안: hover 시점에 `sourceNodeId` 를 `EdgeHoverPreviewState` 에 함께 커밋하거나, `useEdgeFlowData` 시그니처를 `edge: Edge | undefined` (캔버스가 이미 들고 있는 객체)로 직접 받도록 바꿔 `.find()` 자체를 제거.

- **[INFO]** (신규 결함 아님, 범위 밖 기지 항목) `findLatestResultByNodeId` O(1) selector 신설에도 기존 O(n) 역스캔 중복(`node-settings-panel.tsx` `InfoTab`)은 미이관 — `plan/in-progress/spec-sync-edge-gaps.md` 비고에 `task_edb57ca2` follow-up 으로 이미 문서화·defer 처리됨. 이번 diff 범위(엣지 데이터 미리보기 surface) 밖이라 이 리뷰에서는 재차 차단 사유로 세지 않는다.

## 요약

세 차례 ai-review 를 거치며 이 changeset 의 핵심 성능 리스크(스토어 O(1) 인덱스 미활용, 훅 반환 객체 참조 불안정, 여러 엣지를 스치는 sweep 시 무가드 직렬화)는 실코드 기준으로 대부분 해소됐다 — `findLatestResultByNodeId` selector 신설·연결, `useEdgeHoverPreview` 반환값 메모이제이션, `SHOW_DELAY_MS=90` 진입 지연을 통한 sweep 방어, 툴팁 요약 계산 메모이제이션이 모두 확인된다. 다만 바이트 크기 계산용 `JSON.stringify(value)` 는 여전히 크기 상한이 없어, "여러 엣지를 스치는" 시나리오는 debounce 로 완화됐지만 "대용량 출력을 가진 엣지 하나에 정착해 hover" 하는 시나리오의 동기 직렬화 비용은 근본적으로 남아 있다. 이 외 `abbreviate()` 의 eager 키 열거, `edges` 배열 prop-drilling 으로 인한 반복 O(E) 탐색은 경미한 최적화 여지이며, 병합을 막을 수준은 아니다.

## 위험도

LOW
