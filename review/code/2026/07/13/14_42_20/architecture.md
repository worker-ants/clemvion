# 아키텍처(Architecture) Review

대상: §3.2 엣지 실행 상태 스타일 구현 최종본 (CHANGELOG.md, globals.css, custom-edge.tsx,
use-edge-execution-state.ts[신규], workflow-canvas.tsx, edge-utils.ts/test, mdx 문서,
plan/spec-sync-edge-gaps.md, spec/3-workflow-editor/2-edge.md) + 직전 ai-review 세션
(review/code/2026/07/13/14_20_12/*) 산출물의 커밋.

## 발견사항

- **[INFO]** 직전 리뷰(14_20_12)에서 지적된 성능/부작용 WARNING이 이번 diff에서 정확히 해소됨(회귀 확인)
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts`
  - 상세: 직전 세션의 performance/side_effect/maintainability 3개 리뷰어가 공통 지적한 "sibling 훅(`useEdgeHighlighting`)의 per-edge 참조 재사용 bail-out을 따르지 않아 매 tick·드래그마다 전체 엣지가 재생성"되는 문제를, 이번 코드는 (a) `disabledKey`를 `nodes` 배열 참조가 아니라 `isDisabled` id들의 정렬 join(안정 1차 표현)으로 계산하고, (b) `edges.map` 내부에서 `className === edge.className && state.inactive === prevInactive`일 때 원본 엣지 참조를 그대로 반환하는 두 층의 bail-out으로 실제로 해결했다. `useEdgeHighlighting`이 확립한 아키텍처 최적화 계약(참조 안정성을 통한 `memo(CustomEdge)` 보존)을 이제 두 훅이 동일하게 준수한다 — 레이어 간 비대칭이던 최적화 전략이 통일됨.
  - 제안: 없음(확인용 기록).

- **[INFO]** 3계층 분리(순수 판정 → 상태 어댑터 훅 → 프레젠테이션)가 기존 §1.2/§1.3 헬퍼 패턴과 일관되게 유지됨
  - 위치: `edge-utils.ts` `resolveEdgeExecutionState`(순수 함수, `ReadonlySet`/`ReadonlyMap` 기반 좁은 ctx 인터페이스) → `use-edge-execution-state.ts` `useEdgeExecutionState`(Zustand store·React Flow node 배열을 읽어 `className`/`data.edgeInactive`로 변환) → `custom-edge.tsx`(inline style 계산) + `globals.css`(keyframe)
  - 상세: `resolveEdgeExecutionState`가 Zustand 스토어 타입에 직접 의존하지 않고 자체 ctx 인터페이스(DIP)로 디커플링된 점, 상호배타 우선순위(inactive > flowing/completed)가 이 한 함수에만 존재해 단일 진실 소스인 점은 SRP·DIP 모두 양호하다. 순환 의존성 없음(`edge-utils.ts` → 훅 → 컴포넌트의 단방향).
  - 제안: 없음.

- **[INFO]** 훅 합성 체인(`useEdgeExecutionState` → `useEdgeHighlighting`)의 순서 계약이 주석으로만 강제되고 타입 시스템으로는 강제되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`const executionEdges = useEdgeExecutionState(edges, nodes); const { enhancedEdges, ... } = useEdgeHighlighting(executionEdges);`)
  - 상세: §3.2(실행 상태)가 `className`을 항상 재계산해 덮어쓰는 방식이고, §3.3(하이라이팅)은 반대로 기존 `className`을 파싱해 Set 병합/제거하는 비파괴적 방식이라 두 방식이 대칭적이지 않다. 현재는 순서(§3.2 먼저 → §3.3 나중)와 두 훅의 다른 병합 전략이 우연히 맞아떨어져 안전하지만, 이 계약(합성 순서 + 채널별 병합 방식)을 강제하는 공용 타입·인터페이스가 없어 향후 세 번째 엣지 스타일링 훅이 §3.2와 같은 "덮어쓰기" 방식으로 체인 중간에 끼어들면 조용히 앞선 스타일이 유실될 수 있다. 확장-개방 원칙(OCP) 관점에서, 새 훅을 추가하는 확장 자체는 쉽지만 "안전하게 확장하는 방법"이 코드로 강제되지 않고 사람이 규약을 기억해야 하는 구조다.
  - 제안: 현재 범위에서 조치 불요(2개 훅뿐이라 리스크 낮음). 세 번째 엣지 스타일링 훅을 추가할 시점에는 병합 전략을 공용 헬퍼(`mergeEdgeClassName(edge, addSet, removeSet)` 등)로 추출해 "각 훅은 이 헬퍼로만 className을 갱신한다"는 계약을 코드 레벨로 강제할 것을 권장.

- **[INFO]** (직전 리뷰에서 이미 식별·판단 완료, 이번 diff에서 미변경) `edge-utils.ts`의 응집도 축적과 `nodeStatusById` 타입 widening은 여전히 존재
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (포트 색상/연결 유효성/드래그 조립/stale pruning/실행 상태 판정까지 한 파일), `resolveEdgeExecutionState`의 `ctx.nodeStatusById: ReadonlyMap<string, string>`
  - 상세: 두 사안 모두 직전 세션(14_20_12) architecture/maintainability/testing 리뷰어가 이미 INFO로 식별했고 RESOLUTION.md에서 "당장 조치 불요, §4/§5 시 재검토" / "store 타입 의존 회피 트레이드오프로 유지"로 판단이 내려진 항목이다. 이번 diff는 이 두 지점을 건드리지 않았으므로 새 문제가 아니라 기존 판단이 그대로 유효하다. 재확인 차원에서만 기록.
  - 제안: 추가 조치 불요(기존 결정 유지). 참고로만 남김.

## 요약

이번 변경은 §3.2(엣지 실행 상태 스타일)를 순수 판정 함수 → 상태 어댑터 훅 → 프레젠테이션의 3계층으로 분리한 구조를 유지하면서, 직전 ai-review 라운드(14_20_12)에서 성능/부작용/유지보수 3개 리뷰어가 공통 지적한 "sibling 훅과 다른 재렌더 최적화 전략" 문제(disabledNodeIds가 `nodes` 참조 전체에 의존해 드래그·실행 tick마다 전체 엣지가 재생성되던 결함)를 안정적 키(`disabledKey`)와 per-edge bail-out으로 정확히 해소했다. SOLID 위반, 순환 의존성, 레이어 경계 붕괴는 발견되지 않으며, 훅 합성 체인의 순서 계약이 타입으로 강제되지 않는 점은 현재 2개 훅 규모에서는 낮은 리스크의 확장성 참고 사항일 뿐이다. 나머지(edge-utils.ts 응집도, status 타입 widening)는 직전 리뷰에서 이미 판단이 내려진 기존 항목으로 이번 diff의 새 결함이 아니다.

## 위험도

LOW
