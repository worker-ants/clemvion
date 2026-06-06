# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/9-rag-search.md` (--impl-done, diff-base=origin/main)
검토 일시: 2026-06-06

---

## 발견사항

### [WARNING] §6 fallback 설명이 동적 컷을 반영하지 않음 (stale "top-k 컷" 표현)

- **target 위치**: `spec/5-system/9-rag-search.md` §6 에러 처리 테이블 — "리랭커 endpoint 실패/타임아웃" / "리랭커가 유효 결과 0건 반환" 두 행에 "wide 회수 결과를 cosine score 순 **top-k 컷**으로 안전 강등"이라 기재됨
- **과거 결정 출처**: `spec/5-system/9-rag-search.md §3.4` + 동 문서 `## Rationale` ("왜 동적 점수 컷인가 (D1)" — "모든 모드(vector/graph/rerank) 최종 주입 단계에 공통 적용") + Rationale "v1 breaking note — cutoffApplied 의미 확장 (D1)" ("강등(fallback) 경로에서도 token-budget/inject-cap 컷 발생 시 `true` 가 반환된다")
- **상세**: 현재 구현(`rerank.service.ts` `fallback()` 메서드)은 `applyDynamicCut(sorted, { tokenBudget, injectCap })` 을 사용하고 있어 §3.4 + Rationale 의 "모든 경로 공통 적용" 원칙을 충실히 따른다. 그러나 §6 테이블 텍스트는 구 표현("top-k 컷")을 그대로 유지하고 있어 구현과 spec 사이에 서술 불일치가 존재한다. Rationale 의 breaking-note 가 fallback 경로의 동적 컷 적용을 암시하지만 §6 본문이 명시적으로 갱신되지 않았다.
- **제안**: `spec/5-system/9-rag-search.md` §6 테이블에서 해당 두 행의 "top-k 컷" 표현을 "§3.4 동적 점수 컷(token-budget + inject-cap)"으로 변경한다. 예: "wide 회수 결과를 cosine score 순 정렬 후 **§3.4 동적 점수 컷**(token-budget + inject-cap)으로 안전 강등".

---

### [INFO] 기각된 대안("항상 LLM grading v1") 번복 — Rationale 에 명시적 설명 존재, 이슈 없음

- **target 위치**: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` — `shouldEscalateGrading()` conditional escalate 로직 도입
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §Rationale` "남은 결정 — 2026-06-04 확정" ② "`cross_encoder_llm` = **항상 LLM grading**(v1). 점수 기반 conditional escalate 의 정량 임계는 P0 평가셋 보정 후 후속 최적화."
- **상세**: 이전 `spec-draft-rag-reranking.md` 에서 `cross_encoder_llm` 은 "항상 LLM grading" 으로 확정된 바 있다. 이번 구현은 conditional escalate 로 전환했는데, 현행 spec(`spec/5-system/9-rag-search.md`)의 `## Rationale` 가 "왜 D2 conditional escalate 를 지금 도입하나" 항목에서 역번역 이유를 명시적으로 기술하고 있다("LLM 콜 비용 보호용 단순화", "escalate 미발생 시 cross-encoder 결과=v1 부분집합"). `plan/in-progress/rag-quality-improvement.md` 172행도 2026-06-06 재결정을 문서화하고 있다. 따라서 새 Rationale 가 함께 작성된 번복으로 Rationale 연속성 위반 아님.
- **제안**: 특별 조치 불필요.

---

### [INFO] "byte-identical 하위호환" 원칙 번복 — Rationale 에 명시적 설명 존재, 이슈 없음

- **target 위치**: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `off` 경로의 `LIMIT topK` 를 `RAG_RECALL_K(50)` + `applyDynamicCut` 으로 대체
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §1` "하위호환: 현 동작과 byte-identical" / `## Rationale` "왜 완전 선택적(off 기본)인가" — "(a) 하위호환 byte-identical"
- **상세**: 구 `spec-draft-rag-reranking.md` 는 `off` 경로가 "현 동작과 byte-identical" 임을 하위호환 정의로 삼았다. 이번 D1 동적 컷 도입으로 이 조항은 파기됐다. 현행 spec `## Rationale` "byte-identical 조항 폐기 (D1, 2026-06-06)" 항목이 이를 명시적으로 기술하고 새 하위호환 정의("리랭커 인프라 없이 동작·점진 도입 가능")를 제시한다. 근거 명시 번복으로 Rationale 연속성 위반 아님.
- **제안**: 특별 조치 불필요.

---

## 요약

검토 결과 Rationale 연속성 관점에서 CRITICAL 수준의 위반은 발견되지 않았다. 기각됐던 두 가지 주요 결정("항상 LLM grading v1", "byte-identical 하위호환")의 번복은 모두 현행 `spec/5-system/9-rag-search.md`의 `## Rationale` 에 명시적 갱신 이유가 기술되어 있으며, `plan/in-progress/rag-quality-improvement.md` 의 재결정 기록과도 정합한다. "cosine 임계 유지한 채 리랭크" 등 폐기 대안은 구현에서 재도입되지 않았다. 유일한 경계 사항은 WARNING 수준으로, §6 에러 처리 테이블의 fallback 행 텍스트가 §3.4 + Rationale 에서 확정된 "동적 컷 모든 경로 공통 적용" 원칙을 아직 반영하지 않고 구 "top-k 컷" 표현을 유지하고 있다는 서술적 불일치다. 구현 자체는 올바르며 spec 텍스트 보완이 권장된다.

## 위험도

LOW
