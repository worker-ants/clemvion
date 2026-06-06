# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
Scope: `spec/5-system/9-rag-search.md` (구현 diff vs 기존 spec 영역 간 충돌)  
diff-base: `origin/main`

---

## 발견사항

### [WARNING] `spec/data-flow/6-knowledge-base.md` §1.3 RAG 검색 (vector 모드) 시퀀스 다이어그램이 구현과 불일치

- **target 위치**: 구현 diff — `rag-search.service.ts` wide 회수(`LIMIT RAG_RECALL_K=50`) + 동적 컷 적용
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/data-flow/6-knowledge-base.md` 라인 116, 119
- **상세**: data-flow spec §1.3 의 vector 모드 시퀀스 다이어그램이 여전히 `search(kbId, query, topK)` 시그니처와 `SELECT chunks ... LIMIT topK` 를 기술한다. 구현 diff 는 이 경로를 `LIMIT RAG_RECALL_K(50)` 의 wide 회수 + 이후 `applyDynamicCut()` 으로 교체했다. 다이어그램이 폐기된 고정 `LIMIT topK` 선차단 모델을 그대로 보여주므로 new 독자가 실제 동작을 오해할 수 있다.
- **제안**: `spec/data-flow/6-knowledge-base.md` §1.3 시퀀스를 `search(kbId, query, threshold?)` + `SELECT ... WHERE score >= $3 LIMIT RAG_RECALL_K(50)` + `applyDynamicCut()` 흐름으로 갱신. graph 모드 §1.4 도 동일하게 `limit = kb.expanded_chunk_limit` 이후 동적 컷 단계 추가 권장(현재 graph 경로는 구현상 동적 컷 적용 경로이므로).

---

### [WARNING] `spec/1-data-model.md` §2.x `rerank_score_threshold` 설명에 `top-k` 잔존 문구

- **target 위치**: 구현 diff — `RerankParams.topK` → `injectCap + tokenBudget` 로 교체(고정 top-k 개념 제거)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/1-data-model.md` 라인 346: `"NULL 이면 컷 없이 점수순 정렬 후 top-k"`
- **상세**: 데이터 모델 spec 이 `rerank_score_threshold` 의 NULL 케이스를 "top-k" 슬라이스로 묘사하고 있다. 그러나 구현 diff 에서 고정 `topK` slice 가 `applyDynamicCut({tokenBudget, maxCount: injectCap})` 으로 교체됐으므로, NULL threshold 시에도 token-budget + inject-cap 동적 컷이 작동하지 고정 top-k 가 아니다. "top-k" 표현이 새 의미와 어긋난다.
- **제안**: `spec/1-data-model.md` 라인 346 을 "NULL 이면 점수 θ 컷 없이 token-budget + inject-cap 동적 컷(§3.4)만 적용" 으로 수정.

---

### [INFO] `spec/5-system/10-graph-rag.md` — `ragTopK` 참조가 구 의미(기본값 있음) 맥락으로 남아있을 수 있음

- **target 위치**: 구현 diff — `ragTopK` 가 `optional` (고정 기본값 없음)으로 변경
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/5-system/10-graph-rag.md` 라인 124, 158, 193, 606 — `ragTopK` 를 단순히 "(기존 그대로 유지)" 맥락으로 언급
- **상세**: Graph RAG spec 의 해당 라인들은 "`ragTopK`/`ragThreshold` 그대로 유지" 수준의 기술이어서 `ragTopK` 의 optional 화(기본값 제거)라는 의미 변화와 명시적으로 충돌하지는 않는다. 다만 "그대로 유지"라는 표현이 구 기본값(5)을 연상시키는 독자 혼선 여지가 있다.
- **제안**: 해당 라인들에 `ragTopK` 는 선택적 상한 override (미지정 시 동적 컷 §3.4 적용)임을 짧게 명기하거나, `spec/5-system/9-rag-search.md §3.4` 링크로 보완하면 충분. 필수 수정은 아님.

---

### [INFO] `spec/5-system/7-llm-client.md` §3.6 `RerankClient.rerank()` 인터페이스의 `opts.topK` 의미 vs 구현의 `candidates.length`

- **target 위치**: 구현 diff — `rerank.service.ts` 내 `client.rerank(query, candidates, model, { topK: candidates.length })` — 즉 전체 후보를 rerank 에 보내고 inject-cap 슬라이스는 `applyDynamicCut` 이 담당
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/5-system/7-llm-client.md` 라인 192: `rerank(..., opts?: { topK?: number })`
- **상세**: LLM Client spec 의 `RerankClient` 인터페이스가 `topK` 옵션을 그대로 두고 있으나, 구현이 이를 `candidates.length` 로 항상 전체 전달하므로 "inject ceiling" 의미의 `topK` 가 더 이상 `rerank()` 호출 시 의미있는 역할을 하지 않는다. 이는 `RerankClient` 인터페이스 spec 과 실제 호출 시 semantic 불일치다. 단 `RerankClient` 인터페이스 자체가 외부 provider API 래퍼이므로 provider `top_n` 파라미터를 그대로 노출하는 것이 원래 의도라면 무해하다.
- **제안**: `spec/5-system/7-llm-client.md` §3.6 에 "inject-cap 슬라이스는 `RerankService` 의 `applyDynamicCut` 이 담당하며, `rerank()` 호출 시 `topK = candidates.length` 로 전체 전달한다"는 주석을 추가하면 향후 혼선 방지. 현재 동작은 LLM Client spec 과 실제 구현이 모순은 아니나 misread 여지가 있음.

---

## 요약

구현 diff 의 핵심 변경(고정 `LIMIT topK` 선차단 → wide 회수 + `applyDynamicCut`, `RerankParams.topK` → `injectCap + tokenBudget`, `ragTopK` optional 화, `gradingNoGrounding` 신호 추가, conditional escalate 도입)은 `spec/5-system/9-rag-search.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/1-data-model.md`(§2.x rerank_* 컬럼 설명 RAG_RECALL_K 주석 포함) 와 정합성이 확인된다. 두 개의 WARNING 은 데이터 모델·데이터 흐름 spec 에 폐기된 `topK` 개념 잔재가 남아 있는 것으로, 그대로 두면 구현 또는 RAG 검색 spec 과 직접 모순이 되지만 동작을 불가능하게 만드는 수준은 아니다. 두 파일(`spec/data-flow/6-knowledge-base.md`, `spec/1-data-model.md`)을 target 구현에 맞게 갱신할 것을 권장한다.

---

## 위험도

MEDIUM
