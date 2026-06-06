# 신규 식별자 충돌 검토 결과

## 발견사항

### [INFO] `RAG_RECALL_K`(50) vs `rerank_candidate_k` default(50) — 수치 동일, 의미·경로 독립
- target 신규 식별자: `RAG_RECALL_K` (내부 상수, off 경로 wide 회수 한도)
- 기존 사용처: `spec/1-data-model.md` line 345 `rerank_candidate_k`(KnowledgeBase 컬럼, default 50), `spec/5-system/9-rag-search.md` line 185 `rerank_candidate_k(기본 50) 만큼 회수`
- 상세: 두 이름은 다르고 target 문서 §A5·(I3) 에서 "RAG_RECALL_K(50) 는 off 경로 내부 상수로, `rerank_candidate_k` 기본값(50)과 수치만 같고 독립 코드패스(KB 필드 아님)" 라고 명시 구분하고 있어 의미 충돌은 없다. 그러나 두 상수가 같은 값(50)을 가지면서 독립 관리되므로, 향후 어느 한쪽만 조정 시 오해 가능성이 있다.
- 제안: target 의 §A5 각주에 "RAG_RECALL_K 를 조정할 때 rerank_candidate_k 기본값과 수치 정합을 의도적으로 맞추는지 여부를 Rationale 에 명시" 하는 것을 권장한다. 현재 draft 는 이미 (I3) 항목으로 분리 명기하고 있으므로 큰 우려는 없다.

### [INFO] `RAG_INJECT_TOKEN_BUDGET`(8000) vs `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) — 값 동일, 도메인 분리
- target 신규 식별자: `RAG_INJECT_TOKEN_BUDGET` (내부 상수, KB 주입 token 상한)
- 기존 사용처: `codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts` line 29 `DEFAULT_MEMORY_TOKEN_BUDGET = 8000`, `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` line 55 `DEFAULT_MEMORY_TOKEN_BUDGET = 8000`, `spec/4-nodes/3-ai/1-ai-agent.md` line 52 `memoryTokenBudget | … | 8000`
- 상세: 값이 8000 으로 동일하지만, target 의 §A8 Rationale 에서 "토큰 budget 상수 명명 `RAG_INJECT_TOKEN_BUDGET` — working-memory `DEFAULT_MEMORY_TOKEN_BUDGET`(8000)과 값은 같아도 RAG prefix 로 분리(혼선 차단)" 로 의도적 분리를 명문화했다. 실제 충돌이 아닌 값 우연 일치다.
- 제안: target 이 이미 Rationale 로 분리 근거를 작성했으므로 추가 조치 불필요. 코드 구현 시 두 상수가 같은 파일/모듈에 놓이지 않도록 모듈 분리에 주의한다.

### [INFO] `cutoffApplied` — 기존 `ragDiagnostics` 스키마 내 이미 등장
- target 신규 식별자: `cutoffApplied` (§A6 — `ragDiagnostics.rerank` 서브객체 필드, token-budget/inject-cap 컷 적용 여부)
- 기존 사용처: `spec/5-system/9-rag-search.md` line 260 기존 진단 예시 JSON `"cutoffApplied": true` — 이미 `rerank_score_threshold` 기반 점수 컷 적용 여부로 사용됨
- 상세: target 이 `cutoffApplied` 의 의미를 "rerank 점수 컷 / token-budget 컷 / inject-cap 컷 중 하나라도 적용 시 true" 로 확장한다(§의 (I11) 항목). 기존에는 rerank 점수 컷 단독 의미였으나, 동적 컷 도입 후 세 가지 컷 중 하나로 의미가 넓어진다. 식별자 이름이 동일하고 의미가 확장되는 케이스다. 기존 소비자가 `cutoffApplied=true` 를 "점수 컷만" 으로 해석했다면 오해할 수 있다.
- 제안: 기존 `cutoffApplied` 의 의미가 broadening 되는 것이므로, 실제 spec 편집 시 §3.4 내 또는 §4.2 `ragDiagnostics` 표에 `cutoffApplied` 의 확장 의미를 명시 갱신한다. target 문서 §A6 (I11) 이 이미 "의미 확장" 으로 명기하고 있으므로 구현 시 spec 본문 반영만 확인하면 된다.

### [INFO] `llmGradingApplied` — 기존 spec 에 이미 존재, 의미 세분화
- target 신규 식별자: `llmGradingApplied` 설명 변경 — "conditional escalate 로 escalate 안 되면 false(정상). escalate+grading 성공 시 true"
- 기존 사용처: `spec/5-system/9-rag-search.md` line 259 기존 진단 예시 JSON `"llmGradingApplied": false` — cross_encoder_llm 이 LLM grading 을 수행했는지 여부
- 상세: 기존 의미는 "cross_encoder_llm 이 grading 을 수행했는가" 였고, target 은 여기에 "escalate 없음(cross_encoder) / escalate 미발생(cross_encoder_llm)" 구분을 추가한다. 필드명 자체는 그대로이며 의미 세분화다. 큰 충돌이 아니지만 기존 소비자(예: 모니터링 대시보드)가 `false` 를 단순히 "LLM grading 없음" 으로 해석했다면 케이스 구분이 추가된다.
- 제안: 기존 의미를 포함하는 상위 호환 확장이므로 충돌이 아니다. spec 편집 시 (I1) 항목 내용대로 "`llmGradingApplied=false` 는 cross_encoder(escalate 없음) 와 cross_encoder_llm(escalate 미발생) 두 케이스 포함 — `rerank.mode` 로 구분" 한 줄을 §4.2 에 추가한다.

## 요약

target 문서가 도입하는 신규 식별자(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`)는 기존 식별자와 이름이 겹치지 않으며, 기존 상수들과 값만 우연히 같을 뿐 도메인이 명확히 분리되어 있다. target 문서 자체(§A5 (I3), §A8 Rationale)가 이 분리 근거를 이미 명시하고 있어 운영 혼선 위험이 낮다. `cutoffApplied` 와 `llmGradingApplied` 는 기존 필드의 의미가 broadening/세분화되는 케이스인데, 두 변경 모두 target 에서 명시적으로 "의미 확장" 또는 "케이스 추가" 로 처리하고 있어 CRITICAL/WARNING 수준의 충돌이 아니다. 전반적으로 식별자 충돌 위험이 없으며 INFO 수준의 주의 사항만 존재한다.

## 위험도

LOW
