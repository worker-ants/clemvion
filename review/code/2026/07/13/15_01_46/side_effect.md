# 부작용(Side Effect) Review

대상: §3.2 엣지 실행 상태 스타일 구현 최종본 — `use-edge-execution-state.ts`(신규) +
`edge-utils.ts`(`resolveEdgeExecutionState`/`buildEdgeStyle`/`FLOWING_EDGE_CLASS`/
`COMPLETED_EDGE_CLASS` 신규) + `custom-edge.tsx`/`workflow-canvas.tsx` 배선 +
`globals.css` + 테스트 2편 + CHANGELOG/spec/plan/mdx 문서 + 이전 2회 ai-review 라운드
(`review/code/2026/07/13/14_20_12/*`, `14_42_20/*`) 산출물 커밋.

이미 2회의 ai-review 라운드를 거쳐 side_effect 관점 WARNING(→ NONE)이 수렴된 diff이다.
아래는 HEAD 소스(`use-edge-execution-state.ts`, `custom-edge.tsx`, `use-edge-highlighting.ts`,
`workflow-canvas.tsx`, `globals.css`)를 직접 재확인해 독립적으로 검증한 결과다.

## 발견사항

- **[INFO]** 전역 스토어(Zustand)는 읽기 전용으로만 소비됨 — 의도치 않은 상태 변경 없음
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:28-29` (`useExecutionStore((s) => s.status === "running")`, `useExecutionStore((s) => s.nodeStatuses)`)
  - 상세: 신규 훅은 `useExecutionStore`/`useEditorStore` 어느 쪽에도 setter/action 을 호출하지 않는다(직접 확인). 파생된 엣지 배열은 `edge.className`/`edge.data.edgeInactive` 를 spread 로 새 객체에 부여할 뿐 원본 `edge`(SoT `editor-store.edges`)나 `node` 객체를 in-place mutate 하지 않는다.
  - 제안: 없음(확인용 기재).

- **[INFO]** 파생 엣지 배열은 렌더 전용 경로에만 흘러가며 SoT/저장 경로로 되먹임되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:132` (`const edges = useEditorStore((s) => s.edges)`) → `:161` `useEdgeExecutionState(edges, nodes)` → `:165` `useEdgeHighlighting(executionEdges)` → `:775` `<ReactFlow edges={enhancedEdges}>`
  - 상세: 원본 `edges`(store SoT, className 미설정 상태 — grep 으로 확인)가 `useEdgeExecutionState`/`useEdgeHighlighting` 을 거쳐 `enhancedEdges`로 파생되고, 이 값은 오직 `<ReactFlow edges={...}>` prop 렌더링에만 쓰인다. `onEdgesChange`/`saveWorkflow` 등 store 갱신·영속화 경로 어디에도 `enhancedEdges`/`executionEdges`가 재유입되지 않아, 캔버스 전용 실행-상태 스타일(`className`/`data.edgeInactive`)이 워크플로 정의(DB 저장본)에 오염될 위험이 없다.
  - 제안: 없음(확인용 기재).

- **[INFO]** `useEdgeExecutionState` → `useEdgeHighlighting` 합성이 className 을 서로 덮어쓰지 않음을 소스로 재확인
  - 위치: `use-edge-highlighting.ts:63-77` (`classes.add("edge-highlighted")`/`classes.delete(...)` — 기존 className 을 공백 분리 Set 으로 병합)
  - 상세: `useEdgeExecutionState` 는 원본 store edges(className 미설정)에 대해 `edge-flowing`/`edge-completed`/`undefined` 를 최초 부여하고, 그 결과를 입력받는 `useEdgeHighlighting` 은 기존 className 토큰을 유지한 채 `edge-highlighted` 토큰만 add/remove 한다 — 두 계층 사이 clobber 없음. 이번 diff 가 `useEdgeHighlighting` 자체를 수정하지 않아 이 대칭성은 변경되지 않았다.
  - 제안: 없음(확인용 기재).

- **[INFO]** 성능 관점 WARNING(§전체 엣지 재생성)의 두 근본 원인이 HEAD 소스에 실제로 수정돼 있음을 재확인
  - 위치: `use-edge-execution-state.ts:60-84`(per-edge bail-out — `className === edge.className && state.inactive === prevInactive` 이면 원본 참조 반환, 전체 `changed` 없으면 원본 배열 반환), `:31-40`(`disabledKey` — `nodes` 배열 참조가 아니라 disabled id 정렬 join 문자열에 의존)
  - 상세: 1차 리뷰가 지적한 "노드 드래그·실행 tick 마다 캔버스 전체 엣지가 무조건 새 객체가 됨"(→ `memo(CustomEdge)` 무효화) 문제는 (a) 개별 엣지 단위 bail-out과 (b) `nodes` 참조 대신 안정적 문자열 키로 `disabledNodeIds` 를 파생하는 두 수정으로 해소되어 있다. 곁가지 부작용(무관한 엣지까지 리렌더 캐스케이드)이 이제 발생하지 않음을 소스 레벨로 확인.
  - 제안: 없음(이미 반영, 확인용 기재).

- **[INFO]** `edge.data.edgeInactive` 가 조건 없이 명시적으로 심어짐(false 케이스 포함)
  - 위치: `use-edge-execution-state.ts:76-83`
  - 상세: 변경된 엣지에 한해 `data: { ...edge.data, edgeInactive: state.inactive }` 로 `false` 값도 명시한다. `useEdgeHighlighting` 도 동일 패턴(`isHighlighted: false` 명시)을 쓰는 저장소 기존 관례와 일치하고, 위 항목대로 이 파생 배열이 저장 경로로 되먹임되지 않아 영속화 오염 위험은 없다.
  - 제안: 조치 불요. 향후 캔버스 파생 edges 를 저장/직렬화 경로에 연결하는 변경이 생기면 런타임 전용 `data` 필드를 strip 하는 단계를 추가할 것.

- **[INFO]** `custom-edge.tsx` — `buildEdgeStyle` 의 `baseStyle`(= `props.style`, React Flow 제공) 스프레드가 마지막이라 향후 `edge.style` 을 채우는 경로가 생기면 `inactive`/`selected`/`isHighlighted` 스타일을 조용히 덮어쓸 수 있음
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeStyle` (`...(opts.baseStyle ?? {})` 마지막 스프레드), `custom-edge.tsx:27-33`
  - 상세: 이는 리팩터 이전부터 있던 기존 동작(`...props.style` 최우선)을 그대로 보존한 것이고(JSDoc "기존 동작 보존" 명시), 이번 diff 범위에서 `edge.style` 을 실제로 채우는 신규 코드 경로는 없다 — 새로 만든 리스크가 아니라 기존 계약의 연장이다. 직전 라운드 리뷰에서 이미 식별·이월(RESOLUTION WARNING #3)된 항목과 동일.
  - 제안: 신규 조치 불요(추적 항목 유지). `edge.style` 을 채우는 경로가 추가되면 스프레드 순서를 재검토할 것.

- **[INFO]** 인터페이스/시그니처 변경은 전부 additive
  - 위치: `edge-utils.ts` 신규 export(`EdgeExecutionState`, `FLOWING_EDGE_CLASS`, `COMPLETED_EDGE_CLASS`, `resolveEdgeExecutionState`, `buildEdgeStyle`); `custom-edge.tsx`(`CustomEdgeComponent` 의 `EdgeProps<CustomEdgeType>` 시그니처 불변, 기존 optional `data.edgeInactive` 소비만 추가); `workflow-canvas.tsx`(`useEdgeHighlighting(edges)` → `useEdgeHighlighting(executionEdges)` — 이는 `useEdgeHighlighting` 자체의 시그니처 변경이 아니라 호출부 인자 배선 변경)
  - 상세: 기존 export(`enrichEdgesWithPortData`, `isSelfConnection`, `isDuplicateConnection`, `PORT_TYPE_COLORS` 등) 시그니처·동작은 전혀 변경되지 않았다. 공개 API 파괴적 변경 없음.
  - 제안: 없음.

- **[INFO]** 환경 변수·네트워크 호출·파일시스템 부작용 — 해당 없음
  - 상세: 전체 diff(CHANGELOG/spec/plan/mdx 포함)에 `process.env` 읽기·`fetch`/API 클라이언트 호출·`fs` 조작이 전혀 없다. `globals.css` 변경은 순수 CSS(keyframes/class 규칙) 추가로 런타임 부작용 없음.
  - 제안: 없음.

- **[INFO]** `review/code/2026/07/13/{14_20_12,14_42_20}/*` 리포트 파일 신규 커밋은 실행 코드의 파일시스템 부작용이 아님
  - 위치: 해당 디렉터리의 `RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/에이전트별 `*.md`
  - 상세: 이전 두 ai-review 라운드가 생성한 정적 문서 산출물을 커밋에 포함시킨 것으로, 런타임 코드 실행 결과가 아니라 저장소 관례(`review/` 는 gitignore 대상 아님, 커밋 대상)에 따른 이력 보존이다. 코드 동작에 영향 없음.
  - 제안: 없음(확인용 기재).

- **[INFO]** 테스트 파일이 전역 싱글턴 Zustand 스토어를 `beforeEach`에서 재설정 — 격리 목적의 예상된 부작용
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts:127-129` (`useExecutionStore.setState({ status: "idle", nodeStatuses: new Map() })`)
  - 상세: 모듈 스코프 싱글턴 상태 변경이지만 매 케이스 전 결정론적으로 초기화하며, 형제 훅 테스트가 이미 쓰는 저장소 관례와 일치한다. 신규 리스크 아님.
  - 제안: 없음.

## 요약

이번 diff 는 순수 프런트엔드 파생 상태(useMemo/Zustand selector) 로직으로, 전역 스토어는 읽기 전용으로만 소비하고 파생 엣지 배열은 `<ReactFlow edges={enhancedEdges}>` 렌더링 전용 경로에만 흘러가 SoT(`editor-store.edges`)나 노드 객체를 in-place mutate하지 않음을 소스 직접 확인으로 검증했다. `useEdgeHighlighting` 은 className 을 Set 병합 방식으로 다뤄 §3.2 가 부여한 `edge-flowing`/`edge-completed` 를 덮어쓰지 않으며, 반대로 §3.2 훅도 className-미설정 원본 store edges 에서 출발해 clobber 위험이 없다. 1차 ai-review에서 지적된 "노드 드래그·실행 tick마다 전체 엣지 재생성"(diff-0 불변식 무력화) 부작용은 per-edge bail-out + 안정적 disabledKey 로 실제 수정돼 있음을 확인했다. 신규 export(`resolveEdgeExecutionState`/`buildEdgeStyle`/클래스 상수)는 전부 additive이고, 기존 함수 시그니처·공개 API 파괴적 변경은 없다. 환경 변수·네트워크·파일시스템 부작용 없음(`review/` 리포트 파일 커밋은 문서 이력일 뿐 런타임 부작용 아님). 잔여 항목(`baseStyle` 스프레드 우선순위, `data.edgeInactive` 무조건 명시, 테스트의 전역 스토어 리셋)은 모두 기존 계약 보존 또는 저장소 기존 관례와 일치하는 INFO 수준으로 차단 사유가 아니다.

## 위험도

NONE

STATUS=success ISSUES=8
