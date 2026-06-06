# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
대상 spec: spec/5-system/9-rag-search.md  
관련 spec: spec/4-nodes/3-ai/1-ai-agent.md

---

## 발견사항

### 1. [CRITICAL] `off` 경로 `byte-identical 하위호환` 약속 파기 — D1 이 `off` 경로 동작을 변경

- **target 위치**: 구현 대상 영역 기술문 "D1 — 점수 기반 동적 컷" 절 (off 경로를 wide 회수 + app-layer 동적 컷으로 교체)
- **과거 결정 출처**: `spec/5-system/9-rag-search.md` §3.3.1 모드 표 및 Rationale 첫 번째 항
  - §3.3.1: `off (기본) | 후처리 없음 — §3.1 SQL 그대로 (cosine 임계 + topK). **현행과 byte-identical (하위호환)**`
  - Rationale: `off 기본은 (a) 하위호환 byte-identical (b) 리랭커 없는 배포에서도 제품 동작`
- **상세**: 기존 spec 의 `off` 경로는 `§3.1 SQL 그대로(cosine 임계 + topK)`로 정의되어 있고, "현행과 byte-identical(하위호환)" 이 명시적으로 합의된 invariant 다. D1 은 `off` 경로를 "wide 회수(내부 상수 ~50) → app-layer 동적 컷(token-budget ~8000 + inject-cap ~12)" 으로 교체하므로 `off` 경로의 반환 결과가 달라진다. 즉 기존 동작과 byte-identical 하지 않은 변화가 `rerank_mode='off'` 경로에 도입된다. 이는 spec 이 명시적으로 보장한 하위호환 invariant 를 구현 시 파기하는 것이다.
- **제안**: 두 가지 해소 경로 중 하나 선택 필요.
  1. **Rationale 갱신 방식**: `spec/5-system/9-rag-search.md` §3.3.1 표의 `off` 설명 및 Rationale 첫 항의 `byte-identical` 문구를 "D1 동적 컷 도입 이후 off 경로는 wide 회수 + app-layer 동적 컷을 수행하며, 구 `§3.1 SQL + top-5 고정` 동작과 byte-identical 하지 않다" 로 명시적으로 번복 기술. `byte-identical` 약속이 이제는 "app-layer 컷 이후 결과 순서·내용이 동일" 이 아니라 "reranker 인프라 의존 없음" 으로 재해석됨을 명문화.
  2. **범위 제한 방식**: D1 을 `off` 경로에 적용하지 않고 `cross_encoder`/`cross_encoder_llm` 경로에만 추가 (wide 회수는 이미 해당 경로에 존재). `off` 경로는 §3.1 SQL 고정 그대로 유지.

---

### 2. [WARNING] `ragTopK` `.default(5)` 제거 — 기존 config 표와 Rationale I4 의 "사용자/LLM 노출 유지" 의도 경계 모호

- **target 위치**: 구현 대상 영역 기술문 "ragTopK 의미 변경" 절 (`zod .default(5)` 제거 → `.optional()`, 미지정 시 dynamic cut 의 inject-cap(12) 지배)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표 (`ragTopK | Integer | | 5 | ...`) 및 `spec/5-system/9-rag-search.md` §3.1 파라미터 표 (`$4 | 최대 결과 수 (topK) | LLM 호출 인자 또는 5`), Rationale I4 맥락(`신규 config 필드 증식 회피`·`ragThreshold 재해석 선례와 일관`)
- **상세**: 기존 spec 에서 `ragTopK` default=`5` 는 명시된 기본값이다. `.optional()` 로 변경하고 미지정 시 "inject-cap(12) 까지 dynamic cut 지배" 로 재해석하면, 현재 `ragTopK=5` 로 저장된 노드 config 는 명시 값이 있으므로 `ceiling override` 로 처리되어 영향이 없지만, 신규 노드(or `ragTopK` 미설정 노드)는 inject-cap(12) 을 ceiling 으로 쓰게 된다. 이는 기존 합의인 "사용자/LLM 노출 상한을 ragTopK(기본 5) 로 표현한다" 의 의미를 변경한다. Rationale I4 는 "신규 config 필드 증식 회피" 를 원칙으로 한다 — 필드 제거(optional 화) 자체는 그 원칙과 충돌하지 않지만, `ragTopK` 의 **의미**(사용자 설정 상한 → dynamic cut ceiling override) 가 변경되는 것은 Rationale 갱신이 필요한 범주다. spec 에 이 의미 변경의 근거가 없는 상태로 구현에 들어가면 spec-impl 불일치가 발생한다.
- **제안**: 구현 착수 전 `spec/5-system/9-rag-search.md` §3.3.2 흐름 및 `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표에 `ragTopK` 미설정 시 dynamic cut ceiling(inject-cap) 지배 동작을 기술하고, Rationale 에 "`ragTopK` 의 `.default(5)` 를 제거해 미지정 상태를 dynamic cut 에 위임한 이유" 항목을 명시. 번복이므로 "왜 v1 기본값(5)을 버리는가" 의 근거를 spec Rationale 에 기재해야 한다.

---

### 3. [WARNING] D2 `cross_encoder_llm` 의 "항상 LLM grading" → "conditional escalate" 번복 — 새 Rationale 부재

- **target 위치**: 구현 대상 영역 기술문 "D2 — listwise escalate 메커니즘" 절 (`cross_encoder_llm` 의 항상-LLM-grading(v1) → conditional escalate)
- **과거 결정 출처**: `spec/5-system/9-rag-search.md` §3.3.1 모드 표 및 §3.3.2 흐름 3번 항목
  - §3.3.1: `` `cross_encoder_llm` | `cross_encoder` 후 **항상** listwise LLM grading 1콜 추가 ``
  - §3.3.2: `` [cross_encoder_llm 만] survivors(~15) listwise LLM grading 항상 수행 ``
  - §3.3.2 주석(v1 결정): `` `cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, 정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입) ``
- **상세**: spec §3.3.2 의 v1 결정은 conditional escalate 를 명시적으로 "P0 후속" 으로 기각하고 v1 범위에서는 항상 LLM grading 을 수행한다고 결정했다. 구현 대상 기술문은 이 결정을 번복해 conditional escalate 를 v1 에서 구현한다고 한다. 번복 자체는 "본 변경은 그 후속 메커니즘 도입" 이라고 설명하지만, spec Rationale 에 새 결정의 근거(왜 지금 도입하는가, v1 결정의 "P0 평가셋 확보 후" 조건이 충족됐는가)가 기록되지 않은 채 구현에 들어가는 것은 "결정의 무근거 번복" 에 해당한다.
- **제안**: 구현 착수 전 `spec/5-system/9-rag-search.md` §3.3.1·§3.3.2 및 Rationale 를 갱신해 conditional escalate 도입의 근거(평탄/모호 판정 로직의 합의된 임계 또는 "정량 임계 A/B 는 후속 확정" 명시)를 기록. "정량 임계 A/B 확정은 follow-up" 이라면 그 사실도 Rationale 에 명시해 이번 PR 에서 무엇을 결정하고 무엇을 미루는지를 spec 이 추적하도록.

---

### 4. [INFO] `ragDiagnostics.rerank.llmGradingApplied` 필드 — conditional escalate 도입 시 의미 갱신 필요

- **target 위치**: `spec/5-system/9-rag-search.md` §4.2 `rerank` 서브객체 (`llmGradingApplied: false` 예시)
- **과거 결정 출처**: §4.2 ragDiagnostics 정의 (구현됨)
- **상세**: `llmGradingApplied` 는 항상 LLM grading 을 수행하는 v1 에서는 `cross_encoder_llm` 이면 항상 `true` 였다. D2 conditional escalate 도입 후에는 "모호/평탄 여부에 따라 false 가 될 수 있다" 는 의미로 달라진다. 현재 spec 설명이 이 변화를 반영하지 않으면 진단 필드 해석이 달라질 수 있다.
- **제안**: D2 구현 시 §4.2 `llmGradingApplied` 설명을 "conditional escalate 시 평탄/모호 판정 결과에 따라 `false` 가 될 수 있음" 으로 보완 (spec 본문 갱신 사항으로 planner 에 전달).

---

## 요약

이번 구현 대상(D1 동적 컷 + D2 conditional escalate)은 기존 spec 의 두 가지 명시 약속을 번복한다. (1) D1 이 `rerank_mode='off'` 경로에 `byte-identical 하위호환` 약속을 파기한다 — 이는 spec §3.3.1 과 Rationale 에 명문화된 invariant 로 CRITICAL 수준이다. (2) D2 conditional escalate 는 spec §3.3.2 가 "P0 후속" 으로 명시 기각한 대안을 새 Rationale 없이 도입한다. (3) `ragTopK .default(5)` 제거는 기존 config 표와 충돌하는 의미 변경이다. 세 사항 모두 구현 착수 전 spec Rationale 갱신(또는 설계 재조정)이 필요하다. 특히 D1 의 `off` 경로 변경은 셀프호스팅 하위호환 원칙을 직접 훼손하므로 planner 를 통한 spec 명시 갱신 없이 구현에 진입하면 차단 사유가 된다.

---

## 위험도

**HIGH**
