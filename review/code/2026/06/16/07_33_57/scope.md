# 변경 범위(Scope) 리뷰

## 발견사항

발견된 범위 이탈 항목 없음.

### 파일별 검토 요약

**파일 1 — `execution-history-panel.test.tsx` (신규)**
§7 패널 컴포넌트의 전용 단위 테스트. 목록 렌더, 항목 클릭, isError, loadingId disabled, 빈 목록, 상세 조회 실패 케이스 등 §7 구현에 직결되는 케이스만 포함. 범위 외 케이스 없음.

**파일 2 — `execution-history-panel.tsx` (신규)**
§7 인-에디터 실행 히스토리 패널 컴포넌트 신규 생성. 기존 컴포넌트 수정 없음. `executionsApi.getByWorkflow`, `executionsApi.getById`, `loadHistoricalExecution`, `TriggerCell`, `STATUS_ICON`, `formatDuration`, `timeAgo` 등 모두 기존 유틸 재사용 — 신규 유틸 추가 없음. 범위 외 기능 없음.

**파일 3 — `editor-toolbar-run-input.test.tsx` (기존 파일 수정)**
헤더 주석 4줄 추가(§7 진입점 커버리지 명시)와 `loadHistoricalExecution` mock 추가, §7 관련 테스트 케이스 2건 추가. 이전 테스트 코드 수정 없음. 추가된 mock은 §7 테스트를 위해 필요한 최소 범위이며, 기존 케이스를 변경하거나 불필요한 cleanup이 없음.

**파일 4 — `editor-toolbar.tsx` (기존 파일 수정)**
추가된 변경:
- `Activity` 아이콘 임포트 1건 (신규 메뉴 아이콘으로 사용)
- `ExecutionHistoryPanel` 컴포넌트 임포트 1건
- `historyPanelOpen` state 1개 추가
- 더보기 메뉴에 "실행 히스토리" 버튼 1개 추가
- JSX 끝에 `ExecutionHistoryPanel` 렌더 추가

기존 코드 수정·정리·리팩토링 없음. 불필요한 포맷팅 변경 없음. 최소 침습(surgical) 추가.

**파일 5·6 — `run-results.en.mdx` / `run-results.mdx` (기존 파일 수정)**
"실행 이력 조회" 절의 내용 갱신. 이전 내용(페이지 이동 중심)이 §7 구현(인-에디터 패널 → 드로어 적재)과 불일치하므로 동반 갱신 필요. 관련 없는 다른 절 수정 없음. `<ImplAnchor>` 추가는 doc 규약(spec-impl-evidence)에 따른 정상 수반 변경. 범위 내.

**파일 7·8 — `dict/en/editor.ts` / `dict/ko/editor.ts` (기존 파일 수정)**
§7 패널에서 사용하는 i18n 키 4건 추가(`executionHistory`, `executionHistoryEmpty`, `executionHistoryListFailed`, `executionHistoryLoadFailed`). 기존 키 수정·삭제 없음. 불필요한 키 추가 없음.

**파일 9 — `execution-store.test.ts` (기존 파일 수정)**
`startHistoryView` action 단위 테스트 1건 추가. 기존 테스트 케이스 수정 없음.

**파일 10 — `execution-store.ts` (기존 파일 수정)**
`startHistoryView` action 추가(인터페이스 선언 + 구현). `startExecution`과 대칭하는 최소 신규 action으로, 기존 action 수정 없음.

**파일 11 — `apply-execution-snapshot.test.ts` (기존 파일 수정)**
`loadHistoricalExecution` 임포트 추가와 orchestration 단위 테스트 1건 추가. `ExecutionData` 타입 임포트 추가(테스트에서 필요). 기존 테스트 수정 없음.

**파일 12 — `apply-execution-snapshot.ts` (기존 파일 수정)**
`loadHistoricalExecution` 함수 신규 추가. 기존 `applyExecutionSnapshot` 함수 수정 없음. 추가된 함수는 §7.3 / §10.10 의 orchestration을 정의하며 범위 내.

**파일 13 — `plan/in-progress/spec-sync-execution-gaps.md` (기존 파일 수정)**
§7 항목을 미완료(`[ ]`)에서 완료(`[x]`)로 상태 업데이트 + 구현 결정 내용 기록. 다른 항목 수정 없음. plan 라이프사이클 규약상 정상 수반 변경.

**파일 14·15·16 — `review/code/...` (신규)**
이전 ai-review 산출물(RESOLUTION.md, SUMMARY.md, _retry_state.json). `review/code/` 하위에 저장되는 리뷰 아티팩트로 프로젝트 규약 내 정상 경로.

---

### 요약

이번 변경은 §7 인-에디터 실행 히스토리 패널 기능(spec/3-workflow-editor/3-execution.md §7)의 frontend-only 구현으로 일관되게 구성되어 있다. 신규 컴포넌트 1개(`execution-history-panel.tsx`), store action 1개(`startHistoryView`), orchestration 함수 1개(`loadHistoricalExecution`)가 추가되고, 진입점인 `editor-toolbar.tsx`에 최소 침습 변경(상태 1개·메뉴 항목 1개·렌더 블록 1개)이 이루어졌다. 수반 변경으로 i18n 사전(ko/en), 유저 가이드 문서(run-results.mdx/en.mdx), plan 파일 상태 갱신이 포함되었으며 모두 §7 구현과 직접 연관된다. 관련 없는 코드 정리, 불필요한 리팩토링, over-engineering, 포맷팅 변경, 무관한 임포트 추가는 발견되지 않았다. 범위 이탈 항목 없음.

### 위험도

NONE

STATUS=success
