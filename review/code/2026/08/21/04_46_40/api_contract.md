# API 계약(API Contract) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 범위

실제 코드 변경(applications):
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (마커 판정 export 승격)
- `codebase/backend/tsconfig.build.json` (repo-guard dist 제외)

나머지(spec 문서·plan·이전 리뷰 산출물)는 애플리케이션 API 표면이 아니라 이번 변경의 근거/이력
기록이라 별도 API 계약 발견사항 대상이 아니다. 다만 spec 문서(`spec/4-nodes/7-trigger/1-manual-trigger.md`
§6, `spec/5-system/3-error-handling.md`, `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`,
`spec/1-data-model.md`)가 신규 에러 코드·검사 시점·범위 캐비엇을 실제 구현과 대조해 정확히 반영하고
있음을 직접 확인했다(불일치 없음). 이 PR 은 이미 9라운드 이상의 코드 리뷰(00_03_57 → 01_15_47 →
02_04_38 → … → 라운드9)를 거쳤고 CRITICAL(boolean 마커 완전 우회)·WARNING 전건이 이전 라운드에서
처분·검증됐다. 본 라운드는 API 계약 관점에서 독립적으로 재검증한 결과다.

## 발견사항

- **[INFO]** 두 기존 공개 엔드포인트의 유효 요청 공간이 좁아지는 breaking 변경 — 근거·확인 완료
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`, 함수 전체) — 호출부 `codebase/backend/src/modules/executions/executions.service.ts:499`(`parameters = resolveTriggerParametersRejectingMasked(`), `codebase/backend/src/modules/workflows/workflows.controller.ts:314`(`parameters = resolveTriggerParametersRejectingMasked(schema, rawValues);`)
  - 상세: `POST /workflows/:id/execute` 의 `parameterValues`/`input.parameters` 와 `POST /executions/:id/re-run` 의 `inputOverride` 는 종전에 값 leaf 가 리터럴 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 와 정확히 일치해도 정상 입력으로 수락됐다. 이 변경 이후 동일 값은 400(`MASKED_VALUE_RESUBMITTED`)으로 거부되며, 재제출뿐 아니라 사용자가 방금 타이핑한 fresh 입력도 대상이다(예약어 프레이밍). 실제 API 계약(수락 가능한 입력 도메인)이 좁아지는 것은 사실이지만 (1) 저장소 밖 소비자 부재가 저장소 소유자 직접 확인으로 기록돼 있고(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:357`), (2) 신규 거부 사유·범위·검사 시점이 spec 4곳에 미러돼 있으며(`spec/4-nodes/7-trigger/1-manual-trigger.md:170`, `spec/5-system/3-error-handling.md:193`, `spec/5-system/12-webhook.md:312`, `spec/5-system/13-replay-rerun.md:246`), (3) `CHANGELOG.md` Unreleased 항목에 범위·근거가 명시돼 있다. 버전 관리(API 버전 분기)는 하지 않았으나 이 저장소의 다른 유효성 강화 변경들도 동일 컨벤션(버전 미분기, 문서화로 갈음)을 따르므로 이탈이 아니다.
  - 제안: 조치 불요 — 이미 확인·문서화 완료. 향후 유사한 "리터럴 값 예약어화" 패턴을 도입할 때는 이번처럼 (a) 외부 소비자 확인, (b) spec 카탈로그 등재, (c) CHANGELOG 고지 세 가지를 세트로 유지할 것.

- **[INFO]** 형제 두 엔드포인트가 동일 실패 계열에 서로 다른 최상위 `code` 를 쓴다 (이번 PR 이 만든 이탈 아님)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:505`(`code: 'INVALID_INPUT',`) vs `codebase/backend/src/modules/workflows/workflows.controller.ts:318`(`code: 'INVALID_TRIGGER_PARAMETERS',`)
  - 상세: 두 곳 모두 이제 동일한 `resolveTriggerParametersRejectingMasked` 를 호출하고 동일한 `TriggerParameterValidationException` → `toTriggerParameterErrorDetails` 경로를 타지만, `BadRequestException` 최상위 `code` 는 여전히 엔드포인트별로 다르다(`details[].code` 는 4종 모두 공유·일치). spec(`5-system/3-error-handling.md:189`)이 이 차이를 명시적으로 문서화하고 있어 미기재된 drift 는 아니다. 클라이언트가 최상위 `code` 로 분기한다면 두 엔드포인트를 별도 케이스로 다뤄야 함을 뜻한다.
  - 제안: 조치 불요(이번 PR 스코프 밖, 이미 이전 maintainability 라운드가 "호출부마다 달라 그대로 두되" 로 명시적으로 유지 결정). 향후 API 컨벤션 개편 시 통일 여부만 별도 검토.

- **[INFO]** `ReRunRequestDto.inputOverride` 의 Swagger 설명이 신규 예약어 제약을 노출하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-26` (`inputOverride` 필드의 `@ApiPropertyOptional({ description: ... })`)
  - 상세: 설명이 "Manual Trigger parameters 스키마와 호환(`resolveTriggerParameters` 검증)"이라고만 적혀 있어, 마스킹 마커 세 문자열이 값 자리의 예약어라는 새 제약이 OpenAPI 문서 자체에는 드러나지 않는다. `POST /workflows/:id/execute` 쪽도 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 로만 일반화돼 있어 동일하다(`workflows.controller.ts:253`). 실질 영향은 낮다 — 외부 API 문서 소비자가 없음이 이미 확인됐고, `error.details[].code` 카탈로그는 spec 문서에 정식 등재돼 있다.
  - 제안: 다음에 이 두 DTO/데코레이터를 편집할 기회가 있으면 `MASKED_VALUE_RESUBMITTED` 케이스를 description 또는 `@ApiResponse` 예시에 한 줄 추가. 이번 PR 을 막을 사안은 아님(이전 라운드 INFO 로 이미 등재·유예됨).

- **[INFO]** 응답 형식 정합성 회복 — re-run 400 응답에 `details[]` 가 처음으로 실제 채워짐
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:507-512`
  - 상세: 변경 전 `throw new BadRequestException({ code, message, errors: err.errors })` 는 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 `resp.details`/`nested?.details` 만 읽어 필드별 사유가 조용히 버려지던 선존 버그였다. 이번 변경으로 `details: toTriggerParameterErrorDetails(err.errors)` 로 교정돼 공식 에러 봉투(`{ error: { code, message, requestId, details } }`)와 정합해지고, 자매 엔드포인트(`workflows.controller.ts`)와 형태가 같아졌다. 회귀 방지 테스트(`executions-rerun.service.spec.ts`)로 고정됨을 확인. API 계약 관점에서 순수 개선.

- **[INFO]** 인증/인가·URL/경로·페이지네이션은 이번 diff 로 변경되지 않음 — 확인 완료
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:242-244`(`@HttpCode(HttpStatus.ACCEPTED)`, `@Roles('editor')` 불변), `codebase/backend/src/modules/executions/executions.service.ts`(reRun 의 소유권/권한 체크 블록, 이번 diff 밖)
  - 상세: 라우트 경로·HTTP 메서드·역할 기반 인가(`@Roles('editor')`)·워크스페이스 소유권 검증은 이번 변경 전후 동일하다. 새 검사는 이미 인증·인가를 통과한 요청의 바디 유효성 레이어에만 추가됐다. 목록 API 가 아니므로 페이지네이션 대상 아님.

## 요약

이번 diff 의 API 계약상 핵심 성격은 두 기존 Manual 실행 엔드포인트(`POST /workflows/:id/execute`,
`POST /executions/:id/re-run`)의 요청 유효값 집합을 의도적으로 좁히는 것이다 — 마스킹 마커 세 문자열이
값 자리에서 예약어가 되어 400(`MASKED_VALUE_RESUBMITTED`)으로 거부된다. 이는 형식적으로 breaking
change 이지만, 외부 소비자 부재가 저장소 소유자 확인으로 근거화돼 있고 spec 4곳·CHANGELOG 에 범위·시점·
근거가 상세히 문서화돼 있어 실질 위험은 낮다. 에러 응답은 프로젝트 공식 봉투(`error.details[]`)를
그대로 따르고, re-run 경로의 `errors`→`details` 배선 버그를 함께 교정해 두 엔드포인트의 응답 형식이
오히려 더 일관돼졌다. 신규 `reason`/`code` enum 값은 매핑 리터럴·테스트로 형제 3항목과 동일한 패턴으로
추가됐다. 인증/인가·URL 설계·페이지네이션은 변경 범위 밖이며 영향 없음을 확인했다. 남은 항목(형제
엔드포인트 최상위 `code` 불일치, Swagger 설명 미노출)은 모두 이번 PR 이전부터 있던 것이거나 이미
이전 라운드에서 근거를 남기고 유예된 사안으로, 신규 이탈이 아니다.

## 위험도

LOW
