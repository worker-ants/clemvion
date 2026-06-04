# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-rag-reranking.md`
**검토 기준 spec**: `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/4-nodes/3-ai/1-ai-agent.md`

---

## 발견사항

### 1. **[WARNING]** `cross_encoder_llm` LLM grading 트리거 조건 불일치

- **target 위치**: draft §4.2 — "`cross_encoder` 수행 후 survivors(~15개)에 listwise LLM grading 을 **항상** 1콜 수행 (조건부 escalate 없음)"
- **충돌 대상**: `spec/5-system/9-rag-search.md §3.3.2` (이미 반영된 spec) — 흐름 3단계에서 `"[cross_encoder_llm] escalate 조건(① cross-encoder 상위 점수 평탄/모호 ② 정책·지시 판단 KB) **충족 시**"로 기술 — 즉 조건부 escalate
- **상세**: draft §4.2 Rationale 에서 "v1 확정: 항상 수행"으로 결정이 확정됐고, 동시에 "(후속 최적화) 점수 평탄/모호 기반 conditional escalate"를 미래 과제로 명시했다. 그러나 이미 spec 에 반영된 `9-rag-search.md §3.3.2` 는 아직 구 draft 의 "escalate 조건 충족 시" 문구를 그대로 보유하고 있다. 두 문서가 같은 `cross_encoder_llm` 흐름을 상반되게 기술하고 있어 구현자가 어느 것을 따라야 할지 모호하다.
- **제안**: `spec/5-system/9-rag-search.md §3.3.2` 단계 3을 "항상 1콜 수행 (v1; conditional escalate 는 후속 최적화)"로 수정해 draft §4.2 v1 결정과 일치시킨다. draft §10 의 반영 완료 주석에도 이 항목이 누락되어 있으므로 함께 보완한다.

---

### 2. **[WARNING]** `LLMClient.rerank?()` vs `RerankClient` 별도 인터페이스 불일치

- **target 위치**: draft §6 — "`LLMClient` 에 선택적 `rerank()` 추가" (`rerank?(query, documents, model?, opts?): Promise<...>`)
- **충돌 대상**: `spec/5-system/7-llm-client.md §3.6` — `RerankClient` 를 **별도 인터페이스**로 정의 (`LLMClient` 와 분리); `§4.1 RerankClientFactory` 별도 팩토리
- **상세**: draft §10 의 반영 완료 메모가 "I1(LLMClient 오염 방지 → `RerankClient`/`RerankClientFactory` 별도 인터페이스 경로)" 를 반영했다고 명시한다. 실제 spec `7-llm-client.md §3.6·§4.1` 도 별도 `RerankClient`/`RerankClientFactory` 구조로 이미 반영되어 있다. 그러나 draft §6 본문은 아직 `LLMClient` 에 `rerank?()` 를 선택적 메서드로 추가하는 구 설계를 그대로 기술하고 있어, 구현자가 draft §6 을 참조하면 틀린 인터페이스로 구현할 수 있다.
- **제안**: draft §6 을 "`RerankClient` 별도 인터페이스 (LLM Client §3.6) 를 통해 호출"로 갱신하거나, draft §10 의 반영 메모에 "§6 은 I1 반영으로 spec §3.6/§4.1 로 대체됨" 주석을 추가한다.

---

### 3. **[INFO]** `spec/5-system/7-llm-client.md §4.1 RerankClientFactory` — 1차 구현 범위 미표기

- **target 위치**: draft §2.2 — 1차 구현 provider: `tei` + `cohere` 2종; `jina`/`voyage`/`local`/`builtin` 은 Planned
- **충돌 대상**: `spec/5-system/7-llm-client.md §4.1 RerankClientFactory` — switch case 에 `cohere`/`jina`/`voyage`/`tei`/`local` 5종이 모두 등재
- **상세**: spec §4.1 의 코드 예시는 1차 구현과 Planned 범위를 구분 없이 나열한다. draft 가 "1차: tei+cohere" 를 명시하지만 spec 에는 그 경계가 보이지 않아 구현 범위를 결정하는 개발자에게 혼선을 줄 수 있다.
- **제안**: spec `7-llm-client.md §4.1` 코드 예시에서 `jina`/`voyage`/`local` case 옆에 `// Planned` 주석을 추가해 1차 구현 범위를 명시한다.

---

### 4. **[INFO]** `rerank_llm_config_id` FK 대상 일치 확인

- **target 위치**: draft §2.1 `rerank_llm_config_id` — "워크스페이스 default chat LLM"
- **충돌 대상**: `spec/1-data-model.md §2.11` — `rerank_llm_config_id UUID? FK → LLMConfig`
- **상세**: 일치함. draft 와 반영 spec 모두 `rerank_llm_config_id` 가 `LLMConfig` FK 를 참조한다. 충돌 없음.
- **제안**: 이상 없음.

---

## 요약

target 문서(spec-draft-rag-reranking.md)는 이미 `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 에 대부분 반영 완료된 상태다. 구조적 엔티티 모순이나 API 계약 충돌은 없다. 두 가지 WARNING 이 존재한다: (1) `cross_encoder_llm` 의 LLM grading 트리거가 draft 에서는 "항상(v1 확정)"으로 결정됐지만 이미 반영된 spec `9-rag-search.md §3.3.2` 에는 아직 "escalate 조건 충족 시"라는 구 표현이 잔존해 구현 지침이 상충한다. (2) draft §6 이 구 설계(`LLMClient.rerank?()`)를 그대로 보유하고 있어 이미 반영된 별도 `RerankClient` 인터페이스(`7-llm-client.md §3.6`)와 충돌한다. 두 항목 모두 spec 또는 draft 의 해당 절을 짧은 수정으로 정렬할 수 있으며, 구현 차단 수준은 아니다.

---

## 위험도

MEDIUM
