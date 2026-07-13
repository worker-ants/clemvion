# 아키텍처(Architecture) Review

대상: §3.2 엣지 실행 상태 스타일 구현 최종본(CHANGELOG.md, globals.css, custom-edge.tsx,
use-edge-execution-state.ts[신규]+test, workflow-canvas.tsx, edge-utils.ts+test, mdx 문서 4건,
plan/spec-sync-edge-gaps.md, spec/3-workflow-editor/2-edge.md) + 직전 ai-review 2회차
(review/code/2026/07/13/14_20_12/*, 14_42_20/*) 산출물 커밋. 코드 실체(파일 1~13, 42)는
14_42_20 라운드에서 검토된 최종본과 동일 — 이번 라운드는 그 수렴을 재확인하는 3회차 fresh
review.

## 발견사항

- **[INFO]** 3계층 분리(순수 판정 함수 → 상태 어댑터 훅 → 프레젠테이션)가 기존 §1.2/§1.3
  헬퍼 패턴과 일관되게 유지됨
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`resolveEdgeExecutionState`,
    `buildEdgeStyle` — 순수 함수, `ReadonlySet`/`ReadonlyMap`/`CSSProperties` 기반 좁은
    입출력) → `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts`
    (Zustand `useExecutionStore` + React Flow `Node[]` 를 읽어 `className`/`data.edgeInactive`
    로 변환) → `custom-edge.tsx`(`buildEdgeStyle` 호출, inline style) + `globals.css`(keyframe)
  - 상세: `resolveEdgeExecutionState`/`buildEdgeStyle` 모두 Zustand 스토어나 React Flow
    컴포넌트 타입에 직접 의존하지 않고 자체 좁은 인터페이스로 디커플링되어 있어 DIP·SRP 가
    양호하다. 상호배타 우선순위(inactive > flowing/completed)의 단일 진실 소스가
    `resolveEdgeExecutionState` 한 곳에만 존재한다. `edge-utils.ts` → 훅 → 컴포넌트 방향의
    단방향 의존만 확인되며, `execution-store.ts` 는 `edge-utils`/훅을 참조하지 않아
    순환 의존성 없음(직접 확인: `edge-utils.ts` import 목록에 스토어 없음, 스토어 쪽에도
    `edge-utils` 참조 없음).
  - 제안: 없음(확인용 기록).

- **[INFO]** sibling 훅(`useEdgeHighlighting`)과의 최적화 계약이 이번 최종본에서 대칭적으로
  통일됨
  - 위치: `use-edge-execution-state.ts` (`disabledKey` = disabled id 정렬 join, per-edge
    `className === edge.className && state.inactive === prevInactive` bail-out)
  - 상세: 초기 라운드(14_20_12)에서 지적됐던 "노드 배열 참조 전체에 의존 → 드래그·tick 마다
    전체 엣지 재생성" 문제가, `nodes` 참조 대신 안정적 1차 표현(정렬 문자열)에 의존하는
    파생 + 엣지별 얕은 bail-out 이중 장치로 해소되어 있다. `useEdgeHighlighting` 이 확립한
    "미변경 엣지는 원본 참조 반환 → `memo(CustomEdge)` 보존" 최적화 계약을 두 훅이
    동일하게 준수한다.
  - 제안: 없음.

- **[INFO]** 훅 합성 체인(`useEdgeExecutionState` → `useEdgeHighlighting`)의 순서·병합
  전략 계약이 타입 시스템이 아닌 주석으로만 강제됨
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
    (`const executionEdges = useEdgeExecutionState(edges, nodes); const { enhancedEdges, ... } =
    useEdgeHighlighting(executionEdges);`)
  - 상세: §3.2 는 `className` 을 항상 재계산해 덮어쓰고, §3.3 은 기존 `className` 을 파싱해
    Set 병합/제거하는 비파괴적 방식이라 두 전략이 대칭적이지 않다. 현재는 순서(§3.2 먼저)와
    두 훅의 병합 전략이 우연히 맞물려 안전하지만, 이 계약을 강제하는 공용 타입/헬퍼가 없어
    향후 세 번째 엣지 스타일링 훅이 "덮어쓰기" 방식으로 체인 중간에 끼어들면 조용히 앞선
    스타일이 유실될 수 있다(OCP: 확장 자체는 쉽지만 안전한 확장 방법이 코드로 강제되지
    않음). 훅이 2개뿐인 현재 규모에서는 리스크가 낮다.
  - 제안: 조치 불요(현재 범위). 세 번째 엣지 스타일링 훅 추가 시 `mergeEdgeClassName(edge,
    addSet, removeSet)` 같은 공용 헬퍼로 병합 전략을 코드 레벨 계약화할 것을 권장.

- **[INFO]** (기존 판단 유지, 이번 diff 미변경) `edge-utils.ts` 응집도 축적과
  `nodeStatusById` 타입 widening
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`(포트 색상/연결 유효성/드래그
    조립/stale pruning/실행 상태 판정까지 한 파일에 축적), `resolveEdgeExecutionState` 의
    `ctx.nodeStatusById: ReadonlyMap<string, string>`(실행 스토어의 `NodeExecutionStatus`
    유니온이 아닌 원시 `string`; `codebase/frontend/src/lib/stores/execution-store.ts`
    의 `NodeExecutionStatus` 타입과 직접 확인)
  - 상세: 두 사안 모두 직전 라운드(14_20_12/14_42_20)에서 이미 식별·판단(store 타입 의존
    회피 트레이드오프로 유지, 파일 분할은 §4/§5 시 재검토)이 내려진 항목이며 이번 diff 는
    해당 지점을 변경하지 않았다. 새 결함이 아니라 기존 결정이 그대로 유효함을 재확인.
  - 제안: 추가 조치 불요(기존 결정 유지, 참고용 기록).

- **[INFO]** 리뷰 아티팩트(review/code/…/14_20_12/*, 14_42_20/*)가 소스 diff 에 포함되어
  커밋됨
  - 위치: `review/code/2026/07/13/14_20_12/*`, `review/code/2026/07/13/14_42_20/*`
  - 상세: 이 파일들은 코드가 아닌 이전 리뷰 라운드의 산출물(SUMMARY/RESOLUTION/개별
    reviewer 리포트)이며, 저장소 관례상 `review/` 는 gitignore 대상이 아니라 커밋
    대상이다. 아키텍처 관점에서 별도 우려사항 없음(레이어/모듈 경계와 무관한 문서 산출물).
  - 제안: 없음.

## 요약

이번 §3.2(엣지 실행 상태 스타일) 구현은 순수 판정 함수(`resolveEdgeExecutionState`,
`buildEdgeStyle`) → 상태 어댑터 훅(`useEdgeExecutionState`) → 프레젠테이션(컴포넌트 inline
style + CSS keyframe)의 3계층 분리를 유지하며, 기존 §1.2/§1.3 헬퍼 도입 패턴과 결합도·응집도
면에서 일관성이 있다. 직전 두 라운드(14_20_12 MEDIUM → 14_42_20 LOW)에서 지적됐던 sibling 훅
대비 비대칭 재렌더 최적화 문제는 안정적 `disabledKey` + per-edge bail-out 이중 장치로
해소되었고, `edge-utils.ts`→훅→컴포넌트의 단방향 의존만 확인되어 순환 참조나 레이어 경계
붕괴는 없다. SOLID 위반, 안티패턴, CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았으며,
잔여 사항(훅 합성 순서의 타입 미강제, edge-utils.ts 응집도, status 타입 widening)은 모두
현재 규모에서 리스크가 낮고 이미 문서화된 향후 개선 여지에 해당한다.

## 위험도

LOW
