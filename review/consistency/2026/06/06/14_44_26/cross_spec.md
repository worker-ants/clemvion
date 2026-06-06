# Cross-Spec 일관성 검토 결과

대상 문서: `plan/in-progress/spec-draft-rag-dynamic-cut.md`

---

## 발견사항

### [WARNING] `ragTopK` 기본값 제거 — `spec/4-nodes/3-ai/1-ai-agent.md` §1 현행 정의와 의미 충돌
- target 위치: 섹션 B1 — "기본값 칸 `5` 제거(공란 또는 '—')"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 라인 40 — `ragTopK | Integer | | '5' | KB tool 호출 시 반환할 청크 수의 기본값 (LLM 이 호출 인자로 override 가능)`
- 상세: draft 는 `ragTopK` 를 "선택적 상한 override" 로 재정의하며 고정 기본값 개념을 제거한다. 그러나 현행 spec 은 기본값 `5` 를 명시하고, **KB tool JSON schema**(§2.1, `spec/5-system/9-rag-search.md` 라인 80) 에도 `"Default: <ragTopK>"` 로 tool description 에 노출된다. 즉 tool definition 자체가 `ragTopK` 를 `top_k` 의 "default" 값으로 LLM 에 표시하는데, `ragTopK` 가 optional 이 되면 tool description 의 `Default:` 텍스트가 공란이 되거나 내부 ceiling(12)을 표시해야 한다. draft 는 tool schema 표현 변경을 언급하지 않는다.
- 제안: draft 가 `spec/5-system/9-rag-search.md §2.1` 의 KB tool JSON schema 에서 `top_k` 의 `description` 을 갱신해 "Default: 동적 컷(내부 ceiling 12 또는 `ragTopK` 명시 시 그 값)" 류로 바꿔야 한다. A2~A5 갱신 목록에 §2.1 tool schema 갱신이 누락되어 있으니 추가 필요.

---

### [WARNING] `rerank_mode='off'` 의 `byte-identical` 하위호환 문구 제거 — `spec/5-system/9-rag-search.md` §3.3.1 및 §1 Overview 와 의미 비대칭
- target 위치: 섹션 A3 — off 행 재서술, A8 Rationale 갱신 "왜 완전 선택적인가"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` 라인 178 — `off(기본): 후처리 없음 — §3.1 SQL 그대로 (cosine 임계 + topK). **현행과 byte-identical (하위호환)**` · Overview 라인 19 "사용자는 추가 설정 없이도 기본 vector 검색을 쓰고"
- 상세: draft 는 `off` 모드 동작이 더 이상 byte-identical 이 아님을 인지하고 Rationale 에서 해당 문구를 제거하도록 지시한다. 이는 올바른 방향이나, 현행 spec §3.1 의 파라미터 표 (`$4 | 최대 결과 수 (topK) | LLM 호출 인자 또는 5`) 가 동적 컷 도입 이후에도 여전히 `LIMIT $4 — topK` 를 "최대 결과 수" 로 기술하는 기존 행이 남아 `off` 경로에서 `LIMIT` 의 의미가 이원화된다. A2 는 `$4` 행을 `RAG_RECALL_K(50)` 으로 바꾸도록 지시하지만, 이 변경은 `rerank_mode ≠ off` 에도 동일하게 적용되어야 한다 — rerank 경로에서 `LIMIT` 은 이미 `rerank_candidate_k` 를 따르는데, 단일 파라미터 표에서 두 경로 모두 `$4` 를 기술하는 방식이 모순을 만들 수 있다. 파라미터 표가 `off`/`≠off` 분기별로 `$4` 의 의미를 명확히 구분하지 않으면 혼란이 지속된다.
- 제안: 파라미터 표에 `rerank_mode = off 시`/`≠off 시` 각각의 `$4` 의미를 주석으로 분기 기재하거나, §3.1 표 각주로 분기 동작을 명시한다. 현재 draft 는 `$4` 행 1건만 `RAG_RECALL_K` 로 교체하는데, 이는 `≠off` 경로에서 `rerank_candidate_k` 와 혼용될 수 있다.

---

### [WARNING] `spec/4-nodes/3-ai/0-common.md` §2 의 `ragTopK` 설명 — `graph` 모드 동작 기술 불완전
- target 위치: 섹션 C — "ragTopK | Integer | RAG 주입 청크 수 상한(미지정 시 동적 컷이 지배; 명시 시 ceiling). graph 모드 KB 에서도 동일. (RAG 검색 §3.4)"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/10-graph-rag.md` 라인 417 `[7] 상위 ragTopK 만 컨텍스트에 주입` + 라인 471 `LIMIT $5; -- ragTopK`
- 상세: `graph` 모드에서는 `ragTopK` 가 **SQL 레벨 `LIMIT $5`** 로 직접 바인딩된다. 동적 컷(§3.4, token-budget + inject-cap)은 app-layer 후처리인데, graph 모드 SQL 은 현재 `LIMIT $5 = ragTopK` 로 하드코딩되어 있다. draft 섹션 E 는 graph-rag.md 라인 417/471 을 동적 컷 참조로 교체하도록 지시하나, 교체 후에는 graph 모드 SQL `LIMIT $5` 가 내부 `RAG_RECALL_K`(50)에 맞춰 wide 회수로 교체되어야 한다는 사실이 draft 에 누락되어 있다. `graph` 모드는 `expanded_chunk_limit`(KB 필드 기본 15) 이라는 별도 상한이 존재하며(데이터 모델 `KnowledgeBase.expanded_chunk_limit`), 이 필드와 `RAG_RECALL_K` / 동적 컷의 우선순위 관계가 draft 어디에도 명시되지 않는다.
- 제안: draft 섹션 E 에서 graph-rag.md SQL `LIMIT $5` 를 어떻게 바꿀 것인지(wide 회수 후 app-layer 컷으로 전환인지, 기존 `expanded_chunk_limit` 상한을 유지할 것인지) 명시적으로 결정해야 한다. 현재 draft 는 라인 417/471 텍스트만 교체하고 SQL LIMIT 변경을 언급하지 않아, graph 모드의 실제 동작과 spec 텍스트가 불일치할 수 있다.

---

### [WARNING] `spec/5-system/17-agent-memory.md` 라인 83 기술 — `memoryTopK` 기본값 `5` 유지 vs `ragTopK` 동적 컷 전환 비교 기술
- target 위치: 섹션 D — "`memoryTopK` 는 기본 `5`(persistent 메모리 전용)이며, KB 검색용 `ragTopK` 는 동적 컷 도입으로 고정 기본값이 없다"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/17-agent-memory.md` 라인 83 — "기본값은 RAG 정합을 위해 동일(`5` / `0.7`)하나 별도 필드다."
- 상세: 현행 spec 은 `memoryTopK=5` 와 `ragTopK=5` 가 "RAG 정합을 위해 동일" 하다고 기술한다. draft 는 이 라인을 수정해 `ragTopK` 는 더 이상 고정 기본값이 없음을 명시하려 한다. 변경 자체는 논리적으로 일관성 있으나, `memoryTopK` 기본 `5` 가 유지되면 두 필드의 "RAG 정합" 근거가 소멸한다. "정합을 위해 동일" 이라는 기술은 이제 완전히 삭제되어야 하며, 단순 수치 우연 일치를 "RAG 정합" 으로 표현하면 오독 가능성이 생긴다.
- 제안: draft 의 D 섹션 수정은 올바르다. 단 "RAG 정합을 위해 동일" 문구 전체를 제거하고, `memoryTopK` 와 `ragTopK` 의 독립성 + 각자의 기준(persistent 메모리 전용 / KB 검색 상한 override)을 서술하도록 표현을 재작성해야 한다.

---

### [INFO] `spec/5-system/9-rag-search.md` §4.2 `llmGradingApplied` 필드 — 기존 `false` 기본값과 D2 재해석 후 기술 정합
- target 위치: 섹션 A6 — "`llmGradingApplied` 설명: cross_encoder_llm 이라도 conditional escalate 로 escalate 안 되면 false(정상)"
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` 라인 259 — `llmGradingApplied: false` (ragDiagnostics 예시 값)
- 상세: 현행 spec 예시에서 `llmGradingApplied: false` 는 `cross_encoder` 모드일 때를 보여준다. draft 후 `cross_encoder_llm` 에서도 escalate 미발생 시 `false` 가 되어 두 모드가 동일 진단 값을 보일 수 있다. 진단 값만으로는 "escalate 안 된 `cross_encoder_llm`" 과 "`cross_encoder`" 를 구분할 수 없게 되는데, 이 사실이 spec 에서 명시되지 않으면 UI/로그 해석 혼선이 생길 수 있다. 
- 제안: A6 에서 `llmGradingApplied=false` 의 의미가 두 케이스를 포함함을 명시하거나, `ragDiagnostics.rerank.mode` 필드로 두 케이스를 구분할 수 있음을 한 줄 추가한다. 단독으로 Critical 급은 아니나 documentation 정확도를 위해 sync 권장.

---

### [INFO] `spec/5-system/9-rag-search.md` §2.1 KB tool schema 의 `top_k` default 표현 — 내부 ceiling 값 노출 여부 미결
- target 위치: 섹션 A2~A5 전반 (동적 컷 도입), B1 (`ragTopK` optional 화)
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` 라인 80 — `"Default: <ragTopK>"`
- 상세: `ragTopK` 가 optional 이 된 이후 KB tool JSON schema 의 `top_k.description` 에서 `<ragTopK>` 의 fallback 값이 무엇인지 명시 필요하다. `RAG_MAX_INJECT_COUNT(12)` 를 tool description 에 그대로 노출할지, "동적 컷에 의해 결정됨" 문구로 대체할지 결정되어 있지 않다. LLM 이 `top_k` 를 효과적으로 override 하려면 기본 동작을 이해해야 하므로 description 이 명확해야 한다.
- 제안: A2 또는 §2.1 갱신 항목에서 `top_k` 의 tool description 을 명시적으로 갱신한다. 예: "Number of chunks to inject. If omitted, the system applies a dynamic token-budget cut (internal ceiling 12)."

---

### [INFO] `RAG_RECALL_K`(50) 상수 — `KnowledgeBase.rerank_candidate_k` 기본값(50)과 수치 일치, 의미 분리 명문화 필요
- target 위치: 섹션 A5 — `RAG_RECALL_K(50)` 내부 상수 정의
- 충돌 대상: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.11 — `rerank_candidate_k | Integer | 리랭크에 투입할 1차 회수 후보 수 (default 50, 허용 범위 1~200). rerank_mode = 'off' 시 무시`
- 상세: `RAG_RECALL_K=50` 과 `rerank_candidate_k` 기본값 `50` 이 동일하지만, draft 는 두 값이 독립적으로 작동함을 기술하지 않는다. `off` 모드의 wide 회수는 `RAG_RECALL_K` 상수(변경 불가 내부값)를 쓰고, `≠off` 모드는 `rerank_candidate_k` KB 필드(사용자 설정 가능)를 쓰는 구분이 명확해야 한다. 우연의 일치가 혼선을 유발할 수 있다.
- 제안: A5 또는 A8 Rationale 에서 "off 모드의 `RAG_RECALL_K=50` 은 `rerank_candidate_k` 기본값과 수치가 동일하나 독립적인 코드패스(내부 상수 vs KB 필드)"라고 명시한다.

---

### [INFO] `spec/5-system/9-rag-search.md` frontmatter `pending_plans` — `rag-dynamic-cut.md` 추가 지시(A1)는 현행 spec 파일 미반영 상태
- target 위치: 섹션 A1 — `pending_plans:` 에 `plan/in-progress/rag-dynamic-cut.md` 추가
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` 라인 8 — `pending_plans: [plan/in-progress/rag-rerank-followup.md]` (단 1건)
- 상세: 현행 spec frontmatter 에는 `rag-dynamic-cut.md` 가 없다. draft 가 spec 적용 완료 시 plan 파일이 존재한다면 `pending_plans` 에 추가해야 하는데, 이는 spec 작성 단계에서 유효한 기재다. 충돌이라기보다 단순 누락 — spec 실제 수정 시 A1 을 먼저 적용한 뒤 나머지를 진행하면 된다.
- 제안: 별도 조치 불필요. spec 수정 PR 에서 A1 이 가장 먼저 적용되도록 순서를 지킨다.

---

## 요약

draft 의 핵심 설계(D1 동적 컷 + D2 conditional escalate)는 기존 spec 과 직접 모순되는 Critical 충돌 없이 일관성을 유지한다. 그러나 세 개의 WARNING 이 주의를 요한다. 가장 영향 범위가 넓은 것은 `ragTopK` optional 화에 따른 KB tool JSON schema(`§2.1`) 갱신 누락(W1)으로, LLM 이 tool description 에서 `top_k` 의 의미를 오독할 수 있다. 두 번째는 graph-rag.md SQL `LIMIT $5` 의 실제 변경 여부가 draft 에 지정되지 않아(W3) graph 모드 동작과 spec 텍스트가 불일치할 가능성이 있다. 세 번째는 `§3.1` 파라미터 표에서 `off`/`≠off` 경로 모두 `$4` 를 공유하는 구조적 모호성(W2)이다. INFO 급은 상수 수치 우연 일치 설명, `llmGradingApplied` 해석 명문화, tool schema 표현 등 문서 명확도 관련이다.

---

## 위험도

MEDIUM
