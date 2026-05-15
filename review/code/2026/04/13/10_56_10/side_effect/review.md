## 발견사항

### **[WARNING]** `WorkflowsController`에서 DB 쿼리가 컨트롤러 레이어에서 직접 수행됨
- **위치**: `workflows.controller.ts`, `loadTriggerParameterSchema()` 메서드
- **상세**: 컨트롤러가 `NodeRepository`를 직접 주입받아 DB 쿼리를 실행함. 동일 로직이 `HooksService`와 `ScheduleRunnerService`에도 각각 중복 구현됨 (3곳에서 독립 복사). 서비스 레이어 우회로 캐싱, 트랜잭션, 권한 체크 등이 누락될 수 있음.
- **제안**: 공통 `loadTriggerParameterSchema` 로직을 `ExecutionEngineService` 또는 별도의 `TriggerParameterService`로 추출하고, 컨트롤러는 서비스만 호출하도록 리팩토링.

---

### **[WARNING]** `execute()` API 시그니처 변경이 기존 호출자에 미치는 영향
- **위치**: `execution-engine.service.ts:1235`, `workflows.controller.ts`, `schedule-runner.service.ts`, `hooks.service.ts`
- **상세**: `executionEngineService.execute(workflowId, input?)` 호출 시 `input`의 구조가 암묵적으로 `{ parameters, ...rest }` 형태를 요구하게 되었음. 서비스 시그니처 자체는 변경되지 않았지만, Manual Trigger 핸들러가 `input.parameters`를 기대하므로 `parameters` 키 없는 기존 `input` 객체 전달 시 `$params` 가 빈 객체로 처리됨. 이는 기존 워크플로우에서 `$input.someKey`로 접근하던 패턴을 무효화할 수 있음.
- **제안**: 마이그레이션 가이드 또는 하위 호환 경고 로그 추가. 기존 `$input.someKey` 접근 패턴이 `$input.parameters.someKey`로 변경됨을 명시.

---

### **[WARNING]** `editor-toolbar.tsx`에서 `fromNodeId` 전달 방식 변경으로 인한 부작용
- **위치**: `editor-toolbar.tsx:132`
- **상세**: 기존 `{ fromNodeId }` 가 `{ input: { fromNodeId } }` 로 감싸졌음. 백엔드 컨트롤러는 `body?.input`을 `executionInput`에 스프레드하므로 `fromNodeId`는 여전히 전달되나, `parameters` 추출 시 `body?.input.parameters`도 함께 읽으므로 `fromNodeId` 포함 객체에서 `parameters`가 없으면 `{}` 처리됨 — 의도된 동작이나 기존 노드 실행 테스트 케이스 업데이트 누락 가능성.
- **제안**: `fromNodeId` 기반 실행 경로에 대한 통합 테스트 확인.

---

### **[WARNING]** `resolveTriggerParameters`에서 빈 문자열(`""`)을 "누락"으로 처리
- **위치**: `resolve-trigger-parameters.ts`, 조건 `value === ''`
- **상세**: 빈 문자열이 명시적으로 전달된 경우에도 `defaultValue`로 대체됨. 이는 `""` 자체가 유효한 값인 string 파라미터에서 의도치 않은 기본값 적용을 유발함. 테스트(`empty string is treated as missing for optional with default`)가 이를 명시적으로 검증하나, 스펙이 이를 설계 의도로 명확히 기술하지 않음.
- **제안**: 스펙에 "빈 문자열은 미지정으로 간주" 명시 또는 `value === ''` 조건 제거 후 `null`/`undefined`만 미지정 처리.

---

### **[INFO]** `nodeExec.outputData` 타입 캐스트 제거
- **위치**: `execution-engine.service.ts:1235`
- **상세**: `as Record<string, unknown>` 캐스트 제거. `outputData` 컬럼 타입이 TypeORM 엔티티에서 `Record<string, unknown>`으로 선언되어 있다면 TypeScript가 타입 불일치를 잡아낼 것이나, `jsonb` 컬럼 특성상 실제 런타임 영향 없음.
- **제안**: 영향 없음, 코드 정리 수준.

---

### **[INFO]** `ExpressionResolverService` export 추가
- **위치**: `execution-engine.module.ts`
- **상세**: `ExpressionResolverService`가 exports에 추가되어 외부 모듈에서 주입 가능해짐. 현재 이 서비스를 직접 주입하는 소비자가 없으며 `ScheduleRunnerService`가 독립적으로 `evaluate`를 직접 사용하므로 불필요한 노출일 수 있음.
- **제안**: 실제 소비자가 없다면 export 제거 검토.

---

### **[INFO]** Schedule 파라미터 표현식이 `$node`, `$var`, `$input` 없는 제한 컨텍스트에서 평가됨
- **위치**: `schedule-runner.service.ts`, `resolveLimitedExpression()`
- **상세**: 실패 시 원본 값 반환(warn 로그)하는 silent fallback 처리. 표현식 오류가 사용자에게 노출되지 않아 잘못된 파라미터로 워크플로우가 실행될 수 있음.
- **제안**: 현재 warn 로그는 적절하나, 실행 결과의 `NodeExecution` 에러로도 기록되는지 확인 필요.

---

## 요약

이번 변경은 Manual Trigger 노드에 파라미터 스키마 기능을 추가하는 대규모 기능 확장으로, 전반적으로 방어적으로 설계되어 있음(스키마 없을 때 `{}`로 fallback, 하위 호환성 유지). 가장 주의할 부작용은 **기존 `$input.someKey` 직접 접근 패턴이 사실상 `$input.parameters.someKey`로 마이그레이션 필요**해진 점으로, 기존에 input을 플랫 객체로 전달하던 워크플로우는 파라미터 스키마 미정의 시 `parameters: {}` 가 주입되고 원본 input 필드들은 `$input`의 최상위로 전달되어 동작 방식이 미묘하게 달라질 수 있음. `loadTriggerParameterSchema` 로직의 3중 복제는 유지보수 리스크이며 서비스 레이어로 추출이 권장됨.

## 위험도

**MEDIUM**