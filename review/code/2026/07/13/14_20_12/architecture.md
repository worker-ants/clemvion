# 아키텍처(Architecture) Review

대상: §3.2 엣지 실행 상태 스타일 구현 (CHANGELOG.md, globals.css, custom-edge.tsx,
use-edge-execution-state.ts[신규], workflow-canvas.tsx, edge-utils.ts/test, mdx 문서,
plan/spec-sync-edge-gaps.md, spec/3-workflow-editor/2-edge.md)

## 발견사항

- **[INFO]** 실행 상태 도메인 경계에서 노드 상태가 문자열로 widening 됨
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (`nodeStatusById: Map<string, string>` 생성부, `nodeStatuses.forEach((info, id) => map.set(id, info.status))`), `codebase/frontend/src/lib/utils/edge-utils.ts` (`resolveEdgeExecutionState` 의 `ctx.nodeStatusById: ReadonlyMap<string, string>`, `"completed"`/`"running"` 문자열 리터럴 비교)
  - 상세: `resolveEdgeExecutionState` 는 Zustand 스토어로부터 디커플링하려고 `ReadonlySet`/`ReadonlyMap` 형태의 순수 ctx 인터페이스를 잘 정의했지만, 상태 값 타입을 실행 스토어의 실제 status 유니온(예: `NodeExecutionStatus`) 대신 원시 `string` 으로 widening 했다. 그 결과 `"completed"`/`"running"` 비교가 컴파일 타임 검증 없는 매직 스트링이 되어, 추후 실행 스토어의 status enum 값이 리네이밍/확장되어도 이 함수는 조용히 깨진다(타입 에러 없이 flowing/completed 판정이 항상 false 로 새는 방식의 회귀).
  - 제안: ctx 타입을 `ReadonlyMap<string, NodeExecutionStatus>` (스토어가 노출하는 실제 상태 유니온 타입 재사용)으로 좁혀 두면, 두 모듈 간 경계를 유지하면서도 컴파일 타임에 값 불일치를 잡을 수 있다.

- **[INFO]** `edge-utils.ts` 가 여러 독립적 관심사를 계속 축적
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (포트 색상/타입 판정, 연결 유효성 검사, 드래그 소스 추출, stale edge pruning, 그리고 이번에 추가된 실행 상태 판정까지 한 파일)
  - 상세: 이번 diff 는 기존 관행(§1.2/§1.3 헬퍼도 같은 파일에 추가)을 그대로 따른 것이라 새로 만든 문제는 아니다. 다만 파일이 "엣지 관련 유틸"이라는 넓은 우산 아래 색상 판정·연결 유효성·드래그 조립·stale 정리·실행 상태 판정까지 응집도가 서로 다른 5개 이상의 축을 담고 있어, 파일이 계속 커지면 리뷰/네비게이션 비용이 늘어난다.
  - 제안: 당장 분리를 요구할 사안은 아니나, 다음 §4/§5(호버 데이터 미리보기) 작업 시점에 `edge-connection-utils.ts` / `edge-execution-state.ts` / `edge-port-utils.ts` 등으로 파일 분할을 검토할 것.

- **[INFO]** 실행 상태 스타일링이 두 개의 서로 다른 채널(className vs `data` 플래그)로 나뉘어 표현됨
  - 위치: `use-edge-execution-state.ts`(flowing/completed → `edge.className`), `custom-edge.tsx`(inactive → `data.edgeInactive` 를 읽어 인라인 `style` 계산)
  - 상세: 개념적으로 동일한 "§3.2 실행 상태" 관심사가 flowing/completed 는 CSS class + keyframe(globals.css) 로, inactive 는 component 내부 inline style 계산으로 각각 다른 메커니즘을 탄다. 코드 주석에 의도(React Flow 내장 애니메이션·전역 keyframe 재사용 vs 정적 opacity/dasharray)가 명확히 설명되어 있고, `isHighlighted`/`selected` 도 이미 같은 이원 방식(className 마킹 + 컴포넌트 inline 계산)을 쓰던 기존 관행과 일치하므로 새로운 안티패턴은 아니다. 다만 향후 세 번째 상호배타 상태가 추가될 때 "어느 채널을 쓸지"를 매번 새로 판단해야 하는 확장 비용은 존재한다.
  - 제안: 특별한 조치 불요. 다만 신규 실행-상태 종류를 추가할 때는 이 두 채널 중 어떤 것을 쓸지 결정 기준(정적 vs 애니메이션, React Flow 내장 프로퍼티 필요 여부)을 spec/코드 주석에 한 줄로 남겨 일관성을 유지할 것.

## 요약

이번 변경은 §3.2(엣지 실행 상태 스타일)를 순수 판정 함수(`resolveEdgeExecutionState`, 우선순위 inactive > flowing/completed) → 상태 어댑터 훅(`useEdgeExecutionState`, Zustand 스토어·React Flow 노드를 읽어 edge.className/data 로 변환) → 프레젠테이션(custom-edge.tsx 인라인 스타일 + globals.css keyframe)의 3계층으로 깔끔히 분리했고, `useEdgeHighlighting` 앞단에 합성해 §3.3 하이라이팅과 공존시키는 구조는 기존 §1.2/§1.3 헬퍼 도입 패턴(순수 함수 추출 + vitest 전수, "diff 0" 최적화로 불필요 리렌더 방지)과 결합도·응집도 면에서 일관성이 있다. SOLID 위반, 순환 의존성, 레이어 경계 붕괴는 발견되지 않았으며, 지적된 사항은 모두 타입 안전성 강화·파일 응집도 개선·향후 확장 시 채널 선택 기준 명시 등 개선 여지에 해당하는 수준으로 차단 사유가 아니다.

## 위험도

LOW
