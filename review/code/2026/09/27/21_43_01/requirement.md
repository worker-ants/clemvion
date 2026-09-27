# 요구사항(Requirement) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** `assertModelConfigRefsInWorkspace` 는 값이 바뀌지 않아도 매번 재검증한다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `assertModelConfigRefsInWorkspace` (라인 206-235), 호출부 `update()` (라인 243)
  - 상세: 같은 파일의 `embeddingModelConfigId` 처리는 `dto.embeddingModelConfigId !== kb.embeddingModelConfigId` 일 때만 `findEntity` 를 호출해 불변 값 재조회를 피한다(라인 256-259 부근). 반면 `extractionLlmConfigId` · `rerankConfigId` · `rerankLlmConfigId` 는 값이 기존과 동일해도 PATCH 본문에 실려 있기만 하면(`dto.xxx` truthy) 매번 `findEntity` 를 다시 호출한다. 기능적으로는 틀리지 않는다(이미 유효한 참조는 재검증도 통과) — 다만 embeddingModelConfigId 와의 처리 비대칭이 있고, PATCH 요청마다 불필요한 DB 왕복이 최대 2회 늘어난다.
  - 제안: 기능 결함이 아니므로 이번 PR 을 막을 사유는 아님. 필요하면 후속으로 `dto.xxx !== undefined && dto.xxx !== kb.xxx` 가드를 추가해 embeddingModelConfigId 와 패턴을 통일할 수 있다.

- **[INFO]** 엣지 UNIQUE 제약의 `workflow_id` 미포함 · 실행 경로의 기존 교차 참조 방어선은 이번 PR 범위 밖으로 명시적으로 이연됨
  - 위치: `plan/in-progress/cross-workspace-refs.md` "이 PR 밖으로 넘기는 것" 절, `spec/data-flow/12-workspace.md` `## Rationale` "본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)" 단락(엣지 UNIQUE 에 `workflow_id` 가 없어 남의 연결 튜플을 선점할 수 있다는 서술, "둘 다 재지 않았다")
  - 상세: 저장 전 소속 검사(이번 PR)는 **새로** 생기는 교차 참조 행을 막지만, (a) 엣지 `(source_node_id, source_port, target_node_id, target_port)` UNIQUE 제약에 `workflow_id` 가 없어 남의 워크플로와 튜플이 우연히 겹치면 409 를 유발할 수 있는 부수효과, (b) 이미 DB 에 존재할 수 있는 교차 워크스페이스 행에 대한 실행 시점 방어선은 이 PR 이 다루지 않는다. 두 항목 다 plan 과 spec Rationale 에 "트래커로 넘긴다" 로 명시돼 있어 은폐된 갭이 아니라 의도적 스코프 경계다.
  - 제안: 별도 조치 불필요(이미 트래커 항목화 계획 명시). 코드 결함 아님 — 정보 제공 목적.

- **[INFO]** `nodes.service.ts` 의 `assertPlacementInWorkflow` 는 `containerId`/`toolOwnerId` 를 순차 2회 `exists()` 조회하는 반면, `edges.service.ts`/`workflows.service.ts` 의 동종 검사는 `In([...])` 배치 조회 1회를 쓴다
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` `assertPlacementInWorkflow` (라인 97-119)
  - 상세: 기능·응답 형태에는 영향 없음(최대 2개 필드이므로 순차 호출도 정확하고 비용도 작다). 다른 파일과의 구현 스타일 비대칭만 있음.
  - 제안: 조치 불필요. 참고용 기록.

## spec fidelity 대조 요약

관련 spec: `spec/1-data-model.md` §1.1(신설, 같은 PR 의 planner 턴 `a8bfd1492`/`18f235a81`), `spec/5-system/2-api-convention.md` §5.3, `spec/5-system/3-error-handling.md` §1.11, `spec/data-flow/12-workspace.md` Rationale.

§1.1 표의 9개 행을 코드와 line-level 대조했다 — 전부 일치:

| spec §1.1 행 | 구현 | 확인 |
|---|---|---|
| 트리거·스케줄 생성 `workflowId`, 알림 규칙 생성 `workflowId` → 워크스페이스 범위 | `triggers.service.ts:487-492`, `schedules.service.ts:188-193`, `alerts.service.ts:31-38` — 전부 `create()` 전용, `Update*Dto` 에 `workflowId` 없음(트리거/스케줄) 또는 update 미반영(알림) | 일치 |
| 워크플로 생성·수정 `folderId`, 폴더 생성·수정 `parentId` → 워크스페이스 범위 | `workflows.service.ts` `assertFolderInWorkspace`(create·update 양쪽 호출), `folders.service.ts` `assertParentInWorkspace`(create 신설 + update `validateParentChange` 재사용) | 일치 |
| 트리거 `authConfigId` → 워크스페이스 범위, 404 아님 | 기존 `assertAuthConfigInWorkspace` (이번 diff 밖, 회귀 없음 확인) | 일치 |
| 어시스턴트 세션 `llmConfigId`, KB `embeddingModelConfigId`·`extractionLlmConfigId`·`rerankConfigId`·`rerankLlmConfigId` → ModelConfig(kind) · 404 `MODEL_CONFIG_NOT_FOUND` | `workflow-assistant-session.service.ts` `assertLlmConfigInWorkspace`→`llmService.resolveConfig`→`findEntity(id, ws, 'chat')`; KB `assertModelConfigRefsInWorkspace`(chat/rerank/chat) — `spec/1-data-model.md:436`(rerank_llm_config_id kind=chat), `spec/5-system/10-graph-rag.md:88`(extractionLlmConfigId kind=chat), `spec/5-system/9-rag-search.md:213`(rerankConfigId kind=rerank) 와 kind 값까지 일치 | 일치 |
| 노드 `containerId`/`toolOwnerId`, 엣지 `sourceNodeId`/`targetNodeId` → 같은 워크플로 범위 | `nodes.service.ts` `assertPlacementInWorkflow`, `edges.service.ts` `assertEndpointsInWorkflow` | 일치 |
| 캔버스 저장 `nodes[].containerId`/`toolOwnerId`/`edges[].sourceNodeId`/`targetNodeId` → 이번 페이로드의 노드 | `workflows.service.ts` `validateCanvasReferences` | 일치 |
| 캔버스 저장 `nodes[].id` 중 워크플로에 없는 것 → 어느 행도 안 쓰는 id 여야 함, 충돌 시 거부 | `workflows.service.ts` `assertNewNodeIdsUnused` (트랜잭션 내부, `existingNodeMap` 으로 자기 워크플로 기존 id 는 제외) | 일치 |
| 거부 응답 400 `VALIDATION_ERROR` + `details: [{field, message, code:'INVALID_FIELD'}]` (배열, 여러 항목 동시 가능) | `reference-in-scope.ts` `throwInvalidReferences`, 및 이를 재사용하는 모든 호출부 | 일치. `reference-in-scope.spec.ts` 가 파이프(`CustomValidationPipe`)와 동일 shape 임을 단언 |
| 없는 id 와 남의 id 를 구분하지 않음 | `assertReferenceInScope` 는 `exists({ where })` 단일 불리언 판정만 사용, 존재 이유를 노출하지 않음 | 일치 |

## e2e·단위·뮤턴트 커버리지 확인

- `codebase/backend/test/cross-workspace-references.e2e-spec.ts` (신규) — spec §1.1 표의 모든 필드를 워크스페이스 범위/워크플로 범위로 나눠 실제 HTTP 요청으로 검증, 캔버스 저장 케이스는 거부 후 피해자 행이 실제로 그대로인지(`SELECT ... FROM node`)까지 확인.
- 단위 테스트: `reference-in-scope.spec.ts`, `edges.service.spec.ts`, `folders.service.spec.ts`, `knowledge-base.service.spec.ts`, `nodes.service.spec.ts`, `schedules.service.spec.ts`, `triggers.service.spec.ts`, `workflows.service.spec.ts` 전부 성공/실패/null-스킵 세 갈래를 다룸(예: `nodes.service.spec.ts` "null(배치 해제)은 조회하지 않고 통과한다").
- `plan/in-progress/cross-workspace-refs.md` §뮤턴트 — 검증 로직을 한 줄씩 제거하는 M1~M5 뮤턴트 전부 KILLED로 기록, 대상 쿼리(`where` 의 `workspaceId`/`workflowId` 제거, 존재 조회 자체 제거)를 정확히 짚음.

## 요약

`cross-workspace-refs` PR 은 요청 본문의 참조 id 가 다른 워크스페이스(구조 참조는 다른 워크플로) 행을 가리켜도 저장되던 결함을 저장 전 검사(`assertReferenceInScope`/`throwInvalidReferences` 공용 헬퍼 + 개별 서비스별 확장)로 닫는다. `spec/1-data-model.md` §1.1(같은 PR 의 planner 턴이 신설)의 표 9개 행 전부를 코드와 line-level 로 대조했고 필드명·에러 코드(`VALIDATION_ERROR`/`MODEL_CONFIG_NOT_FOUND`)·`details` 배열 형태·ModelConfig `kind` 값·null/undefined(고정 해제) 처리·워크스페이스 vs 워크플로 범위 구분이 모두 일치한다. e2e 18케이스(고치기 전 전부 RED 확인 기록 있음) + 서비스별 단위 테스트 + 뮤턴트 5종 KILLED 로 실제 동작까지 검증됐다. TODO/FIXME 류 미완성 표식은 없고, 반환값·에러 시나리오·엣지 케이스(빈 배열 미발생 가드, null 스킵, 부분 PATCH 시 미전송 필드 스킵) 모두 정의돼 있다. 발견된 사항은 전부 INFO 수준(비대칭적 재검증 최적화 누락, 순차 vs 배치 조회 스타일 차이, 이미 문서화된 스코프 밖 후속 항목)이며 코드를 막을 CRITICAL/WARNING은 없다.

## 위험도

NONE
