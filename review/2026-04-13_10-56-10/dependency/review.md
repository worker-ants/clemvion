### 발견사항

---

- **[WARNING]** `WorkflowsController`가 TypeORM Repository를 직접 주입
  - 위치: `workflows.controller.ts:38-40`, `loadTriggerParameterSchema` 메서드
  - 상세: Controller 레이어가 `@InjectRepository(Node)`로 DB 접근을 직접 수행. NestJS 아키텍처 원칙상 Controller는 Service에 의존해야 하며 Repository에 직접 의존하면 안 됨. 또한 `WorkflowsModule`의 `TypeOrmModule.forFeature([])` 에 `Node` 엔티티가 등록되어 있지 않을 경우 런타임 에러가 발생함.
  - 제안: `loadTriggerParameterSchema` 로직을 `WorkflowsService`로 이동하거나, 별도 `TriggerParameterService`를 만들어 Controller는 서비스를 통해서만 접근하도록 변경. `WorkflowsModule`에 `TypeOrmModule.forFeature([..., Node])` 추가 여부도 확인 필요.

---

- **[WARNING]** `loadTriggerParameterSchema` 로직이 3곳에 중복
  - 위치: `hooks.service.ts:117-133`, `schedule-runner.service.ts:90-96`, `workflows.controller.ts:152-160`
  - 상세: 동일한 "trigger 노드 조회 → config.parameters 추출 → schema validation" 로직이 세 파일에 복사되어 있음. 변경 시 세 곳을 모두 수정해야 하므로 동기화 버그 위험이 높음. 이는 내부 모듈 간 의존성 설계 문제임.
  - 제안: `ExecutionEngineModule` 또는 별도의 `TriggerParameterService`로 추출하고 세 호출측이 해당 서비스를 주입하도록 리팩터링.

---

- **[WARNING]** `ScheduleRunnerService`가 `@workflow/expression-engine`을 직접 import
  - 위치: `schedule-runner.service.ts:10`, `resolveLimitedExpression` 메서드
  - 상세: `ExecutionEngineModule`이 이미 `ExpressionResolverService`를 export하고 있으나, `ScheduleRunnerService`는 이를 사용하지 않고 expression engine 패키지를 직접 참조함. 표현식 평가 경로가 두 갈래(`ExpressionResolverService` vs 직접 `evaluate()`)로 분기되어 일관성이 없고, 향후 expression engine 교체 시 두 경로를 모두 수정해야 함.
  - 제안: `ExpressionResolverService`에 제한 컨텍스트용 오버로드(또는 `buildExpressionContext`의 부분 활용)를 추가하고 `ScheduleRunnerService`는 해당 서비스를 주입하여 사용.

---

- **[INFO]** `ExpressionResolverService`가 `ExecutionEngineModule` exports에 추가됨
  - 위치: `execution-engine.module.ts:46`
  - 상세: 이전에는 모듈 내부 전용이었으나 외부 모듈에서 사용하기 위해 export됨. 현재 `ScheduleRunnerService`는 이를 사용하지 않고 있으므로(위 WARNING 참조) export의 실효성이 제한적인 상태.
  - 제안: WARNING 항목 해결 후 `ScheduleRunnerService`가 실제로 이 export를 활용하도록 변경.

---

- **[INFO]** `coerceToType`가 공유 유틸로 올바르게 추출됨
  - 위치: `utils/coerce-type.ts`, `variable-declaration.handler.ts`
  - 상세: 중복 코드를 제거하고 단일 소스로 관리하는 올바른 방향. `CoercibleType` export로 타입 안전성도 확보됨. 긍정적 변경.

---

- **[INFO]** `HooksModule`과 `SchedulesModule`의 `Node` 엔티티 등록
  - 위치: `hooks.module.ts:12`, `schedules.module.ts:17`
  - 상세: 두 모듈 모두 `TypeOrmModule.forFeature([..., Node])`에 `Node`를 올바르게 추가함. `WorkflowsModule`은 수정 diff에 포함되지 않아 확인 필요(위 CRITICAL 참조).

---

### 요약

이번 변경의 핵심 의존성 이슈는 **`loadTriggerParameterSchema` 로직의 3중 중복**과 **`WorkflowsController`의 Repository 직접 주입**에 있다. 공통 로직을 서비스 레이어로 추출하지 않아 동기화 버그 위험이 생겼고, 컨트롤러가 데이터 접근 레이어에 직접 의존하는 아키텍처 위반이 발생했다. 또한 `ExpressionResolverService`를 export했음에도 `ScheduleRunnerService`가 `@workflow/expression-engine`을 직접 import해 표현식 평가 경로가 불일치하는 문제가 있다. 신규 외부 패키지 추가는 없으며, `coerceToType` 유틸 추출과 같은 긍정적인 내부 의존성 정리도 포함되어 있다.

### 위험도

**MEDIUM**