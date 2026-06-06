# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
scope: `spec/5-system/9-rag-search.md` (구현 변경 기준)  
diff-base: `origin/main`

---

## 발견사항

### [INFO] `RerankClient.rerank()` 인터페이스의 `topK` 의미 변경 — spec/7-llm-client.md 미갱신

- **target 위치**: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` — `RerankService.rerankCandidates()` 내부에서 `client.rerank(..., { topK: candidates.length })` 로 호출 (전체 후보 수를 전달해 내부 컷을 사용하지 않음)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/5-system/7-llm-client.md` §3.6 `RerankClient` 인터페이스: `opts?: { topK?: number }` — 여기서 `topK` 가 "클라이언트 레벨 결과 수 컷" 으로 문서화되어 있으나, 구현에서는 `candidates.length` 를 전달해 클라이언트 컷을 무력화하고 실제 주입 수 결정권을 `RerankService` 의 `applyDynamicCut` 으로 이전함
- **상세**: spec/7-llm-client.md 는 `RerankClient.rerank` 의 `topK` 파라미터 의미에 대해 별도 설명이 없다. 실제 구현 변경(D1) 이후 `topK` 는 "외부 컷" 이 아닌 "전체 후보 수 = 모두 점수화" 의미로만 쓰인다. 이 의미 변화가 spec 에 기록되지 않았다. 다른 구현자가 `RerankClient.rerank(topK=5)` 처럼 작은 값을 넣으면 동적 컷이 5 이상의 후보를 볼 수 없게 되는 회귀 위험이 있다.
- **제안**: `/spec/5-system/7-llm-client.md` §3.6 의 `RerankClient.rerank` `topK` 파라미터 주석에 "v1 이후 `RerankService` 는 `candidates.length` 를 전달해 클라이언트 레벨 컷을 비활성화함 — 최종 주입 수는 `RerankService.applyDynamicCut` 이 결정" 을 추가.

---

### [INFO] `spec/data-flow/6-knowledge-base.md` — `applyDynamicCut` 참조 이미 동기화됨 (확인)

- **target 위치**: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` 신규 생성
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/data-flow/6-knowledge-base.md` line 121: `R->>R: applyDynamicCut(token-budget + inject-cap) — 최종 주입 결정 (RAG 검색 §3.4)` — 이미 동기화됨
- **상세**: data-flow 에 `applyDynamicCut` 참조가 이미 갱신돼 있어 모순 없음. 충돌 없음(INFO 수준 확인).
- **제안**: 불요.

---

### [INFO] Graph RAG spec KB-GR-SR-05 의 `topK` 표현이 동적 컷 도입 이후 모호해짐

- **target 위치**: 구현 변경으로 graph 모드 결과도 최종적으로 `applyDynamicCut` 을 거침 (`rag-search.service.ts` — `merged` 에 graph + vector 결과 포함 후 동적 컷 적용)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/5-system/10-graph-rag.md` line 115: `KB-GR-SR-05`: "centrality-weighted score blending … 상위 `topK` 반환" — 여기서 `topK` 가 graph 내부 1차 정렬의 결과 수처럼 읽힌다. D1 이후 graph 결과는 graph 내부 정렬 후 vector 결과와 merge 되고, 최종 주입 수는 §3.4 동적 컷이 결정한다.
- **상세**: 모순이라기보다 D1 이전에 작성된 표현("상위 `topK` 반환")이 동적 컷 도입 후 의미가 불명확해진 것. spec/10-graph-rag.md 의 §4 (검색 흐름) line 417 이미 `applyDynamicCut` 참조를 포함하고 있어 실제 충돌은 경미하다. 단, KB-GR-SR-05 의 `topK` 표현이 여전히 "고정 상위 K 반환"처럼 읽힌다.
- **제안**: `spec/5-system/10-graph-rag.md` KB-GR-SR-05 에 "graph 내부 정렬 후 §3.4 동적 점수 컷(token-budget + inject-cap)으로 최종 주입 수 결정" 을 명시.

---

### [INFO] `spec/4-nodes/4-integration/_product-overview.md` KB-AG-04 에 `ragTopK` 언급 — optional 변경 미반영

- **target 위치**: 구현 변경: `ai-agent.schema.ts` — `ragTopK` 를 `optional` 로 변경 (기존 `.default(5)` 제거)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/4-nodes/4-integration/_product-overview.md` line 153: `KB-AG-04`: "AI Agent 노드는 그대로 `ragTopK` / `ragThreshold` 만 노출" — `ragTopK` 가 optional 이 됐다는 점이 명시되지 않음
- **상세**: KB-AG-04 의 서술 자체는 여전히 올바르다("AI Agent 노드는 `ragTopK` / `ragThreshold` 만 노출"). 그러나 `ragTopK` 의 semantics(기본값 5 고정 → optional, 미지정 시 동적 컷)가 이 문서에는 반영되지 않았다. `spec/4-nodes/3-ai/1-ai-agent.md` 는 이미 올바르게 갱신됐다.
- **제안**: `spec/4-nodes/4-integration/_product-overview.md` KB-AG-04 에 `ragTopK` optional 변경 내용을 간단히 반영하거나, 상세는 `1-ai-agent.md` 참조로 포인터만 추가.

---

## 요약

이번 구현(RAG 동적 점수 컷, D1·D2)은 핵심 `spec/5-system/9-rag-search.md` 와 `spec/4-nodes/3-ai/1-ai-agent.md` 가 이미 D1·D2 내용으로 완전히 갱신된 상태에서 이루어졌다. 구현 코드(`dynamic-cut.util.ts`, `rerank.service.ts`, `rag-search.service.ts`, `kb-tool-provider.ts`, `ai-agent.schema.ts` 등)와 해당 spec 사이의 직접 모순은 발견되지 않는다. 지적된 항목 3건은 모두 INFO 수준이며, 주로 주변 spec 문서(`7-llm-client.md`, `10-graph-rag.md`, `4-nodes/4-integration/_product-overview.md`)의 명시 보강 필요로 운영상 충돌은 없다. CRITICAL 또는 WARNING 등급의 Cross-Spec 충돌은 없다.

## 위험도

LOW
