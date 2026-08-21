STATUS=success ISSUES=3
===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 범위 및 방법

프롬프트가 첨부한 57개 파일 중 실제 API 표면(요청 검증·응답 봉투)에 관련된 것은 코드
9곳(`trigger-parameter.types.ts`, `reject-masked-resubmission.ts`(+spec),
`executions.service.ts`(+spec), `workflows.controller.ts`(+spec),
`sanitize-error-message.ts`)과 spec 7곳(`1-data-model.md`·`3-execution.md`·
`1-manual-trigger.md`·`12-webhook.md`·`13-replay-rerun.md`·
`14-external-interaction-api.md`·`3-error-handling.md`)이다. 나머지(`CHANGELOG.md`,
`plan/**`, `review/**`)는 문서/이력 산출물이라 API 계약 판단 대상이 아니다.

이 diff 는 **동일 세션 앞선 리뷰 라운드(`00_03_57`)가 CRITICAL 1건 + WARNING 1건을
API 계약 관점에서 이미 지적한 뒤의 수정본**이다(`review/code/2026/08/21/00_03_57/api_contract.md`,
`RESOLUTION.md`). 과거 지적을 재판정하지 않고, 워크트리의 실제 파일(`reject-masked-resubmission.ts`,
`trigger-parameter.types.ts`, 호출부 2곳, `http-exception.filter.ts`)을 `Read` 로 직접 열어
그 수정이 실제로 반영됐는지 독립적으로 검증했다.

## 발견사항

- **[INFO]** (검증 완료, 조치 불요) 이전 라운드 CRITICAL — `boolean` 타입 파라미터가
  마스킹 마커를 조용히 우회하던 결함 — 이번 diff 에서 실제로 해소됨을 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:55-69`
    (`resolveTriggerParametersRejectingMasked`)
  - 상세: `findMaskedResubmissions(schema, rawSource, rawSource)` (raw 검사, ①) 가
    `resolveTriggerParameters` 호출(coerce 수행 지점) **이전**에 실행된다. `boolean` 타입
    필드에 `'***'` 가 재제출되면 `Boolean('***')` → `true` 로 캐스팅되기 전 raw 문자열
    단계에서 이미 `isMaskedMarker` 가 잡아 `TriggerParameterValidationException` 을 던진다.
    같은 순서 변경이 `number`/`array`/`object` 타입에서 `coerce_failed` 가 먼저 throw
    돼 사용자가 잘못된 에러 코드를 보던 WARNING 도 함께 해소한다 — raw 검사가 항상
    `resolveTriggerParameters` 호출보다 먼저이므로 마스킹 재제출은 언제나
    `MASKED_VALUE_RESUBMITTED` 로 응답한다.
  - object/array 를 JSON **문자열**로 보낸 경우(마커가 파싱 뒤에야 leaf 로 드러나는
    케이스)를 위한 resolve-후 재검사(②, line 66)도 raw 대상 키 필터
    (`schema.filter((def) => hasOwnProperty(rawSource, def.name))`, line 104)를 공유해
    `defaultValue` 로 채워진(사용자가 손대지 않은) 필드를 과잉 차단하지 않는다 — 세
    갈래(boolean 완전우회·number 오안내·defaultValue 과잉차단) 모두 재현 불가함을 코드
    구조로 확인.

- **[INFO]** `errors` → `details` 봉투 교정은 **breaking change 가 아니라 순수 버그
  수정**임을 `GlobalExceptionFilter` 코드로 확인
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:56-73`
    (`details = resp.details ?? nested?.details;`), 대조:
    `codebase/backend/src/modules/executions/executions.service.ts` (구 `errors: err.errors`
    → 신 `details: toTriggerParameterErrorDetails(err.errors)`)
  - 상세: `GlobalExceptionFilter` 는 `BadRequestException` 의 response 객체에서
    `code`/`message`/`details` 세 키만 명시적으로 읽어 봉투(`{ error: { code, message,
    requestId, details } }`)를 구성한다. `errors` 라는 임의 키는 이 필터의 어떤 분기에도
    매칭되지 않아 애초에 HTTP 응답 바디에 실린 적이 없다 — 즉 re-run 경로의 필드별
    검증 내역은 이 PR 이전엔 **어떤 클라이언트도 받아 본 적이 없는 정보**였다. 따라서
    이번 교정은 기존에 그 필드에 의존하던 클라이언트를 깨뜨릴 위험이 없다(의존이
    성립할 수 없었으므로). CHANGELOG·RESOLUTION.md 의 "선존 버그" 서술과 일치한다.

- **[INFO]** 새 필드 코드(`MASKED_VALUE_RESUBMITTED`) 도입이 두 엔드포인트의 top-level
  `error.code`·HTTP 상태·Swagger 문서에 드리프트를 만들지 않음을 확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:242-254`
    (`@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })`),
    `codebase/backend/src/modules/executions/executions.controller.ts:273-275`
    (`@ApiBadRequestResponse({ description: 'INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE' })`)
  - 상세: 두 엔드포인트 모두 400 응답의 Swagger 문서가 `details[]` 항목 코드를 나열하지
    않는(top-level `code`만 언급하거나 일반 서술인) 형태라, `details[].code` 열거값에
    새 항목을 추가해도 기존 문서와 불일치가 생기지 않는다. top-level `error.code`
    (`INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS`)와 HTTP 상태(400)는 두 경로 모두
    변경되지 않았다. execute 엔드포인트의 레거시 `input.parameters` 바디 형태(하위 호환
    유지)도 `rawValues` 로 정규화된 뒤 동일 함수로 넘어가므로 신·구 두 요청 형태 모두
    같은 마스킹 판정 규칙이 일관되게 적용된다(파편화 없음).

## 스코프 밖 확인 (참고)

- `POST /executions/:id/re-run`·`POST /workflows/:id/execute` 두 곳 모두 인증/인가
  데코레이터(`@Roles('editor')`) 는 이번 diff 로 변경되지 않았다.
- 페이지네이션 대상 목록 API 는 이 변경에 없다.
- 버전 관리(API version bump) 스킴이 이 프로젝트에 없으므로 해당 없음 — spec·CHANGELOG
  가 breaking-narrowing 을 문서로 대체하는 기존 관행을 그대로 따른다.
- 마커 리터럴 세 문자열이 Manual 파라미터 값에서 예약어가 되는 하위 호환성 좁힘
  자체는 이전 라운드가 이미 INFO 로 등재·검증(저장소 소유자 확인, 외부 소비자 부재)
  했고 이번 diff 로 그 판단이 달라질 근거는 없다 — 재등재하지 않음.

## 요약

이번 diff 는 동일 세션 이전 라운드에서 API 계약 관점 CRITICAL(`boolean` 타입 마스킹
마커 조용한 우회)·WARNING(`number`/`array`/`object` 타입의 잘못된 에러 코드)로 지적된
결함의 수정본이며, 워크트리 실물 코드를 직접 열어 두 문제 모두 "raw 값을 coerce 이전에
먼저 검사"하는 단일 순서 변경으로 실제 해소됐음을 독립적으로 확인했다. re-run 경로의
`errors`→`details` 봉투 교정은 `GlobalExceptionFilter` 가 `details` 키만 읽는다는 사실로
볼 때 breaking change 가 아니라 순수 버그 수정(이전엔 어떤 클라이언트도 그 필드를 받아본
적이 없음)이다. 새 필드 코드 추가는 기존 3종 reason→code 매핑과 동일한 패턴을 따르고
Swagger 문서에 드리프트를 만들지 않으며, 인증/인가·페이지네이션·URL 설계에는 영향이
없다. 마커 리터럴 예약어화라는 유일한 하위 호환성 좁힘은 spec 에 명시되고 외부 소비자
부재가 확인된 상태로, 이번 diff 로 새로 열리는 위험은 없다.

## 위험도

LOW
