# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `toHttpDetails()` 내부 `'INVALID_FIELD'` 리터럴 — 추가 SoT 분리 여지
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `FormValidationError.toHttpDetails()` 반환 객체
- 상세: `toHttpDetails()`가 두 진입점의 응답 빌드 로직을 단일 SoT로 일원화한 점은 긍정적이다. 그러나 반환 값의 `code: 'INVALID_FIELD'` 는 문자열 리터럴로 하드코딩되어 있다. `ErrorCode` enum 이 `VALIDATION_ERROR` 를 수용한 것처럼, `INVALID_FIELD` 도 enum 에 추가하면 이 문자열이 변경될 때 단일 지점에서 관리할 수 있다. 현재는 `toHttpDetails()` 내부와 테스트 기댓값(`'INVALID_FIELD'`)이 독립적인 리터럴이므로 나중에 값 이름이 변경될 경우 grep 으로만 추적 가능하다.
- 제안: `ErrorCode.INVALID_FIELD = 'INVALID_FIELD'` 를 enum 에 추가하고 `toHttpDetails()` 에서 참조하거나, 최소한 `ValidationDetail` 인터페이스의 `code` 필드 타입을 `'INVALID_FIELD'` 리터럴 유니언으로 좁혀 컴파일 타임 보호를 추가한다. (이전 리뷰 `20_22_14` W-5 에서 `VALIDATION_ERROR` 를 enum 에 추가했으나 `INVALID_FIELD` 는 미처리 상태로 잔존함.)

### [WARNING] `workflow-errors.ts` 내 JSDoc 블록 이중 선언 — `FormValidationError` 클래스 위에 두 개의 블록 연속 존재
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` 줄 228~242
- 상세: `FormValidationError` 클래스 직전에 두 개의 별도 JSDoc 블록(`/** ... */`)이 연속으로 작성되어 있다. 첫 번째 블록(줄 228~237)은 `FormValidationError` 에 대한 클래스 설명이고, 두 번째 블록(줄 238~242)은 `ValidationDetail` 인터페이스에 대한 설명이다. 그러나 코드상 `ValidationDetail` 인터페이스가 두 번째 블록 바로 아래에 선언되므로, 두 JSDoc 블록이 의도한 대상에 올바르게 붙어 있지 않다. TypeDoc / IDE는 JSDoc 블록을 바로 아래 선언에 연결하는 규칙을 따르므로, 첫 번째 JSDoc 은 `ValidationDetail` 인터페이스에 연결될 가능성이 있고 `FormValidationError` 클래스 문서로 렌더링되지 않는다. `ValidationDetail` 의 JSDoc 이 `FormValidationError` 위에 있는 것은 선언 순서와도 역전된다.
- 제안: `ValidationDetail` 인터페이스를 `FormValidationError` 위에 먼저 선언하고 각 선언에 각자의 JSDoc 블록을 단일로 붙이거나, 두 JSDoc 블록을 하나로 병합해 `FormValidationError` 에 귀속시킨다. 현재 구조는 JSDoc 렌더링 결과와 코드 의도가 불일치한다.

### [INFO] `executions.controller.ts` 에서 `BadRequestException` 응답 객체를 인라인 빌드 — `badRequest()` 헬퍼 미재사용
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` — `continueExecution` FormValidationError catch 블록
- 상세: `interaction.service.ts` 는 `badRequest(code, message, details)` 헬퍼를 통해 `BadRequestException` 을 생성하지만, `executions.controller.ts` 는 동일한 응답 구조를 인라인 객체 리터럴로 직접 조립한다. 이전 리뷰(W-6) 에서 `toHttpDetails()` 추출로 상당 부분 해결되었으나, 두 진입점의 `BadRequestException` 생성 방식 자체는 여전히 불일치한다. `badRequest()` 헬퍼가 `interaction.service.ts` 내부 모듈 함수로 선언되어 있어 컨트롤러가 직접 재사용하기 어려운 구조인 점이 근본 원인이다.
- 제안: `badRequest()` 헬퍼를 `execution-engine/` 또는 `common/` 공유 위치로 이동하거나, `FormValidationError` 자체에 `toBadRequestException()` 메서드를 추가해 두 진입점이 동일한 코드 경로를 공유하도록 한다.

### [INFO] `badRequest()` 헬퍼의 `code` 파라미터 타입이 `string` — `ErrorCodeValue` 로 좁힐 수 있음
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `badRequest(code: string, ...)` 함수 시그니처
- 상세: `details` 파라미터 타입은 이전 리뷰(W-7) 에서 `ReadonlyArray<ValidationDetail>` 로 구체화되었으나, `code` 파라미터는 여전히 `string` 이다. `ErrorCode` enum 의 `ErrorCodeValue` 타입을 사용하면 유효하지 않은 오류 코드가 컴파일 타임에 차단된다.
- 제안: `badRequest(code: ErrorCodeValue, message: string, ...)` 로 변경한다. `ErrorCode` 는 이미 `interaction.service.ts` 에서 임포트되고 있으므로 `ErrorCodeValue` 타입 추가만으로 적용 가능하다.

### [INFO] `assertFormSubmissionValid` — 호출 측에서 `nodeExecutionId` 를 별도 변수에 담지 않고 바로 전달
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `continueExecution` 내 `assertFormSubmissionValid` 호출
- 상세: `const nodeExecutionId = await this.resolveWaitingNodeExecutionId(executionId)` 없이 `await this.assertFormSubmissionValid(nodeExecutionId, formData)` 형태로 사용되는데, 현재 코드에서 `nodeExecutionId` 가 어디서 할당되는지 추적하려면 몇 줄 위를 올라가야 한다. 미미한 이슈이나 미래 리팩터링(예: DB 쿼리 최적화 W-11) 시 실수 가능성이 있다.
- 제안: `const nodeExecutionId = await this.resolveWaitingNodeExecutionId(executionId)` 로 명시적으로 변수에 할당한 뒤 두 호출(`assertFormSubmissionValid`, `continuationBus.publish`) 에서 재사용하는 구조를 유지한다.

### [INFO] `coerceFormValue` 의 배열 join 구분자 `,` 가 `validateFormSubmission` 파싱 가정과 암묵적으로 결합
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `coerceFormValue` 메서드
- 상세: 배열 값을 `,` 로 join 하는 전략은 `validateFormSubmission` 이 수신 문자열을 파싱하는 방식과 묵시적으로 결합되어 있다. 만약 `validateFormSubmission` 이 내부에서 콤마 분리 방식을 변경하면 `coerceFormValue` 도 함께 변경해야 하나, 현재 이 의존 관계를 주석이나 상수로 명시하지 않는다.
- 제안: join 구분자를 `FORM_MULTI_VALUE_SEPARATOR = ','` 같은 공유 상수로 추출하거나, JSDoc 에 "`validateFormSubmission` 의 파싱 가정과 일치해야 함" 을 명시해 향후 변경 시 탐색 범위를 줄인다.

---

## 요약

이번 변경은 전체적으로 가독성이 양호하고, JSDoc 도 충분히 작성되어 있다. 이전 리뷰(20_22_14) 에서 지적된 대부분의 유지보수성 문제(중복 응답 빌드 제거, `toHttpDetails()` SoT화, `badRequest()` details 타입 구체화, `ErrorCode.VALIDATION_ERROR` enum 추가)가 해결된 상태다. 현재 남은 주요 우려는 두 가지다. 첫째, `workflow-errors.ts` 에서 `ValidationDetail` 인터페이스와 `FormValidationError` 클래스 사이에 두 개의 JSDoc 블록이 연속 배치되어 TypeDoc/IDE 문서 렌더링 결과가 코드 의도와 불일치할 수 있다. 둘째, `toHttpDetails()` 내부의 `'INVALID_FIELD'` 리터럴이 `ErrorCode` enum 밖에 남아 있어 `VALIDATION_ERROR` 를 enum 으로 이동한 패턴과의 일관성이 아직 부족하다. 나머지 항목은 타입 안전성 개선 및 암묵적 결합 명시화 수준의 낮은 우선순위 개선 사항이다.

## 위험도

LOW
