# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `continueExecution` REST 엔드포인트의 Swagger 문서에 신규 400 응답 코드 미반영
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` — `@Post(':id/continue')` 데코레이터 영역
  - 상세: `continueExecution` 핸들러는 이제 `FormValidationError` 를 `400 BadRequestException` 으로 변환하지만, 메서드에 붙은 Swagger 데코레이터에는 `@ApiBadRequestResponse` 가 없다. 기존 Swagger 스펙에는 422(`@ApiUnprocessableEntityResponse`)만 문서화되어 있어 클라이언트가 생성된 API 문서만 보면 400 응답을 알 수 없다.
  - 제안: `@ApiBadRequestResponse({ description: 'VALIDATION_ERROR (form field — details[])' })` 데코레이터를 `continueExecution` 메서드에 추가해 `/api/executions/:id/continue` 엔드포인트의 400 응답을 문서화한다.

- **[INFO]** `FormValidationError.code` 값이 `ErrorCode` enum 외부의 리터럴 문자열 `'VALIDATION_ERROR'`로 선언됨
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError` 클래스
  - 상세: 다른 `ExecutionError` 구현체(`MessageTooLongError`, `RetryLastTurnError` 등)는 `ErrorCode` enum 에서 코드를 파생한다. `FormValidationError` 는 `'VALIDATION_ERROR' as const` 리터럴을 직접 사용해 단일 진실 원칙(SoT)에서 벗어난다. 현재는 기능 문제가 없으나, 코드 값 변경 시 enum 과 이 클래스를 별도로 동기화해야 하는 유지보수 리스크가 있다.
  - 제안: `ErrorCode` enum에 `VALIDATION_ERROR` 항목을 추가하고 `FormValidationError.code = ErrorCode.VALIDATION_ERROR` 로 참조하는 것을 검토한다.

- **[INFO]** `details[]` 배열이 항상 단일 요소(first-error only)만 포함하는 설계임을 API 문서에서 명시하지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts`, `codebase/backend/src/modules/executions/executions.controller.ts`
  - 상세: `details` 배열은 구조상 복수 오류를 허용하는 형태(`{ field, message, code }[]`)이지만, 실제로는 첫 번째 오류 하나만 담긴다(first-error policy). 클라이언트가 배열을 순회해 모든 필드 오류를 한꺼번에 표시하려 할 때 혼선이 생길 수 있다.
  - 제안: Swagger 설명이나 스펙 문서에 "현재 단계에서는 FIRST 오류만 surface 하므로 `details` 배열 길이는 항상 1" 임을 명시한다.

## 요약

이번 변경은 `execution.submit_form` 경로에 publisher 측 동기 form field 검증을 추가하고, 검증 실패를 `FormValidationError`(code=`VALIDATION_ERROR`) 로 typed 처리한 뒤, REST EIA(`/external/executions/:id/interact`) 와 내부 executions 컨트롤러(`/executions/:id/continue`) 양쪽에서 일관되게 `400 VALIDATION_ERROR + details[{field,message,code:'INVALID_FIELD'}]` 로 변환하는 구조다. 에러 응답 형식은 두 엔드포인트 모두 동일한 `{ error: { code, message, details[] } }` 래퍼를 사용해 일관성이 확보돼 있다. 하위 호환성 파괴 없이 새 에러 코드를 추가하는 방식이며 기존 `InvalidExecutionStateError`/`MessageTooLongError` 처리 패턴과 대칭적으로 구현됐다. 발견된 사항은 Swagger 문서 누락 등 정보성 수준에 그치며 기능적·보안적 breaking change는 없다.

## 위험도
LOW
