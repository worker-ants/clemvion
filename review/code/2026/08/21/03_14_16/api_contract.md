# API 계약(API Contract) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로)

## 검토 범위

`POST /executions/:id/re-run`(`executions.service.ts` `reRun`)과
`POST /workflows/:id/execute`(`workflows.controller.ts` `execute`) 두 엔드포인트가
`resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked` 로 교체되며, 마스킹
마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)와 값이 정확히 일치하는 트리거 파라미터를
`400`으로 거부하는 신규 검증 레이어가 추가됐다. 신규 field code `MASKED_VALUE_RESUBMITTED`
가 `trigger-parameter.types.ts`의 공용 매핑 테이블에 등재되고, `re-run` 경로의 응답 봉투
버그(`errors` → `details`)도 같은 diff에서 교정됐다. 이 두 엔드포인트를 API 계약 8개 관점
(하위호환·버전·응답형식·에러응답·요청검증·URL설계·페이지네이션·인증인가)으로 검토했다.

## 발견사항

- **[INFO]** 요청 유효값 도메인이 축소되는 breaking 성격의 변경 — 리터럴 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 가 Manual 파라미터 값에서 예약어가 됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:56-75`(`resolveTriggerParametersRejectingMasked`), 호출부 `codebase/backend/src/modules/executions/executions.service.ts:499-502`, `codebase/backend/src/modules/workflows/workflows.controller.ts:317`
  - 상세: 이전에는 두 엔드포인트 모두 임의 문자열을 파라미터 값으로 받아들였다. 이 변경 이후 그 값이 위 세 마커 문자열과 **정확히 일치**하면 이전엔 202로 성공하던 요청이 이제 `400 MASKED_VALUE_RESUBMITTED`로 거부된다 — 좁은 의미의 API breaking change다. 다만 (1) 프런트가 동일 규칙을 이미 폼 렌더 경로에서 강제해 왔고(카브아웃 아님), (2) `spec-sync-external-interaction-api-gaps.md`(파일 16)에 저장소 소유자 확인으로 "저장소 밖 소비자 없음"이 기록돼 있으며, (3) 정확 일치만 보므로 `a***b` 같은 패딩으로 우회 가능해 실질 충돌 가능성이 낮다. CHANGELOG·spec 5곳에 사전 공지됐다.
  - 제안: 조치 불요(이미 확인·문서화·공지 완료). 향후 유사 값-도메인 축소 시에도 이 PR처럼 "외부 소비자 확인 → 릴리스 노트 공지" 절차를 표준으로 유지할 것.

- **[INFO]** 같은 실패 클래스에 대해 두 엔드포인트의 최상위 `error.code`가 여전히 다르다 (`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:505-513`(`code: 'INVALID_INPUT'`), `codebase/backend/src/modules/workflows/workflows.controller.ts:323-327`(`code: 'INVALID_TRIGGER_PARAMETERS'`)
  - 상세: `details[].code`(field code)는 이 PR이 `MASKED_VALUE_RESUBMITTED`로 두 경로 완전히 수렴시켰지만, 응답 최상위 `error.code`는 이 PR 이전부터 두 엔드포인트가 다른 문자열을 썼다. 같은 사유(마스킹 마커 재제출)로 실패해도 클라이언트가 최상위 코드로 분기하면 두 엔드포인트를 다르게 다뤄야 한다. 이 PR이 만든 drift는 아니고, spec이 이름 안정성(기존 클라이언트가 이미 그 코드로 분기 중일 수 있음)을 근거로 통일을 명시적으로 보류한 상태다.
  - 제안: 이번 PR 스코프 밖. 향후 두 엔드포인트의 에러 봉투를 통합할 기회가 생기면 함께 처리.

- **[INFO]** OpenAPI(Swagger) 문서가 신규 검증 규칙(예약어 거부)을 노출하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride` 필드 `@ApiPropertyOptional description`), `codebase/backend/src/modules/workflows/workflows.controller.ts:254`(`@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` — 일반 문구, `MASKED_VALUE_RESUBMITTED` 미언급)
  - 상세: `execute`의 503 케이스는 `@ApiResponse`에 `schema.example`로 정확한 code/message를 문서화하지만(`workflows.controller.ts:259-269`), 신규 400 케이스는 두 엔드포인트 모두 일반 설명만 있고 필드 코드 카탈로그(`MASKED_VALUE_RESUBMITTED` 포함 4종)는 OpenAPI 스펙에 드러나지 않는다. 결과 생성 클라이언트(SDK 자동생성 등)를 쓰는 API 소비자는 응답 예시 없이 이 신규 거부 사유를 알 방법이 스펙 문서(`spec/`) 밖에는 없다.
  - 제안: 필수 아님(외부 소비자 부재 확인됨). 다음에 이 DTO/컨트롤러를 편집할 기회에 `description`에 예약어 제약 한 줄, 또는 503 케이스처럼 `@ApiResponse` schema example 추가 고려.

- **[INFO]** 응답 봉투 필드 확장(`details[]`가 re-run 400 응답에 처음 채워짐)은 하위호환 방향
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:508-512`(`details: toTriggerParameterErrorDetails(err.errors)`)
  - 상세: 종전 `errors: err.errors`는 `GlobalExceptionFilter`(`http-exception.filter.ts:73`)가 `details`만 읽으므로 응답 봉투에 전혀 실리지 않던 선존 버그였다(`executions-rerun.service.spec.ts:394` 회귀 테스트로 확정). 이 교정은 필드를 **추가**하는 방향이라 기존 클라이언트(필드 부재를 가정)를 깨지 않으며, 자매 엔드포인트(`execute`)와 형태가 통일된다.
  - 제안: 조치 불요. 계약 개선으로 기록.

## 그 외 관점 확인 결과 (발견 없음)

- **URL/경로 설계**: 신규 엔드포인트 없음, 기존 두 경로(`POST /executions/:id/re-run`, `POST /workflows/:id/execute`) 그대로 재사용 — RESTful 네이밍 영향 없음.
- **페이지네이션**: 대상 아님(단건 실행 트리거 엔드포인트).
- **인증/인가**: `@Roles('editor')`, re-run의 owner/admin 체크(RR-PL-06) 모두 미변경. 신규 검증은 인가 이후 단계에 삽입되어 인가 우회 경로 없음.
- **HTTP 상태 코드**: `400 Bad Request` + `TriggerParameterValidationException` → `BadRequestException` 매핑은 기존 `missing_required`/`coerce_failed`/`invalid_schema`와 동일 패턴을 재사용 — 신규 사유만으로 상태 코드 오적용 없음.
- **요청 검증 정확성**: raw 우선 검사 → resolve → 재검사의 2단계 순서(`reject-masked-resubmission.ts:56-75`)가 `Boolean('***')→true` 완전 우회, `coerce_failed` 안내 선점, `defaultValue` 과잉 차단 세 갈래를 모두 막는 근거가 JSDoc·테스트(`reject-masked-resubmission.spec.ts`, 두 호출부 spec)로 확인됨. 대상 키를 항상 raw 기준으로 고정해 `defaultValue`로 채워진 미접촉 필드는 차단하지 않음.
- **버전 관리**: 이 저장소는 API 버전 프리픽스 체계가 없는 내부 제품(`spec/5-system/2-api-convention.md` 확인) — 이 PR이 새로 어긴 버전 관리 규칙 없음.

## 요약

핵심 계약 표면(URL, HTTP 메서드, 인증/인가, 상태 코드 체계)은 변경되지 않았고, 변경은 두 Manual 실행 엔드포인트의 **요청 유효값 도메인을 세 예약 문자열만큼 좁히는** 의도된 보안 하드닝과 **응답 에러 봉투의 선존 버그(`errors`→`details`) 교정**으로 요약된다. 값 도메인 축소는 기술적으로 breaking이지만 외부 소비자 부재가 저장소 소유자에 의해 확인됐고 CHANGELOG·spec 7곳에 사전 공지됐으며 회귀 테스트로 봉투 형태까지 고정돼 있다. 남은 지적(최상위 `error.code` 두 엔드포인트 간 drift, Swagger 문서 미보강)은 모두 이 PR 이전부터 있었거나 이미 근거를 확인한 저위험 이월 항목이라 INFO로만 기록한다.

## 위험도

LOW
