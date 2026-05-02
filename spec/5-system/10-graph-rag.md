# Spec: Graph RAG

> 관련 문서: [PRD Graph RAG](../../prd/9-graph-rag.md) · [Spec RAG 검색](./9-rag-search.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Knowledge Base 화면](../2-navigation/5-knowledge-base.md) · [Spec 데이터 모델 - KnowledgeBase / Entity / Relation](../1-data-model.md#211-knowledgebase) · [Spec AI 노드 §1](../4-nodes/3-ai-nodes.md#1-ai-agent)

---

## 1. 개요

Graph RAG 는 KB 의 검색 모드(`rag_mode`) 가 `graph` 일 때 활성화되는 검색 흐름이다. vector seed → graph expansion → rerank 의 Hybrid 형태로 동작하며, 기존 `vector` 모드 KB 와 동일 인프라(PostgreSQL + pgvector + BullMQ) 위에서 추가 의존성 없이 작동한다.

```
문서 업로드
  ↓
Document 레코드 생성 (status: pending)
  ↓
embedding 큐 (document-embedding) → EmbeddingService.processDocument
  ↓
embedding_status = 'completed'
  ↓
[graph KB 일 때만] graph-extraction 큐로 chained dispatch
  ↓
GraphExtractionService.extractDocument
  ↓
chunk 마다 LLM 호출 → entity / relation 추출 + dedup → DB INSERT
  ↓
graph_extraction_status = 'completed'
  ↓
WebSocket 알림 (KB 상세 실시간 갱신)
```

---

## 2. 데이터 모델

### 2.1 KnowledgeBase 추가 컬럼

[Spec 데이터 모델 §2.11](../1-data-model.md#211-knowledgebase) 의 KnowledgeBase 에 다음 컬럼이 추가된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `rag_mode` | Enum | `vector` (default) / `graph`. **생성 시에만 결정, 사후 변경 불가** |
| `extraction_llm_config_id` | UUID? | 그래프 추출에 사용할 LLMConfig 의 chat 모델. NULL 이면 워크스페이스 default LLMConfig |
| `max_hops` | Integer | 검색 시 그래프 확장 깊이 (1 또는 2, default 1). `vector` 모드에서는 무시 |
| `vector_seed_top_k` | Integer | 검색 시 vector seed 개수 (default 5). `vector` 모드에서는 무시 |
| `expanded_chunk_limit` | Integer | graph expansion 후 회수할 청크 상한 (default 15). `vector` 모드에서는 무시 |
| `entity_count` | Integer | KB 의 entity 총 수 (캐시) |
| `relation_count` | Integer | KB 의 relation 총 수 (캐시) |

> `rag_mode = 'vector'` 인 KB 는 graph 관련 컬럼/테이블을 사용하지 않는다. AI Agent 의 RAG 호출도 `vector` 흐름 그대로.

### 2.2 Document 추가 컬럼

[Spec 데이터 모델 §2.12](../1-data-model.md#212-document) 의 Document 에 다음 컬럼이 추가된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `graph_extraction_status` | Enum | pending / processing / completed / error. `vector` 모드 KB 에서는 항상 `pending` 으로 두고 사용하지 않음 |

### 2.3 Entity (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `knowledge_base_id` | UUID | FK → KnowledgeBase (CASCADE) |
| `name` | String | 정규화된 entity 이름 (소문자·trim) |
| `display_name` | String | 사용자 표시용 원형 |
| `type` | String | entity 타입. P0 enum: `person` / `organization` / `concept` / `location` / `event` / `other` |
| `description` | Text? | LLM 이 추출한 짧은 설명 (옵션) |
| `mention_count` | Integer | KB 내 청크에서 언급된 횟수 (캐시) |
| `last_seen_chunk_id` | UUID? | 마지막으로 등장한 청크 (FK → DocumentChunk) |
| `created_at` | Timestamp | 첫 추출 시각 |
| `updated_at` | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, name, type)` — KB 안에서 동일 이름·타입 entity 는 한 row 로 통합

**인덱스**:
- `(knowledge_base_id, type)` — 타입별 조회
- `(knowledge_base_id, mention_count DESC)` — centrality 정렬

### 2.4 Relation (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `knowledge_base_id` | UUID | FK → KnowledgeBase (CASCADE) |
| `head_entity_id` | UUID | FK → Entity |
| `tail_entity_id` | UUID | FK → Entity |
| `predicate` | String | 관계 서술어 (예: "founded", "employs", "is_part_of"). P0 free-form |
| `evidence_chunk_id` | UUID? | 추출 근거 청크 (FK → DocumentChunk) |
| `weight` | Integer | 동일 (head, predicate, tail) 가 여러 chunk 에서 발견되었을 때의 누적 횟수 |
| `created_at` | Timestamp | 첫 추출 시각 |
| `updated_at` | Timestamp | 마지막 갱신 시각 |

**제약조건**: `UNIQUE(knowledge_base_id, head_entity_id, predicate, tail_entity_id)`

**인덱스**:
- `(knowledge_base_id, head_entity_id)` — head 기준 1-hop 확장
- `(knowledge_base_id, tail_entity_id)` — tail 기준 역방향 확장

### 2.5 ChunkEntity (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| `chunk_id` | UUID | PK 일부, FK → DocumentChunk (CASCADE) |
| `entity_id` | UUID | PK 일부, FK → Entity (CASCADE) |
| `mention_text` | String? | 청크에서 등장한 원형 표기 (정규화 전) |

**제약조건**: `PRIMARY KEY (chunk_id, entity_id)`

**인덱스**:
- `(entity_id)` — entity → chunk 역방향 회수 (검색 expansion 단계에서 사용)

---

## 3. 그래프 추출 파이프라인

### 3.1 큐 라우팅

`document-embedding` 큐의 worker 가 임베딩을 마치고 `embedding_status = 'completed'` 로 갱신한 직후, KB 의 `rag_mode` 가 `graph` 면 `graph-extraction` 큐로 다음 job 을 add 한다.

```
document-embedding job (completed)
  └→ if (kb.rag_mode === 'graph') queue('graph-extraction').add({ documentId, knowledgeBaseId })
```

### 3.2 GraphExtractionProcessor

`@Processor('graph-extraction', { concurrency: 2 })` (LLM 호출 비용·rate limit 고려해 임베딩보다 낮은 동시성).

1. `Document.graph_extraction_status = 'processing'` 갱신, WebSocket `document:graph_started` 발사
2. 해당 document 의 모든 chunk 를 순회 (재시도 시 기존 entity/relation 은 KB 단위 dedup 으로 자연 통합)
3. chunk 마다 LLM 호출 (`extraction_llm_config_id` 또는 default LLMConfig 의 chat 모델):
   - 시스템 prompt: entity 타입 / relation 형식 / JSON schema 강제
   - user 메시지: chunk content (max 2000 token)
   - 응답: `{ entities: [{ name, displayName, type, description? }], relations: [{ head, predicate, tail }] }`
4. 결과를 KB 단위로 dedup INSERT/UPSERT (Entity 는 `(name, type)` 충돌 시 `mention_count += 1`, Relation 은 `(head, predicate, tail)` 충돌 시 `weight += 1`)
5. ChunkEntity 매핑 INSERT (chunk_id × entity_id)
6. 진행률 WebSocket emit (`document:graph_progress`, 0~100)
7. 모든 chunk 종료 시 `Document.graph_extraction_status = 'completed'` + WebSocket `document:graph_completed`

### 3.3 추출 LLM 응답 스키마

LLM 호출 시 JSON Schema 강제:

```json
{
  "type": "object",
  "properties": {
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "정규화된 이름 (소문자·trim·동의어 통합)" },
          "displayName": { "type": "string", "description": "원문에서 등장한 자연 표기" },
          "type": {
            "type": "string",
            "enum": ["person", "organization", "concept", "location", "event", "other"]
          },
          "description": { "type": "string" }
        },
        "required": ["name", "displayName", "type"]
      }
    },
    "relations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "head": { "type": "string", "description": "head entity 의 name (정규화 형)" },
          "predicate": { "type": "string", "description": "동사·관계 서술어. snake_case 권장" },
          "tail": { "type": "string", "description": "tail entity 의 name (정규화 형)" }
        },
        "required": ["head", "predicate", "tail"]
      }
    }
  },
  "required": ["entities", "relations"]
}
```

응답 검증:
- `relation.head` / `relation.tail` 은 동일 응답 내 `entities[*].name` 에 존재해야 한다 (LLM 환각 방지). 매칭 실패 relation 은 drop 후 warn.
- entity 가 0개로 추출된 chunk 는 그래프에 영향 없음 (skip).

### 3.4 재추출

- 문서 단건: `POST /api/knowledge-bases/:kbId/documents/:docId/re-extract`
- KB 전체: `POST /api/knowledge-bases/:kbId/re-extract` — KB 의 모든 entity/relation/chunk_entity 를 삭제 후 모든 문서에 대해 큐잉
- 임베딩 재실행 (`re-embed`) 은 그래프 추출도 자동 chained (KB 가 graph 모드인 경우)

---

## 4. 검색 흐름 (Hybrid)

KB.rag_mode 별로 `RagSearchService.search()` 가 분기한다. `vector` 모드는 [Spec 9-rag-search.md](./9-rag-search.md) 그대로.

### 4.1 graph 모드 단계

```
[1] query 임베딩 (KB.embedding_model)
    ↓
[2] vector seed: vectorSeedTopK 만큼 chunk 회수 (기존 vector 검색 동일)
    ↓
[3] seed chunk 가 언급한 entity 집합 수집 (chunk_entity JOIN)
    ↓
[4] graph expansion: 1~maxHops 깊이까지 head/tail 양방향 traversal
    ↓
[5] expanded entity 들이 등장한 chunk 추가 회수 (chunk_entity 역방향)
    ↓
[6] 합쳐진 chunk 집합을 score 재정렬:
       - vector seed: 원래 cosine similarity score
       - expanded chunk: cosine similarity × centrality_weight
       - centrality_weight = log(entity.mention_count + 1) / log(MAX_MENTION + 1)
    ↓
[7] 상위 ragTopK 만 컨텍스트에 주입
```

### 4.2 SQL 흐름 (recursive CTE)

```sql
-- 1. vector seed
WITH seed AS (
  SELECT dc.id AS chunk_id, dc.content, dc.metadata,
         d.id AS document_id, d.name AS document_name,
         1 - (dc.embedding::vector(1536) <=> $1) AS score
    FROM document_chunk dc
    JOIN document d ON d.id = dc.document_id
   WHERE d.knowledge_base_id = $2
     AND d.embedding_status = 'completed'
   ORDER BY score DESC
   LIMIT $3        -- vectorSeedTopK
),
-- 2. seed entity 들
seed_entities AS (
  SELECT DISTINCT ce.entity_id
    FROM chunk_entity ce
    JOIN seed s ON s.chunk_id = ce.chunk_id
),
-- 3. graph expansion (recursive)
expanded_entities AS (
  SELECT entity_id, 0 AS depth FROM seed_entities
  UNION
  SELECT CASE WHEN r.head_entity_id = e.entity_id THEN r.tail_entity_id ELSE r.head_entity_id END,
         e.depth + 1
    FROM expanded_entities e
    JOIN relation r ON (r.head_entity_id = e.entity_id OR r.tail_entity_id = e.entity_id)
   WHERE e.depth < $4   -- maxHops
),
-- 4. expanded chunk
expanded_chunks AS (
  SELECT DISTINCT ce.chunk_id
    FROM chunk_entity ce
    JOIN expanded_entities e ON e.entity_id = ce.entity_id
)
-- 5. final select with rerank
SELECT chunk_id, content, score FROM (
  SELECT s.chunk_id, s.content, s.document_name, s.metadata, s.score, 'seed' AS origin
    FROM seed s
  UNION ALL
  SELECT ec.chunk_id, dc.content, d.name, dc.metadata,
         (1 - (dc.embedding::vector(1536) <=> $1)) * COALESCE(centrality_weight(ec.chunk_id), 1) AS score,
         'expanded' AS origin
    FROM expanded_chunks ec
    JOIN document_chunk dc ON dc.id = ec.chunk_id
    JOIN document d ON d.id = dc.document_id
   WHERE ec.chunk_id NOT IN (SELECT chunk_id FROM seed)
) t
ORDER BY score DESC
LIMIT $5;        -- ragTopK
```

> 위 SQL 은 개념 정의이며 실제 구현은 차원별 partial HNSW (V022 / V023) 와 동일 cast 표현식을 따른다.

### 4.3 출력 메타데이터

검색 응답에 graph 흐름 추적 메타가 추가된다.

```json
{
  "ragSources": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentName": "Customer FAQ",
      "chunk": "관련 텍스트 (앞 200자)...",
      "score": 0.92,
      "origin": "seed"
    },
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentName": "Product Manual",
      "chunk": "그래프 확장으로 회수된 텍스트...",
      "score": 0.78,
      "origin": "expanded"
    }
  ],
  "graphTraversal": {
    "mode": "graph",
    "seedChunkCount": 5,
    "traversedEntityCount": 12,
    "maxDepth": 1,
    "expandedChunkCount": 8
  }
}
```

`graphTraversal` 객체는 `mode === 'vector'` 일 때 생략된다.

---

## 5. API

### 5.1 추출 / 재추출

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/knowledge-bases/:kbId/documents/:docId/re-extract` | 문서 단건 그래프 재추출 (graph 모드 KB 에서만 유효) |
| POST | `/api/knowledge-bases/:kbId/re-extract` | KB 전체 재추출 — 모든 entity/relation/chunk_entity 삭제 후 모든 문서 재추출. `KB_REEXTRACT_IN_PROGRESS` 잠금 (재임베딩과 동일 패턴) |

### 5.2 그래프 조회 (P1)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/knowledge-bases/:kbId/entities` | entity 목록 (페이지네이션, 검색, 타입 필터) |
| GET | `/api/knowledge-bases/:kbId/entities/:entityId` | entity 상세 + 등장 chunk 목록 |
| DELETE | `/api/knowledge-bases/:kbId/entities/:entityId` | entity 삭제 (관련 relation, chunk_entity CASCADE) |
| GET | `/api/knowledge-bases/:kbId/relations` | relation 목록 (페이지네이션, head/tail 검색) |
| DELETE | `/api/knowledge-bases/:kbId/relations/:relationId` | relation 삭제 |
| GET | `/api/knowledge-bases/:kbId/graph/stats` | entity_count / relation_count / 추출 진행 상태 요약 |
| GET | `/api/knowledge-bases/:kbId/graph/visualization` | 상위 mention_count entity + relation 페이로드 (시각화 용) |

---

## 6. WebSocket 이벤트

기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다.

| 이벤트 | 페이로드 | 시점 |
|--------|---------|------|
| `document:graph_started` | `{ documentId, knowledgeBaseId }` | 추출 시작 |
| `document:graph_progress` | `{ documentId, progress: number, entityDelta: number, relationDelta: number }` | chunk 처리마다 |
| `document:graph_completed` | `{ documentId, entityCount, relationCount }` | 완료 |
| `document:graph_error` | `{ documentId, error: string }` | 실패 |
| `kb:graph_stats_updated` | `{ knowledgeBaseId, entityCount, relationCount }` | KB 단위 통계 변동 시 (캐시 컬럼 갱신과 동기) |

---

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| 추출 LLM 호출 실패 | `Document.graph_extraction_status = 'error'`, metadata 에 사유 기록. KB 검색은 해당 문서를 vector-only fallback 으로 계속 회수 |
| 추출 응답 JSON 파싱 실패 | 최대 2회 재시도, 소진 시 chunk 단위 skip + warn |
| relation 의 head/tail 가 응답 entities 에 없음 | 해당 relation drop + warn (LLM 환각) |
| graph 모드 KB 인데 entity_count = 0 (추출 미완료/실패) | 검색이 vector-only 흐름으로 자동 fallback (빈 그래프 expansion = vector top-K 와 동일) |
| `re-extract` 동시 호출 | DB 컬럼 (`reextract_status`) atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS` |

> **원칙**: 그래프 검색이 어떠한 이유로든 빈 결과를 만들 경우, vector seed 결과만으로 응답을 구성한다 (graceful degradation).

---

## 8. 비-목표

- Entity disambiguation (서로 다른 사람 동명이인 구분) — P2 검토. 현재는 `(name, type)` 일치 시 동일 entity 로 간주.
- Cross-KB graph linking — KB 간 entity 통합 검색은 P2 이후 (현재는 KB 단위로 격리).
- Graph embedding (Node2Vec 등) — 검색에 활용하지 않음 (P2 이후).
- 자동 prompt tuning — 추출 prompt 는 시스템 prompt 고정 (P2 에 KB 단위 prompt override 검토).
