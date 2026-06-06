# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상 spec: `spec/5-system/9-rag-search.md` (§3.1 SQL, §3.3 컷 정책/흐름, Rationale), `spec/4-nodes/3-ai/1-ai-agent.md` (ragTopK/ragThreshold config default)
검토일: 2026-06-06

---

## 발견사항

### [WARNING] D1 off 경로 변경이 §3.3.1 "byte-identical 하위호환" 약속과 충돌
- target 위치: 구현 계획 D1 — "off 경로를 wide 회수(내부 상수 ~50, θ 게이트는 SQL 유지) → app-layer 동적 컷(token-budget ~8000 + inject-cap ~12)으로 교체"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.3.1 모드 표 `off` 행
  - 현행 spec: `off` (기본) = "후처리 없음 — §3.1 SQL 그대로 (cosine 임계 + topK). **현행과 byte-identical (하위호환)**"
  - Rationale: "`off` 기본은 (a) 하위호환 byte-identical (b) 리랭커 없는 배포에서도 제품 동작"
- 상세: 구현 계획 D1은 `rerank_mode='off'` 경로에서 `ORDER BY score DESC LIMIT topK` SQL 직접 컷을 wide 회수(~50) → app-layer 동적 컷으로 교체한다. 이는 결과 집합을 byte-identical 하게 만들지 않는다 — wide 회수 후 token-budget/inject-cap 으로 자르면 기존 LIMIT topK 와 동일 결과가 보장되지 않는다(특히 topK=5 기본 시 기존에는 정확히 5개, 신규는 최대 12개 또는 token-budget 기준 가변). 따라서 현행 spec 의 "byte-identical" 약속을 D1 이 파기하게 된다. 그러나 구현 계획 자체는 이 변경을 의도적으로 인지하고 있으며("'off=byte-identical 하위호환' 약속을 D1 이 변경하는 점의 정합성" 검토 요청) 실질적 모순이다.
- 제안: 구현 착수 전 spec 을 갱신해야 한다. 두 가지 옵션 중 하나를 선택:
  1. `off` 행의 "byte-identical" 문구를 제거하고, off 경로에서도 token-budget/inject-cap 동적 컷이 적용됨을 명시한 뒤 Rationale I4 를 갱신. 이 경우 `off` 는 "리랭커 의존성 없음"의 의미만 유지.
  2. `off` 는 byte-identical 하위호환을 유지하고, D1 의 적용 범위를 `rerank_mode ≠ off` 경로에만 한정 (off 경로의 wide 회수 변경 포기). 이 경우 off 경로 개선 효과가 없어진다.
  어느 쪽이든 spec 본문 갱신은 구현 착수 전에 `project-planner` 가 수행해야 한다.

---

### [WARNING] ragTopK .default(5) 제거 → .optional() 변경이 ai-agent spec 및 0-common.md 와 충돌
- target 위치: 구현 계획 — "ai-agent.schema.ts 의 ragTopK zod `.default(5)` 제거 → `.optional()`. 미지정 시 dynamic cut 가 내부 inject-cap(12)까지 지배, LLM top_k 또는 노드 ragTopK 명시 시 그 값이 ceiling override"
- 충돌 대상 1: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표
  - 현행 spec: `ragTopK | Integer | | `5` | KB tool 호출 시 반환할 청크 수의 기본값`
  - 기본값이 `5` 로 명시되어 있으며 optional 이 아니다.
- 충돌 대상 2: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/0-common.md` §2
  - 현행 spec: `ragTopK | Integer | RAG 검색 결과 수 (기본: 5)`
- 충돌 대상 3: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.1 SQL 파라미터 표
  - `$4` (최대 결과 수) 기본값: "LLM 호출 인자 또는 5"
- 충돌 대상 4: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §2.1 KB tool 정의
  - `top_k` 파라미터 description: `"Default: <ragTopK>"` — ragTopK 가 필수 기본값 소스임을 전제
- 상세: 구현 계획은 ragTopK 를 optional 로 만들고 미지정 시 inject-cap(12)가 지배한다고 한다. 그러나 현행 spec 4개 위치에서 ragTopK 기본값이 `5` 로 고정되어 있다. 변경 후 미지정 시 동작(inject-cap=12 ceiling)이 기존 "기본값 5" 와 다르므로 기존 KB tool description 에서 `"Default: <ragTopK>"` 로 LLM 에 전달되는 default 표현도 달라진다. KB tool definition 의 `top_k` description 이 "Default: undefined(없음) — dynamic cut 이 결정" 으로 바뀌어야 하는데 spec 에는 기술이 없다.
- 제안: 구현 착수 전 spec 3개 파일을 갱신:
  - `spec/4-nodes/3-ai/1-ai-agent.md` §1: ragTopK 기본값 `5` 를 제거하고 "미지정 시 dynamic cut inject-cap(12) ceiling 이 지배, LLM top_k 또는 명시 시 그 값이 ceiling" 으로 교체
  - `spec/4-nodes/3-ai/0-common.md` §2: 동일 취지로 동기화
  - `spec/5-system/9-rag-search.md` §2.1 KB tool 정의의 `top_k` description 및 §3.1 SQL `$4` 기본값 기술 갱신

---

### [WARNING] D2 listwise conditional escalate 도입이 §3.3.1 v1 결정과 충돌
- target 위치: 구현 계획 D2 — "cross_encoder_llm 의 항상-LLM-grading(v1)을 conditional escalate(cross-encoder 상위 점수 평탄/모호 시에만 listwise grading)로 정밀화"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.3.1 v1 결정 및 §3.3.2 흐름
  - 현행 spec §3.3.1: "`cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, 정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입)"
  - 현행 spec §3.3.2 흐름 step 3: "[cross_encoder_llm 만] survivors(~15) listwise LLM grading **항상** 수행"
  - `plan/in-progress/rag-rerank-followup.md`: "conditional escalate 정량 임계 — P0 평가셋 보정 후 도입" 항목이 현재 미완료 `[ ]` 상태
- 상세: D2 구현은 "항상 grading" 을 "conditional escalate(점수 평탄/모호 시에만)" 으로 변경한다. 이는 spec §3.3.1 의 "v1 결정" (항상 LLM grading) 과 Rationale 의 "conditional escalate 는 P0 후속" 설명을 정면으로 변경하는 것이다. `rag-rerank-followup.md` 의 pending 항목 "conditional escalate 정량 임계 — P0 평가셋 보정 후 도입" 도 아직 열려 있으며, 이를 P0 평가셋 확보 전에 구현하면 plan 과 spec 의 선결 조건 정합성이 깨진다.
- 제안: D2 를 구현하려면 먼저:
  1. spec §3.3.1 의 "v1 결정" 및 §3.3.2 step 3 의 "항상 수행" 문구를 "conditional escalate" 기반으로 갱신
  2. Rationale 의 "conditional escalate 는 P0 후속" 문구를 "본 변경으로 도입, 정량 임계 A/B 확정은 후속" 으로 갱신
  3. `rag-rerank-followup.md` 의 해당 항목을 `[~]` 또는 `[x]` 로 상태 갱신
  이를 `project-planner` 가 수행하기 전에 D2 구현 착수를 차단해야 한다.

---

### [INFO] dynamic-cut.ts applyDynamicCut 의 tokenBudget ~8000 이 ai-agent.md memoryTokenBudget 과 동일 상수 공유 가능성
- target 위치: 구현 계획 D1 — "app-layer 동적 컷(token-budget ~8000 + inject-cap ~12)"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §1 `memoryTokenBudget | Integer | | `8000``
- 상세: 구현 계획에서 token-budget 상수로 ~8000 을 사용하는데, 이는 memoryTokenBudget 기본값 8000 과 같다. 두 개념은 서로 독립적이다 — RAG 주입 token budget 은 "KB tool 결과로 LLM 컨텍스트에 주입할 청크 토큰 상한"이고, memoryTokenBudget 은 "대화 working-memory 압축 예산"이다. 코드에서 이 두 상수가 같은 기본값으로 혼용되면 혼선이 생길 수 있다. 명명·코드 분리를 명시하는 것이 바람직하다.
- 제안: spec 갱신 시 RAG token-budget 상수를 `ragInjectTokenBudget` 등 별도 이름으로 명시하거나, 코드 상수와 spec 에서 명시적으로 분리를 언급해 혼동을 방지한다.

---

### [INFO] dynamic-cut.ts 의 tokenBudget 토큰 추정 방식 — text-chunker.estimateTokens(char/3) 재사용 vs ai-agent language-aware 휴리스틱 불일치
- target 위치: 구현 계획 D1 — "토큰 추정은 chunking/text-chunker.estimateTokens(char/3) 재사용"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.5 — "토큰 추정은 균일 `char/3` 이 아니라 **language-aware 휴리스틱** (스크립트군별 chars-per-token 가중: Latin/ASCII ~4, CJK 한·중·일 ~1.7, 그 외 ~3)"
- 상세: ai-agent memory 의 token budget 추정은 language-aware 휴리스틱을 쓰고, D1 의 RAG inject token budget 추정은 text-chunker 의 char/3 균일 방식을 재사용한다. 두 경로가 같은 콘텍스트 공간에서 서로 다른 추정 방식을 쓰면 한국어 텍스트에서 실제 주입 토큰 수가 과대/과소 추정될 수 있다. spec §6.1 단계 1.5 에는 "KB 청킹의 char/3 추정 (`text-chunker`) 과는 별개 경로다" 라는 주석이 있어 의도적 분리임이 명시되어 있다. 모순은 아니나 일관성 차원에서 명시 필요하다.
- 제안: spec 갱신 시 dynamic-cut 의 tokenBudget 추정이 char/3 균일 추정임을 명시하고, language-aware 방식(ai-agent memory 경로)과 의도적으로 분리된 근거(청킹 단위는 이미 embedding 시 균일 처리됨 등)를 spec 에 기술.

---

## 요약

Cross-Spec 일관성 관점에서 이번 구현 계획(D1 동적 컷, D2 listwise escalate, ragTopK optional 화)은 두 개의 의미 있는 충돌을 갖는다. 첫째, D1 의 `off` 경로 wide 회수 변경은 `spec/5-system/9-rag-search.md §3.3.1` 의 "byte-identical 하위호환" 약속을 파기하므로 spec 선갱신 없이 구현하면 두 spec 영역이 모순된다. 둘째, ragTopK 의 `.default(5)` 제거는 `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/0-common.md §2`, `spec/5-system/9-rag-search.md §2.1·§3.1` 총 4개 위치의 기본값 정의와 충돌한다. 셋째, D2 의 conditional escalate 도입은 `spec/5-system/9-rag-search.md §3.3.1 v1 결정` 및 `plan/in-progress/rag-rerank-followup.md` 의 "P0 후속" 전제를 깨며 plan 선결 조건 정합성을 훼손한다. 세 충돌 모두 `project-planner` 에 의한 spec/plan 선갱신 없이 구현을 착수하면 spec 이중정의 또는 계획 불이행 상태가 된다. INFO 항목(token budget 상수 명명 혼선, 토큰 추정 방식 불일치)은 코드 품질 차원의 권고이며 차단 수준은 아니다.

---

## 위험도

HIGH
