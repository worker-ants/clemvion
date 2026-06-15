# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
대상 spec: `spec/3-workflow-editor/3-execution.md`  
diff-base: `1899c05e`  
검토 일시: 2026-06-16

---

## 발견사항

특기할 만한 충돌 항목이 없다. 각 관점별 확인 결과는 아래와 같다.

### [INFO] 구현 코드가 `spec/3-workflow-editor/3-execution.md §7` 과 일치

- target 위치: `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx`, `editor-toolbar.tsx`
- 충돌 대상: `spec/3-workflow-editor/3-execution.md §7.1–§7.3`
- 상세: spec §7.2 의 API 호출 파라미터(`limit: 20, sort: 'started_at', order: 'desc'`)와 구현의 `executionsApi.getByWorkflow(workflowId, { limit: 20, sort: 'started_at', order: 'desc' })` 가 정확히 일치한다. §7.3 의 상세 조회 → `applyExecutionSnapshot` 재사용 → 패널 닫기 흐름도 구현과 일치한다. spec 에 이미 "구현" 상태로 기술되어 있으므로 정합 상태다.
- 제안: 없음.

### [INFO] 14-execution-history.md §5 R-1(N+1 회피) 참조 방식이 정확히 부합

- target 위치: `apply-execution-snapshot.ts` JSDoc — "목록 응답은 노드 본문을 제외하므로(§5 R-1) 상세를 별도 조회해 적재한다"
- 충돌 대상: `spec/2-navigation/14-execution-history.md §5 R-1`
- 상세: spec R-1 은 목록 API 가 `nodeExecutions` 를 제외하고 배치 집계 카운트(`totalNodeCount`/`completedNodeCount`/`failedNodeCount`)만 반환한다고 명시한다. 구현에서는 `getByWorkflow`(목록) 응답에서 항목을 표시한 뒤, 항목 클릭 시에만 `getById`(상세) 를 별도 호출해 `nodeExecutions` 가 포함된 전체 응답을 가져오는 방식을 채택했다. 이는 R-1 의 설계 의도와 정확히 일치한다. 충돌 없음.
- 제안: 없음.

### [INFO] 데이터 모델 필드 — `triggerSource`/`triggerLabel` 사용이 14-execution-history.md §2.4 정의와 일치

- target 위치: `execution-history-panel.tsx` 내 `<TriggerCell source={ex.triggerSource} label={ex.triggerLabel} />` 및 테스트의 SAMPLE 객체
- 충돌 대상: `spec/2-navigation/14-execution-history.md §2.4 Trigger 출처 분류`
- 상세: 테스트 SAMPLE 의 `triggerSource: "manual"`, `triggerLabel: "Gehrig"` 는 spec §2.4 의 `source: 'manual'` + `triggerLabel = User.name` 정의와 일치한다. 구현이 기존 `TriggerCell` 컴포넌트(실행 내역 페이지와 공유)를 재사용하므로 UI 표현 방식도 동기화된다.
- 제안: 없음.

### [INFO] `startHistoryView` vs `startExecution` — 실행 스토어 상태 전이 분리

- target 위치: `execution-store.ts` 신규 `startHistoryView` 액션
- 충돌 대상: `spec/3-workflow-editor/3-execution.md §10.8 드로어 라이프사이클`, Conversation Thread spec (`spec/conventions/conversation-thread.md §9.7.1`)
- 상세: `startHistoryView` 는 `startExecution` 과 같은 per-execution 상태 클리어를 수행하되, `status = 'running'` (transient) + `startedAt` 은 과거 시각 보존이라는 점에서 의도적으로 다르다. spec §10.8 의 "새 실행 시작 → 이전 히스토리 클리어, 드로어 리셋, conversation snapshot 도 클리어" 는 `startExecution` 만 적용되는 reset 묶음으로 명시되어 있고(`conversation-thread.md §9.7.1` 참조), `startHistoryView` 는 별개 히스토리 적재 경로다. 구현의 `CLEAR_CONVERSATION_SNAPSHOT` 포함과 `CLEAR_INPUT_AFFORDANCE` 포함이 spec 의도와 맞다. `drawerExpanded` 를 의도적으로 유지(사용자 UI 선호 보존)하는 부분도 spec 에서 직접 제약하지 않으므로 충돌 없음.
- 제안: 없음.

### [INFO] 더보기 메뉴 `isCancellable` 비활성 조건 — spec §7 진입 비활성 조건과 부합

- target 위치: `editor-toolbar.tsx` 신규 버튼 — `disabled={!workflowId || isCancellable}`
- 충돌 대상: `spec/3-workflow-editor/3-execution.md §7.1`, `§10.8` (실행 중 상태)
- 상세: spec §7 rationale 에서 "라이브 실행 시 execution-store 리셋이 드로어/캔버스 상태를 덮어쓰는 것을 막는다" 는 의도를 명시했다. 구현에서 `isCancellable`(실행 중 또는 대기 중) 상태에서 버튼을 비활성화하는 것이 이 의도를 구현한다. RBAC/권한 spec 에서 별도 제약이 없고, spec 의 기능 범위 내의 UX 결정이다.
- 제안: 없음.

### [INFO] 유저 가이드 문서 업데이트 — spec 본문과 일치

- target 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx`, `run-results.mdx`
- 충돌 대상: `spec/3-workflow-editor/3-execution.md §7`, `spec/2-navigation/14-execution-history.md`
- 상세: 유저 가이드가 이전의 단일 경로("더보기 → 실행 히스토리 → 전용 페이지 이동")를 인-에디터 패널(빠른 조회) + 전용 페이지(상세 탐색) 두 경로로 분리해 서술한다. "Re-run with this input" 설명도 드로어의 Re-run 버튼을 명시적으로 가리키도록 수정됐다. 이는 spec §7.3 / §10.14 와 일치한다. 한국어·영어 양쪽이 동기화된 상태이며 spec 과 모순 없음.
- 제안: 없음.

---

## 요약

이번 diff(§7 인-에디터 실행 히스토리 패널)는 frontend-only 구현으로, 신규 백엔드 엔티티·마이그레이션·API endpoint 없이 기존 `GET /api/executions/workflow/:id` 와 `GET /api/executions/:id` 를 재사용한다. API 파라미터, 응답 shape 사용 방식(목록은 집계 카운트만 사용, 상세는 별도 조회로 `nodeExecutions` 획득), 트리거 출처 분류, Re-run 진입점 위임 방식 모두 `spec/3-workflow-editor/3-execution.md §7`, `spec/2-navigation/14-execution-history.md §2.4·§5 R-1`, `spec/5-system/13-replay-rerun.md` 와 충돌하지 않는다. 실행 스토어의 `startHistoryView` 신규 액션은 `startExecution` 과 의도적으로 분리된 별개 경로로, `spec/conventions/conversation-thread.md §9.7.1` 의 reset 정책 범위를 침범하지 않는다. Cross-Spec 관점에서 CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다.

---

## 위험도

NONE
