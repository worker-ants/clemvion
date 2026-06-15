# 아키텍처(Architecture) 리뷰 — §7 인-에디터 실행 히스토리 패널

## 발견사항

### [INFO] ExecutionHistoryPanel — 단일 책임 및 레이어 분리 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx`
- 상세: 컴포넌트는 프레젠테이션 레이어 책임(목록 렌더·상태 표시·닫기 콜백)에 충실하며, 데이터 조회는 `useQuery`(비즈니스/데이터 레이어 위임)로, store mutation은 `loadHistoricalExecution`(별도 orchestration 레이어)으로 분리했다. 자체 비즈니스 로직을 내장하지 않아 SRP를 잘 지킨다.
- 제안: 추가 개선 불필요.

### [INFO] loadHistoricalExecution — Facade 패턴의 적절한 적용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`
- 상세: `startHistoryView` + `applyExecutionSnapshot` 두 호출을 하나의 얇은 래퍼로 캡슐화한 것은 Facade 패턴의 교과서적 적용이다. 소비자(`ExecutionHistoryPanel`)는 두 함수의 존재와 호출 순서를 알 필요 없다. 향후 히스토리 적재 로직이 변경되더라도 소비자 코드는 수정 없이 유지된다. 개방-폐쇄 원칙(OCP) 관점에서도 적절하다.
- 제안: 추가 개선 불필요.

### [INFO] startHistoryView — startExecution과의 코드 중복(잠재적 산탄총 수술 위험)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/execution-store.ts`
- 상세: `startExecution`과 `startHistoryView`가 동일한 per-execution 클리어 필드 집합(nodeStatuses, nodeResults, nodeResultIndexByExecId, lastIndexByNodeId, firstNoExecIdIndexByNodeId, selectedResultNodeId, CLEAR_INPUT_AFFORDANCE, CLEAR_CONVERSATION_SNAPSHOT)을 중복 나열한다. 차이는 `status`와 `startedAt` 두 필드뿐이다. 향후 per-execution 클리어 대상 필드가 추가될 때 두 함수를 모두 수정해야 하는 산탄총 수술(shotgun surgery) 안티패턴이 잠재한다. 현재 `CLEAR_INPUT_AFFORDANCE`, `CLEAR_CONVERSATION_SNAPSHOT` 상수로 일부 공통화가 되어 있으나 나머지 Map 초기화 필드는 수동 중복 상태다.
- 제안: 공통 클리어 필드를 `CLEAR_PER_EXECUTION_STATE` 상수로 추출해 두 함수가 spread로 공유하면 DRY 원칙과 단일 수정 지점을 확보할 수 있다. `set({ executionId, status: "running", startedAt, ...CLEAR_PER_EXECUTION_STATE })` 형태로 정리 가능. (긴급 결함은 아니며 DEFER 수용 가능한 INFO 수준)

### [WARNING] loadHistoricalExecution의 모듈 위치 — websocket 디렉터리 내 REST 전용 orchestration
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`
- 상세: `loadHistoricalExecution`은 WebSocket과 무관한 REST 상세 응답(`ExecutionData`)을 받아 store를 hydrate하는 orchestration 함수다. 파일이 `lib/websocket/` 디렉터리에 위치해 있어 모듈 경계와 명칭이 불일치한다. `applyExecutionSnapshot`은 WS 이벤트 처리에서 출발했으나 이미 REST 폴링 경로에서도 호출되는 공유 entry이므로, 두 함수가 함께 있어 응집도는 높다. 그러나 새 기여자가 `websocket/` 디렉터리에서 순수 REST orchestration 함수를 찾을 것을 기대하기 어려워 모듈 경계 가독성이 떨어진다.
- 제안: 단기: 현행 유지 + 주석 명시(이미 JSDoc에 기술됨)로 충분. 중기: `lib/execution-orchestration.ts` 또는 `lib/stores/execution-hydration.ts`로 두 함수를 이동해 `websocket/` 디렉터리의 책임 범위를 WS 이벤트 처리 전용으로 좁히는 것을 권장. 단, 이번 PR 단독 문제가 아닌 기존 `applyExecutionSnapshot`의 위치 문제이므로 별도 리팩토링 대상.

### [WARNING] EditorToolbar — 거대 컴포넌트 책임 누적(기존 기술 부채의 지속)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
- 상세: `EditorToolbar`는 이미 900줄+ 이상의 단일 컴포넌트로, 실행 제어·저장/취소·버전 히스토리·실행 히스토리·데이터셋 CRUD·삭제 확인·export 등 7개 이상의 독립된 관심사를 단일 컴포넌트에 집중시키고 있다. 이번 변경이 `historyPanelOpen` state 1개 + 메뉴 항목 1개 + 패널 렌더 1개를 추가함으로써 SRP(Single Responsibility Principle) 위반 정도가 더 심화됐다. 현재 더보기(⋮) 메뉴 내 버튼들은 모두 EditorToolbar의 로컬 상태와 핸들러에 밀접 결합되어 있어 `MoreDropdownMenu` 컴포넌트로의 추출이 필요하다. SOLID의 SRP와 레이어 분리(프레젠테이션 레이어 내부 분리) 관점의 문제다.
- 제안: `EditorToolbarMoreMenu` 또는 `MoreDropdownMenu` 컴포넌트를 추출해 더보기 메뉴 상태(historyPanelOpen, deleteConfirmOpen 등) + 메뉴 항목 + 하위 패널 렌더를 이 컴포넌트로 위임. 별도 리팩토링 plan으로 등록 권장. 이번 PR 최소 침습 추가 자체는 기존 패턴을 심각하게 악화시키지 않으나 기술 부채 누적이 계속되고 있다.

### [INFO] ExecutionHistoryPanel 마운트 패턴 혼재 — 이중 제어(workflowId 조건부 + open prop)
- 위치: `/Volumes/project/private/clemvion/.claire/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (패널 렌더 블록)
- 상세: `{workflowId && <ExecutionHistoryPanel open={historyPanelOpen} ... />}` 패턴은 동일 파일 내 다른 모달(deleteConfirm 등)이 사용하는 `condition && <Dialog>` 단일 조건부 렌더와 혼재한다. `ExecutionHistoryPanel`은 `workflowId` 외부 조건 + `open` prop 내부 제어의 이중 구조다. 이는 컴포넌트가 `open=false`일 때 조기 반환(`if (!open) return null`)하는 설계와 결합되어 방어 중복을 낳는다. 결합도·일관성 관점에서 패턴이 혼재한다.
- 제안: `{workflowId && historyPanelOpen && <ExecutionHistoryPanel ... />}` 단일 조건부 렌더로 통일하거나, 반대로 `open` prop 패턴을 파일 전체에 통일하는 방향 중 하나를 선택. 현재 기능적으로는 문제 없으나 패턴 일관성을 위해 코드베이스 표준에 맞추는 것이 권장.

### [INFO] 의존성 방향 — 단방향 의존 그래프 확인됨, 순환 의존 없음
- 위치: 변경된 파일 전체
- 상세: 의존 방향이 `editor-toolbar.tsx(entry)` → `execution-history-panel.tsx(UI)` → `apply-execution-snapshot.ts(orchestration)` → `execution-store.ts(state)` / `executionsApi(data)` 로 명확한 단방향이다. `execution-history-panel.tsx`가 `editor-toolbar.tsx`를 역참조하거나, `execution-store.ts`가 UI 컴포넌트를 참조하는 순환 의존이 없다. 레이어 간 의존성 역전 원칙(DIP)도 `executionsApi` 인터페이스를 통해 데이터 레이어와 분리된다.
- 제안: 추가 개선 불필요.

### [INFO] 추상화 수준 — 적절, 과도하거나 부족한 추상화 없음
- 위치: 변경된 파일 전체
- 상세: `loadHistoricalExecution`은 필요 최소한의 orchestration만 추상화하고(2줄 로직), `ExecutionHistoryPanel`은 UI 상태(loadingId)를 로컬로 보유하면서 비즈니스 로직은 외부 레이어에 위임한다. 기존 `applyExecutionSnapshot`, `TriggerCell`, `STATUS_ICON`, `formatDuration`, `timeAgo` 등 공유 유틸을 재사용해 불필요한 재구현을 피했다. 추상화가 너무 깊거나(over-engineering) 너무 얕아(뭉텅이 로직) 유지보수가 어려운 상황이 아니다.
- 제안: 추가 개선 불필요.

### [INFO] 확장성 — 히스토리 패널 기능 확장에 유연한 구조
- 위치: `execution-history-panel.tsx`, `apply-execution-snapshot.ts`
- 상세: 향후 페이지네이션(무한 스크롤), 상태 필터, 엣지 데이터 미리보기 등이 추가될 때 `ExecutionHistoryPanel`이 독립 컴포넌트이므로 `editor-toolbar.tsx`를 수정하지 않고 패널 내부만 확장하면 된다. `loadHistoricalExecution` wrapper도 미래의 pre/post 훅(예: 권한 확인, 드로어 강제 오픈) 삽입 지점으로 활용 가능하다. 패널의 `limit: 20` 하드코딩이 named constant로 추출되지 않은 점은 소규모 확장성 nit이나 주석으로 근거가 기술되어 있다.
- 제안: 중장기 확장 시 `PANEL_HISTORY_LIMIT` 상수 추출 권장(INFO 수준).

---

## 요약

이번 §7 인-에디터 실행 히스토리 패널 구현은 전반적으로 건전한 아키텍처 원칙을 따른다. `ExecutionHistoryPanel`을 독립 컴포넌트로 분리하고, `loadHistoricalExecution` Facade로 orchestration을 캡슐화하며, 기존 `applyExecutionSnapshot` store hydration 경로를 재사용함으로써 레이어 책임 분리와 DRY 원칙을 잘 지켰다. 단방향 의존 그래프가 유지되고 순환 참조가 없다. 주요 아키텍처 우려는 두 가지다: (1) `loadHistoricalExecution`이 `lib/websocket/` 디렉터리에 위치하는 모듈 경계 불일치 — REST orchestration 함수가 WebSocket 전용으로 인식되는 디렉터리에 있어 향후 기여자의 탐색 비용을 높인다; (2) `EditorToolbar`의 책임 누적이 이번 변경으로 계속 악화되어 SRP 위반이 심화되고 있다. 두 이슈 모두 이번 PR 단독 문제가 아닌 기존 기술 부채의 연속이며, 본 PR의 최소 침습 추가 자체는 기존 패턴을 극적으로 악화시키지 않는다. `startExecution`/`startHistoryView` 클리어 필드 중복은 향후 필드 추가 시 산탄총 수술 위험을 내포하나 현재 기능 결함이 아니다.

## 위험도

LOW
