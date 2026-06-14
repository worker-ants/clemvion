# 테스트(Testing) 리뷰

## 발견사항

### [INFO] 테스트 존재 여부 — 신규 로직 전반에 테스트가 추가됨

- 위치: `execution-engine.service.spec.ts`, `workflow-errors.spec.ts`, `executions.controller.spec.ts`, `interaction.service.spec.ts`, `websocket.gateway.spec.ts`, `external-interaction.e2e-spec.ts`
- 상세: `FormValidationError` 클래스 계약, `assertFormSubmissionValid` 5개 경로(required 누락, email 오류, 유효 데이터, nodeExec null skip, node null skip), `coerceFormValue` 9개 타입 분기, 두 HTTP 진입점의 400 변환, WS ack `VALIDATION_ERROR` 경로, e2e 케이스 G 까지 모두 포함. 신규 코드 경로에 대한 테스트 추가가 전반적으로 충실하다.
- 제안: 없음.

---

### [INFO] coerceFormValue private static 메서드 — cast 접근 패턴

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L1342-1345 (`coerceFormValue 타입 분기` describe)
- 상세: `(ExecutionEngineService as unknown as SvcClass).coerceFormValue(v)` 형태로 private static 메서드에 직접 접근한다. 메서드 시그니처나 접근 제어가 변경되면 테스트가 런타임에만 실패하고 컴파일 단계에서는 통과하므로, 리팩터 시 무성 회귀가 발생할 수 있다. 단, 프로젝트 내 다른 곳에서도 동일 패턴을 사용하고 있으므로 일관성은 있다.
- 제안: INFO 수준. `coerceFormValue`를 `execution-engine/form-validation.ts` 또는 별도 유틸로 추출(W-4 BACKLOG와 연동)하면 export된 순수 함수로 직접 테스트 가능해지고 cast hack이 불필요해진다.

---

### [INFO] assertFormSubmissionValid 테스트 — findOne mock 호출 순서가 암묵적

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L108-117 (`setupFormNodeMocks`)
- 상세: `setupFormNodeMocks()`가 `mockNodeExecutionRepo.findOne`을 `mockResolvedValueOnce`로 설정한다. `continueExecution` 내부에서 `resolveWaitingNodeExecutionId`도 nodeExecution 관련 쿼리를 수행할 수 있으므로, `findOne` 호출 순서가 구현 변경 시 바뀌면 mock queue가 예상과 달라진다. 현재 테스트는 통과하고 있으나 mock 의존 순서가 암묵적이다.
- 제안: INFO 수준. 향후 `assertFormSubmissionValid` 또는 `resolveWaitingNodeExecutionId` 구현이 변경되면 setupFormNodeMocks의 mock 순서를 재검토해야 한다는 주석 추가를 권장한다.

---

### [INFO] 커버리지 갭 — coerceFormSubmission 경계 입력(null, 비-객체)에 대한 직접 테스트 미포함

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L265-271 (`coerceFormSubmission`), `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: `coerceFormValue`는 9개 분기 전부 직접 테스트되어 있으나, `coerceFormSubmission` 자체의 경계 입력(null, 숫자, 문자열 등 비-객체 formData)에 대한 독립 단위 테스트가 없다. `coerceFormSubmission(null)` → `{}`, `coerceFormSubmission("string")` → `{}` 같은 방어 경로는 `assertFormSubmissionValid` 내부에서만 간접 실행된다.
- 제안: INFO 수준. `coerceFormValue`와 마찬가지로 `coerceFormSubmission`의 비-객체 입력 경계 케이스를 직접 테스트하면 방어 로직 회귀 가드가 강화된다.

---

### [INFO] 커버리지 갭 — minLength·maxLength·select 검증 경로의 assertFormSubmissionValid 연동 테스트 미포함

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (W-1 describe 블록)
- 상세: W-1 테스트는 required 누락과 email 형식 오류만 커버한다. spec form §4·§6.2에 명시된 minLength·maxLength·선택지(select) 검증 실패 케이스가 unit 테스트에 없다. `validateFormSubmission`(chat-channel 재사용)이 이 로직을 담당하므로 해당 함수 자체 테스트에서 커버될 수 있으나, `assertFormSubmissionValid` 연동 경로에서의 회귀 가드는 없다.
- 제안: INFO 수준. `formConfig`에 `minLength: 5` 필드를 추가한 케이스, select type 미포함 값 케이스를 W-1 describe에 추가하면 `validateFormSubmission` 재사용 통합 경계를 명시적으로 커버할 수 있다.

---

### [INFO] executions.controller.spec.ts — 단일 it 블록 내 두 번의 mock + 호출 패턴

- 위치: `codebase/backend/src/modules/executions/executions.controller.spec.ts` L452-486 (W-2 테스트 케이스)
- 상세: 하나의 `it` 블록 안에서 `mockRejectedValueOnce`를 두 번 설정하고 `continueExecution`을 두 번 호출한다. 첫 번째는 `toBeInstanceOf(BadRequestException)` 확인, 두 번째는 `getResponse()` body 확인이다. 의도가 명확하나, 두 번의 독립 `it` 케이스로 분리하면 실패 시 어느 단언이 깨졌는지 더 명확하게 파악할 수 있다.
- 제안: INFO 수준. 기능·커버리지 문제는 없으므로 리팩터 선택 사항.

---

### [INFO] e2e 케이스 G — 유효 데이터 제출 시 202 성공 경로 미포함

- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (케이스 G)
- 상세: e2e 케이스 G는 필수 필드 누락(400)만 검증하고, 동일한 form 노드에 유효 데이터를 제출했을 때 202가 반환되는 긍정 경로가 없다. 기존 케이스 2(token 통과 + 202)가 다른 경로를 커버하지만, G 시나리오에서 form 검증 통과 후 202 경로가 end-to-end로 확인되지 않는다.
- 제안: INFO 수준. 케이스 G에 유효 데이터 제출 → 202 성공을 추가하면 검증 통과·실패 양방향이 e2e로 확보된다.

---

### [INFO] 테스트 격리 — mockNodeExecutionRepo.findOne 프로퍼티 직접 재할당

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L110, L174, L180
- 상세: `setupFormNodeMocks` 내에서 `mockNodeExecutionRepo.findOne = jest.fn()...`으로 프로퍼티를 직접 재할당한다. `afterEach`에서 `jest.clearAllMocks()` 또는 `jest.resetAllMocks()`가 명시적으로 호출되지 않으면, 재할당된 mock이 이후 테스트에 영향을 줄 수 있다. 현재는 통과하고 있으나 격리가 암묵적이다.
- 제안: INFO 수준. `jest.spyOn` 방식으로 전환하거나, `afterEach`에서 mock 상태를 명시적으로 복원하면 격리가 더 명확해진다.

---

### [INFO] WS gateway 테스트(W-12) — details 필드 노출 여부 명시 미포함

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` L736-759 (W-12 테스트)
- 상세: ack 객체에서 `result.data.errorCode`와 `result.data.error`(메시지)는 검증하지만, `details[]` 배열이 WS ack에 포함되는지 여부를 검증하지 않는다. WS ack 경로에서 details가 surface되지 않는 설계라면 테스트가 이를 명시적으로 검증해야 의도가 명확해진다.
- 제안: INFO 수준. WS ack에 `details`가 미포함인 설계라면 `expect(result.data).not.toHaveProperty('details')`를 추가해 의도를 명시하는 것이 권장된다.

---

## 요약

이번 변경에서 신규 로직(`FormValidationError`, `assertFormSubmissionValid`, `coerceFormValue`, 두 HTTP 진입점 매핑, WS ack 경로)에 대한 단위·통합·e2e 테스트가 체계적으로 추가되었다. `coerceFormValue` 9개 타입 분기 전부 직접 커버, `assertFormSubmissionValid` 5개 경로 명시, 두 HTTP 진입점과 WS ack 회귀 가드가 포함되어 전반적인 테스트 완성도는 높다. 주요 갭은 (1) minLength·maxLength·select 검증 경로의 `assertFormSubmissionValid` 연동 단위 테스트 미포함, (2) `coerceFormSubmission` 자체의 비-객체 입력 경계 케이스 직접 테스트 미포함으로, `validateFormSubmission` 함수 자체 테스트에서 간접 커버 가능하나 연동 회귀 가드는 없다. mock 재할당으로 인한 테스트 격리 주의, private static 메서드 cast 접근의 취약성도 향후 리팩터 시 점검이 필요하다. 발견된 사항은 모두 INFO 수준으로 기능적 리스크는 없다.

## 위험도

LOW
