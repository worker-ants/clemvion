# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-rag-reranking.md`
검토 일시: 2026-06-04

---

## 발견사항

### 1. [WARNING] `KnowledgeBase` 엔티티에 신규 컬럼 추가 — 데이터 모델 spec 미반영
- **target 위치**: §2.1 (knowledge_base 추가 컬럼 표)
- **충돌 대상**: `spec/1-data-model.md §2.11 KnowledgeBase`
- **상세**: target draft 는 `rerank_mode`, `rerank_config_id`, `rerank_candidate_k`, `rerank_score_threshold`, `rerank_llm_config_id` 5개 컬럼을 `knowledge_base` 에 추가한다고 기술한다. 현재 `spec/1-data-model.md §2.11` 의 KnowledgeBase 컬럼 목록에는 이 필드들이 존재하지 않는다. consistency-check 통과 후 §10에서 반영 대상을 명시했으나, `spec/1-data-model.md` 는 §10 목록에 포함되어 있지 않다. 데이터 모델 spec 이 갱신되지 않으면 구현 단계에서 두 문서가 동일 엔티티를 다르게 정의하는 상황이 된다.
- **제안**: §10 반영 대상 목록에 `spec/1-data-model.md §2.11 KnowledgeBase` 를 추가하고, consistency-check 통과 후 해당 절에 5개 컬럼을 동기화한다.

---

### 2. [WARNING] `RerankConfig` 신규 엔티티 — 데이터 모델 spec 및 엔티티 관계도에 미반영
- **target 위치**: §2.2 (RerankConfig 워크스페이스 리소스)
- **충돌 대상**: `spec/1-data-model.md §1` (엔티티 관계 개요) 및 §2 (핵심 엔티티 목록)
- **상세**: target draft 는 `RerankConfig` 를 `LLMConfig` 와 sibling 인 워크스페이스 리소스로 정의한다. 그러나 `spec/1-data-model.md §1` 의 ER 다이어그램(`Workspace ── LLMConfig (1:N)`)과 §2 핵심 엔티티 목록에는 `RerankConfig` 가 없다. 신규 워크스페이스 스코프 엔티티이므로 데이터 모델 spec 에 정식 등재가 필요하다.
- **제안**: §10 반영 목록에 `spec/1-data-model.md §1(ER 다이어그램) + 신규 §2.N RerankConfig` 추가.

---

### 3. [WARNING] `ragThreshold` 의미 변경 — AI Agent spec 과 RAG Search spec 의 기존 정의와 충돌
- **target 위치**: §5 (config 설정 위치), §3 (검색 후처리 흐름)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §1` (`ragThreshold` 필드 설명), `spec/5-system/9-rag-search.md §3.1` (쿼리 파라미터 `$3` = `threshold`)
- **상세**: 현행 `spec/4-nodes/3-ai/1-ai-agent.md §1` 에서 `ragThreshold` 는 "최소 유사도 임계값 (0-1) 의 기본값" 으로, `spec/5-system/9-rag-search.md §3.1 $3` 는 "유사도 임계값(threshold)" 으로 정의된다. target draft §5 는 `rerank_mode≠off` 일 때 `ragThreshold` 가 "rerank 점수 임계 default(KB `rerank_score_threshold` 미설정 시 fallback)" 로 해석이 변경된다고 기술한다. 즉 동일 필드가 모드에 따라 다른 도메인(cosine vs rerank)의 임계를 의미하게 된다. 이는 AI Agent spec 과 RAG Search spec 에서 단일 의미로 정의된 필드에 두 번째 의미를 부여하는 것으로, 두 spec 을 명시적으로 함께 갱신하지 않으면 모순이 발생한다. §10 반영 대상에는 `ai-agent.md §1` 의 의미 보강 노트가 포함되어 있으나, `9-rag-search.md §3.1` 의 파라미터 표도 동시에 갱신해야 한다.
- **제안**: `spec/5-system/9-rag-search.md §3.1` 의 `$3 threshold` 설명에 `rerank_mode≠off` 시의 해석 변경을 명시. `spec/4-nodes/3-ai/1-ai-agent.md §1` `ragThreshold` 설명에 동일 이중 의미를 기술. 두 spec 을 §10 반영 목록에 모두 포함.

---

### 4. [WARNING] Graph RAG 의 내부 "rerank" 용어와 cross-encoder 리랭킹 용어 충돌 — disambiguation 미완성
- **target 위치**: §2 (데이터 모델 주석, "centrality 가중은 graph 내부 1차, cross-encoder 는 2차"), §10 §5
- **충돌 대상**: `spec/5-system/10-graph-rag.md §4 기술 결정 사항` ("Hybrid (vector seed + graph expansion + rerank)"), Graph RAG §3.4 KB-GR-SR-05
- **상세**: `spec/5-system/10-graph-rag.md` 는 Hybrid 검색 흐름을 "vector seed + graph expansion + rerank" 로 명명하고, KB-GR-SR-05 는 4단계를 "score 재정렬" 로 기술한다. target draft 는 이 graph-internal "rerank"(centrality 재가중)가 본 draft 의 cross-encoder 후처리와 별개 단계라고 §2 주석에서 설명하며, §10 에서 graph-rag.md 의 용어 disambiguation 1줄을 추가하겠다고 명시한다. 그러나 현재 `spec/5-system/10-graph-rag.md` 상의 "rerank" 표현은 draft 승인 전까지 중의적으로 읽힌다. 구현 개발자가 graph-rag.md 를 참조할 때 두 "rerank" 를 혼용할 위험이 있다.
- **제안**: §10 §5 의 disambiguation 작업을 consistency-check 통과 직후 즉시 graph-rag.md 에 적용하고, graph 내부 score 재정렬 단계의 명칭을 "centrality-weighted score blending" 등으로 cross-encoder reranking 과 명확히 구분할 것을 권고. KB-GR-SR-05 설명도 함께 갱신.

---

### 5. [INFO] `LLMClient` 인터페이스에 선택적 `rerank()` 추가 — 팩토리 확장 경로 불명확
- **target 위치**: §6 (LLM Client — rerank capability)
- **충돌 대상**: `spec/5-system/7-llm-client.md §3.1 LLMClient 인터페이스`, §4 `LLMClientFactory`
- **상세**: target draft 는 `LLMClient` 에 선택적 `rerank?()` 메서드를 추가하고, Cohere/Jina/TEI/local 등 새 provider 매핑을 정의한다. 현재 `spec/5-system/7-llm-client.md §4 LLMClientFactory.create()` 는 `LLMClientCreateOptions({provider, apiKey, defaultModel, baseUrl?})` 만 받는다. `RerankConfig` 의 shape(`{provider, baseUrl?, apiKey?, defaultModel}`)가 유사하지만, Cohere/Jina 등 rerank 전용 provider 는 기존 `LLMClientFactory` 의 switch-case 에 없으므로 별도 팩토리 경로가 필요하다. 이 경로가 spec 에서 명시되지 않으면 구현 시 팩토리 오염(chat provider 와 rerank provider 가 동일 switch 에 혼재)이 발생할 수 있다.
- **제안**: `spec/5-system/7-llm-client.md §4` 에 `RerankClientFactory` 별도 경로(또는 `RerankClient` 별도 인터페이스) 명시. §2 프로바이더 표에 Rerank 열 추가.

---

### 6. [INFO] `ragDiagnostics` 서브 객체 `rerank` 추가 — RAG Search spec 스키마 동기 필요
- **target 위치**: §8 (출력 메타데이터, ragDiagnostics 확장)
- **충돌 대상**: `spec/5-system/9-rag-search.md §4.2 ragDiagnostics`
- **상세**: `spec/5-system/9-rag-search.md §4.2` 는 `ragDiagnostics` 를 `attempted`, `searchedKbCount`, `queriesUsed`, `resultCount`, `skipReason` 5필드로 정의한다. target draft §8 은 선택적 `rerank` 하위 객체를 추가한다. additive 확장이므로 직접 충돌은 아니나, §9-rag-search.md §4.2 의 스키마 정의 동기화가 필요하다. §10 §1 에 반영 대상으로 포함되어 있어 의도적 갱신이다.
- **제안**: `spec/5-system/9-rag-search.md §4.2` 에 `rerank?` 선택적 서브객체 스키마와 존재 조건(`rerank_mode≠off` 호출 시만) 기술.

---

### 7. [INFO] `ragSources[].score` 의미 변경 및 `origin` 신규 필드 — RAG Search spec 과 동기 필요
- **target 위치**: §8 (ragSources[].score 는 rerank 적용 시 rerank 점수, origin 에 `reranked` 표기)
- **충돌 대상**: `spec/5-system/9-rag-search.md §4.1 ragSources` (`score`: "유사도 점수 (0.0 ~ 1.0)")
- **상세**: 현행 §4.1 에서 `ragSources[].score` 는 cosine 유사도 점수로 단일 의미를 가진다. target draft §8 은 `rerank_mode≠off` 시 이 값이 rerank 점수(0~1 정규화)로 대체됨을 기술하고, `origin` 필드에 `reranked` 표기를 제안한다. `origin` 필드는 현재 `spec/5-system/9-rag-search.md §4.1` 에 존재하지 않는다. 동기화 없이 구현하면 run-results References 탭이 `score` 를 항상 cosine 값으로 렌더링할 수 있다.
- **제안**: `spec/5-system/9-rag-search.md §4.1` ragSources 스키마에 `origin?: 'cosine' | 'reranked'` 필드 및 score 의 이중 의미를 명시. §10 §1 반영 시 포함.

---

## 요약

target draft(`spec-draft-rag-reranking.md`)가 영향을 주는 spec 범위(`spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/10-graph-rag.md`, `spec/2-navigation/5-knowledge-base.md`)는 §10 반영 목록에 대부분 인지되어 있다. 직접적인 데이터 모순(동일 필드에 상반된 값·타입)은 없으나, `spec/1-data-model.md` 가 §10 반영 목록에서 누락되어 있어(`KnowledgeBase` 컬럼 추가 + `RerankConfig` 신규 엔티티), `ragThreshold` 의 의미 이중화가 `9-rag-search.md §3.1` 과 동시 갱신 없이는 모순으로 남으며, Graph RAG 의 내부 "rerank" 용어와의 중의성이 현재 미해소 상태이다. 이 WARNING 4건이 §10 반영 단계에서 함께 처리되어야 구현 단계에서 충돌이 발생하지 않는다.

---

## 위험도

MEDIUM
