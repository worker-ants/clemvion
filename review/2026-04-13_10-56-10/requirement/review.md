## 발견사항

---

### [WARNING] `WorkflowsController`가 Repository를 직접 주입 — 아키텍처 계층 위반
- **위치**: `workflows.controller.ts:38-41`, `loadTriggerParameterSchema()`
- **상세**: Controller가 `NodeRepository`를 직접 주입하여 DB 접근 로직을 담당. `HooksService`·`ScheduleRunnerService`에도 동일한 `loadTriggerParameterSchema()` private 메서드가 각각 중복 존재 (3 copy). 비즈니스 로직이 컨트롤러에 누출됨.
- **제안**: `NodeHandlerRegistry` 또는 별도 `TriggerParameterService`로 추출하여 단일 소스화. 컨트롤러는 서비스만 의존.

---

### [WARNING] `loadTriggerParameterSchema` — 다수 트리거 노드가 존재할 경우 비결정적
- **위치**: `hooks.service.ts:100~120`, `schedule-runner.service.ts:62~75`, `workflows.controller.ts:140~152`
- **상세**: `findOne({ where: { workflowId, category: NodeCategory.TRIGGER } })`는 트리거 노드가 복수이거나 스펙 위반 상태일 때 DB가 임의 row 반환. 현재 스펙은 "워크플로우당 1개"를 강제하지만 DB 레벨 unique 제약이 없으므로 race condition 가능성 있음.
- **제안**: `findOne`에 `order: { createdAt: 'ASC' }` 명시 또는 DB에 `UNIQUE (workflow_id, category)` 제약 추가.

---

### [WARNING] Manual 트리거 파라미터 400 반환이 Execution 생성 전이 아닐 수 있음 (스펙 §1.7 step 2 vs 실제 구현)
- **위치**: `workflows.controller.ts:102~145`
- **상세**: 스펙 §1.7에서 "required 누락 → 즉시 실행 실패 (INVALID_INPUT)" + "Execution 레코드 생성 (status: PENDING)" 순서로 기술. 현재 컨트롤러는 `resolveTriggerParameters()` 실패 시 `execute()` 미호출로 Execution 미생성이 맞음. 그러나 스펙에는 Manual 트리거가 "Execution 생성 전 400 응답 **또는** RUNNING 진입 즉시 실패" 두 경로를 허용. 실제 구현은 전자(컨트롤러 수준 400)인데 이를 테스트가 커버하지 않음.
- **제안**: `workflows.controller.spec.ts`(또는 e2e)에 `required` 파라미터 누락 시 400이 반환되고 engine.execute가 호출되지 않는 테스트 추가.

---

### [WARNING] `editor-toolbar.tsx` — `parameterValues`가 undefined일 때 `execute()` 호출 시 불필요한 `input.parameterValues` 중복 전송
- **위치**: `editor-toolbar.tsx:104~111`
- **상세**: `parsedInput.parameterValues`와 `parameterValues` 옵션을 동시에 백엔드에 전송. 컨트롤러는 `body?.parameterValues ?? body?.input?.parameters` 순으로 읽으므로 실제 우선순위에는 문제 없지만, `input` 객체 내 `parameterValues` 키가 그대로 downstream 노드에 `$input.parameterValues`로 노출될 수 있음.
- **제안**: `parsedInput`에서 `parameterValues`를 제거한 clean한 `input` 객체를 분리해서 전송.

---

### [WARNING] `resolveTriggerParameters` — `coerce_failed`가 `number` 타입에만 적용, `object`/`array` JSON 파싱 실패는 무시됨
- **위치**: `resolve-trigger-parameters.ts:95~105`
- **상세**: 스펙 §5.2에서 "coerce 실패 시 400" 명시. 현재 `object`/`array` 타입에서 `coerceToType`이 파싱 실패 시 원본 값을 그대로 반환(에러 없음). 예: `{ payload: "not-json-string" }`를 `object` 타입으로 받으면 문자열이 그대로 통과.
- **제안**: `coerceToType`에서 타입 불일치를 sentinel(e.g., `Symbol`)로 반환하거나, `resolve-trigger-parameters.ts`에서 타입 검증 후 `coerce_failed` 추가.

---

### [INFO] `schedule-runner.service.ts` — required 파라미터 validation 실패 시 폴백 로직이 스펙과 상이
- **위치**: `schedule-runner.service.ts:68~80`
- **상세**: 스펙 §2 트리거 테이블: "Schedule - 런타임은 default 채움". 현재 구현은 `TriggerParameterValidationException` catch 시 `resolveTriggerParameters(undefined, resolvedRaw)` 호출 → 스키마 없이 처리하여 `{}` 반환. required 필드가 누락된 경우 빈 `parameters`로 실행이 계속 진행됨. 의도와 일치하나, required 누락도 경고 없이 진행하는 것이 맞는지 명확하지 않음.
- **제안**: `missing_required` 에러만 폴백 허용, `coerce_failed`는 스케줄 비활성화 또는 별도 알림 처리 고려.

---

### [INFO] `schedules/page.tsx` — Parameter Values UI가 textarea JSON 자유입력 방식이어서 사용성 저하
- **위치**: `schedules/page.tsx:801~833`
- **상세**: 스펙은 `schedule.parameterValues`에 `{{ $now }}` 등 제한 표현식 사용을 허용한다고 명시. 그러나 UI는 단순 textarea로 구성되어 표현식 자동완성·유효성 검증 없음. 필수 요구사항은 아니나 실수 가능성 높음.
- **제안**: 실시간 JSON lint 또는 키-값 쌍 형태 입력 UI 고려 (향후 개선 task로 등록 권장).

---

### [INFO] `trigger-configs.tsx` — 파라미터 name 중복 및 invalid identifier에 대한 클라이언트측 실시간 검증 없음
- **위치**: `trigger-configs.tsx` 전체
- **상세**: 백엔드 `validate()`는 중복 name, 비유효 식별자를 검증하나, 프론트엔드 설정 패널은 저장 전까지 피드백 없음. 사용자가 캔버스 저장 후 런타임 실패로 알게 됨.
- **제안**: `name` input `onChange`에서 `/^[A-Za-z_][A-Za-z0-9_]*$/` 검증 + 중복 감지 인라인 에러 표시 추가.

---

### [INFO] `hooks.service.spec.ts` — `WebhookInput` 타입이 export 되지 않아 테스트 import가 취약
- **위치**: `hooks.service.spec.ts:8`, `hooks.service.ts`
- **상세**: 테스트가 `import { HooksService, WebhookInput }` 형태로 내부 인터페이스를 직접 import. 현재 `hooks.service.ts`에 `export interface WebhookInput`이 없으면 컴파일 에러. (실제로는 export 되어있을 수 있으나 diff에 미포함)
- **제안**: `WebhookInput`을 `hooks.service.ts`에서 명시적으로 `export` 확인.

---

### [INFO] `V011__schedule_parameter_values.sql` — `IF NOT EXISTS` 사용으로 멱등성 확보됨, 정상
- **위치**: `migrations/V011__schedule_parameter_values.sql`
- **상세**: `DEFAULT '{}'` 로 기존 row에 빈 객체 자동 채워지므로 하위 호환성 유지. 마이그레이션 설계 적절.

---

## 요약

이번 변경은 Manual Trigger 노드에 파라미터 스키마를 선언하고, Manual·Webhook·Schedule 세 가지 진입 경로에서 동일한 `resolveTriggerParameters` 유틸로 검증·coerce·defaultValue 적용 흐름을 구현한 것으로, 스펙의 핵심 요구사항(WH-EP-05-1/2, 트리거 파라미터 공통 계약)은 대부분 충족된다. 단, `loadTriggerParameterSchema` 로직이 Controller·HooksService·ScheduleRunnerService에 3중 중복되어 유지보수 위험이 있고, `object`/`array` 타입의 coerce 실패가 400을 발생시키지 않아 스펙 §5.2와 일치하지 않는다. 프론트엔드 파라미터 설정 UI에는 실시간 식별자 검증이 누락되어 사용자 경험 저하 우려가 있다. 이 세 항목이 해결되면 전체 요구사항 충족도는 충분히 높다.

## 위험도

**MEDIUM**