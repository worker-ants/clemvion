### 발견사항

---

**[WARNING]** `TRIGGER_SOURCE_INPUT_KEY` 상수가 어댑터에서 임포트 없이 사용됨
- 위치: `manual-trigger.handler.ts:22`, `hooks.service.ts:99`, `schedule-runner.service.ts:162`, `schedules.service.ts:206`, `workflows.controller.ts:250`
- 상세: `TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'`가 export되어 있지만, 4개의 어댑터 파일 모두 이 상수를 import하지 않고 문자열 리터럴 `__triggerSource`를 직접 사용한다. 키 이름을 변경할 때 5곳을 동시에 수정해야 하는 DRY 위반이다. export의 목적이 바로 이 공유 사용인데, 실제로는 쓰이지 않는 dead export가 되어 있다.
- 제안: 어댑터 4곳이 `TRIGGER_SOURCE_INPUT_KEY`를 import하여 `{ [TRIGGER_SOURCE_INPUT_KEY]: 'webhook', ... }` 형태로 사용하거나, 상수 export를 제거하고 `__triggerSource`를 각 어댑터의 로컬 상수로 두거나, 공용 타입 파일로 이동한다.

---

**[WARNING]** `detectTriggerSource` 내부에서도 상수 미사용
- 위치: `manual-trigger.handler.ts:48`
- 상세: 같은 파일에 `TRIGGER_SOURCE_INPUT_KEY`를 정의해두고, 바로 아래 `detectTriggerSource` 함수는 `input?.__triggerSource`로 프로퍼티 접근에 리터럴을 그대로 쓴다. 상수를 정의한 목적과 실제 사용이 일치하지 않는다.
- 제안: `const marker = input?.[TRIGGER_SOURCE_INPUT_KEY as '__triggerSource']`로 통일하거나, 인터페이스에 상수를 키로 활용하는 방식으로 일관성을 맞춘다.

---

**[WARNING]** `as const` 사용이 어댑터 간 불일치
- 위치: `workflows.controller.ts:253` vs `hooks.service.ts:99`, `schedule-runner.service.ts:162`
- 상세: `workflows.controller.ts`만 `'manual' as const`를 사용하고, 나머지 어댑터는 `as const` 없이 문자열 리터럴을 사용한다. TypeScript가 모두 올바르게 타입을 추론하므로 런타임 동작 차이는 없지만, 코드 리딩 시 `as const`가 특별한 의도가 있는 것처럼 읽혀 혼란을 준다.
- 제안: 모든 어댑터에서 `as const` 없이 통일하거나, 공용 타입 헬퍼 함수로 추상화한다.

---

**[INFO]** 테스트 파일의 반복적인 `as unknown as { ... }` 타입 단언
- 위치: `manual-trigger.handler.spec.ts` 전반 (6개 테스트 케이스)
- 상세: 각 테스트마다 인라인으로 길고 유사한 타입 구조를 `as unknown as { output: {...}; meta: {...} }` 형태로 반복 정의한다. 새로운 output 필드가 추가될 때 모든 단언부를 수동으로 수정해야 한다.
- 제안: 테스트 파일 상단에 공유 결과 타입 인터페이스 (`type HandlerResult = { output: ...; meta: ... }`)를 선언하여 재사용하면 변경 포인트를 단일화할 수 있다.

---

**[INFO]** `detectTriggerSource` 폴백이 schedule을 silent하게 오분류할 수 있음
- 위치: `manual-trigger.handler.ts:59-63`
- 상세: 마커가 없고 transport 필드도 없는 경우 `'manual'`로 fallback한다. 주석에 "schedule adapters that omit the marker are indistinguishable from manual at this layer"라고 명시되어 있지만, 이 경우 `meta.source: 'manual'`이 조용히 잘못 설정된다. 운영 중 어댑터 버그로 마커가 누락되면 디버깅이 어렵다.
- 제안: 개선 자체보다는 `this.logger?.warn(...)` 등을 통해 마커 누락 시 노이즈를 남기는 것을 고려할 수 있다. 단, 핸들러가 logger를 주입받지 않으므로 현 설계에서는 수용 가능한 트레이드오프다.

---

**[INFO]** `isPlainRecord` 유틸이 파일 로컬로 정의됨
- 위치: `manual-trigger.handler.ts:43-45`
- 상세: `isPlainRecord`는 다른 핸들러나 유틸리티에서도 유용한 범용 타입 가드지만 이 파일에만 존재한다.
- 제안: 프로젝트에 이미 유사한 유틸이 있는지 확인 후 공용 util 파일로 이동을 고려한다. 현재 사용처가 한 곳이면 현 위치도 무방하다.

---

### 요약

`__triggerSource` 마커 도입이라는 핵심 설계는 명확하고 일관된 방향이다. `TRIGGER_SOURCE_INPUT_KEY` 상수를 export해두고 정작 이를 사용해야 할 4개 어댑터 파일이 전부 문자열 리터럴을 직접 쓰는 것이 가장 큰 유지보수 위험으로, 키 이름 변경 시 단일 상수 수정으로 끝나야 할 작업이 5곳 수정으로 늘어난다. `detectTriggerSource` 함수는 단계별 fallback 로직이 주석과 함께 명확하게 정리되어 있어 가독성이 좋고, `isPlainRecord`로 방어 로직을 깔끔하게 통일한 점도 긍정적이다. 테스트는 케이스 커버리지가 충분하지만 인라인 타입 단언의 반복이 리팩토링 비용을 높인다.

### 위험도
**LOW**