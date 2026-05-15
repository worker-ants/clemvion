# Cafe24 output 개선안

> 대상 spec: `spec/4-nodes/4-integration/4-cafe24.md` (§5 출력 구조)

> **최신화 검토 (2026-05-16)**: Cafe24 노드는 본 redesign 폴더의 1차 초안(2026-04) 이후에 신설된 노드이므로 본 plan 은 최초 작성이다. 현 spec 은 이미 `spec/conventions/node-output.md` 11 원칙을 따른 형태로 출발했다.

## 현재 output (spec 인용)

§5.1 2xx 성공 (port `success`):

```json
{
  "config": {
    "integrationId": "int_cafe24_myshop",
    "resource": "product",
    "operation": "product_list",
    "fields": { "shop_no": 1, "display": "T", "since": "{{ $now.iso }}" },
    "pagination": { "limit": 50, "offset": 0 }
  },
  "output": {
    "response": {
      "products": [{ "product_no": 1001, "product_name": "샘플 상품", "price": "10000.00" }],
      "links": [{ "rel": "next", "href": "/api/v2/admin/products?offset=50&limit=50" }]
    }
  },
  "meta": {
    "statusCode": 200, "durationMs": 320,
    "callUsage": 12, "callRemain": 0, "callLimit": "5/40"
  },
  "port": "success"
}
```

§5.3.1 Cafe24 API 4xx / 5xx (port `error`): `output.response` (서버 body 보존) + `output.error.{code, message, details}` + `meta.statusCode`.

§5.3.2 Rate Limit 재시도 소진: `output.error.code = 'CAFE24_RATE_LIMITED'` + `meta.statusCode: 429` + `meta.callRemain`.

§5.3.3 Transport 실패: `output.error.code = 'CAFE24_TRANSPORT_FAILED'` + `meta.statusCode: 0`.

§5.8 Pre-flight throw — config / Integration / credential 검증 실패 시 throw, `output.error` 가 아니라 노드 실행 실패 (Principle 3.1).

## 진단

Cafe24 는 외부 API 호출 노드 (단계 1개). HTTP Request 와 같은 `success` / `error` 2-포트 구조이지만, **추가 메트릭**(rate-limit 헤더) 와 **자동 상태 전이**(401/403 시 `Integration.status = error(auth_failed)`) 가 노드 고유 특성이다.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.response` | 적절 (output) | Cafe24 API 응답 body — Principle 8.2 의 HTTP 관용 네이밍 재사용 (spec §5 head footnote 명시) |
| `output.response` + `output.error` 병존 (4xx/5xx) | 적절 | HTTP Request 와 동일 패턴 — 서버 body 디버깅 보존, `output.error` 존재 여부로 정상/에러 분기 |
| `output.error.{code, message, details}` | 적절 | Principle 3.2 표준 envelope. `details` 에 `statusCode` / `mallId` / `resource` / `operation` / `cafe24ErrorCode` / `cafe24Message` |
| `meta.statusCode` | 적절 (meta) | HTTP 응답 status. Transport 실패 시 `0` (HTTP Request 와 동일 magic number) |
| `meta.durationMs` | 적절 | engine 공통 |
| `meta.callUsage` / `meta.callRemain` / `meta.callLimit` / `meta.timeUsage?` | 적절 (meta) | Cafe24 leaky bucket 헤더 (`X-Cafe24-Call-Usage/Remain`, `X-Api-Call-Limit`, `X-Cafe24-Time-Usage`). Principle 2 (실행 메트릭) |
| `config.{integrationId, resource, operation, fields, pagination}` (raw echo, `{{ }}` 보존) | 적절 | Principle 7. `fields = {}` 도 명시 echo (§5.3.2 footnote) |
| `port: 'success'` / `'error'` | 적절 | Principle 5 |

핵심 점검:

1. **`output.requestBody` 부재 vs HTTP Request 대비 일관성** — HTTP Request 는 `output.requestBody` (evaluated wire body, 256KB cap) 를 surface 하나, Cafe24 는 fields → query/body 분배를 메타데이터로 결정하므로 동등 필드가 없다. 디버깅 측면에서 다음 두 선택지 검토 가치:
   - (a) `output.requestQuery` / `output.requestBody` 를 surface (evaluated, paths/queryParams/jsonBody 분리)
   - (b) 현 상태 유지 — `config.fields` (raw) 와 `meta.statusCode` 로 충분. 디버깅은 IntegrationUsageLog 의 request snapshot 으로 회수.
   spec 은 (b) 채택. AI Agent MCP 도구로도 같은 메타데이터를 쓰므로 일관성 우선.

2. **`meta.statusCode = 0` magic number (transport 실패)** — HTTP Request 와 동일 패턴. `output.error.code === 'CAFE24_TRANSPORT_FAILED'` 분기 키가 더 명확. spec 권장과 정합.

3. **`Integration.status` 자동 전이 (401/403)** — §6.1 명시. handler 실행 부작용으로 외부 상태(`Integration.status='error'`) 가 atomic UPDATE. 노드 output 컨트랙트 자체는 `port:'error'` + `output.error.code = 'CAFE24_AUTH_FAILED'` 단일 — 외부 부작용은 spec 본문(`§6.1`) 에 명시되며 output 5필드 invariant 와 직교.

4. **Pre-flight throw 코드 (`CAFE24_UNKNOWN_OPERATION` / `CAFE24_MISSING_FIELDS` / `CAFE24_INVALID_MALL_ID`)** — output 에 노출되지 않고 노드 실행 실패로 분기. Principle 3.1 정합. `IntegrationUsageLog.error.code` 에만 기록 (§6 마지막 줄).

5. **MCP Bridge 와 메타데이터 공유** — `Cafe24McpBridge` 가 같은 operation 메타데이터 테이블을 사용해 `tools/list` 응답을 생성. 본 노드의 `config.operation` ↔ MCP 도구의 `tool name` 가 1:1 매핑. spec 본문 §10·§11 명시. output 컨트랙트 자체에는 영향 없음 (LLM 이 MCP 호출하면 별도 AI Agent 노드 컨텍스트에서 처리).

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 2xx 성공
{
  "config": { "integrationId": ..., "resource": ..., "operation": ..., "fields": {...}, "pagination"?: {...} },
  "output": { "response": <Cafe24 응답 body> },
  "meta": {
    "statusCode": <2xx>,
    "durationMs": <number>,
    "callUsage"?: <percent>,
    "callRemain"?: <seconds>,
    "callLimit"?: "<현재>/<상한>",
    "timeUsage"?: <percent>
  },
  "port": "success"
}

// 4xx/5xx Cafe24 API 에러
{
  "config": {...},
  "output": {
    "response": <서버 body 보존>,
    "error": {
      "code": "CAFE24_404" | "CAFE24_422" | "CAFE24_AUTH_FAILED" | "CAFE24_4XX" | "CAFE24_5XX",
      "message": "Cafe24 API returned <status> — <statusText>",
      "details": {
        "statusCode": <number>,
        "mallId": <string>,
        "resource": <string>,
        "operation": <string>,
        "cafe24ErrorCode"?: <string>,
        "cafe24Message"?: <string>
      }
    }
  },
  "meta": { "statusCode": <응답>, "durationMs": <number>, "callUsage"?: ... },
  "port": "error"
}

// Rate-limit 소진
{
  "config": {...},
  "output": {
    "error": {
      "code": "CAFE24_RATE_LIMITED",
      "message": "Cafe24 leaky bucket exhausted after 2 retries",
      "details": { "retries": 2, "lastRetryAfterSec": <number>, "mallId": <string> }
    }
  },
  "meta": { "statusCode": 429, "durationMs": <number>, "callUsage": 100, "callRemain": <number> },
  "port": "error"
}

// Transport 실패
{
  "config": {...},
  "output": {
    "error": {
      "code": "CAFE24_TRANSPORT_FAILED",
      "message": <fetch reject 메시지 — ECONNRESET, ETIMEDOUT, abort 등>,
      "details": { "mallId": <string>, "resource": <string>, "operation": <string> }
    }
  },
  "meta": { "statusCode": 0, "durationMs": <number> },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- Cafe24 는 HTTP Request 의 친척 노드이지만 (1) operation 메타데이터 테이블 기반 동적 폼, (2) rate-limit 헤더 메트릭, (3) 401/403 → `Integration.status='error'` 자동 전이가 추가된다. output 컨트랙트 자체는 HTTP Request 와 같은 `success`/`error` 2-포트 구조를 그대로 따라 사용자 학습 비용 최소화.
- `output.requestBody` 미surface 는 의도 — fields → path/query/body 분배가 메타데이터 결정이라 raw `config.fields` 만으로 추적 가능. 향후 디버깅 요구가 늘면 (a) 안 검토 가능하나 현재는 MCP Bridge 와의 단순성 우선.
- `Integration.status` 자동 전이는 노드 output 5필드와 직교한 외부 부작용 — spec 본문 §6.1 으로 명시하고 `IntegrationUsageLog` 에 atomic 기록 (멱등성 보장).
- 옛 초안에서 검토 후 폐기된 대안:
  - `output.cafe24` 래퍼 (모든 Cafe24 특이 필드를 모음) — 폐기. HTTP Request 의 평탄한 구조와 비대칭 발생. `output.response` 단일 + `meta.*` 메트릭으로 충분.
  - `output.error.details.requestId` (Cafe24 미제공) — 폐기. Cafe24 응답이 trace id 를 제공하지 않으므로 details 에 둘 데이터 없음.
