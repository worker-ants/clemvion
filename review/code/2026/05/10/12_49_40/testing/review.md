### 발견사항

- **[HIGH]** `schedule-runner.service.ts` `process()` 메서드에 대한 회귀 테스트 부재
  - 위치: `schedule-runner.service.ts:162` — `__triggerSource: 'schedule'` 추가
  - 상세: diff에 `schedule-runner.service.spec.ts`가 포함되지 않았다. `process()` 메서드가 `__triggerSource: 'schedule'` 를 올바르게 전달하는지 검증하는 단위 테스트가 보이지 않는다. 누군가 이 라인을 되돌리거나 값을 바꿔도 CI가 잡지 못한다.
  - 제안: `schedule-runner.service.spec.ts` 에 `process()` 테스트를 추가하여 `engine.execute` 가 `{ __triggerSource: 'schedule', parameters }` 를 받는지 직접 검증

- **[HIGH]** `workflows.controller.ts` `execute` 메서드에 대한 단위/통합 테스트 부재
  - 위치: `workflows.controller.ts:255` — `__triggerSource: 'manual' as const` 추가
  - 상세: 컨트롤러 변경에 상응하는 spec 파일이 diff에 없다. 4개 어댑터 중 유일하게 테스트 커버리지가 드러나지 않는 지점이다.
  - 제안: `workflows.controller.spec.ts`(또는 e2e) 에 `POST /:id/execute` 시 `executionEngineService.execute` 에 `__triggerSource: 'manual'` 이 포함되는지 검증하는 케이스 추가

- **[WARNING]** `hooks.service.spec.ts` 마지막 테스트가 `__triggerSource` 를 검증하지 않음
  - 위치: `hooks.service.spec.ts` — `'passes { parameters: {} } when workflow has no trigger parameters schema'` 케이스
  - 상세: `expect.objectContaining({ parameters: {} })` 만 사용하므로 `__triggerSource: 'webhook'` 이 빠져도 통과한다. 다른 webhook 테스트와 일관성이 없다.
  - 제안: `expect.objectContaining({ __triggerSource: 'webhook', parameters: {} })` 로 교체

- **[WARNING]** `TRIGGER_SOURCE_INPUT_KEY` 상수가 어댑터에서 사용되지 않음
  - 위치: `manual-trigger.handler.ts:22` — `export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'`
  - 상세: 네 어댑터(`hooks.service.ts`, `schedule-runner.service.ts`, `schedules.service.ts`, `workflows.controller.ts`) 모두 리터럴 문자열 `'__triggerSource'` 를 직접 사용한다. 상수를 export 했지만 임포트하는 곳이 없어서, 키 이름이 변경되면 4곳을 수동으로 찾아야 한다. 또한 이 상수를 테스트 파일에서도 임포트해 사용하면 리팩터링 안전성이 높아진다.
  - 제안: 어댑터 파일에서 `TRIGGER_SOURCE_INPUT_KEY` 를 임포트해 사용하거나, 상수를 `execution-engine` 공용 타입 모듈로 이동. 테스트도 리터럴 대신 상수 참조

- **[INFO]** 역방향 탐지(transport-shape detection) 테스트가 키 단위 개별 검증을 하지 않음
  - 위치: `manual-trigger.handler.spec.ts` — `'detects webhook by transport-shape when __triggerSource is absent'`
  - 상세: 테스트가 `body`, `headers`, `query`, `method` 4개 키를 동시에 전달한다. `TRANSPORT_KEYS.some(...)` 로직이 개별 키에도 동작하는지는 검증되지 않는다. `body` 하나만 있을 때도 webhook으로 탐지되는지 확인하는 케이스가 있으면 좋다.
  - 제안: `{ body: { raw: true }, parameters: {} }` 처럼 transport 키 하나만 있는 입력으로 추가 케이스 작성

- **[INFO]** `output.request` 내 부분 undefined 필드 케이스 미검증
  - 위치: `manual-trigger.handler.spec.ts`
  - 상세: webhook 어댑터가 `method` 만 전달하고 `headers`/`query`/`body` 를 생략한 경우, `output.request` 가 `{ method: 'GET', headers: undefined, query: undefined, body: undefined }` 형태가 된다. 이 shape이 다운스트림 expression 에 안전한지 검증하는 케이스가 없다.
  - 제안: 선택적 transport 필드 일부 생략 케이스 추가

---

### 요약

`manual-trigger.handler.spec.ts` 의 테스트 보강은 매우 충실하다 — 출처별 분기(manual/webhook/schedule), fallback 탐지, 마커 누출 방지, null 입력 fallback까지 모두 커버되어 있으며 케이스 이름도 명확하다. `hooks.service.spec.ts` 와 `schedules.service.spec.ts` 도 핵심 경로를 올바르게 검증한다. 그러나 4개 어댑터 중 2개(`schedule-runner.service.ts`의 `process()`, `workflows.controller.ts`의 `execute()`)에 대응하는 테스트가 diff에 없어 회귀 위험이 남아 있으며, `__triggerSource` 의 리터럴 중복(상수 미사용)은 향후 키 이름 변경 시 누락 위험을 만든다.

### 위험도
**MEDIUM** — 핵심 로직(ManualTriggerHandler) 테스트는 우수하나, 두 어댑터 변경에 대한 테스트 공백이 존재하여 리그레션 탐지 능력이 부분적으로 결여됨