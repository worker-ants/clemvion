# 유지보수성(Maintainability) 리뷰 — exec-history-panel (§7) 2차

## 발견사항

### [WARNING] `editor-toolbar.tsx` 함수 길이 및 다중 책임 — 지속 누적
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (905줄)
- 상세: 이번 변경에서 `historyPanelOpen` 상태 1개, `ExecutionHistoryPanel` 렌더 블록, 더보기 메뉴 항목 1개가 추가되어 총 905줄이 되었다. 이 컴포넌트는 현재 실행 제어·저장·취소·버전 히스토리·실행 히스토리·데이터셋 CRUD·삭제 확인·MoreMenu 상태 관리 등 8개 이상의 독립 관심사를 단일 함수 컴포넌트에서 처리한다. 추가된 코드 자체는 최소 침습이나, 구조적 복잡도 누적은 경고 수준이다.
- 제안: 이번 변경 자체를 롤백할 이유는 없다. MoreMenu 관련 상태와 렌더링을 `EditorToolbarMoreMenu` 컴포넌트로 추출하는 리팩토링을 별도 plan으로 추적할 것을 권장한다.

### [INFO] 매직 넘버 `limit: 20` / `limit: 10` — 설명 주석 추가됨, 상수 추출 미적용
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` 라인 51
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 라인 114
- 상세: `limit: 20`에 "인-컨텍스트 빠른 조회용 최근 20건 — 그 이상은 전용 페이지로 위임, Run dialog 의 picker 는 10건" 인라인 주석이 추가되어 이전 리뷰 INFO 지적은 부분 해소됐다. 그러나 두 값이 소스별로 분산된 리터럴로 남아 있어 API 제약 변경 시 여러 파일을 수정해야 한다. 테스트 mock expectation(`limit: 20`, `limit: 10`)도 동일 리터럴이 7회 반복된다.
- 제안: 긴급하지 않으나, `execution-history-panel.tsx` 상단에 `const HISTORY_PANEL_LIMIT = 20;` 상수로 추출하고 테스트에서도 참조하면 변경점이 단일화된다.

### [INFO] 테스트 파일의 pagination mock 리터럴 7회 반복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` (라인 91, 109, 119, 139, 169, 197, 206)
- 상세: `{ page: 1, limit: 20, totalItems: N, totalPages: N }` 구조가 7개 테스트 케이스에서 리터럴로 반복된다. pagination 스키마가 변경될 경우 7곳을 수정해야 한다.
- 제안: 테스트 파일 상단에 `const makePage = (total: number) => ({ page: 1, limit: 20, totalItems: total, totalPages: Math.ceil(total / 20) || 0 })` 헬퍼를 두어 반복을 줄인다. 회귀 위험 없는 가독성 개선이다.

### [INFO] `loadingId !== null` — 이전 지적 해소 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` 라인 138
- 상세: 이전 리뷰(00_24_26)의 INFO-5 `!= null` → `!== null` 교체가 현재 코드에 반영되어 있음을 확인. 조치 완료.
- 제안: 해소됨.

### [INFO] 아이콘 일관성 — 이전 지적 해소 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 라인 609, `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` 라인 90
- 상세: 더보기 메뉴 진입점과 패널 헤더 양쪽 모두 `Activity` 아이콘으로 통일되어 있음을 확인. 이전 리뷰 W-8 지적 해소 완료.
- 제안: 해소됨.

### [INFO] `renderPanel` 테스트 헬퍼 — `QueryClient` 재생성 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` 라인 72
- 상세: `renderPanel` 호출마다 `new QueryClient()`를 생성한다. `beforeEach`의 `cleanup()`으로 격리는 유지된다. 이 패턴은 `editor-toolbar-run-input.test.tsx`와 동일하여 코드베이스 내 일관성은 있다. 공통 `createTestQueryClient()` 유틸로 추출하면 전체 일관성이 높아지나 현 상태도 문제 없다.
- 제안: 선택적 개선 사항. 현 구조 유지 무방.

### [INFO] `loadHistoricalExecution` 배치 위치 — 기능적 응집도 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` 라인 303-308
- 상세: `loadHistoricalExecution`이 `applyExecutionSnapshot.ts` 내에 정의되어 `applyExecutionSnapshot`과 함께 배치된 것은 두 함수의 강한 결합 관계(orchestrator가 내부를 직접 호출)를 반영한 적절한 응집도 선택이다. 별도 파일로 분리하면 오히려 관계가 모호해진다.
- 제안: 현 배치 유지.

---

## 요약

이번 변경의 핵심 구현 파일들(`execution-history-panel.tsx`, `apply-execution-snapshot.ts`, `execution-store.ts`)은 유지보수성 관점에서 전반적으로 양호하다. 기존 코드베이스의 `hsl(var(--...))` CSS 변수 패턴, `useQuery`/`useCallback` 훅 패턴, i18n 사용 방식을 충실히 따르고 있으며, JSDoc과 인라인 주석이 설계 의도와 spec 참조를 명확히 기술한다. 이전 리뷰(00_24_26)의 `loadingId !== null` 수정과 아이콘 통일(`Activity`) 조치는 모두 현재 코드에 반영되어 있다. 주요 잔여 우려는 `editor-toolbar.tsx`의 구조적 비대화(905줄, 8+ 관심사)이나, 이번 추가 자체는 최소 침습이며 본 PR 단독 문제가 아니다. pagination mock 리터럴 반복(7회)과 `limit` 매직 넘버 상수 미추출은 소규모 개선 여지로 남는다.

## 위험도

LOW

STATUS=success
