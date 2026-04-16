# Spec: RAG 검색 엔진

> 관련 문서: [PRD AI & 지식 저장소](../../prd/6-phase2-ai.md) · [Spec AI 노드 §1](../4-nodes/3-ai-nodes.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Knowledge Base](../2-navigation/5-knowledge-base.md)

---

## 1. 개요

AI Agent 노드가 Knowledge Base의 관련 문서를 검색하여 LLM 컨텍스트에 추가하는 RAG(Retrieval-Augmented Generation) 검색 엔진.

---

## 2. 검색 흐름

```
AI Agent 실행
  ↓
userPrompt 확인
  ↓
knowledgeBases 설정 확인 (UUID[])
  ↓ (설정 있으면)
userPrompt를 임베딩 (LLMClient.embed)
  ↓
pgvector 유사도 검색 (cosine similarity)
  ↓
검색 결과를 System Context에 주입
  ↓
LLM 호출 (증강된 컨텍스트 포함)
  ↓
응답 + ragSources 메타데이터 반환
```

---

## 3. 유사도 검색

### 3.1 쿼리

```sql
SELECT
  dc.id AS chunk_id,
  dc.document_id,
  dc.content,
  dc.metadata,
  d.name AS document_name,
  1 - (dc.embedding <=> $1) AS score
FROM document_chunk dc
JOIN document d ON d.id = dc.document_id
WHERE d.knowledge_base_id = ANY($2)
  AND d.embedding_status = 'completed'
  AND 1 - (dc.embedding <=> $1) >= $3
ORDER BY score DESC
LIMIT $4;
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `$1` | 쿼리 임베딩 벡터 | - |
| `$2` | Knowledge Base ID 배열 | config.knowledgeBases |
| `$3` | 유사도 임계값 (threshold) | 0.7 |
| `$4` | 최대 결과 수 (topK) | 5 |

### 3.2 거리 함수

- **Cosine Similarity**: `1 - (embedding <=> query_vector)`
- pgvector `<=>` 연산자: cosine distance
- 점수 범위: 0.0 (무관) ~ 1.0 (동일)

---

## 4. 컨텍스트 주입

### 4.1 형식

검색 결과를 system prompt 하단에 추가:

```
{원본 systemPrompt}

### Relevant Knowledge

The following information was retrieved from the knowledge base. Use it to inform your response when relevant.

---
[Source: {document_name}] (relevance: {score})
{chunk_content}

---
[Source: {document_name}] (relevance: {score})
{chunk_content}

---
```

### 4.2 컨텍스트 크기 제한

- 전체 주입 텍스트가 **모델 컨텍스트 윈도우의 50%** 를 초과하지 않도록 제한
- 초과 시 점수가 낮은 청크부터 제거
- 컨텍스트 윈도우 크기는 모델별 상이 (별도 매핑 테이블 관리)

---

## 5. 출력 메타데이터

AI Agent 응답의 `metadata.ragSources`:

```json
{
  "ragSources": [
    {
      "documentId": "uuid",
      "documentName": "Customer FAQ",
      "chunkId": "uuid",
      "chunk": "관련 텍스트 (최대 200자)...",
      "score": 0.92
    }
  ]
}
```

- `chunk`: 원본 청크 텍스트의 앞 200자 (미리보기용)
- `score`: 유사도 점수 (0.0 ~ 1.0)

---

## 6. 임베딩 모델 일관성

- 검색 쿼리 임베딩은 **Knowledge Base의 embedding_model과 동일한 모델** 사용
- 여러 KB를 동시에 검색할 때, 동일한 embedding_model을 사용하는 KB만 하나의 쿼리로 검색
- 서로 다른 embedding_model을 사용하는 KB는 각각 별도 임베딩 + 검색 수행 후 결과 병합

---

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| KB에 문서가 없거나 모두 processing 상태 | 빈 결과 반환 (RAG 없이 LLM 호출 진행) |
| 임베딩 API 호출 실패 | `RAG_EMBEDDING_ERROR` — RAG 없이 LLM 호출 진행, 경고 로그 |
| 검색 결과 0건 (threshold 미충족) | 빈 결과 반환 (RAG 없이 LLM 호출 진행) |
| pgvector 쿼리 실패 | `RAG_SEARCH_ERROR` — 노드 실행 실패 |

> **원칙**: RAG 검색 실패 시에도 LLM 호출은 진행한다 (graceful degradation). 단, 메타데이터에 RAG 실패 사유를 포함한다.
