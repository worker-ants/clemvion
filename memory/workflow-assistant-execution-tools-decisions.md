# Workflow AI Assistant — 실행 조회 도구(get_workflow_executions / get_execution_details) 기획 결정 메모

사용자가 어시스턴트의 실행 결과 조회 기능 추가를 요청(2026-04-24)해 project-planner 역할에서 스펙을 확정했다. 배경은 어시스턴트가 자동 생성한 표현식이 분기 `null`로 터졌던 이슈에서 출발 — 어시스턴트가 실행 결과를 읽고 원인을 진단·수정할 수 있어야 유사 실수의 셀프 복구가 가능하다는 사용자 의도.

## 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 도구 수 | 2종 (`get_workflow_executions`, `get_execution_details`) | 기존 탐색 도구 6종과 동일 패턴. list→detail 2-step 으로 토큰 경제성 확보 |
| 스코프 | 현재 세션 워크플로의 실행 + 그 실행 트리의 **직계 자식 실행(depth 1)** | 유저의 "sub-workflow node에서 실행된건 1이야 2야?" 질문에 대한 답 — 실행 트리 관점으로 해석. 2 단계 이상 중첩은 별도 호출로 분리해 응답 부피 제어 |
| 민감 필드 마스킹 | `maskSensitiveFields` 공통 유틸 재귀 적용 (apiKey/token/password/secret/authorization/...). 원본은 DB 에 그대로 남김 | 채팅 창에 그대로 렌더되므로 최소 안전 기본값 필수. 기존 유틸 재사용 |
| 페이로드 크기 제한 | **없음** (마스킹만) | 사용자 명시 선택. 대신 2-step 패턴(list → 특정 id detail) 을 프롬프트가 강제 |
| Running/waiting 실행 조회 | 허용 — 현재까지 기록된 부분 타임라인 반환 | §12.2의 "실행 중 편집 도구 거부" 는 read 에 적용하지 않음. 실시간 디버깅 UX |
| 세션 스코프 키 | `session.workflow_id` 에서 자동 유도 — 인자로 `workflowId` 받지 않음 | scope 경계 명확화, LLM 의 잘못된 workflowId 추정 방지 |
| 도구 kind | `'explore'` (read-only) — plan-only 턴에서도 사용 가능, 실행 중 거부 규약 미적용 | 일관성 |

## 응답 envelope (spec §4.1.1 참조)

```
ExecutionDetailsResponse {
  ok: true,
  execution: { id, workflowId, workflowName, status, startedAt, finishedAt, durationMs,
               inputData(masked), outputData(masked), error(masked),
               parentExecutionId, recursionDepth },
  timeline: [{ nodeExecutionId, nodeId, nodeLabel, nodeType, status,
               startedAt, finishedAt, durationMs,
               inputData(masked), outputData(masked), error(masked),
               retryCount, parentNodeExecutionId }],
  subExecutions: [{ execution, timeline }],   // depth 1
  subExecutionsTruncatedDepth?: number        // 추가 depth 생략 신호
}
```

에러 코드:
- `EXECUTION_NOT_FOUND` — id 없음 or workspace 밖
- `EXECUTION_NOT_IN_SCOPE` — id 는 있지만 현재 세션 워크플로의 실행/직계 자식이 아님

## 구현 단계에서 유의 사항

1. **기존 서비스 재사용.** `executions.service.ts:24-44` 의 `findById(id)` 가 이미 `nodeExecutions: NodeExecution[]` 을 `startedAt ASC` 로 포함해 반환. `findByWorkflow(workflowId, query)` 는 페이지네이션 + 상태 필터 지원. 새 DB 쿼리 없이 이 두 서비스 위에 얇은 어댑터(`explore-tools.service.ts` 에 메서드 추가) 만 얹으면 됨.
2. **스코프 검증.** `get_execution_details` 는 다음 순서로 허용 여부 판정:
   a. `executions.findById(id)` — 없으면 `EXECUTION_NOT_FOUND`.
   b. `execution.workflowId === session.workflowId` 면 통과.
   c. 그렇지 않으면 `execution.parentExecutionId` 가 가리키는 부모를 한 번 조회해 `parent.workflowId === session.workflowId` 면 통과.
   d. 둘 다 아니면 `EXECUTION_NOT_IN_SCOPE`. (workspace 경계 체크는 `execution.workflow.workspaceId === session.workspaceId` 로 별도 수행 → 없으면 `EXECUTION_NOT_FOUND` 와 동일 취급으로 information leak 방지.)
3. **sub-workflow 확장.** 통과한 `execution` 에 대해 `executions.repo.find({ where: { parentExecutionId: execution.id } })` 로 직계 자식 목록을 조회, 각각에 대해 `findById` 를 불러 `subExecutions` 채움. 2-depth 이상은 자식 실행의 `subExecutions` 를 채우지 않고 `subExecutionsTruncatedDepth: 1` 를 세팅. 자식 실행의 `nodeExecutions.length > 0` 이면 이미 내부에 sub-workflow 가 존재한다는 힌트 — `subExecutionsTruncatedDepth` 는 자식 한 건이라도 2-depth 자손이 있으면 발행.
4. **마스킹 구현.** `backend/src/common/utils/mask-sensitive-fields.util.ts` 재사용. 응답 직렬화 직전에 `inputData`/`outputData`/`error` 필드를 각각 한 번씩 통과시킴. 원본 DB row 는 건드리지 않음.
5. **tool kind 분류.** `tool-definitions.ts:15-30` 의 `TOOL_KIND_BY_NAME` 에 두 이름을 `'explore'` 로 추가.
6. **dispatch 추가.** `workflow-assistant-stream.service.ts` 의 `handleExploreCall()` switch 에 두 case 추가.
7. **시스템 프롬프트 갱신.** `system-prompt.ts` 에 "실행 이슈 진단 패턴" 한 단락(2-step: list → detail) 추가. 스펙 §8 에 이미 해당 행 추가됨 — 프롬프트 구현은 그 내용을 옮기기만 하면 됨.
8. **테스트.** `explore-tools.service.spec.ts`(없으면 신설) 에 `EXECUTION_NOT_FOUND` / `EXECUTION_NOT_IN_SCOPE` / 마스킹 / sub-workflow 확장 / running 상태 부분 타임라인 5 케이스 선작성. `workflow-assistant-stream.service.spec.ts` 에도 end-to-end mock 추가.
9. **국제화.** `frontend` 의 `ko.ts`/`en.ts` 에 `assistant.exploreExecutionsList`, `assistant.exploreExecutionDetails`, `assistant.executionNotInScope` 3개 키 추가.

## 영향 문서 (이번 턴에 개정 완료)

- `prd/2-workflow-editor.md` — §10.9 `ED-AI-35~38` 추가
- `prd/6-phase2-ai.md` — §3.6 cross-ref 에 실행 조회 권한 한 줄 보강
- `prd/7-execution-history.md` — §3.3 `EH-NAV-04` 추가 (❌ 로드맵)
- `spec/3-workflow-editor/4-ai-assistant.md` — §4.1 도구 2 row, §4.1.1 응답 구조 신설, §8 프롬프트 지침, §12.2 read 허용, §13 i18n 3개, §14 매핑
- `spec/0-overview.md` — 매핑표에 `ED-AI-*` → `Spec 3-workflow-editor/4` 로 이미 있음 (변경 불필요)

## 열린 주제 (후속 개정 시 검토)

- 2-depth 이상 sub-workflow 의 확장 UX: 현재는 `subExecutionsTruncatedDepth` 플래그로만 신호하고 별도 조회. 유저 보고가 누적되면 optional 인자 `depth?: number` 추가를 검토.
- Running 실행의 "부분 타임라인" 응답 포맷 안정성: WebSocket 스트림과 REST 조회 시점의 race 로 동일 실행이 조회 시마다 다른 timeline 을 돌려줄 수 있다. 어시스턴트에게 이를 "스냅샷" 으로 인식하도록 프롬프트에 명시할지 여부 — MVP 에선 별도 지침 없이 진행, 실 사용 중 혼선 보고되면 §8 에 단락 추가.
- `get_workflow_executions` 에 `search` / `dateRange` 옵션 추가 여부: PRD 7 의 `/executions/workflow/:workflowId` REST API 가 이미 status/sort/page 를 지원하므로 서버 측 추가 쿼리 없이도 확장 가능. 사용자 요청이 들어오면 증분 추가.
