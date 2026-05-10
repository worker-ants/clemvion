### 발견사항

- **[WARNING]** `TRIGGER_SOURCE_INPUT_KEY` 상수가 사용처 없이 export만 됨
  - 위치: `manual-trigger.handler.ts:22` — `export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'`
  - 상세: 이 상수를 export하면서 정작 4개의 어댑터(`hooks.service.ts`, `schedule-runner.service.ts`, `schedules.service.ts`, `workflows.controller.ts`)는 모두 `'__triggerSource'`를 string literal로 직접 사용한다. 상수를 import하는 파일이 없으므로 키 이름이 handler 쪽에서만 바뀌면 모든 어댑터가 silently 깨진다 — 상수를 export한 이유가 없어진다.
  - 제안: 어댑터들이 `TRIGGER_SOURCE_INPUT_KEY`를 import해 사용하거나, 반대로 상수 export를 제거하고 handler 내부에서만 사용하는 private 심볼로 유지.

- **[WARNING]** `TriggerSource` 유니언 타입이 handler 내부에만 정의되어 어댑터 경계를 넘어가지 않음
  - 위치: `manual-trigger.handler.ts:20` — `type TriggerSource = 'manual' | 'webhook' | 'schedule'`
  - 상세: 어댑터들은 이 타입을 참조하지 않고 raw string(`'webhook'`, `'schedule'`)을 사용한다. `workflows.controller.ts`만 `'manual' as const`를 붙였고 나머지는 `as const`도 없어 타입 수준에서 오탈자가 있어도 컴파일 오류가 나지 않는다.
  - 제안: `TriggerSource`와 `TRIGGER_SOURCE_INPUT_KEY`를 `execution-engine/types/trigger-source.types.ts` 같은 공유 위치에 두고 handler와 adapter 양쪽이 import하도록 분리.

- **[INFO]** 새 외부 패키지 의존성 없음
  - 이번 변경은 신규 npm 패키지를 추가하지 않는다. 모든 변경은 기존 내부 모듈(`@nestjs/*`, `typeorm`, `bullmq`, `crypto`)의 기존 API 범위 내에서 이루어졌다.

- **[INFO]** 내부 모듈 의존 방향이 올바름
  - handler(`nodes/trigger/`) → execution-engine types (`modules/execution-engine/types/`) 방향은 유지되었고, 역방향(execution-engine → handler) 참조는 없다. 어댑터(hooks/schedules/workflows)가 handler 모듈을 직접 import하지 않으므로 계층 순환 의존도 없다.

---

### 요약

이번 변경은 새로운 외부 패키지를 도입하지 않아 의존성 크기·라이선스·보안 취약점 측면에서 위험이 없다. 주요 의존성 문제는 내부 설계 수준으로, `TRIGGER_SOURCE_INPUT_KEY`가 export되었으나 실제로 import하는 어댑터가 하나도 없어 상수와 4개 string literal 간의 drift를 컴파일러가 잡아줄 수 없다는 점이다. `TriggerSource` 타입도 마찬가지로 handler 내부에만 갇혀 있어 어댑터가 잘못된 값을 전달해도 타입 에러가 발생하지 않는다. 두 심볼을 공유 위치로 추출해 어댑터들이 import하도록 하면 이 취약점이 해소된다.

### 위험도

**LOW**