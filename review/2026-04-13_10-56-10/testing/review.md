## 발견사항

### [WARNING] WorkflowsController - 새로운 파라미터 해석 로직에 테스트 없음
- **위치**: `workflows.controller.ts:102-160`
- **상세**: `loadTriggerParameterSchema()`, `resolveTriggerParameters()` 호출, `TriggerParameterValidationException → BadRequestException` 변환 로직이 추가되었으나 컨트롤러 테스트 파일이 존재하지 않음. `rawValues` 추출의 3-레벨 fallback(`parameterValues` → `input.parameters` → `{}`) 경로도 미검증.
- **제안**: `WorkflowsController` 단위 테스트 작성. 특히 `parameterValues` 우선, `input.parameters` 폴백, 유효성 검증 실패 시 400 응답 케이스 커버 필요.

### [WARNING] `loadTriggerParameterSchema` 3중 중복 - 각 복사본 독립 테스트 필요
- **위치**: `hooks.service.ts`, `schedule-runner.service.ts`, `workflows.controller.ts`
- **상세**: 동일한 private 메서드가 세 곳에 복사됨. `hooks.service.spec.ts`에는 노드가 없는 경우(null), 스키마가 유효하지 않은 경우(schemaErrors 발생 시 `undefined` 반환) 테스트가 없음. `ScheduleRunnerService`의 동일 메서드도 별도 테스트 없음.
- **제안**: 각 서비스 테스트에 `loadTriggerParameterSchema`의 null 노드, 잘못된 스키마 케이스 추가.

### [WARNING] `SchedulesService.runNow()` 변경사항 미테스트
- **위치**: `schedules.service.ts:198-210`
- **상세**: `runNow()`에서 `resolveScheduleParameters()` 호출 후 `{ parameters }` 형태로 실행하는 새 로직이 추가됐으나, `schedules.service.spec.ts`(기존 파일)에 이 경로에 대한 테스트가 없음.
- **제안**: `schedules.service.spec.ts`에 `runNow()`에서 파라미터가 올바르게 전달되는지, `resolveScheduleParameters`가 호출되는지 테스트 추가.

### [WARNING] `resolve-trigger-parameters.spec.ts` - `fail()` 사용은 불안정
- **위치**: `resolve-trigger-parameters.spec.ts:45, 63`
- **상세**: `fail('expected exception')`은 Jest에서만 동작하는 전역 함수. 테스트 환경 이동 시 동작이 보장되지 않음.
- **제안**: `expect.assertions(N)` + `try/catch` 또는 `await expect(...).rejects.toBeInstanceOf(...)` 패턴으로 교체.

### [WARNING] `expression-resolver.service.spec.ts` - `$params` 경계값 미테스트
- **위치**: `expression-resolver.service.spec.ts`
- **상세**: `paramsFromInput` 추출 로직에서 `parameters`가 배열인 경우(`[1,2,3]`), 원시값인 경우(`"string"`, `42`), null인 경우 → 모두 `{}`를 반환해야 하지만 테스트 없음.
- **제안**: 다음 케이스 추가:
  ```ts
  it('returns {} for $params when parameters is an array', () => {
    const ctx = service.buildExpressionContext({ parameters: [1,2,3] }, ...);
    expect(ctx.$params).toEqual({});
  });
  ```

### [WARNING] `schedule-runner.service.spec.ts` - required 파라미터 누락 시 폴백 미테스트
- **위치**: `schedule-runner.service.ts:74-83`
- **상세**: `TriggerParameterValidationException` catch 후 schema-less resolver로 폴백하는 경로가 테스트되지 않음. 이 경로는 스케줄이 required 파라미터를 누락한 채로 실행될 때 발생하는 실제 운영 시나리오.
- **제안**: required 파라미터가 스키마에 있지만 `parameterValues`에 없는 케이스 추가.

### [WARNING] `schedule-runner.service.spec.ts` - 표현식 평가 실패 폴백 미테스트
- **위치**: `schedule-runner.service.ts:87-97` (`resolveLimitedExpression`)
- **상세**: `evaluate()` 실패 시 원본 값을 반환하는 경로가 테스트되지 않음.
- **제안**: 잘못된 표현식(`{{ $unknown.deep.path }}`)으로 호출 시 원본 문자열이 반환되는지 테스트 추가.

### [WARNING] `hooks.service.spec.ts` - `coerce_failed` 케이스 미테스트
- **위치**: `hooks.service.spec.ts`
- **상세**: `missing_required` 400 케이스는 있으나, `coerce_failed`(예: `amount: 'not-a-number'`) 케이스에서도 400이 반환되는지 테스트 없음.
- **제안**: `{ amount: 'not-a-number' }` body로 호출 시 `coerce_failed` 에러가 포함된 400 응답 테스트 추가.

### [INFO] `coerce-type.spec.ts` - 일부 폴백 경로 미커버
- **위치**: `coerce-type.ts`
- **상세**: `array` 타입 - JSON 파싱은 성공했지만 결과가 배열이 아닌 경우(예: `'[1,2,3'` → 파싱 실패 후 원본 반환), `boolean` 타입 - `0`/숫자 값 처리, `object` 타입 - 중첩 null 처리 미테스트.
- **제안**: 폴백 경로 케이스 보강.

### [INFO] `trigger-configs.test.tsx` - type 변경 및 defaultValue 가시성 테스트 누락
- **위치**: `trigger-configs.test.tsx`
- **상세**: select 드롭다운 type 변경 테스트 없음. "toggles required on and hides default input" 테스트가 `onChange` 호출만 확인하고 실제 DOM에서 defaultValue 입력이 사라지는지는 확인하지 않음(리렌더링 미반영).
- **제안**: `required=true` prop으로 렌더링 후 defaultValue 입력 element가 없는지 `queryByPlaceholderText('Default value')` 확인 추가.

### [INFO] `WorkflowsController` - Repository 직접 주입 테스트 용이성 저하
- **위치**: `workflows.controller.ts:38-41`
- **상세**: 컨트롤러가 `@InjectRepository(Node)`를 직접 주입받는 구조는 안티패턴. 컨트롤러 테스트 시 TypeORM 모킹 보일러플레이트가 추가됨.
- **제안**: `loadTriggerParameterSchema` 로직을 공유 서비스(예: `TriggerParameterService`)로 추출하면 세 곳의 중복 제거와 테스트 용이성 동시 해결.

---

## 요약

신규 트리거 파라미터 기능은 핵심 유틸리티(`coerce-type`, `resolve-trigger-parameters`), 핸들러(`manual-trigger`), 서비스(`hooks`, `schedule-runner`) 레이어에 단위 테스트가 충실히 작성되어 있다. 그러나 **`WorkflowsController`의 새 파라미터 해석 로직 전체가 무테스트 상태**이며, `loadTriggerParameterSchema`의 3중 복사와 `SchedulesService.runNow()` 변경도 미검증이다. 이는 수동 실행 API 경로에서 파라미터 검증 오류가 조용히 통과되거나 500으로 잘못 처리될 위험을 내포한다. 스케줄의 required 파라미터 누락 폴백 경로와 표현식 평가 실패 경로도 테스트되어야 운영 시 예상치 못한 동작을 방지할 수 있다.

## 위험도

**MEDIUM** — 유틸리티 계층은 잘 테스트되어 있으나, 진입점인 `WorkflowsController`의 미테스트 파라미터 해석 로직이 운영 환경 회귀 위험으로 남아있다.