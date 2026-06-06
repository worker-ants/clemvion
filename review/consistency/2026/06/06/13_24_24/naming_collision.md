# 신규 식별자 충돌 검토 — impl-prep: spec/5-system/9-rag-search.md

검토 모드: 구현 착수 전 (--impl-prep)
대상 변경 요약: D1 점수 기반 동적 컷 (`applyDynamicCut` / `dynamic-cut.ts`) + D2 listwise conditional escalate 도입, `ragTopK` zod `.default(5)` → `.optional()` 변경.

---

## 발견사항

### 1. [WARNING] `tokenBudget` 식별자가 기존 메모리 영역과 동일 이름으로 사용될 가능성

- **target 신규 식별자**: `dynamic-cut.ts` 의 `applyDynamicCut(…, tokenBudget, …)` 파라미터 / 내부 상수 (`~8000`)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` line 54 — `DEFAULT_MEMORY_TOKEN_BUDGET = 8000` 상수 (working-memory 압축 예산)
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts` line 272 — 함수 파라미터 `tokenBudget`
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 739 — `const tokenBudget = …DEFAULT_MEMORY_TOKEN_BUDGET`
  - `spec/4-nodes/3-ai/1-ai-agent.md §1` — `memoryTokenBudget` 필드 설명, `meta.memory.tokenBudgetUsed`
- **상세**: 기존 `tokenBudget` / `DEFAULT_MEMORY_TOKEN_BUDGET` (8000) 은 **working-memory 압축용** 토큰 예산 — 대화 context rollup 에 쓰인다. target 이 도입하려는 `tokenBudget ~8000` 은 **RAG inject 허용 토큰 상한** 으로 목적이 다르다. 공교롭게 두 값이 동일(8000)하고 이름도 같아 코드 내에서 혼동될 위험이 있다. `dynamic-cut.ts` 를 `search/` 폴더에 두면 메모리 모듈과 격리되므로 심각도는 낮지만, 공유 util 로 export 하거나 future `agent-memory-injection.ts` 가 import 하는 경로에서 충돌 가능성이 있다.
- **제안**: `dynamic-cut.ts` 내부 파라미터를 `ragTokenBudget` 또는 `injectTokenCap` 으로 명명해 기존 `memoryTokenBudget` / `tokenBudget` 영역과 구분한다. 상수 이름도 `RAG_INJECT_TOKEN_BUDGET` 등 RAG 컨텍스트를 명시하는 prefix 를 붙인다.

---

### 2. [INFO] `injectCap` 신규 상수가 기존 `candidateK` / `rerankCandidateK` 와 역할이 겹칠 수 있음

- **target 신규 식별자**: 내부 상수 `injectCap ~12` — off 경로의 wide 회수 후 최종 주입 개수 상한
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` line 227 — `const candidateK = kb.rerankCandidateK ?? 50`
  - `spec/5-system/9-rag-search.md §3.3.2` — `rerank_candidate_k(기본 50)` / "최종 top_k"
- **상세**: rerank 경로에는 이미 `rerank_candidate_k`(wide 회수 수) / `rerank_score_threshold`(컷) / `top_k`(최종 slice) 세 단계가 명확히 분리되어 있다. off 경로에 `injectCap` 이라는 신규 이름이 추가될 때 "최종 주입 상한"의 의미가 기존 rerank 경로의 `top_k` 슬라이스와 동일한 역할이 아닌지 혼동될 수 있다. 두 경로 모두에 동적 컷을 적용한 이후라면 `injectCap` 의 의미는 동일해지므로, 이름을 통합하거나 명확한 주석이 필요하다.
- **제안**: 공유 `applyDynamicCut` 의 세 번째 파라미터를 `maxInjectCount` 또는 `topKCap` 으로 명명하여 기존 `candidateK`(회수 후보 수) 와 확실히 구분한다.

---

### 3. [WARNING] `ragTopK` zod 기본값 제거 후 spec 의 두 정의가 불일치

- **target 신규 식별자**: `ragTopK` `.default(5)` → `.optional()` (zod schema 변경)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` line 280~292 — `ragTopK: z.number().int().default(5)`
  - `spec/4-nodes/3-ai/1-ai-agent.md §1` — `ragTopK | Integer | | 5 | KB tool 호출 시 반환할 청크 수의 기본값`
  - `spec/4-nodes/3-ai/0-common.md` line 45 — `ragTopK | Integer | RAG 검색 결과 수 (기본: 5)`
  - `spec/5-system/10-graph-rag.md` line 124, 158, 193 — `ragTopK`/`ragThreshold` 만 노출 (기본값 언급)
  - `spec/5-system/9-rag-search.md §3.1` — 파라미터 표 `$4 | 최대 결과 수 (topK) | LLM 호출 인자 또는 5`
- **상세**: target 변경은 `ragTopK` 를 optional 로 바꾸어 "미지정 시 dynamic cut 의 `injectCap(12)` 가 ceiling 으로 지배" 하도록 의미를 변경한다. 그런데 spec 에는 여러 곳에서 `ragTopK` 의 기본값이 `5` 로 명시되어 있고, 코드에도 `.default(5)` 가 남아 있다. 구현이 `.optional()` 로 변경되면 `spec/4-nodes/3-ai/1-ai-agent.md §1` 의 기본값 `5` 와 `spec/4-nodes/3-ai/0-common.md` 의 `(기본: 5)` 기술이 모순된다. target 의 변경 의도 자체(기본값 제거)는 plan(`rag-quality-improvement.md D1`) 과 일관하지만, spec 갱신이 없으면 식별자 의미가 spec ↔ 구현 간 충돌한다.
- **제안**: 구현 착수와 함께 `spec/4-nodes/3-ai/1-ai-agent.md §1` 의 `ragTopK` 기본값 `5` 표기를 "미지정 시 dynamic cut injectCap 이 ceiling(기본 12)" 으로 갱신하고, `spec/4-nodes/3-ai/0-common.md` 와 `spec/5-system/9-rag-search.md §3.1` 의 `또는 5` 표기도 동일하게 일치시킨다. 이 spec 갱신은 `project-planner` + `consistency-check --spec` 의무 경로를 거쳐야 한다.

---

### 4. [INFO] `cross_encoder_llm` 동작 변경이 §3.3.1 테이블과 불일치할 수 있음

- **target 신규 식별자**: D2 — `cross_encoder_llm` 의 "항상 LLM grading" → "conditional escalate 도입"
- **기존 사용처**:
  - `spec/5-system/9-rag-search.md §3.3.1` 모드 테이블 line 180 — `cross_encoder_llm | cross_encoder 후 **항상** listwise LLM grading 1콜 추가`
  - `spec/5-system/9-rag-search.md §3.3.2` line 195 — `**v1 결정**: cross_encoder_llm 은 항상 LLM grading 을 수행한다(conditional escalate 는 P0 평가셋으로 보정한 뒤 후속 도입)`
  - `plan/in-progress/rag-rerank-followup.md` line 18 — `conditional escalate 정량 임계 — P0 평가셋 보정 후 도입. cross_encoder_llm 은 현재 "항상 grading"(#478)`
- **상세**: spec §3.3.1 과 §3.3.2 v1 결정, 그리고 rag-rerank-followup 추적 모두 "conditional escalate 는 P0 후속"이라고 명시한다. target 이 이 변경을 현 구현 범위로 포함하면 spec 본문과 충돌한다. target 텍스트 자체는 "v1 spec(§3.3.2)이 '항상 LLM grading' + 'conditional escalate 는 P0 후속'이라 명시 → 본 변경은 그 후속 메커니즘 도입"이라고 표현하므로 의도는 맞지만, spec 본문이 갱신되지 않으면 §3.3.1/§3.3.2 와 구현이 어긋난다.
- **제안**: D2 conditional escalate 구현 시 `spec/5-system/9-rag-search.md §3.3.1` 모드 테이블과 `§3.3.2` v1 결정 문구("항상 LLM grading")를 동시에 갱신해야 한다. 이 spec 갱신 역시 `project-planner` + `consistency-check --spec` 경로를 거친다.

---

### 5. [INFO] `applyDynamicCut` 함수 위치 (`dynamic-cut.ts`) 와 기존 파일 경로 컨벤션 확인

- **target 신규 식별자**: 파일 경로 `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.ts` (추정) 또는 공유 헬퍼 위치
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/search/` — `rag-search.service.ts`, `rerank.service.ts`, `search-result.interface.ts`, `rag-search.service.spec.ts`, `rerank.service.spec.ts`
- **상세**: 기존 `search/` 폴더의 파일 이름은 모두 `<role>.<type>.ts` (예: `rag-search.service.ts`, `rerank.service.ts`) 패턴이다. `dynamic-cut.ts` 는 type suffix 가 없어 컨벤션을 깬다. 기능적 충돌은 없지만 네이밍 일관성 부재.
- **제안**: `dynamic-cut.util.ts` 또는 `dynamic-cut.helper.ts` 로 type suffix 를 붙이거나, 순수 유틸이므로 `search/utils/dynamic-cut.ts` 경로에 두어 폴더로 구분한다.

---

## 요약

신규 도입 식별자(`applyDynamicCut` / `dynamic-cut.ts` / `tokenBudget ~8000` / `injectCap ~12`) 는 기존 메모리 영역의 `tokenBudget` / `DEFAULT_MEMORY_TOKEN_BUDGET` 과 이름·값이 겹쳐 혼동 가능성이 있다(WARNING). `ragTopK` 의 `.default(5)` → `.optional()` 변경은 spec 여러 곳에 기재된 기본값 `5` 와 직접 충돌하므로 spec 동시 갱신이 필수다(WARNING). D2 conditional escalate 는 spec §3.3.1·§3.3.2 의 "항상 LLM grading" 문구와 어긋나 구현 시 spec 갱신이 병행되어야 한다(INFO). 전반적으로 식별자 자체의 CRITICAL 충돌(다른 의미로 이미 활성 사용 중인 동일 이름)은 없으나, `ragTopK` 기본값 변경에 따른 spec-impl 불일치와 `tokenBudget` 이름 중복이 이번 구현 착수 전 해소 권장 사항이다.

## 위험도

MEDIUM
