# PRD: Graph RAG

> 관련 문서: [제품 개요](./0-overview.md) · [AI & 지식 저장소](./6-phase2-ai.md#35-knowledge-base) · [통합/연동 §3 Knowledge Base](./4-integration.md#3-knowledge-base-지식-저장소) · [Spec Graph RAG](../spec/5-system/10-graph-rag.md) · [Spec RAG 검색](../spec/5-system/9-rag-search.md) · [Spec Knowledge Base 화면](../spec/2-navigation/5-knowledge-base.md)

> **구현 상태**: ✅ **P0~P2 구현 완료** (검증 일자: 2026-05-11). KB 모드 선택, 추출 파이프라인 (`graph-extraction` 큐 chained dispatch), Hybrid 검색 (`RagSearchService` graph 분기), Entity / Relation CRUD, 3D 그래프 시각화 (`graph-3d-renderer.tsx`) 까지 동작. 마이그레이션 `V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql` 적용. 본 문서 범위 밖 (§2.2) 의 community detection / Neo4j 등 P2 이후 항목만 미구현으로 남는다.

---

## 1. 목표

기존 vector RAG 가 단순 유사도 매칭이라 multi-hop 추론(예: "A가 만든 제품을 사용한 고객")이나 entity 중심 질의에 약하다. **문서에서 entity/relation 을 추출해 지식 그래프를 구성하고, 검색 시 vector seed → 그래프 확장 → rerank 흐름으로 답변 품질을 높이는 Graph RAG 옵션**을 제공한다.

| 구분 | 목표 |
|------|------|
| **사용자 가치** | entity 중심 질의·다단계 추론 시 답변 정확도 향상. KB 별로 vector / graph 모드 선택해 비용/품질 trade-off 직접 제어 |
| **기술 목표** | 기존 vector RAG 는 그대로 유지하면서 graph 모드를 추가. PostgreSQL 인프라 안에서 신규 의존성 없이 동작 (entity / relation / chunk_entity 관계형 테이블) |
| **제품 차별화** | LLM 기반 자동 추출 + 사용자 보정 가능한 그래프 뷰로, 지식 그래프 구축 비용을 코딩 없이 흡수 |

---

## 2. 범위

### 2.1 본 문서 범위

| 영역 | 상태 | 기능 |
|------|------|------|
| KB 모드 선택 | ✅ | KB 생성 시 `vector` / `graph` 모드 선택 (불변). `kb-form-body.tsx` 셀렉트 + `V025__graph_rag.sql` 의 `rag_mode` 컬럼 + `chk_kb_rag_mode` CHECK |
| 그래프 추출 파이프라인 | ✅ | 문서 임베딩 완료 시 `document-embedding.processor` 가 `graph-extraction` 큐로 chained dispatch → `GraphExtractionService` 가 chunk 단위 LLM 추출 → entity / relation / chunk_entity UPSERT |
| 추출 LLM 설정 | ✅ | KB 단위 `extractionLlmConfigId` (V025 컬럼 + `kb-form-body.tsx` 셀렉트, 미지정 시 워크스페이스 default 사용) |
| Hybrid 검색 흐름 | ✅ | `RagSearchService` 가 KB `rag_mode === 'graph'` 면 분기 — vector seed → 1~2 hop recursive CTE traversal → expanded chunk 회수 → rerank |
| 추출 상태 / 통계 UI (P0) | ✅ | KB 상세에 진행률 + entity / relation 카운트 카드 (캐시 컬럼 `entity_count` / `relation_count`), `kb:graph_stats_updated` WebSocket 이벤트 |
| Entity 목록 보정 UI (P1) | ✅ | `entity-list.tsx` / `relation-list.tsx` — 검색·정렬 + 개별 삭제 (`Delete /entities/:id`, `Delete /relations/:id`) |
| 그래프 시각화 (P2) | ✅ | `graph-3d-renderer.tsx` + `graph-visualization.tsx` — 3D / 2D 렌더링, 줌, 호버 시 chunk 미리보기 |

### 2.2 본 문서 범위 밖

| 항목 | 사유 |
|------|------|
| Microsoft GraphRAG community detection / 글로벌 요약 | 빌드 비용·복잡도가 커서 P2 이후 |
| Apache AGE / Neo4j 도입 | 데이터 규모 임계 도달 시 검토. 현재는 PostgreSQL 관계형 + recursive CTE 로 충분 |
| 룰 기반 entity 추출 (spaCy 등) | LLM 추출 단일 경로로 시작. 도메인 적응 비용 회피 |
| KB 모드 사후 변경 (vector ↔ graph) | 마이그레이션 비용 큼. 모드 전환은 새 KB 생성으로 대체 |

---

## 3. 요구사항

### 3.1 KB 모드 (`KB-GR-MD-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-MD-01 | KB 생성 시 검색 모드를 `vector` / `graph` 중에서 선택 (기본값: `vector`) | 필수 | ✅ |
| KB-GR-MD-02 | 모드는 생성 시점에만 결정. 사후 변경은 차단되며 변경이 필요하면 새 KB 를 만든다 | 필수 | ✅ |
| KB-GR-MD-03 | 모드 정보는 KB 목록·상세 화면에 배지로 표시 | 필수 | ✅ |

### 3.2 그래프 추출 파이프라인 (`KB-GR-EX-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-EX-01 | `graph` 모드 KB 의 문서가 임베딩 완료(`embedding_status = 'completed'`)되면 자동으로 그래프 추출 큐(`graph-extraction`)에 dispatch | 필수 | ✅ |
| KB-GR-EX-02 | 추출 LLM 모델은 KB 의 `extractionLlmConfigId` 가 가리키는 LLMConfig 의 chat 모델을 사용 (미지정 시 워크스페이스 default LLMConfig) | 필수 | ✅ |
| KB-GR-EX-03 | 추출 단위: chunk 1개 → entity 목록 + relation 목록. 추출 결과는 KB 범위에서 dedup (이름·타입 정규화) | 필수 | ✅ |
| KB-GR-EX-04 | 추출 진행 상태는 문서별로 추적 (`graph_extraction_status`: pending / processing / completed / error) | 필수 | ✅ |
| KB-GR-EX-05 | 추출 실패 시 문서 단위 재시도 가능 (KB 상세에서 "Re-extract" 액션) | 필수 | ✅ (`POST /knowledge-bases/:id/graph/documents/:docId/re-extract`) |
| KB-GR-EX-06 | 임베딩 재실행(`reEmbed`) 또는 KB 전체 재임베딩 시 그래프도 함께 재추출 | 필수 | ✅ |
| KB-GR-EX-07 | 추출 비용을 사용자에게 표시 — 이번 추출에 사용된 토큰 수와 KB 누적 토큰 수 | 권장 | ✅ (`LlmService.chat` 가 자동으로 `LlmUsageLog` 기록 + KB 상세 토큰 통계) |

### 3.3 데이터 모델 (`KB-GR-DM-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-DM-01 | KB 단위로 entity 를 저장. 동일 KB 안에서 `(name, type)` 으로 dedup | 필수 | ✅ (V025 `uq_entity_kb_name_type`) |
| KB-GR-DM-02 | KB 단위로 relation 을 저장. (`head_entity_id`, `predicate`, `tail_entity_id`) 복합 unique | 필수 | ✅ (V025 `uq_relation_kb_head_pred_tail` + V027 인덱스) |
| KB-GR-DM-03 | chunk → entity 매핑(`chunk_entity`)으로 검색 시 chunk 회수 가능 | 필수 | ✅ (V025 `chunk_entity` 테이블) |
| KB-GR-DM-04 | entity 메타에 등장 횟수(`mention_count`) 와 마지막 등장 청크(`last_seen_chunk_id`) 보관 | 권장 | ✅ |

### 3.4 검색 흐름 (`KB-GR-SR-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-SR-01 | KB.rag_mode 가 `graph` 면 RagSearchService 가 graph 검색 흐름으로 분기 | 필수 | ✅ |
| KB-GR-SR-02 | 검색 1단계: query 임베딩 → KB 의 chunk 에서 vector top-K (`vectorSeedTopK`, 기본 5) 회수 | 필수 | ✅ |
| KB-GR-SR-03 | 검색 2단계: 회수된 chunk 가 언급한 entity 들에서 1~`maxHops` (기본 1) 까지 그래프 확장 | 필수 | ✅ (recursive CTE) |
| KB-GR-SR-04 | 검색 3단계: 확장된 entity 들이 등장한 chunk 를 추가 회수 (총 chunk 수는 `expandedChunkLimit`, 기본 15 내) | 필수 | ✅ |
| KB-GR-SR-05 | 검색 4단계: vector seed + expanded chunk 를 score 재정렬해 상위 `topK` 반환 (graph expansion 청크는 entity centrality 기반 가중치 부여) | 필수 | ✅ |
| KB-GR-SR-06 | 검색 결과 메타데이터에 `traversedEntities`, `traversalDepth`, `seedChunkIds` 포함 | 권장 | ✅ (`GraphTraversalSummary` — `maxDepthUsed` 포함) |

### 3.5 KB 검색 파라미터 (`KB-GR-PA-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-PA-01 | KB 설정에 `maxHops` (1 또는 2, 기본 1), `vectorSeedTopK` (기본 5), `expandedChunkLimit` (기본 15) 노출 | 필수 | ✅ (V025 컬럼 + KB 상세 페이지 편집 폼) |
| KB-GR-PA-02 | 파라미터 변경 시 추출/임베딩 재실행은 불필요 (검색 시점 적용) | 필수 | ✅ |
| KB-GR-PA-03 | AI Agent 노드의 KB 연동 UI 는 그대로 유지 (`ragTopK`, `ragThreshold`만 노출). 그래프 파라미터는 KB 단위에서만 제어 | 필수 | ✅ (`ai-agent.schema.ts` 에 `maxHops` / `vectorSeedTopK` / `expandedChunkLimit` 미노출 확인) |

### 3.6 UI (`KB-GR-UI-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-UI-01 (P0) | KB 생성 폼에 모드 셀렉트 (`vector` / `graph`) + 모드별 도움말 | 필수 | ✅ |
| KB-GR-UI-02 (P0) | KB 상세 화면에 추출 진행률 배너 (`processing N/M`, `error K`) | 필수 | ✅ |
| KB-GR-UI-03 (P0) | KB 상세에 entity 수 / relation 수 통계 카드 | 필수 | ✅ |
| KB-GR-UI-04 (P1) | Entity 목록 화면 — 이름·타입·등장 횟수 컬럼, 검색·정렬, 개별 삭제 | 권장 | ✅ (`entity-list.tsx`) |
| KB-GR-UI-05 (P1) | Relation 목록 화면 — head·predicate·tail, 등장 chunk 미리보기, 개별 삭제 | 권장 | ✅ (`relation-list.tsx`) |
| KB-GR-UI-06 (P1) | 문서 상세에서 해당 문서 chunk 가 언급한 entity 목록 표시 | 권장 | ✅ (`entity-detail-dialog.tsx`) |
| KB-GR-UI-07 (P2) | 그래프 시각화 (react-flow 또는 동등) — 노드/엣지 렌더, 줌, 호버 시 chunk 미리보기 | 선택 | ✅ (`graph-3d-renderer.tsx` + `graph-visualization.tsx` — react-flow 대신 3D / 2D 렌더러 채택) |

### 3.7 비용·관측성 (`KB-GR-OB-*`)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| KB-GR-OB-01 | 추출에 사용된 LLM 토큰을 LLMUsageLog 에 기록 (기존 사용량 추적과 동일 채널) | 필수 | ✅ (`LlmService.chat` 호출 boundary 에서 자동 기록) |
| KB-GR-OB-02 | 추출 진행 / 완료 / 에러 이벤트를 WebSocket 으로 노출 (KB 상세 실시간 갱신) | 필수 | ✅ (`kb:graph_stats_updated` 등) |
| KB-GR-OB-03 | KB 단위 entity / relation 카운트는 캐시 컬럼으로 유지 (조회 시 매번 SELECT COUNT 회피) | 권장 | ✅ (V025 `entity_count` / `relation_count` 컬럼) |

---

## 4. 기술 결정 사항

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

## 5. 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|----------|------|
| NF-GR-01 | 그래프 추출 처리 속도 | 평균 30 chunk / 분 (LLM API 의존) |
| NF-GR-02 | 그래프 검색 응답 시간 | < 800ms (10만 entity·relation 기준, vector seed 포함) |
| NF-GR-03 | 추출 실패 graceful degrade | 추출 실패 chunk 는 그래프 검색 시 vector-only fallback 으로 회수 |
| NF-GR-04 | KB 당 entity 수 한계 | 100,000개 (P0). 초과 시 cleanup / community detection 필요 |
| NF-GR-05 | 토큰 사용 가시성 | 추출 토큰을 LLMUsageLog 에 기록, KB 상세에서 누적 표시 |

---

## 6. 단계별 도입 (Phase Plan)

| Phase | 범위 | 상태 | 검증 기준 |
|-------|------|------|-----------|
| **P0** | DB 마이그레이션 + 추출 큐 + 검색 분기 + 모드 선택 UI + 추출 진행 상태 | ✅ | 새 graph KB 생성 → 문서 업로드 → 자동 추출 → graph 검색 동작 |
| **P1** | Entity/Relation 목록 UI + 개별 삭제 + 사용자 보정 | ✅ | 추출 결과 검토/정정 후 검색 결과에 반영됨 |
| **P2** | 그래프 시각화 (3D/2D) | ✅ | 시각적 탐색 가능 |
| **P2+ (후속)** | community detection / 글로벌 요약 / 도메인별 entity 타입 사전 / KB 단위 prompt override | ❌ | §8 미결 항목 — 별도 PRD 로 검토 |

---

## 7. 의존성

| 의존 항목 | 현재 상태 | 비고 |
|----------|----------|------|
| BullMQ `document-embedding` 큐 | ✅ | `graph-extraction` 큐 추가 완료 (동일 패턴) |
| LLMConfig | ✅ | `V025` 에서 `extractionLlmConfigId` 컬럼 추가 완료 |
| pgvector | ✅ | vector seed 그대로 사용 |
| KB 모드 선택 UI | ✅ | `kb-form-body.tsx` 셀렉트 도입 완료 |
| AI Agent 의 KB 연동 | ✅ | 변경 없음 (`ragTopK`/`ragThreshold` 그대로) |

---

## 8. 미결 / 후속 검토

- entity 타입 사전: 도메인 비종속 (PERSON / ORG / CONCEPT / LOCATION / EVENT) 으로 시작. 사용자가 KB 별 entity 타입 사전을 정의할 수 있게 할지는 P2 검토.
- relation predicate 형식: P0 는 free-form 문자열. 정합성/검색 품질을 위해 enum 화는 P2 검토.
- 추출 prompt 의 사용자 커스터마이즈: P0 는 시스템 prompt 고정. 도메인 정확도가 부족하면 P2 에 KB 단위 prompt override 도입.
- 그래프 community detection: 구현 후 데이터 패턴을 보고 GraphRAG 스타일 클러스터 요약을 P2 에 검토.
