# Testing Review

## 발견사항

### [WARNING] `assertFormSubmissionValid` / `coerceFormSubmission` / `coerceFormValue` 에 대한 단위 테스트 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` lines 4322–4379 (신규 3개 private 메서드)
- 상세: `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` 는 신규로 추가된 핵심 검증 로직이지만, `execution-engine.service.spec.ts` 에 직접 검증하는 단위 테스트가 없다. `mockNodeRepo.findOneBy` 의 기본값이 `null` 로 설정되어 있어 (`assertFormSubmissionValid` 가 node 를 찾지 못하면 즉시 `return`), 기존 `continueExecution` 계열 테스트 전부가 form 검증 경로를 통과하지 않는다. 결과적으로 아래 코드 경로가 단위 테스트에서 커버되지 않는다:
  - `nodeExec` 가 존재하고 `node` 가 존재하는 경우 → 검증 수행 경로
  - 필드 검증 실패 시 `FormValidationError` throw + `bus.publish` 미호출 경로
  - `coerceFormValue`: null/undefined → '', number/boolean → String(), Array(빈/비빈) → join, 객체 → JSON.stringify 의 각 분기
  - `coerceFormSubmission`: non-object formData → {} 분기
- 제안: `continueExecution` describe 블록 내에 `mockNodeExecutionRepo.findOne` / `mockNodeRepo.findOneBy` 를 `mockResolvedValueOnce` 로 form 노드 config 를 반환하도록 override 하여 아래 케이스를 추가한다:
  1. required field 누락 → `FormValidationError` throw + `bus.publish` 미호출 (code: `VALIDATION_ERROR`)
  2. email 형식 오류 → `FormValidationError` throw
  3. `nodeExec` null → 검증 skip, 정상 publish
  4. `node` null → 검증 skip, 정상 publish
  5. fields.length === 0 → 검증 skip, 정상 publish
  추가로 `coerceFormValue` 의 각 타입 분기는 static private 이지만 `(ExecutionEngineService as any)['coerceFormValue'](...)` 패턴으로 직접 검증 가능하다.

### [WARNING] `executions.controller.spec.ts` 에 `FormValidationError → 400 BadRequestException` 케이스 누락
- 위치: `codebase/backend/src/modules/executions/executions.controller.spec.ts`
- 상세: `executions.controller.ts` 의 `continueExecution` 메서드에 `FormValidationError` catch → `BadRequestException` 변환 분기가 추가되었으나, 컨트롤러 spec 에는 이 경로를 커버하는 테스트가 없다. `InvalidExecutionStateError → 422` 케이스는 이미 테스트되어 있으나 `FormValidationError → 400` 은 누락. response body shape (`error.code === 'VALIDATION_ERROR'`, `error.details[0].field`, `error.details[0].code === 'INVALID_FIELD'`) 검증도 없다.
- 제안: 컨트롤러 spec 의 `continueExecution` describe 블록에 다음 테스트를 추가한다:
  ```typescript
  it('FormValidationError → 400 BadRequestException with VALIDATION_ERROR + details (form §6.2)', async () => {
    mockExecutionEngineService.continueExecution.mockRejectedValueOnce(
      new FormValidationError('email', '올바른 이메일 형식이 아닙니다.'),
    );
    const err = await controller
      .continueExecution('exec-1', 'workspace-1', { formData: { email: 'bad' } })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      error: { code: 'VALIDATION_ERROR', details: [{ field: 'email', code: 'INVALID_FIELD' }] },
    });
  });
  ```

### [INFO] `interaction.service.spec.ts` 의 `FormValidationError` 테스트가 diff 와 전체 컨텍스트 양쪽에 동일 케이스로 중복 존재
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` (diff 추가분 lines 2427–2455 와 전체 컨텍스트 lines 2655–2683)
- 상세: diff 에는 `submit_form: engine FormValidationError → 400 VALIDATION_ERROR + details[{field,message,code}]` 테스트가 1건 추가된 것으로 표시되는데, 전체 컨텍스트 내에도 동일 제목·내용의 테스트가 존재한다. 두 테스트가 동일 파일 내 별도 위치에 있다면 중복이며 describe 구조·실행 순서에 따라 혼란을 줄 수 있다. diff 추가 위치(line 188 근처)와 기존 위치(line 655 근처)가 다른 블록 안에 있는 구조라면 의도적 추가일 수 있으나, 동일 시나리오를 두 번 검증하는 것은 불필요한 중복이다.
- 제안: 두 케이스의 describe 블록 소속을 확인해 실제 중복이면 하나만 유지하고 나머지는 제거한다.

### [INFO] `FormValidationError` 클래스 자체의 프로퍼티에 대한 직접 단위 테스트 부재
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
- 상세: `FormValidationError` 는 `ExecutionError` 를 상속하는 새 에러 클래스이며 `code === 'VALIDATION_ERROR'`, `field`, `name === 'FormValidationError'` 프로퍼티를 갖는다. 이 값들은 EIA controller / interaction.service 의 응답 매핑 로직이 `error.code`, `error.field` 를 직접 읽어 사용하는 SoT 이므로 필드 이름 오타 등의 regression 이 무성하게 전파될 수 있다. 기존 에러 클래스들도 독립 단위 테스트가 없는 패턴이지만, 신규 클래스인 만큼 최소 검증을 추가하는 것이 바람직하다.
- 제안: `workflow-errors.spec.ts` 를 신설하거나 `interaction.service.spec.ts` 상단에 2~3줄 단위 검증을 추가한다:
  ```typescript
  const e = new FormValidationError('email', '형식 오류');
  expect(e.code).toBe('VALIDATION_ERROR');
  expect(e.field).toBe('email');
  expect(e.name).toBe('FormValidationError');
  ```

### [INFO] e2e 테스트(케이스 G)에서 `nodeId` body 값과 검증 경로 간 관계가 테스트 내 주석으로 명시되지 않음
- 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` lines 3370–3410
- 상세: e2e 테스트 G 는 `formNodeId` 를 DB 에 직접 삽입하고 `submit_form` body 에 `nodeId: formNodeId` 를 포함한다. 그런데 `assertFormSubmissionValid` 는 body 의 `nodeId` 를 직접 사용하지 않고 `resolveWaitingNodeExecutionId` 가 반환한 `nodeExecutionId` 로부터 `nodeExecution.nodeId` 를 조회한다. e2e 에서 `node_execution` 을 `formNodeId` 와 연결해서 삽입하므로 경로는 정합하지만, body `nodeId` 자체가 검증에 영향을 주지 않는다는 사실이 테스트 내에 명시되어 있지 않다. 향후 유지보수자가 `nodeId` 값이 검증 결과에 영향을 준다고 잘못 이해할 수 있다.
- 제안: e2e 테스트 G 에 주석 한 줄 추가: `// nodeId body 는 assertNodeId 유무 검사만 — 실제 field lookup 은 node_execution row 의 nodeId 가 결정한다.`

## 요약

이번 변경의 핵심은 `continueExecution` publisher 측에 form field 동기 검증(`assertFormSubmissionValid`)을 추가하고 `FormValidationError` 신규 에러 타입을 도입한 것이다. `interaction.service.spec.ts` 에 EIA 경로의 `FormValidationError → 400` 변환 테스트 1건이 추가되었고 e2e 케이스 G 도 실 DB 경유로 end-to-end 를 커버한다. 그러나 검증 로직의 핵심인 `assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue` 3개 메서드는 `execution-engine.service.spec.ts` 에서 단위 테스트로 직접 커버되지 않는다 — `mockNodeRepo.findOneBy` 기본값이 `null` 이어서 기존 테스트 전부가 검증 코드 경로를 우회하기 때문이다. 또한 `executions.controller.spec.ts` 에 `FormValidationError → BadRequestException` 변환 케이스가 없어 REST 진입점의 controller 레이어 변환 로직이 unit test 로 보호받지 못한다. e2e 가 최종 통합을 커버하나 회귀 탐지 속도와 정밀도 면에서 두 개의 WARNING 에 해당하는 단위 테스트 보강이 필요하다.

## 위험도

MEDIUM
