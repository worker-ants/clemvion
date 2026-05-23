---
id: common
status: spec-only
code: []
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
| 6. Usage 로깅 | 성공·실패 무관 `IntegrationsService.logUsage({integrationId, nodeExecutionId, workflowId, status, durationMs, error?})` 호출 |

### 4.2 공통 에러 코드

| 코드 | 의미 |
|------|------|
| `INTEGRATION_NOT_FOUND` | integrationId가 존재하지 않거나 현재 워크스페이스에 속하지 않음 |
| `INTEGRATION_TYPE_MISMATCH` | 참조된 Integration의 `serviceType`이 노드 기대 타입과 다름 |
| `INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected`가 아님(`expired`, `error`) |
| `INTEGRATION_INCOMPLETE` | credentials JSONB에 서비스별 필수 필드가 누락 |
| `INTEGRATION_CALL_FAILED` | 기타 일반 예외(분류되지 않은 실패) |

> **D4 결정 (2026-05-17, plan/in-progress/node-output-redesign)**: 위 코드들이 발생하는 모든 경우는 핸들러 내부에서 catch 되어 `port: 'error'` + `output.error.{code, message, details?}` envelope 로 라우팅된다. 종전 일부 노드 (HTTP / DB / cafe24) 에서 pre-flight 단계의 `IntegrationError` 가 throw → 노드 실행 실패로 처리되던 비대칭 동작은 폐기 — Integration 4종 (HTTP / Database Query / Send Email / Cafe24) 모두 send-email 의 catch 패턴으로 통일. **`IntegrationError` 가 throw → 노드 실행 실패** 경로는 더 이상 존재하지 않으며, 모든 `IntegrationError.code` 는 `output.error.code` 로 surface 된다. Usage 로그 (`status: 'failed'` + `error: {code, message}`) 는 양쪽 경로 모두에서 동일하게 기록.

---

## 5. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| HTTP Request | `{method} {url}` (URL 35자 초과 시 잘림) | `GET https://api.exam...` |
| Database Query | `{queryType} · {쿼리 첫 줄}` (잘림) | `SELECT · SELECT * FROM us...` |
| Send Email | `to: {수신자}`. 수신자 2명 초과 시 `+N` 표시 | `to: user@exam..., +2` |
| Cafe24 | `{resource} · {operation}` (35자 초과 시 잘림) | `product · product_list` |

Integration 노드에서 연결된 Integration이 삭제된 경우 `⚠ Missing integration` (앰버색)을 표시한다.

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

> ⚠ **Breaking change (2026-05-10)**: `http_request` 의 `meta.duration` → `meta.durationMs`. 기존 expression `$node["X"].meta.duration` 을 사용하는 워크플로우는 정정 필요. 코드 측 `meta.duration` 정정 완료.

## 7. 출력 구조 색인

D4 결정 (2026-05-17) 이후 Integration 4종은 단일 에러 경로 (`port: 'error'` + `output.error.*`) 만 사용한다 — 종전 pre-flight throw (§5.8) 절은 §5.3 으로 fold.

| 노드 | 정상 케이스 | 에러 케이스 (단일 경로) |
|------|-------------|--------------------------|
| [http_request](./1-http-request.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) — 4xx/5xx + transport + integration resolve 실패 + SSRF 차단 모두 통합 |
| [database_query](./2-database-query.md#5-출력-구조) | §5.1 | §5.3 (`error`) — driver 에러 + integration resolve 실패 + 자격증명 누락 + invalid parameters 모두 통합 |
| [send_email](./3-send-email.md#5-출력-구조) | §5.1 | §5.3 (`error`) — 이미 통합되어 있던 reference 패턴 |
| [cafe24](./4-cafe24.md#5-출력-구조) | §5.1 (`success`) | §5.3 (`error`) — API 호출 실패 + Resource/Operation 검증 + mall_id 누락 + integration resolve 실패 모두 통합 |

## 8. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-10 | §6 5필드 공통 규약 / §7 출력 구조 색인 신설. 노드 문서 §5 출력 구조 5필드 모델로 정합화 (Principle 0~11 적용). `http_request.meta.duration` → `meta.durationMs` 통일 (Breaking, P0). 기존 §1~§5 anchor 보존 |
| 2026-05-13 | 도입부 scope note 에 `cafe24` 캔버스 노드 추가 + 진입 링크. §5 캔버스 요약 표 / §7 출력 색인에 cafe24 행 추가. Integration 엔티티의 "캔버스 노드 + AI Agent MCP 도구" 첫 동시 사용 사례 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process)). cafe24 노드는 5필드 invariant + Principle 7 config echo 그대로 채택 ([4-cafe24.md §5](./4-cafe24.md#5-출력-구조)) |
| 2026-05-17 | **D4 결정** (plan/in-progress/node-output-redesign): pre-flight `IntegrationError` throw 경로 폐기. Integration 4종 모두 catch 후 `port: 'error'` + `output.error.*` 단일 경로. §4.2 footnote + §7 색인에서 `Pre-flight throw` 열 제거. send-email 의 catch 패턴을 baseline 으로 HTTP / DB / cafe24 핸들러 정렬 (Breaking change — `IntegrationError` 가 throw → 노드 실행 실패 → 워크플로우 FAILED 로 흐르던 경로가 이제 error 포트로 흐름. 사용자 워크플로 동작 변화) |
