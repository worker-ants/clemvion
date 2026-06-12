# Cross-Spec 일관성 검토 결과

target: `spec/5-system/10-graph-rag.md`

---

## 발견사항

- **[INFO]** KnowledgeBase 컬럼 표(§2.1)에 `reextract_status` 누락
  - target 위치: `spec/5-system/10-graph-rag.md` §2.1 KnowledgeBase 추가 컬럼 표
  - 충돌 대상: `spec/1-data-model.md §2.11 KnowledgeBase` (`reextract_status Enum idle/in_progress`)
  - 상세: target §2.1 은 KB 추가 컬럼으로 7개(`rag_mode`, `extraction_llm_config_id`, `max_hops`, `vector_seed_top_k`, `expanded_chunk_limit`, `entity_count`, `relation_count`)를 열거하지만 `reextract_status`를 빠뜨렸다. 반면 target §7 에러 처리 표는 "DB 컬럼 (`reextract_status`) atomic compare-and-swap"을 참조한다. `data-model §2.11`은 `reextract_status` 컬럼을 명시하며, `data-flow/6-knowledge-base.md`도 `reextract_status` CAS 흐름을 정의한다. 두 영역의 목록이 불일치하고 target 내부에서도 자기 모순이 있다.
  - 제안: target §2.1 표에 `reextract_status | Enum | KB 전체 그래프 재추출 잠금: idle / in_progress (default: idle). vector 모드에서는 사용 안 함` 행을 추가해 `data-model §2.11` 및 `data-flow §6`과 동기화.

- **[INFO]** `ragSources[]` 항목 순서 명시가 RAG 검색 §4.1 과 미묘하게 다름
  - target 위치: `spec/5-system/10-graph-rag.md` §4.3 출력 메타데이터 JSON 예시
  - 충돌 대상: `spec/5-system/9-rag-search.md §4.1 ragSources`
  - 상세: target §4.3 의 `ragSources[]` 항목은 `chunkId→documentId→documentName→content→score→origin` 순으로 예시가 작성된 반면, RAG 검색 §4.1 의 동일 항목은 `documentId→documentName→chunkId→content→score` 순으로 정의됐다. 동일 필드를 다르게 나열한 것이며 target 자체가 "단일 SoT 는 RAG 검색 §4.1"임을 명시하므로 논리 충돌은 아니나, 예시 JSON 의 키 순서가 다르면 향후 구현자가 SoT 가 어느 쪽인지 혼동할 수 있다.
  - 제안: target §4.3 의 JSON 예시 키 순서를 RAG 검색 §4.1 과 동일하게 맞추거나, SoT 주석을 더 두드러지게 유지.

---

## 요약

`spec/5-system/10-graph-rag.md` (target draft)는 `spec/1-data-model.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/data-flow/6-knowledge-base.md` 와 실질적으로 일관된다. 데이터 모델(Entity·Relation·ChunkEntity·KnowledgeBase·Document 추가 컬럼), API 엔드포인트, WebSocket 채널 명명(`kb:{documentId}`), rerank 와 centrality blending 의 역할 구분, ragSources 스키마 SoT 위임 등이 모두 정합적이다. 다만 target §2.1 KnowledgeBase 추가 컬럼 표에서 `reextract_status` 가 누락된 것이 target 내부 자기 모순(§7 에서 참조)이면서 data-model §2.11 과도 불일치한다. 이는 동작에 영향을 주는 CRITICAL 충돌은 아니며 문서 정합성 수준의 INFO다.

## 위험도

LOW
