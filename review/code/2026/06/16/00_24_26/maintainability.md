# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `editor-toolbar.tsx` 함수 길이 및 다중 책임
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 전체
- 상세: `EditorToolbar` 컴포넌트가 이미 900줄 이상의 거대한 단일 함수다. 이번 변경에서 `historyPanelOpen` 상태 + `ExecutionHistoryPanel` 렌더링이 추가되어 책임이 더 늘었다. 현재 이 컴포넌트는 실행 제어, 저장/취소, 데이터셋 관리, 버전 히스토리, 실행 히스토리, 삭제 확인, 드롭다운 상태 등 7개 이상의 독립 관심사를 한 컴포넌트에서 처리한다.
- 제안: `ExecutionHistoryPanel`을 도입한 것처럼, `historyPanelOpen` 상태와 메뉴 항목 렌더링을 `EditorToolbarMoreMenu`와 같은 분리 컴포넌트로 추출하는 방향을 권장한다. 단, 이번 변경 자체가 기존 패턴을 심각하게 악화시키지는 않으므로 WARNING 수준이다.

### [WARNING] 아이콘 선택 불일치 — 실행 히스토리 메뉴에 `Play` 아이콘 사용
- 위치: `editor-toolbar.tsx` 더보기(⋮) 메뉴, `editor-execution-history-menu` 버튼
- 상세: 버전 히스토리 메뉴 항목에는 `History` 아이콘, 실행 히스토리 패널(`execution-history-panel.tsx`) 헤더에도 `History` 아이콘을 사용하는데, 더보기 메뉴의 "실행 히스토리" 진입점에는 `Play` 아이콘을 사용한다. 같은 기능에 대해 두 곳에서 다른 아이콘이 쓰이면 사용자와 개발자 모두에게 혼란을 준다. `Play`는 실행 트리거 의미이고, 히스토리 탐색은 `History` 또는 `Clock` 계열이 더 의미에 맞다.
- 제안: `editor-toolbar.tsx`의 `editor-execution-history-menu` 버튼 아이콘을 `History size={14}`로 교체한다. 이미 `History`가 import되어 있으므로 추가 import 없이 변경 가능하다.

### [INFO] 매직 넘버 — `limit: 20`, `limit: 10` 하드코딩
- 위치:
  - `execution-history-panel.tsx` 라인 ~390: `limit: 20`
  - `editor-toolbar.tsx` 라인 ~1350: `limit: 10`
  - 테스트 파일들의 mock expectation에도 각각 20, 10이 하드코딩됨
- 상세: 두 쿼리가 서로 다른 limit 값을 쓴다. 이 값들이 왜 다른지(`historyPickerOpen`은 공간이 작아 10, 패널은 풀패널이라 20) 코드에서 명시되어 있지 않다. 또한 이 숫자들이 API의 최대 page size 등 외부 제약과 연관이 있는지 알 수 없다.
- 제안: 파일 상단에 상수로 추출하거나, 인라인 주석으로 근거를 명시한다. 예: `const HISTORY_PANEL_LIMIT = 20; // 패널은 스크롤 가능하므로 20건 선조회`.

### [INFO] `loadingId != null` vs `loadingId !== null` 일관성
- 위치: `execution-history-panel.tsx` 라인 ~475: `disabled={loadingId != null}`
- 상세: 코드베이스 전반이 TypeScript strict 모드를 사용하는 것으로 보이는데, `!= null` (느슨한 비교)과 `!== null` (엄격한 비교)의 혼용은 작은 일관성 위반이다.
- 제안: `disabled={loadingId !== null}`로 교체한다.

### [INFO] 테스트 파일의 중복 pagination mock 리터럴
- 위치: `execution-history-panel.test.tsx` 내 4개 테스트, `editor-toolbar-run-input.test.tsx` 내 신규 추가 테스트
- 상세: `{ page: 1, limit: 20, totalItems: 1, totalPages: 1 }` 형태의 pagination 객체가 테스트 케이스마다 반복 리터럴로 등장한다. 동일한 구조가 5회 이상 복사되어 있어, pagination 스키마가 변경될 때 여러 곳을 수정해야 한다.
- 제안: 테스트 파일 내에 `const makePage = (totalItems: number) => ({ page: 1, limit: 20, totalItems, totalPages: Math.ceil(totalItems / 20) })` 같은 헬퍼를 두어 반복을 줄인다.

### [INFO] `renderPanel` 함수에서 `QueryClient`를 매번 재생성
- 위치: `execution-history-panel.test.tsx` 라인 ~72
- 상세: `renderPanel` 호출마다 `new QueryClient()`를 생성한다. `beforeEach`에서 `cleanup()`을 호출하므로 테스트 격리는 유지되지만, `QueryClient` 인스턴스 생성 패턴이 해당 프로젝트의 다른 테스트 파일(e.g., `editor-toolbar-run-input.test.tsx`)과 완전히 동일하여 공통 test util로 추출할 여지가 있다.
- 제안: 단기적으로는 현 구조 유지가 무방하나, 테스트 유틸리티 파일에 `createTestQueryClient()` 헬퍼를 두면 프로젝트 전체 테스트의 일관성이 높아진다.

### [INFO] `allExecutions` i18n 키 중복 정의
- 위치: `en/editor.ts` 라인 2224: `allExecutions: "All Executions"`, `execution-history-panel.tsx`에서 `t("editor.allExecutions")` 사용
- 상세: 이 키는 패널 헤더의 외부 링크 라벨로 사용된다. 동일한 의미의 문자열이 이미 `editor.ts`에 `allExecutions`로 존재하며, 이는 기존 Run Results 드로어용으로도 사용되었을 가능성이 있다. 현재 사용은 올바르지만, 이 키의 원래 사용처와 중복 사용 여부를 명확히 문서화하지 않으면 나중에 키 의미가 모호해질 수 있다.
- 제안: 이 수준에서는 현 구조 유지가 적절하다. 단, 키 사용 맥락이 다르다면 `editor.executionHistoryAllLink`와 같이 별도 키로 분리하는 것을 고려할 수 있다.

## 요약

이번 변경은 `ExecutionHistoryPanel`을 신규 컴포넌트로 분리한 설계 선택이 적절하며, 기존 코드베이스의 스타일(useQuery 패턴, i18n, HSL CSS 변수, useCallback 등)을 충실히 따른다. 테스트 파일도 spec 섹션 번호를 명시하고 케이스별 의도가 명확하다. 주요 유지보수성 우려는 `editor-toolbar.tsx`가 이미 거대 컴포넌트인 상황에서 기능이 계속 추가되는 구조적 경향성과, 더보기 메뉴의 실행 히스토리 아이콘 선택(`Play`)이 패널 자체의 아이콘(`History`)과 불일치하는 점이다. 매직 넘버와 테스트 중복 리터럴은 소규모 개선 여지이나 긴급하지 않다.

## 위험도

LOW
