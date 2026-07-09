# 테스트(Testing) 리뷰 — Manual Trigger `defaultValue` 무시 버그 수정

## 발견사항

- **[CRITICAL]** "진짜 핵심" 근본원인 수정(재진입 시 durable input 전달)에 결정적 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (3곳: `driveResumeAwaited`/`driveResumeFrame` 재진입 호출부 ~L2067-2083, ~L2408-2414, `driveStuckRedrive` 재구동 호출부 ~L3188-3196), 대응 신규 e2e `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts`
  - 상세: plan(`plan/in-progress/manual-trigger-default-param.md`)이 이 fix 를 "(c) 엔진 재진입 input 소실 [진짜 핵심]" 이라고 명시할 만큼 이 PR 의 핵심 버그다. 그런데:
    - **Unit**: `execution-engine.service.spec.ts` 에서 `driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive` 를 구동하는 기존 테스트들은 전부 `runNodeDispatchLoop` 자체를 `jest.fn().mockResolvedValue({parked:false})` 로 완전히 대체한다(예: L12929, L13026, L13125). 즉 실제 `input: savedExecution.inputData ?? {}` 계산 로직 자체가 테스트 대상 코드 경로에서 실행되지 않고, 그 호출 인자(`input`)를 검증하는 `toHaveBeenCalledWith` 도 전무하다(`grep` 결과 0건). 이 상태에서 누군가 `input: {}` 로 되돌려도(정확히 이번에 고친 버그를 재도입해도) 어떤 unit 테스트도 실패하지 않는다.
    - **E2E**: 신규 `manual-trigger-default-param.e2e-spec.ts` 는 정상 1-shot 실행 경로(save→execute→poll)만 검증한다. 파일 상단 주석이 명시하듯 "단일 노드 워크플로우는 실행이 너무 빨라 stalled-redelivery 를 유발"하는 것을 **의도적으로 피하기 위해** trigger→transform 2노드 그래프를 쓴다 — 즉 이 테스트는 `driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive` 재진입 경로를 전혀 거치지 않는다(정상 완주라 재진입 자체가 발생하지 않음).
    - **기존 redrive e2e 스위트** (`execution-crash-redrive.e2e-spec.ts`, `execution-stalled-redelivery.e2e-spec.ts`) 는 둘 다 "trigger·codeA 는 이미 완료된 뒤 codeB 직전에 크래시"를 합성한다(주석에 명시) — 즉 재진입 시점에 **트리거 노드는 이미 완료 상태**라 이번 fix 가 다루는 "미완료 진입 노드가 재진입에서 빈 input 을 받는" 케이스를 커버하지 않는다. 게다가 두 스위트의 manual_trigger 노드 모두 `config.parameters` 자체가 없다(grep 확인) — `output.parameters` 를 애초에 검증하지 않는다.
  - 결론: unit·신규 e2e·기존 redrive e2e 세 갈래 모두 이 fix 의 정확한 시나리오(**미완료 상태의 Manual Trigger 가 durable input 으로 재진입해 `output.parameters` 를 올바르게 산출**)를 결정적으로 재현/검증하지 않는다. 이 버그는 plan 문서에 따르면 이미 한 번 실측 재현을 거쳐서야 발견됐고("e2e 로 밝힌 최종 근본원인") 재도입 시 이를 잡아줄 자동화 게이트가 없다.
  - 제안: `execution-stalled-redelivery.e2e-spec.ts` 가 쓰는 `_test/simulate-execution-run-redelivery` 훅 패턴을 재사용해, **트리거 노드 자체가 아직 완료되지 않은 시점**(예: 트리거에 `parameters` 설정 + dispatch 직후 즉시 redrive 유발)에 재진입시켜 `output.parameters` 가 살아남는지 확인하는 e2e 케이스를 추가하거나, 최소한 `execution-engine.service.spec.ts` 에 `runNodeDispatchLoop` 를 spy(전체 mock 아님)로 잡아 세 호출부 각각이 `input: savedExecution.inputData` 를 넘기는지 assert 하는 저비용 unit 테스트를 추가할 것.

- **[WARNING]** `driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive` 호출부의 `input` 인자를 검증하는 unit assertion 자체가 아예 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
  - 상세: 위 CRITICAL 항목의 unit 측면만 분리하면 — `svcAny.runNodeDispatchLoop = jest.fn().mockResolvedValue(...)` 형태로 메서드 전체를 스텁하는 기존 패턴이 반복돼, 호출 인자 검증이 구조적으로 어렵지 않음에도(스텁을 `jest.fn()` 대신 `jest.spyOn(svcAny, 'runNodeDispatchLoop')` 로 바꾸고 `mockImplementation` 안에서 `expect(arg.input).toEqual(savedExecution.inputData)` 하면 됨) 이번 PR 이 그 기회를 놓쳤다.
  - 제안: 최소 1개 케이스에서 `toHaveBeenCalledWith(expect.objectContaining({ input: <savedExecution.inputData> }))` 형태의 assertion 추가.

- **[INFO]** `retry-turn.service.ts` 는 의도적으로 미수정 — 테스트 추가 불필요, 근거 확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (교차 주석만 추가, 동작 변경 없음)
  - 상세: RESOLUTION.md(W8)에 문서화된 대로 AI multi-turn retry 경로는 트리거 재실행이 없어 이 fallback 이 실사용되지 않는다는 설명이 타당하다. 순수 주석 diff라 회귀 테스트 불필요 — 기존 `retry-turn.service.spec.ts` 는 그대로 유효.

- **[INFO]** `workflows.service.spec.ts` 신규 400 케이스가 `details[]` 배열의 필드/코드 내용을 검증하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` L326-357 (`should reject a trigger with a malformed parameter definition`)
  - 상세: `rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_TRIGGER_PARAMETERS' }) })` 만 확인하고 `details` 의 `field`/`code`(`INVALID_SCHEMA` 등) 매핑은 검증하지 않는다. `toTriggerParameterErrorDetails` 자체는 `resolve-trigger-parameters.spec.ts` 에서 이미 유닛 커버되므로 중대 갭은 아니지만, 이 신규 호출부(`workflows.service.ts` L529-537)가 정확한 `errors` 배열을 넘기는지는 code 필드 하나로만 간접 확인된다. e2e(`manual-trigger-default-param.e2e-spec.ts` L223)도 `save.body.error?.code` 만 확인해 동일한 얕음이 반복된다.
  - 제안: 최소 하나의 테스트에서 `response.details` 에 `{ field: '[1]', code: 'INVALID_SCHEMA', ... }` 형태가 담기는지 확인하면 저장 시점 에러 봉투 계약이 더 견고해진다.

- **[INFO]** 프론트 `trigger-configs.test.tsx` 의 중복 이름 케이스가 느슨한 assertion
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/trigger-configs.test.tsx` L704-719 (`flags duplicate parameter names`)
  - 상세: `screen.getAllByText(/Parameter name is duplicated/i).length).toBeGreaterThan(0)` 는 "적어도 하나" 만 확인 — 두 슬롯 모두 에러가 뜨는지, 혹은 정확히 2개인지 구분하지 못한다. `nameCounts` 로직이 카운트를 잘못 계산해도(예: off-by-one) 이 테스트는 여전히 통과할 수 있다.
  - 제안: `.toBe(2)` 로 강화하거나 각 slot 의 error 텍스트를 개별 조회.

- **[INFO]** `load-trigger-parameter-schema.spec.ts` 는 `Repository<Node>` 를 얇은 `{ findOne }` fake 로 대체 — 적절한 설계
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.spec.ts`, 대응 소스 `load-trigger-parameter-schema.ts` L28-31 (`Pick<Repository<Node>, 'findOne'>` 시그니처)
  - 상세: 함수 시그니처가 처음부터 `Pick<...>` 로 좁혀져 있어 TypeORM 전체를 mock 할 필요 없이 `{ findOne: jest.fn() } as any` 로 격리 테스트가 가능하다 — 테스트 용이성 관점에서 긍정적 사례. `type` 조회로 바뀐 것도 정확히 `expect(findOne).toHaveBeenCalledWith({ where: { workflowId: 'wf', type: NODE_TYPES.MANUAL_TRIGGER } })` 로 하드코딩 문자열이 아닌 상수 참조로 검증돼 drift 에 안전하다. 회귀 방지용 "category 누락 노드" 케이스(L177-189)도 실제 버그 시나리오를 정확히 재현한다.

- **[INFO]** `restoreVersion`→`saveCanvas(..., true)` 배선 변경은 기존 테스트가 정확히 회귀 검증
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` L1356-1400 (`should reapply snapshot via saveCanvas with "Restored from vN" summary`, `saveCanvasSpy.toHaveBeenCalledWith(...)`)
  - 상세: diff 는 이 기존 스펙에 `true,` 인자를 추가해 실제 호출 인자를 spy 로 검증하며, 별도로 malformed 스냅샷 복원이 400 을 던지지 않는 신규 케이스(L1402-1438)도 추가돼 `skipParamSchemaValidation` 비대칭 동작이 양방향(정상/예외 데이터)으로 커버된다. 좋은 회귀 테스트.

## 요약

새로 추가된 unit 테스트(`load-trigger-parameter-schema.spec.ts`, `workflows.service.spec.ts` 확장, `trigger-configs.test.tsx` 확장)와 신규 e2e(`manual-trigger-default-param.e2e-spec.ts`)는 "(b) 트리거 조회를 `type` 기준으로" fix 와 "저장 시점 파라미터 스키마 검증" hardening 을 각각 견고하게 커버하며, mock 사용·테스트 격리·가독성도 전반적으로 양호하다. 그러나 plan 문서 스스로 "진짜 핵심"이라고 지목한 (c) 엔진 재진입 시 durable input 전달 fix — `execution-engine.service.ts` 의 3개 재진입/redrive 호출부 — 는 unit 테스트에서 `runNodeDispatchLoop` 가 통째로 mock 되어 실제 로직이 실행되지 않고, 신규 e2e 는 (주석에 명시된 대로) 재진입 경로 자체를 의도적으로 피해가며, 기존 crash-redrive/stalled-redelivery e2e 스위트는 트리거가 이미 완료된 뒤의 크래시만 합성해 이번 버그의 정확한 조건(미완료 진입 노드의 재진입)을 재현하지 않는다. 결과적으로 이 PR 의 가장 중요한 fix 는 회귀를 감지할 자동화 게이트가 없는 상태로 머지된다.

## 위험도

HIGH
