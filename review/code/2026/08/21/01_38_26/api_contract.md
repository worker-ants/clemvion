# API 계약(API Contract) 리뷰 — 마스킹 값 재제출 서버측 거부 (EIA §R17)

## 검토 범위

실제 코드 변경(파일 1~9):
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규) / `.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`, `POST /executions/:id/re-run`)
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`, `POST /workflows/:id/execute`) / `.spec.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (기존 `isMaskedMarker`/`MASKED_MARKERS` export 승격 — 신규 로직 아님)
- `CHANGELOG.md`

나머지(파일 10~41)는 plan/review 산출물·spec 문서로, 실행 코드가 아니라 이번 변경의 배경/근거 기록이다.
관련 spec(`spec/4-nodes/7-trigger/1-manual-trigger.md` §6, `spec/5-system/14-external-interaction-api.md` §R17,
`spec/5-system/3-error-handling.md`, `spec/5-system/12-webhook.md`)은 이미 앞선 라운드
(`23_33_00`, `00_55_25` consistency-check)에서 구현과 정합하도록 교정돼 있음을 직접 열어 확인했다 — 이번
라운드에서 새로 발견된 spec-impl 불일치는 없다.

## 발견사항

- **[WARNING]** 같은 실패 사유(`masked_value_resubmitted`)에 대해 두 Manual 실행 진입점의 응답 봉투 최상위 `code` 가 서로 다르다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`code: 'INVALID_INPUT'`, 게이트 506) vs
    `codebase/backend/src/modules/workflows/workflows.controller.ts` (`code: 'INVALID_TRIGGER_PARAMETERS'`, 314행 부근 — 이 줄 자체는 diff 밖이라 게이트 없음, `grep` 으로 확인)
  - 상세: 이번 diff 로 두 경로 모두 `details[].code = MASKED_VALUE_RESUBMITTED` 로 **내부 상세 코드는 완전히 수렴**했다(그 자체는 이번 PR 의 목적이자 성과). 그런데 봉투 최상위 `error.code` 는 여전히 갈린다 — re-run 은 `INVALID_INPUT`, execute 는 `INVALID_TRIGGER_PARAMETERS`. `git log -p`/`git diff origin/main` 으로 확인한 결과 이 최상위 `code` 값 자체는 이번 PR 이전부터 그랬던 **선존 drift**이고 이번 diff 가 건드린 줄이 아니다. 다만 이번 PR 전에는 두 경로가 서로 다른 실패 사유 집합(예: re-run 은 `coerce_failed`/`missing_required`만)을 던졌을 수 있어 이 drift 가 겉으로 덜 드러났다면, 이제는 **정확히 같은 사유(마스킹 값 재제출)에 대해 클라이언트가 어느 엔드포인트를 쳤는지에 따라 다른 최상위 `code` 를 받는** 상황이 새로 생겼다. 두 엔드포인트를 모두 소비하는 클라이언트가 최상위 `code` 로 분기한다면(흔한 패턴) 같은 의미의 에러를 두 갈래로 처리해야 한다.
  - 제안: 이번 diff 스코프에서 강제할 사안은 아니다(선존 drift, 이 PR 이 만든 결함이 아님). 다음에 이 두 호출부의 에러 봉투를 손댈 기회가 생기면 최상위 `code` 도 통일(예: 둘 다 `INVALID_TRIGGER_PARAMETERS` 또는 신규 공통 코드)하는 것을 고려. 최소한 `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 근처에 "최상위 `code` 는 경로별로 다르다(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`), `details[].code` 만 공통"이라는 캐비엇을 남기면 다음 소비자가 덜 헷갈린다.

- **[INFO]** 의도된 하위 호환성 변경 — 리터럴 마스킹 마커 값을 실제 입력으로 쓰던 기존 호출은 이제 400 으로 거부된다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`), 두 호출부(`executions.service.ts` 게이트 499-502, `workflows.controller.ts` 게이트 317)
  - 상세: 이 변경 전에는 `inputOverride`/`parameterValues` 의 어떤 필드값이 정확히 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 리터럴이어도 정상 처리됐다. 이후로는 스키마에 정의된 필드에 대해 이 값들이 예약어로 취급돼 400 `MASKED_VALUE_RESUBMITTED` 로 거부된다. 이는 **API 응답이 이전과 달라지는 하위 호환성 영향**이 실재하는 지점이라 API 계약 관점에서 짚어둔다. 다만: (1) `CHANGELOG.md`("Unreleased — 마커 재제출을 서버가 거부한다")와 spec(§R17, manual-trigger §6)에 명시적으로 문서화됐고, (2) 세 라운드에 걸친 보안 리뷰에서 이 트레이드오프가 의도된 결정으로 확인됐으며, (3) 저장소 밖 소비자 존재 여부를 저장소 소유자가 직접 "프런트가 유일 소비자"로 확인해 breaking 공지 불요로 처분됐다(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` W5). 정확 일치만 보므로(`a***b` 는 통과) 과잉 차단 위험은 캐너리 테스트(`workflows.controller.spec.ts`, `executions-rerun.service.spec.ts`)로 고정돼 있다.
  - 제안: 조치 불요. API 버전 관리 체계(`/v1/` 등)가 이 저장소에 없으므로(선존 구조, 이 diff 밖) 이런 동작 변경은 CHANGELOG/스펙 문서화로만 커뮤니케이션되는 기존 관행을 그대로 따른다 — 이미 그렇게 했다.

- **[INFO]** 선존 결함 교정(`errors` → `details`)은 실제로 non-breaking — `GlobalExceptionFilter` 를 직접 열어 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 게이트 505-513, 대조 `codebase/backend/src/common/filters/http-exception.filter.ts:73`(`details = resp.details ?? nested?.details;` — `errors` 키는 읽지 않음)
  - 상세: 종전 `throw new BadRequestException({ code: 'INVALID_INPUT', message, errors: err.errors })` 는 `GlobalExceptionFilter` 가 `resp.details` 만 읽으므로 실제 HTTP 응답 본문에는 `errors` 가 **한 번도 실린 적이 없다**(소스로 직접 확인). 따라서 이번에 `errors` 키를 `details: toTriggerParameterErrorDetails(err.errors)` 로 바꾼 것은 기존에 클라이언트가 실제로 받아보던 필드를 제거하는 게 아니라, 원래 비어 있던 자리를 처음으로 채우는 것이다 — 하위 호환성 파괴가 아니라 순수 개선. 테스트(`executions-rerun.service.spec.ts` "[회귀] 거부 응답이 details[] 로...")가 `body.errors` 부재를 명시적으로 단언해 고정한다.
  - 제안: 조치 불요. 확인용 기록.

- **[INFO]** 신규 enum 값(`masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`)은 OpenAPI 스키마 drift 를 만들지 않는다
  - 위치: `codebase/backend/src/common/swagger/error-response.dto.ts` (`code: string`, `details?: unknown` — 닫힌 union 아님), `workflows.controller.ts` 의 `@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` (일반 설명, 개별 코드 미열거)
  - 상세: `TriggerParameterValidationError['reason']`/`TriggerParameterErrorDetail['code']` 는 백엔드 내부 닫힌 union 이지만, 이를 감싸는 공개 Swagger DTO(`ErrorResponseBodyDto`)는 `code: string`/`details?: unknown` 으로 느슨하게 타입돼 있어 신규 값 추가가 OpenAPI 스펙 파일 갱신을 요구하지 않는다. 프런트엔드도 이 특정 코드 리터럴을 참조하는 곳이 없어(검색 결과 0건) 소비측 exhaustive switch 가 새 값에서 깨질 위험도 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 거부 경로에 대한 실제 HTTP(e2e/supertest) 왕복 검증은 없고 컨트롤러/서비스 단위 스펙(모킹된 Nest 테스트 모듈)만 있다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`(게이트 130-193), `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`(게이트 362-464) — 둘 다 `err.getResponse()` 로 던져진 객체를 직접 검사, 실제 `GlobalExceptionFilter.catch()` 를 거친 최종 JSON 을 검사하지 않음
  - 상세: 이번 PR 이 고친 선존 버그(§ 위 INFO 항목) 자체가 "무엇을 throw 하느냐"와 "필터가 실제로 무엇을 읽어 응답하느냐"의 불일치였다. 컨트롤러 단위 스펙은 전자만 확인하고 후자는 소스 코드 대조(본 리뷰에서 수행)로만 검증됐다. 이 계층의 결함이 이번에 발견된 전례가 있으므로, 완전한 e2e supertest 왕복(실제 필터를 거친 최종 응답 본문 검사)이 있었다면 이런 종류의 drift 를 회귀 테스트로 더 강하게 고정할 수 있었을 것이다.
  - 제안: 필수 아님(이번 PR 은 이미 3라운드 리뷰·lint/unit/build/e2e 4단계 검증을 통과했고, 기존 e2e 스위트가 회귀를 못 잡을 특별한 이유는 없다). 여유가 있다면 `POST /workflows/:id/execute` 또는 `POST /executions/:id/re-run` 에 대해 실제 필터를 거친 400 본문에서 `error.details[0].code === 'MASKED_VALUE_RESUBMITTED'` 를 확인하는 supertest 1건을 추가하면 이 계층의 회귀를 더 확실히 캐너리로 고정할 수 있다.

## 관점별 요지

1. **하위 호환성**: 의도된 동작 변경 존재(마스킹 마커 리터럴 값 거부) — 문서화·근거 확인됨, 외부 소비자 부재 확인됨. Breaking 이지만 통제됨.
2. **버전 관리**: 이 저장소에 API 버전 스킴이 없음(선존, 이 diff 밖) — CHANGELOG/spec 문서화로 대체하는 기존 관행 준수.
3. **응답 형식**: `error.details[]` 형태 준수, 필드/코드/메시지 3속성 패턴을 기존 3개 reason 과 동일하게 확장. 최상위 `code` 는 두 엔드포인트 간 선존 drift 존재(WARNING).
4. **에러 응답**: HTTP 400(BadRequestException) 적절. 실제 제출 값은 echo 되지 않아 정보 노출 없음. 선존 `errors`→`details` 배선 버그 교정 확인.
5. **요청 검증**: `resolveTriggerParametersRejectingMasked` 가 raw 우선 → resolve → resolve 후 재검사의 2단계 검사를 수행, 정확 일치만 판정(과잉 차단 방지)해 요청 바디 검증이 강화됨. `ReRunRequestDto` 의 `inputOverride` 는 여전히 `@IsObject()` 수준의 얕은 검증이나 이는 이 diff 가 만든 게 아님.
6. **URL/경로 설계**: 신규 엔드포인트 없음 — 기존 `POST /executions/:id/re-run`, `POST /workflows/:id/execute` 내부 동작만 변경. RESTful 설계 영향 없음.
7. **페이지네이션**: 해당 없음(목록 API 변경 없음).
8. **인증/인가**: 변경 없음(`@Roles('editor')` 등 기존 가드 유지, diff 에 인증/인가 관련 수정 없음).

## 요약

이번 diff 는 두 Manual 실행 진입점(`POST /executions/:id/re-run`, `POST /workflows/:id/execute`)에서 egress 마스킹 마커 리터럴이 그대로 재제출/입력되면 서버가 400 `MASKED_VALUE_RESUBMITTED` 로 거부하도록 하는 API 동작 변경이다. 신규 닫힌 union 값 추가는 Swagger 스키마가 느슨해(`code: string`) drift 를 만들지 않고, 프런트 소비처도 리터럴 참조가 없어 안전하다. 선존 결함(`errors` 키가 `GlobalExceptionFilter` 에서 조용히 버려지던 문제)의 교정은 소스 확인 결과 실제로는 non-breaking(이전에도 응답에 실린 적이 없던 필드) 개선이다. 유일하게 남는 진짜 API 계약 관점 이슈는 두 엔드포인트의 최상위 `error.code` 가 같은 실패 사유에 대해 서로 다르다는 선존 drift 로, 이번 PR 이 만든 결함은 아니지만 두 경로의 `details[].code` 가 수렴한 지금 더 눈에 띄게 됐다(WARNING). 마스킹 마커 리터럴 값을 거부하는 동작 자체의 하위 호환성 영향은 문서화·근거가 충분해 통제된 breaking change 로 판단한다.

## 위험도

LOW
