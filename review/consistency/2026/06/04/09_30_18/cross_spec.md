# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (구현 착수 전 --impl-prep)
검토 대상: `spec/5-system/9-rag-search.md` (신규 §3.3 리랭킹 추가분 포함) + 동일 영역 내 `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

- **[INFO]** `ragSources` 내 `origin` 필드의 규범 정의 위치 분산
  - target 위치: `spec/5-system/9-rag-search.md` §4.1 (`origin?` 불릿)
  - 충돌 대상: `spec/5-system/10-graph-rag.md` §4.3 (`ragSources.origin: 'seed' | 'expanded'`), `spec/4-nodes/3-ai/1-ai-agent.md` §meta 테이블 (`origin: 'seed' | 'expanded'` 부착)
  - 상세: `ragSources[].origin` 의 허용값은 세 spec 에 흩어져 있다. rag-search spec §4.1 이 `cosine` / `reranked` / `seed` / `expanded` 4종을 정의하고 "graph 모드의 `seed` / `expanded` 는 Graph RAG §4.3 참조"로 위임하며, ai-agent spec meta 테이블은 `origin: 'seed' | 'expanded'` 만 언급한다. 값 자체는 서로 모순이 없으나 단일 규범 정의가 없어 향후 값 추가(예: `reranked`)가 세 곳 모두를 업데이트해야 한다. 현재 구현 착수 시 `reranked` 값을 코드에서 emit 할 때 ai-agent spec meta 테이블도 업데이트가 필요하다.
  - 제안: `spec/5-system/9-rag-search.md` §4.1 을 `origin` 의 canonical enum SoT 로 명시하고, ai-agent spec meta 테이블 `meta.ragSources` 행에 "상세: [RAG 검색 §4.1]" cross-ref 추가.

- **[INFO]** `graphTraversal` 서브객체 — rag-search spec 에 언급 없음
  - target 위치: `spec/5-system/9-rag-search.md` §4 전체 (ragSources / ragDiagnostics 정의)
  - 충돌 대상: `spec/5-system/10-graph-rag.md` §4.3 (`graphTraversal` 객체 JSON 예시 및 `mode === 'vector'` 생략 규칙)
  - 상세: graph-rag spec §4.3 이 `ragSources` 와 동일 응답 안에 `graphTraversal` 서브객체를 정의한다. rag-search spec §4 는 `ragSources` / `ragDiagnostics` 만 정의하고 `graphTraversal` 에 대한 언급이 없다. 기능 분리가 명확해 작동에는 문제가 없지만, 구현자가 rag-search spec 만 보면 `graphTraversal` 의 존재와 생략 조건(`mode=vector` 시 생략)을 놓칠 수 있다.
  - 제안: rag-search spec §4 에 "graph 모드 KB 의 경우 응답에 `graphTraversal` 서브객체가 추가된다 — 상세: [Graph RAG §4.3](./10-graph-rag.md#43-출력-메타데이터)" 참조 문구 1줄 추가.

- **[INFO]** `RerankConfig` RBAC 항목 누락 — `spec/5-system/1-auth.md` §3.2 권한 매트릭스
  - target 위치: `spec/5-system/9-rag-search.md` §3.3 (`rerank_config_id`, RerankConfig 참조)
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스, `spec/1-data-model.md` §2.16.1 RerankConfig
  - 상세: auth spec §3.2 매트릭스에는 `LLM Config | CRUD | CRUD | R | R` 행이 있으나 `RerankConfig` 행이 없다. data-model spec §2.16.1 에서 RerankConfig 가 워크스페이스 단위 리소스로 정의돼 있고, `spec/2-navigation/5-knowledge-base.md` 에서 "워크스페이스 설정 화면에서 LLMConfig 와 동일 패턴으로 관리"라고 기술하지만 RBAC 행이 없으면 구현 시 가드 역할 규칙이 불명확하다. LLMConfig 와 동일하게 Admin+가 CRUD, Editor/Viewer 가 R 로 처리될 것이 자연스럽지만 spec 에 명시되지 않았다.
  - 제안: `spec/5-system/1-auth.md` §3.2 매트릭스에 `| Rerank Config | CRUD | CRUD | R | R |` 행 추가 (Planned 마커 포함). rag-search spec §3.3 에서는 현행 기술로 충분.

- **[INFO]** `reranked` origin 값 — `ragSources` 정의 스코프 이슈
  - target 위치: `spec/5-system/9-rag-search.md` §4.1 (`origin?: 'reranked'` Planned)
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §meta 테이블, `spec/5-system/10-graph-rag.md` §4.3
  - 상세: rag-search spec 이 `origin = 'reranked'` 를 Planned 로 추가할 계획인데, 이 값은 `vector` 모드와 `graph` 모드 양쪽 모두에서 가능하다(리랭킹은 `rag_mode` 와 직교). graph-rag spec §4.3 의 `origin: 'seed' | 'expanded'` 예시에는 `reranked` 가 없다. 리랭킹이 graph 모드에 적용될 때 `origin` 이 `'seed'` 인지 `'reranked'` 인지 또는 `'expanded+reranked'` 인지 정의되지 않았다. 단순 충돌은 아니나 구현 착수 전 정의가 필요한 미결 항목이다.
  - 제안: rag-search spec §4.1 에 "graph 모드에서 리랭킹 적용 시 `origin` 은 `'seed'` 또는 `'expanded'` 를 유지하고 `score` 만 rerank 점수로 교체된다 — `'reranked'` 는 vector 모드 전용 값" 등으로 명시적으로 결정해 기술.

---

## 요약

`spec/5-system/` 의 네 영역(auth, graph-rag, rag-search, mcp-client) 사이에 CRITICAL 또는 WARNING 수준의 직접 모순은 발견되지 않았다. 신규 추가된 리랭킹(§3.3) 관련 데이터 모델 필드(`rerank_mode`, `rerank_candidate_k`, `rerank_score_threshold`, `rerank_config_id`, `rerank_llm_config_id`)는 `spec/1-data-model.md` §2.11 KnowledgeBase 와 일치하며, `RerankClient` 인터페이스는 `spec/5-system/7-llm-client.md` §3.6 · §4.1 과 일치한다. 주요 개선 사항은 `ragSources[].origin` 값의 canonical SoT 명시, `graphTraversal` 서브객체에 대한 cross-ref 보강, `RerankConfig` RBAC 행 추가, graph+rerank 동시 적용 시 `origin` 값 규칙 명확화 등 INFO 수준 문서 동기화 항목이다.

---

## 위험도

LOW
