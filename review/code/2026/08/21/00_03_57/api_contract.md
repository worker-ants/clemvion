STATUS=success ISSUES=3
===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰 — EIA §R17 서버측 마스킹 재제출 거부

## 발견사항

- **[CRITICAL]** `boolean` 타입 Manual Trigger 파라미터는 마스킹 마커가 **조용히 우회**된다 — 이 기능이 막으려던 바로 그 시나리오가 재현
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:500`(`const masked = findMaskedResubmissions(parameters);`), `codebase/backend/src/modules/workflows/workflows.controller.ts:319`(동일 호출) — 두 곳 모두 `findMaskedResubmissions` 를 `resolveTriggerParameters` 의 **반환값(coerce 이후)** 에 대해서만 호출한다. 근본 원인은 diff 밖의 기존 함수 `coerceToType`(`codebase/backend/src/modules/execution-engine/utils/coerce-type.ts` `case 'boolean':` 블록)에 있다.
  - 상세: 자격증명 키 이름 패턴에 매칭되면 값의 원래 타입과 무관하게 egress 시 문자열 `'***'` 로 통째 마스킹된다(`codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactObject` 의 "masked wholesale... whatever its type" 분기, `CREDENTIAL_KEY_PATTERN` 매칭 시 `r = VALUE_MASK_MARKER`). 이 값이 `type: 'boolean'` 으로 선언된 Manual 파라미터로 재제출되면 `coerceToType('***', 'boolean')` 은 `Boolean('***')` → `true` 를 반환하고, `isCoerceFailure('boolean', …)` 은 boolean 타입에 대해 항상 `false` 를 반환하므로 `resolveTriggerParameters` 는 에러 없이 통과시킨다. 그 결과 `findMaskedResubmissions` 가 받는 `resolved` 객체에는 이미 문자열 `'***'` 이 아니라 **불리언 `true`** 가 들어 있고, `isMaskedMarker(true)` 는 `typeof v === 'string'` 검사에서 즉시 `false` 이므로 마스킹 재제출로 탐지되지 않는다. 결과: 마스킹된 원본이 그대로 노출되는 것은 아니지만, `'***'` 라는 예약어가 임의로 `true` 값으로 **치환돼 검증 없이 실행에 쓰인다** — 정확히 `reject-masked-resubmission.ts` 의 목적("리터럴 `'***'` 가 새 실행의 실제 입력값이 된다")이 형태만 바뀐 채(문자열 대신 강제된 `true`) 재발한다. `string`(정상 탐지) 외에 `number`/`array`/`object` 타입은 `coerceToType` 이 `'***'` 를 항상 실패시켜(`coerce_failed`) 어차피 거부되지만, `boolean` 타입만 유일하게 **조용히 통과**한다. 테스트 스위트(`reject-masked-resubmission.spec.ts`, `executions-rerun.service.spec.ts`, `workflows.controller.spec.ts`) 어디에도 `type: 'boolean'` 파라미터를 마스킹 마커로 재제출하는 케이스가 없어 이 갭이 그린으로 통과한다.
  - 제안: `findMaskedResubmissions` 를 coerce **이전** raw 입력(`dto.inputOverride`/`rawValues`)에도 적용하거나, `resolveTriggerParameters` 안에서 coerce 직전에 `isMaskedMarker` 를 먼저 검사해 boolean/number/array/object 캐스팅이 마스킹 마커를 삼키기 전에 걸러내도록 순서를 바꾼다. 캐너리 테스트로 `type: 'boolean'` 필드에 마커를 재제출하는 케이스를 추가해 고정할 것.

- **[WARNING]** `number`/`array`/`object` 타입 파라미터의 마스킹 마커 재제출은 거부되긴 하지만 **잘못된 에러 코드**로 응답한다 — `MASKED_VALUE_RESUBMITTED` 대신 `TYPE_COERCION_FAILED`
  - 위치: 위와 동일 호출 지점(`executions.service.ts:497-503`, `workflows.controller.ts:315-322`) — `resolveTriggerParameters`(`codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` `isCoerceFailure`)가 `coerce_failed` 를 먼저 throw 해버려 마스킹 검사(`findMaskedResubmissions`)에 도달하지 못한다.
  - 상세: `type: 'number'`/`'array'`/`'object'` 로 선언된 필드에 마커 문자열 `'***'` 을 재제출하면 `Number('***')`→`NaN`→`null`, 혹은 배열/객체 파싱 실패로 `isCoerceFailure` 가 `true` 를 반환해 `resolveTriggerParameters` 자체가 `TriggerParameterValidationException([{reason:'coerce_failed'}])` 를 던진다. 이 예외는 `masked_value_resubmitted` 판정 이전에 발생하므로 사용자는 400 은 받지만 `error.details[].code === 'TYPE_COERCION_FAILED'`, `message: 'Value could not be coerced to the declared type'` 를 본다 — "가려진 값을 다시 입력하라" 는 이 기능이 의도한 안내 대신 일반 타입 오류를 본다. spec(`14-external-interaction-api.md` §R17)이 명시하는 "마커 세 문자열은 Manual 파라미터의 예약어"라는 보장은 문서상 타입 무관이지만, 실제로는 필드의 선언 타입에 따라 사용자가 받는 에러 코드·메시지가 갈린다 — 같은 원인(마스킹 재제출)에 대해 API 소비자가 분기해야 할 신호가 타입별로 달라지는 것은 에러 응답 일관성 위반이다.
  - 제안: 위 CRITICAL 항목과 같은 수정(코어스 이전 raw 값에 마스킹 검사 선행)으로 함께 해소됨 — 순서를 "마스킹 검사 → 타입 coerce" 로 바꾸면 이 항목도 자동으로 정상화된다.

- **[INFO]** 요청 계약의 하위 호환성 좁힘(narrowing) — 문서화·영향 확인은 되어 있음
  - 위치: `spec/5-system/14-external-interaction-api.md`(§R17 "알려진 제약" 단락, diff 게이트 1593-1596행 부근)
  - 상세: `POST /workflows/:id/execute`·`POST /executions/:id/re-run` 두 엔드포인트가 이제 Manual 파라미터 값이 마스킹 마커 세 문자열과 **정확히 일치**하면 무조건 400 으로 거부한다. 이전에는 이 리터럴 값도 정상 입력으로 수락됐으므로 이는 기술적으로 breaking change(요청 바디의 유효값 집합이 좁아짐)다. spec 이 이를 "알려진 제약"으로 명시하고(정확 일치만 차단, `a***b` 같은 값은 통과), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(파일 10, 게이트 704-711행)에 저장소 소유자 확인을 근거로 외부 소비자 부재를 기록해 두었다. 버전 관리(API version bump) 는 이 프로젝트에 해당 스킴이 없어 적용 대상 아님.
  - 제안: 조치 불필요 — 다만 사후에 실제 curl/자동화 클라이언트가 이 세 리터럴 값을 Manual 파라미터로 의도적으로 전송하는 사례가 보고되면 재검토.

## 요약

핵심 변경은 EIA §R17 마스킹 재제출을 서버측 2번째 방어선으로 막는 것으로, 에러 코드 신설(`masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`)은 기존 3종 reason→code 매핑 패턴을 그대로 확장하고, re-run 호출부의 응답 봉투를 `errors` 키(비정규화·소실)에서 `details` 키(정규화·정상 노출)로 고쳐 execute 경로와 봉투를 통일시킨 것은 순수한 개선이다. 그러나 새 서버측 게이트(`findMaskedResubmissions`)가 `resolveTriggerParameters` 의 **coerce 이후** 값에만 적용되도록 배선되어, `boolean` 타입 Manual 파라미터에서는 마스킹 마커 문자열이 `Boolean('***') === true` 로 조용히 강제 변환된 뒤 검사를 통과해 이 기능이 막으려던 시나리오(마커가 실제 입력값으로 둔갑)가 형태만 바뀐 채 재발한다(CRITICAL). `number`/`array`/`object` 타입은 거부 자체는 되지만 `coerce_failed` 가 먼저 던져져 사용자에게 잘못된 에러 코드/메시지가 노출된다(WARNING) — 두 문제 모두 마스킹 검사를 coerce 이전 raw 값에 대해 먼저 수행하도록 순서를 바꾸면 함께 해소된다. 그 외 요청 계약 좁힘(리터럴 마커 예약어화)은 spec 에 명시적으로 문서화되고 외부 소비자 부재가 확인되어 위험이 낮다.

## 위험도

HIGH
