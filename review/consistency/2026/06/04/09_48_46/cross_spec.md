# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (구현 착수 전, --impl-prep)
검토 기준일: 2026-06-04

---

## 발견사항

### [WARNING] `9-rag-search.md §3.3.2` 의 호출 참조가 `LLMClient.rerank()` 로 잘못 기술됨

- **target 위치**: `spec/5-system/9-rag-search.md` §3.3.2 흐름 2단계 주석
  ```
  (LLMClient.rerank() — Spec LLM Client §3.6)
  ```
- **충돌 대상**: `spec/5-system/7-llm-client.md` §3.6, §4.1
- **상세**: `7-llm-client.md` §3.6 은 리랭킹 인터페이스를 `LLMClient` 에 욱여넣지 않고 **별도 `RerankClient` 인터페이스**로 분리한다고 명시한다(`"cross-encoder 리랭킹은 chat/embedding 과 API shape 가 달라 LLMClient 에 욱여넣지 않고 별도 인터페이스로 둔다"`). `4.1 RerankClientFactory` 도 `LLMClientFactory` 와 완전히 분리된 팩토리로 정의되어 있다. 그러나 `9-rag-search.md §3.3.2` 의 2단계 주석은 `LLMClient.rerank()` 로 호출처를 표기해, 마치 `LLMClient` 에 `rerank()` 메서드가 존재하는 것처럼 읽힌다. `7-llm-client.md` §3.1 의 `LLMClient` 인터페이스에 `rerank()` 메서드는 존재하지 않는다.
- **제안**: `9-rag-search.md §3.3.2` 2단계 주석을 `(RerankClient.rerank() — Spec LLM Client §3.6)` 또는 `(RerankClientFactory → RerankClient — Spec LLM Client §3.6, §4.1)` 으로 수정.

---

### [INFO] `9-rag-search.md §1` 의 graph 모드 설명에 "rerank" 용어 포함

- **target 위치**: `spec/5-system/9-rag-search.md` §1 개요 2번째 bullet
  ```
  graph: vector seed → 그래프 확장 → rerank 의 Hybrid 흐름
  ```
- **충돌 대상**: `spec/5-system/10-graph-rag.md` §1 용어 disambiguation, `spec/5-system/9-rag-search.md §3.3`
- **상세**: `10-graph-rag.md` §1 은 graph 내부의 점수 재정렬을 **"centrality-weighted score blending"** 으로 명명하고, cross-encoder 후처리 reranking(`§3.3`)과 명시적으로 구분한다. `spec-draft-rag-reranking.md` 의 W4 항목도 이 disambiguation 을 반영 완료 표시(`KB-GR-SR-05`) 했다. 그러나 `9-rag-search.md §1` 의 graph 모드 설명에서 여전히 단순히 "rerank" 라고만 기술하여, 새 cross-encoder reranking(§3.3) 과의 용어 혼동 여지가 남아 있다.
- **제안**: `9-rag-search.md §1` graph 모드 bullet 을 `graph: vector seed → 그래프 확장 → centrality-weighted score blending 의 Hybrid 흐름 ([Spec Graph RAG §4](./10-graph-rag.md))` 으로 동기화하여 §3.3 의 cross-encoder reranking 과 명시적 구분.

---

### [INFO] `spec/2-navigation/6-config.md` 에 RerankConfig 관리 UI 언급 없음

- **target 위치**: `spec/2-navigation/5-knowledge-base.md` line 65
  ```
  RerankConfig 는 워크스페이스 설정 화면에서 LLMConfig 와 동일 패턴으로 관리한다
  ```
- **충돌 대상**: `spec/2-navigation/6-config.md`
- **상세**: `5-knowledge-base.md` 는 RerankConfig 관리 화면이 워크스페이스 설정(`spec/2-navigation/6-config.md`)에 존재한다고 지시한다. 그러나 `6-config.md` 에는 RerankConfig 에 대한 어떤 언급도 없다. LLMConfig 에 준하는 관리 UI 섹션이 해당 파일에 반영되지 않은 상태이다. 이 누락은 구현 착수 전에 알아두어야 하는 정보이나, 6-config.md 가 이번 PR 의 primary target 이 아니고 Planned 표기이므로 즉시 충돌은 아니다.
- **제안**: `spec/2-navigation/6-config.md` 에 RerankConfig 관리 섹션(LLMConfig 와 동일 패턴)을 Planned 표기로 추가하여 링크 목적지를 마련할 것. 구현 전 spec 동기화 필요 항목으로 기록.

---

### [INFO] `spec/1-data-model.md` §1 ER 다이어그램에서 `KnowledgeBase → RerankConfig` FK 관계선 미표시

- **target 위치**: `spec/1-data-model.md` §1 ER 다이어그램
- **충돌 대상**: `spec/1-data-model.md` §2.11 KnowledgeBase `rerank_config_id` 컬럼 정의
- **상세**: §1 ER 다이어그램에 `Workspace → RerankConfig (1:N)` 관계는 표시되어 있으나, `KnowledgeBase.rerank_config_id → RerankConfig` FK 관계는 다이어그램에 명시되지 않았다. 마찬가지로 `KnowledgeBase.rerank_llm_config_id → LLMConfig` 도 누락. §2.11 컬럼 정의에는 존재하므로 데이터 모델 자체의 모순은 아니나, ER 다이어그램과 컬럼 정의 간 불일치로 개발자가 ER 다이어그램만 보고 누락을 인지하지 못할 수 있다.
- **제안**: ER 다이어그램 `KnowledgeBase` 노드 하위에 `→ RerankConfig (FK rerank_config_id)` 와 `→ LLMConfig (FK rerank_llm_config_id)` 관계선을 추가. 현재 `extraction_llm_config_id` 도 같은 이유로 ER 에 미표시된 상태이므로 함께 동기화 권장.

---

## 요약

Cross-Spec 일관성 관점에서 CRITICAL 충돌은 발견되지 않았다. 가장 주목할 만한 발견은 `9-rag-search.md §3.3.2` 에서 `LLMClient.rerank()` 라고 참조하는 점으로, `7-llm-client.md` 가 `RerankClient` 를 `LLMClient` 와 완전히 분리된 인터페이스로 정의하는 것과 표현상 충돌한다. 구현자가 이 주석을 그대로 따르면 설계 의도와 다른 인터페이스 경로를 선택할 수 있으므로 수정이 권장된다. 나머지 INFO 항목들은 Planned 범위의 동기화 누락으로 구현 착수를 차단하지 않는다. `spec/5-system/` 영역 내 리랭킹 관련 신규 정의(`rerank_mode`, `RerankConfig`, `RerankClient/Factory`)는 `spec/1-data-model.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/10-graph-rag.md` 각각과의 주요 충돌 없이 일관되게 반영되어 있다.

---

## 위험도

LOW
