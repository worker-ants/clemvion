# 요구사항(Requirement) 리뷰

리뷰 대상: RAG 동적 컷(D1) + conditional escalate(D2) spec 변경 — consistency-check 산출물(파일 1~9) + spec 본문 직접 편집(파일 10~15)

---

## 발견사항

### [WARNING] `pending_plans` 등록 — 4개 spec 파일 미등록 (plan-coherence 지적 미해소)
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/10-graph-rag.md` frontmatter
- 상세: consistency-check SUMMARY W10 은 이 4개 spec 파일에 본 plan(`rag-dynamic-cut.md` 또는 `spec-draft-rag-dynamic-cut.md`)을 `pending_plans` 에 등록하도록 권고했다. 실제 편집된 파일들을 확인한 결과, 네 파일 모두 `pending_plans` 에 본 plan 이 추가되지 않은 채로 spec 본문만 수정됐다. `spec/5-system/9-rag-search.md` 에는 `plan/in-progress/rag-dynamic-cut.md` 가 추가됐으나 (`plan-lifecycle.md §5 spec-pending-plan-existence.test.ts` 통과 조건 충족), 나머지 4개 파일은 미등록 상태다. `spec-impl-evidence.md §2.1` 규약상 `pending_plans:` 는 편집 대상 spec 파일이 pending 상태임을 선언하는 필수 항목이다.
- 제안: `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/17-agent-memory.md` frontmatter 에 각각 `  - plan/in-progress/rag-dynamic-cut.md` (또는 `spec-draft-rag-dynamic-cut.md`) 1줄을 추가한다.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — `status: implemented` 편집 후 status 재검토 명기 없음
- 위치: `spec/5-system/10-graph-rag.md` frontmatter
- 상세: consistency-check plan_coherence INFO I8 은 `10-graph-rag.md` 가 `status: implemented` 인데 경미한 주석/흐름 수정이지만 status 재검토 의도를 명기하도록 권고했다. 실제 파일에서 `status: implemented` 는 그대로이며, 변경된 라인 417(step [7]) · 라인 471(SQL 주석)이 단순 주석/설명 교체임을 spec 내에 기록하지 않는다. `spec-status-lifecycle` 테스트가 `implemented` 파일 편집 후 재검토를 강제하지 않더라도, 의도적 유지를 명문화하지 않으면 이후 독자가 status 를 판단할 근거가 없다.
- 제안: `10-graph-rag.md` 의 편집된 섹션(§4.1 step [7] 또는 §4.2 SQL 주석) 근처에 1줄 인라인 노트를 추가하거나, plan draft §E 에 "status: implemented 유지 — 동작 변경 없는 설명/주석 교체, spec-status-lifecycle 가드 통과" 를 명기한다.

---

### [WARNING] `spec/5-system/9-rag-search.md` §3.3.2 step 1 — `rerank_candidate_k` vs. `RAG_RECALL_K` 표현 불일치
- 위치: `spec/5-system/9-rag-search.md` 라인 202 (`1) wide 회수: cosine 임계 미적용, rerank_candidate_k(기본 50) 만큼 회수`)
- 상세: draft §A4 step 1 갱신 지시는 "wide 회수: cosine 임계 미적용, RAG_RECALL_K(50) 회수 (rerank_candidate_k 와 정합)" 으로 명시했다. 그러나 최종 편집된 spec §3.3.2 step 1 은 `rerank_candidate_k(기본 50)` 를 그대로 유지하고 있다. `rerank_mode ≠ off` 경로에서 `$4` 바인딩 값이 `rerank_candidate_k` 인지 `RAG_RECALL_K` 인지(두 경로의 회수 상수가 다른지 같은지)를 spec §3.1 파라미터 표(`$4` 행 설명)와 §3.3.2 step 1 이 일관되게 서술해야 한다. 현재 §3.1 파라미터 표 `$4` 행은 "rerank_mode=off: 내부 상수 `RAG_RECALL_K`(50) / ≠off: `rerank_candidate_k`(기본 50)" 으로 구분하고 있어 §3.3.2 step 1 이 `rerank_candidate_k` 를 쓰는 것 자체는 spec 내 일관성이 있다. 그러나 draft 지시와의 불일치가 있으므로 의도적 변경인지 편집 누락인지 확인 필요하다.
- 제안: `rerank_mode ≠ off` 경로는 `rerank_candidate_k` (KB 설정 필드) 를 사용하는 것이 맞다면 §3.3.2 step 1 현행 유지가 정확하다. draft §A4 지시와의 차이는 draft 가 "RAG_RECALL_K 와 정합" 을 설명하려다 표현이 모호해진 것으로 보인다 — 두 경로(off vs ≠off)가 각각 별개 상수를 쓰는 정확한 설계이므로, spec 본문은 현행이 더 정확하다.

---

### [INFO] [SPEC-DRIFT] `spec/5-system/9-rag-search.md` §3.4 신규 섹션 — `rag-rerank-followup.md` 에 pgvector 인덱스 파라미터 follow-up 명세 미반영
- 위치: `spec/5-system/9-rag-search.md` §3.4 마지막 bullet (`pgvector 인덱스 파라미터 (follow-up)`)
- 상세: §3.4 에 "`hnsw.ef_search` / `ivfflat.probes` 파라미터가 적합한지 프로덕션 부하 측정 후 조정이 필요할 수 있다 — 필요 시 DB 세션 파라미터 또는 KB config 로 노출(후속)" 이라는 follow-up 항목이 추가됐다. 이 후속 작업이 `rag-rerank-followup.md` 또는 별도 plan 에 등록돼 있는지 spec 에서 참조하지 않는다. plan/in-progress 수준에서 추적되지 않으면 관리 사각지대가 생긴다. 코드 동작에는 영향 없는 spec 갱신 누락이다.
- 제안: 코드 유지 + `plan/in-progress/rag-rerank-followup.md` (또는 신규 follow-up plan)에 "pgvector ANN 파라미터(`hnsw.ef_search`, `ivfflat.probes`) wide 회수(50) 후 재현율 측정 후 조정" 항목 추가를 검토한다.

---

### [INFO] `spec/5-system/9-rag-search.md` §2.1 — `top_k` description 갱신이 §A 공식 편집 지시가 아닌 보조 섹션에만 있었는데 최종 편집에는 반영됨 (해소 확인)
- 위치: `spec/5-system/9-rag-search.md` 라인 79 (`"top_k"` description)
- 상세: cross_spec 검토 INFO I1 과 SUMMARY I1 은 §2.1 `top_k` description 갱신이 draft 의 보조 섹션에만 언급되고 §A 공식 편집 지시에 없어 누락 위험이 있다고 경고했다. 최종 편집을 확인한 결과, `"top_k": { "type": "integer", "description": "Max chunks to inject. If omitted, a dynamic token-budget cut applies (internal ceiling). Increase for broader recall." }` 로 갱신됐다. 해소됨.

---

### [INFO] consistency-check 2차 산출물 (`14_53_44`) SUMMARY W4 — graph SQL `$5` 바인딩 확인 요청 미처리 여부
- 위치: `spec/5-system/10-graph-rag.md` 라인 471 (SQL `LIMIT $5` 주석)
- 상세: SUMMARY W4 는 `graph-rag.md` SQL `$5` 바인딩이 현행 코드에서 여전히 `ragTopK` 를 바인딩하는지 확인하라고 했다. 최종 편집된 spec 에서 주석은 `-- 회수 폭(recall): vectorSeedTopK + expandedChunkLimit. 최종 주입 청크 수는 app-layer 동적 점수 컷(RAG 검색 §3.4)이 결정` 으로 교체됐다. 코드 확인 없이 주석만 교체됐을 경우 spec-impl 불일치 위험이 남는다. 단, 이 리뷰는 spec 문서 변경 범위이므로 코드 검증은 developer 단계의 책임이며, spec 단계에서는 WARNING 수준의 미결 사항으로 기록한다.
- 제안: developer 구현 착수 시 `rag-search.service.ts` graph 분기에서 `$5` 바인딩이 실제로 `vectorSeedTopK + expandedChunkLimit` 인지 확인 후, 아닐 경우 코드 변경을 함께 수행한다.

---

### [INFO] consistency-check 1차 산출물 (`14_44_26`) vs 2차(`14_53_44`) — 두 세션의 `rationale_continuity.md` 내용 차이
- 위치: `review/consistency/2026/06/06/14_44_26/rationale_continuity.md` (파일 1) vs `review/consistency/2026/06/06/14_53_44/rationale_continuity.md` (파일 9)
- 상세: 두 산출물은 동일 target(`spec-draft-rag-dynamic-cut.md`)을 검토했지만 발견사항 구조와 심도가 다르다. 1차 산출물은 연속성 체인이 불완전하다는 점에서 WARNING 2건을 도출했고, 2차는 "확정 텍스트가 아닌 편집 지시 형태로만 존재" 라는 더 구체적 진단을 내렸다. 최종 편집된 `spec/5-system/9-rag-search.md §Rationale` 를 확인한 결과 — "왜 D2 conditional escalate 를 지금 도입하나" 항목에 기존 결정 출처 3곳 직접 인용(`spec-draft-rag-reranking.md §Rationale`, 본 문서 §3.3.2 구판 v1 결정, `rag-quality-improvement.md §6` 2026-06-04 확정)이 확정 텍스트로 명기됐고, "byte-identical 조항 폐기" 도 확정 문구로 삽입됐다. 두 WARNING 모두 최종 편집에서 해소됐다.

---

### [INFO] `_retry_state.json` (파일 3) — `agents_success` 필드가 빈 배열로 남아 있음
- 위치: `review/consistency/2026/06/06/14_53_44/_retry_state.json` `agents_success: []`
- 상세: `_retry_state.json` 의 `agents_success` 가 `[]` 이고 `agents_pending` 에 5개 checker 가 남아 있다. 이는 retry 상태 파일이 모든 sub-agent 완료 후 최종 상태로 갱신되지 않은 채 커밋된 것으로 보인다. 5개 checker 산출물(`cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `plan_coherence.md`, `naming_collision.md`)과 SUMMARY.md 가 모두 존재하므로 실제 검토 결과는 완료됐다. 다만 상태 파일 자체의 불일치가 이후 재실행 시 혼선을 줄 수 있다.
- 제안: 후속 일관성 검토 실행 시 이전 상태 파일이 `agents_pending` 잔재로 재실행 트리거를 발생시키지 않는지 확인. 기능 영향은 없으나 정리 권장.

---

## 요약

파일 10~15 의 실제 spec 편집 내용을 확인한 결과, 핵심 설계 변경(D1 동적 컷 §3.4 신규 섹션, D2 conditional escalate §3.3.1·§3.3.2 갱신, Rationale 전면 보강)은 spec-draft-rag-dynamic-cut.md 의 편집 지시를 충실히 반영했다. consistency-check SUMMARY 에서 가장 위험도가 높은 WARNING(W6·W7 — Rationale 확정 텍스트 누락)도 최종 spec 편집에서 해소됐다. 그러나 두 건의 기능 완전성 관련 WARNING 이 미해소로 남아 있다. 첫째, 수정 대상 4개 spec 파일(`1-ai-agent.md`·`0-common.md`·`17-agent-memory.md`·`10-graph-rag.md`)에 본 plan 의 `pending_plans` 등록이 누락돼 `spec-pending-plan-existence.test.ts` 또는 동등 검증에서 실패할 가능성이 있다. 둘째, `10-graph-rag.md` 의 `status: implemented` 편집에 대한 의도적 유지 근거가 문서화되지 않았다. 두 항목 모두 spec 내용의 사실 오류가 아니라 규약 준수 및 추적성 문제이므로 MEDIUM 위험도 수준이다.

---

## 위험도

MEDIUM
