# API 계약 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

실질 API 표면 변경 파일:
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts` (`POST /executions/:id/re-run`)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`POST /workflows/:id/execute`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`isMaskedMarker`/`MASKED_MARKERS` export 승격)

나머지(CHANGELOG, tsconfig.build.json, repo-guards, plan/review 산출물)는 API 계약 표면이 아니어서 별도 발견사항 없음. `git log`(`210398cc7` 까지 10라운드)와 `review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,01_38_26}` 를 확인한 결과, 본 라운드 이전에 이미 CRITICAL 1건(boolean 마커 완전 우회, 검사 시점)과 WARNING 다수(호출부 중복·`errors→details` 봉투 유실·top-level `error.code` drift 등)가 API 계약 관점에서 검토·처분됐다. 실코드를 직접 열어 그 처분이 실제로 반영됐는지 재검증했다.

## 발견사항

- **[INFO]** Manual 트리거 파라미터의 accepted input space 가 API 버전 표시 없이 좁아졌다 — 리터럴 문자열 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 를 값으로 제출하면 이제 `400`으로 거부된다(정확 일치만, `a***b` 는 통과). curl 등 UI 를 거치지 않는 기존 클라이언트가 이 세 문자열을 실제 값으로 쓰고 있었다면 breaking change 다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(W5 항목)에서 "저장소 밖 소비자 없음, 프런트가 유일 소비자"로 저장소 소유자가 직접 확인했다는 근거가 남아 있어 실질 리스크는 낮지만, 계약 관점에서는 여전히 기존 엔드포인트의 입력 수용 범위를 좁히는 변경이다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked` 전체), 호출부 `codebase/backend/src/modules/executions/executions.service.ts:499`, `codebase/backend/src/modules/workflows/workflows.controller.ts:317`
  - 제안: 이미 근거가 문서화돼 있으므로 추가 조치 불요. 다음에 유사한 예약어 도입 시 릴리스 노트/CHANGELOG 의 "breaking" 표기 관례를 지금처럼 유지할 것.

- **[INFO]** 두 Manual 진입점(re-run/execute)의 에러 응답 `details[]` 형식이 이번 diff 로 통일됐다(`executions.service.ts` 는 종전 `errors: err.errors` 를 던졌는데 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:73`)는 `details` 만 읽어 필드별 내역이 조용히 버려지고 있었다 — 실제로 그 파일을 열어 `details = resp.details ?? nested?.details;` 만 있고 `errors` 참조가 없음을 확인). 이번 교정으로 두 엔드포인트가 같은 `TriggerParameterErrorDetail[]` 스키마(`field`/`code`/`message`)를 반환하게 됐다 — 응답 형식 일관성 개선.
  다만 최상위 `error.code` 는 여전히 다르다(`re-run` → `INVALID_INPUT`, `execute` → `INVALID_TRIGGER_PARAMETERS`). 이 drift 는 이번 diff 가 만든 것이 아니라 선존이며, 직전 라운드(`review/code/2026/08/21/01_38_26/RESOLUTION.md` WARNING 3)에서 이미 "선존·범위 밖, 두 봉투를 통일하려면 기존 클라이언트가 보는 코드가 바뀌므로 별도 결정 필요"로 검토·유예됐다. 재지적하지 않되 기록으로 남긴다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` catch 블록(`BadRequestException({ code: 'INVALID_INPUT', ... })`), `codebase/backend/src/modules/workflows/workflows.controller.ts` catch 블록(`BadRequestException({ code: 'INVALID_TRIGGER_PARAMETERS', ... })`)

- **[INFO]** `ReRunRequestDto.inputOverride` 의 swagger `description` 이 여전히 "Manual Trigger parameters 스키마와 호환 (resolveTriggerParameters 검증)" 이라고만 적어 실제로는 `resolveTriggerParametersRejectingMasked` 가 쓰이고 마스킹 마커 3종이 예약어로 거부된다는 사실이 API 문서(Swagger)에 드러나지 않는다. 직전 라운드에서 이미 INFO-5 로 지적·"non-blocking, 다음 DTO 편집 기회"로 명시 유예된 항목이라 이번에도 이월만 한다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:19-25` (`inputOverride` `@ApiPropertyOptional`)
  - 제안: 다음에 이 DTO 를 편집할 기회에 예약어 제약을 description 에 추가.

- **[INFO]** 신규 에러 코드 `MASKED_VALUE_RESUBMITTED`(`details[].code`)와 HTTP 상태(`400 BadRequestException`)는 형제 3종(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)과 같은 스키마(`{field, code, message}`)로 일관되게 추가됐고, 두 진입점 모두 같은 `toTriggerParameterErrorDetails` 매핑 함수를 공유해 코드/메시지가 두 표면에서 갈라질 여지가 없다. 값 자체는 응답에 echo 되지 않아(field·고정 code·고정 message 만) 정보 노출도 없다. 별도 조치 불요, 양호한 설계로 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (`REASON_TO_DETAIL`, `toTriggerParameterErrorDetails`)

- **[INFO]** 인증/인가·URL 경로·버전 관리·페이지네이션: 이번 diff 는 기존 엔드포인트(`POST /executions/:id/re-run`, `POST /workflows/:id/execute`)의 URL·가드 데코레이터를 변경하지 않는다(diff 에 `@UseGuards` 등 관련 라인 없음, 컨트롤러 클래스 레벨 가드도 미변경). 목록 API 가 아니므로 페이지네이션 해당 없음. API 버전 필드/헤더 체계가 이 저장소에 없어(내부 API) 버전 관리 관점은 해당 없음.

## 요약

이번 diff 는 두 Manual 실행 진입점(`re-run`/`execute`)에 마스킹 마커 재제출을 거부하는 서버측 2차 검증을 추가하고, 그 과정에서 선존 응답 봉투 결함(`errors` vs `details`)을 함께 교정해 두 엔드포인트의 에러 응답 형식을 통일했다. 신규 에러 코드(`MASKED_VALUE_RESUBMITTED`)는 형제 코드들과 동일한 스키마·매핑 경로를 공유하고 HTTP 400 이 적절하며, 값 자체를 echo 하지 않아 정보 노출도 없다. API 계약 관점의 실질 변경은 "리터럴 마커 3종을 Manual 파라미터 값으로 받아들이지 않는다"는 입력 수용 범위 축소이며, 저장소 소유자가 외부 소비자 부재를 직접 확인한 근거가 plan 문서에 남아 있어 breaking 리스크는 낮다고 판단된다. 나머지 발견(top-level `error.code` drift, Swagger description 미갱신)은 모두 이번 diff 가 새로 만든 문제가 아니라 이전 라운드에서 이미 검토·유예된 항목의 이월이며, 신규 CRITICAL/WARNING 은 없다.

## 위험도

LOW
