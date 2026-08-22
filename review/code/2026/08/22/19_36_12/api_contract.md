# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `POST /workflows/:id/execute` 는 `re-run` 과 동일한 마스킹 마커 거부 규칙(`resolveTriggerParametersRejectingMasked`) 적용 대상인데, 이번 diff 로 `ReRunRequestDto.inputOverride` 만 Swagger `description` 이 상세화되어 형제 엔드포인트 간 OpenAPI 문서 비대칭이 남아 있다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-26` (변경 대상, `+` 게이트) / `codebase/backend/src/modules/workflows/workflows.controller.ts:275-279` (`execute()` 의 `@Body()` 가 DTO/`@ApiProperty` 없는 인라인 타입 — 이번 diff 의 변경 범위 밖)
  - 상세: `execute()` 는 `resolveTriggerParametersRejectingMasked` 를 통해 동일한 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 거부 규칙을 적용받지만(`codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 확인), body 가 DTO 클래스가 아닌 인라인 타입(`{ input?; parameterValues?; }`)이라 이 PR 이 `re-run.dto.ts` 에 추가한 예약어 설명을 붙일 자리가 없다. OpenAPI 문서만 보고 통합하는 클라이언트는 `re-run` 호출에서는 400 원인을 사전에 알 수 있지만 `execute` 호출에서는 문서에 단서 없이 `MASKED_VALUE_RESUBMITTED` 를 만난다. 다만 이는 이 diff 가 **새로 만든** 비대칭이 아니라 기존에 존재하던 문서 공백이 이번 diff 로 상대적으로 더 도드라진 것이며, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(2026-08-22 등재, 이 diff 에 포함)에 "DTO 승격은 코스메틱이 아니라 컨트롤러 시그니처 변경" 이라는 이유로 명시적으로 후속 항목화·범위 제외되어 있다.
  - 제안: 이미 트래커에 기록되어 있으므로 이번 PR 에서 추가 조치 불요. `execute()` body 를 DTO 로 승격하거나 `@ApiBody` 를 붙일 때 `re-run.dto.ts` 의 설명을 그대로 이식할 것.

- **[INFO]** Swagger `description` 문자열이 서술하는 계약(마커 3종 예약어, 400 `INVALID_TRIGGER_PARAMETERS` + `details[].code = MASKED_VALUE_RESUBMITTED`, 부분 일치 `a***b` 는 통과)이 실제 구현(`reject-masked-resubmission.ts` 의 `hasMaskedLeaf`/`findMaskedResubmissions` — 정확 일치만 판정)과 `workflows.controller.ts` 의 에러 봉투 조립(`BadRequestException({ code, message, details })`)과 정확히 일치함을 직접 대조 확인했다. 신규 문서가 구현과 어긋나는 부분은 발견되지 않았다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`, `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`
  - 상세/제안: 조치 불요 (긍정 기록).

- **[INFO]** 4개 파일의 diff 는 전부 JSDoc·주석·Swagger `description` 문자열 변경이며, 요청/응답 스키마(필드 추가·삭제·타입 변경), `class-validator` 데코레이터, HTTP 상태 코드, 에러 `code` 값, URL 경로, 인증/인가 데코레이터(`@Roles`) 는 이번 diff 로 전혀 변경되지 않았다. `TriggerParameterErrorDetail.code`(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`)와 `REASON_TO_DETAIL` 매핑도 값 자체는 변경 없이 JSDoc 만 추가됐다.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`, `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-124`, `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-29`, `codebase/backend/src/modules/workflows/workflows.controller.ts:319-322`
  - 상세/제안: 하위 호환성·버전 관리·응답 형식·에러 응답 형식·요청 검증·URL 설계·페이지네이션·인증/인가 어느 관점에서도 breaking change 나 계약 변경 없음. 조치 불요.

## 요약

이번 diff 는 실행 코드 0줄 변경의 순수 문서화 PR(JSDoc·Swagger `description`·주석 언어 통일)로, API 계약(요청/응답 스키마·에러 코드·HTTP 상태·URL·인증/인가·검증 규칙) 자체는 전혀 바뀌지 않았다. 유일하게 API 계약 인접 영역에서 의미 있는 관찰은 `re-run.dto.ts` 에 추가된 "마스킹 마커 예약어" Swagger 설명이 동일한 서버측 거부 규칙이 적용되는 형제 엔드포인트 `POST /workflows/:id/execute` 에는 반영되지 않아 OpenAPI 문서 비대칭이 존재한다는 점인데, 이는 이 diff 가 만든 신규 문제가 아니라 기존 공백이며 트래커에 근거·이식 계획과 함께 명시적으로 기록되어 범위 밖으로 처리됐다. 신규로 추가된 문서 서술은 실제 구현과 대조해 전부 정확함을 확인했다.

## 위험도
LOW
