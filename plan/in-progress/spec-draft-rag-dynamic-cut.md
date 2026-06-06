---
worktree: rag-dynamic-cut-12fac1
started: 2026-06-06
owner: project-planner
---
# Spec draft — RAG P1 D1(점수 기반 동적 컷) + D2(conditional escalate 메커니즘)

> 대상: `spec/5-system/9-rag-search.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/10-graph-rag.md`.
> 근거: `rag-quality-improvement.md` §P1·§2(D1/D2), consistency-check `13_24_24` BLOCK 해소(C1~C4·W1~W11).
> 사용자 confirm(2026-06-06): 주입 상한=내부 ceiling(12)+top_k 명시 override / config 노출=내부 상수 / D2 메커니즘 이번 PR 포함.

## 설계 핵심 (refined)

θ(관련성 임계)는 **기존대로 SQL(off)·rerank-score(≠off) 게이트로 유지** — 이동하지 않는다. D1 이 고치는 것은 **고정 COUNT 선차단(`LIMIT topK=5`)**: SQL 회수 폭을 내부 상수 `RAG_RECALL_K`(=50)로 넓히고, 생성 주입은 **app-layer 동적 컷**(`RAG_INJECT_TOKEN_BUDGET`=8000 토큰 상한 + `RAG_MAX_INJECT_COUNT`=12 ceiling)으로 결정한다. `top_k` 명시(LLM arg 또는 노드 `ragTopK`) 시 그 값이 ceiling override. θ 는 wider 후보집합 위에서 그대로 작동(의미 청크 누락 해소).

순서: pgvector wide 회수(~50, θ 게이트) → [≠off] cross-encoder 리랭크(+조건부 LLM grading) → 동적 점수 컷(token-budget + inject-cap).

---

## A. `spec/5-system/9-rag-search.md`

### A1. frontmatter
- `pending_plans:` 에 `plan/in-progress/rag-dynamic-cut.md` 추가 (rag-rerank-followup.md 와 병기). (W7)

### A2. §3.1 파라미터 표 + SQL 주석
- `$4` 행: `최대 결과 수 (topK) | LLM 호출 인자 또는 5` → **`회수 폭 (recall) | 내부 상수 RAG_RECALL_K(50)`**. 최종 주입 청크 수는 §3.4 동적 컷이 결정.
- §3.1 SQL `LIMIT $4` 주석/본문: off 경로도 wide 회수(LIMIT=RAG_RECALL_K) — cosine θ(`$3`)는 그대로 적용(관련성 게이트), 고정 COUNT 컷만 제거.
- 라인 156 분기 노트 갱신:
  - 기존: "`rerank_mode = 'off'`(기본)이면 위 SQL 그대로 cosine 임계+topK 컷 (현행 동작)."
  - 신규: "`rerank_mode = 'off'`(기본)이면 cosine θ 게이트는 유지하되 `LIMIT` 은 `RAG_RECALL_K` 로 넓히고, 생성 주입 청크 수는 §3.4 **app-layer 동적 점수 컷**(token-budget + inject-cap)이 결정한다. `rerank_mode ≠ off` 면 cosine θ 미적용 wide 회수 → 리랭크 → §3.4 동적 컷."

### A3. §3.3.1 모드 표
- `off` 행:
  - 기존: "후처리 없음 — §3.1 SQL 그대로 (cosine 임계 + topK). **현행과 byte-identical (하위호환)**. 셀프호스팅에 리랭커 의존성을 강제하지 않기 위한 기본값"
  - 신규: "cross-encoder 재점수화 없음. wide 회수(cosine θ 게이트) → **§3.4 동적 점수 컷**(token-budget + inject-cap). **리랭커 인프라 의존 없음** — 셀프호스팅 기본값. (D1 이전: 고정 `LIMIT topK`. 동적 컷은 cosine 점수 위 app-layer 후처리라 리랭커 불요)"
- `cross_encoder_llm` 행:
  - 기존: "`cross_encoder` 후 **항상** listwise LLM grading 1콜 추가 …"
  - 신규: "`cross_encoder` 후 **조건부(conditional escalate)** listwise LLM grading 1콜 — cross-encoder 상위 점수가 평탄/모호할 때만 escalate (정책·지시 판단 KB용). 이 모드 선택 자체가 'LLM grading KB' 표시자 — 별도 플래그 없음"

### A4. §3.3.2 흐름 (`rerank_mode ≠ off`)
- step 1: "wide 회수: cosine 임계 미적용, RAG_RECALL_K(50) 회수" (rerank_candidate_k 와 정합)
- step 3: "`[cross_encoder_llm 만]` survivors(~15) listwise LLM grading — **상위 점수 평탄/모호 시 escalate**(항상 아님; 정량 임계는 §Rationale 참조). id 순위 + 1~10 점수, 1콜; pointwise 금지"
- step 4: "동적 점수 컷: rerank_score_threshold(θ) 미달 drop **+ token-budget 상한**(RAG_INJECT_TOKEN_BUDGET)"
- step 5: "최종 inject-cap: 명시 top_k(노드 ragTopK 또는 LLM override) 있으면 그 값, 없으면 RAG_MAX_INJECT_COUNT(12) ceiling 까지 주입"
- "v1 결정" bullet:
  - 기존: "`cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 … 후속 도입)."
  - 신규: "`cross_encoder_llm` 은 cross-encoder 상위 점수가 평탄/모호할 때만 listwise grading 으로 **conditional escalate** 한다. escalate 진입 **정량 임계는 합리적 default**(§Rationale)로 시작하고, P0 골든셋 기반 A/B 확정은 후속(`rag-rerank-followup.md`). 'escalate 안 됨'은 cross-encoder 결과를 그대로 사용(정상)."
- grader '근거 없음' 전달: §3.3.2 또는 §3.4 에 "grader 가 '관련 근거 없음'으로 판정하면(survivors 전부 저점/escalate 후 무근거) 그 사실을 agent 컨텍스트에 명시 전달해 환각을 억제한다 (Self-RAG 인용정밀도)." 추가.

### A5. 신규 §3.4 — 동적 점수 컷 (생성 주입, 모든 모드 공통)
회수·리랭크 직후, LLM 컨텍스트 주입 직전에 적용되는 **공통 후처리**. KB tool 인터페이스 불변.
```
1) wide 회수 (off: cosine θ 게이트 + LIMIT RAG_RECALL_K=50 / ≠off: rerank_candidate_k)
2) (≠off) cross-encoder 리랭크 + [cross_encoder_llm] 조건부 LLM grading
3) 동적 컷:
   a. θ 게이트 (off=cosine SQL 단계 / ≠off=rerank_score_threshold) — wider 후보집합 위
   b. token-budget: 점수 내림차순 누적, 누적 토큰 추정이 RAG_INJECT_TOKEN_BUDGET(8000) 초과 시 중단 (단 최소 1개 보장)
   c. inject-cap: 명시 top_k 있으면 min(그 값), 없으면 RAG_MAX_INJECT_COUNT(12) ceiling
```
- 토큰 추정: KB 청킹 경로의 `chunking/text-chunker.estimateTokens`(char/3, 동기·무의존) 재사용 — KB 청크 도메인과 동일 추정. (memory 경로의 language-aware 추정과는 의도적 분리: KB 컷은 빠른 균일 근사로 충분, 회귀 0)
- 상수: `RAG_RECALL_K`(50)·`RAG_INJECT_TOKEN_BUDGET`(8000)·`RAG_MAX_INJECT_COUNT`(12) 는 **내부 상수**(신규 config 필드 없음). 사용자/LLM 노출은 θ(`ragThreshold`)·`top_k`(`ragTopK`/LLM arg)만.
- 적용 경로: 단일 KB vector·multi-KB merge(디버그 컨트롤러)·graph 통합 결과 모두 동일하게 최종 주입 컷.
- 실패 처리: 동적 컷은 in-process 순수 후처리(필터·합산)라 별도 실패 모드 없음. 상위 예외는 기존 검색 try/catch(빈 결과/`search_failed`)가 커버 (§6).

### A6. §4.2 ragDiagnostics
- `llmGradingApplied` 설명: "cross_encoder_llm 이라도 **conditional escalate 로 escalate 안 되면 false**(정상). escalate+grading 성공 시 true, grading 실패 강등 시 false+error." (I3)
- (선택) `rerank` 서브객체에 `cutoffApplied` 가 token-budget/inject-cap 동적 컷 적용 여부 포함됨을 명시.

### A7. §6 에러 처리 표
- 행 추가: "동적 점수 컷 | in-process 순수 후처리 — 실패 모드 없음. 상위 검색 실패는 기존 `search_failed`/빈 결과 fallback 으로 커버" (W8)

### A8. ## Rationale 추가/갱신
- 갱신 "왜 완전 선택적(off 기본)인가": off 가 더는 "byte-identical" 이 아님을 명시 — off 도 동적 컷을 거치나 **리랭커 인프라 의존은 여전히 없음**(cosine 점수 위 app-layer 후처리). (a) 하위호환은 "리랭커 없이도 동작·점진 도입" 으로 의미 유지, byte-identical 문구 제거. (C1/C2)
- 확장 "왜 동적 점수 컷인가": 고정 top-k(=5) 가 query-의존 최적 k 무시 → 의미 청크 누락 + lost-in-the-middle. **고치는 것은 COUNT 선차단**(θ 는 관련성 게이트로 유지). 회수 폭 확대(50) + token-budget + inject-cap(12). 근거 CAR(토큰−60%·지연−22%·환각−10%). 모든 모드 공통 적용 이유.
- 신규 "왜 회수폭/예산/ceiling 을 내부 상수로 두나": Rationale I4(신규 config 필드 증식 회피)·ragThreshold 재해석 선례와 일관. v1 은 상수, 필요 시 후속에 KB 필드 승격. 사용자 노출은 θ·top_k 만.
- 신규 "왜 ragTopK 기본값(5)을 제거(optional)했나": 동적 컷 도입으로 '고정 기본 주입수' 개념이 사라짐. ragTopK 는 이제 **선택적 상한 override** — 미지정 시 동적 컷(ceiling 12)이 지배, 명시 시 그 값이 ceiling. ragThreshold(θ)는 기본 0.7 유지(여전히 관련성 게이트). (C3/W4)
- 신규 "왜 D2 conditional escalate 를 지금 도입하나": v1 '항상 grading' 은 비용 보호용 단순화였고, escalate 진입 구조는 데이터 무관하게 안전(escalate 안 되면 cross-encoder 결과 사용 = 기존 동작 부분집합). **정량 임계는 합리적 default 로 시작**(예: 상위 N 점수 표준편차/최댓값-차 기반 평탄도)하고 P0 골든셋 A/B 로 확정(후속). 따라서 v1 대비 회귀 위험 낮음. (C4/W5/W6)
- 신규 "왜 token-budget 추정에 char/3(text-chunker)을 쓰나": KB 청크 도메인과 동일 추정 함수 재사용, 빠른 균일 근사. memory 경로 language-aware 추정과 분리(서로 다른 도메인·회귀 0). (I1/I2)
- 토큰 budget 상수 명명 `RAG_INJECT_TOKEN_BUDGET` — working-memory `DEFAULT_MEMORY_TOKEN_BUDGET`(8000)과 값은 같아도 RAG prefix 로 분리(혼선 차단). (W10/I1)

---

## B. `spec/4-nodes/3-ai/1-ai-agent.md`

### B1. §1 config 표 — ragTopK (라인 40)
- 기존: "`5` | KB tool 호출 시 반환할 청크 수의 기본값 …"
- 신규: 기본값 칸 `5` 제거(공란 또는 '—'). 설명: "KB tool 호출 시 주입 청크 수 **상한(override)**. **미지정 시 동적 점수 컷**(token-budget + 내부 inject-cap 12)이 주입 수를 지배, 명시 시 그 값이 ceiling. LLM 이 호출 인자로 override 가능. KB `rerank_mode ≠ off` 면 리랭크 후 적용. (Spec RAG 검색 §3.4)"
- ragThreshold (라인 41): **변경 없음**(기본 0.7, 관련성 게이트). 설명에 "off=cosine θ, ≠off=rerank 점수 θ" 유지.

### B2. §config 예시 JSON (라인 667 부근)
- `"ragTopK": 5,` 는 **명시 override 예시**로 유효하나, 기본값 오해 방지를 위해 주석/문구로 "(선택 — 미지정 시 동적 컷)" 표기하거나 라인 제거. → **라인 유지 + 인접 설명에 '명시 시 상한 override' 1줄** (예시 자체는 합법).

## C. `spec/4-nodes/3-ai/0-common.md` (라인 45)
- 기존: "ragTopK | Integer | RAG 검색 결과 수 (기본: 5). graph 모드 KB 에서도 동일 (rerank 후 상위 K 만 컨텍스트에 주입)"
- 신규: "ragTopK | Integer | RAG 주입 청크 수 **상한**(미지정 시 동적 컷이 지배; 명시 시 ceiling). graph 모드 KB 에서도 동일. (RAG 검색 §3.4)"
- ragThreshold (라인 46): 변경 없음.

## D. `spec/5-system/17-agent-memory.md` (라인 83)
- 기존: "기본값은 RAG 정합을 위해 동일(`5` / `0.7`)하나 별도 필드다."
- 신규: "`memoryThreshold`/`ragThreshold` 기본값은 `0.7` 로 동일하나 별도 필드다. `memoryTopK` 는 기본 `5`(persistent 메모리 전용)이며, KB 검색용 `ragTopK` 는 동적 컷 도입으로 고정 기본값이 없다(선택적 상한 override, RAG 검색 §3.4) — 두 필드는 독립."

## E. `spec/5-system/10-graph-rag.md`
- 라인 417 `[7] 상위 ragTopK 만 컨텍스트에 주입` → `[7] 동적 점수 컷(token-budget + inject-cap 상한, 명시 top_k 시 그 값)으로 컨텍스트에 주입 (RAG 검색 §3.4)`
- 라인 471 `LIMIT $5;        -- ragTopK` → `LIMIT $5;        -- 회수 폭(recall) — 최종 주입 수는 app-layer 동적 컷(RAG 검색 §3.4)이 결정`
- 라인 124/158/193/606 ("`ragTopK`/`ragThreshold` 만 노출"): **변경 없음** — 노드가 노출하는 knob 집합 서술이지 기본값 서술이 아님(여전히 정확).

---

## F. plan 갱신
- `plan/in-progress/rag-rerank-followup.md` line 18:
  - 기존: `[ ] conditional escalate 정량 임계 — P0 평가셋 보정 후 도입. cross_encoder_llm 은 현재 "항상 grading"(#478); escalate 는 …`
  - 신규: `[~] conditional escalate — **메커니즘**(escalate 진입 구조 + 합리적 default 임계)은 rag-dynamic-cut PR 에서 구현. **정량 임계 A/B 확정**은 P0 baseline(rag-quality-improvement §7.B) 후속.`
- `plan/in-progress/rag-quality-improvement.md §3 P1`: spec 갱신 체크박스 — 본 spec 반영 완료 시 `[x]`.

## Rationale (draft 자체)
- θ 를 SQL/rerank 게이트로 유지(이동 안 함)한 이유: D1 의 타깃은 COUNT 선차단이지 관련성 게이트가 아니다. θ 이동은 graph expanded 청크 over-drop 등 의도치 않은 의미 변화 위험 → 회피. 회수 폭 확대 + app-layer budget/cap 만으로 D1 목표(의미 청크 누락 해소) 달성, 회귀 표면 최소.
- D2 메커니즘 이번 PR 포함(사용자 결정): escalate 진입 구조는 데이터 무관 안전(미escalate=기존 동작). 정량 임계만 후속 A/B — spec 에 '합리적 default + A/B 후속' 명문화로 rationale-continuity 충족.

---

## 갱신 — `--spec` 14_44_26 검토 반영 (BLOCK 해소)

> Critical 1건(본 draft frontmatter 부재) = 상단 frontmatter 추가로 해소. 아래는 WARNING/INFO 반영 — 실제 spec 편집 시 함께 적용한다.

- **(W1) pending_plans 경로**: §A1 은 실존 파일 `plan/in-progress/rag-dynamic-cut.md` 를 가리킨다(이미 존재). 본 draft 파일이 아님.
- **(W2) spec status**: `spec/5-system/9-rag-search.md` 는 이미 `status: partial` — 전이 불필요(유지).
- **(W4/I2) KB tool §2.1 `top_k` description**: 라인 80 `"Default: <ragTopK>"` → `"Number of chunks to inject. If omitted, a dynamic token-budget cut applies (internal ceiling 12). Increase for broader recall."` 로 갱신. 코드(`kb-tool-provider.ts`)의 tool def description 도 동일 의미로 갱신(developer 단계).
- **(W5) graph-rag SQL LIMIT 방향 확정**: graph 의 SQL `LIMIT`(코드: `vectorSeedTopK + expandedChunkLimit`)은 **회수 폭으로 그대로 유지** — D1 은 graph 의 회수를 바꾸지 않는다. D1 동적 컷은 graph seed+expanded **통합 결과의 최종 주입 단계**(app-layer)에만 적용. 따라서 §E 라인 471 주석은 `-- 회수 폭(recall): vectorSeedTopK + expandedChunkLimit (최종 주입은 §3.4 동적 컷)`. `expanded_chunk_limit` 는 회수 상한, 동적 컷(token-budget+inject-cap)은 그 뒤 주입 상한 — 직교(우선순위 충돌 없음, 회수 ⊇ 주입).
- **(W6) §3.1 `$4` 이원화**: §A2 에서 `$4` 행을 단일 교체하지 말고 각주로 분기 — `rerank_mode = off → RAG_RECALL_K(50)`, `≠ off → rerank_candidate_k(기본 50)`. 둘 다 wide 회수이나 소스가 다름.
- **(W7/I5) D2 번복 연속성 체인**: §A8 "왜 D2 conditional escalate 를 지금 도입하나" 에 기존 v1 결정 출처 `plan/complete/spec-draft-rag-reranking.md §4.2` + `rag-search.md §3.3.2 v1 결정` + `rag-quality-improvement.md §6(2026-06-04)` 를 **명시적으로 인용**하고 "그 결정은 비용 보호용 단순화였음 → escalate 진입 구조는 안전, 정량 임계만 후속" 으로 폐기 사유 연결.
- **(W8/I6) off byte-identical 폐기 명시**: §A8 "왜 완전 선택적(off 기본)인가" 에 "리랭킹 spec 의 byte-identical 조항(`plan/complete/spec-draft-rag-reranking.md §1` / `rag-search.md §3.3.1`)을 본 D1 개정으로 **폐기**한다. 새 하위호환 정의 = '리랭커 인프라 없이 동작·점진 도입 가능' (byte-identical 아님)" 명기. off cosine θ 유지는 기각된 대안('cosine 임계 유지한 채 리랭크')과 **별개** — off 에는 리랭커가 없어 cosine θ 가 유일 관련성 게이트라 제거 대상 아님.
- **(W9) plan §6 결정 기록 갱신**: §F 에 `rag-quality-improvement.md §6` line 172 "2026-06-04 확정: 항상 LLM grading(v1)" → "2026-06-06 재결정: conditional escalate 메커니즘 도입(rag-dynamic-cut PR), 정량 임계 A/B 후속" 갱신 추가.
- **(I1) llmGradingApplied 모호성**: §A6 에 "`llmGradingApplied=false` 는 cross_encoder(escalate 없음) 와 cross_encoder_llm(escalate 미발생) 두 케이스 포함 — `rerank.mode` 로 구분" 한 줄 추가.
- **(I3) RAG_RECALL_K vs rerank_candidate_k**: §A5 에 "`RAG_RECALL_K`(50) 는 off 경로 내부 상수로, `rerank_candidate_k` 기본값(50)과 수치만 같고 독립 코드패스(KB 필드 아님)" 명기.
- **(I4) memory 정합 문구 제거**: §D 에서 "RAG 정합을 위해 동일" 문구 전체 제거, `memoryTopK`(기본5, persistent 전용)/`ragTopK`(동적, 고정 기본값 없음) 독립성으로 재서술.
- **(I7) 상수 노출**: §A5 에 "세 상수는 module-level constant — 환경변수 미노출" 명기.
- **(I11) cutoffApplied 의미 확장**: §A6 에 "`cutoffApplied` = rerank 점수 컷 / token-budget 컷 / inject-cap 컷 중 하나라도 적용 시 true (의미 확장)" 명기. 별도 `dynamicCutApplied` 필드는 v1 미신설(진단 schema 증식 회피).
