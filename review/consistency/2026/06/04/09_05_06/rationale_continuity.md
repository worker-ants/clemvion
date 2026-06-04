# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-rag-reranking.md`
검토 기준 spec Rationale: `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/10-graph-rag.md`, `spec/1-data-model.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/1-ai-agent.md`

---

## 발견사항

- **[INFO]** target Rationale 와 반영된 spec 간 설계 결정 연속성 완전 정합
  - target 위치: `plan/in-progress/spec-draft-rag-reranking.md` `## Rationale` 전체 + `## 10. 반영 대상 spec`
  - 과거 결정 출처: spec 반영 완료된 6개 파일의 각 `## Rationale` 및 본문 결정
  - 상세: target 의 Rationale 에서 명시한 8개 핵심 결정(off 기본, KB 단위, rerank_mode 가변 vs rag_mode 불변 비대칭, ragThreshold 이중화, LLM_CONFIG_INVALID 재사용, cross-encoder 기본/LLM escalate, 동적 점수 컷, RerankConfig sibling 분리)이 모두 반영 spec 에 동일하게 기록됨. 어떤 과거 결정도 무근거 번복이나 재도입 없음.
  - 제안: 해당 없음.

- **[INFO]** `폐기한 대안` 목록이 반영 spec 에서 명시 차단 여부 확인 가능
  - target 위치: `## Rationale` `폐기한 대안` 섹션 (노드 단위 설정·항상 리랭크·cosine 임계 유지·VectorChord)
  - 과거 결정 출처: `spec/5-system/10-graph-rag.md §Rationale` 결정 5 "검색 파라미터 노출 = KB 단위에만", `spec/5-system/9-rag-search.md §3.3.1` off 기본값
  - 상세: 4가지 폐기 대안이 target Rationale 에 명시돼 있고, 반영된 spec(`9-rag-search.md §3.3`, `1-data-model.md §2.11`)에도 KB 단위 소유·off 기본이 일관되게 반영됨. 노드 단위 파라미터 노출 금지는 Graph RAG Rationale 결정 5 와도 정합.
  - 제안: 해당 없음.

- **[INFO]** `rag_mode` 불변 / `rerank_mode` 가변 비대칭 Rationale 위치 분리
  - target 위치: `## Rationale` `왜 rag_mode 는 불변인데 rerank_mode 는 가변인가` (I5)
  - 과거 결정 출처: `spec/5-system/10-graph-rag.md §Rationale` 사용자 결정 6 "KB 모드 사후 변경 = 생성 시에만 결정(불변)", `spec/1-data-model.md §2.11` `rag_mode` 컬럼 비고
  - 상세: target 이 비대칭 설계를 Rationale 에서 명시 설명하고, 반영 spec(`1-data-model.md §2.11`)도 `rerank_mode`를 "사후 변경 가능, 재임베딩 불요"로 명시해 기존 `rag_mode = 불변` 원칙을 침해하지 않고 직교 표현함. 충돌 없음.
  - 제안: 해당 없음.

- **[INFO]** `ragThreshold` 의미 이중화의 기존 Graph RAG 결정과의 정합
  - target 위치: `## Rationale` `왜 ragThreshold 의미를 재해석(이중화)했나` (I4); `## 5. config` `ragThreshold` 분기 설명
  - 과거 결정 출처: `spec/5-system/10-graph-rag.md §Rationale` 결정 5 "AI Agent 노드는 기존 ragTopK/ragThreshold 유지"; `spec/4-nodes/3-ai/1-ai-agent.md §1` 해당 컬럼 비고
  - 상세: Graph RAG 가 "AI Agent 노드 설정의 단순성 유지 — ragTopK/ragThreshold 만 노출" 을 합의 원칙으로 확립했으며, target 은 이 원칙을 유지하는 방향(노드 새 필드 미추가, 기존 필드 분기 해석)을 Rationale 로 설명한다. 반영된 `ai-agent.md §1` 도 동일하게 처리됨. 충돌 없음.
  - 제안: 해당 없음.

---

## 요약

target 문서(`spec-draft-rag-reranking.md`)의 설계 결정과 그 Rationale 는 기존 spec 의 확립된 원칙 — Graph RAG 의 "파라미터는 KB 단위에만, 노드는 ragTopK/ragThreshold 만 노출" 원칙, `rag_mode` 불변 결정, `LLMClientFactory` 오염 방지를 위한 sibling 팩토리 분리 방향, 셀프호스팅 off-기본 정책 — 과 모두 연속성을 유지한다. 폐기된 4개 대안(노드 단위 설정, 항상 리랭크, cosine 임계 유지, in-DB 리랭킹)이 target Rationale 에 명시적으로 기각 이유와 함께 기록되어 있으며, 이 중 어느 것도 반영 spec 에 재도입되지 않았다. 기각·번복의 무근거 도입이나 암묵적 invariant 우회는 발견되지 않았다.

## 위험도

NONE
