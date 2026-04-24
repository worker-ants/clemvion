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

## 작업 단계 (SDD + TDD)

### Phase 1 — 테스트 선작성

- [ ] `backend/src/modules/workflow-assistant/tools/explore-tools.service.spec.ts` 신설 또는 확장
  - [ ] `getWorkflowExecutions(session, {limit, status})` — 목록 + 페이지네이션 + 상태 필터
  - [ ] `getWorkflowExecutions` — 다른 워크플로의 실행은 반환 안 됨
  - [ ] `getExecutionDetails(session, id)` — 정상 케이스: execution + timeline + subExecutions(1 level)
  - [ ] `getExecutionDetails` — `EXECUTION_NOT_FOUND` (없는 id, workspace 경계 밖 동일 처리)
  - [ ] `getExecutionDetails` — `EXECUTION_NOT_IN_SCOPE` (다른 워크플로의 실행 + 직계 자식도 아닌 경우)
  - [ ] `getExecutionDetails` — 직계 자식 실행 id 를 넘기면 부모 통해 스코프 통과
  - [ ] `getExecutionDetails` — `running` 상태 실행의 부분 타임라인 반환 (finishedAt null, 끝나지 않은 노드 status 그대로)
  - [ ] `getExecutionDetails` — 민감 필드(apiKey/token/password/secret) 가 마스킹되어 반환됨
  - [ ] `getExecutionDetails` — 2-depth sub-workflow 가 존재하면 `subExecutionsTruncatedDepth: 1` 플래그
- [ ] `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` 에 end-to-end mock 추가
  - [ ] LLM 이 `get_workflow_executions` 호출 → SSE `tool_call` kind=`explore` 로 발행
  - [ ] LLM 이 `get_execution_details` 호출 → 동일

### Phase 2 — 구현

- [ ] `backend/src/modules/workflow-assistant/tools/tool-definitions.ts`
  - [ ] `TOOL_KIND_BY_NAME` 에 `get_workflow_executions: 'explore'`, `get_execution_details: 'explore'` 추가
  - [ ] `buildAssistantToolsInternal()` 반환 배열에 두 도구의 `name`/`description`/`parameters` JSON schema 추가
- [ ] `backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
  - [ ] `ExecutionsService` + `NodeExecutionsRepository` 주입 (생성자 확장, `workflow-assistant.module.ts` imports 조정)
  - [ ] `getWorkflowExecutions(workspaceId, workflowId, { limit, status })` 추가
  - [ ] `getExecutionDetails(workspaceId, workflowId, executionId)` 추가 — 스코프 검증 → 본 실행 조회 → 직계 자식 확장 → 마스킹 적용
  - [ ] 마스킹: `backend/src/common/utils/mask-sensitive-fields.util.ts` 의 `maskSensitiveFields` 재사용. inputData/outputData/error 만 통과
- [ ] `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts`
  - [ ] `handleExploreCall()` switch 에 두 case 추가. 인자 파싱 후 `exploreTools.getWorkflowExecutions` / `.getExecutionDetails` 호출
- [ ] `backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
  - [ ] 기존 Contracts 또는 Expression language 섹션 근처에 "실행 이슈 진단 패턴" 한 단락 추가: 2-step 호출(list → detail), 직계 자식까지 자동 포함, 민감 필드 마스킹 적용됨을 LLM 에 가르침
  - [ ] 관련 회귀 테스트를 `system-prompt.spec.ts` 에 한 건 추가 (해당 문구 존재 확인)
- [ ] `frontend/src/lib/i18n/ko.ts` + `en.ts`
  - [ ] `assistant.exploreExecutionsList`, `assistant.exploreExecutionDetails`, `assistant.executionNotInScope` 3개 키 추가 (`types.ts` 는 ko.ts 자동 파생)
- [ ] `frontend/src/components/assistant/tool-call-badge.tsx` (또는 대응 배지 렌더러)
  - [ ] `get_workflow_executions` / `get_execution_details` 를 탐색 배지(🔍)로 렌더. 요약 라벨은 위 i18n 키 사용

### Phase 3 — TEST WORKFLOW

1. [ ] lint (backend + frontend)
2. [ ] unit test (backend + frontend)
3. [ ] build (backend + frontend)

문제 발견 시 해당 단계부터 재수행.

### Phase 4 — REVIEW WORKFLOW

1. [ ] `ai-review` skill 로 코드 리뷰
2. [ ] Warning 이상 이슈와 테스트 누락 이슈 전부 해결
3. [ ] `review/**/RESOLUTION.md` 에 조치 내용 기록
4. [ ] 조치 후 TEST WORKFLOW 재수행

## 완료 기준

- Spec §4.1 · §4.1.1 의 응답 shape 과 에러 코드가 구현과 정합
- PRD ED-AI-35~38 네 요구사항이 각각 스펙 섹션·구현·테스트로 매칭
- lint/unit/build 전부 green
- ai-review 의 Warning 이상 이슈 0 건
