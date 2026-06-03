---
id: embedding-pipeline
status: partial
code:
  - codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts
  - codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts
  - codebase/backend/src/modules/knowledge-base/parsers/*.ts
  - codebase/backend/src/modules/knowledge-base/queues/document-embedding.processor.ts
pending_plans:
  - plan/in-progress/spec-sync-embedding-pipeline-gaps.md
---

# Spec: 벡터 임베딩 파이프라인

> 관련 문서: [PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md) · [Spec Knowledge Base](../2-navigation/5-knowledge-base.md) · [Spec LLM 클라이언트](./7-llm-client.md) · [데이터 모델 - Document](../1-data-model.md#212-document)

---

## 1. 개요

Knowledge Base에 문서가 업로드되면, 자동으로 청크 분할 → 벡터 임베딩 생성 → 저장하는 비동기 파이프라인.

---

## 2. 파이프라인 흐름

```
문서 업로드
  ↓
Document 레코드 생성 (status: pending)
  ↓
[비동기] 파이프라인 시작 (status: processing)
  ↓
파일 읽기 (S3에서 다운로드)
  ↓
파일 파싱 (파일 타입별 파서)
  ↓
텍스트 청킹 (chunk_size, chunk_overlap 기준)
  ↓
임베딩 생성 (LLMClient.embed(), 배치 처리)
  ↓
DocumentChunk 일괄 저장 (content + embedding 벡터)
  ↓
Document 상태 업데이트 (status: completed, chunk_count)
  ↓
WebSocket 알림 (프론트엔드 실시간 반영)
```

실패 시: `status: error`, `Document.embedding_error_message` 에 에러 메시지 저장 (sanitize 거친 사용자 노출용. 그래프 추출 오류는 `Document.graph_error_message` — [§10-graph-rag](./10-graph-rag.md) 참조).

---

## 3. 파일 파싱

### 3.1 지원 형식

| 파일 타입 | 파서 | 설명 |
|----------|------|------|
| `.txt` | 직접 읽기 | UTF-8 텍스트 그대로 사용 |
| `.md` | 직접 읽기 | 마크다운 원본 텍스트 (렌더링 없이) |
| `.pdf` | `pdf-parse` | 텍스트 추출 (이미지 내 텍스트는 미지원) |
| `.csv` | 직접 파싱 | 행 단위 텍스트 변환, 헤더를 키로 사용 |

### 3.2 CSV 변환 규칙

각 행을 독립된 텍스트 블록으로 변환:

```
# CSV 원본
name,age,department
Alice,30,Engineering
Bob,25,Marketing

# 변환 결과 (행별)
"name: Alice, age: 30, department: Engineering"
"name: Bob, age: 25, department: Marketing"
```

---

## 4. 청킹 전략

### 4.1 텍스트 청킹

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| chunk_size | 1000 | 청크 최대 토큰 수 |
| chunk_overlap | 200 | 인접 청크 간 겹치는 토큰 수 |

### 4.2 분할 규칙

1. **단락 우선**: `\n\n` 기준으로 분할 시도
2. **문장 폴백**: 단락이 chunk_size를 초과하면 문장(`.`, `!`, `?`) 기준 분할
3. **강제 분할**: 문장도 chunk_size를 초과하면 토큰 단위 강제 분할
4. **오버랩**: 이전 청크의 마지막 chunk_overlap 토큰을 다음 청크 앞에 추가

### 4.3 CSV 청킹

CSV 파일은 전용 행 단위 청킹 경로(`chunking/csv-chunker.ts` `chunkCsv()`)를 거친다. `embedding.service.ts` 는 `doc.fileType === 'csv'` 일 때 공통 `chunkText()` 대신 `chunkCsv()` 를 사용한다.

동작:

- 행 단위로 청크 구성
- chunk_size 내에서 여러 행을 하나의 청크로 결합
- 행 중간에서 분할하지 않음

---

## 5. 임베딩 생성

### 5.1 배치 처리

- LLMClient.embed()의 `input`에 문자열 배열 전달 (배치)
- 배치 크기: **20 청크** (API 요청 수 최소화)
- 프로바이더별 배치 제한 준수 (OpenAI: 2048개, Anthropic: 임베딩 미지원)

### 5.2 임베딩 모델

- KnowledgeBase 엔티티의 `embedding_model` 필드에 지정
- 컬렉션 생성 시 선택 (변경 시 전체 재임베딩 필요)
- 기본 모델: 프로바이더별 상이 (e.g., OpenAI → `text-embedding-3-small`)

### 5.3 벡터 차원

| 모델 | 차원 |
|------|------|
| text-embedding-3-small | 1536 |
| text-embedding-3-large | 3072 |
| text-embedding-ada-002 | 1536 |

DocumentChunk 테이블의 `embedding` 컬럼은 가변 차원을 지원해야 하며, 컬렉션 내 모든 문서는 동일한 임베딩 모델/차원을 사용한다.

---

## 6. 저장소

### 6.1 DocumentChunk 엔티티

> 권위 정의는 [`spec/1-data-model.md §2.12.1`](../1-data-model.md#2121-documentchunk). 아래 표는 임베딩 파이프라인 관점에서 핵심 필드만 다시 보여준다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| document_id | UUID FK → Document | |
| chunk_index | integer | 청크 순서 (0-based) |
| content | text | 청크 텍스트 원본 |
| embedding | vector | 벡터 임베딩 (pgvector) |
| token_count | integer | 청크의 토큰 수 |
| metadata | jsonb | `{ page?: number, section?: string }` — **현재 항상 빈 `{}` 로 INSERT** (page/section 채우는 파서 경로 미구현, Planned). 추적: [`plan/in-progress/spec-sync-embedding-pipeline-gaps.md`](../../plan/in-progress/spec-sync-embedding-pipeline-gaps.md) |

### 6.2 pgvector 설정

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- 테이블 생성
CREATE TABLE document_chunk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector NOT NULL,
  token_count INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  UNIQUE(document_id, chunk_index)
);

-- 유사도 검색 인덱스 (IVFFlat — 컨셉 예시)
CREATE INDEX idx_document_chunk_embedding
  ON document_chunk USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

> 위 DDL 은 컨셉 예시. 실제 운영 인덱스는 V022/V023 (+ V030~V032 후속 정비) 으로 **차원별 partial HNSW** (`vector` / `halfvec`) 로 분리되어 있다. 마이그레이션 상세는 [`spec/data-flow/6-knowledge-base.md §2.3`](../data-flow/6-knowledge-base.md) 및 `codebase/backend/migrations/V022_*.sql`, `V023_*.sql`, `V030_*.sql`–`V032_*.sql` 참조.

---

## 7. 비동기 처리

### 7.1 BullMQ 큐 기반 비동기

문서 임베딩은 BullMQ 큐 `document-embedding` 으로 라우팅된다. 진입점은 세 곳:

- 문서 업로드 직후 (`POST /api/knowledge-bases/:id/documents`)
- 문서 단건 재임베딩 (`POST /api/knowledge-bases/:id/documents/:docId/re-embed`)
- KB 전체 재임베딩 (`POST /api/knowledge-bases/:id/re-embed`)

```typescript
// 문서 업로드 API 에서
const document = await this.documentRepository.save({ ...status: 'pending' });
await this.kbService.enqueueEmbedding(document.id);
return document;
```

큐를 사용하므로 ① 프로세스 재시작에도 작업이 유실되지 않고 ② 다중 인스턴스 환경에서 Redis 가 동시성/지속성을 분산 관리한다.

### 7.1.1 Graph RAG 모드의 chained dispatch

KB 의 `rag_mode` 가 `graph` 면 `document-embedding` worker 가 임베딩을 마치고 `embedding_status = 'completed'` 로 갱신한 직후 `graph-extraction` 큐로 child job 을 add 한다. 사용자 개입 없이 그래프 추출이 자동 시작된다. 상세 흐름은 [Spec Graph RAG §3](./10-graph-rag.md#3-그래프-추출-파이프라인) 참조.

### 7.2 동시 처리 제한

- `DocumentEmbeddingProcessor` 의 BullMQ Worker concurrency 로 제한
- 기본 동시 처리: **3건** (`@Processor(QUEUE, { concurrency: 3 })`)
- 목적: LLM API 속도 제한 대비, 메모리 사용량 제어

### 7.3 재임베딩

#### 7.3.1 문서 단건 — `POST /api/knowledge-bases/:id/documents/:docId/re-embed`

1. 권한 검증 + 문서 존재 확인
2. `document-embedding` 큐에 `{ documentId, reEmbed: true }` 추가 (응답 202)
3. Worker 가 받아 기존 청크 삭제 → 재임베딩

#### 7.3.2 KB 전체 — `POST /api/knowledge-bases/:id/re-embed`

1. atomic compare-and-swap 으로 잠금 획득:
   ```sql
   UPDATE knowledge_base
     SET reembed_status = 'in_progress', embedding_dimension = NULL
     WHERE id = $1 AND workspace_id = $2 AND reembed_status = 'idle'
     RETURNING id
   ```
   결과가 0행이면 `409 KB_REEMBED_IN_PROGRESS`.
2. KB 의 모든 문서를 큐에 `addBulk` (각 child job 에 `isKbBatch: true, knowledgeBaseId: <kbId>` 포함)
3. 응답 즉시 202 반환 (`{ documentCount }`)
4. 마지막 child job 의 completed/failed 시점에 `DocumentEmbeddingProcessor` 가 KB 의 남은 pending/processing 문서가 0건임을 확인하면 `reembed_status = 'idle'` 로 reset
5. 빈 KB 의 경우 `addBulk` 가 비어 있어 finalize 가 호출되지 않으므로, 진입 시 즉시 idle 로 되돌린다.

`reembed_status` 가 `in_progress` 인 KB 는 `embedding_dimension` 이 NULL 이므로 `RagSearchService` 에서 자연스럽게 검색 대상에서 제외된다 (재임베딩 완료 후 다시 포함).

---

## 8. WebSocket 알림

채널 명명규약: `kb:${documentId}` (KB ID 가 아니라 **문서 ID** 가 채널 키). payload 에는 항상 `documentId`, `timestamp` (ISO 8601) 가 자동 첨부된다. backend 권위 정의는 `WebsocketService.emitKbEvent` (KbEventType union).

### 8.1 임베딩 이벤트

| 이벤트 | 페이로드 | 시점 |
|--------|---------|------|
| `document:embedding_started` | `{ documentId, knowledgeBaseId }` | processing 시작 |
| `document:embedding_progress` | `{ documentId, progress: number }` | 청크 배치 완료마다 (0~100) |
| `document:embedding_completed` | `{ documentId, chunkCount }` | 완료 |
| `document:embedding_error` | `{ documentId, error: string }` | in-flight 일시 오류 — `document:embedding_retry` 또는 `embedding_failed` 가 곧 따라온다. **영구 실패 신호로 사용하지 말 것** (영구 실패는 `embedding_failed`) |
| `document:embedding_retry` | `{ documentId, attempt: number, maxAttempts: number, error: string }` | 일시 오류 후 재시도 큐잉 직전 |
| `document:embedding_failed` | `{ documentId, error: string }` | 재시도 모두 소진 또는 비재시도성 오류로 최종 실패 |

본 이벤트들은 [§9.2 상태 전이](#92-상태-전이) 와 직접 대응되며, `embedding_error` 는 일시 오류만 의미한다.

### 8.2 그래프 추출 이벤트

`rag_mode = 'graph'` KB 의 문서에 대해 동일 채널(`kb:${documentId}`) 로 6개 이벤트가 추가 emit 된다 — `document:graph_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`. 의미·payload 는 [`spec/5-system/10-graph-rag.md §6`](./10-graph-rag.md) 의 정의를 따른다.

---

## 9. Retry & Failure

LLM 호출의 일시 오류로 인한 영구 "처리중" stuck 을 방지하기 위해 자동 재시도와 명시적 최종 실패 상태를 둔다.

### 9.1 자동 재시도

- 각 batch 임베딩 호출은 `withTimeout(60_000)` 으로 wrap — 60s 안에 응답이 없으면 즉시 reject.
- 문서 단위 `retryWithBackoff(maxRetries=3, baseDelayMs=1_000)` 으로 timeout / 5xx / network / 429 같은 일시 오류를 1s → 4s → 16s 백오프로 최대 3회 자동 재시도.
- 비재시도 대상: 4xx (401/403/422), 차원 mismatch, empty vector 같은 도메인 에러 — 즉시 `failed`.
- 2번째 attempt 부터 `reEmbed=true` 가 강제되어 chunk 가 깨끗히 정리된 뒤 다시 처리됨 (idempotency 보장).

### 9.2 상태 전이

```
pending → processing → completed                    (성공)
pending → processing → error → processing → completed   (1회 재시도 후 성공)
pending → processing → error → … → failed           (재시도 소진 / 비재시도성 오류)
```

- `error` = in-flight 재시도 중 일시 오류. `embedding_retry_count` 가 1 이상이며 다음 attempt 가 예정됨.
- `failed` = 최종 실패. 사용자가 수동 재시도 (단건 `/re-embed`, 일괄 `/retry-failed`, KB 전체 `/re-embed`) 를 트리거할 때까지 그대로 유지.
- 성공 시 `embedding_retry_count = 0`, `embedding_error_message = NULL` 로 리셋.

### 9.3 Bootstrap stuck 회수

`StuckDocumentRecoveryService` (`OnApplicationBootstrap`) 가 매 부팅 시 다음을 수행한다.

```sql
SELECT id FROM document
 WHERE embedding_status = 'processing'
   AND embedding_last_attempted_at IS NOT NULL
   AND embedding_last_attempted_at < NOW() - INTERVAL '10 minutes';
```

대상 문서는 `embedding_status = 'pending'` 으로 되돌리고 `document-embedding` 큐에 `reEmbed=true` 로 재 add. `last_attempted_at` 이 NULL 인 레거시 문서는 false-positive 방지를 위해 제외한다. 10분 임계는 BullMQ stalledInterval(30s)×2 + 부팅 지연 + 마진으로 산정.

### 9.4 일괄 재시도 API

`POST /api/knowledge-bases/:id/retry-failed` `{ scope: 'embedding' | 'graph' | 'all' }`

> 프론트엔드 UI 는 vector / graph 두 분리 버튼이라 `scope: 'embedding'` 또는 `'graph'` 만 전송한다. `'all'` 은 운영/스크립트용.

- `scope = 'embedding'` 또는 `'all'`: `embedding_status = 'failed'` 문서만 큐잉
- 큐잉 직전 `embedding_retry_count = 0`, `embedding_error_message = NULL`, `embedding_status = 'pending'` 으로 리셋
- KB 잠금 (`reembed_status`) 은 건드리지 않음 (부분 재시도는 가벼운 작업)
- RBAC: editor 이상, Throttle: 3/60s

---

## Rationale

본 파이프라인의 주요 결정 사항.

### 결정: 다중 차원 임베딩 + KB 단위 모델 선택

#### 배경

`spec/5-system/8-embedding-pipeline.md §5.3`이 명시한 "embedding 컬럼 가변 차원" 요구사항과 `9-rag-search.md §6` "임베딩 모델 일관성"(KB별 model로 query 임베딩, 그룹별 분리 검색)을 충족하기 위해, 다중 차원을 지원하고 사용자가 KB 생성/수정 시 임베딩 모델을 선택할 수 있도록 한다.

#### 결정 사항

- 차원 지원: 다중 차원 (스키마 마이그레이션 + partial HNSW 인덱스 도입)
- 모델 변경 정책: 변경 허용 + 수동 KB 단위 재임베딩 버튼
- RAG 검색 모델 일치 동작 포함

#### 핵심 결과

- **V021** (`codebase/backend/migrations/V021__variable_embedding_dimension.sql`): `document_chunk.embedding` 을 untyped `vector` 로 변경, `knowledge_base.embedding_dimension` 컬럼 추가, `embedding_model` default 통일, V005 NOTE 인덱스(`idx_document_chunk_embedding`) IF EXISTS 정리.
- **V022** (+ `.conf`): 차원별 partial HNSW 인덱스(768/1536/3072) `CREATE INDEX CONCURRENTLY` 로 분리. `executeInTransaction=false`.
- **EmbeddingService**: 첫 임베딩 시 KB.embeddingDimension 자동 채움, 이후 배치는 차원 일관성 강제. 빈 vector 도 throw.
- **KnowledgeBaseService**: `update` 에서 embeddingModel 실제 변경 시 `embeddingDimension = null` 함께 reset. `reEmbedAll(id, ws)` 신설 — `inFlightReEmbeds` in-memory 잠금(중복 호출 409) + `p-limit(5)` 동시 큐잉 상한.
- **KnowledgeBaseController**: `POST /:id/re-embed` (HTTP 202, editor, `@Throttle 3/min`), 응답에 `satisfies KbReEmbedAcceptedDto`.
- **RagSearchService**: KB 메타를 한 번에 조회 → `(model, dim)` 그룹핑 → `Promise.all` 로 그룹별 query 임베딩 + 차원 cast SQL 병렬 처리. NULL/unsupported 차원 KB 는 검색 제외(unsupported 는 ERROR 로그). `searchGroup` private 헬퍼 추출.
- **공유 상수** `embedding/embedding-dimensions.const.ts`: `SUPPORTED_EMBEDDING_DIMS`, `EMBEDDING_MODEL_PATTERN`. RagSearch + Create/Update DTO 가 모두 참조.
- **LlmService.listModels**: `{ type?: 'chat'|'embedding' }` 옵션을 서비스 레이어에서 필터링. `LlmConfigController` 는 `@ApiQuery` 데코레이터 추가.
- **프론트엔드**: `EmbeddingModelCombobox` 신설(지정 LLM Config 의 embedding 모델을 "모델 불러오기" 버튼으로 조회한 뒤 select 로 선택. 자유 입력 fallback 없음 — [지식 저장소 §Rationale R-1](../2-navigation/5-knowledge-base.md#r-1-임베딩-모델-선택을-select-only-로-한정)). KB 생성 폼/상세 설정 모달에서 사용. KB 상세에 "지식 베이스 설정" 모달, "KB 전체 재임베딩" 버튼 + 확인 모달, embeddingDimension 메타 노출. payload 타입 `KbUpdatePayload` 명시, reEmbedAll 응답 envelope unwrap, chunkSize/chunkOverlap 사전 검증.

#### 후속 검토

- 인라인 모달 3개 → 공용 ConfirmModal 추출
- `allEmbeddings` 메모리 누적 → 배치 임베딩 직후 스트리밍 INSERT
- 다중 인스턴스 환경의 reEmbedAll 분산 잠금 (advisory lock 또는 DB 컬럼)

#### 후속 적용

- **V023 halfvec 인덱스**: pgvector 0.7+ 의 halfvec 으로 3072 차원에도 partial
  HNSW 인덱스 부착. `getEmbeddingCastType(dim)` 로 차원별 cast(vector/halfvec)
  동적 결정, RagSearch SQL 이 인덱스 정의와 동일 표현식을 쓰도록 동기화.
- **V024 reembed_status + BullMQ 'document-embedding' 큐**: fire-and-forget
  + in-memory 잠금을 BullMQ 큐 + DB 컬럼으로 교체. 세 진입점(uploadDocument/
  단건 reEmbed/KB reEmbedAll) 모두 큐로 라우팅. KB reEmbedAll 잠금은 atomic
  `UPDATE ... WHERE reembed_status='idle' RETURNING id` 으로 race-free.
  Worker concurrency=3 이 EmbeddingService MAX_CONCURRENT 폴링을 대체.
  마지막 child job 의 completed/failed 시점에 Processor 가 남은 pending/processing
  문서 0건이면 reembed_status='idle' 로 reset. spec/5-system/8-embedding-pipeline.md
  §7 / spec/1-data-model.md §2.11 / spec/2-navigation/5-knowledge-base.md API 표 갱신.

### 결정: spec 정합성 정비

`Document.metadata` 에 에러를 저장하던 구 방식은 전용 컬럼 `Document.embedding_error_message` 도입 (V024 후속) 으로 폐기되었다. spec 본문(§2)도 이에 맞춰 정정.

IVFFlat 단일 인덱스에서 차원별 partial HNSW (V022 `vector` + V023 `halfvec` + V030–V032 후속) 로 전환했다. pgvector 0.7+ 의 halfvec 으로 3072 차원에도 partial 인덱스 부착이 가능해졌고, 차원별 cast 가 인덱스 정의와 SQL 표현식을 일치시킨다. 컨셉 DDL 은 본문에 유지하되, 실 운영 인덱스는 마이그레이션 SQL 을 권위로 둔다.

`retry-failed` API 의 `scope: 'all'` 은 초기 `spec/2-navigation/5-knowledge-base.md §2.4.1` 표기에서 누락되어 있었다. 본 spec §9.4 와 정합화하여 API 표에도 추가. 프론트엔드 UI 는 vector / graph 두 분리 버튼 구조라 두 단일 값만 사용하고, `'all'` 은 운영/스크립트용으로 보존.

WebSocket 채널 명명을 KB 단위(`embedding:{knowledgeBaseId}`) 에서 **문서 단위**(`kb:${documentId}`) 로 전환. backend `KbEventType` union (12개 이벤트) 과 `emitKbEvent` 구현이 권위이며, frontend `useKbEvents` 가 동일하게 구독한다. 점 표기(`embedding.started`) → 콜론+언더스코어 표기(`document:embedding_started`) 도 backend 정렬.

`kb:graph_stats_updated` 이벤트는 spec 에 포함하지 않는다. `kb-stats.helper.ts` 가 `emitExecutionEvent` 로 호출해 채널이 `execution:kb:…` 로 prefix 되어 frontend 의 `kb:` 구독에 도달하지 못하는 dead path 이며 type union 에도 없다 (`as never` 강제 캐스트).
