# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target 문서: `spec/5-system/9-rag-search.md`
diff-base: origin/main

---

## 발견사항

### 발견사항 없음 (통과)

모든 점검 관점에서 위반 사항이 발견되지 않았다.

**점검 결과 요약:**

1. **기각된 대안의 재도입**: `spec/5-system/9-rag-search.md ## Rationale` 의 "폐기한 대안" 목록 — 노드 단위 리랭크 설정, 항상 리랭크(off 없음), cosine 임계 유지한 채 리랭크, VectorChord/ColBERT 등 in-DB 리랭킹 — 어느 것도 본 diff 가 재도입하지 않는다. ef_search 상향을 `SET LOCAL`(트랜잭션 스코프) + `hnswEfSearchFor` 유틸로 구현한 방식은 spec 이 기각한 대안과 충돌하지 않는다.

2. **합의된 원칙 위반**: `spec/5-system/9-rag-search.md §3.4` 의 "pgvector HNSW `ef_search` (recall 보전)" 조항이 이미 `SET LOCAL hnsw.ef_search = clamp(LIMIT×2, 40, 1000)` + 트랜잭션 스코프 적용을 명문화하고 있으며, 구현(`rag-search.service.ts`, `dynamic-cut.util.ts`)이 정확히 이를 따른다. graph seed(`seedTopK` < 40) 미적용 결정 역시 spec §3.4 의 주석 및 `rag-search.service.ts` 코드 주석에 일치한다.

3. **결정의 무근거 번복**: `spec-draft-rag-reranking.md` 및 `rag-quality-improvement.md` 계열의 과거 결정을 번복하는 요소가 없다. 동적 컷(D1)의 "byte-identical 조항 폐기" 결정은 spec §Rationale 에 이미 명시 갱신되어 있으며 본 diff 는 그 갱신을 따른다.

4. **암묵적 가정 충돌**: `ivfflat` 미사용·차원별 partial HNSW 만 운용 정책(`spec/1-data-model.md`, `spec/5-system/8-embedding-pipeline.md`)과 `SET LOCAL hnsw.ef_search` 적용이 정합하다. `ivfflat` 인덱스 파라미터(`ivfflat.probes`)를 건드리지 않으며, HNSW 한정 GUC 조작이 데이터 모델 invariant 를 우회하지 않는다. "신규 KB/노드 config 필드 증식 회피" 원칙도 준수 — `hnswEfSearchFor` 는 내부 유틸 함수이며 사용자 노출 필드를 추가하지 않는다.

---

## 요약

본 diff(`rag-followup-efsearch-b6c8e8`)는 `spec/5-system/9-rag-search.md §3.4` 에 이미 명문화된 "pgvector HNSW `ef_search` recall 보전" 결정을 구현한 것이다. spec 이 기각한 대안(in-DB 리랭킹, cosine 임계 폐기, 노드 단위 설정 등)을 재도입하지 않고, 합의된 설계 원칙(내부 상수 사용, SET LOCAL 트랜잭션 스코프, graph seed 예외)을 모두 준수한다. 결정 번복 없이 spec 이 후속 구현으로 예정한 correctness gap 을 닫는 작업이며 Rationale 연속성 관점에서 문제가 없다.

---

## 위험도

NONE
