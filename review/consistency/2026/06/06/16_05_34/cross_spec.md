### 발견사항

- **[INFO]** data-flow/6-knowledge-base.md §1.3 시퀀스 다이어그램 미동기화
  - target 위치: 구현 변경 전체 (dynamic-cut D1)
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/data-flow/6-knowledge-base.md` §1.3 RAG 검색 (vector 모드) 시퀀스 다이어그램 (line 116–121)
  - 상세: 다이어그램이 `H->>R: search(kbId, query, topK)` → `R->>PG: SELECT chunks ORDER BY embedding <=> query_vec LIMIT topK` 로 여전히 고정 topK 인자를 넘기는 구 흐름을 묘사한다. D1 이후 off 경로는 `RAG_RECALL_K(50)` 고정 wide 회수 → app-layer 동적 컷이며, `topK` 인자는 더 이상 LIMIT 에 직접 매핑되지 않는다. `spec/5-system/9-rag-search.md §3.1` 의 `$4 = RAG_RECALL_K(50)` 기술과 모순.
  - 제안: `spec/data-flow/6-knowledge-base.md` §1.3 다이어그램을 `H->>R: searchWithMeta(query, kbIds, workspaceId, {topK?, threshold})` / `R->>PG: ... LIMIT RAG_RECALL_K(50)` / `R->>R: applyDynamicCut(...)` 흐름으로 갱신해 9-rag-search.md §3.1 과 동기화한다.

- **[INFO]** spec/5-system/7-llm-client.md §3.6 RerankClient.rerank() opts.topK 사용 의미 미동기화
  - target 위치: `rerank.service.ts` 변경 — `client.rerank(query, ..., { topK: candidates.length })` (모든 후보 재점수화)
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/5-system/7-llm-client.md` §3.6 (line 192) `opts?: { topK?: number }` 주석 부재
  - 상세: spec §3.6 은 `opts.topK` 의 의미를 "클라이언트가 반환할 후보 수 상한" 으로 암묵적으로 기술한다. D1 구현은 내부적으로 `topK = candidates.length` (전 후보 재점수화)로 고정하여 최종 COUNT 결정을 `applyDynamicCut` 에 위임한다. spec §3.6 에 이 동작 변경이 기술되지 않아 `opts.topK` 가 항상 전체 후보 수가 됨을 spec 소비자가 알기 어렵다. 모순이라기보다는 의도적 계약의 기술 공백.
  - 제안: `spec/5-system/7-llm-client.md` §3.6 의 `rerank()` 인터페이스 주석에 "D1 이후 `RerankService` 는 `opts.topK = candidates.length` 로 전 후보 재점수화하고, 최종 주입 COUNT 는 app-layer `applyDynamicCut` 이 결정한다" 는 노트를 추가한다.

- **[INFO]** spec/4-nodes/3-ai/1-ai-agent.md §7 출력 메타 예제에 `gradingNoGrounding` 미반영
  - target 위치: `rerank.service.ts` 변경 — `RerankDiagnostics.gradingNoGrounding` 신규 필드
  - 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/spec/4-nodes/3-ai/1-ai-agent.md` §7 출력 메타 예제 (line 471–496, line 868, line 1048–1063)의 `ragDiagnostics.rerank` 서브객체 JSON 예제
  - 상세: `spec/5-system/9-rag-search.md §4.2` 는 `gradingNoGrounding` 필드를 정의했으나 `1-ai-agent.md` 의 출력 메타 JSON 예제들은 해당 필드를 포함하지 않아 schema 표현이 구 버전으로 남는다. 구현이 `gradingNoGrounding` 를 항상 emit 하므로 예제와 실제 shape 가 다르다.
  - 제안: `1-ai-agent.md` §7 출력 메타 예제의 `rerank` 서브객체에 `"gradingNoGrounding": false` 를 추가하고, grounding=none 사례 예제도 선택적으로 추가한다.

---

### 요약

구현 변경(D1 동적 컷 + D2 gradingNoGrounding)은 SoT 인 `spec/5-system/9-rag-search.md` 와 직접 충돌하는 내용이 없다. 해당 spec 이 이미 §3.4·§3.3.2·§4.2 에서 동적 컷·conditional escalate·gradingNoGrounding 을 정의하고 있으며 `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/5-system/10-graph-rag.md §4`, `spec/4-nodes/3-ai/0-common.md §4` 의 `ragTopK optional` 기술도 일관된다. 미동기화 항목은 세 가지이며 모두 INFO 등급 — `spec/data-flow/6-knowledge-base.md §1.3` 시퀀스 다이어그램이 D1 이전 고정 topK LIMIT 흐름을 그대로 표시하는 것, `spec/5-system/7-llm-client.md §3.6` 의 `RerankClient.rerank()` 계약에 전 후보 재점수화 사용 설명이 없는 것, `spec/4-nodes/3-ai/1-ai-agent.md §7` 의 출력 메타 예제가 신규 `gradingNoGrounding` 필드를 누락한 것이다. 어느 것도 두 영역이 동시에 작동 불가하게 만드는 모순이 아니며 채택을 차단하지 않는다.

### 위험도

LOW
