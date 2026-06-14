# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `FormValidationError` 응답 빌드 로직 중복 — `executions.controller.ts` vs `interaction.service.ts`
- 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (FormValidationError catch 블록), `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`dispatchContinuation` catch 블록)
- 상세: `FormValidationError`를 `BadRequestException`으로 변환하는 `details[]` 빌드 로직이 두 곳에 동일하게 복제되어 있다. `interaction.service.ts`는 `badRequest()` 헬퍼를 통해 처리하지만, `executions.controller.ts`는 `BadRequestException` 생성 객체를 인라인으로 직접 작성한다. `details[0].code = 'INVALID_FIELD'` 같은 고정 문자열이 두 곳에 분리 정의되어 있어, 하나를 수정할 때 다른 쪽을 놓칠 위험이 있다.
- 제안: `FormValidationError → BadRequestException` 변환을 공유 헬퍼 함수(예: `toValidationBadRequest(err: FormValidationError)`)로 추출하거나, controller도 `interaction.service.ts`의 `badRequest()` 패턴을 동일하게 채택한다.

### [WARNING] `badRequest()` 헬퍼의 `details` 파라미터 타입이 `unknown`
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`badRequest` 함수 시그니처)
- 상세: `details?: unknown` 으로 선언되어 있어 실제 사용 구조(`Array<{ field: string; message: string; code: string }>`)가 타입으로 강제되지 않는다. 호출 측에서 임의 값을 넘겨도 컴파일 에러가 발생하지 않으며 IDE 자동완성도 지원되지 않는다.
- 제안: `details?: ReadonlyArray<{ field: string; message: string; code: string }>` 또는 별칭 인터페이스(`ValidationDetail`)로 선언한다.

### [INFO] 테스트 케이스 중복 — `interaction.service.spec.ts` 내 동일 시나리오 두 번
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` (diff 추가분 line ~2427~2455 vs 전체 파일 컨텍스트 line ~2655~2683)
- 상세: `'submit_form: engine FormValidationError → 400 VALIDATION_ERROR + details[{field,message,code}]'` 라는 동일한 제목과 동일한 assertion을 가진 테스트가 파일 내에 두 번 존재한다. 중복 실행 시 테스트 수트에 혼란을 유발하며, 하나를 수정하고 다른 하나를 놓치면 false green이 발생할 수 있다.
- 제안: 중복 케이스 중 하나를 제거한다.

### [INFO] `assertFormSubmissionValid` — 2개의 연속 DB 조회
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`assertFormSubmissionValid` 메서드)
- 상세: `nodeExecutionRepository.findOne` → `nodeRepository.findOneBy` 순으로 sequential DB 호출 2회가 발생한다. 폼 제출 hot-path는 아니지만, TypeORM `relations` 옵션으로 단일 쿼리로 병합이 가능하다. 현재 구조를 유지할 이유(예: select 필드 분리)가 있다면 메서드 주석에 명시하는 것이 유지보수에 유리하다.
- 제안: join 쿼리로 통합하거나, sequential 조회를 의도적으로 유지하는 경우 그 이유를 주석으로 문서화한다.

### [INFO] `coerceFormValue` — 배열·객체 처리 전략에 대한 JSDoc 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`coerceFormValue` 정적 메서드)
- 상세: 배열 내 요소가 객체인 경우 `JSON.stringify`로 직렬화해 콤마 join하는 동작은 인라인 주석으로 설명되어 있으나, 함수 시그니처 수준의 JSDoc이 없어 "파일 메타 배열" 같은 특수 케이스를 코드 독자가 즉시 파악하기 어렵다.
- 제안: `coerceFormValue`에 JSDoc을 추가해 배열/객체 케이스와 expected 동작(required 판정, type 규칙 미해당)을 문서화한다.

### [INFO] e2e 테스트 setup 코드 반복 — 테스트 F·G
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (테스트 F와 G의 DB 직접 삽입 블록)
- 상세: 두 테스트 모두 `createTriggerWithInteraction` + 다수의 직접 `db.query` INSERT를 통해 execution + node_execution 행을 구성하는 긴 setup 블록을 보유한다. 이 패턴이 향후 테스트 케이스 추가 시 반복될 가능성이 높다.
- 제안: `createWaitingExecution(db, workflowId)` 또는 `createWaitingFormExecution(db, workflowId, fields)` 같은 e2e 헬퍼를 추출해 setup 중복을 제거한다.

## 요약

이번 변경은 폼 제출 검증 로직을 엔진 레이어에 추가하고 두 HTTP 진입점에서 에러를 적절히 변환하는 구조로, 전반적으로 의도가 명확하고 주석도 충분하다. 가장 중요한 유지보수성 우려는 두 진입점(`executions.controller.ts`와 `interaction.service.ts`)에서 `FormValidationError → BadRequestException` 변환 로직과 고정 문자열(`'INVALID_FIELD'`)이 중복 구현된 점이며, `badRequest()` 헬퍼의 `details: unknown` 타입도 타입 안전성을 저하시킨다. 테스트 케이스 중복은 확인 후 제거가 필요하다. 나머지는 낮은 우선순위의 가독성·확장성 개선 사항이다.

## 위험도

LOW
