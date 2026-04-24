# Workflow AI Assistant — 실행 조회 도구 추가 (개발자 workflow)

## 개요

어시스턴트에 read-only 탐색 도구 2종을 추가한다:
- `get_workflow_executions` — 현재 세션 워크플로의 최근 실행 목록 (기본 10, 상한 50, 상태 필터 선택)
- `get_execution_details` — 실행 id 하나의 전체 타임라인 + 직계 자식 sub-workflow 실행까지 포함

근거 스펙:
- PRD [`prd/2-workflow-editor.md` §10.9 `ED-AI-35~38`](../prd/2-workflow-editor.md#109-실행-결과-조회-진단수정)
- PRD [`prd/7-execution-history.md` §3.3 `EH-NAV-04`](../prd/7-execution-history.md)
- Spec [`spec/3-workflow-editor/4-ai-assistant.md` §4.1, §4.1.1, §8, §12.2, §13, §14](../spec/3-workflow-editor/4-ai-assistant.md)
- 의사결정 메모 [`memory/workflow-assistant-execution-tools-decisions.md`](../memory/workflow-assistant-execution-tools-decisions.md)

## 작업 단계 (SDD + TDD) — 완료

### Phase 1 — 테스트 선작성 ✅

- [x] `backend/src/modules/workflow-assistant/tools/explore-tools.service.spec.ts` 신설 (총 16 케이스)
  - [x] `getWorkflowExecutions` — 정상 + DB GROUP BY 통계 집계 + 빈 결과 + limit 클램프 + status 필터
  - [x] `getWorkflowExecutions` — `INVALID_ID` / `WORKFLOW_NOT_FOUND` (workspace 경계 밖)
  - [x] `getExecutionDetails` — 정상 + 타임라인 + subExecutions(1-level) + 배치 쿼리 확인
  - [x] `getExecutionDetails` — `EXECUTION_NOT_FOUND`, `EXECUTION_NOT_IN_SCOPE` (parent null + 제3 워크플로 + cross-workspace 세 분기)
  - [x] `getExecutionDetails` — 부모 chain 을 통한 직계 자식 실행 스코프 통과
  - [x] `getExecutionDetails` — `running` 상태 부분 타임라인
  - [x] `getExecutionDetails` — 민감 필드 재귀 마스킹
  - [x] `getExecutionDetails` — `subExecutionsTruncatedDepth` 발행/미발행
- [x] `workflow-assistant-stream.service.spec.ts` — `get_workflow_executions` / `get_execution_details` dispatch + SSE envelope 2 케이스

### Phase 2 — 구현 ✅

- [x] `tool-definitions.ts` — `TOOL_KIND_BY_NAME` + JSON schema 2 도구 등록, `EXECUTION_STATUS_VALUES` 공유
- [x] `explore-tools.service.ts`
  - [x] `Execution` / `NodeExecution` Repository 직접 주입 (주석 명시된 설계 — `ExecutionsService` 어댑터 경로는 RBAC 수요 생기기 전까지 연기)
  - [x] `getWorkflowExecutions(workspaceId, workflowId, opts)` — list + GROUP BY 통계
  - [x] `getExecutionDetails(workspaceId, currentWorkflowId, executionId)` — 스코프 검증 + 병렬 쿼리 + 배치 자식 timeline + 2-depth 힌트 + 마스킹
  - [x] 공통 유틸 `maskSensitiveFields` 재사용
  - [x] `TIMELINE_ROW_CAP = 500` + `timelineTruncated` 플래그
- [x] `workflow-assistant-stream.service.ts` — `handleExploreCall` switch 2 case
- [x] `workflow-assistant.module.ts` — TypeOrmModule.forFeature 에 Execution/NodeExecution 추가
- [x] `system-prompt.ts` — Contracts 하위에 "Diagnosing past executions" 섹션, 2-step 패턴 교육
- [x] `system-prompt.spec.ts` — 해당 교육의 7 anchor 고정 테스트
- [x] `frontend/src/lib/i18n/dict/{ko,en}.ts` — `exploreExecutionsList` · `exploreExecutionDetails` · `executionNotInScope` 3 키
- [x] `frontend/src/components/editor/assistant-panel/tool-call-badge.tsx` — `summarize()` 에 두 도구 케이스 (status 필터 + count 요약)

### Phase 3 — TEST WORKFLOW ✅

1. [x] backend lint (`--max-warnings=0`) clean
2. [x] backend unit: 1868/1868 passed
3. [x] backend build: green
4. [x] frontend lint: clean
5. [x] frontend vitest: 1075/1075 passed
6. [x] frontend build: green (tsconfig 에 test exclude 추가로 vitest 4.1.4 타입 export 이슈 우회)

### Phase 4 — REVIEW WORKFLOW ✅

1. [x] `ai-review` skill 실행 — review/2026-04-24_12-18-04/SUMMARY.md
2. [x] Warning 이슈 11건 전부 해결
   - [x] (W1) i18n 키 사용처 불명확 → spec §13 에 배지 관례 주석 추가
   - [x] (W2) `isExecutionInScope` 제3 워크플로 분기 테스트 추가
   - [x] (W3) 배지 테스트는 기존 `tool-call-badge.test.ts` 가 group 로직만 커버 — `summarize` 분기 테스트 후속 검토 (RESOLUTION.md 기재)
   - [x] (W4) `TIMELINE_ROW_CAP = 500` + `timelineTruncated` 플래그 + 스펙 갱신
   - [x] (W5) 자식 timeline 배치 쿼리로 N+1 제거
   - [x] (W6) 인덱스는 V002/V006 에 이미 존재 — 비작업
   - [x] (W7) `EXECUTION_STATUS_VALUES` 공유 export
   - [x] (W8) `getExecutionDetails` 독립 쿼리 Promise.all 병렬화
   - [x] (W9) `loadNodeStats` DB GROUP BY 로 전환
   - [x] (W10) `frontend/tsconfig.json` test exclude — 별도 `tsconfig.test.json` 은 RESOLUTION.md 후속
   - [x] (W11) 본 plan 파일 체크박스 최신화 (현재 커밋)
3. [x] `review/2026-04-24_12-18-04/RESOLUTION.md` 에 조치 내용 기록
4. [x] 조치 후 TEST WORKFLOW 재수행 — 전부 green 유지

## 완료 기준

- [x] Spec §4.1 · §4.1.1 의 응답 shape 과 에러 코드가 구현과 정합
- [x] PRD ED-AI-35~38 네 요구사항이 각각 스펙 섹션·구현·테스트로 매칭
- [x] lint/unit/build 전부 green
- [x] ai-review 의 Warning 이상 이슈 0 건 (혹은 후속 처리 RESOLUTION.md 기재)
