# Spec: 벡터 임베딩 파이프라인

> 관련 문서: [PRD AI & 지식 저장소](../../prd/6-phase2-ai.md) · [Spec Knowledge Base](../2-navigation/5-knowledge-base.md) · [Spec LLM 클라이언트](./7-llm-client.md) · [데이터 모델 - Document](../1-data-model.md#212-document)

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

실패 시: `status: error`, Document.metadata에 에러 메시지 저장.

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

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| document_id | UUID FK → Document | |
| chunk_index | integer | 청크 순서 (0-based) |
| content | text | 청크 텍스트 원본 |
| embedding | vector | 벡터 임베딩 (pgvector) |
| token_count | integer | 청크의 토큰 수 |
| metadata | jsonb | `{ page?: number, section?: string }` |

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

-- 유사도 검색 인덱스 (IVFFlat)
CREATE INDEX idx_document_chunk_embedding
  ON document_chunk USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

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

| 이벤트 | 페이로드 | 시점 |
|--------|---------|------|
| `document:embedding_started` | `{ documentId, knowledgeBaseId }` | processing 시작 |
| `document:embedding_progress` | `{ documentId, progress: number }` | 청크 배치 완료마다 (0~100) |
| `document:embedding_completed` | `{ documentId, chunkCount }` | 완료 |
| `document:embedding_error` | `{ documentId, error: string }` | 실패 |
