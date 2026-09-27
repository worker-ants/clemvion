# API 계약(API Contract) 리뷰 — cross-workspace-refs (2R, HEAD `c747f2405`)

대상: 쓰기 요청 본문의 참조 id 가 다른 워크스페이스(구조 참조는 다른 워크플로) 행을 가리키면 저장 전에 거부하는 변경
(`codebase/backend/src/common/utils/reference-in-scope.ts` 신설 + `alerts`·`edges`·`folders`·`knowledge-base`·`nodes`·`schedules`·
`triggers`·`workflow-assistant`·`workflows` 서비스 배선, e2e `cross-workspace-references.e2e-spec.ts` 18케이스, CHANGELOG). 이번
라운드는 직전 1R(`review/code/2026/09/27/21_43_01`)의 Critical 0 · Warning 3 조치 커밋(`698ad8ab7`) 반영 이후 상태를 대상으로 한다.

## 발견사항

- **[INFO]** 구조 참조 거부 메시지가 두 갈래("in this canvas" vs "in this workflow")로 갈린다 — 1R 에서도 지적된 동일 사항, 이번
  커밋에서도 정정되지 않음(의도된 구분으로 판단되어 조치 불요 처리됨)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateCanvasReferences`(`'Container node not found in
    this canvas'` 등) vs `codebase/backend/src/modules/nodes/nodes.service.ts:97` `assertPlacementInWorkflow`
    (`` `${ref.what} node not found in this workflow` ``) · `codebase/backend/src/modules/edges/edges.service.ts:72`
    `assertEndpointsInWorkflow`(`'Source/Target node not found in this workflow'`)
  - 상세: 캔버스 저장 경로는 "이번 페이로드 안" 을, 단건 노드/엣지 API 는 "이미 저장된 워크플로 행" 을 검사한다는 의미 차이가
    실제로 있어 완전한 중복은 아니다. `code`(`INVALID_FIELD`)와 `field` 경로 표기는 동일하고 `message` 문구만 갈리므로, 이 문자열을
    파싱해 사용자에게 그대로 노출하는 프런트가 있다면 두 경로에서 표현이 미묘하게 어긋난다.
  - 제안: 차단 사유 아님. 문구 통일이 필요하면 공용 메시지 팩토리를 `reference-in-scope.ts` 쪽에 두는 정도의 후속 정리.

- **[INFO]** 동일한 "저장 전 소속 위반" 의미인데도 표면별로 응답 형태가 셋으로 갈린다 — 배열 다중 위반(`VALIDATION_ERROR`) / 단일
  객체(`AUTH_CONFIG_NOT_FOUND`, 이 PR 밖) / 404 단건(`MODEL_CONFIG_NOT_FOUND`)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206-235`
    `assertModelConfigRefsInWorkspace`(순차 `await` — 첫 위반에서 즉시 404 로 멈춘다, 다중 위반 시 두 번째 이후 필드는 응답에
    실리지 않는다) vs `codebase/backend/src/modules/workflows/workflows.service.ts` `validateCanvasReferences`(모든 위반을 배열로
    수집해 한 번에 400)
  - 상세: `spec/1-data-model.md` §1.1 이 "예외 둘"(`MODEL_CONFIG_NOT_FOUND`, `AUTH_CONFIG_NOT_FOUND`)로 이미 명시 승인한 설계이고,
    기존 `findEntity(id, workspaceId, kind)` 검증기를 재사용해 `embeddingModelConfigId` 와 동일한 코드/형태를 유지한다는 근거도
    타당하다. 다만 API 소비자 입장에서는 "지식 베이스 생성에 세 개의 잘못된 설정 id 를 동시에 보내면 첫 번째만 보고된다" 는
    비대칭이 남는다 — 캔버스 저장·엣지 생성·노드 배치는 다중 위반을 한 번에 보고하는 것과 대비된다.
  - 제안: 차단 사유 아님(spec 이 이미 예외로 승인). 다중 필드 동시 실패가 실사용에서 흔하지 않다는 전제가 맞다면 현행 유지로
    충분하다.

- **[INFO]** 검사-저장 사이 TOCTOU 창은 이 PR 이 새로 만든 패턴이 아니라 기존 소유권 검사 스타일과 동형 — 1R 에서 이미 확인, 이번
  라운드에서도 재확인
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:43`(`assertReferenceInScope`) 호출부 다수 —
    `codebase/backend/src/modules/alerts/alerts.service.ts:31`, `codebase/backend/src/modules/folders/folders.service.ts:150`,
    `codebase/backend/src/modules/schedules/schedules.service.ts:188`, `codebase/backend/src/modules/triggers/triggers.service.ts:487`
  - 상세: 조회(`exists`/`find`)와 `save`/`create` 사이에 참조 대상이 삭제되면 이론상 FK 위반(500)으로 새는 좁은 레이스 창이 있으나,
    `workflows.service.ts` 의 `create`/`saveCanvas` 를 제외한 나머지는 트랜잭션 밖에서 이 패턴을 쓰는 기존 코드베이스 관례
    (`assertWorkflowInWorkspace` 등)를 그대로 따른 것이라 이 변경만의 신규 회귀가 아니다.
  - 제안: 차단 사유 아님.

## 검증한 항목 (문제 없음)

- **응답 봉투·스키마 일관성**: `throwInvalidReferences` 가 내는 `400 VALIDATION_ERROR` + `details: [{ field, message, code:
  'INVALID_FIELD' }]` 는 기존 `CustomValidationPipe.flattenErrors`(`codebase/backend/src/common/pipes/validation.pipe.ts:74`)가
  내는 배열 형태와 정확히 같고, `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:91-98`)가
  `{ error: { code, message, requestId, details } }` 봉투로 그대로 감싼다 — 새 에러 경로가 기존 envelope 을 우회하지 않는다.
  `spec/1-data-model.md` §1.1 최종본도 배열 형태로 확정돼 있어(`--spec` 단계에서 잡힌 "객체 vs 배열" MEDIUM 은 착지 전 정정
  확인, `spec/1-data-model.md:74`), 스키마 드리프트 없음. e2e(`cross-workspace-references.e2e-spec.ts`)의 `expect400` 헬퍼도
  `Array.isArray(details)` 를 명시 단언한다.
- **에러 코드 재사용**: 모델 설정 참조(어시스턴트 세션 `llmConfigId`, KB `extractionLlmConfigId`/`rerankConfigId`/
  `rerankLlmConfigId`)는 새 코드를 만들지 않고 기존 `ModelConfigService.findEntity`/`LlmService.resolveConfig` 의 `404
  MODEL_CONFIG_NOT_FOUND` 를 재사용한다 — `ErrorCode.INVALID_FIELD` 도 `codebase/backend/src/nodes/core/error-codes.ts:116` 에
  이미 존재하는 상수 재사용이지 신규 코드가 아니다.
- **필수/옵셔널 필드 처리**: `assertReferenceInScope` 를 무조건 호출하는 자리(`triggers.service.ts` `workflowId`,
  `schedules.service.ts` `workflowId`)는 대응 DTO(`CreateTriggerDto.workflowId:25`, `CreateScheduleDto.workflowId:19`)가
  둘 다 필수 문자열이라 `ValidationPipe` 가 이미 존재를 보장한다. 옵셔널 필드(`folderId`/`parentId`/`containerId`/
  `toolOwnerId`)는 전부 `!= null` 가드로 스킵해 `null`(연결 해제)과 미지정을 구분한다.
- **불변 필드는 update 검사 확대 불필요**: `UpdateAlertRuleDto`/`UpdateTriggerDto`/`UpdateScheduleDto` 어디에도 `workflowId`
  필드가 없어 생성 후 재배정이 불가능 — create 경로에만 검사를 추가한 것이 맞다. 엣지도 PATCH 엔드포인트가 없어(`GET`/`POST`/
  `DELETE` 만 노출) create-only 검사로 충분하다.
- **소속 스코프 누락 방지 계약**: `assertReferenceInScope` JSDoc 이 "`where` 에 소속 조건을 반드시 실어야 한다" 고 명시하고,
  실제 호출부(alerts/folders/schedules/triggers/workflows.folderId) 전부 `workspaceId` 를, `edges`/`nodes` 의 `In()` 조회는
  `workflowId` 를 `where` 에 포함한다 — 계약 위반 호출부 없음.
- **하위 호환성**: 이 변경은 종전에 (의도치 않게) 성공하던 요청 — 다른 워크스페이스/워크플로의 id 를 참조 필드에 넣는 요청 —
  을 이제 400/404 로 거부하는 **의도적 breaking behavior change** 다. 다만 이는 IDOR 성격의 보안 결함(트리거·스케줄
  `workflowId` 로 다른 워크스페이스 워크플로가 실행됨, 캔버스 저장이 다른 워크플로 노드 행을 탈취)의 수정이며 `CHANGELOG.md`
  Unreleased 항목에 영향 범위·이전 동작·새 응답 형태가 명시돼 있다 — 정상적인 클라이언트(자기 워크스페이스/워크플로 id 만 참조)
  는 영향받지 않는다.
- **URL/버전/페이지네이션/인증**: 새 엔드포인트·경로 변경 없음(기존 `POST`/`PATCH` 핸들러 내부 로직만 변경). 목록 API 변경
  없어 페이지네이션 무관. 인증/인가 가드 변경 없음 — 모든 검사는 이미 인증된 요청의 `workspaceId` 컨텍스트 안에서 수행되며,
  오히려 누락돼 있던 인가 경계(cross-tenant 참조 차단)를 메운다.
- **TypeORM API 사용**: `Repository.exists({ where })` 는 `typeorm@^0.3.31`(`codebase/backend/package.json:89`)에서 지원되는
  API 이고, 단위 테스트·e2e(477/477, `RESOLUTION.md` 참조) 로 실동작이 확인됐다.
- **1R Warning 조치 확인**: `698ad8ab7` 로 (a) `AlertsService.create` 소속 검사 단위 테스트 신설, (b) `NodesService`
  의 순차 `exists` 를 `EdgesService` 와 같은 `In()` 일괄 `find` 로 통일(`nodes.service.ts:97-129`, `edges.service.ts:72-95`
  와 같은 형태), (c) e2e 헤더 인용 수정이 반영됐음을 diff 로 직접 확인 — API 계약 관점에서 재열람할 잔여 문제 없음.

## 요약

이 변경은 다른 워크스페이스/워크플로의 id 를 요청 본문 참조 필드에 넣어도 그대로 저장되던 IDOR 성격의 결함을 저장 전 400
`VALIDATION_ERROR`(배열 `details`, 기존 `CustomValidationPipe` 와 동일 형태) 또는 기존 검증기를 재사용한 404
`MODEL_CONFIG_NOT_FOUND` 로 막는다. 새 에러 응답은 기존 `GlobalExceptionFilter` 봉투·에러 코드 레지스트리를 그대로 타고,
`spec/1-data-model.md` §1.1 최종본과 스키마가 정확히 일치하며(`--spec` 단계의 배열/객체 불일치 지적은 착지 전 정정 확인),
필수/옵셔널·불변 필드 경계 처리도 DTO 정의와 일관된다. 새 엔드포인트·URL 변경·페이지네이션·인증 가드 변경은 없고, 오히려
누락돼 있던 cross-tenant 인가 경계를 메운다. 종전에 (의도치 않게) 성공하던 cross-workspace 참조 요청은 이제 거부되는
의도적 breaking change 이지만 CHANGELOG 에 영향 범위가 명시돼 있고 정상 클라이언트에는 영향이 없다. 1R 에서 지적된
Warning 3건(alerts 단위 테스트 부재·nodes/edges 전략 불일치·e2e 헤더 인용)은 `698ad8ab7` 로 조치 완료가 diff 로 확인된다.
남은 항목은 전부 INFO 수준 — 캔버스 저장 vs 단건 API 사이 거부 메시지 문구 차이, 모델 설정 참조 경로만 다중 위반을 집계하지
않고 첫 위반에서 멈추는 비대칭(둘 다 spec 이 이미 예외로 승인), 그리고 기존 코드베이스 패턴과 동형인 좁은 TOCTOU 창이며,
이번 구현을 막을 사유는 없다.

## 위험도

LOW
