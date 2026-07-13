### 발견사항

- **[INFO]** 이번 라운드(17_13_05) diff 는 실질적으로 이전 ai-review 산출물(`review/code/2026/07/13/16_49_37/*.md`, `meta.json`)과 `spec/3-workflow-editor/2-edge.md` 재확인용 참조만 포함하며, 신규 프로덕션 코드 변경은 없음
  - 위치: 리뷰 대상 파일 1~10 전부(`review/code/2026/07/13/16_49_37/{maintainability,meta,performance,requirement,scope,security,side_effect,testing,user_guide_sync}.md/.json`, `spec/3-workflow-editor/2-edge.md`)
  - 상세: 실제 성능 관련 프로덕션 코드(`edge-data-preview.ts`, `edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `workflow-canvas.tsx`, `execution-store.ts`)의 바이트 계산 상한 fix 는 이미 커밋 `9036bb565`("ai-review 3회차 반영")에 review 산출물과 함께 포함되어 병합되었고, 이번 diff 는 그 결과물인 리뷰 리포트 텍스트 파일들이 추가되는 것만 반영한다. `.md`/`.json` 리포트 파일 자체는 런타임에 실행되지 않으므로 성능 영향이 없다.
  - 제안: 조치 불필요 — 참고용 스코프 기재.

- **[INFO]** (재검증) `summarizeDataForPreview` 바이트 계산 WARNING — 상한 적용은 "인코딩 단계"에만 적용되고 `JSON.stringify(value)` 자체는 여전히 무제한
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts:66-78` — `const full = JSON.stringify(value); if (full.length <= BYTE_APPROX_THRESHOLD) { bytes = new TextEncoder().encode(full).length; } else { bytes = full.length; bytesApprox = true; }`
  - 상세: 실제 워크트리 코드를 직접 Read 해 재확인한 결과, `review/code/2026/07/13/16_49_37/performance.md` 가 WARNING 으로 지적한 "바이트 크기 계산에 상한 없음" 문제는 커밋 `9036bb565` 에서 `BYTE_APPROX_THRESHOLD = 100_000` 도입으로 **부분** 해소됐다. 다만 이 cap 은 `full.length` 계산 **이후** 분기(`TextEncoder.encode` 스킵 여부)에만 적용되며, 그 앞의 `JSON.stringify(value)` 호출 자체는 원본 값 크기에 관계없이 항상 전체를 순회한다. 즉 "정확 바이트 인코딩(Uint8Array 할당)" 비용은 대용량 출력에서 제거됐지만, "직렬화 문자열 생성" 비용(문자열 길이에 비례하는 O(n) 작업이며 MB 단위 출력에서는 이 자체도 체감 가능한 동기 블로킹)은 그대로 남아 있다. `summarizeDataForPreview` 가 `useMemo(() => summarizeDataForPreview(data), [data])` 로 감싸져 있어 hover 정착 시 1회만 실행되므로 반복 호출 문제는 없으나("여러 엣지를 스치는" sweep 케이스는 이미 해소), "매우 큰 단일 노드 출력에 hover 정착" 시나리오의 메인스레드 블로킹은 완화(약 절반의 비용 절감으로 추정)되었을 뿐 근본 해결은 아니다.
  - 제안: 우선순위 낮음(diminishing return, 병합 차단 아님) — `full.length > BYTE_APPROX_THRESHOLD` 케이스에서 `JSON.stringify(value)` 자체를 스킵하고 대신 `abbreviate()` 결과(이미 계산됨)의 근사치나 최상위 배열/객체의 얕은 크기 추정으로 대체하면 stringify 비용도 함께 줄일 수 있다. 다만 정확한 방법은 depth-bound 순회가 필요해 별도 구현 비용이 든다.

- **[INFO]** (재검증, 변경 없음) `abbreviate()` 객체 분기의 eager `Object.entries` 전체 열거 — 이전 라운드 지적 그대로 잔존
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts:34-42`
  - 상세: `Object.entries(value as Record<string, unknown>)` 로 전체 키를 먼저 배열화한 뒤 `slice(0, MAX_TOP_KEYS)` 로 20개만 사용한다(배열 분기는 `value.slice()` 로 필요한 부분만 다뤄 비대칭). 수백~수천 필드의 최상위 객체에서는 불필요한 전체 키 배열 생성 비용이 있으나 depth-1 재귀 1회에 국한되고 영향은 작다.
  - 제안: 우선순위 낮음. 조치 불필요(기존 결론과 동일).

- **[INFO]** (재검증, 변경 없음) `edges` 배열 prop-drilling으로 인한 반복 O(E) `.find()` — 이전 라운드 지적 그대로 잔존
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:26-29`(`useEdgeFlowData` — `edges.find((e) => e.id === edgeId)`, deps `[edges, edgeId]`)
  - 상세: `onEdgeMouseEnter` 시점에 캔버스가 이미 쥐고 있는 `RFEdge` 대신 `edgeId` 문자열만 전달해 툴팁/모달이 각자 전체 `edges` 배열에서 재탐색한다. 엣지가 많은 대형 워크플로에서 실행 중(§3.2 상태 스타일 변경으로 `edges` 참조가 자주 갱신되는 상황) hover 를 유지하면 불필요한 재탐색이 누적될 수 있으나, 일반적인 워크플로 규모에서는 무시할 수준이다.
  - 제안: 우선순위 낮음. `sourceNodeId` 를 hover state 에 직접 커밋하거나 `edge: Edge | undefined` 를 직접 전달해 `.find()` 제거 고려.

- **[INFO]** `workflow-canvas.tsx` `openDataModal`/`closeDataModal` 을 `useCallback` 으로 안정화 — 이전 라운드 INFO(콜백 스타일 비일관) 해소 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:267-274`
  - 상세: 직전 라운드(`16_49_37`)에서 인라인 `onOpenModal={(id) => {...}}` 로 매 렌더 재생성되던 콜백이 `openDataModal`/`closeDataModal` `useCallback` 으로 추출되어 `onEdgeMouseEnter`/`onEdgeMouseLeave` 와 동일한 안정화 스타일로 통일됐다. 성능 관점에서는 원래도 leaf 컴포넌트 조건부 렌더라 영향 미미했던 사안이라 실질 개선폭은 작지만, 재확인만 하며 조치 불필요.

### 요약
이번 17_13_05 라운드의 diff 는 성능 관점에서 실질적 신규 코드 변경이 없고(review 리포트 텍스트 파일 추가와 spec 재참조뿐), 이전 3회차 리뷰(`16_49_37`)가 지적한 성능 WARNING(바이트 계산 상한 없음)은 후속 커밋(`9036bb565`)에서 실제 코드에 반영되어 있음을 워크트리를 직접 Read 해 재확인했다. 다만 그 fix 는 `TextEncoder` 인코딩 단계만 100KB 초과 시 생략하고, 선행하는 `JSON.stringify(value)` 자체는 여전히 무제한 크기로 실행되므로 "여러 엣지를 스치는" 문제는 debounce 로, "인코딩 이중 비용"은 이번 cap 으로 완화됐지만 "매우 큰 단일 출력에 hover 정착 시 stringify 자체의 동기 비용"은 부분적으로만 줄었다(근본 해결 아님). 그 외 `abbreviate()` 의 eager 키 열거, `edges` 배열 prop-drilling 으로 인한 반복 O(E) 탐색은 이전 라운드와 동일하게 낮은 우선순위로 잔존한다. 신규 진행 중인 알고리즘 복잡도 악화, N+1 호출, 메모리 누수, 블로킹 I/O 는 발견되지 않았으며, 전체적으로 병합을 막을 사안은 없다.

### 위험도
LOW
