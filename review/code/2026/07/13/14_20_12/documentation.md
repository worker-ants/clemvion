# 문서화(Documentation) 리뷰 — §3.2 엣지 실행 상태 스타일

## 발견사항

- **[WARNING]** `custom-edge.tsx` 인라인 주석이 실제 구현 메커니즘과 다르게 서술
  - 위치: `codebase/frontend/src/components/editor/canvas/custom-edge.tsx` (신규 주석, `inactive` 변수 선언 직전)
  - 상세: 주석 원문은 "데이터 흐름(animated)·완료 flash(className)는 각각 **React Flow 내장 애니메이션**·globals.css 가 처리하므로 여기서는 정적 상태인 inactive 만 스타일링한다" 라고 적혀 있다. 그러나 실제로는 flowing 도 completed 와 **동일하게** `edge.className`(`wc-edge-flowing`/`wc-edge-completed`, `use-edge-execution-state.ts` 가 부여) 을 globals.css 의 `@keyframes`/CSS `animation` 속성으로 소비하는 방식이다 — diff 어디에도 React Flow 의 네이티브 `animated` edge prop(`edge.animated = true`) 을 사용하는 코드가 없다("React Flow 내장 애니메이션" 이라는 기능 자체가 이 구현에 존재하지 않음). 즉 flowing 과 completed 는 **같은 메커니즘**(className → globals.css CSS animation) 인데, 주석은 서로 다른 두 메커니즘("React Flow 내장" vs "globals.css")으로 처리되는 것처럼 서술해 오해를 유발한다.
  - 제안: "데이터 흐름·완료 flash 는 각각 `wc-edge-flowing`/`wc-edge-completed` className 으로 globals.css 가 CSS 애니메이션으로 처리하므로, 여기서는 정적 상태인 inactive 만 스타일링한다" 등으로 정정.

- **[WARNING]** `workflow-canvas.tsx` 인라인 주석의 "합성" 메커니즘 서술이 불명확/부정확
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `useEdgeExecutionState`/`useEdgeHighlighting` 호출 직전 주석("§3.2 실행 상태 스타일 ... 그 위에 §3.3 hover/선택 하이라이팅을 얹는다(두 관심사가 edge.data 로 합성)")
  - 상세: 같은 PR 의 `use-edge-execution-state.ts` JSDoc/인라인 주석은 정반대로 "flowing·completed 는 상호배타 → 둘 중 하나만 className 으로... `useEdgeHighlighting` 의 **Set 병합**이 edge-highlighted 만 얹게 한다" 라고 명시한다. 즉 실행 상태(flowing/completed)와 hover/선택 하이라이트의 합성은 주로 `className` Set 병합으로 이뤄지고, `edge.data`(`edgeInactive`) 는 inactive 플래그 전달에만 쓰인다. workflow-canvas.tsx 의 "두 관심사가 edge.data 로 합성" 이라는 요약은 같은 기능을 설명하는 두 파일의 주석이 서로 다른 메커니즘을 주장하는 셈이라 후속 유지보수 시 혼선을 줄 수 있다.
  - 제안: "className Set 병합(하이라이트) + edge.data.edgeInactive(비활성)로 합성" 등으로 두 파일의 서술을 통일.

- **[INFO]** CHANGELOG 항목에 테스트 커버리지 언급 없음(plan 파일과 detail 레벨 불일치)
  - 위치: `CHANGELOG.md` 신규 "§3.2" 섹션
  - 상세: 같은 섹션 바로 아래 §1.3 항목은 "detach 결정을 renderHook 단위 테스트" 처럼 테스트 방식을 명시하는 반면, 본 §3.2 항목은 테스트 언급이 없다(테스트 존재 사실은 `plan/in-progress/spec-sync-edge-gaps.md` 에만 "vitest 7케이스" 로 기재됨). 치명적이지 않으나 인접 항목과 상세도가 다르다.
  - 제안: 선택사항 — CHANGELOG 항목 말미에 "`resolveEdgeExecutionState` vitest 7케이스" 등 한 구절 추가해 일관성 확보.

## 요약

이번 변경(§3.2 엣지 실행 상태 스타일)은 문서화 관점에서 전반적으로 모범적이다 — CHANGELOG, spec(`spec/3-workflow-editor/2-edge.md`, 표+"현재 구현" 서술+SoT `code:` 리스트까지 동반 갱신), plan 체크박스, 사용자 가이드 mdx(한/영 양쪽 parity 유지) 가 모두 함께 갱신되었고, 신규 함수(`resolveEdgeExecutionState`, `useEdgeExecutionState`, `FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS`)에는 목적·우선순위·상호배제 관계를 설명하는 JSDoc 이 잘 갖춰져 있으며 단위 테스트(7케이스)도 그 서술과 정확히 일치한다. 다만 `custom-edge.tsx` 와 `workflow-canvas.tsx` 에 새로 추가된 두 인라인 주석은 실제 구현 메커니즘(className 기반 CSS 애니메이션·Set 병합)과 다르게 서술되어 있어("React Flow 내장 애니메이션", "edge.data 로 합성") 향후 유지보수 시 혼선을 줄 수 있다 — 코드 자체는 정상 동작하므로 차단 사유는 아니고 주석 정정 권고 수준이다.

## 위험도
LOW
