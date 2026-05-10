### 발견사항

- **[INFO]** `detectTriggerSource` 폴백 탐지의 `in` 연산자
  - 위치: `manual-trigger.handler.ts` — `detectTriggerSource()` 내 `TRANSPORT_KEYS.some((k) => k in input)`
  - 상세: `TRANSPORT_KEYS`가 4개 고정 요소이므로 실질적으로 O(1). `in` 연산자는 프로토타입 체인을 순회하지만 plain object이므로 체인이 짧아 영향 없음. 정상 경로에서는 마커가 항상 존재하므로 이 분기 자체가 실행되지 않음.
  - 제안: 현 구조로 충분. 변경 불필요.

- **[INFO] (개선)** 구 코드의 spread 제거로 메모리 할당 감소
  - 위치: `manual-trigger.handler.ts` — `execute()` 내 output 구성
  - 상세: 구 코드 `const { parameters: _omit, ...rest } = typedInput ?? {}` 는 input의 모든 키(대형 webhook body/headers 포함)를 `rest` 객체에 복사했음. 신 코드는 `output.request`에 4개 필드만 명시적으로 참조하므로 전체 입력 객체 복사를 피함. 대형 webhook payload에서는 실질적인 개선.
  - 제안: 현 코드가 우수함.

- **[INFO]** `output.request` 조건부 할당
  - 위치: `manual-trigger.handler.ts` — `execute()` 내 `if (source === 'webhook' && typedInput)`
  - 상세: webhook 경로에서만 4-필드 객체를 생성. manual/schedule 경로에서는 추가 할당 없음. 올바른 조건부 할당 패턴.
  - 제안: 현 코드가 우수함.

- **[INFO]** `TRIGGER_SOURCE_INPUT_KEY` 상수 미활용
  - 위치: `manual-trigger.handler.ts` L21 — 상수 export, 어댑터 3곳(`hooks.service.ts`, `schedule-runner.service.ts`, `schedules.service.ts`, `workflows.controller.ts`)은 문자열 리터럴 `'webhook'`/`'schedule'`/`'manual'`을 직접 사용
  - 상세: 성능 문제는 아니나, 마커 키 이름(`__triggerSource`) 변경 시 어댑터에서 누락될 수 있는 일관성 갭. 런타임에는 fallback 탐지가 동작하므로 실제 오동작 가능성은 낮음.
  - 제안: 어댑터에서 `TRIGGER_SOURCE_INPUT_KEY`를 import하여 사용하거나, 상수 export를 제거하고 내부 전용으로 유지.

- **[INFO]** `Promise.resolve()` 래핑
  - 위치: `manual-trigger.handler.ts` — `execute()` 반환
  - 상세: 동기 연산 결과를 `Promise.resolve()`로 감싸 불필요한 마이크로태스크를 생성. 단, 이는 기존 코드 패턴이며 이번 변경에서 도입된 것이 아님. 핸들러 인터페이스가 `Promise<NodeHandlerOutput>`를 요구하므로 구조적 한계.
  - 제안: 현 상황에서 변경 불필요.

---

### 요약

이번 변경은 `__triggerSource` 마커를 각 어댑터의 객체 리터럴에 필드 하나 추가하는 수준의 오버헤드만 발생시킨다. 오히려 핸들러 측에서는 기존의 `{ parameters: _omit, ...rest }` spread 패턴을 제거하고 4개 필드만 명시적으로 참조하는 방식으로 전환하여, 대형 webhook payload 처리 시 불필요한 전체 객체 복사를 피하는 미세한 개선이 있다. `detectTriggerSource`의 폴백 탐지는 4개 고정 키에 대한 O(1) 연산이며, 정상 경로에서는 마커가 항상 존재하므로 실행되지 않는다. 기능 변경의 규모 대비 성능 영향은 무시 가능한 수준이다.

### 위험도

**NONE**