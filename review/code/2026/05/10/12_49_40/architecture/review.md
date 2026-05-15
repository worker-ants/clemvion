### 발견사항

---

**[WARNING] `TRIGGER_SOURCE_INPUT_KEY` export가 실제 어댑터에서 import되지 않음**
- 위치: `manual-trigger.handler.ts:24` (export) vs `hooks.service.ts:101`, `schedule-runner.service.ts:163`, `schedules.service.ts:207`, `workflows.controller.ts:255` (전부 string literal 직접 사용)
- 상세: 핸들러가 `export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'`를 선언했지만, 4개 어댑터 모두 이 상수를 import하지 않고 `'__triggerSource'` 문자열 리터럴을 직접 하드코딩한다. 상수를 export한 목적(안정적 계약 제공)이 달성되지 않으며, 키 이름 변경 시 컴파일 에러 없이 조용히 깨진다. 특히 `'schedule'` 과 `'manual'` 은 fallback 감지로 구분 불가(이하 참조)하므로 marker가 누락되면 오염된 `meta.source`가 나온다.
- 제안: 4개 어댑터 모두 `import { TRIGGER_SOURCE_INPUT_KEY } from '...manual-trigger.handler'` 로 교체하거나, 더 근본적으로는 이 상수를 execution-engine 경계(예: `execution-engine/types/`)에 정의하여 핸들러 내부 대신 공용 경계에서 선언한다.

---

**[WARNING] `WorkflowsController`(프레젠테이션 레이어)가 엔진 내부 마커를 직접 stamp**
- 위치: `workflows.controller.ts:255–260`
- 상세: `__triggerSource: 'manual'` 마커는 ExecutionEngine과 ManualTriggerHandler 사이의 내부 프로토콜이다. 이를 Controller(프레젠테이션 레이어)가 직접 구성하면 레이어 책임 분리가 깨진다. 나머지 세 어댑터(`HooksService`, `ScheduleRunnerService`, `SchedulesService`)는 모두 서비스/인프라 레이어에 위치하므로 일관성도 없다.
- 제안: `WorkflowsService.execute()` 또는 `ExecutionEngineService.execute()` 의 wrapper 메서드로 마커 stamp 책임을 내리고, controller는 plain `parameters`만 전달한다.

---

**[WARNING] `'schedule'` vs `'manual'` fallback 감지 불가능 — 마커 누락 시 silent 오염**
- 위치: `manual-trigger.handler.ts:46–55` (`detectTriggerSource` 함수, case 3)
- 상세: fallback 로직은 transport 필드(body/headers/query/method) 존재 여부로 webhook을 감지하지만, schedule과 manual은 동일한 `{ parameters }` shape이라 구분 불가능하다. schedule 어댑터가 마커 stamp를 빠뜨리면(예: 향후 새 어댑터 추가 시) `meta.source`가 `'schedule'` 대신 `'manual'`로 잘못 기록된다. 주석도 이를 인정한다("marker should always be set, so this is just a safety net"). 그러나 **위의 문제(상수 미사용)와 결합되면** 실수가 감지되지 않을 위험이 있다.
- 제안: 마커 부재 시 `'unknown'` 또는 logger warning을 emit하거나, 타입 시스템으로 마커 stamp를 강제하는 typed wrapper(예: `EngineInput` type with required `__triggerSource`)를 `ExecutionEngineService.execute()` 시그니처에 도입한다.

---

**[INFO] `ManualTriggerInput` 인터페이스가 webhook 전용 필드를 모든 어댑터에 노출 (ISP 경계)**
- 위치: `manual-trigger.handler.ts:27–33`
- 상세: `body`, `headers`, `query`, `method`는 webhook 어댑터에서만 의미 있는 필드임에도 공용 인터페이스에 선언되어 있다. 현재는 `[key: string]: unknown` index signature와 혼재하므로 런타임 문제는 없으나, 인터페이스 계약이 어댑터 종류를 혼합한다.
- 제안: (현재 규모에서는 충분) 필요 시 `WebhookTriggerInput extends ManualTriggerInput` 분기 또는 discriminated union으로 분리한다.

---

**[INFO] 새 트리거 유형 추가 시 다수 파일 수정 필요 (OCP)**
- 위치: `TriggerSource` 타입, `detectTriggerSource`, 4개 어댑터, spec 문서
- 상세: `TriggerSource = 'manual' | 'webhook' | 'schedule'` 유니온에 새 값을 추가하면 핸들러 로직, fallback 분기, 어댑터 4개, spec이 모두 변경된다. 지금 규모에서 과도한 추상화는 불필요하지만, 트리거 유형이 늘어날 경우 전략 맵(Strategy Map) 패턴이 적합하다.
- 제안: 당장은 현행 유지. 4번째 트리거 유형 추가 시점에 `detectTriggerSource` 를 registry 기반으로 리팩토링한다.

---

### 요약

변경의 전체 아키텍처적 방향(**어댑터가 마커를 stamp → 핸들러가 소비 후 제거 → 다운스트림에 노출되지 않음**)은 올바르다. 트리거 소스 식별 책임을 진입점(핸들러)에 집중시키고, backward-resilience fallback까지 갖춘 설계는 CONVENTIONS와 일관된다. 그러나 `TRIGGER_SOURCE_INPUT_KEY` 상수가 export되었음에도 4개 어댑터 모두 문자열 리터럴을 사용하는 점이 핵심 위험이다 — 마커 키 이름이 변경되면 컴파일 타임 보호 없이 조용히 깨진다. 부가적으로, Controller가 엔진 내부 마커를 직접 구성하는 것은 레이어 책임 분리를 위반하며 나머지 3개 어댑터와 일관성을 잃는다.

### 위험도

**MEDIUM** — 기능적으로는 현재 정상 동작하지만, `TRIGGER_SOURCE_INPUT_KEY` 미사용으로 인한 계약 불일치가 향후 리팩토링 또는 새 어댑터 추가 시 silent failure로 이어질 수 있다.