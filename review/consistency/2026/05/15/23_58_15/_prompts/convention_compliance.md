# 정식 규약 준수 Check Payload

본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (정식 규약 준수)

1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`

```
---
worktree: spec-pipeline-consistency-4c9e1f
started: 2026-05-15
owner: project-planner
---

# Spec draft: embedding-pipeline 정합성 정비

## 배경

`plan/in-progress/spec-update-embedding-pipeline-consistency.md` 에 정의된 항목 (PR #40 cleanup-script-prod 의 사전 일관성 검토 결과로 파생) 을 본 draft 로 흡수한다. 실제 spec 본문에 반영하기 직전 `/consistency-check --spec` 의무 검토를 받는 단계.

본 draft 의 1차 consistency-check (2026-05-15T23:50:03, BLOCK: YES) 결과 — 변경 대상 파일이 4개로 불충분해 Critical 2건이 잡혔다. 6개 파일로 확장 + Rationale 보강 후 재검토 예정.

## 권위 결정 (코드 기반)

backend WebSocket 구현을 확인하여 latest 권위를 확정했다:

- `backend/src/modules/websocket/websocket.service.ts:113-125` — `KbEventType` union 에 정확히 12개 이벤트:
  - embedding 6: `document:embedding_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`
  - graph 6: `document:graph_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`
- `emitKbEvent()` 가 채널 `kb:${documentId}` 로 broadcast (line 151-165). KB ID 가 아니라 **document ID 가 채널 키**.
- payload 에 `documentId`, `timestamp` 자동 첨부.
- `frontend/src/lib/websocket/use-kb-events.ts` 가 12개 이벤트를 모두 listen 하며 `kb:${docId}` 채널 구독.

**dead path 발견**: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:42-46` 가 `emitExecutionEvent(`kb:${kbId}`, 'kb:graph_stats_updated' as never, …)` 호출. 그러나 `emitExecutionEvent` 는 channel 을 `execution:${첫인자}` 로 prefix 하므로 실제로 frontend 의 `kb:` 구독에 도달하지 못한다. type union 에도 없음 (`as never` 강제 캐스트). → **본 spec 정비에서는 권위에서 제외 (코드 측 결함은 후속 plan 으로 분리)**.

## 변경 대상 spec 문서 (6개, 원자적 반영)

**Critical 해소 조건**: 아래 6 파일 변경을 단일 PR 에 묶어 원자적으로 반영. 중간 상태에서 옛 표기(`embedding:{knowledgeBaseId}`, 점 표기 이벤트, `document:graph_extracted` 등)가 잔존하지 않도록 한 커밋 또는 연속 커밋으로 push.

### 1. `spec/5-system/8-embedding-pipeline.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §1 헤더 | `## 1. 개요` | 형식 통일은 본 PR 범위 밖. **건드리지 않음** (consistency check WARNING #7 회피 — 번호 헤더 일관성 보존) |
| §2 본문 끝 | "실패 시: status: error, **Document.metadata**에 에러 메시지 저장." | "실패 시: status: error, **Document.embedding_error_message** 에 에러 메시지 저장 (sanitize 거친 사용자 노출용)." |
| §6.1 DocumentChunk 표 | 6필드 inline | 그대로 유지 + 상단에 "권위 정의는 `spec/1-data-model.md §2.12.1`" 한 줄 추가. **표 자체는 보존** (정보 손실 위험 회피) |
| §6.2 DDL 예시 | IVFFlat 단일 인덱스 | DDL 코드블록 유지 + 노트 "실제 운영 인덱스는 V022/V023(/V030~V033, `spec/data-flow/knowledge-base.md §2.3` 참조) 으로 차원별 partial HNSW(vector / halfvec) 분리. 본 DDL 은 컨셉 예시" 추가 |
| §8 WebSocket 알림 표 | embedding 6개만 (started/progress/completed/error/retry/failed) | embedding 6 + graph 6 = 12개. 채널 명명규약 그대로 (`kb:${documentId}`). graph 6개는 §10-graph-rag.md §6 으로 위임 + footnote. |
| §8 헤더 끝 | (없음) | "이 이벤트들은 §9.2 의 상태 전이와 직접 대응되며, `embedding_error` 의 의미 변경(2026-05-11) 이후 일시 오류만 의미한다" 교차 참조 추가 |
| §9.4 retry-failed | `scope: 'embedding' \| 'graph' \| 'all'` | 표기 유지 + footnote "프론트엔드 UI 는 `'embedding'` 과 `'graph'` 두 버튼만 노출. `'all'` 은 운영/스크립트용" |
| `## Rationale` | 작업 일지 형식 | 형식 정리 + 신규 결정 4건 한 줄씩 추가 (아래 "Rationale 보강" 참조) |

### 2. `spec/5-system/6-websocket-protocol.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §3.2 채널 패턴 표 line 110 | `embedding:{knowledgeBaseId}` `Knowledge Base 임베딩 진행 상태` | `kb:{documentId}` `Knowledge Base 문서별 임베딩·그래프 추출 상태` |
| §4.3 임베딩 이벤트 섹션 | 채널 `embedding:{knowledgeBaseId}` + 점 표기 4개 이벤트 | 섹션 제목 "KB 문서 이벤트 (Server → Client)", 채널 `kb:{documentId}`, embedding 6 + graph 6 = 12개. error/retry/failed 의미 구분 명시. payload 권위는 backend 구현 기준. |
| (Rationale 신설) | 없음 | `## Rationale` 섹션 신설. "채널 단위를 KB → 문서로 전환. 문서별 독립 진행 상태 추적 + frontend 실제 구독 패턴 반영. 이벤트 표기 점 → 콜론+언더스코어는 backend KbEventType union 정렬." 한 단락. |

### 3. `spec/2-navigation/5-knowledge-base.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.4.1 line 105 | `POST /api/knowledge-bases/:id/retry-failed { scope: 'embedding'\|'graph' }` | `{ scope: 'embedding' \| 'graph' \| 'all' }` + "UI 는 vector/graph 두 분리 버튼이라 `scope: 'embedding'` 또는 `'graph'` 만 전송. `'all'` 은 운영/스크립트용" 한 줄 |
| §2.7.1 line 139 | `document:graph_started/progress/completed/error`, `kb:graph_stats_updated` | `document:graph_started/progress/completed/error/retry/failed` (`kb:graph_stats_updated` 제거 — dead path) |

### 4. `spec/1-data-model.md`

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.12.1 DocumentChunk 인덱스 | `ivfflat (embedding vector_cosine_ops) — 유사도 검색 성능` | `차원별 partial HNSW (V022 vector + V023 halfvec, V030~V033 후속 정비) — 유사도 검색 성능. 마이그레이션 상세는 spec/data-flow/knowledge-base.md §2.3 및 backend/migrations/ 참조` |

### 5. `spec/5-system/10-graph-rag.md` (신규 추가 대상)

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.3 / §4.2 KB-GR-OB-02 (line 37, 123) | "WebSocket 이벤트 (... `kb:graph_stats_updated`)" / "✅ (`kb:graph_stats_updated` 등)" | `kb:graph_stats_updated` 언급 제거. "그래프 통계 카운트는 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회" 로 교체 |
| §6 이벤트 표 헤더 | "기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다." | 채널 명시 추가: "채널 `kb:{documentId}` 로 broadcast (8-embedding-pipeline.md §8 과 동일)." |
| §6 이벤트 표 line 527 | `kb:graph_stats_updated` 행 | **행 삭제** (dead path) |

### 6. `spec/data-flow/knowledge-base.md` (신규 추가 대상)

| 위치 | 현재 | 변경 |
|---|---|---|
| §2.5 (line 68-103) mermaid emit 라인 | `document:embedding_started/completed/retry/failed`, `document:graph_extracted`, `document:graph_retry/failed` | `document:graph_extracted` → `document:graph_completed` (코드 권위 정렬). 누락된 `_progress`, `_error` 도 mermaid 노드의 흐름에 부합하면 추가. mermaid 다이어그램은 의미 변경 없이 라벨만 갱신. |
| §2.5 (line 197-198) 이벤트 출처 표 | `document:embedding_started/completed/failed/retry` / `document:graph_started/completed/failed/retry` | 6개씩 완전 명시: `document:embedding_started/progress/completed/error/retry/failed`, `document:graph_started/progress/completed/error/retry/failed`. 출처(`EmbeddingService.emitEvent` / `GraphExtractionService.emitEvent`) 그대로. |
| §2.3 인덱스 목록 | (현재) | 그대로 — `1-data-model.md §2.12.1` 가 본 spec 으로 포괄 참조 가능하도록 변경됨 (위 §4 항목 참조) |

## Rationale 보강 (8-embedding-pipeline.md `## Rationale`)

CLAUDE.md 원칙: Rationale 은 "결정의 배경·근거·폐기된 대안" 위주. 작업 일지 보존 + 결정 사항 4건 추가 + 형식 다듬기.

조치:
- 폐기된 `memory/kb-embedding-model-selection.md` 경로 참조 1줄 제거 (해당 메모는 `plan/complete/archive/from-memory/` 로 이미 흡수됨)
- 옛 flat review 경로 `review/2026-05-02_13-18-24/` 참조 1줄 제거 (review 경로 nested ISO 로 변경됨)
- 후속 검토 5개 항목 중 V024 로 완료된 2개 (`reEmbedAll → BullMQ 큐`, `EmbeddingService MAX_CONCURRENT → 세마포어`) 에 "→ V024 로 완료" 표시
- 섹션 헤더 "### 작업 메모: 지식베이스 임베딩 모델 사용자 선택 (2026-05-02 완료)" → "### 결정: 다중 차원 임베딩 + KB 단위 모델 선택 (2026-05-02)"
- **신규 결정 4건 추가** (consistency-check WARNING #5, INFO #3, #4, #5 흡수):
  - "`Document.metadata` 에러 저장 구 방식은 전용 컬럼 `embedding_error_message` 도입 (V024 후속) 으로 폐기됨"
  - "IVFFlat → partial HNSW 전환 — pgvector 0.7+ halfvec 으로 3072 차원에도 partial 인덱스 부착 가능해졌고, 차원별 cast 가 인덱스 정의와 SQL 표현식을 일치시킨다"
  - "`retry-failed` API 의 `scope: 'all'` 은 초기 5-knowledge-base 표에서 누락되어 있었으며, 8-embedding-pipeline §9.4 와 정합화. UI 는 vector/graph 분리 버튼이라 두 단일 값만 사용"
  - "`kb:graph_stats_updated` 이벤트 — kb-stats.helper.ts 가 `emitExecutionEvent` 로 호출해 채널이 `execution:kb:…` 로 변환되어 frontend 의 `kb:` 구독에 도달 불가한 dead path. spec 에서 제거, backend 코드 결함은 후속 plan 처리"
- 본문 형식은 그대로 유지 (배경 → 결정 → 핵심 결과 → 검증 → 후속) — 정보 손실 위험 회피

## 후속 plan (별도 분리 필요)

본 spec 정비에서 다루지 않는 항목은 신규 plan `plan/in-progress/kb-graph-stats-dead-path.md` 로 분리해 dev 위임:

- `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:42-46` 의 `kb:graph_stats_updated` emit 처리. 옵션: (1) `emitKbEvent` 로 전환 + 새 이벤트 type 추가, (2) 코드 제거. 결정은 dev.
- 결정에 따라 spec 에 이벤트 재도입 필요 시 본 PR 의 spec 변경을 reverse.

## 검토 후 단계

- [ ] 본 draft 에 대해 `/consistency-check --spec plan/in-progress/spec-draft-embedding-pipeline-consistency.md` 재호출 (1차 BLOCK: YES 해소 검증)
- [ ] Critical 0 확인 → 6 spec 파일 본문에 반영 (단일 PR 원자 반영)
- [ ] `plan/in-progress/spec-update-embedding-pipeline-consistency.md` 의 모든 항목 [x] 처리 → `git mv` 로 `plan/complete/` 이동
- [ ] 본 draft 파일도 spec 반영 완료 시 삭제 또는 `plan/complete/` 이동
- [ ] `plan/in-progress/kb-graph-stats-dead-path.md` 신규 plan 생성 (dead path 후속, dev 위임)
- [ ] PR 생성

```

## 정식 규약 모음 (spec/conventions/)

### spec/conventions 정식 규약

#### `spec/conventions/cafe24-api-metadata.md`
```
# CONVENTION: Cafe24 API Metadata

> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)

본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.

---

## 1. 디렉토리 구조

```
backend/src/nodes/integration/cafe24/metadata/
  index.ts             # 18 resource 의 종합 export
  store.ts             # Store (상점)
  product.ts           # Product (상품)
  order.ts             # Order (주문)
  customer.ts          # Customer (회원)
  community.ts         # Community (게시판)
  design.ts
  promotion.ts
  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
  category.ts
  collection.ts
  supply.ts
  shipping.ts
  salesreport.ts
  personal.ts
  privacy.ts
  mileage.ts
  notification.ts
  translation.ts
```

각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.

## 2. Operation 메타데이터 형식

```ts
interface Cafe24OperationMetadata {
  // 식별
  id: string;                    // 예: 'product_list'. resource 안에서 unique
  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용

  // HTTP 매핑
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;                  // path template. 예: 'products/{product_no}'

  // 입력 스키마
  requiredFields: string[];
  fields: {
    [fieldName: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
      location: 'path' | 'query' | 'body';
      enum?: string[];
      description?: string;
      default?: unknown;
    };
  };

  responseShape?: 'list' | 'single' | 'empty';
  paginated?: boolean;
}
```

## 3. 예시 — `product` Resource 일부

```ts
export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    label: '상품 목록 조회',
    description: 'List products in the mall. Supports filtering by category, display status, date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    label: '상품 단건 조회',
    description: 'Get a single product by product_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:  { type: 'number',  location: 'path' },
      shop_no:     { type: 'number',  location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_update',
    label: '상품 수정',
    description: 'Update a product (name, price, display, stock, etc).',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no:    { type: 'number',  location: 'path' },
      product_name:  { type: 'string',  location: 'body' },
      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
];
```

## 4. 신규 endpoint 추가 절차

1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
5. 백엔드 단위 테스트가 자동으로 검증:
   - 모든 `id` 의 unique
   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
   - `requiredFields` 가 `fields` 의 키 부분집합인지
6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.

## 5. MCP Bridge 와의 매핑

> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.

`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:

```ts
function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
  return {
    name: op.id,                                 // bare id — 예: 'product_list'
    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
      ),
      required: op.requiredFields,
    },
  };
}
```

`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.

## 6. allowlist 와의 관계

> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).

AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |

```

#### `spec/conventions/migrations.md`
```
# Flyway 마이그레이션 운영 규약

## Overview

본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.

1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.

본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`backend/migrations/README.md`](../../backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.

---

## 1. 명명 규약

```text
backend/migrations/V<번호>__<snake_case_descriptor>.sql
backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
```

- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
- 설명자는 `snake_case`. 영문 소문자 + 숫자 + `_` 만 사용한다.
- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.

## 2. V번호 정책

- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.

작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.

## 3. Append-only 원칙

이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.

- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`backend/migrations/README.md`](../../backend/migrations/README.md) §4 참고).

## 4. `outOfOrder=false` 유지

Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).

이유:
- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.

## 5. 새 마이그레이션 추가 절차

1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
2. `ls backend/migrations | tail -2` 로 현재 max V 를 확인한다.
3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`backend/migrations/README.md`](../../backend/migrations/README.md) §4·§5 참고).
4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.

> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.

## 6. 충돌 검출 / 머지 race

본 repo 는 두 단계 안전망으로 V번호 충돌과 merge race 를 모두 차단한다.

### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)

`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.

| 검사 | 위반 예시 | 메시지 |
| --- | --- | --- |
| 중복 | 같은 V<N>__*.sql 두 개 | `FAIL: V041 is duplicated` |
| 단조성 | 신규 V<N> 가 main_max 이하 | `FAIL: V040 is not greater than base (origin/main) max V040` |
| 연속성 | gap 발생 (예: V041 없이 V042) | `FAIL: V042 leaves a gap (expected V041 after base max V040)` |
| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `FAIL: V041 .conf base name does not match its .sql` |

위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.

로컬에서 동일 검사를 돌리려면:

```bash
python3 scripts/check-migration-versions.py --base origin/main
```

### 6.2 머지 직전 rebase 규약 (운영 규약)

PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.

**머지 직전 확인 (작성자 책임)**

1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.

이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.

### 6.3 사후 안전망 — `migration-recheck-on-main`

`backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.

- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
- **Auto-nudge** — 열린 PR 중 `backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.

두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.

## 7. 폐기 대안 (Rationale)

### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)

장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.

- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.

### 대안 2: `flyway.outOfOrder=true`

옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:

- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.

본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.

### 대안 3: GitHub Merge Queue

자동화 강도는 가장 높지만:

- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.

### 대안 4: GitHub branch protection — "Require branches to be up to date"

race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.

- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강제) 이 무료 private 에서 비활성화되어 있다.
- `gh api -X PUT repos/<owner>/<repo>/branches/main/protection` CLI 역시 동일한 플랜 제약으로 실패한다.

따라서 현재는 §6.2 (작성자 책임 규약) + §6.3 (`migration-recheck-on-main`) 으로 대체한다. 향후 유료 플랜으로 전환하면 다음 순서로 승격을 검토한다.

1. Settings → Branches → main → "Require branches to be up to date before merging" 활성화.
2. `migration-check / guard` 를 required status check 로 등록.
3. §6.2 의 작성자 책임 규약을 자동화 차단으로 흡수.
4. §6.3 의 `migration-recheck-on-main` 은 backup 으로 유지 — race 가 사후에라도 main 에 도달했을 때 가시화하는 역할은 branch protection 이 대체하지 못한다.

---

## 참고

- 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension, `.conf` 사용법, repair 절차): [`backend/migrations/README.md`](../../backend/migrations/README.md)
- 시스템 아키텍처 §2.8 (Flyway 운영): [`spec/0-overview.md`](../0-overview.md)
- 가드 스크립트: [`scripts/check-migration-versions.py`](../../scripts/check-migration-versions.py)
- CI workflow: [`.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml)

```

#### `spec/conventions/node-output.md`
```
# Output 변수 일관성 규칙 (Conventions)

모든 노드 개선 문서가 참조하는 **공통 규칙집**입니다. 각 노드 개선 문서는 이 Principle들 중 위반 사항을 식별하고 그에 대한 구체적인 수정안을 제시합니다.

> **설계 목표**: "워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능**하도록 한다."

---

## Principle 0 — `NodeHandlerOutput`의 5필드는 불변

모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다.
- `config`: 해석된 설정값 (자격증명 제거)
- `output`: 후속 노드에 전달되는 **주 데이터**
- `meta`: **실행 메타데이터** (duration, statusCode, tokens, logs)
- `port`: 라우팅 포트 지시 (string | string[])
- `status`: 흐름 제어 상태 (`waiting_for_input`, `resumed`, `ended` 등)

이 5필드의 의미는 **어떤 노드에서든 동일**해야 합니다.

---

## Principle 1 — `output` 은 "비즈니스 결과물"만 담는다

`output` 아래에는 후속 노드가 로직에 사용할 **도메인 데이터**만 둡니다.

| ✅ `output`에 두는 것 | ❌ `output`에 두지 않는 것 |
| --- | --- |
| 응답 본문 / 분류 결과 / 추출된 필드 | 토큰 수 / duration / HTTP status code |
| 렌더링된 프레젠테이션 뷰 | LLM model 이름 / 디버그 로그 |
| 사용자 입력 / 버튼 클릭 인터랙션 | 실행 횟수 / retry count |

→ 실행 메트릭은 **Principle 2** 에 따라 `meta`에 둡니다.

---

## Principle 1.1 — `config` 와 `output` 은 **직교**한다 (중복 금지)

사용자가 UI에서 설정한 **리터럴 값**은 **`config` 에만** 존재하고, 해당 값을 `output` 에 중복 복사하지 않습니다.

### 1.1.1. 규칙

| 값의 성격 | 저장 위치 |
| --- | --- |
| **사용자가 UI/schema 로 설정한 리터럴 값** (title, submitLabel, layout, chartType, format, columns 정의, fields 정의, systemPrompt, maxTurns, categories 정의 등) | `config` **만** |
| **런타임에 계산/변형/집계/평가된 값** (resolved items (dynamic), evaluated rows, aggregated chart data, rendered template string, LLM response, extracted fields, normalized HTTP response) | `output` **만** |
| **사용자 상호작용 데이터** (form submission, button click, user message) | `output.interaction` |
| **실행 메트릭** (duration, tokens, status code, rowCount) | `meta` (Principle 2) |

### 1.1.2. 식별 기준

다음 질문으로 판단:

> "이 값을 알기 위해 노드를 **실제 실행**해야 하는가?"

- 실행 없이 schema/config 만 보면 알 수 있음 → `config`
- 실행이 필요함 (input/외부 API/사용자 입력에 의존) → `output`

### 1.1.3. 적용 예

- `form.config.title = "User Profile"` → `output` 에 **echo 금지**. 후속 노드가 필요하면 `$node["F"].config.title` 사용.
- `carousel.config.layout = "card"` → `output` 에 echo 금지.
- `chart.config.chartType = "bar"` → `output` 에 echo 금지. 반면 `output.data` 는 input을 집계한 런타임 값이므로 OK.
- `template.config.content = "Hello {{ name }}"` → `output` 에 echo 금지. 반면 `output.rendered = "Hello Alice"` 는 expression resolver 가 해석한 런타임 결과이므로 OK. **이 패턴은 Principle 7 (config echo 원칙) 과 정확히 정합한다 — `config` 는 원본 템플릿, `output` 은 평가 결과.**
- `loop.config.count = 10` → `output` 에 echo 금지. 실제로 실행된 횟수는 `meta.iterations` 또는 `output.iterations.length`.

### 1.1.4. 예외 — `output.view` 타입 판별자 패턴은 **사용하지 않는다**

기존 초안에서 제안했던 `output.view.type = 'form' | 'carousel' | ...` 판별자는 **폐기**합니다. 노드 종류는 `$node["X"]` 로 접근하는 시점에 이미 워크플로우 정의상 알 수 있으므로 판별자는 불필요한 중복입니다.

---

## Principle 2 — `meta` 는 "실행 메트릭"만 담는다

| 분류 | 필수/권장 필드 |
| --- | --- |
| **공통** | `meta.durationMs: number` |
| **LLM 계열** | `meta.model`, `meta.inputTokens`, `meta.outputTokens`, `meta.totalTokens`, `meta.thinkingTokens?`, `meta.toolCalls?` |
| **HTTP** | `meta.statusCode`, `meta.durationMs` |
| **DB** | `meta.durationMs`, `meta.rowCount` |
| **Code** | `meta.durationMs`, `meta.success`, `meta.logs?`, `meta.error?`, `meta.errorCode?` |
| **Container** | `meta.iterations?`, `meta.branches?`, `meta.matchedCount?` |

> `ai_agent` 가 현재 사용하는 `output.metadata.*` 는 **폐지**합니다. 모든 토큰/모델 정보는 `meta.*` 로 이동.

---

## Principle 3 — 에러 컨트랙트 통일

### 3.1. 분류

| 종류 | 처리 방식 |
| --- | --- |
| **Pre-flight 에러** (config 오류, credential 누락, SSRF 차단 등) | `throw` → 엔진이 실행 실패로 마킹 |
| **Runtime 에러** (외부 API 실패, 쿼리 실패 등) | `port: 'error'` + `output.error` |
| **예상 가능한 비즈니스 실패** (매칭 없음, 빈 결과 등) | 정상 `port` 유지, 결과가 비어있음을 명시 |

### 3.2. `output.error` 표준 형태

```json
{
  "output": {
    "error": {
      "code": "HTTP_5XX" | "DB_QUERY_FAILED" | "LLM_TIMEOUT" | ...,
      "message": "사람이 읽는 메시지",
      "details": { /* optional, 노드별 */ }
    }
  },
  "port": "error"
}
```

- `code` 는 `UPPER_SNAKE_CASE`.
- `message` 는 국제화 고려 없음 (로그/디버깅용 원문).
- `details` 는 선택적, 노드별 스키마.

### 3.3. 에러 포트 보유 노드

반드시 `error` 포트를 갖는 노드: `http_request`, `database_query`, `send_email`, `cafe24`, `ai_agent`, `information_extractor`, `text_classifier`, `code`, `workflow` (sub-workflow 실패 시).
`transform` 은 pre-flight(config) 검증만 수행 → throw.

---

## Principle 4 — 블로킹/재개 컨트랙트 통일

### 4.1. 상태 전이

```
[실행 시작]
   │
   ├─ 블로킹 노드 도달
   │     ↓
   │  status: "waiting_for_input"
   │  output: { view: {...} }         ← 렌더링용 뷰
   │  (엔진이 실행을 일시 중지)
   │
   ├─ 사용자 입력 수신
   │     ↓
   │  status: "resumed"                ← 통일된 resumed 상태
   │  output: {
   │    view: {...},                   ← 이전 뷰 그대로 유지 (immutable snapshot)
   │    interaction: {
   │      type: "form_submitted" | "button_click" | "message_received",
   │      data: {...},                 ← type별 payload
   │      receivedAt: ISO8601
   │    }
   │  }
   │
   └─ (multi-turn LLM의 경우) 조건 만족 시
         ↓
      status: "ended"
      port: <condition_id> | "user_ended" | "max_turns" | "out"
      output: { result: {...}, ... }   ← 최종 결과
```

### 4.2. 폐기할 필드 / 구조

- `_multiTurnState` → `_resumeState`로 통일. 노출되지 않는 internal 필드임을 문서에 명시.
- 현재 form의 `output.submittedData` → `output.interaction.data` 로 이동.
- 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output의 런타임 필드 조합으로 재구성 가능 (Principle 1.1).
- 초안의 `output.view` 래퍼 → **폐기** (Principle 1.1.4). 런타임 값은 `output` 최상위에 직접 배치.
- 초안의 `output.view.type` 판별자 → **폐기** (Principle 1.1.4). 노드 타입은 워크플로우 정의에서 파악.
- 현재 presentation 노드의 `output.type: 'carousel'|'table'|...` 판별자 → **폐기** (동일 이유).
- 현재 presentation 노드의 `output.rendered` (HTML snapshot) → **프런트 렌더링용** 이라면 유지 가능하나, 후속 노드 로직이 참조할 런타임 값이 아니면 `meta.rendered` 로 이동 검토.

### 4.3. Waiting 상태의 `output` 내용 (노드별)

`output` 에는 **이 실행 시점에 계산된 런타임 값만** 담습니다. 리터럴 config 필드는 echo 금지 (Principle 1.1).

| 노드 | Waiting `output` | 런타임 필드 설명 |
| --- | --- | --- |
| `form` | `{}` (빈 객체) | 폼 렌더링에 계산할 값 없음. fields/title/submitLabel 등은 모두 `config` 참조. |
| `carousel` (static) | `{}` | `items` 가 literal config. 런타임 계산 없음. 후속 노드는 `config.items` 참조. |
| `carousel` (dynamic) | `{ items }` | `source` 표현식 해석 + `titleField`/`descriptionField`/`imageField` 매핑으로 **런타임 생성**된 items 배열. `config.items` 와 독립. |
| `table` (static) | `{ rows }` | 핸들러가 `columns[*].field` 기준으로 row 필터링 → 런타임 정규화됨. |
| `table` (dynamic) | `{ rows, totalRows }` | dataSource 에서 per-row expression 평가 결과. `totalRows` 는 slice 된 페이지 길이. |
| `chart` | `{ data }` | input 을 xAxis 기준으로 **런타임 집계**한 `[{x, y}, ...]`. chartType/title 은 config. |
| `template` | `{ rendered }` | 템플릿 문자열이 engine 의 expression resolver 로 **해석된 결과**. `content` / `format` 은 config. |
| `ai_agent` (multi) | `{ messages }` | 대화 누적. 런타임 상태. |
| `information_extractor` (multi) | `{ messages, partial? }` | 대화 + 부분적으로 수집된 extracted 필드 (있을 경우). |

### 4.4. Resumed 상태의 `output` 내용

Waiting 시점 output 을 **그대로 유지** (immutable snapshot) 하고 `output.interaction` 을 추가:

```json
{
  "output": {
    ...waiting 시점과 동일한 런타임 필드,
    "interaction": {
      "type": "form_submitted" | "button_click" | "button_continue" | "message_received",
      "data": { /* interaction type별 payload, 아래 참조 */ },
      "receivedAt": "2026-04-19T12:34:56.789Z"
    }
  },
  "status": "resumed",
  "port": "<선택된 포트>"
}
```

### 4.5. `interaction.data` payload 규격

| `interaction.type` | `data` shape | 적용 노드 |
| --- | --- | --- |
| `form_submitted` | `{ [fieldName]: value }` (제출된 필드 값) | `form` |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel`, `table`, `chart`, `template` |
| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼의 Continue 포트 (presentation 노드) |
| `message_received` | `{ content, role: "user" }` | `ai_agent`, `information_extractor` multi-turn |

---

## Principle 5 — `port` 활성화 모델

| 형태 | 의미 | 사용 노드 |
| --- | --- | --- |
| `port: undefined` | 기본 단일 출력 (노드 정의상 outputs가 1개) | `transform`, `send_email`, `manual_trigger` |
| `port: string` | 복수 출력 중 하나 선택 | `if_else`, `switch`, `http_request`, `database_query`, `ai_agent` 등 |
| `port: string[]` | 복수 출력 동시 활성화 (fan-out) | `parallel` (handler), `text_classifier` (multi-label) |

**금지**: `port` 를 출력 포트 ID 이외의 값으로 사용 (예: 현재 ai_agent가 `output.port` 를 조건 ID 선택에 사용하는 패턴은 Principle 8과 함께 제거).

---

## Principle 6 — 동적 포트 ID 네이밍

- **글로벌 버튼**: `config.buttons[i].id` 그대로 사용. 사용자가 설정한 ID.
- **Per-item 버튼** (carousel static 모드 등): `${buttonId}__item_${index}` — carousel이 이미 사용 중인 suffix를 공식 규칙으로 승격. 엔진이 `__item_\d+$` 패턴을 분리하여 원본 포트로 라우팅.
- **시스템 포트 예약어**: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부.
- **동적으로 생성되는 포트**: `class_0` / `class_1` (classifier), `branch_0` / `branch_1` (parallel) 처럼 `<prefix>_<index>` 형식.

---

## Principle 7 — `config` echo 원칙 (NodeHandlerOutput.config)

> `NodeHandlerOutput.config` 는 워크플로우 작성자가 설정한 **원본(pre-evaluation) 값** 을 그대로 echo 하는 필드입니다. expression(`{{ ... }}`) 이 포함된 필드는 평가 전 형태를 echo 하고, **평가 결과는 `output.*` 에 둡니다**.
>
> 후속 노드는:
> - `$node["X"].config.<field>` — 노드가 **어떻게 설정됐는가** (원본 템플릿)
> - `$node["X"].output.<field>` — 노드가 **무엇을 실제로 생산/사용했는가** (평가 결과)
>
> 두 영역의 직교성은 Principle 1.1 의 핵심 전제입니다. 핸들러가 `context.rawConfig` 를 echo 함으로써 이 직교성이 유지됩니다 (PRD `ENG-RC-*`, Spec [실행 엔진 §5.5](../../spec/5-system/4-execution-engine.md)).

**항상 echo** (NodeHandlerOutput.config 에 raw 형태로): 사용자가 UI 에서 설정한 **비민감** 값
- `method`, `url` (credential 제거된 raw 형태), `queryType`, `mode`, `model`, `systemPrompt` (raw — `{{ }}` 포함 가능), `userPrompt` (raw), `subject` (raw), `body` (raw), `fields`, `title`, `submitLabel`, `layout`, `items`, `columns`, `chartType`, `conditions`, `categories`, `iterationLimit`, `branchCount`, `maxTurns`, `maxCollectionRetries`, `outputFormat` 등.

**절대 echo 금지**:
- 자격증명 (password, apiKey, token, secret, oauth credentials).
- 코드 본문 (`code.config.code` — 이미 `expression-exclusions`에 등록되어 있음).
- URL 내 임베디드 credential (`https://user:pass@host` → `https://host` 로 sanitize).
- 파일 업로드 원본 바이너리 (reference만).

**선택적 echo** (크기 문제):
- `form.config.fields` 가 매우 클 경우 → 그대로 echo (정의상 구조 정보).
- `ai_agent.config.systemPrompt` 가 수천 줄일 경우에도 그대로 echo (디버깅 목적).

**`config` (raw) ↔ `output` (evaluated) 관계** (Principle 1.1 재확인):
- 모든 raw config 필드는 **`output` 에 복사되지 않습니다**.
- expression 평가 결과는 `output.*` 에 단일 보존 (Principle 8.2 의 카테고리별 네이밍 원칙을 따름).
- expression 미사용 필드 (예: `mode`, `chartType`) 는 raw 와 evaluated 가 동일하므로 본 변경의 영향 없음.

**`context.rawConfig` 의 mutation 보호**:
- 엔진은 `Object.freeze` 적용한 shallow snapshot 을 주입한다 — top-level 필드 mutation 은 strict 모드에서 TypeError 가 발생한다.
- **Shallow 임에 유의** — `rawConfig.headers.foo = '...'` 같은 중첩 객체 변이는 차단되지 않는다. 핸들러는 rawConfig 를 read-only 로 다루어야 하며, 변형이 필요하면 `structuredClone` 으로 복제한다.

### 핸들러 구현 가이드

```ts
// 표준 패턴 — 핸들러는 context.rawConfig 를 echo, evaluated 값으로 동작.
async execute(input, config /* evaluated */, context /* { rawConfig, ... } */) {
  const evaluatedSubject = config.subject as string;          // "Hello Alice"
  const evaluatedBody = config.body as string;
  await sendMail({ subject: evaluatedSubject, body: evaluatedBody, ... });

  return {
    config: {
      // raw 를 echo. 사용자가 expression 으로 작성했다면 "{{ name }}" 을 그대로.
      integrationId: context.rawConfig?.integrationId,
      to: context.rawConfig?.to,
      subject: context.rawConfig?.subject,                    // "Hello {{ name }}"
      body: context.rawConfig?.body,
      bodyType: context.rawConfig?.bodyType,
    },
    output: {
      messageId: info.messageId,
      // evaluated 값. 후속 노드가 실제 발송된 내용을 참조.
      subject: evaluatedSubject,
      body: evaluatedBody,
      bodyType: config.bodyType,
    },
  };
}
```

---

## Principle 8 — 이중/불필요한 중첩 제거

### 8.1. 금지 패턴

- ❌ `output.output.extracted.*` (현재 `information_extractor`)
- ❌ `output.data.*` 를 "본 결과" 의 1차 wrapper로 사용 (현재 `ai_agent` conditional)
- ❌ `output.metadata.tokens` (현재 `ai_agent`) → `meta.tokens` 로 이동

### 8.2. 통일된 1차 네이밍

| 개념 | 권장 위치 |
| --- | --- |
| LLM의 응답 텍스트/객체 | `output.result.response` (ai_agent) |
| 분류된 카테고리 | `output.result.category` (single) / `output.result.categories` (multi) |
| 추출된 필드 | `output.result.extracted` |
| HTTP 응답 본문 | `output.response` (그대로 유지, 이미 관용적) + `output.responseHeaders` |
| HTTP 요청 본문 (evaluated) | `output.requestBody`, `output.requestBodyType` (Principle 7 — config 의 raw 와 직교) |
| DB 쿼리 결과 | `output.rows`, `output.rowCount`, `output.fields`, `output.insertId?` (그대로 유지) |
| 이메일 전송 결과 | `output.messageId`, `output.accepted`, `output.rejected`, `output.subject`, `output.body`, `output.bodyType` (subject·body 는 Principle 7 — config 의 raw 와 직교) |
| 코드 실행 결과 | `output.result` |
| 프레젠테이션 뷰 | `output.view` (Principle 4 참고) |

> 규칙: **LLM 계열 노드 (ai_agent, text_classifier, information_extractor) 는 `output.result` 아래에 도메인 결과를 모은다.** 이 한 문장이면 3개 노드 모두 일관됩니다.

---

## Principle 9 — Container 노드의 `output` 오버라이트 컨트랙트

Container 노드 (

... (truncated due to size limit) ...
