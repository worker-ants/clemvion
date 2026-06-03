---
id: common
status: partial
code:
  - codebase/backend/src/nodes/integration/_base/integration-handler-base.ts
  - codebase/backend/src/nodes/integration/*/*.handler.ts
  - codebase/backend/src/modules/integrations/integrations.service.ts
  - codebase/frontend/src/lib/utils/node-config-summary.ts
pending_plans:
  - plan/in-progress/spec-sync-integration-common-gaps.md
---

# Spec: Integration 노드 공통 규약

> 관련 문서: [PRD Integration 노드](../_product-overview.md#7-integration-노드-3종) · [PRD 통합/연동](./_product-overview.md) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 데이터 모델](../../1-data-model.md) · [Spec 실행 엔진 §10 Integration Handler 계약](../../5-system/4-execution-engine.md#10-integration-handler-계약)

본 문서는 Integration 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [HTTP Request](./1-http-request.md)
- [Database Query](./2-database-query.md)
- [Send Email](./3-send-email.md)

> **본 문서의 범위**: 워크플로 캔버스에 직접 배치되는 Integration 노드(HTTP Request, Database Query, Send Email)의 공통 규약을 다룬다. Integration 엔티티(`service_type='mcp'`)는 워크플로 노드로 노출되지 않고 AI Agent 노드 내부의 `mcpServers` 설정에서만 활용되며, 그 동작·도구 노출 모델은 [Spec MCP Client](../../5-system/11-mcp-client.md) 와 [Spec AI Agent](../3-ai/1-ai-agent.md) 에서 정의한다. 즉 Integration 엔티티는 (a) 본 문서의 노드와 (b) AI Agent MCP provider 두 가지 사용처를 가진다.

---

## 1. Integration 참조

모든 서비스 특화 Integration 노드는 `integrationId` 설정을 통해 Integration 엔티티([데이터 모델 §2.10](../../1-data-model.md#210-integration))에 저장된 인증 정보를 참조한다.

| 설정 필드 | 타입 | 설명 |
|-----------|------|------|
| integrationId | UUID | FK → Integration. 설정 UI에서 드롭다운으로 선택 |

## 2. Integration 선택 UI

- 노드 설정 패널 상단에 Integration 선택 드롭다운 표시
- 워크스페이스에 등록된 해당 서비스 타입의 Integration만 필터링하여 표시
- 개인/조직 Integration 구분 표시
- 연결 상태(connected/expired/error) 배지 표시
- "새 Integration 추가" 링크 → Integration 관리 화면으로 이동

## 3. 공통 출력 구조

모든 Integration 노드의 출력은 CONVENTIONS Principle 7 / §3 의 nested envelope 을 따른다 — `config` 는 워크플로 작성자가 입력한 raw 설정, `output` 은 평가 결과, `meta` 는 실행 메타데이터, `port` 는 포트 라우팅 (생략 시 success 계열 기본 포트).

```json
{
  "config": { /* 노드별 raw 설정 echo */ },
  "output": { /* 노드별 평가 결과 */ },
  "meta": { "statusCode": 200, "durationMs": 150 },
  "port": "success"
}
```

각 노드별 정확한 `config`·`output`·`meta` 필드 셋은 노드별 문서의 "출력 구조" 섹션에서 정의한다. **모든 Integration 노드의 시간 메트릭은 `meta.durationMs` 로 통일** (§6.1 참조). 옛 `meta.duration` (http_request) 은 폐지됐다.

---

## 4. Handler 실행 세멘틱

Integration 노드의 실제 외부 호출 책임은 Execution Engine의 핸들러가 진다. 모든 Integration 핸들러는 다음 공통 계약을 따른다 — 세부는 [Spec 실행 엔진 §10 Integration Handler 계약](../../5-system/4-execution-engine.md#10-integration-handler-계약) 참조.

### 4.1 공통 계약

| 단계 | 책임 |
|------|------|
| 1. 워크스페이스 확인 | `ExecutionContext.variables.__workspaceId` 조회. 없으면 즉시 오류 |
| 2. Integration 조회 | `IntegrationsService.getForExecution(integrationId, workspaceId)` 호출. credentials는 AES-256-GCM transformer로 자동 복호화됨 |
| 3. 타입/상태 검증 | `serviceType`이 노드 기대값과 일치 + `status === 'connected'` 검증 |
| 4. Credential 충족 검증 | 서비스별 필수 필드 누락 시 `INTEGRATION_INCOMPLETE` |
| 5. 외부 호출 | 서비스별 SDK/드라이버 호출 |
| 6. Usage 로깅 | 성공·실패 무관 `IntegrationsService.logUsage({integrationId, nodeExecutionId, workflowId, status, durationMs, error?, api?})` 호출. **`api` 식별 정보 동반 의무** — `{ label?, method?, path? }` 를 함께 전달해 `integration_usage_log.api_label`/`api_method`/`api_path` 에 적재한다. 통합별 채우기 정책은 [`_product-overview.md INT-US-05`](./_product-overview.md#24-사용처-추적-및-라이프사이클) 표가 단일 진실. 길이 초과 시 백엔드 (`logUsage` 내부) 가 `varchar(128)`/`varchar(8)`/`varchar(256)` 한도로 자르고 끝에 `…` 부여 (`clampMessage` 패턴) — 호출자가 자체 truncate 할 책임 없음 |

### 4.2 공통 에러 코드

| 코드 | 의미 |
|------|------|
| `INTEGRATION_TYPE_MISMATCH` | 참조된 Integration의 `serviceType`이 노드 기대 타입과 다름. `resolveIntegration` 이 `IntegrationError` throw |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected`가 아님(`expired`, `error`). `resolveIntegration` 이 `IntegrationError` throw |
| `INTEGRATION_INCOMPLETE` | credentials JSONB에 서비스별 필수 필드가 누락. 각 핸들러가 자격증명 검증 시 `IntegrationError` throw |
| `INTEGRATION_CALL_FAILED` | 기타 일반 예외(분류되지 않은 실패). `IntegrationError` 가 아닌 throw 의 기본 코드 (`toLogError` fallback) |

> **integrationId 부재/소속 오류**: `IntegrationsService.getForExecution → requireEntity` 는 integrationId 가 존재하지 않거나 현재 워크스페이스에 속하지 않을 때 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 throw 한다. 이는 `IntegrationError` 가 아니므로 핸들러 catch 에서 전용 코드로 보존되지 않고 `INTEGRATION_CALL_FAILED` (또는 send-email 의 경우 `EMAIL_SEND_FAILED`) 로 surface 된다. 즉 별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 (`integrations.service.ts` `requireEntity`; `_base/integration-handler-base.ts` `toLogError`).

> **D4 결정**: 위 코드들이 발생하는 모든 경우는 핸들러 내부에서 catch 되어 `port: 'error'` + `output.error.{code, message, details?}` envelope 로 라우팅된다. Integration 노드 (HTTP / Database Query / Send Email / Cafe24 / MakeShop) 모두 send-email 의 catch 패턴으로 통일한다. **`IntegrationError` 가 throw → 노드 실행 실패** 경로는 존재하지 않으며, 모든 `IntegrationError.code` 는 `output.error.code` 로 surface 된다. Usage 로그 (`status: 'failed'` + `error: {code, message}`) 는 동일하게 기록한다.

---

## 5. 캔버스 요약

캔버스 요약은 노드 schema 의 `summaryTemplate` (백엔드 SoT) 을 프론트가 `renderSummaryTemplate` 으로 렌더하고, `truncateSummary` 로 라인 전체를 **40자** 한도(초과 시 마지막 1자를 `…` 로 치환)로 자른다. 즉 잘림은 노드별 부분 필드가 아니라 렌더된 한 줄 전체에 적용된다 (`codebase/frontend/src/lib/utils/node-config-summary.ts`).

| 노드 | 요약 포맷 | 예시 | 상태 |
|------|-----------|------|------|
| HTTP Request | `{{method\|default:GET}} {{url}}` (라인 40자 초과 시 잘림) | `GET https://api.example.com/v1/users…` | 구현됨 (`http-request.schema.ts` `summaryTemplate`) |
| Cafe24 | `{{resource}} · {{operation}}` (라인 40자 초과 시 잘림) | `product · product_list` | 구현됨 (`cafe24.schema.ts` `summaryTemplate`) |
| MakeShop | `{{resource}} · {{operation}}` (라인 40자 초과 시 잘림) | `product · get-product` | 구현됨 (`makeshop.schema.ts` `summaryTemplate`) |
| Database Query | `{{queryType\|upper}} · {{query}}` (라인 40자 초과 시 잘림) | `SELECT · SELECT * FROM us…` | 구현됨 (`database-query.schema.ts` `summaryTemplate`) |
| Send Email | `{{to.length}} recipients · {{subject}}` (라인 40자 초과 시 잘림) | `2 recipients · Welcome` | 구현됨 (`send-email.schema.ts` `summaryTemplate`) |

> **downscope 근거**: Database Query 의 "쿼리 첫 줄" 과 Send Email 의 "to: {수신자} +N" 은 summaryTemplate DSL 이 개행 분리·배열 슬라이스/조건 카운트를 지원하지 않아 표현 불가하다. 따라서 각각 전체 query truncate (`{{query}}`) 와 수신자 수 + 제목 (`{{to.length}} recipients · {{subject}}`) 으로 downscope 했다 ([4-nodes/0-overview §1.4.1](../0-overview.md#141-템플릿-문법-filter-dsl)).

> **계획 (미구현)**: Integration 노드에서 연결된 Integration이 삭제된 경우 `⚠ Missing integration` (앰버색) 배지 표시. 현재 코드에는 이 배지를 생성하는 문자열/`warningRule` 이 없으며(문서 mdx 에만 기술), 캔버스 경고는 schema 의 `warningRules` 평가 결과(`evaluateWarnings`)로만 노출된다. 삭제된 Integration 참조를 감지하는 warningRule 은 미구현이다.

---

## 6. 5필드 공통 규약 (Integration 카테고리)

Integration 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-output.md) 의 5필드 invariant `{ config, output, meta?, port?, status? }` 를 따른다. 카테고리 특이 사용 패턴 (§3 의 형식과 동일):

| 필드 | Integration 카테고리에서의 사용 패턴 |
|------|----------------------------------------|
| `config` | 사용자 입력 raw echo (Principle 7). HTTP `headers` / `body`, DB `query`, Email `subject` / `body` 의 expression 템플릿 보존. **자격증명은 echo 금지** — `integrationId` 만 echo |
| `output` | 외부 호출 결과의 도메인 데이터. HTTP: `output.response` / `output.responseHeaders` (성공). DB: `output.rows` / `output.rowCount` / `output.insertId?`. Email: `output.messageId`. 실패: `output.error.{code, message, details?}` (Principle 3.2) |
| `meta` | 실행 메트릭만 (Principle 2). 모든 노드 공통: `meta.durationMs`. HTTP: `meta.statusCode`. DB: `meta.rowCount` (output.rowCount 와 중복 가능 — output 은 도메인, meta 는 메트릭 측면). 명명 통일은 §6.1 |
| `port` | `'success'` (또는 default 단일 출력) / `'error'` (Principle 3) |
| `status` | Integration 노드는 비-블로킹 → `undefined` |

### 6.1 `meta.duration` vs `meta.durationMs` 명명 통일

§3 에서 명시한 명명 차이(`meta.duration` HTTP / `meta.durationMs` Send Email)는 **`meta.durationMs` 로 통일**한다 (모든 노드, 단위는 ms). 이미 spec/5-system 의 다른 문서들이 `meta.durationMs` 를 사용 중이며, ms 단위가 명시적이다.

| 노드 | 변경 전 | 변경 후 |
|------|---------|---------|
| `http_request` | `meta.duration` | `meta.durationMs` |
| `database_query` | `meta.durationMs` (이미 동일) | `meta.durationMs` |
| `send_email` | `meta.durationMs` (이미 동일) | `meta.durationMs` |

> ⚠ **Breaking change**: `http_request` 의 `meta.duration` → `meta.durationMs`. 기존 expression `$node["X"].meta.duration` 을 사용하는 워크플로우는 정정 필요.

## 7. 출력 구조 색인

Integration 노드(HTTP / Database Query / Send Email / Cafe24 / MakeShop)는 단일 에러 경로 (`port: 'error'` + `output.error.*`) 만 사용한다.

| 노드 | 정상 케이스 | 에러 케이스 (단일 경로) |
|------|-------------|--------------------------|
| [http_request](./1-http-request.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) — 4xx/5xx + transport + integration resolve 실패 + SSRF 차단 모두 통합 |
| [database_query](./2-database-query.md#5-출력-구조) | §5.1 | §5.3 (`error`) — driver 에러 + integration resolve 실패 + 자격증명 누락 + invalid parameters 모두 통합 |
| [send_email](./3-send-email.md#5-출력-구조) | §5.1 | §5.3 (`error`) — 이미 통합되어 있던 reference 패턴 |
| [cafe24](./4-cafe24.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) — API 호출 실패 + Resource/Operation 검증 + mall_id 누락 + integration resolve 실패 모두 통합 |
| [makeshop](./5-makeshop.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) — API 호출 실패 + Resource/Operation 검증 + shop_uid 누락 + integration resolve 실패 모두 통합 |
