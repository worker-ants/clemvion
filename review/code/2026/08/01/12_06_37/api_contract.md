STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `AuditLogDto.action` Swagger 설명이 이번에 구현된 신규 액션군(workflow.*·trigger.*·schedule.*·model_config.*)을 반영하지 않아 stale 하다
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:30-33` (review 대상 19개 파일에는 포함되지 않았으나, 이번 diff 가 `audit-action.const.ts`에 13개 액션을 신규 추가한 직접 결과로 stale 해진 파일)
  - 상세: 이 DTO 의 `action` 필드 `@ApiProperty description` 은 "현재 구현된 값군은 `integration.*` (created·updated·deleted·rotated·scope_changed·reauthorized), `auth_config.*` (create·update·delete·regenerate·reveal), `workspace.transfer_ownership`, `execution.re_run` 이다" 라고 명시한다. 이번 PR 로 `AUDIT_ACTIONS`(`codebase/backend/src/modules/audit-logs/audit-action.const.ts:45-81`)에 `workflow.created/updated/deleted`, `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.create/update/delete/set_default` 13개가 추가됐고 `GET /api/audit-logs`(변경 없음, `AuditLogsController`)가 그대로 이 값들을 반환하게 되므로, Swagger/OpenAPI 문서(및 이를 근거로 생성되는 클라이언트 SDK 문서)가 실제 응답 스키마의 값 도메인을 과소 표기하게 된다. 다만 같은 description 이 "DB는 자유 문자열 컬럼이므로 위 union 밖의 값이 존재할 수 있어 클라이언트는 enum 으로 단정하지 말 것"이라고 이미 경고하고 있어 런타임 파싱 실패로 이어지지는 않는다 — 문서 정확성 문제로 심각도를 낮게 본다.
  - 제안: `audit-log-response.dto.ts` 의 `action` description 목록에 신규 4개 리소스군(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)을 추가하거나, 매번 갱신 부담을 줄이려면 "SoT: `AUDIT_ACTIONS` const" 참조만 남기고 하드코딩된 예시 목록을 제거하는 것을 고려.

## 그 외 점검 결과 (이슈 없음)

- **하위 호환성**: 컨트롤러 메서드(`ModelConfigController.create/update/setDefault/remove`, `SchedulesController.create/update/remove`, `TriggersController.create/update/remove`, `WorkflowsController.update/remove`)에 `@CurrentUser('sub') userId` 파라미터가 추가됐지만, 이는 이미 인증된 JWT 에서 서버가 내부적으로 추출하는 값이라 요청 바디/헤더/쿼리 계약에는 아무 변화가 없다. 서비스 메서드 시그니처에 `userId` 인자가 추가된 것도 내부 구현 세부사항으로, 외부에 노출되는 REST 계약과 무관하다. Breaking change 없음.
- **버전 관리**: 신규 엔드포인트·라우트 없음, 별도 버전 관리 이슈 없음.
- **응답 형식**: 모든 CRUD 응답 DTO(`ModelConfigDto`/`ScheduleDto`/`TriggerDto`/`WorkflowDto`)와 HTTP 상태 코드(`201 Created`/`200 OK`/`204 No Content`)는 변경되지 않았다. 감사 로그 기록은 커밋 후 side-effect 로만 수행되고 응답 페이로드에 포함되지 않는다.
- **에러 응답**: 신규/변경된 에러 코드 없음. 기존 `MODEL_CONFIG_*`, `RESOURCE_NOT_FOUND`, `INVALID_TIMEZONE` 등 코드 체계 그대로 유지.
- **요청 검증**: 변경된 DTO 파일 없음(`create-*.dto.ts`/`update-*.dto.ts` 등 모두 diff 밖) — 요청 바디 검증 규칙 불변.
- **URL/경로 설계**: 신규 라우트 없음. 기존 RESTful 구조(`/model-configs`, `/schedules`, `/triggers`, `/workflows`) 그대로.
- **페이지네이션**: `findAll` 계열 메서드 변경 없음, 페이지네이션 로직 무변.
- **인증/인가**: `@Roles('editor')` 등 기존 가드·역할 요구사항 무변. `CurrentUser` 는 이미 각 모듈에서 사용되던 데코레이터이며 신규 인증 요구를 추가하지 않는다. `AUDIT_ACTIONS` 신규 액션 35개 전수 중복 없음(검증 완료) — action 값 충돌로 인한 감사 데이터 오염 가능성 없음.

## 요약

이번 변경은 `model-config`/`schedules`/`triggers`/`workflows` 4개 모듈의 CRUD 서비스에 `AuditLogsService.record()` 호출(트랜잭션 커밋 이후 시점)을 추가하는 감사 로깅 커버리지 확장이며, 컨트롤러의 라우트·요청 DTO·응답 DTO·HTTP 상태 코드·인증/인가 요구사항은 전혀 건드리지 않아 API 계약 관점에서 breaking change 가 없다. 유일한 발견은 이번 변경으로 새로 구현된 13개 audit action 값이 `audit-log-response.dto.ts` 의 Swagger `action` 필드 설명에 반영되지 않아 문서가 stale 해진 것이며, 이는 런타임 동작에는 영향이 없고(문서 자체가 "enum 으로 단정 말 것"을 이미 경고) API 문서 정확성 차원의 경미한 개선 사항이다.

## 위험도

LOW
