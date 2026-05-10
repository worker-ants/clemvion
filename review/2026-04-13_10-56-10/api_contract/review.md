### 발견사항

---

**[WARNING] `POST /workflows/:id/execute` 요청 바디 구조 변경 — Soft Breaking Change**
- 위치: `frontend/src/lib/api/workflows.ts`, `workflows.controller.ts`
- 상세: 기존 `{ input: Record<string, unknown> }` 단일 필드에서 `{ input?, parameterValues? }` 이중 필드 구조로 변경. 컨트롤러는 `body?.input.parameters`도 fallback으로 허용하여 호환성을 보완했으나, 기존에 `input` 단독으로 전체 페이로드를 보내던 외부 클라이언트(curl, SDK, 서드파티)는 명시적 안내 없이 동작 변화를 겪을 수 있음.
- 제안: API 버전(`/v2/workflows/:id/execute`)을 분리하거나, `CHANGELOG` / OpenAPI 문서에 deprecation 주석 추가. 최소한 기존 `input` 필드에서 `parameters`를 자동 추출하는 현재 fallback 로직이 영속적임을 문서화할 것.

---

**[WARNING] `POST /schedules`, `PATCH /schedules/:id` 신규 필드 `parameterValues` — 암묵적 계약 확장**
- 위치: `create-schedule.dto.ts`, `update-schedule.dto.ts`
- 상세: `parameterValues`는 `@IsOptional()`이므로 기존 클라이언트는 영향 없음. 그러나 `@IsObject()`만 선언되어 있어 값이 `null`, 배열, 중첩 깊이에 대한 제약이 없음. `{}` 기본값과의 일관성도 DTO 레벨에서 강제되지 않음(`undefined`로 수신 시 서비스 코드에서 `?? {}`로 처리).
- 제안: `@ValidateNested()` + 별도 value-object DTO 또는 최소한 `@IsNotEmpty({ each: true })`로 빈 키 방어. `null` 전송 시의 동작(reset vs noop) 명세 필요.

---

**[WARNING] `400 Bad Request` 에러 응답 형식 불일치**
- 위치: `hooks.service.ts:L95`, `workflows.controller.ts:L138`
- 상세: 두 엔드포인트 모두 `{ code, message, errors[] }` 구조를 사용하지만 `code` 값이 서로 다름(`INVALID_WEBHOOK_PAYLOAD` vs `INVALID_TRIGGER_PARAMETERS`). NestJS 기본 400 응답(`{ statusCode, message }`)과도 형식이 다르며, spec의 `12-webhook.md §5.2`에 명시된 응답 형식(`{ statusCode, message, errors }`)과도 불일치(`code` 필드 추가됨).
- 제안: 공통 error-response interceptor 또는 factory를 만들어 `{ code, message, errors }` 형식을 전 API에 통일. 스펙 문서도 `code` 필드를 포함하도록 갱신.

---

**[WARNING] `WorkflowsController`에 `@InjectRepository(Node)` 직접 주입 — 레이어 위반**
- 위치: `workflows.controller.ts:L40`
- 상세: 컨트롤러가 Repository를 직접 주입받아 DB 쿼리(`loadTriggerParameterSchema`)를 수행. 같은 로직이 `HooksService`, `ScheduleRunnerService`에도 중복 존재. API 계약 관점에서 컨트롤러가 서비스 레이어를 우회해 데이터를 조회하면 인증/인가 데코레이터나 인터셉터 체인을 벗어난 로직이 생길 위험 있음.
- 제안: `loadTriggerParameterSchema` 로직을 `ExecutionEngineService` 또는 별도 `TriggerParameterService`로 추출하여 컨트롤러, HooksService, ScheduleRunnerService가 공통 호출하도록 통합. `WorkflowsModule`에서도 `TypeOrmModule.forFeature([Node])` 등록 확인 필요.

---

**[INFO] Webhook 실행 시 `input` 필드 병합 순서 — `parameters` 키 충돌 가능성**
- 위치: `hooks.service.ts:L103`
- 상세: `{ parameters, ...input }` 스프레드 시 `input.body.parameters`가 아닌 원본 `input` 객체에 `parameters` 키가 존재하면 덮어씌워짐. `WebhookInput` 타입에는 `parameters` 필드가 없어 현재는 안전하나, 향후 타입 변경 시 silent overwrite 위험.
- 제안: 명시적으로 `{ parameters, body: input.body, headers: input.headers, query: input.query, method: input.method }` 로 구조화하여 의도를 명확히 표현(테스트 `hooks.service.spec.ts`는 이미 이 구조를 expect).

---

**[INFO] `$params` 표현식 변수 추가 — 기존 표현식과의 충돌 없음 확인됨**
- 위치: `expression-resolver.service.ts:L75`
- 상세: `$params`는 신규 추가 변수이므로 기존 `$input`, `$node`, `$var`, `$execution` 사용 워크플로우에 breaking change 없음. 단, `$params`가 이미 존재하는 커스텀 변수명(`$var.params` 등)과 혼동될 수 있음.
- 제안: 문서(spec/5-system/4-execution-engine.md)에 `$params`는 read-only alias이며 Variable Modification으로 덮어쓸 수 없음을 명시.

---

**[INFO] Schedule `parameterValues` DB 마이그레이션 — 기존 레코드 호환**
- 위치: `V011__schedule_parameter_values.sql`
- 상세: `DEFAULT '{}'`으로 기존 레코드에 빈 객체 자동 적용되므로 하위 호환 유지. `NOT NULL`도 올바르게 처리됨.
- 제안: 이상 없음.

---

### 요약

이번 변경은 Manual Trigger 파라미터 스키마 계약을 도입하는 중규모 API 확장으로, 전반적으로 하위 호환성을 의식한 설계(optional 필드, fallback 분기)가 적용되어 있다. 그러나 ① `POST /execute` 바디 구조 변경이 외부 클라이언트에게 명시적으로 공지되지 않은 soft breaking change이고, ② 두 엔드포인트의 400 에러 응답 `code` 필드가 스펙 문서와 불일치하며, ③ 동일한 `loadTriggerParameterSchema` 로직이 Controller·HooksService·ScheduleRunnerService에 3중 중복되어 계약 일관성 유지가 어려운 구조인 점이 주요 위험 요소다. 에러 응답 형식 통일과 스키마 조회 로직 단일화가 가장 우선적으로 해결되어야 한다.

### 위험도
**MEDIUM**