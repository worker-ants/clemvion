# Changelog

## Unreleased — workflow 동시 실행 cap validated write DTO (§8, workspace 대칭)

### 변경 사항

1. **`PATCH /api/workflows/:id` 의 `settings` 가 검증되는 nested DTO 로 강화** — 종전 opaque `Record<string, unknown>`(`@IsObject()`) 이던 `settings` 를 `WorkflowSettingsDto`(`maxConcurrentExecutions`: `@IsInt @Min(1)`)로 전환했다. workspace 의 `UpdateWorkspaceSettingsDto`(§8 admission gate) 와 대칭이며, `spec/1-data-model.md §2.4`·`spec/5-system/4-execution-engine.md §8` 이 이미 `Workflow.settings` 를 `maxConcurrentExecutions` 로 스코프한다. 전역 `whitelist+forbidNonWhitelisted` pipe 로 **미지 `settings` 키·비양수·비정수 cap 은 이제 `400`** 을 받는다(종전 무검증 통과 후 런타임 `resolveConcurrencyCap` backstop 이 defaultCap 으로 무시). **스펙 준수 클라이언트에는 영향이 없다** — backend 는 `maxConcurrentExecutions` 외 workflow settings 키를 소비하지 않으며, 프런트 `workflowsApi.update` 유일 호출부는 `{ isActive }` 만 전송한다. 서비스 `update` 는 `settings` 를 전체 교체 대신 spread-merge 해 DB 잔여 키를 보존한다(workspace 대칭). `ImportWorkflowDto.settings` 는 opaque 유지(별도 후속). SoT: `spec/5-system/4-execution-engine.md §8`.

## Unreleased — 인증 webhook 1MB body 게이트 (옵션 C) + 공개 webhook 보호 우회 fix

### 보안 수정 (Security)

1. **공개 webhook 남용 보호가 전량 우회되던 버그 수정** — `PublicWebhookThrottleGuard` 가 트리거를 `findOne({ select: { authConfigId: true } })` 로 조회했는데, 이 partial projection 이 `authConfigId` 를 (`null` 대신) 비-`null` 값으로 잘못 반환해, **모든 공개(`auth_config_id IS NULL`) webhook 이 인증 webhook 으로 오판**되었다. 결과적으로 공개 webhook 의 **32KB body 크기 제한·IP 단위 분당/시간당 rate-limit 이 전혀 적용되지 않았다**(Guard 가 본문 검사 전 early-return). full entity 로드로 교정. 회귀 가드 e2e 추가(`webhook-trigger` L: 공개 64KB → `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`).

### 변경 사항

1. **인증 webhook 본문 1MB 수용 (WH-NF-02 옵션 C)** — `/api/hooks/*` 라우트 스코프 body-parser(`createHooksBodyParsers`, 기본 1MB·`HOOKS_MAX_BODY_BYTES` env)가 인증 webhook 본문을 1MB 까지 수용하고, 초과 시 표준 봉투 `413 PAYLOAD_TOO_LARGE`. 종전 인증 webhook 은 express 기본 100KB 에서 비표준 에러로 끊겼다. 공개 webhook 의 32KB(`PublicWebhookThrottleGuard`)는 그 위에서 유지. 전역 100KB 기본은 non-webhook 라우트에 보존(라우트 스코프 분리). `main.ts` 는 `bodyParser: false` 로 Nest 기본 파서를 끄고 hooks·전역 파서를 직접 등록(Nest 가 수동 파서 감지 시 자기 전역 파서를 skip 해 본문 미파싱되는 함정 회피), rawBody 보존(HMAC 호환). SoT: `spec/5-system/12-webhook.md WH-NF-02`.
2. **`413 → PAYLOAD_TOO_LARGE` 표준 매핑** — `GlobalExceptionFilter` 가 body-parser 등 http-errors 의 413(및 4xx) 을 표준 에러 봉투로 매핑(종전 413 → `INTERNAL_ERROR`/500 오매핑 교정). `api-convention §5.3·§6`·`error-handling §1.3` 에 `PAYLOAD_TOO_LARGE` 등재.

## Unreleased — webhook/manual 400 검증 실패 필드별 사유 `error.details[]` surface

### 변경 사항

1. **webhook/manual-trigger 400 검증 실패 응답이 필드별 사유를 `error.details[]` 로 노출** — required 파라미터 누락·타입 강제 변환 실패 시(`POST /api/hooks/:endpointPath` 의 `INVALID_WEBHOOK_PAYLOAD`, 수동 실행 `POST /api/workflows/:id/execute` 의 `INVALID_TRIGGER_PARAMETERS`), 응답이 공식 에러 봉투의 `error.details[]` 에 `{ field, code, message }` 를 담는다. `code` 는 `UPPER_SNAKE_CASE` field code(`MISSING_REQUIRED_FIELD`·`TYPE_COERCION_FAILED`). 종전에는 필드별 사유가 내부적으로 산출되나 `GlobalExceptionFilter` 가 `errors` 키를 버려(클라이언트는 `{ error: { code, message, requestId } }` 만 수신) **노출되지 않았다** — 본 변경은 누락된 필드 목록을 surface 하는 **additive** 변경이며, 종전 미노출 `errors[]` 를 소비하던 클라이언트는 없다. SoT: `spec/5-system/12-webhook.md §5.2`. 코드 변경은 `hooks.service`·`workflows.controller` 의 throw payload(`errors`→`details`)와 공용 헬퍼 `toTriggerParameterErrorDetails` 한정.

## Unreleased — model-config 부속 엔드포인트 hardening (listModels type 검증)

### 변경 사항

1. **`GET /api/model-configs/:id/models` — `type` 쿼리 런타임 검증** — `type` 파라미터에 `ParseEnumPipe` 를 적용해 허용값(`chat`·`embedding`) 외 값은 이제 `400 Bad Request` 로 거부한다. 종전에는 런타임 검증 없이 서비스 레이어로 전달됐다. Swagger `@ApiQuery` 가 이미 `enum: [chat, embedding]` 을 선언하고 있어 **스펙 준수 클라이언트에는 영향이 없으며**(`@ApiBadRequestResponse` 동반 문서화), 문서 외 값을 보내던 직접 호출 클라이언트만 400 을 받는다. 코드 변경은 컨트롤러 한정(`@Throttle` 상수화·`type` enum 단일 소스 파생 동반).

## Unreleased — 웹채팅 로더 arguments-replay 버그 수정

### 변경 사항

1. **웹채팅 로더 `arguments`-replay 버그 수정** — 스니펫 스텁의 `push(arguments)` 산출물(array-like 객체)이 `Array.isArray` 가드에 걸려 통째로 버려지면서 `boot` 를 포함한 모든 사전 큐 호출이 무증상 누락되던 문제를 해소했다(#709 원인). `Array.isArray` 가드를 `length` 기반 array-like 수용 + `Array.from` 정규화로 교체. 회귀 테스트 추가.

## Unreleased — model-config `:id/test` 인가 강화 (Viewer 차단, Editor+ 강제)

### Breaking changes

1. **`POST /api/model-configs/:id/test` — Viewer 호출 차단(Editor+ 강제)** — 종전 `@Roles` 부재로 워크스페이스 멤버 전원(Viewer 포함)이 호출 가능했으나, 이 엔드포인트는 과금 provider 호출(+embedding 차원 자동저장 PATCH 부수효과)을 일으키는 action-POST 이므로 이제 `@Roles('editor')` 로 게이트한다. Viewer 자격증명의 직접 API 호출은 이제 `403 FORBIDDEN` 을 받는다. UI 상 연결 테스트 버튼은 Editor+ 전용 모델 추가/수정 폼 안에 있어 도달 경로가 없고, 실질은 직접 API 인가 갭 차단이다. `GET /api/model-configs/:id/models`(조회)는 Viewer+ 를 유지한다. 권한 계약 SoT: `spec/2-navigation/6-config.md §3` + Rationale R-7, `spec/5-system/7-llm-client.md §8.3`.

### 변경 사항

소스 변경은 `LlmModelConfigController.testConnection` 에 `@Roles('editor')` + `@ApiForbiddenResponse` 추가뿐이다(behavior change = Viewer 직접 호출 403화). lint·unit·build·e2e 전부 통과.

## Unreleased — npm audit 취약점 해소 의존성 상향

### 변경 사항

1. **보안 취약점 의존성 업그레이드** — `npm audit` 의 모든 high/critical 제거 (backend 63→0 high·crit / frontend 9→0 / channel-web-chat 2→0). 직접 의존성은 상위 패키지를 올리고, 전이 의존성은 부모가 좁게 핀해 forward 가 불가능한 경우 `overrides` 로 안전 버전을 강제했다.

   - **backend**: `nodemailer` ^8.0.4 → ^9.0.1(메이저, raw 옵션 파일읽기/SSRF `<=9.0.0` 해소) · `@nestjs-modules/mailer` ^2.3.4 → ^2.3.7(부모 상향 — 취약 `preview-email`/`mailparser` 를 optional 로 분리) · `@opentelemetry/*` 0.218→0.219·core 2.7→2.8(`@opentelemetry/core` 메모리 누수 해소) · overrides 추가/상향: `ws` ^8.21.0(DoS) · `@grpc/grpc-js` ^1.14.4 · `multer` ^2.2.0(DoS) · `form-data` ^4.0.6(CRLF) · `protobufjs` ^7.5.6→^7.6.3 · `nodemailer` ^9.0.1(중첩 사본 강제).
   - **frontend**: `dompurify` ^3.4.2 → ^3.4.11(XSS) · overrides 추가: `ws` ^8.21.0 · `form-data` ^4.0.6 · `undici` ^7.28.0(TLS 검증 우회) · `vite` ^8.0.16 · `@babel/core` ^7.29.7.
   - **channel-web-chat**: `dompurify` 3.4.7 → 3.4.11(exact pin 유지).

   **잔여(accept)**: `js-yaml`(moderate, merge-key DoS) — gray-matter@4 가 3.x `safeLoad` API 에 묶여 forward 불가하며 빌드타임 신뢰 입력(자체 docs frontmatter)만 파싱하므로 실위험 없음. backend `@babel/core`(low) — 동일하게 빌드타임 신뢰 입력.

   소스 코드 변경 없음. build·unit·e2e 전부 통과.

## Unreleased — EIA submit_form 서버 측 field 검증

### 변경 사항

1. **`submit_form` 서버 측 field 검증 추가** — EIA `POST /external/executions/:id/interact` 의
   `submit_form` 커맨드가 이제 서버 측에서 form node field 정의(필수 여부 / 이메일·숫자 형식 /
   minLength·maxLength / 선택지)를 검증한다 (spec form §4·§6.2 / EIA §5.1).

   **검증 실패 시 응답 shape** (400 Bad Request):
   ```json
   { "error": { "code": "VALIDATION_ERROR", "message": "<검증 메시지>",
                "details": [{ "field": "<필드명>", "message": "<검증 메시지>", "code": "INVALID_FIELD" }] } }
   ```

   - 현재 단계 FIRST 오류만 surface (`details` 배열 길이 항상 1).
   - 검증 실패해도 `execution.status` 는 `waiting_for_input` 유지(재제출 가능).
   - WS ack 경로는 `errorCode='VALIDATION_ERROR'` 로 매핑됨 (`ExecutionError` 계층 자동 처리).

2. **`VALIDATION_ERROR` 에러코드 — `ErrorCode` enum 에 추가** (`codebase/backend/src/nodes/core/error-codes.ts`).
   기존 `MessageTooLongError` 등과 동일한 패턴으로 단일 SoT 로 관리.

## Unreleased — Code 노드 isolated-vm 전환 후속 (base64 TypeError + 메모리 한도 env)

### Breaking changes

1. **`$helpers.base64.encode/decode` — 비문자열 입력이 이제 `error` 포트로 분기**

   이전 동작: 비문자열(예: 숫자, 객체)을 전달하면 `String(data)` 로 암묵적 변환 후 정상 처리.
   신규 동작: 비문자열 입력 시 `TypeError`(`$helpers.base64.encode: data must be a string, got <type>`)
   를 throw → 코드 노드 `error` 포트로 분기.

   **영향받는 워크플로우**: `$helpers.base64.encode(42)` 처럼 비문자열을 명시 전달하던 코드.
   **조치**: 입력값을 `String(...)` 으로 명시 변환 후 전달하거나 `error` 포트 처리 추가.

   배경: `$helpers.crypto.hash` 와의 타입 계약 일관화. 자세한 Rationale 은
   `spec/4-nodes/5-data/2-code.md §Rationale "$helpers 입력 타입 계약"` 참조.

## Unreleased — KB 임베딩 legacy 컬럼 은퇴 + ModelConfig 에러코드 통일 (PR4b)

> **자사 클라이언트 무영향**: 아래 변경의 소비자는 자사 프론트엔드뿐이며, 프론트가 이미 신 에러코드를 처리하고 KB 요청에 `embeddingModelConfigId` 를 전송하도록 대응 완료된 상태에서 적용됐다. 외부 API 소비자가 없으므로 deprecation 윈도우·구코드 이중발행 없이 교체했다.

### Breaking changes

1. **에러코드 rename (ModelConfig 경로)** — 응답 `error.code` 슬롯:
   - `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` (400). 접두어를 `MODEL_CONFIG_*` 로 통일. 의미·status 변경 없음.
   - `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (400). id 미지정 시 워크스페이스 default config 부재 경로. id 부재(404)는 `MODEL_CONFIG_NOT_FOUND` 로 별도 분리(동일 코드의 404/400 이중 status 모호성 제거). rename 이력은 `spec/conventions/error-codes.md §4`.

2. **KB create/update DTO 에서 `embeddingModel`·`embeddingLlmConfigId` 필드 제거** — `POST`/`PATCH /api/knowledge-bases` 요청 body 에 이 두 필드를 보내도 **무시된다**(silent breaking). 임베딩 모델 선택은 `embeddingModelConfigId`(1급 `kind=embedding` ModelConfig 참조)로만 수행한다.

3. **KB 응답에서 `embeddingLlmConfigId` 제거, `embeddingModel` 은 read-only(derived) 로 변경** — `GET /api/knowledge-bases`, `GET /api/knowledge-bases/:id` 응답 shape 에서 `embeddingLlmConfigId` 필드가 제거됐다. `embeddingModel` 은 더 이상 저장 컬럼이 아니라 참조 ModelConfig 의 `defaultModel` 에서 파생되는 읽기 전용 값이다(워크스페이스에 embedding ModelConfig 가 없으면 빈 문자열). 변경은 `embeddingModelConfigId` 로만 가능하다.

### Migrations

- **V093** (`knowledge_base` 임베딩 repoint): `embedding_model_config_id IS NULL` 인 모든 KB 를 1급 `kind=embedding` ModelConfig 로 repoint(원래 provider·model·dimension 보존). repoint 불가 KB 가 1건이라도 있으면 fail-loud RAISE 로 전체 롤백(V094 미실행).
- **V094** (legacy 컬럼 DROP, **비가역**): `knowledge_base.embedding_llm_config_id`·`embedding_model` 컬럼과 FK 제약 DROP. `AccessExclusiveLock` 획득하므로 low-traffic 윈도우 배포 권장(`lock_timeout=3s`).

## Unreleased — AI 노드 설정 폼 auto-form 전환 (text_classifier · information_extractor)

- **`text_classifier` · `information_extractor` 설정 폼을 schema-driven auto-form 으로 전환** (cross-audit V-02). 기존 bespoke override 폼이 누락하던 필드 — Conversation Context 5필드, System Context 2필드, few-shot `examples`, `outputSchema[].enumValues`, `maxCollectionRetries`, (information_extractor) memory 전략 7필드 — 가 설정 패널에 정상 노출된다. 이전에는 Code 탭 JSON 으로만 설정 가능했다.

  **참고**: `text_classifier` 의 `includeConfidence` 신규 노드 기본값은 zod 스키마 정의(`false`, spec §1)를 따른다 — 구 bespoke 폼이 `true` 로 표시하던 것은 spec 과 어긋난 동작이었고 본 전환으로 교정됐다. 기존 저장된 설정값에는 영향이 없다.

## Unreleased — Health Probe Liveness/Readiness 분리

### Breaking changes

1. **`GET /api/health` — unhealthy 시 HTTP 200 → 503 반환** (이전: 항상 200)

   k8s readinessProbe 가 이 경로를 사용하며, 의존성(DB/Redis) 중 하나 이상이 비정상일 때 503 을 반환한다. 응답 body(`{ status, version, uptime, checks }`)는 200 과 동일하게 유지된다.

   **영향받는 소비자**: 외부 모니터링·알람 시스템이 `/api/health` 응답 코드 200 을 "정상" 기준으로 사용 중이라면 503 도 수용하도록 규칙을 갱신해야 한다.

2. **신규 `GET /api/health/live` 엔드포인트 추가** (liveness probe 전용)

   DB/Redis 를 점검하지 않고 프로세스 생존만 확인해 항상 200 을 반환한다 — `{ status: "ok" }`. k8s livenessProbe 를 이 경로로 변경해 DB 장애 시 Pod 크래시루프를 방지한다.

3. **`HEALTH_CHECK_LOG` 환경변수 추가** (기본 `false`)

   `false`(기본값)이면 `/api/health`, `/api/health/live` 프로브 성공 요청의 로그를 억제한다. 기존 배포에서 이 변수가 미설정인 경우 성공 로그가 묵시적으로 억제된다 — 운영 모니터링 로그 기반 알림 규칙을 확인하라. k8s `ConfigMap/backend-config` 에 `HEALTH_CHECK_LOG: "false"` 가 명시 반영되었다.

## Unreleased — execution-engine: _resumeCheckpoint schemaVersion 견고화 (PR-A2a)

- **execution-engine**: `_resumeCheckpoint` 에 `schemaVersion`(=1) 추가 — 롤링 배포 중 구 인스턴스가 신 포맷 checkpoint 를 pickup 할 경우 graceful `RESUME_INCOMPATIBLE_STATE` 로 종결. 버전 부재(기존 row) = legacy 허용(backward-compatible), 미래 버전(코드 미지원) = 재구성 포기 + 안전 재시작 유도.

## Unreleased — Node Output Contract Unification

Implements the CONVENTIONS rulebook in `spec/conventions/node-output.md` across all 26+ node handlers. Split over staged refactors (Stage 1–7 + follow-ups) all landing in this release.

### Breaking changes

Workflow authors referencing node output in `{{ … }}` expressions need to migrate or run the provided script. A dry-run is non-destructive:

```
npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
  --workspace-id <uuid> --user-id <uuid>
```

1. **`NodeHandlerOutput` contract** — every handler now returns `{ config, output, meta?, port?, status?, _resumeState? }`. Legacy `{ port, data }` and bare-object shapes are no longer produced by core handlers (the engine adapter still accepts bare returns for test doubles).
2. **Information Extractor** — `output.output.extracted.*` double-nesting removed. New path: `output.result.extracted.*`. `output.output.{messages, endReason, turnCount}` → `output.result.{messages, endReason, turnCount}`. `output.output.collectionRetryCount` → `meta.collectionRetryCount`. `output.output._turnDebugHistory` → `meta.turnDebug`.
3. **AI Agent** — single-turn, multi-turn terminal, and condition-triggered outputs unified under `output.result.{response, messages, turnCount, endReason, condition?}`. Tokens and tool-call counts migrated from `output.metadata.*` to top-level `meta.*`. Condition trigger no longer uses the legacy `{ port, data }` envelope.
4. **Text Classifier** — single-label: `output.category` → `output.result.category` (+ `output.result.confidence`). Multi-label: `output.categories` → `output.result.categories`. Tokens stay on `meta.*`.
5. **Presentation nodes (form / carousel / chart / table / template)** — removed the `output.type` discriminator and the literal-config echo fields (`layout`, `chartType`, `columns`, `items` (static), `format`, `title`, `fields`, `submitLabel`). Those literal values are now read via `$node["X"].config.*` (CONVENTIONS §1.1). Template renames `output.content` → `output.rendered`.
6. **Form resume** — `status: 'submitted'` removed; the engine now emits `status: 'resumed'` + `output.interaction.{type:'form_submitted', data, receivedAt}`. Legacy `output.submittedData` is migrated to `output.interaction.data`.
7. **Button-based presentation resume** — `status: 'button_click' | 'button_continue'` collapsed into `status: 'resumed'` with the original value preserved in `output.interaction.type`. Migration script auto-substitutes `status === '<old>'` comparisons but operators should verify the matching `output.interaction.type` branch exists.
8. **Container nodes (loop / foreach / map / parallel)** — the engine no longer overwrites container output with a flat array. It now emits `{ iterations | items | mapped | branches, count }` on the `done` port (CONVENTIONS §9.2). `$node["Loop"].output[0]` style access is no longer valid — use `$node["Loop"].output.iterations[0]`.
9. **Runtime error envelope** — all nodes that can fail at runtime (http_request, database_query, send_email, code, ai_agent, text_classifier, information_extractor, workflow) now route to `port: 'error'` with `output.error: { code, message, details? }`. Pre-flight errors continue to throw as before.
10. **Error code rename** — in the `output.error.code` slot:
    - `QUERY_FAILED` → `DB_QUERY_FAILED`
    - `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` (with the original `IntegrationError` code preserved in `details.integrationCode`)
    - `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` → `CODE_EXECUTION_FAILED`
    - `EXECUTION_TIMEOUT` (code node only) → `CODE_TIMEOUT`
    - `HTTP_5XX` / `HTTP_4XX` added (non-2xx responses now carry both `output.response` and `output.error`)
    - `SUB_WORKFLOW_FAILED` added
    - New interaction-level codes reserved: `USER_CANCELLED`, `INTERACTION_TIMEOUT`
11. **`workflow` and `send_email` schemas** — added `error` port. Sub-workflow runtime failures are now routed rather than thrown; un-connected `error` ports fall back to the Stop Workflow policy documented in `spec/5-system/3-error-handling.md §3.2`.
12. **`send_email.subject`, `send_email.to`, `send_email.cc`, `send_email.bodyType`** — moved from top-level handler output to `config`.
13. **HTTP request** — `output.statusCode` / `output.duration` / `output.headers` moved from `output` to `meta`. URL-level credentials (`https://user:pass@…`) are stripped in `config.url` AND `output.error.details.url`.
14. **`NodeHandlerOutput.config` echoes raw template** (PRD `ENG-RC-*`, CONVENTIONS Principle 7). Handlers now receive both `context.rawConfig` (pre-evaluation, frozen snapshot of `node.config`) and the evaluated `config` argument. The echoed `config.*` is the **raw** value the workflow author entered (`{{ ... }}` preserved); the evaluation result lives on `output.*`. Workflows that referenced `$node["X"].config.<expression-field>` for the evaluated value must switch to `$node["X"].output.<field>`. The migration script handles common field renames (Send Email subject/body/bodyType, HTTP Request url and similar). Expression-free fields (`mode`, `chartType`, etc.) are unaffected — raw and evaluated coincide.
15. **Send Email — new `output` fields** (additive): `output.subject`, `output.body`, `output.bodyType` (evaluated values that actually went on the wire); `output.bodyTruncated: true` when `output.body` exceeded the 256KB cap (`Buffer.byteLength` UTF-8). The standardized `output.error` envelope still carries the failed body for debugging.
16. **HTTP Request — new `output` fields** (additive): `output.requestBody`, `output.requestBodyType` (evaluated request body that hit the wire, capped at 256KB with `bodyTruncated`); `output.responseHeaders` (sanitized response headers — credential-shaped values redacted with hybrid blacklist + pattern match). Transport errors omit `responseHeaders` (no `Response` available).

### Replay / View Policy (new)

The execution-history UI displays `NodeExecution.outputData` as-is — the engine does **not** re-evaluate stored config or re-trigger external side effects when you open an execution row. This is **View** mode: zero side effects, zero expression evaluation.

**Re-run** (new Execution that re-evaluates the current workflow definition's raw config — re-triggers emails, HTTP calls, DB writes) is **not implemented** in this release. When introduced (future PRD), it will be a distinct user action with explicit safeguards (confirmation, dry-run option, idempotency keys).

**Multi-turn resume** (`POST /executions/:id/continue`) is not replay — it is the same Execution proceeding to its next turn, using the `state.rawConfig` frozen snapshot so workflow edits made during the wait do not affect the in-flight session.

Pre-release `NodeExecution` rows have `outputData.config` in evaluated form (no rawConfig exposure yet) and lack the new `output.{subject, body, requestBody, responseHeaders, bodyTruncated}` fields on Send Email / HTTP Request. These rows are **not backfilled** — they remain as historical records. Live execution behaviour is unaffected (each Execution uses its own `nodeOutputCache`; there is no cross-execution expression reference).

See [Spec 실행 엔진 §6.3](spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) for the canonical policy.

### Internal / Infrastructure

- Handler-output adapter (`backend/src/modules/execution-engine/handler-output.adapter.ts`) simplified to a strict new-shape pass-through plus a narrow legacy-bare wrapper for tests. The legacy `{ port, data }` branch is removed. In `NODE_ENV==='production'` the adapter throws on any non-canonical return (production handlers are type-checked, so this catches bugs early); test/dev keeps lenient coercion via the exported `wrapBareAsNodeHandlerOutput()` helper.
- Expression resolver always reads from the structured cache; the `{ output: flat }` shim branch is retained only for pre-seeded test fixtures that skip the structured cache.
- `_multiTurnState` → `_resumeState` rename. Engine reads `_resumeState ?? _multiTurnState` to protect in-flight multi-turn sessions across deploys. The dual-read will be retired one release after all handlers emit `_resumeState` (currently: ai_agent, information_extractor).
- Migration script `backend/scripts/migrate-node-output-refs.ts` now runs the entire `--apply` phase inside a single DB transaction, requires `--workspace-id <uuid> --user-id <uuid>` for the audit row, and emits audit-only hits for legacy fields that cannot be safely rewritten (`output.error.nodeId` / `nodeType` / `timestamp` / `originalInput`, `output.type` discriminator).

### Migration steps for workflow authors

1. **Dry-run the migration** to see every change that will be applied to stored workflow expressions:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
   ```
2. **Review audit-only hits** in the dry-run output (marked "manual review needed"). These cannot be auto-rewritten — edit affected nodes in the editor.
3. **Confirm no live multi-turn AI sessions are in flight** (pending `waiting_for_input`). The `_multiTurnState`→`_resumeState` dual-read protects most sessions, but a belt-and-suspenders check before deploy is recommended.
4. **Apply** with the new CLI flags:
   ```
   npx ts-node backend/scripts/migrate-node-output-refs.ts --apply \
     --workspace-id <uuid> --user-id <uuid>
   ```
5. **Verify** by running representative workflows. The migration is idempotent — re-running is safe.

### Test infrastructure

- **`make e2e-*` 가 매 실행마다 backend 이미지를 자동 rebuild** — `Makefile` 의 `e2e-up` / `e2e-test` / `e2e-test-full` 가 `docker compose ... --build` 를 명시. 누락 시 Docker layer cache 에 박힌 stale 이미지가 재사용되어 새로 추가한 컨트롤러 (예: `BackgroundRunsController`, `ThirdPartyOAuthController`) 가 컨테이너에 반영되지 않고 e2e 가 사일런트 404 로 실패하는 회귀가 발생함 (2026-05-15 background-monitoring 사례). BuildKit layer cache 가 변경 없는 layer 는 재사용하므로 첫 build 이후 부담은 작음.
