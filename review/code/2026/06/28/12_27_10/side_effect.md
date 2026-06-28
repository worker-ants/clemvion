# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 모듈-레벨 상수 `REASON_TO_DETAIL` 도입
- 위치: `/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (라인 47–63)
- 상세: `REASON_TO_DETAIL`은 모듈 스코프 `const`로 선언된 읽기 전용 객체다. TypeScript에서 `const` 객체는 참조가 고정될 뿐 내부 필드는 런타임에 변경 가능하나, 해당 객체는 외부로 export 되지 않으며 `toTriggerParameterErrorDetails` 함수 내부에서만 읽기용으로 접근한다. 변경 경로가 없어 실질적인 가변 전역 상태가 아니다.
- 제안: 현행 설계 유지. 필요하다면 `Object.freeze(REASON_TO_DETAIL)` 으로 런타임 불변성을 명시할 수 있으나 필수 아님.

### [INFO] 공개 API(`BadRequestException` 페이로드) 형태 변경 — `errors` → `details`
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` (라인 539), `/codebase/backend/src/modules/workflows/workflows.controller.ts` (라인 581)
- 상세: 두 경로 모두 `BadRequestException({ ..., errors: err.errors })` 에서 `BadRequestException({ ..., details: toTriggerParameterErrorDetails(err.errors) })` 로 변경된다. `GlobalExceptionFilter`가 `details` 키만 봉투로 전달하고 `errors`는 버려왔으므로, 기존에 클라이언트가 응답 최상위 `errors` 키로 접근하던 코드는 이미 아무 값도 받지 못했다. 즉 클라이언트 가시(visible) 파괴적 변경이 아니며, 내부에서 필터를 거치지 않고 `BadRequestException` 페이로드 raw 객체를 직접 참조하는 단위 테스트 코드(`hooks.service.spec.ts`)가 이번 changeset에서 함께 업데이트되어 정합이 유지된다.
- 제안: 이상 없음. 단, `GlobalExceptionFilter`의 `details` 전달 방식이 미래에 변경될 경우 두 호출 지점 모두 영향을 받으므로, 필터 구현과의 계약을 주석 또는 통합 테스트로 계속 고정하는 것이 권장된다(현재 e2e 테스트 `webhook-trigger.e2e-spec.ts` B3이 이를 담당).

### [INFO] 새 공개 export 추가 — `TriggerParameterErrorDetail`, `toTriggerParameterErrorDetails`
- 위치: `/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- 상세: 두 식별자가 새롭게 `export`된다. 기존 export(`TriggerParameterDefinition`, `TriggerParameterValidationError`, `TriggerParameterValidationException`)는 제거되거나 시그니처 변경 없이 그대로 유지된다. 추가(additive) 변경이므로 기존 import 코드에 영향이 없다.
- 제안: 이상 없음.

### [INFO] e2e 테스트에서 DB 직접 쿼리로 노드 config 변경
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` (라인 1147–1155)
- 상세: `await db.query("UPDATE node SET config = $1 WHERE ...")` 로 테스트 격리 내 전용 workflow의 manual_trigger 노드 설정을 직접 변경한다. 대상 workflow는 테스트 케이스 내에서 독립적으로 생성(`hook-b3`)되고 공유 `workflowId`와 별개로 분리되어 있어, 다른 테스트 케이스에 영향을 주지 않는다. `beforeAll`/`afterAll`의 `db` 연결을 재사용하는 패턴은 기존 e2e 코드와 일관성이 있다.
- 제안: 이상 없음. 테스트 격리 설계가 명확히 기술되어 있고(`공유 workflowId 를 오염시키지 않도록 분리`) 실제로 분리되어 있다.

### [INFO] `REASON_TO_DETAIL` 키에 없는 `reason` 값 입력 시 런타임 예외 가능성
- 위치: `/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (라인 79–80)
- 상세: `REASON_TO_DETAIL[e.reason]`이 `undefined`인 경우 `.code` 접근 시 `TypeError`가 발생한다. 현재 `TriggerParameterValidationError['reason']`의 타입은 `'missing_required' | 'coerce_failed' | 'invalid_schema'`로 제한되고 `REASON_TO_DETAIL`의 키도 동일한 타입(`Record<TriggerParameterValidationError['reason'], ...>`)으로 정의되어 TypeScript 컴파일 타임에 모든 케이스가 보장된다. 따라서 타입 시스템이 유지되는 한 런타임 위험은 없다. 단, `errors` 배열이 외부 데이터로부터 비검증 상태로 주입될 경우 이론상 위험하다.
- 제안: 현행 수준 수용 가능. `TriggerParameterValidationException`이 항상 내부에서만 생성되므로 외부 오염 경로가 없다.

## 요약

이번 변경은 내부 검증 reason 코드를 공용 에러 봉투의 UPPER_SNAKE_CASE field code로 정규화하는 순수한 부가(additive) 리팩터링이다. 전역 상태 변경 없음, 파일시스템 부작용 없음, 환경 변수 읽기/쓰기 없음, 네트워크 호출 없음, 이벤트·콜백 변경 없음. 공개 API 페이로드의 `errors` → `details` 키 변경은 이미 `GlobalExceptionFilter`가 `details` 만 전달해 `errors`가 클라이언트에 도달하지 않았던 구조의 버그를 수정한 것으로, 파괴적 변경에 해당하지 않는다. 모듈-레벨 상수 `REASON_TO_DETAIL`은 외부 export 없이 읽기 전용으로만 사용되어 공유 상태 오염이 없고, 새 export 둘(인터페이스·함수)은 순수 추가이므로 기존 호출자에 영향을 주지 않는다.

## 위험도

NONE
