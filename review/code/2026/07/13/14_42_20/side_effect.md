# 부작용(Side Effect) Review

대상: §3.2 엣지 실행 상태 스타일 구현 — `use-edge-execution-state.ts`(신규) +
`edge-utils.ts`(`resolveEdgeExecutionState` 신규) + `custom-edge.tsx`/`workflow-canvas.tsx`
배선 + `globals.css` + 테스트 2편 + CHANGELOG/spec/plan/mdx 문서 + 이전 라운드
(`review/code/2026/07/13/14_20_12/*`) 리뷰 산출물 커밋.

## 발견사항

- **[INFO]** 전역 스토어(Zustand `useExecutionStore`)는 읽기 전용으로만 소비됨 — 의도치 않은 상태 변경 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:14-15` (`useExecutionStore((s) => s.status === "running")`, `useExecutionStore((s) => s.nodeStatuses)`)
  - 상세: 신규 훅은 `executionStore`/`editorStore` 어느 쪽에도 setter 를 호출하지 않는다. 파생된 `edges` 배열은 `edge.data`/`edge.className` 을 spread 로 새 객체에 부여할 뿐 원본 `edge`(= `editor-store.ts` 의 SoT `state.edges` 참조)나 `node` 객체를 in-place mutate 하지 않는다. `workflow-canvas.tsx` 에서 이 파생 결과(`executionEdges`→`enhancedEdges`)는 오직 `<ReactFlow edges={enhancedEdges}>`(L775) 렌더링에만 쓰이고 `editor-store.edges`/저장(`saveWorkflow`) 경로로는 되먹임되지 않아, 캔버스 전용 렌더 상태(`className`/`data.edgeInactive`)가 워크플로 정의에 영구 반영될 위험이 없다.
  - 제안: 없음(확인용 기재).

- **[INFO]** `useEdgeHighlighting` 호출 인자 변경은 함수 시그니처 변경이 아니라 호출부 배선 변경
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:164-166` (`useEdgeHighlighting(edges)` → `useEdgeHighlighting(executionEdges)`)
  - 상세: `use-edge-highlighting.ts` 자체는 이번 diff 에서 손대지 않았고 `(edges: Edge[]) => EdgeHighlightResult` 시그니처도 그대로다. 실제로 열어 확인한 결과, 이 훅은 `className` 을 덮어쓰지 않고 공백 분리 `Set` 으로 토큰을 add/remove(`edge-highlighted` 만)하므로(`use-edge-highlighting.ts:63-77`), §3.2 훅이 먼저 부여한 `edge-flowing`/`edge-completed` className 이 hover/선택 시 소실되지 않는다. 합성 순서(실행 상태 → 하이라이팅)가 주석대로 실제 구현과 일치함을 확인했다.
  - 제안: 없음(확인용 기재, 회귀 아님).

- **[INFO]** `edge.data` 에 `edgeInactive` 키가 조건 없이 부여됨(false 케이스 포함)
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:80-89`
  - 상세: className 또는 inactive 플래그가 바뀐 엣지에 한해 새 객체를 만들 때, `data: { ...edge.data, edgeInactive: state.inactive }` 로 `edgeInactive` 를 항상 명시적으로 심는다(`false` 여도). 기존 `useEdgeHighlighting` 도 동일 패턴(`isHighlighted:false` 명시)을 이미 쓰고 있어 저장소 관례와 일치하며, 위 첫 항목대로 이 파생 배열은 저장 경로로 되먹임되지 않으므로 영속화 오염 위험은 없다. 다만 향후 누군가 `enhancedEdges`(또는 그 전 단계)를 저장/직렬화 경로에 잘못 연결하면 런타임 전용 필드가 새어나갈 수 있다는 점은 유의.
  - 제안: 조치 불요. 향후 캔버스 파생 edges 를 저장 경로에 연결하는 변경이 있다면 `data` 정리(strip) 단계를 추가할 것.

- **[INFO]** `custom-edge.tsx` 인라인 스타일 병합 순서상 `props.style` 이 `inactive` 스타일을 덮어쓸 수 있음(기존에 식별·이월된 항목)
  - 위치: `codebase/frontend/src/components/editor/canvas/custom-edge.tsx:29-34` (`...(inactive ? {opacity:0.4, strokeDasharray:"6 4"} : {}), ...props.style`)
  - 상세: 스프레드 순서상 `props.style` 이 마지막이라, React Flow 가 향후(또는 다른 경로가) `edge.style` 에 `opacity`/`strokeDasharray` 를 주입하면 비활성 스타일이 조용히 무효화될 수 있다. 이번 diff 범위에서 그런 소스는 없어 현재는 실질 회귀가 아니며, 동일 이슈가 직전 라운드 리뷰에서 이미 식별되어 `RESOLUTION.md`(WARNING #3)에 "얇은 glue, canvas RTL 하네스 부재로 이월" 로 명시적으로 기록·이월되어 있다 — 이번 diff 가 새로 만든 리스크는 아님.
  - 제안: 신규 조치 불요(추적 항목 유지). 추후 `edge.style` 을 채우는 경로가 추가되면 우선순위 재검토.

- **[INFO]** 테스트 파일이 전역 싱글턴 Zustand 스토어 상태를 재설정함(격리 목적, 예상된 부작용)
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts:19-21` (`beforeEach(() => { useExecutionStore.setState({ status: "idle", nodeStatuses: new Map() }); })`)
  - 상세: `useExecutionStore` 는 모듈 스코프 싱글턴이라 `setState` 호출은 테스트 파일 내 다른 케이스·잠재적으로 동일 워커에서 실행되는 다른 스펙에 영향을 줄 수 있는 전역 상태 변경이다. 다만 `beforeEach` 로 매 케이스 전에 결정론적으로 초기화하며, sibling 훅 테스트(`use-edge-highlighting.test.ts` 등)도 동일 패턴을 이미 사용하는 저장소 관례라 신규 리스크는 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 export(`FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS`/`EdgeExecutionState`/`resolveEdgeExecutionState`)는 추가일 뿐 기존 공개 API 를 변경하지 않음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:816-862`
  - 상세: 기존 export(`enrichEdgesWithPortData`, `isSelfConnection` 등) 시그니처·동작 변경 없음. 새 함수는 순수 함수로 store/DOM 의존이 없어 부작용 표면이 없다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/13/14_20_12/*` 리포트 파일 신규 커밋은 코드 실행 경로의 파일시스템 부작용이 아님
  - 위치: `review/code/2026/07/13/14_20_12/{RESOLUTION.md,SUMMARY.md,_retry_state.json,*.md}`
  - 상세: 이전 리뷰 라운드가 생성한 산출물을 이번 커밋에 포함시킨 것으로, 런타임 코드가 파일을 쓰는 것이 아니라 저장소 관례(`review/` 는 gitignore 대상 아님, 커밋 대상)에 따른 정적 문서 추가다. CHANGELOG/spec/plan 갱신과 함께 문서적 변경일 뿐 실행 시 파일시스템 부작용을 유발하지 않는다.
  - 제안: 없음(확인용 기재).

## 요약

이번 diff 는 순수 프런트엔드 파생 상태(useMemo/useSelector) 로직으로, 전역 스토어(Zustand)는 읽기 전용으로만 소비하고 파생된 엣지 배열은 렌더링 전용 경로(`<ReactFlow edges={enhancedEdges}>`)에만 흘러가 SoT(`editor-store.edges`)나 노드 객체를 in-place mutate 하지 않음을 소스 확인으로 검증했다. `useEdgeHighlighting` 호출 인자 변경은 함수 시그니처가 아닌 호출부 배선이며, 실제로 className 을 Set 병합 방식으로 덮어쓰지 않아 실행 상태 스타일과 hover/선택 하이라이트가 안전하게 공존함을 `use-edge-highlighting.ts` 원본으로 재확인했다. 남은 항목(`data.edgeInactive` 무조건 부여, `custom-edge.tsx` 스타일 병합 순서, 테스트의 전역 스토어 재설정)은 모두 현재 범위에서 실질적 회귀를 일으키지 않는 INFO 수준이며, 그중 스타일 병합 순서 이슈는 이미 직전 라운드 리뷰에서 식별·문서화되어 이월된 기지(旣知) 항목이다. 파일시스템·환경 변수·네트워크 호출·이벤트/콜백 변경·전역 변수 도입·공개 API 파괴적 변경 등 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도
NONE
