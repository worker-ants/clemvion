# RESOLUTION — webhook 400 error.details[] (review 2026/06/28 12_27_10)

원 SUMMARY: RISK=LOW, CRITICAL=0, WARNING=1, INFO=14. resolution 후 fresh 검증 통과.

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| WARNING #1 | Testing | `hooks.service.spec` `TYPE_COERCION_FAILED` 테스트의 변환 경로 호출 보장 불명확 | 실제로 `resolveTriggerParameters`·`toTriggerParameterErrorDetails` 는 mock 없이 import 되어 그대로 실행되므로 real path 가 검증됨을 확인. 추가로 **manual 경로 real 검증을 보강**: `workflows.controller.spec` 의 기존 400 테스트가 `INVALID_TRIGGER_PARAMETERS` + `details[]` 봉투를 단언하도록 강화(INFO #4/#14 동시 해소), e2e B3 에 `TYPE_COERCION_FAILED` 서브케이스 추가(INFO #5). |
| INFO #4, #14 | Testing/Requirement | `workflows.controller` `INVALID_TRIGGER_PARAMETERS` 경로 단위 테스트 부재 | `workflows.controller.spec` "returns 400 when required parameter is missing" 에 `response.code`/`response.details` 봉투 단언 추가. |
| INFO #5 | Testing | e2e B3 에 coerce 실패 시나리오 미포함 | B3 노드에 `amount`(number) 파라미터 추가 + 비숫자 전송 → `TYPE_COERCION_FAILED` 서브케이스 단언. |
| INFO #6 | Testing | `resolve-trigger-parameters.spec` UPPER_SNAKE 케이스가 exact-match 케이스와 중복 | 중복 케이스 삭제. |
| INFO #7 | Testing | `'preserves order and is empty'` 테스트가 순서 미검증 | `'returns an empty array for empty input'` 으로 정정. |
| INFO #8 | Maintainability | `REASON_TO_DETAIL[e.reason]` 이중 조회 | 구조 분해(`const { code, message } = ...`)로 단일 조회. |
| INFO #9 | Maintainability | `hooks.service.spec` 인라인 details 타입 중복 | export 된 `TriggerParameterErrorDetail[]` 재사용. |

## 보류·후속 항목

비차단 INFO 중 범위 외/후속:

- **INFO #1** (security — `TriggerParameterValidationException.message` 단순화): catch-rethrow 로 현재 미노출. 방어적 개선은 선택, 본 PR 범위 외.
- **INFO #2, #11** (`workflows.controller.execute` 의 `body.input` spread·`rawValues` 3단계 fallback): 이번 diff 직접 범위 밖의 기존 로직. 별도 리팩터 사안.
- **INFO #3** (helper JSDoc 에 `invalid_schema` runtime 미도달 명시): 선택적 문서 보강.
- **INFO #10** (e2e 직접 DB `UPDATE node`): 다른 e2e 와 동일 관행(external-interaction 등). 헬퍼 추출은 후속 정리 사안.
- **INFO #12, #13** (기존 인터페이스 JSDoc·주석 경로 보강): 후속 작업 수준.

## TEST 결과

resolution fix 후 TEST WORKFLOW 전체 재통과:

- lint: 통과 (`lint-20260628-123603`)
- unit: 통과 (`unit-20260628-123654`)
- build: 통과 (`build-20260628-123805`)
- e2e: 통과 — 220 tests (`e2e-20260628-124020`). webhook-trigger B3 (MISSING_REQUIRED_FIELD + TYPE_COERCION_FAILED 봉투) 포함.
