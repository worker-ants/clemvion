# 신규 식별자 충돌 검토 결과 — PR2 구현 착수 직전

## 발견사항

### [INFO] DB 마이그레이션 V059 — 비어있음, 사용 가능

- 신규 식별자: `V059__trigger_notification_interaction_columns.sql` (예시)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/backend/migrations/` 마지막 파일은 `V058__login_history_webauthn_failed_event.sql`
- 상세: V058 까지 순차 사용됨. V059 슬롯 비어있음. 충돌 없음.
- 제안: 없음. 그대로 사용.

---

### [INFO] NestJS 모듈명 `external-interaction` — 충돌 없음

- 신규 식별자: `codebase/backend/src/modules/external-interaction/`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/backend/src/modules/` 목록에 `alerts`, `audit-logs`, `auth`, `auth-configs`, `dashboard`, `edges`, `execution-engine`, `executions`, `folders`, `health`, `hooks`, `integrations`, `knowledge-base`, `llm`, `llm-config`, `mail`, `mcp`, `node-executions`, `nodes`, `notifications`, `schedules`, `statistics`, `triggers`, `users`, `websocket`, `workflow-assistant`, `workflow-versions`, `workflows`, `workspaces` 존재.
- 상세: `external-interaction` 이라는 디렉토리/모듈 이름은 기존 목록에 없음. `from '../external-interaction/...'` import path 도 기존 코드에서 사용되는 파일 없음 (검색 결과 NO MATCHES).
- 제안: 없음. 그대로 사용.

---

### [INFO] REST endpoint 경로 — 충돌 없음

- 신규 식별자: `POST/GET /api/external/executions/:id/interact`, `/stream`, `/cancel`, `/refresh-token`
- 기존 사용처:
  - `ExecutionsController` — `@Controller('executions')` → `/api/executions/:id`, `/api/executions/:id/stop`, `/api/executions/:id/continue`
  - `BackgroundRunsController` — `@Controller('executions/:executionId/background-runs')`
  - `HooksController` — `@Controller('hooks')`
  - `TriggersController` — `@Controller('triggers')`
- 상세: 신규 컨트롤러는 `@Controller('external/executions')` 형태 예정. 전역 prefix `api` 가 붙으면 `/api/external/executions/...`. 기존 `/api/executions/...` 와 첫 segment 가 `external/executions` vs `executions` 로 명확히 다르므로 NestJS 라우터에서 모호성 없음. `/api/triggers/:id/notification/rotate-secret`, `/api/triggers/:id/interaction/revoke-token` 도 기존 TriggersController 에서 미등록된 경로.
- 제안: 없음. 그대로 사용.

---

### [INFO] BullMQ 큐 이름 `notification:webhook` — 충돌 없음

- 신규 식별자: 큐 이름 `notification:webhook`
- 기존 사용처:
  - `background-execution` (`BACKGROUND_EXECUTION_QUEUE`)
  - `schedule-execution` (`SCHEDULE_QUEUE`)
  - `alerts-evaluator` (`ALERTS_EVALUATOR_QUEUE`)
  - `integration-expiry-scanner` (`INTEGRATION_EXPIRY_QUEUE`)
  - `cafe24-token-refresh` (`CAFE24_REFRESH_QUEUE`)
  - `document-embedding` (`DOCUMENT_EMBEDDING_QUEUE`)
  - `graph-extraction` (`GRAPH_EXTRACTION_QUEUE`)
- 상세: 기존 큐 이름은 모두 케밥-케이스 단일 세그먼트. `notification:webhook` 은 콜론 구분 네임스페이스 형태로 기존 이름 중 어느 것과도 문자열 충돌 없음. `notifications` 모듈은 BullMQ를 사용하지 않음.
- 제안: 없음. 그러나 기존 큐 명명 컨벤션 (케밥-케이스) 과 형태가 다르므로, 일관성 차원에서 `notification-webhook` 도 고려할 수 있음. 단 spec EIA-NX 에서 `notification:webhook` 으로 명시되어 있으면 spec 우선.

---

### [INFO] Redis 키 prefix — 충돌 없음

- 신규 식별자: `iext:blacklist:<jti>`, `notification:dispatch:<deliveryId>`, `interaction:idempotency:<key>`
- 기존 사용처:
  - `execution:continuation` (CONTINUATION_CHANNEL, pub/sub)
  - `exec:recover:lock` (RECOVERY_LOCK_KEY)
  - `cafe24:install:nonce:<mallId>:<timestamp>:<hmac:8>`
  - WebSocket 채널: `execution:`, `kb:`, `background:run:`
- 상세: `iext:` prefix 는 완전히 새로운 네임스페이스. `notification:dispatch:` 는 BullMQ 큐 이름과 같은 네임스페이스(`notification:webhook`)를 공유하지만 Redis 키 vs BullMQ 큐는 다른 keyspace (BullMQ 는 `bull:` prefix 를 자동 추가)이므로 런타임 충돌 없음. `interaction:idempotency:` 도 기존 어떤 Redis 키/채널과도 겹치지 않음.
- 제안: 없음.

---

### [INFO] JWT Bearer scheme `interaction-token` — 충돌 없음

- 신규 식별자: `interaction-token` (Swagger `addBearerAuth` 두 번째 인자)
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/backend/src/main.ts` line 89 — `'access-token'` 단 하나만 등록됨.
- 상세: Swagger security scheme 이름 공간에서 `access-token` 과 `interaction-token` 은 완전히 다른 문자열. NestJS `@ApiBearerAuth('interaction-token')` 데코레이터도 기존 어디에서도 사용되지 않음.
- 제안: 없음.

---

### [INFO] HTTP 헤더 `X-Clemvion-*` 시리즈 — 충돌 없음

- 신규 식별자: `X-Clemvion-Event`, `X-Clemvion-Execution-Id`, `X-Clemvion-Trigger-Id`, `X-Clemvion-Workflow-Id`, `X-Clemvion-Delivery`, `X-Clemvion-Timestamp`, `X-Clemvion-Signature`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/backend/src/modules/integrations/services/service-registry.ts` line 616 — `X-Signature` (prefix 없음, 수신 웹훅 서명 헤더 기본값으로만 사용). 그 외 `X-Clemvion-` prefix 를 사용하는 코드 없음. `sanitize-response-headers.util.ts` 의 `x-auth-token` 은 다른 prefix.
- 상세: `X-Clemvion-` prefix 는 프로젝트 전체에서 신규 도입. 기존 `X-Signature` 와 이름 공간 완전 분리.
- 제안: 없음.

---

### [INFO] 환경변수 `ALLOW_HTTP_HOOKS` — 기존 codebase 충돌 없음

- 신규 식별자: `ALLOW_HTTP_HOOKS` (또는 `ALLOW_HTTP_HOOKS=1`)
- 기존 사용처: `codebase/backend/.env.example` 에서 `ALLOW_HTTP_HOOKS` 키 없음. 유사 변수로 `MCP_ALLOW_INSECURE_URL`, `ALLOW_PRIVATE_HOST_TARGETS` 가 있으나 다른 기능 담당.
- 상세: spec `14-external-interaction-api.md` line 45 와 `plan/in-progress/external-interaction-api.md` line 100 에서 정의됨. codebase 에는 아직 미구현. 기존 ENV 이름과 충돌 없음.
- 제안: `.env.example` 에 `ALLOW_HTTP_HOOKS=false` 항목을 추가 시 `ALLOW_PRIVATE_HOST_TARGETS` 와 함께 `# SSRF / URL validation` 섹션에 배치하면 일관성 유지.

---

### [INFO] i18n dict 섹션 — `triggers.ts` 가 적합한 위치

- 신규 식별자: notification / interaction 관련 i18n 키 (notification URL, 이벤트 목록, interaction 활성화 토글 등)
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 가 이미 존재하며 webhook trigger 관련 전체 UI 문자열 포함.
- 상세: notification·interaction 설정은 trigger 상세 드로어 내 섹션이므로 `triggers.ts` 에 추가하는 것이 자연스럽다. 별도 파일 신설 시 `index.ts` 에 re-export 추가 필요. `notifications.ts` 는 없으므로 새 파일 이름이 기존 파일과 충돌하지 않음.
- 제안: `triggers.ts` 에 `notification: { ... }` 와 `interaction: { ... }` 서브 키를 추가하는 방식 권장. 파일 신설 불필요.

---

### [INFO] 신규 파일 경로 — 모두 비어있음

- 신규 식별자:
  - `codebase/backend/src/modules/external-interaction/` (디렉토리)
  - `codebase/backend/test/e2e/external-interaction.e2e-spec.ts`
  - SDK 패키지 경로
- 기존 사용처:
  - `external-interaction` 디렉토리 미존재 확인 완료.
  - e2e 디렉토리에 `external*` 파일 없음 확인 완료.
  - `codebase/packages/` 하위에 `expression-engine`, `node-summary` 만 존재. `sdk` 디렉토리 없음.
- 상세: 모든 신규 경로가 비어있어 충돌 없음. 기존 패키지는 `@workflow/<name>` scope 를 사용 (`@workflow/expression-engine`, `@workflow/node-summary`).
- 제안: SDK 패키지 이름을 `@workflow/sdk` 또는 `@clemvion/sdk` 로 결정할 필요 있음. 기존 패키지 scope 인 `@workflow` 를 따르면 `@workflow/sdk`, 브랜드 정합성을 원하면 `@clemvion/sdk`. 기존 scope 와 일치성 차원에서 `@workflow/sdk` 권장하나 외부 npm 배포 목적이라면 `@clemvion/sdk` 가 더 적합. 구현 전 결정 필요.

---

### [WARNING] `interaction` 필드명 — 기존 node output 스키마와 동일한 필드명

- 신규 식별자: `WebhookAcceptedDto` 의 신규 `interaction` 필드 (`hooks` 응답 확장)
- 기존 사용처:
  - `codebase/backend/src/nodes/presentation/form/form.schema.ts` — `output.interaction` 필드
  - `codebase/backend/src/nodes/presentation/table/table.schema.ts` — `output.interaction` 필드
  - `codebase/backend/src/nodes/presentation/template/template.schema.ts` — `output.interaction` 필드
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — `output.interaction` 필드
  - `codebase/backend/src/shared/conversation-thread/thread-renderer.ts` — `InteractionLike` 타입
  - `codebase/backend/src/nodes/core/node-type-metadata.ts` — `metadata.interaction: 'form'`
- 상세: `interaction` 이라는 필드명 자체는 프로젝트 내에서 이미 광범위하게 사용 중 (노드 실행 결과 구조). `WebhookAcceptedDto.interaction` 은 HTTP 응답 최상위 레벨의 새 필드이므로 타입 충돌은 없지만, 동일 단어가 전혀 다른 맥락(node output vs webhook 응답의 interaction token 메타)에서 쓰이는 점에서 혼동 가능. 개발자가 `interaction` 검색 시 두 의미가 섞여 나올 수 있음.
- 제안: `WebhookAcceptedDto` 의 신규 필드를 `interactionToken` 또는 `externalInteraction` 으로 더 구체화하는 것을 고려. 단 spec 에서 `interaction` 으로 명시되어 있다면 spec 변경 없이 구현하되 JSDoc 주석으로 맥락 명확화.

---

## 요약

PR2 구현에서 신설할 모든 핵심 식별자(V059 마이그레이션, `external-interaction` 모듈, `/api/external/executions/...` 라우트, `notification:webhook` BullMQ 큐, `iext:` / `notification:dispatch:` / `interaction:idempotency:` Redis 키, `interaction-token` Bearer scheme, `X-Clemvion-*` 헤더, `ALLOW_HTTP_HOOKS` 환경변수)는 기존 codebase 에서 사용되지 않으며 충돌이 없다. 경고 수준(WARNING)으로 분류된 사항은 하나로, `WebhookAcceptedDto` 에 추가할 `interaction` 필드명이 기존 노드 출력 스키마에서 이미 다른 의미로 사용되는 동명 필드와 혼동될 수 있다는 점이다. SDK 패키지 scope 결정(`@workflow/sdk` vs `@clemvion/sdk`)은 구현 착수 전 명시적 결정이 필요하나 기존 식별자와 충돌하지는 않는다. BLOCK 수준 충돌은 없다.

## 위험도

LOW

---

STATUS: PASS
