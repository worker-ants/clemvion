# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target 범위: `spec/5-system/`
검토 시각: 2026-06-04

---

### 발견사항

- **[INFO]** `spec/5-system/9-rag-search.md §3.3` — Rationale 인라인 미수록, 외부 링크 위임
  - target 위치: `spec/5-system/9-rag-search.md` 맨 끝 (§3.3 이후, §7 이후 Rationale 섹션 없음)
  - 과거 결정 출처: `plan/in-progress/spec-draft-rag-reranking.md ## Rationale`
  - 상세: `spec/5-system/9-rag-search.md` 는 §3.3 끝에 "설계 결정·근거·폐기 대안: `spec-draft-rag-reranking.md ## Rationale` 참조" 한 줄만 있고, spec 본문에 Rationale 섹션이 없다. CLAUDE.md 및 spec 컨벤션은 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 에 기록한다고 명시한다. plan draft 파일은 임시 워킹 문서이며 `complete/archive/` 로 이동되거나 삭제될 수 있어, 참조 링크가 사라지면 폐기 대안(노드 단위 리랭크, 항상-리랭크, cosine 임계 유지 리랭크, VectorChord 등)이 spec 내에서 추적 불가능해진다.
  - 제안: `spec/5-system/9-rag-search.md` 에 `## Rationale` 섹션을 추가하고, `spec-draft-rag-reranking.md ## Rationale` 의 핵심 내용(완전 선택적·KB 단위·`rerank_mode` 가변 vs `rag_mode` 불변·`ragThreshold` 이중 해석·폐기 대안 목록)을 옮겨 기록한다.

- **[INFO]** `spec/5-system/9-rag-search.md §3.3.2` — `pointwise 금지` 결정이 spec 본문에만 있고 Rationale 에 근거 없음
  - target 위치: `spec/5-system/9-rag-search.md §3.3.2` 흐름 3단계 "(id 순위 + 1~10 점수, 1콜; pointwise 금지)"
  - 과거 결정 출처: `spec-draft-rag-reranking.md ## Rationale` ("fin.ai A/B 에서 listwise LLM 은 해결률 이점 0, pointwise 는 N콜·이점 0")
  - 상세: pointwise 금지 근거(N 콜·이득 없음)가 spec 본문 Rationale 에 기록되지 않아, 후속 구현자가 pointwise 방식을 검토할 때 왜 기각됐는지 추적하기 어렵다. spec 안에 Rationale 섹션이 없어서 발생하는 파생 이슈이기도 하다.
  - 제안: 위 INFO 와 함께 Rationale 섹션에 합산 기록.

- **[INFO]** `spec/5-system/9-rag-search.md §3.3.2` — `cross_encoder_llm` v1 항상-LLM 결정의 근거가 spec 외부에만 존재
  - target 위치: `spec/5-system/9-rag-search.md §3.3.2` "v1 결정: `cross_encoder_llm` 은 항상 LLM grading 을 수행한다(…conditional escalate 는 P0 평가셋 보정 후 후속)"
  - 과거 결정 출처: `spec-draft-rag-reranking.md ## Rationale` "남은 결정 ②"
  - 상세: "conditional escalate 폐기 → v1 항상 수행" 이 결정인데, 근거(P0 평가셋 보정 미완, fin.ai A/B)는 plan draft 에만 있다. 향후 conditional escalate 를 재도입할 때 근거가 draft 외부에 없으면 기각된 대안의 재도입인지 신규 결정인지 구분이 어렵다.
  - 제안: Rationale 섹션에 "v1 conditional escalate 기각 이유 + 재도입 조건(P0 평가셋 보정 후)"을 명시.

- **[INFO]** `spec/5-system/7-llm-client.md` — Rationale 섹션 부재
  - target 위치: `spec/5-system/7-llm-client.md` 전체 (## Rationale 섹션 없음)
  - 과거 결정 출처: 해당 없음 (Rationale 자체가 없음)
  - 상세: `7-llm-client.md` 는 RerankClient·RerankClientFactory 를 LLMClientFactory 와 분리한 이유("chat/embedding 팩토리 switch 오염 방지"), SSRF 가드 재사용 방침, `LLM_CONFIG_INVALID` 재사용 결정 등을 §4.1 주석으로만 기술하고 Rationale 섹션이 없다. 이번 구현(rag-rerank-impl)이 RerankClient 를 직접 구현하는 만큼, 설계 원칙이 spec 의 Rationale 자리에 공식화되어 있지 않으면 구현자가 편의상 LLMClientFactory 에 통합하거나 별도 에러 코드를 신설할 가능성이 있다.
  - 제안: `7-llm-client.md` 에 `## Rationale` 섹션을 추가하고 분리 결정 근거를 기록한다. 단, 본 검토의 주 충돌은 없으므로 필수가 아닌 권고.

---

### 요약

`spec/5-system/9-rag-search.md` 는 리랭킹 설계 결정(폐기 대안, v1 항상-grading 결정, pointwise 금지 근거)을 plan draft(`spec-draft-rag-reranking.md`)에 위임하고 있어 spec 자체에 `## Rationale` 섹션이 없다. 이는 CLAUDE.md 의 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 에 기록" 원칙과 어긋나며, plan 파일은 `complete/archive/` 이동 또는 삭제 후 접근 불가해질 수 있다. 현재 시점에서 기각된 대안(노드 단위 설정, 항상 리랭크, VectorChord)이 재도입되거나 합의된 원칙(완전 선택적·KB 소유권·graceful degradation)이 침해되는 구현상 충돌은 발견되지 않는다. 발견된 사항은 모두 Rationale 연속성 보완을 위한 INFO 등급이며, 구현 착수를 차단하는 CRITICAL/WARNING 은 없다.

### 위험도

LOW
