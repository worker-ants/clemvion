## 발견사항

### [CRITICAL] output 계약 파괴 — 기존 웹훅 워크플로우 expression 단절
- **위치**: `manual-trigger.handler.ts:111–140`, 특히 `output.request` 구성 블록
- **상세**: webhook 어댑터로 실행된 기존 워크플로우가 `$node["Manual Trigger"].output.body`, `.headers`, `.query`, `.method` 를 참조하고 있으면 즉시 `undefined` 를 반환한다. 이 변경이 적용된 순간 저장된 워크플로우들의 expression 이 조용히 망가지며, 실행 시점 에러가 아닌 데이터 손실로 이어진다. plan 문서에 **D-카테고리(호환성 무시)** 로 명시되어 있어 의도적 결정임은 확인되지만, 런타임 경고나 fallback 없이 즉시 적용된다는 점에서 가장 높은 위험이다.
- **제안**: (a) 엔진 레벨에서 `output.body` 접근 시 `output.request.body` 로 리다이렉트하는 shim을 임시로 두거나, (b) `output.request` 와 동시에 deprecated flat 필드를 `undefined` 대신 그대로 두되 향후 제거 마커를 추가하거나, (c) 최소한 워크플로우 저장 시점에 migration script 로 expression 을 일괄 치환한다.

---

### [WARNING] `__triggerSource` 마커 오염 가능성 — 스프레드 순서
- **위치**: `hooks.service.ts:103` — `{ __triggerSource: 'webhook', parameters, ...input }`
- **상세**: JavaScript 객체 리터럴에서 나중에 오는 키가 이전 키를 덮어쓴다. `...input` 이 `__triggerSource` 보다 뒤에 오므로, 만약 `WebhookInput` 인터페이스에 `__triggerSource` 필드가 미래에 추가되거나 타입 단언으로 주입된다면 마커가 덮어쓰인다. 반면 `workflows.controller.ts` 는 `{ ...(body?.input ?? {}), __triggerSource: 'manual', parameters }` 순서로 스프레드를 **앞에** 두어 마커가 항상 이긴다 — 두 어댑터의 패턴이 정반대다.
- **제안**: `hooks.service.ts` 도 스프레드를 앞으로 옮긴다: `{ ...input, __triggerSource: 'webhook' as const, parameters }`. `WebhookInput` 에 `__triggerSource` 가 없으므로 동작은 동일하고 의도가 명확해진다.

---

### [WARNING] `TRIGGER_SOURCE_INPUT_KEY` 상수가 어댑터에서 사용되지 않음
- **위치**: `manual-trigger.handler.ts:23` — `export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'`
- **상세**: 상수를 export 했지만 세 어댑터(`hooks.service.ts`, `schedule-runner.service.ts`, `schedules.service.ts`, `workflows.controller.ts`) 모두 문자열 리터럴 `'__triggerSource'` 를 직접 사용한다. 상수가 존재하는 이유가 없으며, 나중에 키 이름을 바꿀 때 상수만 수정하고 어댑터는 놓치는 유지보수 오류가 발생할 수 있다.
- **제안**: 어댑터들이 `TRIGGER_SOURCE_INPUT_KEY` 상수를 import 해서 사용하거나, 상수 export 를 제거한다.

---

### [WARNING] `output.request` 내부 필드에 `undefined` 값 포함 가능
- **위치**: `manual-trigger.handler.ts:130–135`
- **상세**: webhook 으로 감지되었으나 `typedInput` 에 일부 transport 필드(`headers`, `query`, `body`)가 없을 때 `output.request = { method: 'GET', headers: undefined, query: undefined, body: undefined }` 가 된다. `null` 이 아닌 `undefined` 이므로 JSON 직렬화 시 해당 키가 사라지고, downstream expression `$node["Manual Trigger"].output.request.headers` 는 `undefined` 를 반환한다. 테스트 `'does not leak the __triggerSource marker onto output'` 에서 이 패턴(`{ __triggerSource: 'webhook', parameters: {}, method: 'GET' }`)이 실제로 재현된다.
- **제안**: `undefined` 필드를 output 에 포함하지 않도록 조건부로 구성하거나 빈 객체 `{}` 로 fallback 한다:
  ```ts
  output.request = {
    method: typedInput.method ?? null,
    headers: typedInput.headers ?? {},
    query: typedInput.query ?? {},
    body: typedInput.body ?? null,
  };
  ```

---

### [INFO] `runNow` 의 `meta.source: 'schedule'` — 사용자 호출 구분 불가
- **위치**: `schedules.service.ts:206` — `{ __triggerSource: 'schedule', parameters }`
- **상세**: 사용자가 UI에서 "지금 실행" 버튼을 누르면 `meta.source: 'schedule'` 가 붙는다. 자동 스케줄 실행과 사용자 강제 실행이 동일한 source 값을 가지므로 실행 이력 UI, 모니터링, 분기 조건에서 구분이 불가능해진다. 주석에 의도적임을 설명하고 있으나, 향후 `meta.triggeredBy: 'user' | 'cron'` 같은 추가 필드가 없으면 옵저버빌리티가 떨어진다.
- **제안**: 현재 결정을 유지하되 `meta.triggeredBy` 혹은 옵션 필드로 실행 주체를 분리하는 것을 Phase 2+ 에서 검토한다. plan 문서의 후속 항목에 추가하는 것이 좋다.

---

### [INFO] `detectTriggerSource` fallback — schedule 어댑터 마커 누락 시 `'manual'` 오진
- **위치**: `manual-trigger.handler.ts:41–57`
- **상세**: `__triggerSource` 마커 없이 `{ parameters: { foo: 1 } }` 만 오면 `'manual'` 로 fallback 된다. 현재 모든 어댑터가 마커를 stamp 하므로 실제 발생 가능성은 낮지만, 서버 재시작 중 큐에 쌓인 이전 포맷 job이 처리되는 경우 schedule 실행이 `meta.source: 'manual'` 로 기록될 수 있다.
- **제안**: 현재 fallback 로직은 충분한 safety net 이지만, `context.triggerId` 유무나 `triggeredBy` 옵션을 보조 단서로 사용하는 방안을 향후 고려한다.

---

## 요약

이번 변경의 핵심 부작용은 의도된 breaking migration이다 — webhook 어댑터로 실행된 기존 워크플로우의 `output.body/headers/query/method` expression 이 전부 `undefined` 가 된다. `__triggerSource` 마커 시스템 자체는 깔끔하게 설계되어 있고, 핸들러가 마커를 output 밖으로 새지 않도록 올바르게 처리한다. 비의도적 부작용으로는 스프레드 순서 비일관성(`hooks.service.ts` vs `workflows.controller.ts`), export 된 상수가 사용되지 않는 점, `output.request` 내 `undefined` 필드 포함 가능성이 있으며, 이들은 기능 정확성보다 유지보수와 예측 가능성 측면의 위험이다.

## 위험도

**MEDIUM** — 기능 설계는 올바르나, 기존 webhook 워크플로우 expression 단절이 런타임 경고 없이 발생한다는 점에서 운영 환경에서 조용한 데이터 손실로 이어질 수 있다.