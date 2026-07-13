# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** mdx 문서 프런트매터 `code:` 목록에 신규 파일 미등재
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`, `connecting-nodes.en.mdx` 프런트매터 `code:` 배열
  - 상세: 두 mdx 문서의 본문에는 §3.2 실행 상태 스타일(데이터 흐름·완료·비활성) 설명이 정확히 추가됐지만, 프런트매터 `code:` 목록은 기존 6개 파일(`custom-edge.tsx`/`use-edge-highlighting.ts`/`use-edge-reconnect.ts`/`workflow-canvas.tsx`/`editor-store.ts`/`edge-utils.ts`)만 남아 있고 신규 `use-edge-execution-state.ts` 가 추가되지 않았다. `spec/3-workflow-editor/2-edge.md` 의 `code:` 목록에는 이 파일이 정확히 추가된 것과 대비된다. 이는 "범위 밖 수정"이 아니라 "필요한 동반 갱신 누락"이라 엄밀히는 scope 체크리스트(불필요한 추가 변경) 항목보다는 정합성(consistency) 관점에 더 가깝지만, 변경 세트의 완결성 측면에서 참고할 만하다.
  - 제안: 두 mdx 파일의 `code:` 프런트매터에 `use-edge-execution-state.ts` 를 추가해 spec 파일과 동일한 SoT 목록을 유지할 것을 권장(선택 사항, blocking 아님).

## 요약

11개 변경 파일 전체가 plan 항목 "§3.2 엣지 실행 상태 스타일"(데이터 흐름 애니메이션·완료 flash·비활성 반투명) 하나의 구현에 정확히 수렴한다. 신규 훅(`use-edge-execution-state.ts`)과 순수 판정 함수(`edge-utils.ts` `resolveEdgeExecutionState`)만 추가됐고, 기존 파일(`custom-edge.tsx`, `workflow-canvas.tsx`, `globals.css`)에 대한 수정도 인라인 스타일 한 줄·훅 배선 두 줄·CSS 블록 하나로 최소한이다. 백엔드·wire·스토어 API 확장은 전혀 없고(기존 `useExecutionStore` 의 `status`/`nodeStatuses` 를 그대로 소비), 관련 없는 리팩터링·포맷팅·주석 정리·임포트 정리·설정 변경은 발견되지 않았다. CHANGELOG·plan 체크박스·spec 본문 갱신은 이 저장소의 기존 관례(구현 완료 시 3-way 동시 갱신)를 그대로 따르는 필수 동반 변경이며 범위 이탈이 아니다. 상호배타 우선순위(inactive > flowing/completed)를 명시한 설계도 요청된 3개 상태 이상으로 확장되지 않아 over-engineering 소지도 없다.

## 위험도

NONE
