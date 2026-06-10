---
id: graph-rag
status: implemented
code:
  - codebase/backend/src/modules/knowledge-base/graph/**
  - codebase/backend/src/modules/knowledge-base/queues/graph-extraction.processor.ts
  - codebase/backend/src/modules/knowledge-base/queues/stuck-document-recovery.service.ts
  - codebase/backend/src/modules/knowledge-base/graph.controller.ts
  - codebase/backend/src/modules/knowledge-base/dto/retry-failed.dto.ts
  - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
  - codebase/frontend/src/components/knowledge-base/graph-3d-renderer.tsx
  - codebase/frontend/src/components/knowledge-base/graph-visualization.tsx
  - codebase/frontend/src/components/knowledge-base/entity-list.tsx
  - codebase/frontend/src/components/knowledge-base/relation-list.tsx
  - codebase/frontend/src/components/knowledge-base/entity-detail-dialog.tsx
  - codebase/frontend/src/components/knowledge-base/kb-form-body.tsx
  - codebase/backend/migrations/V025__graph_rag.sql
  - codebase/backend/migrations/V026__graph_extraction_status_nullable_index.sql
  - codebase/backend/migrations/V027__relation_head_tail_index.sql
  - codebase/backend/migrations/V037__kb_retry_failed_status.sql
---

# Spec: Graph RAG

> 관련 문서: [PRD Graph RAG](./10-graph-rag.md) · [Spec RAG 검색](./9-rag-search.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Knowledge Base 화면](../2-navigation/5-knowledge-base.md) · [Spec 데이터 모델 - KnowledgeBase / Entity / Relation](../1-data-model.md#211-knowledgebase) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md)

---

## Overview (제품 정의)

> **구현 상태**: ✅ **P0~P2 구현 완료**. KB 모드 선택, 추출 파이프라인 (`graph-extraction` 큐 chained dispatch), Hybrid 검색 (`RagSearchService` graph 분기), Entity / Relation CRUD, 3D 그래프 시각화 (`graph-3d-renderer.tsx`) 까지 동작. 마이그레이션 `V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql` 적용. 본 문서 범위 밖 (§2.2) 의 community detection / Neo4j 등 P2 이후 항목만 미구현으로 남는다.

---

### 1. 목표

기존 vector RAG 가 단순 유사도 매칭이라 multi-hop 추론(예: "A가 만든 제품을 사용한 고객")이나 entity 중심 질의에 약하다. **문서에서 entity/relation 을 추출해 지식 그래프를 구성하고, 검색 시 vector seed → 그래프 확장 → rerank 흐름으로 답변 품질을 높이는 Graph RAG 옵션**을 제공한다.

| 구분 | 목표 |
|------|------|
| **사용자 가치** | entity 중심 질의·다단계 추론 시 답변 정확도 향상. KB 별로 vector / graph 모드 선택해 비용/품질 trade-off 직접 제어 |
| **기술 목표** | 기존 vector RAG 는 그대로 유지하면서 graph 모드를 추가. PostgreSQL 인프라 안에서 신규 의존성 없이 동작 (entity / relation / chunk_entity 관계형 테이블) |
| **제품 차별화** | LLM 기반 자동 추출 + 사용자 보정 가능한 그래프 뷰로, 지식 그래프 구축 비용을 코딩 없이 흡수 |

---

### 2. 범위

#### 2.1 본 문서 범위

| 영역 | 상태 | 기능 |
|------|------|------|
| KB 모드 선택 | ✅ | KB 생성 시 `vector` / `graph` 모드 선택 (불변). `kb-form-body.tsx` 셀렉트 + `V025__graph_rag.sql` 의 `rag_mode` 컬럼 + `chk_kb_rag_mode` CHECK |
| 그래프 추출 파이프라인 | ✅ | 문서 임베딩 완료 시 `document-embedding.processor` 가 `graph-extraction` 큐로 chained dispatch → `GraphExtractionService` 가 chunk 단위 LLM 추출 → entity / relation / chunk_entity UPSERT |
| 추출 LLM 설정 | ✅ | KB 단위 `extractionLlmConfigId` (V025 컬럼 + `kb-form-body.tsx` 셀렉트, 미지정 시 워크스페이스 default 사용) |
| Hybrid 검색 흐름 | ✅ | `RagSearchService` 가 KB `rag_mode === 'graph'` 면 분기 — vector seed → 1~2 hop recursive CTE traversal → expanded chunk 회수 → rerank |
| 추출 상태 / 통계 UI (P0) | ✅ | KB 상세에 진행률 + entity / relation 카운트 카드 (캐시 컬럼 `entity_count` / `relation_count`). 통계 갱신은 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회 |
| Entity 목록 보정 UI (P1) | ✅ | `entity-list.tsx` / `relation-list.tsx` — 검색·정렬 + 개별 삭제 (`Delete /entities/:id`, `Delete /relations/:id`) |
| 그래프 시각화 (P2) | ✅ | `graph-3d-renderer.tsx` + `graph-visualization.tsx` — 3D / 2D 렌더링, 줌, 호버 시 chunk 미리보기 |

#### 2.2 본 문서 범위 밖

| 항목 | 사유 |
|------|------|
| Microsoft GraphRAG community detection / 글로벌 요약 | 빌드 비용·복잡도가 커서 P2 이후 |
| Apache AGE / Neo4j 도입 | 데이터 규모 임계 도달 시 검토. 현재는 PostgreSQL 관계형 + recursive CTE 로 충분 |
| 룰 기반 entity 추출 (spaCy 등) | LLM 추출 단일 경로로 시작. 도메인 적응 비용 회피 |
| KB 모드 사후 변경 (vector ↔ graph) | 마이그레이션 비용 큼. 모드 전환은 새 KB 생성으로 대체 |

---

### 3. 요구사항

#### 3.1 KB 모드 (`KB-GR-MD-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-MD-01 | KB 생성 시 검색 모드를 `vector` / `graph` 중에서 선택 (기본값: `vector`) | 필수 | ✅ |
| KB-GR-MD-02 | 모드는 생성 시점에만 결정. 사후 변경은 차단되며 변경이 필요하면 새 KB 를 만든다 | 필수 | ✅ |
| KB-GR-MD-03 | 모드 정보는 KB 목록·상세 화면에 배지로 표시 | 필수 | ✅ |

#### 3.2 그래프 추출 파이프라인 (`KB-GR-EX-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-EX-01 | `graph` 모드 KB 의 문서가 임베딩 완료(`embedding_status = 'completed'`)되면 자동으로 그래프 추출 큐(`graph-extraction`)에 dispatch | 필수 | ✅ |
| KB-GR-EX-02 | 추출 LLM 모델은 KB 의 `extractionLlmConfigId` 가 가리키는 ModelConfig (kind=chat) 의 chat 모델을 사용 (미지정 시 워크스페이스 default ModelConfig (kind=chat)) | 필수 | ✅ |
| KB-GR-EX-03 | 추출 단위: chunk 1개 → entity 목록 + relation 목록. 추출 결과는 KB 범위에서 dedup (이름·타입 정규화) | 필수 | ✅ |
| KB-GR-EX-04 | 추출 진행 상태는 문서별로 추적 (`graph_extraction_status`: pending / processing / completed / error / failed) | 필수 | ✅ |
| KB-GR-EX-05 | 추출 실패 시 문서 단위 재시도 가능 (KB 상세에서 "Re-extract" 액션) | 필수 | ✅ (`POST /knowledge-bases/:id/documents/:docId/re-extract`) |
| KB-GR-EX-06 | 임베딩 재실행(`reEmbed`) 또는 KB 전체 재임베딩 시 그래프도 함께 재추출 | 필수 | ✅ |
| KB-GR-EX-07 | 추출 비용을 사용자에게 표시 — 이번 추출에 사용된 토큰 수와 KB 누적 토큰 수 | 권장 | ✅ (`LlmService.chat` 가 자동으로 `LlmUsageLog` 기록 + KB 상세 토큰 통계) |
| KB-GR-EX-08 | LLM 호출 timeout (청크 90s) + 일시 오류 자동 재시도 (1s/4s/16s 백오프, 최대 3회). 비재시도성 오류는 즉시 `failed` 전환. UI 영구 "처리중" stuck 방지 | 필수 | ✅ (V037 + `retryWithBackoff`) |
| KB-GR-EX-09 | 최종 실패한 문서를 한 번에 재큐잉 (`POST /knowledge-bases/:id/retry-failed` `{ scope: 'graph'/'embedding'/'all' }`). 재시도 카운터·error 메시지 리셋 후 큐 add | 필수 | ✅ |
| KB-GR-EX-10 | 부팅 시 `graph_last_attempted_at` 가 10분 전 이전인 `processing` 문서 자동 회수 (`StuckDocumentRecoveryService`) | 필수 | ✅ |
| KB-GR-EX-11 | 진행 박스에 실패 카운트 + 재시도 버튼 표시. WS 이벤트 (`document:graph_retry`·`graph_failed`) 로 실시간 반영 | 필수 | ✅ |

#### 3.3 데이터 모델 (`KB-GR-DM-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-DM-01 | KB 단위로 entity 를 저장. 동일 KB 안에서 `(name, type)` 으로 dedup | 필수 | ✅ (V025 `uq_entity_kb_name_type`) |
| KB-GR-DM-02 | KB 단위로 relation 을 저장. (`head_entity_id`, `predicate`, `tail_entity_id`) 복합 unique | 필수 | ✅ (V025 `uq_relation_kb_head_pred_tail` + V027 인덱스) |
| KB-GR-DM-03 | chunk → entity 매핑(`chunk_entity`)으로 검색 시 chunk 회수 가능 | 필수 | ✅ (V025 `chunk_entity` 테이블) |
| KB-GR-DM-04 | entity 메타에 등장 횟수(`mention_count`) 와 마지막 등장 청크(`last_seen_chunk_id`) 보관 | 권장 | ✅ |

#### 3.4 검색 흐름 (`KB-GR-SR-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-SR-01 | KB.rag_mode 가 `graph` 면 RagSearchService 가 graph 검색 흐름으로 분기 | 필수 | ✅ |
| KB-GR-SR-02 | 검색 1단계: query 임베딩 → KB 의 chunk 에서 vector top-K (`vectorSeedTopK`, 기본 5) 회수 | 필수 | ✅ |
| KB-GR-SR-03 | 검색 2단계: 회수된 chunk 가 언급한 entity 들에서 1~`maxHops` (기본 1) 까지 그래프 확장 | 필수 | ✅ (recursive CTE) |
| KB-GR-SR-04 | 검색 3단계: 확장된 entity 들이 등장한 chunk 를 추가 회수 (총 chunk 수는 `expandedChunkLimit`, 기본 15 내) | 필수 | ✅ |
| KB-GR-SR-05 | 검색 4단계 — **centrality-weighted score blending**: vector seed + expanded chunk 를 score 재정렬 (graph expansion 청크는 entity centrality 기반 가중치 부여). 이는 graph 내부 1차 정렬이며, 최종 생성 주입 청크 수는 [RAG 검색 §3.4](./9-rag-search.md#34-동적-점수-컷-생성-주입-모든-모드-공통) **동적 점수 컷**(token-budget + inject-cap)이 결정한다(고정 `topK` 아님). cross-encoder 후처리 reranking([RAG 검색 §3.3](./9-rag-search.md#33-검색-후처리--리랭킹-선택적))과도 **별개 단계** | 필수 | ✅ |
| KB-GR-SR-06 | 검색 결과 메타데이터에 그래프 순회 요약 (`seedChunkCount`, `traversedEntityCount`, `maxDepth`, `expandedChunkCount`) 포함 (§4.3) | 권장 | ✅ (`GraphTraversalSummary`. 출력은 개수형 — 목록형 ID 배열이 아님) |

#### 3.5 KB 검색 파라미터 (`KB-GR-PA-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-PA-01 | KB 설정에 `maxHops` (1 또는 2, 기본 1), `vectorSeedTopK` (기본 5), `expandedChunkLimit` (기본 15) 노출 | 필수 | ✅ (V025 컬럼 + KB 상세 페이지 편집 폼) |
| KB-GR-PA-02 | 파라미터 변경 시 추출/임베딩 재실행은 불필요 (검색 시점 적용) | 필수 | ✅ |
| KB-GR-PA-03 | AI Agent 노드의 KB 연동 UI 는 그대로 유지 (`ragTopK`, `ragThreshold`만 노출). 그래프 파라미터는 KB 단위에서만 제어 | 필수 | ✅ (`ai-agent.schema.ts` 에 `maxHops` / `vectorSeedTopK` / `expandedChunkLimit` 미노출 확인) |

#### 3.6 UI (`KB-GR-UI-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-UI-01 (P0) | KB 생성 폼에 모드 셀렉트 (`vector` / `graph`) + 모드별 도움말 | 필수 | ✅ |
| KB-GR-UI-02 (P0) | KB 상세 화면에 추출 진행률 배너 (`processing N/M`, `error K`) | 필수 | ✅ |
| KB-GR-UI-03 (P0) | KB 상세에 entity 수 / relation 수 통계 카드 | 필수 | ✅ |
| KB-GR-UI-04 (P1) | Entity 목록 화면 — 이름·타입·등장 횟수 컬럼, 검색·정렬, 개별 삭제 | 권장 | ✅ (`entity-list.tsx`) |
| KB-GR-UI-05 (P1) | Relation 목록 화면 — head·predicate·tail, 등장 chunk 미리보기, 개별 삭제 | 권장 | ✅ (`relation-list.tsx`) |
| KB-GR-UI-06 (P1) | 문서 상세에서 해당 문서 chunk 가 언급한 entity 목록 표시 | 권장 | ✅ (`entity-detail-dialog.tsx`) |
| KB-GR-UI-07 (P2) | 그래프 시각화 (react-flow 또는 동등) — 노드/엣지 렌더, 줌, 호버 시 chunk 미리보기 | 선택 | ✅ (`graph-3d-renderer.tsx` + `graph-visualization.tsx` — react-flow 대신 3D / 2D 렌더러 채택) |

#### 3.7 비용·관측성 (`KB-GR-OB-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-OB-01 | 추출에 사용된 LLM 토큰을 LLMUsageLog 에 기록 (기존 사용량 추적과 동일 채널) | 필수 | ✅ (`LlmService.chat` 호출 boundary 에서 자동 기록) |
| KB-GR-OB-02 | 추출 진행 / 완료 / 에러 이벤트를 WebSocket 으로 노출 (KB 상세 실시간 갱신) | 필수 | ✅ (`document:graph_started` / `_progress` / `_completed` / `_retry` / `_failed`. `_error` 는 타입 union 에만 dead-declared, 미emit) |
| KB-GR-OB-03 | KB 단위 entity / relation 카운트는 캐시 컬럼으로 유지 (조회 시 매번 SELECT COUNT 회피) | 권장 | ✅ (V025 `entity_count` / `relation_count` 컬럼) |

---

### 4. 기술 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 그래프 저장소 | **PostgreSQL 관계형 테이블** (`entity`, `relation`, `chunk_entity`) | 기존 인프라 그대로. 1~2 hop traversal 은 recursive CTE 로 충분 |
| 그래프 빌딩 | **LLM 추출 (BullMQ `graph-extraction` 큐)** | 기존 `document-embedding` 큐 패턴과 동일. 인프라 추가 0 |
| 추출 트리거 | **임베딩 완료 후 자동 chained** | 사용자 개입 없이 그래프가 자동 구축됨. 비용은 사후 통계로 표시 |
| 추출 LLM | **KB 단위 `extractionLlmConfigId` 신설** | 임베딩 모델과 분리해 reasoning 용 chat 모델을 따로 선택 |
| 검색 흐름 | **Hybrid (vector seed + graph expansion + rerank)** | 순수 graph traversal 은 정밀도 낮음. vector seed 가 진입점을 보장 |
| KB 모드 선택 | **생성 시 결정, 불변** | 사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬 |
| 검색 파라미터 노출 | **KB 단위에만** | AI Agent 노드 설정의 단순성 유지 (`ragTopK`/`ragThreshold` 만) |

---

### 5. 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|----------|------|
| NF-GR-01 | 그래프 추출 처리 속도 | 평균 30 chunk / 분 (LLM API 의존) |
| NF-GR-02 | 그래프 검색 응답 시간 | < 800ms (10만 entity·relation 기준, vector seed 포함) |
| NF-GR-03 | 추출 실패 graceful degrade | 추출 실패 chunk 는 그래프 검색 시 vector-only fallback 으로 회수 |
| NF-GR-04 | KB 당 entity 수 한계 | 100,000개 (P0). 초과 시 cleanup / community detection 필요 |
| NF-GR-05 | 토큰 사용 가시성 | 추출 토큰을 LLMUsageLog 에 기록, KB 상세에서 누적 표시 |

---

### 6. 단계별 도입 (Phase Plan)

| Phase | 범위 | 상태 | 검증 기준 |
|-------|------|------|-----------|
| **P0** | DB 마이그레이션 + 추출 큐 + 검색 분기 + 모드 선택 UI + 추출 진행 상태 | ✅ | 새 graph KB 생성 → 문서 업로드 → 자동 추출 → graph 검색 동작 |
| **P1** | Entity/Relation 목록 UI + 개별 삭제 + 사용자 보정 | ✅ | 추출 결과 검토/정정 후 검색 결과에 반영됨 |
| **P2** | 그래프 시각화 (3D/2D) | ✅ | 시각적 탐색 가능 |
| **P2+ (후속)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override | ❌ | §8 미결 항목 — 별도 PRD 로 검토 |

---

### 7. 의존성

| 의존 항목 | 현재 상태 | 비고 |
|----------|----------|------|
| BullMQ `document-embedding` 큐 | ✅ | `graph-extraction` 큐 추가 완료 (동일 패턴) |
| ModelConfig (kind=chat) | ✅ | `V025` 에서 `extractionLlmConfigId` 컬럼 추가 완료 |
| pgvector | ✅ | vector seed 그대로 사용 |
| KB 모드 선택 UI | ✅ | `kb-form-body.tsx` 셀렉트 도입 완료 |
| AI Agent 의 KB 연동 | ✅ | 변경 없음 (`ragTopK`/`ragThreshold` 그대로) |

---

### 8. 미결 / 후속 검토

- entity 타입 사전: 도메인 비종속 (PERSON / ORG / CONCEPT / LOCATION / EVENT) 으로 시작. 사용자가 KB 별 entity 타입 사전을 정의할 수 있게 할지는 P2 검토.
- relation predicate 형식: P0 는 free-form 문자열. 정합성/검색 품질을 위해 enum 화는 P2 검토.
- 추출 prompt 의 사용자 커스터마이즈: P0 는 시스템 prompt 고정. 도메인 정확도가 부족하면 P2 에 KB 단위 prompt override 도입.
- 그래프 community detection: 구현 후 데이터 패턴을 보고 GraphRAG 스타일 클러스터 요약을 P2 에 검토.

---

## 1. 개요

Graph RAG 는 KB 의 검색 모드(`rag_mode`) 가 `graph` 일 때 활성화되는 검색 흐름이다. vector seed → graph expansion → **centrality-weighted score blending** 의 Hybrid 형태로 동작하며, 기존 `vector` 모드 KB 와 동일 인프라(PostgreSQL + pgvector + BullMQ) 위에서 추가 의존성 없이 작동한다.

> **용어 disambiguation**: 본 문서에서 그래프 4단계의 "rerank"·"score 재정렬" 은 **centrality-weighted score blending**(cosine × centrality 가중) 을 뜻하는 graph 내부 1차 정렬이다. 별도의 선택적 cross-encoder 후처리 reranking([RAG 검색 §3.3](./9-rag-search.md#33-검색-후처리--리랭킹-선택적), Planned)과 혼동하지 않는다 — 후자는 `rerank_mode ≠ off` 일 때 vector/graph 어느 회수 결과에도 적용되는 2차 단계다.

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
| `extraction_llm_config_id` | UUID? | 그래프 추출에 사용할 ModelConfig (kind=chat) 의 chat 모델. NULL 이면 워크스페이스 default ModelConfig (kind=chat) |
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
| `graph_extraction_status` | Enum | `pending` / `processing` / `completed` / `error` / `failed`. `vector` 모드 KB 에서는 NULL 또는 미사용. 의미는 [Spec 데이터 모델 §2.12 Document.embedding_status](../1-data-model.md#212-document) 와 동일 — `error` 는 in-flight 재시도 중 일시 오류, `failed` 는 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패 (§3.2 / §7 처리 흐름 참조). 5종 enum 의 canonical 정의는 [Spec 데이터 모델 §2.12](../1-data-model.md#212-document) |

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
3. chunk 마다 LLM 호출 (`extraction_llm_config_id` 또는 default ModelConfig (kind=chat) 의 chat 모델):
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

- 문서 단건: `POST /api/knowledge-bases/:id/documents/:docId/re-extract`
- KB 전체: `POST /api/knowledge-bases/:id/re-extract` — KB 의 모든 entity/relation/chunk_entity 를 삭제 후 모든 문서에 대해 큐잉
- 임베딩 재실행 (`re-embed`) 은 그래프 추출도 자동 chained (KB 가 graph 모드인 경우)

---

## 4. 검색 흐름 (Hybrid)

KB.rag_mode 별로 `RagSearchService.search()` 가 분기한다. `vector` 모드는 [Spec 9-rag-search.md](./9-rag-search.md) 그대로.

### 4.1 graph 모드 단계

```
[1] query 임베딩 (KB.embedding_model_config_id → ModelConfig.defaultModel)
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
[7] 통합 결과를 동적 점수 컷(token-budget + inject-cap, 명시 top_k 시 그 값)으로 컨텍스트에 주입 ([RAG 검색 §3.4](./9-rag-search.md#34-동적-점수-컷-생성-주입-모든-모드-공통))
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
LIMIT $5;        -- 회수 폭(recall): vectorSeedTopK + expandedChunkLimit. 최종 주입 청크 수는 app-layer 동적 점수 컷(RAG 검색 §3.4)이 결정
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
| POST | `/api/knowledge-bases/:id/documents/:docId/re-extract` | 문서 단건 그래프 재추출 (graph 모드 KB 에서만 유효) |
| POST | `/api/knowledge-bases/:id/re-extract` | KB 전체 재추출 — 모든 entity/relation/chunk_entity 삭제 후 모든 문서 재추출. `KB_REEXTRACT_IN_PROGRESS` 잠금 (재임베딩과 동일 패턴) |

### 5.2 그래프 조회 (P1)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/knowledge-bases/:id/entities` | entity 목록 (페이지네이션, 검색, 타입 필터) |
| GET | `/api/knowledge-bases/:id/entities/:entityId` | entity 상세 + 등장 chunk 목록 |
| DELETE | `/api/knowledge-bases/:id/entities/:entityId` | entity 삭제 (관련 relation, chunk_entity CASCADE) |
| GET | `/api/knowledge-bases/:id/relations` | relation 목록 (페이지네이션, head/tail 검색) |
| DELETE | `/api/knowledge-bases/:id/relations/:relationId` | relation 삭제 |
| GET | `/api/knowledge-bases/:id/graph/stats` | entity_count / relation_count / 추출 진행 상태 요약 |
| GET | `/api/knowledge-bases/:id/graph/visualization` | 상위 mention_count entity + relation 페이로드 (시각화 용) |

---

## 6. WebSocket 이벤트

기존 `document:embedding_*` 이벤트와 같은 패턴으로 다음을 추가한다. 채널은 `kb:{documentId}` (`spec/5-system/8-embedding-pipeline.md §8` 과 동일).

| 이벤트 | 페이로드 | 시점 |
|--------|---------|------|
| `document:graph_started` | `{ documentId, knowledgeBaseId }` | 추출 시작 |
| `document:graph_progress` | `{ documentId, progress: number, entityDelta: number, relationDelta: number }` | chunk 처리마다 |
| `document:graph_completed` | `{ documentId, entityCount, relationCount }` | 완료 |
| `document:graph_retry` | `{ documentId, attempt: number, maxAttempts: number, error: string }` | 일시 오류 후 재시도 큐잉 직전 (in-flight 일시 오류 신호) |
| `document:graph_failed` | `{ documentId, error: string }` | 재시도 모두 소진 또는 비재시도성 오류로 최종 실패 |

> `document:graph_error` 는 `websocket.service.ts` 의 이벤트 타입 union 에 선언돼 있으나 `graph-extraction.service.ts` 에서 실제로 emit 하지 않는다 (dead-declared). in-flight 일시 오류는 `document:graph_retry`, 최종 실패는 `document:graph_failed` 로만 신호한다.

---

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| 추출 LLM 호출 일시 실패 (timeout / 5xx / network / 429) | `Document.graph_extraction_status = 'error'`, `graph_retry_count++`, `graph_error_message` 갱신, WS `document:graph_retry`. 1s/4s/16s 백오프로 최대 3회 자동 재시도 |
| 추출 LLM 호출 영구 실패 (재시도 소진 또는 4xx) | `Document.graph_extraction_status = 'failed'`, WS `document:graph_failed`. 사용자 액션 (단건 `/re-extract` 또는 일괄 `/retry-failed`) 까지 유지 |
| 추출 응답 JSON 파싱 실패 | chunk 단위 silent skip + warn (LLM 응답 형식 문제는 재시도해도 동일하므로 비재시도) |
| relation 의 head/tail 가 응답 entities 에 없음 | 해당 relation drop + warn (LLM 환각) |
| graph 모드 KB 인데 entity_count = 0 (추출 미완료/실패) | 검색이 vector-only 흐름으로 자동 fallback (빈 그래프 expansion = vector top-K 와 동일) |
| `re-extract` 동시 호출 | DB 컬럼 (`reextract_status`) atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS` |
| 워커 정상 종료 후 `processing` 상태에서 멈춤 | `StuckDocumentRecoveryService` 가 부팅 시점에 `graph_last_attempted_at < NOW() - 10min` 인 문서를 회수해 큐 재 add |

### 7.1 Retry & Failure 정책 상세

- LLM `chat()` 호출에 `{ timeoutMs: 90_000 }` 적용 — 청크 응답 hang 시 90s 안에 즉시 reject.
- 문서 단위 `retryWithBackoff(maxRetries=3, baseDelayMs=1_000)` (1s → 4s → 16s).
- chunk_entity 정리 (`DELETE FROM chunk_entity WHERE chunk_id IN ...`) 가 추출 진입부에 있어 idempotent — 재시도 시 dedup INSERT 가 안전하게 누적됨.
- 청크 단위 LLM 재시도는 별도 적용하지 않음 (문서 단위 재시도로 단순화 — LLM 비용 vs 코드 복잡도 트레이드오프). 정밀화는 후속 검토.

> **원칙**: 그래프 검색이 어떠한 이유로든 빈 결과를 만들 경우, vector seed 결과만으로 응답을 구성한다 (graceful degradation).

---

## 8. 비-목표

- Entity disambiguation (서로 다른 사람 동명이인 구분) — P2 검토. 현재는 `(name, type)` 일치 시 동일 entity 로 간주.
- Cross-KB graph linking — KB 간 entity 통합 검색은 P2 이후 (현재는 KB 단위로 격리).
- Graph embedding (Node2Vec 등) — 검색에 활용하지 않음 (P2 이후).
- 자동 prompt tuning — 추출 prompt 는 시스템 prompt 고정 (P2 에 KB 단위 prompt override 검토).

---

## Rationale

Graph RAG 도메인 모델 결정의 배경·근거.

### Graph RAG 기획 결정

#### 도메인 용어

- **Graph RAG**: 문서에서 추출한 entity/relation 으로 구성된 지식 그래프를 RAG 검색에 활용하는 방식. 본 제품에서는 vector top-K seed → 1~2 hop graph expansion → rerank 하는 Hybrid 흐름을 의미한다.
- **Entity**: 문서 chunk 에서 추출된 의미 단위 (인물, 조직, 개념, 위치, 이벤트 등). KB 단위로 dedup.
- **Relation**: 두 entity 사이의 방향성 있는 관계 (head, predicate, tail).
- **ChunkEntity**: 어느 청크가 어떤 entity 를 언급했는지 추적하는 매핑.
- **KB.rag_mode**: 검색 모드. `vector` (default) / `graph` 두 가지. **생성 시에만 결정, 사후 변경 불가.**

#### 사용자 결정

| # | 결정 사항 | 선택 |
| --- | --- | --- |
| 2 | 모드 옵션 범위 | `vector` / `graph` 2종 (graph 안에 hybrid 통합) |
| 3 | 추출 트리거 | 임베딩 완료 후 자동 chained (사용자 개입 없이 graph-extraction 큐 dispatch) |
| 4 | UI 우선순위 | P0 = 추출 진행/완료 상태만, P1 = entity 목록 + 통계, P2 = 그래프 시각화 |
| 5 | 검색 파라미터 노출 | KB 단위에만 (maxHops, vectorSeedTopK, expandedChunkLimit). AI Agent 노드는 기존 ragTopK/ragThreshold 유지 |
| 6 | KB 모드 사후 변경 | 생성 시에만 결정 (불변). 모드 전환 필요 시 새 KB 생성 |
| 7 | 추출 LLM | KB.`extraction_llm_config_id` 필드 신설 (임베딩 모델과 별도 chat LLM 지정) |

#### 결정 근거 (요약)

- **mode 2종**: graph 안에 vector seed 가 이미 포함된 Hybrid 형태라 mode 3개로 쪼갤 가치 작음
- **자동 chained**: 사용자에게 별도 액션 강요하지 않음, 임베딩 큐 → 추출 큐 자연 흐름
- **사후 변경 불가**: vector→graph 전환은 기존 chunk 에 대한 추출 트리거가 필요해 마이그레이션이 무겁고, graph→vector 는 entity/relation 폐기. 새 KB 가 더 단순
- **추출 LLM 분리**: 임베딩 모델은 표현 학습용, 추출 모델은 reasoning 용. 비용/품질을 분리 제어 가능

#### 비-목표 (범위 밖)

- Microsoft GraphRAG community detection / 글로벌 요약 (P2 이후)
- Apache AGE / Neo4j 도입 (데이터 규모 임계 도달 시 검토)
- 룰 기반 entity 추출 (LLM 추출 단일 경로)
