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

### 7.1 In-process 비동기

큐 없이 `Promise` 기반 비동기 처리:

```typescript
// 문서 업로드 API에서
const document = await this.documentRepository.save({ ... status: 'pending' });
// 응답 즉시 반환
this.embeddingService.processDocument(document.id).catch(err => {
  this.logger.error(`Embedding failed for ${document.id}`, err);
});
return document;
```

### 7.2 동시 처리 제한

- `p-limit` 또는 세마포어 패턴으로 동시 임베딩 처리 수 제한
- 기본 동시 처리: **3건**
- 목적: LLM API 속도 제한 대비, 메모리 사용량 제어

### 7.3 재임베딩

`POST /api/knowledge-bases/:id/documents/:docId/re-embed`:
1. 기존 DocumentChunk 전체 삭제
2. Document.embedding_status → `pending`
3. 파이프라인 재실행

---

## 8. WebSocket 알림

| 이벤트 | 페이로드 | 시점 |
|--------|---------|------|
| `document:embedding_started` | `{ documentId, knowledgeBaseId }` | processing 시작 |
| `document:embedding_progress` | `{ documentId, progress: number }` | 청크 배치 완료마다 (0~100) |
| `document:embedding_completed` | `{ documentId, chunkCount }` | 완료 |
| `document:embedding_error` | `{ documentId, error: string }` | 실패 |
