# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 조사 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `spec/5-system/` 17개 파일 중 `1-auth.md`·
`2-api-convention.md`·`3-error-handling.md` 3개만 본문이 실렸고, "관련 spec 본문" 섹션은
**전량 절단**됐다(`0-overview.md` 포함 전 파일이 "본문 생략됨"). 이는 "해당 내용이 없다"의
근거가 아니므로, 저장소의 실제 `spec/**` 파일을 직접 `Read`/`grep` 해 교차검증했다.

추가로 이 검토가 호출된 실제 배경(`plan/in-progress/execute-body-openapi.md`,
worktree `execute-body-dto-c37965`)을 확인했다 — `POST /workflows/:id/execute` 요청 본문을
`ExecuteWorkflowDto`(**OpenAPI 스키마 전용**, `@Body()` 파라미터 타입은 인라인 유지)로
문서화하는 작업이며 `spec_impact: none`(spec 변경 없음)이다. 코드는 이미 워크트리에
작성돼 있어(`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`,
`workflows.controller.ts`, `workflows-execute-body.spec.ts`), 그 작업이 참조하는 spec 근거
(EIA §R17, swagger.md §3 정책 캐비엇 예외, error-codes.md, audit-actions.md, RBAC 매트릭스)를
실제 파일과 대조했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 충돌은 발견되지 않았다. 확인한 교차 참조는 모두 정합했다:

- **RBAC**: `1-auth.md §3.2` "Workflow 실행 | Owner ✅ | Admin ✅ | Editor ✅ | Viewer — |" 는
  실제 컨트롤러의 `@Roles('editor')`(`workflows.controller.ts` execute()) 및
  `spec/data-flow/12-workspace.md` "viewer 는 워크플로우를 실행할 수 없다" 서술과 일치한다.
- **에러 코드 카탈로그**: `MASKED_VALUE_RESUBMITTED`(re-run·execute 공용)는
  `spec/5-system/3-error-handling.md`(§validation 상세 note) · `spec/conventions/error-codes.md`
  (129행) · `spec/5-system/14-external-interaction-api.md §R17` 세 곳이 동일한 의미·범위
  ("Manual 실행 경로 한정, webhook/schedule 제외")·동일 SoT 포인터(EIA §R17)로 일치한다.
  `1-auth.md §1.5.4` 의 초대 흐름 lowercase historical-artifact 예외(`invitation_not_found` 등)도
  `error-codes.md` 66행 레지스트리 서술과 문구까지 일치한다.
- **Swagger DTO 설명 길이 규약**: `spec/conventions/swagger.md §3`(2026-08-22 갱신, "왜 요청
  필드까지 넓혔나")가 정확히 이번 작업이 만든 `ExecuteWorkflowDto.parameterValues` 설명
  ("마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부. SoT: EIA §R17.")
  형태를 선례(`ReRunRequestDto.inputOverride`)로 들며 예외를 정당화한 바로 그 문서다 — 신규
  DTO 는 그 규약의 결과물이지 위반이 아니다. `spec/5-system/2-api-convention.md` 에는 별도의
  DTO 설명 길이 규칙이 없어(swagger.md 가 단일 SoT) 중복 정의도 없다.
- **부재 표현(§5.4) 규칙과 DTO 선언 형태**: `2-api-convention.md §5.4` 는 "키 생략" 필드는
  `@ApiPropertyOptional` + `field?: T`(`| null` 금지)로 선언하라고 규정한다.
  `ExecuteWorkflowDto` 의 `parameterValues?`/`input?` 둘 다 이 형태를 따른다.
  `type: Object` 사용도 `swagger.md §1-4`("진짜 열린 map"만 `additionalProperties`/`Object` 허용)
  기준에 부합한다 — 두 필드 모두 트리거 스키마·레거시 입력 봉투에 따라 키 집합이 런타임에
  결정되는 열린 구조다.
- **엔드포인트 정의 중복/모순 여부**: `POST /workflows/:id/execute` 는
  `3-workflow-editor/3-execution.md`·`4-nodes/7-trigger/0-common.md`·
  `4-nodes/7-trigger/1-manual-trigger.md`·`data-flow/10-triggers.md`·
  `5-system/4-execution-engine.md`·`5-system/6-websocket-protocol.md`·
  `5-system/13-replay-rerun.md` 등 여러 문서에서 참조되지만, 모두 "REST 전용 실행 시작
  진입점" 이라는 동일한 사실을 가리키는 **포인터**이며 본 작업(OpenAPI 문서화)이 그 계약을
  바꾸지 않으므로 새 모순을 만들지 않는다.

## 요약

이번 target 은 실질적으로 `spec/5-system/` 폴더 스냅샷 전체지만, 실제 진행 중인 작업
(`execute-body-openapi`)은 `spec_impact: none` 인 순수 OpenAPI 문서화(비기능 변경)이고
번들이 예산 초과로 대부분 절단돼 있어, 이번 검토는 (a) 완전히 실린 3개 파일
(`1-auth.md`/`2-api-convention.md`/`3-error-handling.md`)과 (b) 실제 진행 작업이 근거로 삼는
spec 조각(EIA §R17, swagger.md §3, error-codes.md, audit-actions.md, RBAC 매트릭스)을 저장소
원본에서 직접 대조하는 방식으로 수행했다. 그 범위 안에서는 데이터 모델·API 계약·요구사항 ID·
상태 전이·RBAC·계층 책임 어느 관점에서도 모순을 발견하지 못했고, 오히려 신규 DTO 는 최근
갱신된 swagger.md 정책의 의도된 적용 사례였다. 다만 `4-execution-engine.md`(223K자)·
`14-external-interaction-api.md`(125K자)·`6-websocket-protocol.md`(87K자) 등 대형 파일 본문
전체에 대한 줄 단위 전수 대조는 이번 예산 안에서 수행하지 못했다 — 이번 작업과 직접 관련된
조각(§R17, RBAC, error-codes)만 표적 대조했으며, 그 밖의 잠재 drift 는 별도 라운드의 전수
스캔이 필요하다.

## 위험도

NONE
