# Plan: Graph RAG PRD/Spec 작성 (✅ 완료 — 2026-05-02)

> 단계: project-planner. 구현은 이후 별도 세션 (developer skill).

## 목표

기존 vector RAG 위에 Graph RAG 옵션을 점진적으로 도입하기 위한 PRD/Spec 작성. 직전 대화에서 정해진 권장 방향:

- **저장소**: PostgreSQL 관계형 테이블 (entity / relation / chunk_entity)
- **그래프 빌딩**: LLM 기반 추출 (BullMQ 큐로 비동기, 임베딩 큐와 같은 패턴)
- **검색 흐름**: Hybrid (vector top-K seed → 1~2 hop graph expansion → rerank)
- **점진적**: `knowledge_base.rag_mode` 컬럼으로 vector/graph 공존

## 영향 받는 문서 (편집 전 모두 동기화 점검 필요)

### 신규 작성

| 경로 | 내용 |
| --- | --- |
| `spec/5-system/10-graph-rag.md` | 데이터 모델, LLM 추출 프롬프트/큐, Hybrid 검색 흐름, API, WebSocket 이벤트, 에러 처리 |

### 갱신 (동기화 필요)

| 경로 | 갱신 항목 |
| --- | --- |
| `prd/6-phase2-ai.md` §3.5 | Graph RAG 요구사항(KB-GR-*) 추가, 모드 선택, 그래프 추출 흐름 정의 |
| `prd/4-integration.md` §3 | Knowledge Base에 graph 모드 옵션 명시 |
| `prd/0-overview.md` §7 용어 | "Graph RAG", "Entity", "Relation" 추가. §6 로드맵에 도입 단계 표기 |
| `spec/2-navigation/5-knowledge-base.md` | 컬렉션 생성 폼에 모드 셀렉트, 그래프 통계/탐색 UI (선택) |
| `spec/5-system/8-embedding-pipeline.md` | 임베딩 후 graph extraction 큐로 chained dispatch 명시 |
| `spec/5-system/9-rag-search.md` | KB.rag_mode 분기 추가, hybrid 검색 단계 |
| `spec/4-nodes/3-ai-nodes.md` §1 (AI Agent) | KB 연동 시 그래프 옵션 노출, 출력 메타에 graph traversal 정보 |
| `spec/1-data-model.md` | KnowledgeBase에 `rag_mode` 컬럼, Entity / Relation / ChunkEntity 신규 엔티티 |

## 사용자 결정 (확정)

1. PRD 위치: 별도 PRD 파일 `prd/9-graph-rag.md`
2. 모드 옵션: `vector` / `graph` 2종 (graph 안에 Hybrid 통합)
3. 추출 트리거: 임베딩 완료 후 자동 chained
4. UI 우선순위: P0 추출 상태 / P1 entity·relation 목록 / P2 그래프 시각화
5. 검색 파라미터 노출: KB 단위에만 (`maxHops`, `vectorSeedTopK`, `expandedChunkLimit`)
6. KB 모드 사후 변경: 생성 시에만 결정 (불변)
7. 추출 LLM: KB 단위 `extractionLlmConfigId` 신설

## 산출물 (모두 동기화 완료)

| 분류 | 경로 | 변경 |
| --- | --- | --- |
| PRD 신규 | `prd/9-graph-rag.md` | 7섹션 (목표 / 범위 / 요구사항 7군 / 기술 결정 / NFR / Phase / 의존성 / 미결) |
| Spec 신규 | `spec/5-system/10-graph-rag.md` | 8섹션 (개요 / 데이터 모델 / 추출 파이프라인 / Hybrid 검색 / API / WebSocket / 에러 / 비목표) |
| PRD 동기화 | `prd/0-overview.md` | 용어(Graph RAG, Entity/Relation), 로드맵, 문서 맵 |
| PRD 동기화 | `prd/4-integration.md` | §3.2 KB 검색 모드 신설, §3.4 AI Agent 연동에 graph 파라미터 위치 명시 |
| PRD 동기화 | `prd/6-phase2-ai.md` | §3.5 KB 에 KB-MD-01 (모드 선택) 추가, Graph RAG 링크 |
| Spec 동기화 | `spec/1-data-model.md` | KnowledgeBase 컬럼 7개 추가, Document `graph_extraction_status`, Entity / Relation / ChunkEntity 신규 §2.12.2-4 |
| Spec 동기화 | `spec/5-system/9-rag-search.md` | rag_mode 분기 명시 |
| Spec 동기화 | `spec/5-system/8-embedding-pipeline.md` | §7.1.1 graph chained dispatch |
| Spec 동기화 | `spec/2-navigation/5-knowledge-base.md` | 컬렉션 생성 폼에 모드/추출 LLM/그래프 파라미터, §2.7 그래프 패널, API 표 보강 |
| Spec 동기화 | `spec/4-nodes/3-ai-nodes.md` | RAG 출력 메타에 `graphTraversal` / `ragSources[].origin` |
| memory | `memory/graph-rag-decisions.md` | 도메인 용어 + 결정 근거 + 영향 범위 + 비목표 |

## 비-목표 (이번 PRD 범위 밖)

- Microsoft GraphRAG 스타일 community detection / 글로벌 요약 (P2 이후)
- Apache AGE / Neo4j 도입 (P2 이후, 데이터 규모 임계 도달 시 검토)
- 룰 기반 entity 추출(spaCy 등) — 본 PRD는 LLM 추출 단일 경로
