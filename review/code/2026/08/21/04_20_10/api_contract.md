# API 계약(API Contract) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로)

## 발견사항

- **[INFO]** 하위 호환성 — 기존에 허용되던 리터럴 `'***'` 입력값이 이제 `400` 으로 거부되는 의도적 narrowing
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` — `resolveTriggerParametersRejectingMasked`(전체 파일), 호출부 `codebase/backend/src/modules/executions/executions.service.ts:498-503`, `codebase/backend/src/modules/workflows/workflows.controller.ts:314-317`
  - 상세: `POST /workflows/:id/execute` 와 `POST /executions/:id/re-run`(`useOriginalInput:false`) 두 엔드포인트는 지금까지 값 leaf 가 `'***'`/`[REDACTED]`/`[REDACTED_DEPTH]` 와 정확히 일치해도 정상 실행됐다. 이 변경 이후에는 동일 입력이 `400`(`INVALID_TRIGGER_PARAMETERS` / `INVALID_INPUT`) 으로 거부된다. API 관점에서는 순수한 request-shape narrowing(behavior-breaking) 이며, curl 등 UI 를 거치지 않는 기존 클라이언트가 실제로 그 리터럴 값을 정상 데이터로 보내고 있었다면 영향을 받는다.
    다만 이 위험은 코드 변경 자체가 아니라 이미 별도로 검토·완화됐다: (1) `plan/complete/spec-draft-inputoverride-marker-reject.md` "왜 지금인가" 절에 저장소 소유자의 직접 답변(*"마커를 되보내던 외부 자동화가 없다"*)이 근거로 명시돼 있고, (2) 프런트가 이미 동일 규칙으로 렌더 경로를 차단해 왔으므로 API 전용 클라이언트가 아니면 신규 비용이 아니며, (3) 판정이 "값을 포함"이 아니라 "값과 정확히 일치"로 좁게 잡혀 있어(`a***b` 는 통과) 오탐 폭이 작다. CHANGELOG·spec(`manual-trigger.md`, `13-replay-rerun.md`, `1-data-model.md` 등)에도 breaking 성격이 명문화돼 있다.
  - 제안: 코드 변경 자체에 추가 조치는 불필요. 다만 사용자에게 공개되는 릴리스 노트/변경이력이 있다면 "Manual 실행 파라미터에 리터럴 `***` 등 마스킹 마커 문자열을 그대로 사용하던 통합이 있다면 400 을 받게 된다"는 한 줄을 명시적으로 남기는 것을 권장(내부 CHANGELOG.md 는 이미 상세하지만, 외부용 릴리스 노트 존재 여부는 이 diff 범위 밖).

- **[INFO]** 같은 실패 사유(`MASKED_VALUE_RESUBMITTED`)가 두 자매 엔드포인트에서 서로 다른 최상위 `code` 로 노출된다 (본 diff 신규 도입 아님, 참고용)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:506`(`code: 'INVALID_INPUT'`) vs `codebase/backend/src/modules/workflows/workflows.controller.ts:318`(`code: 'INVALID_TRIGGER_PARAMETERS'`)
  - 상세: 두 곳 모두 `error.details[].code = 'MASKED_VALUE_RESUBMITTED'` 는 동일하지만 봉투 최상위 `code` 는 엔드포인트별로 다르다. 이는 이 diff 가 새로 만든 불일치가 아니라 기존 컨벤션(re-run 은 `INVALID_INPUT`, execute 는 `INVALID_TRIGGER_PARAMETERS`)을 그대로 유지한 것이며, `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 응답 봉투 절에도 "Manual 실행 경로 `INVALID_TRIGGER_PARAMETERS` / Manual re-run `INVALID_INPUT`" 로 명시돼 있어 의도된 설계다. 최상위 `code` 만 보고 분기하는 제네릭 클라이언트가 있다면 `details[].code` 를 봐야 한다는 점만 유의.
  - 제안: 조치 불요(의도된 기존 설계, 이번 diff 는 그 설계를 두 곳 모두 동일한 `details[]` 정규화 헬퍼로 정합화했을 뿐).

- **[INFO]** 에러 응답 형식 — 선존 버그(re-run 의 `errors` 키 누락) 를 자매 호출부와 일치시킨 정정
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:506-512`
  - 상세: 종전 `throw new BadRequestException({ code, message, errors: err.errors })` 는 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`, `details = resp.details ?? nested?.details`)가 `errors` 키를 읽지 않아 필드별 사유가 응답 봉투에서 조용히 소실되던 선존 결함이었다. 이번 변경으로 `details: toTriggerParameterErrorDetails(err.errors)` 로 교정돼 `workflows.controller.ts` 와 동일한 봉투 형태(`{code, message, details}` → 필터가 `{error:{code, message, requestId, details}}`)를 갖게 됐다. API 계약 관점에서 순수 개선이며 신규 회귀 없음.
  - 제안: 없음.

- **[INFO]** 요청 검증 — `inputOverride`/`parameterValues` 자체의 DTO 레벨 검증은 이번 diff 범위 밖(기존 `@IsObject()` 만)이며 변경 없음
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts`(`inputOverride?: Record<string, unknown>` `@IsObject()`)
  - 상세: 새 마스킹 거부 검사는 스키마 기반 값 검증(`findMaskedResubmissions`)이며, 최상위 바디 형태 검증은 기존 `class-validator` 데코레이터가 그대로 담당한다. 신규 검사 로직 자체는 `schema`/`rawSource` 가 없거나(`!schema`) record 가 아니면(`!isRecord`) 안전하게 빈 배열을 반환해 예외를 던지지 않는다(`reject-masked-resubmission.ts:120-121`) — null/undefined 입력에 대한 방어가 적절하다.
  - 제안: 없음.

## 요약

이번 변경은 새 엔드포인트나 URL/페이지네이션/인증 표면을 건드리지 않고, Manual 실행 두 진입점(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)에 서버측 2차 검증 계층(`resolveTriggerParametersRejectingMasked`)을 추가해 마스킹 마커 리터럴 재제출을 `400` + 표준 에러 봉투(`{code, message, details[]}`, `details[].code = MASKED_VALUE_RESUBMITTED`)로 거부한다. 신규 필드 코드는 기존 3종(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)과 동일한 네이밍·매핑 패턴을 따르고 `error-handling`/`manual-trigger`/`webhook`/`replay-rerun` spec 카탈로그에 빠짐없이 반영돼 있으며, 부수적으로 re-run 경로의 `errors`→`details` 키 선존 버그도 함께 교정해 두 호출부의 응답 형태가 이제 일치한다. 유일하게 눈에 띄는 것은 기존에 유효했던 리터럴 마커 입력값이 이제 거부되는 하위 호환성 narrowing 인데, 이는 저장소 소유자 확인·프런트 기존 차단·정확 일치 한정 범위·spec 전면 반영으로 이미 충분히 완화·문서화됐다. URL 설계·버전 관리(이 API 는 URL 버전 미포함 정책, 영향 없음)·페이지네이션·인증/인가는 이 diff 로 변경되지 않았다.

## 위험도

LOW
