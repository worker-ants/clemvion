# Testing Review — EIA submit_form 서버 측 field 검증

## 발견사항

### **[INFO]** FormValidationError 클래스 자체 단위 테스트 — 부분적으로 누락
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts`
- 상세: `workflow-errors.spec.ts` 에 `InvalidExecutionStateError`, `RetryLastTurnError`, `MessageTooLongError` 는 각각 `code`, `message`, `serverDetail`, `name` 프로퍼티를 단위 검증하지만, 이번에 추가된 `FormValidationError` 에 대한 동일한 패턴 검증이 없다. `toHttpDetails()` 반환값 shape(`field`, `message`, `code: 'INVALID_FIELD'`), `code` 프로퍼티(`VALIDATION_ERROR`), `name` 프로퍼티(`FormValidationError`) 검증이 누락된 상태다. 응답 매핑이 이 필드들을 직접 읽으므로 오타·오할당 regression 이 상위 통합 테스트까지 침투한 뒤에야 탐지될 위험이 있다.
- 제안: `workflow-errors.spec.ts` 의 기존 패턴에 맞춰 `FormValidationError` describe 블록 추가. `new FormValidationError('email', '올바른 이메일 형식이 아닙니다.')` 에 대해 `.code`, `.field`, `.name`, `.message`, `.toHttpDetails()` 반환 shape 를 각각 검증.

---

### **[INFO]** `validateFormSubmission` — minLength/maxLength/select/radio 검증 경로 미커버
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `assertFormSubmissionValid / coerceFormValue (W-1)` describe 블록
- 상세: 추가된 단위 테스트는 `required` 누락과 `email` 형식 오류 두 경로만 커버한다. `form-mode.ts` 의 `validateFormSubmission` 은 `number` 형식, `minLength`, `maxLength`, `select`/`radio` 선택지 외 값 등 4개 추가 검증 경로를 더 가진다. 이 경로들은 `assertFormSubmissionValid` 를 통해 EIA 진입점에 노출되지만, 현재 테스트에서는 해당 분기를 통과하는 `FormValidationError` 가 발생할 수 있다는 사실을 검증하지 않는다. `coerceFormValue` 의 `number → String()` 변환이 number 필드 값에 대해 `NUMBER_RE` 테스트(`/^-?\d+(\.\d+)?$/`)를 통과한다는 사실도 명시적으로 검증되지 않아, 타입 변환 후 검증 흐름의 정합성이 암묵적으로만 보장된다.
- 제안: 기존 `formConfig` 픽스처 확장 또는 별도 픽스처를 추가하여 (1) number 형식 오류(`age: 'abc'`), (2) minLength 미충족, (3) select/radio 허용 외 값 케이스를 각각 `FormValidationError` throw 로 검증하는 테스트 추가.

---

### **[INFO]** `coerceFormSubmission` 경계 케이스 — `formData` 가 `null` / 원시값인 경우 미검증
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `coerceFormSubmission` (private static)
- 상세: `coerceFormSubmission` 은 `if (!formData || typeof formData !== 'object') return {}` 가드를 포함하지만, 이 경로에 대한 테스트가 없다. `coerceFormValue` 의 9가지 타입 분기는 상세히 검증되어 있으나, `coerceFormSubmission` 에 `null`, `42`, `'string'` 을 전달했을 때 빈 객체를 반환한다는 사실은 명시적으로 검증되지 않는다. 이 경로는 EIA 클라이언트가 잘못된 타입을 `formData` 에 전달했을 때 실제로 실행된다.
- 제안: `continueExecution` 에 `formData: null` 또는 `formData: 42` 를 전달했을 때 `FormValidationError` 없이 진행(또는 required 오류)되는 케이스를 별도 테스트로 커버.

---

### **[INFO]** e2e 테스트 케이스 G — 성공 재제출(happy path) 검증 없음
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts`
- 상세: 케이스 G 는 필수 필드 누락 → 400 실패 경로만 검증한다. 동일 세션에서 올바른 데이터로 재제출 시 정상 202 ack 를 받을 수 있는지(waiting_for_input 유지 후 재제출 가능 spec 요구)를 검증하는 성공 경로가 없다. e2e 에서 실패 후 재제출 플로우를 검증하지 않으면, 검증 실패 후 execution 상태가 실제로 `waiting_for_input` 으로 남아있는지 DB 레벨에서 확인되지 않는다.
- 제안: 케이스 G 에 이어 동일 `executionId` 에 유효한 데이터(`{ email: 'valid@example.com' }`)로 재제출하는 케이스를 추가해 202 응답을 검증. BullMQ job 발행 여부는 단위에서 커버되므로 e2e 에서는 HTTP 상태코드만 검증해도 충분하다.

---

### **[INFO]** `continueExecution` 컨트롤러 스펙 — 단일 `it` 블록에 두 가지 검증 의도 혼재
- 위치: `codebase/backend/src/modules/executions/executions.controller.spec.ts` — W-2 테스트
- 상세: W-2 `it` 블록은 `BadRequestException` 인스턴스 확인과 response body shape 검증을 단일 테스트 내에서 `mockRejectedValueOnce` 를 두 번 호출해 처리한다. 한 `it` 안에서 같은 mock 을 두 번 setup 하는 패턴은 첫 번째 assertion 이 실패해도 두 번째 mock setup 이 소비되지 않아 이후 테스트에 mock 상태가 누출될 수 있다.
- 제안: 두 검증을 별도 `it` 블록으로 분리하거나, 단일 `mockRejectedValueOnce` 로 에러를 주입한 뒤 `catch` 블록에서 `instanceof` 와 `getResponse()` 를 동시에 검증하는 방식으로 리팩터.

---

### **[INFO]** WS 게이트웨이 테스트 — `result.data.error` client-safe 음성 assertion 부재
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — W-12 테스트
- 상세: W-12 테스트는 `result.data.error` 를 `'올바른 이메일 형식이 아닙니다.'` 고정 문자열로 검증한다. 이 검증은 field 값이 미포함된다는 client-safe 보장은 별도로 검증하지 않는다. 현행은 `error.message` 를 그대로 surface 하므로 실제 입력값(`'bad'`)이 포함된 message 를 `FormValidationError` 에 전달하면 누출될 수 있으나 해당 테스트는 통과한다.
- 제안: `result.data.error` 에 `'bad'`(입력값)가 포함되지 않는다는 음성 assertion 추가(`expect(result.data.error).not.toContain('bad')`). 기존 `MessageTooLongError` 회귀 테스트 패턴과 동일하게 적용.

---

## 요약

이번 변경은 이전 리뷰 사이클(W-1, W-2, W-12)에서 지적된 핵심 테스트 누락을 모두 보완하였으며, `assertFormSubmissionValid` 의 주요 분기(required 오류, email 형식 오류, nodeExec/node null → skip, 빈 fields → skip), `coerceFormValue` 의 9개 타입 분기, 두 HTTP 진입점의 에러 응답 shape, WS ack `errorCode` 를 직접 검증하는 테스트가 추가되어 테스트 커버리지가 유의미하게 강화되었다. 남은 갭은 모두 INFO 등급으로, `FormValidationError` 클래스 프로퍼티의 직접 단위 검증 부재(`workflow-errors.spec.ts`), `validateFormSubmission` 의 number/minLength/maxLength/select 검증 경로 미커버, 재제출 성공 플로우의 e2e 부재, 그리고 W-2 테스트의 mock 이중 호출 패턴이 해당된다. 기존 테스트(347 suites, 6944 cases)는 회귀 없이 통과하였으며 단위·e2e 전 구간에서 PASS 가 확인되었다.

## 위험도

LOW
