# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
검토 대상 target: `spec/5-system/9-rag-search.md` + 관련 구현 diff
기준 Rationale 출처: `spec/5-system/9-rag-search.md ## Rationale` / `plan/complete/spec-draft-rag-reranking.md ## Rationale`
검토 일시: 2026-06-06

---

## 발견사항

### [WARNING] `cross_encoder_llm` "항상 grading(v1)" → conditional escalate 번복 — Rationale 갱신 추적 필요

- **target 위치**: `spec/5-system/9-rag-search.md §3.3.2` v1 결정 항 + `## Rationale` "왜 D2 conditional escalate 를 지금 도입하나" 항
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §4.2` 및 `## Rationale` 의 "남은 결정 — 2026-06-04 확정" 항 ②: `cross_encoder_llm` = **항상 LLM grading(v1). 점수 기반 conditional escalate 의 정량 임계는 P0 평가셋 보정 후 후속 최적화.`
- **상세**: spec-draft-rag-reranking 의 Rationale 은 "v1 은 항상 grading, conditional escalate 는 후속"으로 합의됐다. 이번 구현(`rag-dynamic-cut`)은 그 결정을 **뒤집어** conditional escalate 메커니즘을 v1 에 도입한다. target spec 의 `§3.3.2 v1 결정 (2026-06-06 갱신)` 항과 `## Rationale "왜 D2 conditional escalate 를 지금 도입하나"` 항이 이 번복의 근거를 명시하고 있어 새 Rationale 자체는 작성됐다. 다만 `plan/complete/spec-draft-rag-reranking.md` 의 구 Rationale(항상 grading = v1)이 archive 로 보존되는 문서라 "기존 결정이 번복됐음"을 해당 문서에서 직접 확인하기 어려운 구조다.
- **평가**: 번복 근거("escalate 미발생 시 cross-encoder 결과 사용 = v1 부분집합 → 회귀 안전, 비용 보호용 단순화 폐기")가 target spec `## Rationale` 에 명시돼 있고, `plan/in-progress/rag-quality-improvement.md §7` 에도 `2026-06-06 재결정` 로그가 기록됐으므로 **치명적 누락은 없다**. 단, spec-draft(complete archive)와 target spec 의 두 Rationale 이 모순처럼 보일 수 있어 신규 코드 리더 혼선 위험이 있다.
- **제안**: `spec/5-system/9-rag-search.md §3.3.2 v1 결정` 항 바로 뒤에 `spec-draft-rag-reranking.md §4.2 의 "항상 grading(v1)" 결정을 2026-06-06 에 번복` 한 줄 cross-reference를 명시하면 탐색성이 높아진다. 또는 현재 `## Rationale "왜 D2 conditional escalate 를 지금 도입하나"` 항의 첫 문장에 `spec-draft §4.2 결정 번복` 을 괄호로 명시.

---

### [INFO] spec-draft Rationale 의 "off = 현행과 byte-identical 하위호환" 폐기 조항 — target 에 명시됨, 소비자 대응 명세 부재

- **target 위치**: `spec/5-system/9-rag-search.md ## Rationale` 의 "왜 완전 선택적(off 기본)인가" 항 내 "byte-identical 조항 폐기(D1, 2026-06-06)" 문단
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §1` 및 `## Rationale` 첫 항: "off = 현행과 byte-identical 하위호환"
- **상세**: byte-identical 조항 폐기 선언이 target spec Rationale 에 명시되어 있다. 그러나 off 경로에서 `LIMIT topK(5)` → `RAG_RECALL_K(50)` wide 회수 + app-layer 동적 컷으로 변경되므로 기존 검색 결과 순서/수량이 달라질 수 있다. 이 변화에 영향받는 downstream(디버그 컨트롤러, 멀티-KB 병합 경로, e2e fixture 등)에 대한 별도 migration 안내나 note 가 target spec 본문에는 없다.
- **제안**: target spec `§3.4` 또는 `§6` 에 `off 경로의 하위호환 변화 범위` 를 한 단락으로 명시(예: "기존 `ragTopK=5` 기본값 설정 사용자는 D1 이후 최대 12건까지 주입될 수 있음"). 필수는 아니나 운영 이관 시 유용.

---

### [INFO] `gradingNoGrounding` 진단 필드 신설 — spec-draft 에는 없었던 신규 항목, Rationale 명시 충분

- **target 위치**: `spec/5-system/9-rag-search.md §4.2 ragDiagnostics rerank 서브객체` 및 `§3.3.2`
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §8` 의 `ragDiagnostics.rerank` 스키마 — `gradingNoGrounding` 필드 없음
- **상세**: spec-draft 의 진단 스키마에 `gradingNoGrounding` 는 없었다. target spec 이 이 필드를 신설하면서 `§3.3.2`("grader '근거 없음' 전달" 항)·`§4.2`(gradingNoGrounding 설명)·`## Rationale "왜 D2 conditional escalate 를 지금 도입하나"` 에서 환각 억제 목적이 충분히 설명됐다. 스키마 증식이지만 단순 신설이라 기각된 대안 재도입이 아님.
- **제안**: `§4.2` 의 진단 schema 변경에 대해 `v1 breaking note` 또는 `Rationale "왜 별도 필드를 신설했나"` 한 항을 추가해 "`spec-draft` 에서 없었음을 명시"하면 추적성이 높아진다. 현재는 "진단 schema 증식 회피" 원칙을 언급하면서도 `gradingNoGrounding` 를 추가한 근거가 `§Rationale` 내에 분산됐다.

---

### [INFO] `ragTopK` 기본값(5) 제거 — spec-draft 의 `ragTopK = 리랭크 후 최종 청크 수` 의미 확장에서 선택적 상한으로 재해석, Rationale 추적됨

- **target 위치**: `spec/5-system/9-rag-search.md §2.1 KB tool 정의` `top_k` 항 + `## Rationale "왜 ragTopK 기본값(5)을 제거(optional)했나"` 항
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §5 config`: "`ragTopK` = **리랭크 후** 최종 청크 수(LLM override 가능)" + 기본값 5 유지
- **상세**: spec-draft 는 `ragTopK` 기본값 5 를 유지했으나, target spec `## Rationale` 의 해당 항이 D1 도입으로 '고정 기본 주입 수' 개념이 사라져 제거가 자연스러운 귀결임을 명시했다. 근거가 충분히 기록됐다.
- **제안**: 현재 상태 양호. 추가 조치 불필요.

---

### [INFO] 기각 대안 "cosine 임계 유지한 채 리랭크" vs "off 경로 cosine θ 유지" 혼동 가능성

- **target 위치**: `spec/5-system/9-rag-search.md ## Rationale "왜 θ 를 SQL/rerank 게이트로 유지했나"` 항
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md ## Rationale` 폐기 대안: "cosine 임계 유지한 채 리랭크: wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감. 기각"
- **상세**: spec-draft 의 기각 대안("cosine 임계 유지한 채 리랭크")은 `rerank_mode ≠ off` 경로에서 cosine θ 를 wide 회수에도 적용하는 것이었다. target spec `## Rationale`은 "off 경로 cosine θ 유지" 가 이 기각 대안과 **별개**임을 명시(`§Rationale "왜 θ 를 SQL/rerank 게이트로 유지했나"` 항)했다. 오해 방지 처리가 이미 됐다.
- **제안**: 현재 명시 수준 양호. 추가 조치 불필요.

---

## 요약

이번 구현(`rag-dynamic-cut`)이 target spec 에 반영한 결정들 중 Rationale 연속성 측면에서 가장 유의미한 이슈는 `cross_encoder_llm` 의 "항상 grading(v1)" 에서 "conditional escalate 메커니즘 즉시 도입"으로의 번복이다. 이 번복에 대한 새 Rationale 은 target spec `§3.3.2` 및 `## Rationale "왜 D2 conditional escalate 를 지금 도입하나"` 항에, 그리고 `plan/in-progress/rag-quality-improvement.md §7`의 2026-06-06 재결정 로그에 이중으로 기록돼 있어 치명적 누락은 없다. byte-identical 하위호환 조항 폐기도 Rationale에 명시됐다. `ragTopK` 기본값 제거와 `gradingNoGrounding` 신설 모두 충분한 근거가 기록됐다. 다만 archive 문서(`spec-draft`)와 최신 target spec의 Rationale이 상충처럼 보이는 구조는 신규 독자에게 혼선 위험이 있으므로, `§3.3.2 v1 결정` 항에 "spec-draft §4.2 항상 grading 결정을 2026-06-06 번복" cross-reference 1줄 추가를 권고한다. 전반적으로 Rationale 연속성은 확보돼 있으며 기각된 대안의 무근거 재도입이나 합의된 invariant 위반은 발견되지 않았다.

---

## 위험도

LOW
