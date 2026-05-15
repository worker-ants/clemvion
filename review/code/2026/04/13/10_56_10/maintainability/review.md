## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `loadTriggerParameterSchema` 로직 3곳 중복**
- 위치: `hooks.service.ts:105-124`, `schedule-runner.service.ts:95-104`, `workflows.controller.ts:143-152`
- 상세: 동일한 "trigger 노드 조회 → config.parameters 추출 → validateTriggerParameterSchema → 반환" 패턴이 세 곳에 복사되어 있습니다. 스키마 조회 방식이 바뀌거나 노드 타입이 추가되면 세 파일을 모두 수정해야 합니다.
- 제안: `ExecutionEngineModule`에서 이미 export하는 `ExpressionResolverService`처럼, 해당 로직을 `TriggerParameterService` 또는 `resolve-trigger-parameters` 유틸 함수(`loadTriggerParameterSchema(nodeRepo, workflowId)`)로 추출하여 단일 소스로 관리하세요.

---

**[WARNING] `WorkflowsController`에 Repository 직접 주입 — 계층 위반**
- 위치: `workflows.controller.ts:38-41`
- 상세: Controller에 `@InjectRepository(Node)`가 있습니다. NestJS 레이어 아키텍처에서 Controller는 Service를 통해 데이터를 조회해야 합니다. Service 계층을 우회하면 트랜잭션, 권한 검사, 캐싱 등 서비스 레이어 횡단 관심사를 Controller가 인지하거나 우회하게 됩니다.
- 제안: `WorkflowsService` 또는 별도 `TriggerParameterService`에 `loadTriggerParameterSchema` 메서드를 두고 Controller는 그것을 호출하세요.

---

**[WARNING] 복잡한 인라인 타입 가드 중복 (`inputObject && typeof inputObject === 'object' && ...`)**
- 위치: `expression-resolver.service.ts:70-78`, `manual-trigger.handler.ts:52-57`, `manual-trigger.handler.ts:59-63`
- 상세: "값이 존재하고 객체이며 배열이 아님"을 확인하는 동일한 3-조건 가드가 세 곳에 인라인으로 작성되어 있습니다. 논리가 미묘하게 다를 경우 버그를 추적하기 어렵습니다.
- 제안: `isPlainObject(value: unknown): value is Record<string, unknown>` 헬퍼를 `coerce-type.ts` 또는 별도 guard 유틸에 추출하세요.

---

**[WARNING] `manual-trigger.handler.ts`의 `void _omit` 패턴 — 의도 불명확**
- 위치: `manual-trigger.handler.ts:65-66`
- 상세: `const { parameters: _omit, ...rest } = typedInput ?? {}; void _omit;`은 destructuring으로 `parameters`를 제외하려는 의도이지만, `_omit` 변수를 선언 후 `void`로 억제하는 방식은 `eslint` 규칙을 우회하기 위한 임시방편처럼 보입니다. 코드 독자에게 혼란을 줍니다.
- 제안: eslint 설정에 `no-unused-vars: ["error", { "varsIgnorePattern": "^_" }]`가 있다면 `_omit` 접두어만으로 충분합니다. `void _omit` 라인은 제거하세요. 또는 `Object.fromEntries(Object.entries(typedInput).filter(([k]) => k !== 'parameters'))` 방식이 의도를 더 명확히 표현합니다.

---

**[INFO] `schedules/page.tsx`의 `textarea` — 커스텀 디자인 시스템 컴포넌트 미사용**
- 위치: `schedules/page.tsx:803-810`
- 상세: 다른 폼 요소들은 `<Input>`, `<Label>` 등 UI 컴포넌트를 사용하는데, 파라미터 값 입력만 raw `<textarea>`를 사용합니다. 스타일 클래스를 하드코딩하여 디자인 시스템과 불일치가 생깁니다.
- 제안: `Textarea` UI 컴포넌트가 있다면 사용하고, 없다면 추가하세요.

---

**[INFO] `editor-toolbar.tsx`의 `parameterValues` 추출 로직 — API 레이어에 있어야 할 변환이 컴포넌트에 위치**
- 위치: `editor-toolbar.tsx:104-107`
- 상세: `parsedInput.parameterValues ?? parsedInput.parameters`처럼 두 개의 키를 폴백으로 처리하는 back-compat 로직이 UI 컴포넌트에 있습니다. `workflows.ts` API 레이어 또는 훅으로 이동하면 컴포넌트 복잡도가 줄어듭니다.
- 제안: `workflowsApi.execute`의 옵션 타입 정의에 이 폴백 정규화를 포함시키거나, 별도 `normalizeRunInput()` 유틸로 추출하세요.

---

**[INFO] `schedule-runner.service.ts` — `resolveScheduleParameters`가 `public`이나 Service 인터페이스로 노출 의도인지 불명확**
- 위치: `schedule-runner.service.ts:43`
- 상세: 메서드를 `public`으로 표시한 이유가 테스트 용이성이라면 주석에 명시되어 있어 좋습니다. 그러나 `SchedulesService`에서도 직접 호출하고 있어 두 서비스 간 의존성이 생깁니다. 순환 의존 위험이 있습니다.
- 제안: `SchedulesService`가 `ScheduleRunnerService`에 의존하는 현재 구조를 문서화하거나, 파라미터 해석 로직을 두 서비스가 모두 사용하는 별도 서비스로 추출하는 것을 고려하세요.

---

**[INFO] `resolve-trigger-parameters.spec.ts` — `fail()` 전역 함수 사용**
- 위치: `resolve-trigger-parameters.spec.ts:50, 65`
- 상세: `fail('expected exception')`은 Jest의 global이지만 타입 정의가 불안정하며, 일부 환경에서 런타임 오류가 발생합니다. `expect.assertions(N)` 패턴이 더 명확하고 안전합니다.
- 제안:
  ```ts
  it('throws ...', async () => {
    expect.assertions(2);
    try { resolveTriggerParameters(...); }
    catch (err) { expect(err).toBeInstanceOf(...); ... }
  });
  ```

---

### 요약

이번 변경은 Manual Trigger 파라미터 스키마 기반 실행 파이프라인을 잘 구조화하였고, `coerce-type`, `resolve-trigger-parameters` 유틸 분리 및 타입 정의 파일 추가는 올바른 방향입니다. 그러나 `loadTriggerParameterSchema` 패턴이 Controller·HooksService·ScheduleRunnerService 세 곳에 그대로 복사되어 있어 가장 큰 유지보수 부채가 됩니다. 추가로 Controller가 Repository를 직접 주입받는 계층 위반, 반복되는 인라인 객체 타입 가드, UI 컴포넌트 불일치 등 중간 수준의 문제들이 있습니다. 핵심 로직의 중복을 단일 서비스/유틸로 통합하면 유지보수성이 크게 향상됩니다.

### 위험도

**MEDIUM**