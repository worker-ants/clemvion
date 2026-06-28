# 요구사항(Requirement) 리뷰 — webhook 400 error.details[] (2026-06-28 12_45_21)

## 발견사항

### 기능 완전성

- **[INFO]** WH-EP-05-2 요구사항("필수 파라미터 누락·타입 강제 변환 실패 시 `error.details[]` 로 필드별 사유 노출")이 두 경로 모두에 완전히 구현됐다.
  - 위치: `hooks.service.ts`(webhook 경로) + `workflows.controller.ts`(manual-trigger 경로)
  - 상세: `errors: err.errors` → `details: toTriggerParameterErrorDetails(err.errors)` 교체로 `GlobalExceptionFilter` 가 `details` 를 봉투로 전달하는 기존 경로가 이제 올바르게 활성화된다. 이전 `errors` 키는 필터(`http-exception.filter.ts` L57: `details = resp.details ?? nested?.details`)에서 무시됐으므로, 이번 변경이 실제 gap 을 정확히 메운다.

- **[INFO]** `REASON_TO_DETAIL` 맵이 TypeScript `Record<TriggerParameterValidationError['reason'], ...>` 로 정의돼 있어 `missing_required`/`coerce_failed`/`invalid_schema` 세 variant 모두에 대한 매핑 완전성이 컴파일 타임에 보장된다. 런타임 `invalid_schema` 미도달은 설계 선택이며 결함이 아니다.

### 엣지 케이스

- **[INFO]** 빈 배열 입력(`toTriggerParameterErrorDetails([])`) 은 단위 테스트("returns an empty array for empty input")로 검증됐다.
  - 위치: `resolve-trigger-parameters.spec.ts` L419–421
  - 상세: `errors.map(...)` 는 빈 배열에서 빈 배열을 반환하므로 정상.

- **[INFO]** `REASON_TO_DETAIL[e.reason]` 에서 `e.reason` 이 맵에 없는 값이면 런타임 오류가 발생할 수 있으나, `TriggerParameterValidationError['reason']` 유니온 타입이 맵 키와 동일 TypeScript 타입으로 제한되어 있으므로 실제 미도달 경로다.

### TODO/FIXME

- **[INFO]** 변경 파일 내에 TODO, FIXME, HACK, XXX 주석 없음.

### 의도와 구현 간 괴리

- **[INFO]** 함수명 `toTriggerParameterErrorDetails`, JSDoc, `REASON_TO_DETAIL` 맵, 구현 모두 일치한다. 주석의 spec 참조(`5-system/3-error-handling.md §1.7`, `5-system/12-webhook.md §5.2`, `manual-trigger §6`)도 실제 spec 본문과 대응한다.

### 에러 시나리오

- **[INFO]** `TriggerParameterValidationException` 이외의 예외는 `throw err` 로 그대로 재전파된다. 이는 webhook 경로(`hooks.service.ts`)와 manual-trigger 경로(`workflows.controller.ts`) 양쪽에서 동일하게 유지되어 정상.

### 데이터 유효성

- **[INFO]** 입력 `errors` 배열의 각 `e.reason` 은 TypeScript 타입으로 `'missing_required' | 'coerce_failed' | 'invalid_schema'` 로 제한되므로 별도 런타임 검증 불필요.

### 비즈니스 로직

- **[INFO]** spec `5-system/12-webhook.md §5.2` 가 명시하는 field code 매핑(`missing_required` → `MISSING_REQUIRED_FIELD`, `coerce_failed` → `TYPE_COERCION_FAILED`)과 `REASON_TO_DETAIL` 구현이 정확히 일치한다.
  - spec §5.2 예시: `{ "field": "orderId", "code": "MISSING_REQUIRED_FIELD", "message": "Required parameter is missing" }` — 구현 및 e2e 단정 값과 완전히 동일.
- **[INFO]** `error.code` 최상위 값 `INVALID_WEBHOOK_PAYLOAD`(webhook 경로)·`INVALID_TRIGGER_PARAMETERS`(manual 경로)는 변경 없이 유지됐다. spec `3-error-handling.md §1.7` 및 `manual-trigger §6` 이 명시한 도메인별 override code 와 일치.

### 반환값

- **[INFO]** `toTriggerParameterErrorDetails` 는 모든 경로(정상/빈 배열)에서 `TriggerParameterErrorDetail[]` 를 반환한다.
- **[INFO]** 두 경로의 catch 블록은 모두 `throw new BadRequestException(...)` 또는 `throw err` 로 종결되어 미반환 경로가 없다.

### 관련 spec 본문 일치 여부 (spec fidelity)

- **[INFO]** `spec/5-system/12-webhook.md §5.2` 본문(L294–314)과 구현 대조:
  - spec: `BadRequestException({ code, message, details })` throw → 구현 일치 (`hooks.service.ts`)
  - spec: `details[].field` = 파라미터 이름, `details[].code` = UPPER_SNAKE_CASE → 구현 일치 (`TriggerParameterErrorDetail` 인터페이스)
  - spec: `details[].message` 필드 존재 → 구현 일치 (`REASON_TO_DETAIL` 맵의 `message` 값)
  - spec 예시 메시지 "Required parameter is missing" / "Value could not be coerced to the declared type" → 구현 문자열과 정확히 일치

- **[INFO]** `spec/5-system/3-error-handling.md §1.7` (L140) — `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 세 코드 모두 `REASON_TO_DETAIL` 에 등재됨. 일치.

- **[INFO]** `spec/4-nodes/7-trigger/1-manual-trigger.md §6` (L176, L181) — `INVALID_TRIGGER_PARAMETERS` code, `workflows.controller.ts` 경로, `toTriggerParameterErrorDetails` 헬퍼 공유 모두 spec 기술과 일치.

- **[INFO]** `spec/5-system/3-error-handling.md §1.7` (L134) 표에 `INVALID_WEBHOOK_PAYLOAD` 상태가 "구현"으로 기재됨 — 이번 변경 후 실제로 구현된 상태와 일치.

---

## 요약

이번 변경은 WH-EP-05-2 요구사항("webhook 파라미터 검증 실패 시 `error.details[]` 로 필드별 사유 노출")을 정확히 구현한다. `hooks.service`·`workflows.controller` 양 경로에서 내부 `errors` 키를 `details` 키로 교체함으로써 기존 `GlobalExceptionFilter`의 `details` 전달 경로가 활성화된다. `toTriggerParameterErrorDetails` 헬퍼의 `REASON_TO_DETAIL` 맵은 `spec/5-system/12-webhook.md §5.2`, `spec/5-system/3-error-handling.md §1.7`, `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 의 field code 명세(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)·메시지·envelope 구조와 line-level 로 일치한다. CRITICAL·WARNING 발견사항 없음. 모든 에지 케이스(빈 배열, 타입 안전성)가 컴파일 타임 또는 단위 테스트로 보장되며, plan 체크박스·spec 본문이 구현 완료 상태로 갱신됐음을 확인했다.

## 위험도

NONE
