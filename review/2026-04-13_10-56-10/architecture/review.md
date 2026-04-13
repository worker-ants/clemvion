### 발견사항

---

**[WARNING] 트리거 파라미터 스키마 로딩 로직의 3중 중복 (DRY 위반)**
- 위치: `workflows.controller.ts:loadTriggerParameterSchema()`, `hooks.service.ts:loadTriggerParameterSchema()`, `schedule-runner.service.ts:loadTriggerParameterSchema()`
- 상세: 세 곳 모두 동일한 패턴 — `nodeRepository.findOne({ where: { workflowId, category: TRIGGER } })` → `config.parameters` 추출 → `validateTriggerParameterSchema()` 호출 — 을 반복한다. 복사-붙여넣기 형태로 유지보수 분산이 발생하며, 하나만 수정하면 나머지가 불일치해지는 리스크가 있다.
- 제안: `TriggerParameterSchemaService` 또는 `ExecutionEngineModule` 내 유틸 함수로 추출하여 단일 소스화. `ExecutionEngineModule`이 이미 `ExpressionResolverService`를 export하고 있으므로 같은 패턴으로 `TriggerParameterSchemaResolver`를 export하는 것이 자연스럽다.

---

**[WARNING] WorkflowsController에서 Repository 직접 주입 (레이어 책임 위반)**
- 위치: `workflows.controller.ts:38`, `+@InjectRepository(Node) private readonly nodeRepository`
- 상세: Controller가 TypeORM Repository를 직접 주입받아 DB 쿼리를 수행하고 있다. NestJS 아키텍처에서 Controller는 HTTP 레이어 책임만 가져야 하며, 데이터 접근은 Service 레이어가 담당해야 한다. 이로 인해 `WorkflowsModule`도 `TypeOrmModule.forFeature([Node])`를 추가해야 할 필요가 생기는 등 모듈 경계가 흐려진다.
- 제안: `loadTriggerParameterSchema` 로직을 `WorkflowsService` 또는 별도 `TriggerSchemaService`로 이동하고, Controller는 Service를 호출하는 방식으로 변경.

---

**[WARNING] Schedule 실행 시 `SchedulesService`가 `ScheduleRunnerService`에 역방향 의존**
- 위치: `schedules.service.ts:198`, `await this.scheduleRunnerService.resolveScheduleParameters(...)`
- 상세: `SchedulesService`(비즈니스 로직)가 `ScheduleRunnerService`(인프라/워커 레이어)를 의존하는 구조다. Runner는 원래 BullMQ Worker로 실행 인프라에 속하는데, 수동 실행 경로(`/schedules/:id/run`)가 Runner의 내부 메서드를 재사용하기 위해 이 방향으로 의존성이 생겼다. `resolveScheduleParameters`가 노출된 public 메서드인 이유도 이 의존성 때문이다.
- 제안: `resolveScheduleParameters` 로직을 `ScheduleRunnerService` 밖으로 추출하여 공유 유틸 또는 `TriggerSchemaService`에 배치. 양쪽(SchedulesService, ScheduleRunnerService)이 동일 유틸을 참조하는 구조로 분리.

---

**[INFO] `ExpressionResolverService` export 노출 범위 확대**
- 위치: `execution-engine.module.ts:exports`
- 상세: `ExpressionResolverService`가 `ScheduleRunnerService`의 limited expression 평가를 위해 export 추가됐다. 그런데 실제 사용처(`schedule-runner.service.ts:resolveLimitedExpression`)는 `ExpressionResolverService`가 아닌 `@workflow/expression-engine`의 `evaluate`를 직접 임포트하고 있어, 이번 export 추가의 실제 소비자가 없는 상태다.
- 제안: 현재 사용처가 없다면 불필요한 export는 제거. 향후 필요 시 추가하는 것이 캡슐화 관점에서 바람직하다.

---

**[INFO] `coerce_failed` 감지가 `number` 타입에만 국한**
- 위치: `resolve-trigger-parameters.ts:97-105`
- 상세: 현재 coerce 실패 감지는 `type === 'number' && coerced === null` 조건만 검사한다. `object`/`array` 타입에서 JSON 파싱에 실패한 경우(`coerceToType`이 원본 값 그대로 반환)는 감지되지 않는다. spec(`WH-EP-05-2`)에서 "타입 강제 변환 실패 시 400 반환"을 요구하므로 잠재적 불일치가 있다.
- 제안: `coerceToType`이 실패 여부를 signal할 수 있도록 반환 타입을 `{ value: unknown; failed: boolean }`으로 변경하거나, `object`/`array` coerce 실패를 별도로 감지하는 로직 추가.

---

**[INFO] Frontend `schedules/page.tsx`의 JSON textarea 입력 방식**
- 위치: `schedules/page.tsx:formParameterValuesJson`
- 상세: 파라미터 값을 raw JSON 문자열 textarea로 입력받는 방식은 사용성 측면에서 낮은 수준이다. 백엔드 스키마(Manual Trigger 노드의 `parameters` 배열)를 가져와 각 필드를 typed input으로 렌더링하는 schema-driven 방식이 spec의 의도("워크플로우의 Manual Trigger 노드 파라미터에 매핑")에 더 부합한다. 단, 현재 단계 구현으로서의 한계는 인지되어 있을 것으로 판단.
- 제안: 향후 일정에서 스케줄 편집 시 해당 워크플로우의 trigger parameter schema를 fetch하여 동적 폼으로 렌더링하는 방식으로 개선 고려.

---

### 요약

이번 변경은 Manual Trigger의 파라미터 스키마 기능을 Manual/Webhook/Schedule 세 가지 실행 경로에 일관되게 적용한 의미 있는 아키텍처 확장이다. 핵심 유틸(`coerce-type`, `resolve-trigger-parameters`)을 잘 분리하고 테스트로 검증한 점은 긍정적이다. 다만, 스키마 로딩 로직이 Controller/HooksService/ScheduleRunnerService 세 곳에 중복된 것이 가장 큰 구조적 부채이며, Controller가 Repository를 직접 주입받는 패턴과 SchedulesService→ScheduleRunnerService 역방향 의존이 레이어 경계를 흐리고 있다. 이 세 가지 Warning을 해소하면 구조가 크게 개선된다.

### 위험도

**MEDIUM**