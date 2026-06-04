# Rationale 연속성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
대상 범위: spec/5-system/

---

## 발견사항

- **[WARNING]** 10-graph-rag.md Rationale 도메인 용어에서 "rerank" 미disambiguation
  - target 위치: `spec/5-system/10-graph-rag.md` §Rationale > 도메인 용어 (line 593), §1 목표 (line 37), §2.1 Hybrid 검색 흐름 행 (line 56), §4 기술 결정 사항 표 "검색 흐름" 행 (line 156)
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md` `## Rationale` 중 W4 항목 — "graph 내부의 score 재정렬을 **'centrality-weighted score blending'** 으로 명명, cross-encoder 후처리 reranking 과 disambiguation; **KB-GR-SR-05 설명 동기화**(W4)". 또한 `spec/5-system/10-graph-rag.md` §1 개요의 disambiguation note 에서도 이 구분이 명시됨.
  - 상세: §1 개요(line 208–210)와 KB-GR-SR-05(line 115)는 이미 "centrality-weighted score blending" 용어와 cross-encoder reranking과의 구분 노트를 올바르게 담고 있다. 그러나 다음 세 위치는 이 결정이 적용되지 않은 채 단순 "rerank"를 사용하고 있어 독자가 두 단계를 혼동할 수 있다:
    1. **§1 목표** (line 37): "vector seed → 그래프 확장 → rerank 흐름" — disambiguation note 가 없는 첫 소개 문장.
    2. **§2.1 Hybrid 검색 흐름 행** (line 56): "→ expanded chunk 회수 → rerank" — 표 안에서 "rerank" 만 사용.
    3. **§4 기술 결정 사항 표 "검색 흐름" 행** (line 156): "Hybrid (vector seed + graph expansion + rerank)".
    4. **Rationale 도메인 용어** (line 593): "vector top-K seed → 1~2 hop graph expansion → rerank 하는 Hybrid 흐름" — 가장 영향이 큰 지점. Rationale 의 도메인 용어 섹션은 다른 문서에서 참조하는 공식 정의 자리인데, 여기서도 "rerank" 를 무수식으로 사용하면 cross-encoder reranking 과의 혼동이 이 정의를 참조하는 모든 위치로 전파된다.
  - 제안: 위 4곳에서 "rerank" 를 "centrality-weighted score blending(rerank)" 또는 "centrality 재가중(graph 내부 1차 정렬)" 으로 교체하거나, 첫 언급 뒤 괄호 주석으로 "(= centrality-weighted score blending; cross-encoder reranking 과는 별개)" 를 부기한다. 특히 Rationale 도메인 용어 항목은 정의 자리이므로 "rerank" 대신 "centrality-weighted score blending" 이 주 용어가 되어야 한다. §1 개요의 disambiguation note(line 210)를 Rationale 도메인 용어에도 연결한다.

- **[INFO]** 9-rag-search.md Rationale 섹션 부재 — 설계 결정이 외부 plan 파일에만 위임
  - target 위치: `spec/5-system/9-rag-search.md` 전체 (Rationale 섹션 없음)
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md` `## Rationale` — 기각된 대안 목록(노드 단위 리랭크, off 없음, cosine 임계 유지한 채 리랭크, in-DB 리랭킹, LLMClient.rerank? 방식)과 채택 근거가 spec 파일이 아닌 plan 파일에만 있다.
  - 상세: 9-rag-search.md §3.3 의 맨 끝 주석(line 189)에서 설계 결정을 `plan/in-progress/spec-draft-rag-reranking.md ## Rationale` 로 위임하고 있다. plan 파일은 구현 완료 후 `plan/complete/` 로 이동·아카이브되는 단기 문서이므로, spec 생명주기 동안 참조 링크가 사라질 위험이 있다. 기각된 대안("노드 단위 리랭크 설정", "항상 리랭크(off 없음)", "cosine 임계 유지한 채 리랭크", "VectorChord/ColBERT in-DB 리랭킹")과 그 근거가 spec 에 직접 남아있지 않다.
  - 제안: plan 파일이 `plan/complete/` 로 이동되기 전에, spec-draft-rag-reranking.md §Rationale 의 핵심 기각 대안 목록과 설계 원칙("완전 선택적 off 기본", "KB 소유권 원칙", "rag_mode 불변 vs rerank_mode 가변 비대칭")을 9-rag-search.md 끝의 `## Rationale` 절로 옮기거나, plan 파일이 아닌 `spec/` 내 다른 SoT 위치에 고정한다. 구현 PR 시점에 frontmatter `code:` 추가와 함께 Rationale 절을 함께 작성하면 된다.

- **[INFO]** 7-llm-client.md Rationale 섹션 부재 — RerankClient 분리 결정 근거 미기록
  - target 위치: `spec/5-system/7-llm-client.md` §4.1 RerankClientFactory (Planned)
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md` `## Rationale` — "왜 RerankConfig 를 LLMConfig 와 분리(sibling)했나", I1 결정("LLMClientFactory 오염 방지").
  - 상세: §4.1(line 213)에 "LLMClientFactory 의 chat/embedding provider switch 를 오염시키지 않는다"는 문장이 있어 의도는 전달되나, 공식 `## Rationale` 절 없이 본문 서술로만 남아있다. 검토자가 "왜 sibling 팩토리인가"의 기각 대안(capability flag 로 LLMConfig 에 욱여넣기)이 spec 에서 직접 확인되지 않는다.
  - 제안: 7-llm-client.md 에 `## Rationale` 절을 추가하고 RerankClient/RerankClientFactory 분리 결정과 기각 대안(LLMConfig 통합 capability flag)을 기록한다. 9-rag-search.md Rationale 절 신설과 동일 구현 PR 시점에 묶어 처리 가능.

---

## 요약

`spec/5-system/` 영역의 Rationale 연속성에서 가장 유의미한 문제는 `10-graph-rag.md` 에 집중된다. `spec-draft-rag-reranking.md` 의 W4 결정("centrality-weighted score blending" 명명 + cross-encoder reranking disambiguation)이 §1 개요와 KB-GR-SR-05에는 적용되었으나, §1 목표·§2.1 표·§4 기술 결정 표·Rationale 도메인 용어에는 여전히 단순 "rerank" 가 남아있다. 특히 Rationale 도메인 용어는 다른 문서가 참조하는 공식 정의 위치이므로 이 불일치가 하위 문서로 전파될 수 있다. `9-rag-search.md` 와 `7-llm-client.md` 에는 Rationale 섹션이 없어 기각된 대안이 spec 생명주기 밖 plan 파일에만 머무르는 구조적 위험이 있으나, plan 파일이 아직 활성 상태이고 구현 PR 전이므로 즉각적 차단 요인은 아니다. CRITICAL 수준의 합의된 invariant 직접 위반은 발견되지 않았다.

---

## 위험도

LOW
