# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
검토 범위: `spec/5-system/9-rag-search.md` (diff-base=origin/main)

---

## 발견사항

### 발견 1
- **[CRITICAL]** spec 에 존재하지 않는 §3.4 를 코드 전체가 참조
  - target 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` 주석 (spec/5-system/9-rag-search.md §3.4), `rerank.service.ts`, `rag-search.service.ts`, `kb-tool-provider.ts`, 테스트 파일 다수
  - 위반 규약: `CLAUDE.md` 정보 저장 위치 원칙 — 기술 명세는 `spec/<영역>/*.md` 본문. 코드는 spec 을 단일 진실(SoT)로 참조해야 하며, spec 에 없는 절 번호를 거짓 참조하는 것은 SDD 근간 위반
  - 상세: `spec/5-system/9-rag-search.md` 의 섹션 구조는 §3.1 쿼리 / §3.2 거리 함수 / §3.3 리랭킹(§3.3.1, §3.3.2) 으로 끝난다. **§3.4 는 존재하지 않는다.** 코드 diff 전체에서 `spec/5-system/9-rag-search.md §3.4` 라고 표기한 주석이 10+ 곳에 등장하지만(dynamic-cut.util.ts 세 곳, rerank.service.ts 네 곳, rag-search.service.ts 네 곳, kb-tool-provider.ts 두 곳), 해당 절은 spec 에 부재한다. 존재하지 않는 spec 절을 SoT 로 인용하면 (a) 이후 consistency-checker 가 dead-link 로 오탐하고 (b) spec 과 구현의 정합성 감사 경로가 끊긴다.
  - 제안: `spec/5-system/9-rag-search.md` 에 §3.4 절(동적 점수 컷: token-budget + inject-cap)을 신설하거나, 이미 §3.3.2 흐름 step 4-5 안에 편입시키고 해당 내용을 명문화한 뒤 코드 주석의 참조를 실제 절 번호로 일치시킨다. project-planner 위임 필요.

### 발견 2
- **[CRITICAL]** `gradingNoGrounding` 필드가 spec 의 `RerankDiagnostics` 스키마·`ragDiagnostics.rerank` 서브객체에 미반영
  - target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` — `RerankDiagnostics` 인터페이스에 `gradingNoGrounding: boolean` 신규 추가; `kb-tool-provider.ts` — `gradingNoGrounding` 으로 `grounding: 'none'` / `note` 필드를 tool_result content 에 삽입
  - 위반 규약: `CLAUDE.md` 정보 저장 위치 — 기술 명세는 `spec/<영역>/*.md`. `spec/5-system/9-rag-search.md §4.2` 의 `rerank` 서브객체 스키마(candidateCount, returnedCount, llmGradingApplied, cutoffApplied, error)에 `gradingNoGrounding` 필드가 없다. §2.2 의 KB tool 결과 포맷에도 `grounding: 'none'` / `note` 필드가 정의되지 않았다.
  - 상세: `RerankDiagnostics.gradingNoGrounding` 은 새로운 계약(외부 호출자가 `meta.ragDiagnostics.rerank.gradingNoGrounding` 을 읽어 분기 가능)이지만 spec §4.2 에 없다. 마찬가지로 `kb-tool-provider.ts` 가 추가하는 `grounding: 'none'` + `note` 필드는 §2.2 의 tool_result content 포맷을 확장하는 신규 API surface 이지만 spec §2.2 에 정의되지 않았다. spec 이 약속하지 않은 필드가 실제 런타임 payload 에 등장하면 SDD 원칙 위반이다.
  - 제안: `spec/5-system/9-rag-search.md` §4.2 의 `rerank` 서브객체에 `gradingNoGrounding: boolean` 필드를 추가하고, §2.2 의 tool_result content 에 `gradingNoGrounding` 발생 시 포맷(grounding/note 필드 포함) 을 명문화한다. project-planner 위임 필요.

### 발견 3
- **[CRITICAL]** spec §3.3.2 step 3 의 "항상 수행" 기술이 conditional escalate 구현과 충돌
  - target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` — `shouldEscalateGrading()` 메서드 신설, `cross_encoder_llm` 경로에서 escalate 조건(ESCALATE_TOP_SCORE_FLOOR=0.6, ESCALATE_FLAT_REL_GAP=0.05)을 만족할 때만 LLM grading 호출
  - 위반 규약: `CLAUDE.md` 정보 저장 위치 — 기술 명세는 spec 본문이 SoT. `spec/5-system/9-rag-search.md §3.3.1` 은 `cross_encoder_llm` 을 "항상 listwise LLM grading 1콜 추가" 라고 정의한다. §3.3.2 step 3 도 "survivors(~15) listwise LLM grading **항상** 수행" 이라고 명시한다. §3.3.1 v1 결정 주석도 "`cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 … 후속 도입)" 라고 쓰여 있어, 본 PR 의 구현은 spec 이 명시적으로 v1 범위 밖으로 선언한 "conditional escalate" 를 v1 에 도입한 것이다.
  - 상세: 구현(conditional escalate)이 spec 기술(항상 실행)과 직접 모순된다. spec 을 읽는 독자는 `cross_encoder_llm` 이 항상 LLM grading 을 하는 것으로 이해하지만 실제 코드는 escalate 미진입 시 LLM 을 호출하지 않는다. 이는 동작 예측 invariant 파손이며 spec 단일 진실 원칙 위반이다.
  - 제안: spec §3.3.1 모드 표, §3.3.2 step 3, v1 결정 주석을 conditional escalate 를 포함하도록 갱신하고 escalate 임계(ESCALATE_TOP_SCORE_FLOOR, ESCALATE_FLAT_REL_GAP)를 provisional 상수로 명기한다. project-planner 위임 필요.

### 발견 4
- **[WARNING]** `RerankParams` 의 `topK` → `injectCap` + `tokenBudget` rename 이 spec 에 반영되지 않음
  - target 위치: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` — `RerankParams` 인터페이스에서 `topK: number` 제거, `injectCap: number` + `tokenBudget: number` 추가
  - 위반 규약: `CLAUDE.md` 단일 진실 원칙 — 기술 명세는 `spec/<영역>/*.md`. `spec/5-system/9-rag-search.md §3.3.2` step 5 는 여전히 "최종 top_k(노드 ragTopK 또는 LLM override)로 slice" 라고 기술하며 `injectCap` / `tokenBudget` 개념이 없다.
  - 상세: `injectCap` + `tokenBudget` 은 §3.4(미존재) 에 정의된 것으로 코드 주석이 주장하지만 spec 어디에도 이 파라미터 명칭이 등장하지 않는다. spec 독자가 `topK` slice 로 이해하는 동작이 코드에서는 다른 이름의 다른 메커니즘으로 대체됐다.
  - 제안: spec §3.3.2 step 5 를 `injectCap` + `tokenBudget` 기반 동적 컷으로 갱신하고, `RerankParams` 의 파라미터 스키마를 spec 에 명시한다.

### 발견 5
- **[WARNING]** `spec/5-system/9-rag-search.md §3.1` 파라미터 표의 `$4` 기본값이 여전히 `5` (구현은 `RAG_RECALL_K=50` 으로 변경됨)
  - target 위치: `spec/5-system/9-rag-search.md §3.1` 파라미터 표 — `$4 최대 결과 수 (topK) | LLM 호출 인자 또는 5`
  - 위반 규약: `CLAUDE.md` 단일 진실 원칙 — spec 이 SoT. `rag-search.service.ts` 의 `searchVectorGroup` 호출이 `topK` 대신 `RAG_RECALL_K(50)` 을 LIMIT 으로 사용하도록 변경됐지만 spec 의 파라미터 표는 여전히 기본값 5 를 표시한다.
  - 상세: off 경로에서 SQL 의 `$4` LIMIT 은 이제 `RAG_RECALL_K=50` 이다. 기존 spec 기술 "LLM 호출 인자 또는 5" 는 오래된 값이다.
  - 제안: spec §3.1 파라미터 표의 `$4` 기본값을 `RAG_RECALL_K(50, 내부 상수)` 로 갱신한다.

### 발견 6
- **[WARNING]** `spec/5-system/9-rag-search.md §2.1` 의 `top_k` description template(`"Default: <ragTopK>"`)이 ragTopK optional 화와 불일치
  - target 위치: `spec/5-system/9-rag-search.md §2.1` JSON — `"top_k": { "description": "Default: <ragTopK>" }` 및 §2.1 하단 "노드 config 의 `ragTopK` / `ragThreshold` 는 default 값"
  - 위반 규약: `CLAUDE.md` 단일 진실 원칙. `ai-agent.schema.ts` 가 `ragTopK` 를 `optional()`(기본값 없음)으로 변경했고 `kb-tool-provider.ts` 도 "If omitted, a dynamic token-budget cut decides the count" 로 tool description 을 변경했다. spec §2.1 의 ToolDef 예시는 여전히 `ragTopK` 가 기본값이 있는 것으로 기술한다.
  - 제안: spec §2.1 의 `top_k` description template 을 optional cap 으로 갱신하고, 미설정 시 동적 컷이 결정한다는 설명을 추가한다.

### 발견 7
- **[INFO]** `error-codes` 규약 — `error: "search_failed"` 가 `lower_snake_case` 임
  - target 위치: `spec/5-system/9-rag-search.md §2.2` — `"error": "search_failed"`
  - 위반 규약: `spec/conventions/error-codes.md §1` — "에러 코드는 UPPER_SNAKE_CASE", `spec/conventions/node-output.md §3.2` — `code 는 UPPER_SNAKE_CASE`
  - 상세: 이번 diff 에서 신규 추가된 코드가 아니라 기존 spec §2.2 에 있는 값이다. historical artifact 레지스트리(`error-codes.md §3`)에 등재되지 않은 상태로 `lower_snake_case` 가 spec 예시에 그대로 남아 있다. 이번 PR 이 직접 도입하지는 않았으나 diff 범위 안 파일(`spec/5-system/9-rag-search.md`) 에 존재하므로 기록한다.
  - 제안: `SEARCH_FAILED` 로 갱신하거나 `error-codes.md §3` historical-artifact 레지스트리에 등재한다.

---

## 요약

이번 구현 diff 의 정식 규약 준수 관점 핵심 문제는 **spec 단일 진실 원칙의 다중 위반**이다. 코드가 광범위하게 참조하는 `§3.4` 절이 `spec/5-system/9-rag-search.md` 에 존재하지 않으며(CRITICAL), `gradingNoGrounding` 이라는 새 API surface 가 spec §4.2 및 §2.2 에 정의 없이 구현에만 나타났다(CRITICAL). 또한 spec §3.3.1·§3.3.2 가 `cross_encoder_llm` 의 LLM grading 을 "항상 수행"으로 명시하는데 구현은 conditional escalate 로 동작하므로 spec-impl 직접 모순이 생겼다(CRITICAL). 이 세 가지는 모두 다른 시스템이나 독자가 spec 을 진실로 삼았을 때 invariant 가 깨지는 수준이다. 추가로 `injectCap`/`tokenBudget` 파라미터 명칭·`ragTopK` optional 화·`$4` LIMIT 기본값 변경이 spec 에 반영되지 않은 WARNING 도 존재한다(4건). 전체적으로 구현이 spec 보다 앞서나간 상태이며, project-planner 가 spec 을 구현과 정합하게 갱신해야 한다.

---

## 위험도

CRITICAL
