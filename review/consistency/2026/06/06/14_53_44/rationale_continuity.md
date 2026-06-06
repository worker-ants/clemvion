# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-rag-dynamic-cut.md`
검토 기준 spec:
- `spec/5-system/9-rag-search.md` §Rationale (현행)
- `plan/complete/spec-draft-rag-reranking.md` §Rationale (기존 결정 아카이브)
- `plan/in-progress/rag-quality-improvement.md` §6 (결정 로그)

---

## 발견사항

### 발견사항 1

- **[WARNING]** D2 conditional escalate 번복 — Rationale 갱신은 있으나 기존 결정 출처 명시가 draft 본문에 없음
  - target 위치: `§A4 v1 결정 bullet 갱신` / `§A8 "왜 D2 conditional escalate 를 지금 도입하나"`
  - 과거 결정 출처:
    - `plan/complete/spec-draft-rag-reranking.md` §Rationale 항목 ② "cross_encoder_llm = **항상 LLM grading**(v1). 점수 기반 conditional escalate 의 정량 임계는 P0 평가셋 보정 후 후속 최적화."
    - `spec/5-system/9-rag-search.md` §3.3.2 v1 결정 라인 195 ("항상 LLM grading 을 수행한다")
    - `plan/in-progress/rag-quality-improvement.md` §6 라인 172 ("2026-06-04 확정: 항상 LLM grading(v1)")
  - 상세: 위 세 곳 모두 "v1 은 항상 grading, conditional escalate 는 P0 보정 후 후속" 으로 명시적으로 결정 및 기록했다. target draft 는 이를 이번 PR 에서 번복해 conditional escalate 메커니즘 자체를 도입한다. §A8 에 새 Rationale("escalate 진입 구조는 데이터 무관 안전")을 제공하고 있고, §A4 의 W7/I5 반영항에서 기존 결정 출처를 **명시적으로 인용**하라고 지시한다. 그러나 이 인용·폐기 선언이 draft 의 `§A8` 본문에만 지시("…에 기존 v1 결정 출처를 명시적으로 인용하고")되어 있을 뿐, draft 자체가 실제로 그 인용을 작성해 두지는 않았다. 즉, spec 편집 시 반드시 해당 인용을 포함해야 한다는 지시 수준에 머물러 있어 이행 여부가 편집자 재량에 달린 상태다.
  - 제안: §A8 "왜 D2 conditional escalate 를 지금 도입하나" 항목 내에, 폐기하는 기존 결정의 원문 출처(`spec-draft-rag-reranking.md §Rationale ②`, `rag-search.md §3.3.2 v1 결정`, `rag-quality-improvement.md §6 라인 172`)를 draft 본문에 직접 인용 문구로 삽입하여 spec 편집 시 편집자가 생략할 수 없도록 확정하라.

---

### 발견사항 2

- **[WARNING]** off 모드 `byte-identical` 조항 폐기 — 기존 Rationale 핵심 문구를 명시 폐기하나 draft 본문에 폐기 선언이 지시 형태로만 존재
  - target 위치: `§A3 §3.3.1 모드 표 off 행 갱신` / `§A8 "왜 완전 선택적(off 기본)인가" 갱신` / `W8/I6 반영항`
  - 과거 결정 출처:
    - `spec/5-system/9-rag-search.md` §3.3.1 라인 178 ("현행과 byte-identical (하위호환)")
    - `plan/complete/spec-draft-rag-reranking.md` §Rationale "왜 완전 선택적(off 기본)인가" 항목 "(a) 하위호환 byte-identical"
  - 상세: 기존 Rationale 의 세 가지 근거 중 (a)가 "byte-identical" 이었다. D1 도입 시 off 모드도 동적 컷(token-budget + inject-cap)을 거치게 되어 byte-identical 은 더 이상 성립하지 않는다. target draft 의 W8/I6 항목에서 이를 인식하고 폐기 선언을 지시하고 있다. 그러나 이 역시 draft 본문의 "실제 §A8 Rationale 텍스트"가 아닌 "편집 지시" 형태다. spec 편집자가 §A8 갱신 시 byte-identical 폐기 선언을 누락할 경우 기존 Rationale 의 (a) 조항과 신규 동작이 충돌하게 된다. §A3 에서 spec 표 텍스트는 이미 "(D1 이전: 고정 LIMIT topK. 동적 컷은 cosine 점수 위 app-layer 후처리라 리랭커 불요)"로 갱신되어 있어 표 본문에서는 변경이 반영됐으나, Rationale 절의 명시 폐기 선언은 지시 수준에 머무른다.
  - 제안: §A8 "왜 완전 선택적(off 기본)인가" 갱신 항목에, 리랭킹 spec 의 byte-identical 조항을 폐기한다는 선언("`spec-draft-rag-reranking.md §Rationale` 의 (a) 'byte-identical' 근거 폐기")을 draft 본문에 확정 텍스트로 기재하라. W8/I6 반영 지시만으로는 편집 시 생략 위험이 있다.

---

### 발견사항 3

- **[INFO]** off 모드에서 cosine θ 유지 — 기각된 대안("cosine 임계 유지한 채 리랭크")과의 관계 명확화 필요
  - target 위치: `§A2 §3.1 분기 노트 갱신`, `§A3 off 행 신규 설명`
  - 과거 결정 출처: `plan/complete/spec-draft-rag-reranking.md` §Rationale "폐기한 대안" 항목 "cosine 임계 유지한 채 리랭크: wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감. 기각"
  - 상세: 기각된 대안은 "rerank_mode ≠ off 경로에서 wide 회수 전에 cosine θ 를 적용하는 것"이었다. target 의 §A2 에서 off 경로에는 cosine θ 를 유지한다고 명시하고 있는데, 이는 외형상 기각 대안("cosine 임계 유지한 채 리랭크")과 표면이 겹쳐 보인다. draft §A8 끝에서 "(off cosine θ 유지는 기각된 대안과 별개 — off 에는 리랭커가 없어 cosine θ 가 유일 관련성 게이트라 제거 대상 아님)"이라고 구분 설명을 추가하도록 지시하고 있어 인식은 되고 있다. 그러나 이 설명이 draft 내 확정 텍스트가 아닌 지시 수준이므로, 실제 §A8 에 "off 에서의 cosine θ 유지가 기각 대안과 다른 맥락임"을 명기해야 한다.
  - 제안: §A8 Rationale 에 "off 모드의 cosine θ 유지는 기각 대안('cosine 임계 유지한 채 리랭크', `spec-draft-rag-reranking.md §Rationale 폐기 대안`)과 별개 — off 경로에는 리랭커가 없으므로 cosine θ 가 유일 관련성 게이트"라는 문구를 확정 텍스트로 포함하라.

---

### 발견사항 4

- **[INFO]** `ragTopK` 기본값 제거 — 기존 ragTopK=5 합의 결정의 변경 근거가 draft Rationale 에 포함되어 있음(정합)
  - target 위치: `§B1 ragTopK 행 기본값 제거`, `§A8 "왜 ragTopK 기본값(5)을 제거했나"`
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 40 (ragTopK 기본값 `5`), `spec/4-nodes/3-ai/0-common.md` 라인 45 (ragTopK 기본 5)
  - 상세: 기존 spec 에서 ragTopK 는 기본값 `5` 로 고정되어 있었다. target 은 이를 "선택적 상한 override"로 전환하면서 고정 기본값을 제거한다. §A8 에 명시적 Rationale("동적 컷 도입으로 '고정 기본 주입수' 개념이 사라짐")을 함께 작성하도록 지시되어 있어 번복 근거가 동반된다. Rationale 연속성 관점에서는 양호하나, `memoryTopK`(기본5, persistent 전용)와의 독립성 서술(§D)도 일관되어 이 변경은 합의 원칙 위반 없이 처리되고 있다.
  - 제안: 현재 draft 수준에서 Rationale 연속성 관점의 추가 조치 불필요. spec 편집 시 §A8 해당 항목 누락 여부만 확인하라.

---

### 발견사항 5

- **[INFO]** `ragThreshold` 재해석 선례와의 일관성 — 신규 Rationale 항목이 선례를 명시 인용하고 있음(정합)
  - target 위치: `§A8 "왜 회수폭/예산/ceiling 을 내부 상수로 두나"`
  - 과거 결정 출처: `spec/5-system/9-rag-search.md` §Rationale "왜 ragThreshold 의미를 재해석했나" (신규 노드 config 필드 증식 회피)
  - 상세: target 이 RAG_RECALL_K·RAG_INJECT_TOKEN_BUDGET·RAG_MAX_INJECT_COUNT 를 내부 상수로 두고 config 필드를 신설하지 않는 이유에 "ragThreshold 재해석 선례와 일관"이라고 명시하여 기존 Rationale 원칙과의 계통을 유지하고 있다. 이는 기존 합의 원칙("신규 노드 config 필드 증식 회피")의 **연속적 적용**이므로 Rationale 연속성 관점에서 정합하다.
  - 제안: 현재 draft 수준에서 추가 조치 불필요.

---

## 요약

target draft 는 두 가지 기존 결정(v1 항상-grading 원칙, off 모드 byte-identical 조항)을 의도적으로 번복하면서 새로운 Rationale 을 동반하고 있다. 번복 사실을 인식하고 기존 결정 출처 인용 및 폐기 사유 명기를 지시하고 있으나, 이 지시들이 draft 내 "확정 Rationale 텍스트"가 아닌 "편집 지시(W7/I5, W8/I6)" 형태로만 존재한다. spec 실제 편집 시 해당 인용·폐기 선언이 누락되면 `spec/5-system/9-rag-search.md`의 기존 Rationale(`v1 결정`, `byte-identical` 조항)과 신규 동작이 충돌하는 상태가 된다. 이를 방지하기 위해 draft 본문에서 해당 Rationale 갱신 텍스트를 지시가 아닌 확정 문안으로 명기하는 것이 권장된다. 기각된 대안(cosine 임계 유지한 채 리랭크)과의 관계 명확화도 같은 이유로 보완이 필요하다. ragTopK 기본값 제거 및 내부 상수 정책은 기존 합의 원칙의 연속적 적용으로 Rationale 연속성 관점에서 정합하다. CRITICAL 수준의 위반(명시적으로 기각된 대안의 이유 없는 재채택, invariant 직접 위반)은 발견되지 않았다.

## 위험도

MEDIUM
