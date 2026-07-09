# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** MiniMap/Panel 렌더 순서 역전으로 인한 암묵적 stacking order 의존
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` (JSX fragment 내 `{visible && <MiniMap .../>}` 를 `<Panel>` 보다 앞으로 이동, L23-42 부근)
  - 상세: 기존 코드는 `<Panel>`(토글 버튼)을 먼저, `<MiniMap>`을 나중에 렌더링했다. 두 엘리먼트 모두 explicit `z-index` 없이 절대 위치(overlay)로 배치되므로, 겹칠 경우 나중에 렌더링된 쪽(기존: MiniMap)이 위로 그려지는 소스 순서 기반 painter's algorithm 에 의존하고 있었다 — 이것이 바로 "맵이 버튼을 덮는" 버그의 근본 원인이었다. 이번 diff 는 순서를 뒤집어(MiniMap 먼저, Panel/버튼 나중) 버튼이 항상 위로 오도록 고쳤는데, 이는 의도된 수정이지만 stacking 이 여전히 "소스 순서"라는 암묵적 규칙에 의존한다는 근본 구조는 그대로다. 위치 오프셋(`!bottom-12` vs `!bottom-2`)으로 실제로는 두 엘리먼트가 겹치지 않게 되어 있어 현재는 stacking order 가 결과에 영향을 주지 않지만, 추후 다른 개발자가 이 fragment 순서를 바꾸거나 세 번째 겹치는 오버레이를 추가하면 동일 계열의 회귀가 재발할 수 있는 잠재 리스크는 남아있다.
  - 제안: 현재 diff 범위에서 차단 사유는 아님. 이미 추가된 회귀 테스트("floats the minimap above the toggle button so they never overlap")가 이 관계를 검증하므로 충분한 안전망으로 판단됨. 참고 사항으로만 기록.

- **[INFO]** `CanvasMinimap` 공개 시그니처/유일 호출부 불변 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` export, `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:725` (`<CanvasMinimap />`)
  - 상세: 컴포넌트는 이번에도 props 없이 호출된다(`export function CanvasMinimap()`). 변경은 내부 JSX 순서와 Tailwind className(오프셋 값) 재배치뿐이며, 유일한 호출부(`workflow-canvas.tsx`)는 수정되지 않았다. 공개 인터페이스·시그니처 영향 없음 — 확인 목적으로만 기재.

- **[INFO]** `@xyflow/react` 목(mock) 변경은 테스트 파일 로컬 범위
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/canvas-minimap.test.tsx:8-33` (`vi.mock("@xyflow/react", ...)`)
  - 상세: `Panel`/`MiniMap` stub 이 `className`/`position`/`data-testid` 를 DOM 속성으로 forward 하도록 정교화됐다. `vi.mock` 은 vitest 모듈 레지스트리 상에서 해당 테스트 파일(모듈 그래프)에 격리되어 적용되므로 다른 테스트 파일이나 프로덕션 번들에는 영향이 없다. 부작용 없음.

- **[INFO]** 문서(mdx) 텍스트만 변경, 런타임 영향 없음
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.en.mdx:28`, `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx:39`
  - 상세: "토글 버튼이 미니맵 위에 있다" → "아래에 있다" 로 텍스트만 수정, 실제 UI 배치 변경(`canvas-minimap.tsx`)과 일치하는 정정. 코드 실행 경로·상태·네트워크에 영향 없는 정적 콘텐츠 변경.

## 요약

이번 변경은 `CanvasMinimap` 컴포넌트 내부의 JSX 렌더 순서와 Tailwind 오프셋 className 을 재배치해 "미니맵이 토글 버튼을 덮는" 레이아웃 버그를 수정한 순수 UI 조정이며, 컴포넌트의 공개 시그니처(무인자 호출)·유일 호출부(`workflow-canvas.tsx`)·전역 상태·환경 변수·네트워크 호출·파일시스템 어디에도 영향을 주지 않는다. 새로 도입된 테스트 mock 은 해당 테스트 파일에 격리되어 있고, 문서 변경은 실제 구현과 일치하도록 정적 텍스트만 수정한 것이다. 유일하게 주목할 점은 두 겹치는 오버레이(MiniMap/Panel)의 시각적 순서가 여전히 explicit z-index 가 아닌 JSX 소스 순서에 암묵적으로 의존한다는 구조적 특성이 남아있다는 것인데, 이는 이번 diff 로 새로 생긴 리스크가 아니라 기존 설계의 연장이며 새로 추가된 회귀 테스트가 이를 충분히 커버한다.

## 위험도

NONE
