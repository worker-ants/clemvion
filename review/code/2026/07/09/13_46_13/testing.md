### 발견사항

- **[WARNING]** 핵심 수정(재진입 durable input) 3개 호출부 중 2개(`driveResumeAwaited`, `driveResumeFrame`)는 이 fix 를 직접 검증하는 테스트가 하나도 없다 — 회귀해도 기존 스위트가 잡지 못함
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 신규 `reentryWorkflowInput`(L1471-1483) 및 3개 호출부(L2102 `driveResumeAwaited`, L2434 `driveResumeFrame`, L3216 `driveStuckRedrive`)
  - 상세: 신규 e2e(`codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` 3번째 `it`)는 `_test/simulate-execution-run-redelivery` 훅으로 `driveStuckRedrive` 경로(§7.5 case B)만 결정적으로 재현·검증한다. 나머지 두 호출부 `driveResumeAwaited`(form/버튼/AI 단일 turn 재개)와 `driveResumeFrame`(call-stack/nested AI 재개)에 대해서는 unit·e2e 어느 쪽에도 이번 fix 를 겨냥한 검증이 없다. `execution-engine.service.spec.ts`(16000+ 줄)에 이 두 함수를 다루는 기존 테스트가 다수 있지만(예: L12906-12961 `rehydrateAndResume` 버튼 재개, L13538+ `driveResumeFrame` 계열), 전부 `runNodeDispatchLoop` 를 `jest.fn().mockResolvedValue(...)` 로 완전히 스텁하고 `toHaveBeenCalledTimes(...)` 만 검증할 뿐 `input` 인자는 한 번도 assert 하지 않는다(`grep "runNodeDispatchLoop).toHaveBeenCalledWith"` 매치 0건). 즉 향후 누군가 이 두 호출부의 `input: this.reentryWorkflowInput(savedExecution)` 를 실수로 `input: {}` 로 되돌려도(정확히 이번에 고친 버그가 재발해도) 기존 스위트는 통과한다. `reentryWorkflowInput` private 헬퍼 자체를 직접 호출하는 단위 테스트도 없다(`grep -rn "reentryWorkflowInput" codebase/backend/src` → 정의·호출부만, 테스트 매치 0건).
  - 제안: (a) `reentryWorkflowInput(savedExecution)` 을 순수 함수로 직접 단위 테스트(`inputData` 있음/undefined/null 세 케이스, `?? {}` fallback 확인). (b) 최소 하나의 기존 `driveResumeAwaited`/`driveResumeFrame` 목 테스트에 `expect(runNodeDispatchLoop).toHaveBeenCalledWith(expect.objectContaining({ input: savedExecution.inputData }))` 형태의 인자 검증을 추가해 회귀를 잡을 수 있게 한다.

- **[INFO]** `retry-turn.service.ts` 의 "의도적 예외"(`input: {}` 유지)를 고정하는 회귀 테스트가 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` L565-577 (`resumeGraphAfterRetry` → `driver.runNodeDispatchLoop`), `retry-turn.service.spec.ts`
  - 상세: 신규 주석은 이 4번째 구조적 동일 호출부만 `savedExecution.inputData` 를 쓰지 않는 이유를 설명하지만, `retry-turn.service.spec.ts` 는 (다른 3곳과 동일하게) `runNodeDispatchLoop` 를 `jest.fn().mockResolvedValue({ parked: false })` 로 스텁만 하고 `input` 인자를 검증하지 않는다(L82, 이후 `not.toHaveBeenCalled()` 어서션만 존재). 이번 diff 가 스스로 "구조적으로 동일한 4번째 호출부" 라고 지목한 지점이라, 향후 일관성을 맞추려는 리팩터링(maintainability 리뷰의 헬퍼 추출 제안 등)이 실수로 이 경로까지 `reentryWorkflowInput` 로 통일해버려도 어떤 테스트도 실패하지 않는다.
  - 제안: `resumeGraphAfterRetry` 관련 기존 목 테스트 중 하나에 `expect(mockDriver.runNodeDispatchLoop).toHaveBeenCalledWith(expect.objectContaining({ input: {} }))` 를 추가해 "AI retry 경로는 의도적으로 `{}` 를 유지한다"는 불변식을 코드로 고정.

- **[INFO]** `workflows.service.spec.ts` 신규 400 테스트가 `details[]` 페이로드 내용을 검증하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` "should reject a trigger with a malformed parameter definition" (L497-524), 대응 e2e `manual-trigger-default-param.e2e-spec.ts` L283-311
  - 상세: 두 테스트 모두 `code: 'INVALID_TRIGGER_PARAMETERS'` 최상위 코드만 확인하고 `details[]`(필드별 code/message) 는 확인하지 않는다. `toTriggerParameterErrorDetails`/`validateTriggerParameterSchema` 자체는 `resolve-trigger-parameters.spec.ts` 에 이미 단위 테스트가 있어 함수 단위 회귀 위험은 낮지만, `workflows.service.ts` 의 새 조립 지점(`validateManualTrigger` → `toTriggerParameterErrorDetails(errors)` → `BadRequestException` payload)이 실제로 `details` 를 올바르게 전달하는지는 이 diff 의 테스트만으로는 확인되지 않는다.
  - 제안: 우선순위 낮음. 시간 여유 시 한 테스트에서 `details: [expect.objectContaining({ field: 'parameters[1].name', ... })]` 수준까지 assert 하면 조립 지점 자체의 회귀도 잡힌다.

- **[INFO]** 프론트 `PARAM_NAME_RE`(FE)와 백엔드 식별자 정규식(`resolve-trigger-parameters.ts:77`) 간 drift 를 잡는 계약(parity) 테스트가 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:15` vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77`
  - 상세: architecture 리뷰가 이미 "SoT 부재"(중복 하드코딩)를 WARNING 으로 지적했다. 테스트 관점에서 보완하면: 현재는 두 리터럴이 우연히 동일(`/^[A-Za-z_][A-Za-z0-9_]*$/`)하고 각자 독립적으로 단위 테스트(`trigger-configs.test.tsx`의 "my region" 케이스, 백엔드 `resolve-trigger-parameters.spec.ts`)가 있지만, 두 값이 서로 일치한다는 것 자체를 assert 하는 테스트는 없다. 공유 패키지로 추출하기 전 임시 완화책으로도 유용하다.
  - 제안: 패키지 공유 리팩터링 전 임시 조치로, 한쪽 스펙 파일에서 다른 쪽 정규식 소스를 import 해 `toEqual`(정규식 소스 문자열 비교)하는 parity 테스트를 추가하면 drift 를 즉시 잡을 수 있다. 우선순위 낮음(근본 해결은 공유 패키지 추출).

- **[INFO]** 신규 e2e·unit 테스트 자체의 구조·격리·가독성은 양호
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` 전체, `load-trigger-parameter-schema.spec.ts`, `workflows.service.spec.ts` 신규 4건, `trigger-configs.test.tsx` 신규 4건
  - 상세: e2e 는 매 `it` 마다 `setupGraph()`로 새 workflow 를 만들어 테스트 간 상태 공유가 없고(workspace 만 `beforeAll` 공유, 워크플로 단위로는 격리), "explicit override", "durable re-entry", "malformed reject" 3가지 독립 시나리오를 명확한 이름으로 분리했다. 특히 3번째 테스트는 타이밍 의존적 flaky 재현(단일 노드 그래프가 너무 빨리 끝나 stalled-redelivery 를 우연히 유발하길 기다리는 방식) 대신 DB 를 직접 조작해 "트리거 실행 전 크래시"를 결정적으로 합성한 점이 우수하다. `load-trigger-parameter-schema.spec.ts`는 "category 누락 매뉴얼 트리거를 찾아야 한다"는 이번 fix 의 정확한 회귀 시나리오를 mock 으로 명확히 재현한다. `workflows.service.spec.ts`/`trigger-configs.test.tsx` 신규 케이스들도 각각 독립 `render`/mock 으로 실행되어 격리 문제가 없다.
  - 제안: 조치 불필요(참고).

### 요약

Manual Trigger `defaultValue` 버그의 3가지 근본원인 중 (b) 조회 방식과 (a)/(c) 유효성 검증·프론트 표시 hardening 은 unit(백엔드 `load-trigger-parameter-schema.spec.ts`/`workflows.service.spec.ts`, 프론트 `trigger-configs.test.tsx`)과 e2e(`manual-trigger-default-param.e2e-spec.ts`)로 잘 커버되며, 테스트 자체의 격리·가독성·시나리오 설계(특히 결정적 크래시 합성)도 우수하다. 다만 plan 문서가 스스로 "진짜 핵심"이라 지목한 재진입 durable-input 수정(3개 호출부)은 e2e 가 그중 `driveStuckRedrive` 1곳만 결정적으로 검증하고, 구조적으로 동일한 `driveResumeAwaited`/`driveResumeFrame`(및 의도적으로 다르게 남긴 4번째 `retry-turn.service.ts` 호출부)은 기존 스위트가 `runNodeDispatchLoop` 를 통째로 스텁하며 `input` 인자를 한 번도 assert 하지 않아, 이 2~3개 지점에서 향후 동일 버그가 재발해도 테스트가 잡아내지 못하는 회귀 방지 공백이 남아 있다. 이는 코드 수정 자체의 정확성 문제가 아니라 "고친 것을 앞으로도 고친 채로 유지시키는" 안전망의 공백이다.

### 위험도

MEDIUM
