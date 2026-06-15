# Resolution — ai-review 07_33_57 (§7 fresh review)

리뷰: **Critical 0 / Warning 2 / INFO 14**, risk LOW. 이전 리뷰(00_24_26) 9 Warning 전건 처리 확인됨. 본 라운드 처분.

## Warning

| # | 카테고리 | 처분 | 조치 |
|---|----------|------|------|
| 1 | Testing — 호출순서 명시검증 | **FIX(보강)** | `loadHistoricalExecution` 테스트의 `nodeResults.toHaveLength(1)` 단언이 곧 순서 검증임을 주석으로 명시 — startHistoryView 가 결과를 비우므로 순서 역전 시 length 0 이 되어 실패. 별도 fragile spy 대신 상태 단언의 순서-민감성을 문서화. |
| 2 | Maintainability — editor-toolbar 비대화 | **DEFER** | 이전 RESOLUTION(00_24_26) W-7 와 동일. 본 PR 은 최소 침습(메뉴 1·state 1·렌더 1). `MoreDropdownMenu` 추출은 별도 리팩토링 plan. |

## INFO

| # | 카테고리 | 처분 | 조치 |
|---|----------|------|------|
| side_effect#1 | 라이브 실행 중 히스토리 적재 → store 리셋 데이터 소실 | **FIX(가드)** | ⋮ "실행 히스토리" 메뉴 항목을 `running`/`waiting_for_input`(`isCancellable`) 동안 disabled + tooltip(`editor.historyDisabledRunning`, ko/en). Run 버튼이 실행 중 비활성인 것과 동일 취지. |
| side_effect#3 | `drawerExpanded` 미변경 의도 주석 부재 | **FIX(주석)** | `startHistoryView` 에 "drawerExpanded 의도적 유지" 주석 추가. |
| testing#5 | isLoading 경로 미테스트 | **FIX** | 미해소 Promise mock 으로 로딩 UI 단언 케이스 추가. |
| testing#6 | failedNodeCount>0 분기 미테스트 | **FIX** | `failedNodeCount:1` fixture 로 `(1 failed)` 단언 케이스 추가. |
| testing#7 | "All Executions" href 미검증 | **FIX** | href=`/workflows/wf-1/executions` 단언 케이스 추가. |
| testing#8 | startHistoryView status 단언 부재 | **FIX** | `expect(state.status).toBe("running")` 추가. |
| side_effect#4 | React Query stale 목록 순간 표시 | **DEFER** | 표준 동작·실질 문제 없음(리뷰어도 명시). 패널 재오픈 시 background refetch. |
| maintainability#2 | startExecution/startHistoryView 클리어 필드 중복 | **DEFER** | `CLEAR_EXECUTION_STATE` 추출은 startExecution 도 건드려 회귀면 확대 — 본 PR 범위 밖. |
| maintainability#9/#10/#11/#13/#14, doc#12 | cleanup 이중·픽스처 헬퍼·모달 패턴·키 네이밍·파일 위치·named constant | **DEFER** | 전부 비결함 nit. 회귀 위험 없음. |

## 검증
- eslint PASS / tsc PASS / 영향 suite + docs 가드(ImplAnchor·spec-status-lifecycle) PASS (2337) / 프로덕션 build PASS.
- 본 RESOLUTION 의 FIX 는 본 커밋에 포함. 이후 추가 코드 편집 없이 final fresh review 로 종결.

## 잔여(미차단)
- W-2(toolbar 분리), INFO DEFER 항목 — 모두 비결함·후속 nit.
