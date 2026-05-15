## 발견사항

---

**[WARNING] `TRIGGER_SOURCE_INPUT_KEY` 상수가 export되었으나 어댑터 파일에서 임포트하지 않음**
- 위치: `manual-trigger.handler.ts:22`, `hooks.service.ts:96`, `schedule-runner.service.ts:162`, `schedules.service.ts:206`, `workflows.controller.ts:250`
- 상세: `export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'` 가 선언되었지만, 실제 마커를 사용하는 4개 어댑터는 모두 문자열 리터럴 `'__triggerSource'` 를 직접 하드코딩한다. 상수가 변경될 경우 어댑터는 자동으로 갱신되지 않아 핸들러가 마커를 인식하지 못하고 shape-based fallback으로 처리된다.
- 제안: 각 어댑터에서 `import { TRIGGER_SOURCE_INPUT_KEY } from '...manual-trigger.handler'` 로 임포트하여 사용하거나, 상수를 공용 위치(`execution-engine/types/`)로 이동해 단방향 의존 구조를 깨지 않도록 한다.

---

**[WARNING] `output.request` 필드값이 `undefined`일 수 있으나 spec은 `object` 타입으로 선언**
- 위치: `manual-trigger.handler.ts:130-135`
- 상세: webhook 출처가 감지되면 무조건 `output.request = { method, headers, query, body }` 를 구성하지만, `ManualTriggerInput` 의 4개 필드는 모두 `optional`(`?: unknown`)이다. 예를 들어 `{ __triggerSource: 'webhook', parameters: {}, method: 'GET' }` 입력 시 `headers`, `query`, `body` 는 모두 `undefined`가 된다. spec(`1-manual-trigger.md §5.2`)은 `output.request.headers` 를 `object` 타입으로 선언하여 모순이 생긴다. JSON 직렬화 시 `undefined` 키는 소실되어 런타임 오류는 없지만, 다운스트림 expression에서 `output.request.headers` 를 항상 `object`로 가정하고 속성에 접근하면 런타임 에러가 발생할 수 있다.
- 제안: 핸들러에서 `undefined` 필드를 명시적으로 빈 값으로 초기화하거나(`headers: typedInput.headers ?? {}`) spec의 타입을 `object | undefined`로 정정한다.

---

**[WARNING] `schedule-runner.service.ts` `process()` 메서드의 `__triggerSource` 변경에 대한 단위 테스트 미제공**
- 위치: `schedule-runner.service.ts:162`, `schedules.service.spec.ts`
- 상세: `schedule-runner.service.ts`의 `process()` 내 `__triggerSource: 'schedule'` 추가는 리뷰 대상 파일에 포함되었으나, 제공된 테스트 파일은 `schedules.service.spec.ts`(runNow 경로)와 `hooks.service.spec.ts`만 있다. BullMQ `process()` 경로의 `__triggerSource` 전달은 테스트 커버리지가 제공되지 않았다.
- 제안: `schedule-runner.service.spec.ts` 에 `process()` 메서드를 직접 호출하여 `engine.execute` 인수에 `{ __triggerSource: 'schedule', ... }` 가 포함되는지 검증하는 케이스를 추가한다.

---

**[INFO] `detectTriggerSource` shape-based fallback이 미래 어댑터 변화에 취약**
- 위치: `manual-trigger.handler.ts:47-54`
- 상세: 마커 없이 `body`/`headers`/`query`/`method` 중 하나만 존재해도 `'webhook'`으로 판정한다. 현재 어댑터 설계에서는 문제없으나, 향후 manual/schedule 어댑터가 이 키 이름 중 하나를 파라미터로 사용하는 워크플로우를 실행할 경우 오판 가능성이 있다. (현재 `parameters`는 별도 객체로 분리되어 있어 실제 충돌 가능성은 낮다.)
- 제안: 코드 주석(현재 존재)을 spec에도 명시적으로 경고 수준으로 기록해두는 정도로 충분하다.

---

**[INFO] `schedules.service.ts` `runNow`의 `__triggerSource: 'schedule'` 설계 결정이 코드에만 주석으로 존재**
- 위치: `schedules.service.ts:203-206`
- 상세: 사용자가 수동으로 스케줄을 "지금 실행"할 때 `meta.source: 'schedule'`이 되는 것은 의도된 설계이며 주석으로 설명되어 있다. 그러나 spec(`1-manual-trigger.md §5`)의 `meta.source` 설명 표(`'manual' | 'webhook' | 'schedule'`)에서 `'schedule'`이 자동 실행 외에 `runNow`에서도 발생함을 명시하지 않아, spec 읽는 사람이 오해할 수 있다.
- 제안: spec §5.1 필드 표의 `meta.source` 설명 칸에 "schedule 어댑터는 자동 및 runNow 모두 `"schedule"`" 임을 한 줄 추가한다.

---

## 요약

핵심 요구사항인 `__triggerSource` 마커 도입, `output.request` 그룹화, `meta.source` 부여 모두 코드·테스트·spec 간 일관성 있게 구현되었다. 후방 호환 fallback(shape-based detection)도 설계 의도에 맞게 동작한다. 다만 `TRIGGER_SOURCE_INPUT_KEY` 상수가 어댑터에서 사용되지 않아 단일 진실 원천으로 기능하지 못하고, webhook 요청에서 일부 transport 필드가 생략될 경우 `output.request` 하위 필드가 `undefined`가 될 수 있어 spec 타입 선언과 불일치가 발생한다. `schedule-runner.service.ts` `process()` 경로의 테스트 갭도 보완이 필요하다.

## 위험도

**LOW**