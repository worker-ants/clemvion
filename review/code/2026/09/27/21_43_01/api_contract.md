# API 계약(API Contract) 리뷰 — cross-workspace-refs

대상: 쓰기 요청 본문의 참조 id 가 다른 워크스페이스(구조 참조는 다른 워크플로) 행을 가리키면 저장 전에 거부하는 변경
(`codebase/backend/src/common/utils/reference-in-scope.ts` 신설 + `alerts`·`edges`·`folders`·`knowledge-base`·`nodes`·`schedules`·
`triggers`·`workflow-assistant`·`workflows` 서비스 배선, e2e `cross-workspace-references.e2e-spec.ts` 18케이스, CHANGELOG).

## 발견사항

- **[INFO]** 구조 참조(`containerId`/`toolOwnerId`/엣지 끝점) 거부 메시지가 두 갈래로 갈린다 — "in this canvas" vs "in this workflow"
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateCanvasReferences`(예: `'Container node not found in this canvas'`) vs
    `codebase/backend/src/modules/nodes/nodes.service.ts` `assertPlacementInWorkflow`(`` `${ref.what} node not found in this workflow` ``) ·
    `codebase/backend/src/modules/edges/edges.service.ts` `assertEndpointsInWorkflow`(`'Source/Target node not found in this workflow'`)
  - 상세: 같은 필드(`containerId`/`toolOwnerId`/엣지 끝점)에 대한 같은 종류의 거부인데, 캔버스 저장 경로는 "이번 페이로드 안" 을 검사하고
    노드/엣지 단건 API 는 "이미 저장된 워크플로 행" 을 검사한다는 차이가 있어 의도적 구분으로 읽힌다(JSDoc 도 각각 "이번 페이로드의
    노드만" vs "같은 워크플로의 노드만" 으로 구분해 설명한다). 다만 `code`(`INVALID_FIELD`)·`field` 는 동일하고 `message` 만 달라, 이
    문구를 파싱해 사용자에게 그대로 보여주는 프런트가 있다면 두 경로에서 표현이 미묘하게 어긋난다.
  - 제안: 의도된 구분이면 현행 유지로 충분하다(차단 사유 아님). 문구 통일이 필요하면 공용 메시지 템플릿을 `reference-in-scope.ts` 쪽에
    두는 정도의 후속 정리만 고려.

- **[INFO]** 저장 전 검사가 대부분 DB 트랜잭션 밖의 별도 조회(check-then-act)다 — 워크플로 캔버스 저장·생성만 예외
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts` `create`(`assertReferenceInScope` 뒤 별도 `repository.save`) ·
    `codebase/backend/src/modules/folders/folders.service.ts` `assertParentInWorkspace` · `codebase/backend/src/modules/nodes/nodes.service.ts`
    `assertPlacementInWorkflow` · `codebase/backend/src/modules/schedules/schedules.service.ts` `create` · `codebase/backend/src/modules/triggers/triggers.service.ts` `create`
  - 상세: `assertReferenceInScope`/`assertPlacementInWorkflow`/`assertEndpointsInWorkflow` 는 조회 결과를 받은 뒤 별도 호출로 `save`/`create`
    한다. 참조 대상(워크플로·폴더·노드)이 검사와 저장 사이에 삭제되면 이론상 FK 위반(500)으로 새는 아주 좁은 레이스 창이 남는다.
    다만 이는 이 PR 이 새로 만든 패턴이 아니라 이 코드베이스 전반의 기존 소유권 검사 스타일(`assertWorkflowInWorkspace` 등)을 그대로
    따른 것이라 이번 변경만의 회귀는 아니다. `workflows.service.ts` 의 `create`/`saveCanvas` 만 검사 전체를 `dataSource.transaction` 진입
    이전 또는 트랜잭션 안에서 수행해 상대적으로 더 안전하다.
  - 제안: 차단 사유 아님. 기존 스타일과의 일관성 문제이지 이 PR 이 새로 도입한 취약점이 아니다. 트랜잭션화는 별도 후속 과제로 고려 가능.

- **[INFO]** 후속 항목(트리거 `config` JSONB 내 비밀 참조 미검증, 이미 저장된 교차 워크스페이스 행, OAuth `mode=new` `integrationId`)은
  의도적으로 이 PR 범위 밖
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` "교차 워크스페이스 참조 후속" 항목
  - 상세: 저장 전 검사는 **신규 쓰기**만 막는다 — 이미 DB 에 존재할 수 있는 교차 워크스페이스 행(과거에 성공적으로 저장된 트리거/스케줄의
    `workflowId` 등)은 이 PR 로 정리되지 않고, 실행 엔진(`execute()`)이 `findOneBy({ id })` 로 워크플로를 읽는 경로도 그대로다. 트래커에
    명시적으로 이월돼 있어 누락은 아니지만, API 계약 관점에서 "저장 시 400" 이 곧 "실행 시 안전" 을 의미하지 않는다는 점은 명확히 해 둘
    필요가 있다.
  - 제안: 차단 사유 아님(이미 트래커 등재 확인). 실행 시점 방어선(`trigger.workspace_id <> workflow.workspace_id` 거부)을 다음 PR 로
    미루는 결정 자체는 이 리뷰 범위 밖.

## 검증한 항목 (문제 없음)

- **응답 봉투 일관성**: `throwInvalidReferences` 가 내는 `400 VALIDATION_ERROR` + `details: [{ field, message, code: 'INVALID_FIELD' }]` 는
  기존 `CustomValidationPipe.flattenErrors`(`codebase/backend/src/common/pipes/validation.pipe.ts`)가 내는 것과 **정확히 같은 배열 형태**다.
  `spec/1-data-model.md` §1.1 최종본도 배열 형태로 확정돼 있어(`--spec` 리뷰가 잡았던 "객체 vs 배열" MEDIUM 은 착지 전 정정됨), 스키마
  드리프트 없음.
- **에러 코드 재사용**: 모델 설정 참조(어시스턴트 세션 `llmConfigId`, KB `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId`)는
  새 코드를 만들지 않고 기존 `ModelConfigService.findEntity`/`LlmService.resolveConfig` 의 `404 MODEL_CONFIG_NOT_FOUND` 를 재사용한다 —
  같은 요청의 `embeddingModelConfigId` 와 동일한 코드/형태.
- **필수 필드 선행 검증**: `assertReferenceInScope` 를 무조건 호출하는 자리(`triggers.service.ts` 의 `workflowId`,
  `schedules.service.ts` 의 `workflowId`)는 대응 DTO(`CreateTriggerDto.workflowId`, `CreateScheduleDto.workflowId`)가 둘 다
  옵셔널이 아닌 필수 문자열이라, `ValidationPipe` 가 이미 존재를 보장한 뒤에만 서비스에 도달한다 — `where: { id: undefined, … }` 로
  검사가 무력화될 여지는 없다. 옵셔널 필드(`folderId`/`parentId`/`containerId`/`toolOwnerId`)는 전부 `if (x != null)` 가드로 스킵 처리해
  `null`(연결 해제)과 값 있음을 구분한다.
  변경/조회한 파일: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts:25`,
  `codebase/backend/src/modules/schedules/dto/create-schedule.dto.ts:19`.
- **불변 필드는 검사 대상 확대 불필요**: `UpdateAlertRuleDto`/`UpdateTriggerDto`/`UpdateScheduleDto` 어디에도 `workflowId` 필드가 없어
  생성 후 재배정이 불가능하다 — create 경로에만 검사를 추가한 것이 맞다(update 누락이 아니다). 엣지도 PATCH 엔드포인트 자체가 없어
  create-only 검사로 충분하다(`edges.controller.ts` 는 `GET`/`POST`/`DELETE` 만 노출).
- **소속 스코프 누락 방지 계약**: `assertReferenceInScope` JSDoc 이 "`where` 에 소속 조건을 반드시 실어야 한다 — id 만 넣으면 존재
  확인으로 줄어든다" 고 명시하고, 실제 9개 호출부(alerts/folders/nodes/schedules/triggers/workflow-assistant/workflows) 전부
  `workspaceId` 또는 `workflowId` 를 `where` 에 포함한다 — 계약 위반 호출부 없음.
- **URL/버전/페이지네이션/인증**: 새 엔드포인트·경로 변경 없음(기존 `POST`/`PATCH` 핸들러 내부 로직만 변경). 목록 API 변경 없어
  페이지네이션 해당 없음. 인증/인가 가드 변경 없음 — 모든 검사는 기존에 인증된 요청의 `workspaceId` 컨텍스트 안에서 수행된다.

## 요약

이 변경은 실질적인 IDOR/크로스 테넌트 보안 결함(다른 워크스페이스 워크플로 id 로 트리거를 만들면 그 워크플로가 실행됨, 캔버스 저장이
다른 워크플로 노드 행을 가로챔)을 저장 전 400 `VALIDATION_ERROR`(구조 참조는 404 `MODEL_CONFIG_NOT_FOUND`, 기존 코드 재사용)로 막는다.
새 에러 응답 형태는 기존 `CustomValidationPipe` 의 배열 `details` 형태와 정확히 일치하고, spec(`1-data-model.md` §1.1)도 이미 그 형태로
확정돼 있어 스키마 드리프트가 없다. 필수/옵셔널 필드 구분, `null` 배치 해제 허용, update-불변 필드에 검사 미추가 등 경계 처리도
DTO 정의와 일관된다. 새 엔드포인트·URL 변경·페이지네이션·인증 가드 변경은 없다. 남은 항목은 전부 INFO 수준 — 캔버스 저장 vs 단건 API
사이 거부 메시지 문구 차이, 검사-저장 사이의 좁은 TOCTOU 창(기존 코드베이스 패턴과 동일해 신규 회귀 아님), 그리고 이미 저장된
교차 워크스페이스 행·트리거 `config` 내 비밀 참조 같은 의도적으로 이월된 후속 항목(트래커에 등재 확인됨)이며, 이번 구현을 막을
사유는 없다.

## 위험도

LOW
