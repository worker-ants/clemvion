## 보안 코드 리뷰 결과

---

### 발견사항

---

#### **[WARNING]** 스케줄 파라미터 표현식 평가 — 제한 컨텍스트 이탈 가능성
- **위치**: `schedule-runner.service.ts` — `resolveLimitedExpression()`
- **상세**: `evaluate(value, ctx)` 호출 시 컨텍스트를 `{ $now, $schedule }` 로 제한하려 하지만, `@workflow/expression-engine`의 `evaluate` 함수가 내부적으로 어떤 sandbox 격리를 제공하는지 이 변경사항에서는 확인되지 않습니다. 표현식 엔진이 `Function()` 기반이거나 `eval` 계열이라면, `{{ constructor.constructor('...')() }}` 형태의 prototype pollution 또는 sandbox escape를 시도하는 값이 `schedule.parameterValues`에 저장된 경우 서버 코드 실행으로 이어질 수 있습니다. `parameterValues`는 사용자가 UI/API로 직접 입력하는 값입니다.
- **제안**: (1) `@workflow/expression-engine`의 sandbox 격리 수준을 명시적으로 확인·문서화하세요. (2) `resolveLimitedExpression` 진입 전, 값이 `{{ ... }}` 패턴을 포함하더라도 허용된 변수(`$now`, `$schedule.*`)만 참조하는지 정적 AST 검사를 추가하거나, 엔진 수준에서 허용 변수 화이트리스트를 강제하세요. (3) 실패 시 원본 값을 fallback으로 반환하는 현재 구현은 적절하나, 로그에 표현식 원문이 찍히므로 민감값 노출 여부도 점검하세요.

---

#### **[WARNING]** `parameterValues` — 크기 제한 없음 (DoS 가능성)
- **위치**: `create-schedule.dto.ts`, `update-schedule.dto.ts` — `parameterValues?: Record<string, unknown>`
- **상세**: `@IsObject()` 데코레이터는 값이 객체인지만 검증하며, 키 개수·깊이·값 크기에 대한 제한이 없습니다. 공격자가 수천 개의 키 또는 매우 깊게 중첩된 JSON을 제출하면 파라미터 처리 루프(`resolveTriggerParameters`)와 DB JSONB 컬럼 저장 모두 부하를 받습니다. NestJS 글로벌 `ValidationPipe`에 `transform: true`만 적용된 경우 이 경로에서 페이로드 크기 검증이 누락됩니다.
- **제안**: (1) DTO에 `@ValidateNested` + 커스텀 validator로 최대 키 개수(예: 50개)·중첩 깊이를 제한하거나, (2) `class-validator`의 `@MaxProperties`에 해당하는 커스텀 데코레이터를 추가하세요. (3) NestJS 글로벌 미들웨어 레벨에서 JSON body 최대 크기(현재 webhook spec에 1MB 제한 명시)를 강제하는지 확인하세요.

---

#### **[WARNING]** 프론트엔드 `parameterValues` JSON — 클라이언트 사이드 파싱만 의존
- **위치**: `schedules/page.tsx` — `handleSubmit()` 내 `JSON.parse(formParameterValuesJson)`
- **상세**: 클라이언트에서 `JSON.parse` → 타입 체크 후 서버에 전송하는 구조이지만, 파싱된 객체는 `Record<string, unknown>`으로 전송되어 중첩 객체·배열·함수 등 임의 구조가 그대로 API에 도달합니다. 서버 DTO에서 `@IsObject()`만 검증하므로 실질적인 값 수준 검증은 서버에서도 미흡합니다. XSS 관점에서, 현재는 값을 React로 직접 렌더링하지 않으므로 위험도는 낮으나, 향후 파라미터 값을 화면에 출력하는 기능이 추가되면 위험해질 수 있습니다.
- **제안**: 서버 DTO에 키·값 타입 제한 validator를 추가하고, 향후 렌더링 시 반드시 escaping 처리를 보장하세요.

---

#### **[INFO]** `loadTriggerParameterSchema` — 중복 구현 (공격 표면 일관성 문제)
- **위치**: `hooks.service.ts:loadTriggerParameterSchema`, `schedule-runner.service.ts:loadTriggerParameterSchema`, `workflows.controller.ts:loadTriggerParameterSchema`
- **상세**: 동일한 로직이 세 곳에 복제되어 있습니다. 보안 수정(예: 스키마 검증 강화)이 필요할 때 한 곳만 수정하고 나머지를 누락하면 공격 표면 불일치가 발생합니다. 현재는 세 구현이 동일하나, `hooks.service.ts`는 경고 로그를 남기고 `workflows.controller.ts`는 조용히 `undefined` 반환하는 등 미묘한 차이가 존재합니다.
- **제안**: 공통 서비스(예: `TriggerParameterService`)로 추출하여 단일 구현으로 관리하세요.

---

#### **[INFO]** `WorkflowsController` — 컨트롤러에 Repository 직접 주입
- **위치**: `workflows.controller.ts` — `@InjectRepository(Node) private readonly nodeRepository`
- **상세**: 컨트롤러가 Repository에 직접 의존하는 것은 NestJS 아키텍처 원칙에 어긋나며, 서비스 레이어를 통한 인가 체크를 우회할 수 있는 구조적 위험이 있습니다. 현재는 `findOne({ where: { workflowId } })`만 사용하지만, 나중에 `workspaceId` 격리 없이 다른 쿼리가 추가되면 IDOR(Insecure Direct Object Reference)로 이어질 수 있습니다.
- **제안**: `WorkflowsService` 또는 별도 `TriggerParameterService`에 이 로직을 이동하여 컨트롤러가 서비스 레이어만 호출하도록 하세요.

---

#### **[INFO]** 에러 응답에 스키마 세부 정보 노출
- **위치**: `hooks.service.ts` — `BadRequestException({ code, message, errors })`, `workflows.controller.ts` 동일
- **상세**: `errors` 배열에 `{ field: 'orderId', reason: 'missing_required' }` 형태로 파라미터 이름과 실패 이유가 상세히 노출됩니다. 공개 webhook 엔드포인트(`/api/hooks/:path`)에서 인증 없는 호출자도 이 정보를 받을 수 있어, 워크플로우의 내부 파라미터 스키마를 역으로 추론할 수 있습니다.
- **제안**: 인증 없는 webhook의 경우 에러 세부 정보를 줄이거나(`"Invalid payload"` 만), 최소한 필드 이름 대신 인덱스만 반환하는 옵션을 고려하세요. 내부 API(authenticated)는 상세 에러가 적절합니다.

---

#### **[INFO]** `coerceToType` — `object`/`array` 타입 coerce 실패 미감지
- **위치**: `resolve-trigger-parameters.ts` — coerce 실패 감지 로직
- **상세**: `number` 타입의 coerce 실패(`coerced === null && effective !== null`)는 감지하지만, `object`·`array` 타입에서 JSON 파싱 실패 시 원본 값을 그대로 반환(`return value`)하므로 coerce 실패로 처리되지 않습니다. 즉, `required: true, type: 'object'` 파라미터에 `"not-json-string"` 을 보내면 `coerce_failed` 없이 그대로 통과합니다.
- **제안**: `object`/`array` coerce에서 파싱 실패 시 `null`을 반환하거나, `resolveTriggerParameters`에서 타입 불일치를 감지하는 로직을 추가하세요.

---

### 요약

이번 변경사항은 Manual Trigger 파라미터 스키마 검증, Webhook/Schedule 파라미터 추출 등 전반적으로 체계적으로 설계되어 있으며, SQL Injection·하드코딩 시크릿·인증 우회 등 치명적 취약점은 발견되지 않았습니다. 주요 위험은 두 가지입니다: (1) 스케줄 파라미터에 표현식 엔진(`evaluate`)을 적용할 때 sandbox 격리 보장이 불명확한 점 — 엔진 구현에 따라 RCE로 이어질 수 있으므로 반드시 검증이 필요합니다. (2) `parameterValues` 객체에 크기·깊이 제한이 없어 DoS 가능성이 있습니다. 구조적으로는 동일 로직의 삼중 복제와 컨트롤러의 Repository 직접 주입이 향후 유지보수 과정에서 보안 불일치를 유발할 수 있으므로 리팩토링이 권장됩니다.

### 위험도

**MEDIUM** — 표현식 엔진 sandbox 미검증 항목이 HIGH로 격상될 수 있으며, 해당 엔진의 격리 수준 확인이 선행되어야 최종 위험도를 확정할 수 있습니다.