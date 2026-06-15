# 요구사항(Requirement) 리뷰 — exec-history-panel (§7 인-에디터 실행 히스토리)

## 발견사항

### [INFO] 기능 완전성 — spec §7 요구사항 전항목 충족
- 위치: `execution-history-panel.tsx`, `editor-toolbar.tsx`, `apply-execution-snapshot.ts`, `execution-store.ts`
- 상세: spec §7.1(⋮ 메뉴 진입점), §7.2(최근 20건 목록·상태 아이콘·트리거·소요시간·노드 카운트·상대시각), §7.3(상세 조회 → 드로어+캔버스 hydrate → Re-run 연동)이 모두 구현돼 있다. 엣지 데이터 미리보기는 spec §7.3 범위 한계 절에서 v1 제외로 명시돼 있어 미구현이 의도적이다.
- 제안: 없음.

### [INFO] spec §7 문서 상태 — 이미 갱신됨 (이전 리뷰의 SPEC-DRIFT 오탐 확인)
- 위치: `spec/3-workflow-editor/3-execution.md` §7, frontmatter `status: implemented`
- 상세: 이전 리뷰 라운드(00_24_26)에서 SPEC-DRIFT W-1로 "spec §7 이 미구현 상태를 기술"이라 보고됐으나, 현재 spec 본문 확인 결과 §7 은 "상태: 구현" 으로 기술돼 있고, frontmatter `status: implemented`, Rationale R-7 이 모두 존재한다. RESOLUTION 이 이를 stale-read FP로 정확히 판정·반증했다. 현 상태에서 spec↔코드 불일치 없음.
- 제안: 없음.

### [INFO] `pending_plans` 잔류 — 의도된 일시적 상태
- 위치: `spec/3-workflow-editor/3-execution.md` frontmatter line 15–16
- 상세: `pending_plans: plan/in-progress/spec-sync-execution-gaps.md` 가 `status: implemented` 와 함께 잔류한다. RESOLUTION INFO-7 이 `spec-status-lifecycle.test.ts` 가드를 확인했고 `implemented` 상태에서는 `pending_plans` 제약이 없음(partial 만 제약)을 검증했다. plan 완료 후 planner 라이프사이클에서 정리 예정으로, 현재는 기능 결함 아님.
- 제안: 없음 (플래너 라이프사이클 완료 시 자연 정리됨).

### [INFO] `historyDisabledRunning` i18n 키 — 진행 중 비활성 게이트 충족
- 위치: `editor-toolbar.tsx` line 602–604 (diff 기준 +615 영역), `en/editor.ts`, `ko/editor.ts`
- 상세: `disabled={!workflowId || isCancellable}` 와 `title={isCancellable ? t("editor.historyDisabledRunning") : undefined}` 가 올바르게 구현돼 있다. spec §7 은 진행 중 비활성 여부를 명시하지 않지만, 과거 실행 적재가 라이브 실행 상태를 덮어쓰는 것을 막는 합리적 방어 로직이며 인라인 주석으로 근거를 설명하고 있다.
- 제안: 없음.

### [INFO] 빈 컬렉션·에러·로딩 경계값 — 모두 처리됨
- 위치: `execution-history-panel.tsx` (조건부 렌더 블록)
- 상세: `isLoading`, `isError`, `executions.length === 0`, 정상 목록의 4가지 상태가 모두 명시적으로 분기 처리된다. `completedNodeCount ?? 0`, `totalNodeCount ?? 0`, `failedNodeCount ?? 0` 으로 null/undefined 방어도 적절하다. `enabled: open && !!workflowId` 조건으로 패널 닫힘 상태 및 `workflowId` 미설정 시 쿼리를 억제한다.
- 제안: 없음.

### [INFO] `loadHistoricalExecution` 호출 순서 및 반환값 — 모든 경로 명시
- 위치: `apply-execution-snapshot.ts` `loadHistoricalExecution` 함수, `execution-history-panel.tsx` `handleSelect`
- 상세: `startHistoryView` → `applyExecutionSnapshot` 순서가 JSDoc 과 테스트(`apply-execution-snapshot.test.ts` 의 nodeResults.length 검증)로 보증된다. `handleSelect` 는 try/catch/finally 로 성공(onClose 호출), 실패(toast.error, 패널 유지), loadingId 클리어 경로를 모두 처리한다.
- 제안: 없음.

### [INFO] `loadingId !== null` — 엄격 비교 적용 확인
- 위치: `execution-history-panel.tsx` line 138
- 상세: 최종 구현 코드에서 `disabled={loadingId !== null}` 으로 엄격 비교가 이미 적용돼 있다. 이전 리뷰에서 INFO-5로 지적된 `!=` → `!==` 수정이 RESOLUTION 에서 FIX로 처리되어 반영됐다.
- 제안: 없음.

### [INFO] `allExecutions` i18n 키 — 기존 키 재사용
- 위치: `execution-history-panel.tsx` line 100 (`t("editor.allExecutions")`), `en/editor.ts` line 191
- 상세: `allExecutions` 키는 기존에 정의된 키(en: "All Executions", ko: "전체 실행")를 재사용한다. 패널 헤더 링크 라벨로 의미가 일치하므로 별도 키 생성이 불필요하다. 이는 신규 i18n 키 추가 없이 기존 사전을 재활용한 합리적 설계다.
- 제안: 없음.

### [INFO] [SPEC-DRIFT] spec §7.2 API 경로 표기
- 위치: spec §7.2 line 274 — `GET /api/executions/workflow/:id`
- 상세: 코드는 `executionsApi.getByWorkflow(workflowId, ...)` 를 호출하며, spec §9 API 표에서 해당 경로는 `GET /api/executions/workflow/:workflowId` 로 일치한다. 표기상 차이 없음 — INFO 수준 확인.
- 제안: 없음.

---

## 요약

§7 인-에디터 실행 히스토리 패널의 구현이 spec §7.1 ~ §7.3 의 모든 요구사항을 충족한다. 진입점(⋮ 메뉴 항목), 목록 표시(최근 20건·상태 아이콘·트리거·소요시간·노드 카운트·상대시각), 항목 클릭 흐름(상세 조회 → `startHistoryView` + `applyExecutionSnapshot` → 드로어/캔버스 hydrate → 패널 닫기), Re-run 연동(`executionId` 세팅으로 드로어 §10.14 재사용)이 spec 본문과 line-level 로 일치한다. 엣지 케이스(빈 목록·에러·로딩·null 카운트·`loadingId` disabled)가 모두 처리돼 있으며, i18n ko/en 대칭도 충족한다. 이전 리뷰 라운드(00_24_26)에서 SPEC-DRIFT로 보고된 spec §7 상태 기술 불일치는 이미 갱신된 spec을 stale-read한 FP였으며 현재 spec 본문에서 반증됐다. Critical 및 Warning 발견사항 없음.

## 위험도

NONE
