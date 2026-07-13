# 의존성(Dependency) 리뷰 — spec-sync-edge-gaps §3.2 엣지 실행 상태 스타일

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 순수 내부 리팩터/기능 추가
  - 위치: 전체 diff (`CHANGELOG.md`, `globals.css`, `custom-edge.tsx`, `use-edge-execution-state.ts`(신규), `workflow-canvas.tsx`, `edge-utils.ts`, `edge-utils.test.ts`, docs/mdx, plan/spec)
  - 상세: `package.json`/`pnpm-lock.yaml` 변경 없음. 신규 파일(`use-edge-execution-state.ts`)과 `edge-utils.ts` 추가 함수(`resolveEdgeExecutionState`, `FLOWING_EDGE_CLASS`, `COMPLETED_EDGE_CLASS`)는 모두 기존에 이미 사용 중인 React/`@xyflow/react`/Zustand(`useExecutionStore`, `useEditorStore`) 위에서만 동작한다. import 목록에 새 3rd-party 모듈이 없다.
  - 제안: 해당 없음(조치 불필요). 버전 고정·라이선스·취약점·불필요 의존성 항목도 신규 패키지가 없으므로 N/A.

- **[INFO]** 신규 CSS 애니메이션이 기존 keyframe 을 재사용 — 의존성/번들 증가 없음
  - 위치: `codebase/frontend/src/app/globals.css:60-81` (`.wc-edge-flowing`, `.wc-edge-completed`, `@keyframes wc-edge-complete-flash`)
  - 상세: 데이터 흐름 애니메이션은 새 라이브러리(예: framer-motion) 도입 없이 기존 `edge-flow` keyframe(§3.3 하이라이팅에서 이미 정의)을 재사용한다. 완료 flash 는 순수 CSS keyframe 1개만 추가되어 런타임/번들 비용은 무시할 수준(< 20 LOC CSS).
  - 제안: 없음.

- **[INFO]** 신규 내부 모듈 의존관계 — 기존 sibling 훅 패턴을 그대로 따름
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (신규), `workflow-canvas.tsx:657-660`
  - 상세: `useEdgeExecutionState`는 `@/lib/stores/execution-store`(`useExecutionStore`)와 `@/lib/utils/edge-utils`(`resolveEdgeExecutionState`)에 의존한다. `workflow-canvas.tsx`는 이미 `useExecutionStore`를 import 하고 있어(기존 `startExecution` 구독) 새 import 경로가 추가되는 것은 아니고 구독 필드(`status`, `nodeStatuses`)만 늘어난다. 모듈 구조는 인접한 `use-edge-highlighting.ts`/`use-edge-reconnect.ts`와 동일한 "훅 분리 + edge-utils 순수 함수" 패턴을 재사용해 새 아키텍처 축을 추가하지 않는다. `edge-utils.ts` → 훅 파일 방향의 단방향 의존이라 순환 참조 위험 없음.
  - 제안: 없음. 향후 실행 상태 관련 훅이 더 늘어날 경우 `use-edge-*` 네이밍 컨벤션과 `resolveEdgeExecutionState` 같은 순수 판정 함수 분리 패턴을 계속 유지할 것을 권장(현재는 이미 준수).

- **[INFO]** `workflow-canvas.tsx` 파이프라인에 훅 합성 순서 의존성 추가 (내부 의존, 저위험)
  - 위치: `workflow-canvas.tsx:657-660` — `useEdgeExecutionState(edges, nodes)` → `useEdgeHighlighting(executionEdges)`
  - 상세: §3.2(실행 상태) 결과가 §3.3(hover/선택 하이라이팅) 입력으로 체이닝되어, 두 훅 사이에 순서 의존성이 생겼다(주석으로 명시됨). 이는 외부 패키지 의존성이 아니라 내부 데이터 흐름 결합이며, 두 훅 모두 `className`/`data`를 얕은 병합(spread)하도록 설계되어 있어 충돌 위험은 낮다. 다만 향후 이 체인에 세 번째 훅이 추가될 경우 병합 순서 규약(주석 문서화)을 명시적으로 유지해야 한다.
  - 제안: 현 상태로 충분. 후속 훅 추가 시 병합 순서·우선순위(inactive > flowing/completed > highlight)를 spec/코드 주석에 계속 단일 출처로 유지할 것.

## 요약

이번 변경은 워크플로 편집기 엣지에 실행 상태 스타일(데이터 흐름 애니메이션·완료 flash·비활성 점선)을 추가하는 순수 프런트엔드 기능 구현으로, 새 외부 패키지·버전 변경·라이선스 이슈·알려진 취약점이 전혀 없다. 신규 파일(`use-edge-execution-state.ts`)과 `edge-utils.ts` 확장은 기존 스토어(`useExecutionStore`)·기존 CSS keyframe(`edge-flow`)을 재사용하고, 인접 훅(`use-edge-highlighting.ts`/`use-edge-reconnect.ts`)과 동일한 아키텍처 패턴을 따라 내부 의존 구조도 일관적이다. 의존성 관점에서 차단 사유는 없다.

## 위험도

NONE
