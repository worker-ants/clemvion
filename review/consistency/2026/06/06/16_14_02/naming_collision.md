# 신규 식별자 충돌 검토

검토 범위: `spec/5-system/9-rag-search.md` 구현 변경 사항 (diff-base=origin/main)  
검토 모드: --impl-done

---

## 발견사항

### 1. **[WARNING]** `RAG_RECALL_K = 50` 과 KB 엔티티 `rerankCandidateK` (default 50) — 수치 일치, 독립 코드패스

- **target 신규 식별자**: `RAG_RECALL_K` (`dynamic-cut.util.ts:123`)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts:102` — `rerankCandidateK` (`rerank_candidate_k` 컬럼, default 50). `spec/1-data-model.md:345` 및 `spec/5-system/9-rag-search.md:185` 에서도 `rerank_candidate_k(기본 50)` 로 정의됨.
- **상세**: `RAG_RECALL_K` 는 `off` 경로(rerank 미적용) 의 wide 회수 LIMIT 이고, `rerankCandidateK` 는 `rerank_mode ≠ off` 경로의 KB 단위 설정 필드다. 코드 주석에도 "독립 코드패스" 로 명시되어 있고 실제로 서로 다른 경로에서 읽힌다. 그러나 숫자가 동일(50)하고 개념(wide 회수 폭)도 유사해, 후속 개발자가 두 값이 연동돼야 한다고 오해하거나 하나를 바꿀 때 나머지를 누락할 위험이 있다.
- **제안**: 두 상수가 독립적으로 튜닝될 수 있음을 코드·spec 에 명시적으로 분리 문서화한다. 예: `RAG_RECALL_K` 주석에 "`rerank_mode=off` 전용 wide 회수 LIMIT — KB 엔티티 `rerankCandidateK` 와 값이 같지만 별개 제어 지점" 을 덧붙이거나, spec §3.1 테이블에 "`$4` off 경로: `RAG_RECALL_K`(50 고정) / rerank 경로: KB.rerank_candidate_k" 를 명시한다.

---

### 2. **[WARNING]** `RAG_INJECT_TOKEN_BUDGET = 8000` 과 `DEFAULT_MEMORY_TOKEN_BUDGET = 8000` — 수치 일치, 의미 상이

- **target 신규 식별자**: `RAG_INJECT_TOKEN_BUDGET` (`dynamic-cut.util.ts:126`)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts:29` — `DEFAULT_MEMORY_TOKEN_BUDGET = 8000`. working-memory 압축 트리거 예산.
- **상세**: 값(8000)과 단위(토큰 예산)가 동일하지만 의미가 다르다. `RAG_INJECT_TOKEN_BUDGET` 은 KB 주입 청크 누적 토큰 상한, `DEFAULT_MEMORY_TOKEN_BUDGET` 은 working-memory(AI Agent 자기 히스토리) 압축 트리거 예산이다. 코드 주석에도 이 차이를 설명하고 있으나, 두 상수의 수치가 우연히 같아 후속 튜닝 시 "하나를 바꾸면 다른 것도 맞춰야 한다" 는 오해를 유발할 수 있다.
- **제안**: 수치 일치는 허용 가능한 우연이나, spec §3.4 또는 Rationale 에 "두 예산(KB 주입 vs working-memory)은 별개 상수이며 값이 같은 것은 초기 calibration 우연의 일치" 를 명시해 future reader 의 혼동을 방지한다.

---

### 3. **[CRITICAL]** `cross_encoder_llm` 의 conditional escalate — spec 과 구현 동작 불일치(식별자 의미 충돌)

- **target 신규 식별자**: `shouldEscalateGrading()`, `ESCALATE_TOP_SCORE_FLOOR`, `ESCALATE_FLAT_REL_GAP` (`rerank.service.ts:793-797`)
- **기존 사용처**: `spec/5-system/9-rag-search.md:180`, `spec/5-system/9-rag-search.md:188`, `spec/5-system/9-rag-search.md:195`
- **상세**: spec §3.3.1 테이블은 `cross_encoder_llm` 을 "`cross_encoder` 후 **항상** listwise LLM grading 1콜 추가"로 정의하고, §3.3.2 step 3 은 "survivors(~15) listwise LLM grading **항상** 수행", §3.3.2 v1 결정 주석은 "conditional escalate 는 … P0 평가셋으로 보정한 뒤 **후속 도입**" 이라고 명시한다. 즉 spec 는 conditional escalate 를 v1 미구현 항목으로 정의했으나, 구현은 `shouldEscalateGrading()` 로 이미 conditional 로 동작한다. `cross_encoder_llm` 이라는 식별자/모드명이 spec 에서는 "항상 LLM grading" 의미지만 구현에서는 "조건부 escalate 후 LLM grading" 의미가 되어 동일 식별자에 다른 의미가 공존한다. 이 차이는 외부 노출 API(`ragDiagnostics.rerank.mode = "cross_encoder_llm"`)의 의미까지 영향을 미친다.
- **제안**: spec §3.3.1 과 §3.3.2 를 이번 구현에 맞게 갱신하거나, 또는 conditional escalate 를 spec 갱신 전까지 revert 하고 plan/in-progress 에 남겨 후속 실현으로 처리한다. 전자를 선택할 경우 `ESCALATE_TOP_SCORE_FLOOR` / `ESCALATE_FLAT_REL_GAP` 값(provisional)을 spec §3.3.2 에 명시해 single source of truth 를 확보한다.

---

### 4. **[WARNING]** `gradingNoGrounding` 필드 — spec `rerank` 서브객체 스키마에 미정의

- **target 신규 식별자**: `gradingNoGrounding: boolean` (`rerank.service.ts:812`, `RerankDiagnostics` 인터페이스)
- **기존 사용처**: `spec/5-system/9-rag-search.md:252-264` — `rerank` 서브객체 스키마 (`mode`, `candidateCount`, `returnedCount`, `llmGradingApplied`, `cutoffApplied`, `error` 만 정의됨)
- **상세**: 구현이 `RerankDiagnostics` 에 `gradingNoGrounding` 필드를 추가했지만 spec §4.2 의 `rerank` 서브객체 JSON 예시 및 필드 설명표에는 포함되지 않았다. 외부 소비자(프런트엔드, 문서, API 클라이언트)가 이 필드를 모를 수 있다.
- **제안**: spec §4.2 `rerank` 서브객체 스키마에 `gradingNoGrounding` 필드를 추가하고 의미를 기술한다. 아울러 tool_result content 에 `grounding: 'none'` 신호가 포함되는 D2 동작도 §2.2 에 명시한다.

---

### 5. **[WARNING]** `RerankParams.topK` → `injectCap + tokenBudget` 으로 분리 — spec 인터페이스 서술과 미동기

- **target 신규 식별자**: `injectCap`, `tokenBudget` (`rerank.service.ts:RerankParams` 인터페이스)
- **기존 사용처**: `spec/5-system/9-rag-search.md:§3.3.2` step 5 — "최종 top_k(노드 ragTopK 또는 LLM override)로 slice"
- **상세**: spec step 5 는 여전히 단순 top_k slice 를 기술하지만, 구현은 `applyDynamicCut(injectCap, tokenBudget)` 으로 교체됐다. spec 에 `§3.4` 섹션이 없음에도 코드 곳곳이 "spec/5-system/9-rag-search.md §3.4" 를 참조하고 있어, 실제로는 존재하지 않는 섹션을 수십 곳에서 인용하는 상태다. 이 인용 자체는 식별자 충돌은 아니지만, 검색자가 §3.4 를 찾으면 404 이므로 명명 면에서 혼선이 있다.
- **제안**: spec §3.3.2 step 5 를 "`applyDynamicCut(tokenBudget, injectCap)` 으로 대체" 로 갱신하고, §3.4 를 신설해 동적 점수 컷 알고리즘(RAG_INJECT_TOKEN_BUDGET, RAG_MAX_INJECT_COUNT, 최소 1개 보장 규칙)을 정의한다.

---

### 6. **[INFO]** `SearchWithMetaResult` 타입 — spec 에 미정의, 구현 내부 전용

- **target 신규 식별자**: `export type SearchWithMetaResult` (`rag-search.service.ts:268`)
- **기존 사용처**: `searchWithMeta()` 의 인라인 반환 타입(기존 익명 타입)
- **상세**: 익명 인라인 타입을 named export 로 승격한 것으로 기능 충돌은 없다. spec 에 대응 타입명이 없으나 내부 구현 타입이므로 충돌 위험 없음.
- **제안**: 외부 모듈(예: ai-agent.handler)이 이 타입을 import 할 경우 spec 에 타입 계약으로 올릴지 여부를 검토한다. v1 에서는 INFO 수준.

---

## 요약

이번 diff 가 도입한 식별자 중 가장 심각한 충돌은 **`cross_encoder_llm` 모드의 의미 불일치(3번)**다. spec 은 이 모드를 "항상 LLM grading" 으로 정의하지만 구현은 "conditional escalate" 로 동작해, 동일 모드 식별자가 spec 과 코드에서 다른 의미를 가지게 됐다. 상수 수치 충돌(1번 `RAG_RECALL_K`/`rerankCandidateK`, 2번 `RAG_INJECT_TOKEN_BUDGET`/`DEFAULT_MEMORY_TOKEN_BUDGET`)은 값이 같지만 의도가 달라 혼동 가능성이 있는 WARNING 수준이다. `gradingNoGrounding`(4번) 과 `injectCap`/`tokenBudget` + 미존재 §3.4 참조(5번)는 spec 미갱신으로 인한 식별자 의미 공백이다. 신규 파일 경로·API endpoint·환경변수·이벤트명 영역에서는 충돌이 발견되지 않았다.

## 위험도

HIGH
