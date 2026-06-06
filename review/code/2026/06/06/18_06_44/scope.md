# 변경 범위(Scope) Review

## 리뷰 대상

RAG P1 후속 — #3 pgvector ef_search recall 보전 + #2 주변 spec 정합
(plan: `plan/in-progress/rag-followup-efsearch.md`)

---

## 발견사항

### 파일 1-4: 핵심 ef_search 구현 + 단위 테스트

**[INFO] dynamic-cut.util.ts — `hnswEfSearchFor` 신규 함수 및 상수 추가**
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts`
- 상세: `HNSW_EF_SEARCH_DEFAULT`, `HNSW_EF_SEARCH_MAX`, `hnswEfSearchFor` 추가. `dynamic-cut.util.ts` 는 이미 RAG 파라미터 상수(`RAG_RECALL_K` 등)를 소유하는 파일이므로 ef_search 관련 상수·헬퍼를 이 파일에 추가하는 것은 논리적으로 적절하다. 변경 범위 내.

**[INFO] dynamic-cut.util.spec.ts — `hnswEfSearchFor` 단위 테스트 추가**
- 위치: `codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.spec.ts`
- 상세: 새로 추가된 `hnswEfSearchFor` 함수의 clamping 및 비유한 입력 방어 테스트. 신규 함수에 정확히 대응하는 테스트이며 기존 `applyDynamicCut` 테스트는 건드리지 않았다. 변경 범위 내.

**[INFO] rag-search.service.ts — `searchVectorGroup` 트랜잭션 래핑 + SET LOCAL**
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts`
- 상세: 기존 `this.dataSource.query(...)` 를 `this.dataSource.transaction(async (em) => { await em.query(SET LOCAL ...); return em.query(...); })` 로 교체. ef_search 목적에 최소 범위로 정확히 수정. graph 코드(`searchSeedAndExpand`)에 코멘트 1줄 추가(ef_search 미적용 이유 설명)는 설명 목적에 부합. 변경 범위 내.

**[INFO] rag-search.service.spec.ts — 트랜잭션 mock + SET LOCAL 순서 단언 추가**
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts`
- 상세: `mockEm`(SET LOCAL 흡수 + recall SQL 위임)·`mockDataSource.transaction` 설정 + 신규 테스트 2건(`off 경로 ef_search 상향`, `rerank wide 회수 ef_search 상향`). 신규 구현의 동작을 정확히 검증하며 기존 테스트 구조(mockResolvedValueOnce 체인·SQL 호출 인덱스)는 그대로 유지했다. 변경 범위 내.

---

### 파일 5-6: e2e + docker-compose (이종 PR 산출물 포함)

**[WARNING] execution-park-resume.e2e-spec.ts — 본 PR 범위(ef_search) 와 무관한 변경**
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: 이 파일의 변경(DB INSERT 우회 → `POST /api/llm-configs` 정식 경로 교체)은 `exec-park-b2a-followup` 의 item ④ 내용이며, 본 PR(`rag-followup-efsearch`)의 ef_search / spec 정합 목적과 직접적 관련이 없다. plan 파일 `rag-followup-efsearch.md`의 `spec_impact` 목록(9-rag-search, 7-llm-client, 10-graph-rag, 4-integration)에도 포함되지 않는다. 별도 `exec-park-b2a-followup` worktree의 작업 산출물이 이 PR 브랜치에 같이 포함된 것으로 판단된다(plan 메모에서 "orphaned #2/#3 diff → fresh main 적용"으로 재상륙 언급 — exec-park-b2a-followup worktree 와 rag-followup-efsearch worktree 커밋이 동일 브랜치에 묶인 것으로 보임).
- 제안: 이 변경의 커밋 히스토리를 확인하여 `exec-park-b2a-followup` 의 커밋이 의도적으로 이 PR에 포함됐는지 검토 필요. ef_search PR은 RAG 코드만 포함하는 것이 범위 관리상 바람직하다.

**[WARNING] docker-compose.e2e.yml — `ENCRYPTION_KEY` 64-hex 교정도 ef_search 와 무관**
- 위치: `docker-compose.e2e.yml`
- 상세: `ENCRYPTION_KEY: 0123456789abcdef...` 를 32-char → 64-hex로 교정한 변경은 `crypto.util.ts` AES-256-GCM 키 길이 요건 수정이며 `exec-park-b2a-followup` item ④(a)의 내용이다. ef_search 구현(RAG 벡터 검색 SET LOCAL)과는 무관하다. 파일 5와 동일한 이종 PR 혼입 상황.
- 제안: 파일 5와 같이 커밋 분리 검토.

---

### 파일 7-11: plan 파일 변경

**[INFO] plan/complete/fix-carousel-waiting-status.md — `spec_impact` frontmatter 추가**
- 위치: `plan/complete/fix-carousel-waiting-status.md`
- 상세: 완료된 plan에 `spec_impact:` 필드 추가. 이 파일은 `fix-carousel-waiting-status` 작업의 plan으로 본 PR 범위와 전혀 관련 없다. 다만 변경 자체가 2줄(frontmatter 필드 추가)에 불과하며 기능 동작과 관련 없는 plan 메타데이터 정비로 보인다.
- 제안: scope 이탈이긴 하나 영향이 극소(2줄 frontmatter)이고 plan 파일 정비 목적으로 수용 가능한 수준.

**[INFO] plan/complete/spec-draft-rag-reranking.md — "항상 grading → conditional escalate" 결정 번복 SUPERSEDED 표기 추가**
- 위치: `plan/complete/spec-draft-rag-reranking.md`
- 상세: 완료된 plan의 결정 항목에 `[SUPERSEDED 2026-06-06]` 주석 추가. 과거 결정이 PR #500(D2)에서 번복됐음을 기록한 정당한 이력 관리. `rag-followup-efsearch.md` 는 ef_search 단독이지만, 이 plan 변경은 PR #500(D1/D2) 이후 spec 정합 작업의 일환으로 범위 내로 볼 수 있다.

**[INFO] plan/in-progress/exec-park-b2a-followup.md — 신규 plan 파일**
- 위치: `plan/in-progress/exec-park-b2a-followup.md`
- 상세: `exec-park-b2a-followup` worktree의 plan 파일로, 본 PR 목적(ef_search)과 별개 worktree의 산출물이다. 이 plan 파일의 포함 자체가 파일 5-6의 이종 혼입과 연동된다.
- 제안: 파일 5-6과 함께 커밋 분리 검토.

**[INFO] plan/in-progress/rag-followup-efsearch.md — 신규 plan 파일**
- 위치: `plan/in-progress/rag-followup-efsearch.md`
- 상세: 본 PR의 작업 plan 파일. CLAUDE.md 규약(worktree 작업 = plan/in-progress에 등록)에 따른 정당한 포함. 변경 범위 내.

**[INFO] plan/in-progress/rag-quality-improvement.md — P1 항목 체크박스 [x] 완료 표시**
- 위치: `plan/in-progress/rag-quality-improvement.md`
- 상세: PR #500(D1/D2) 완료로 체크박스 미완료→완료 변경. rag-followup-efsearch 작업이 rag-quality-improvement의 P1 후속이므로 추적 문서 갱신은 정당한 범위.

---

### 파일 12-23: review/code/2026/06/06/17_27_54/ — exec-park-b2a-followup 리뷰 산출물

**[WARNING] review/code/2026/06/06/17_27_54/ 디렉토리 전체 — 이종 PR 리뷰 산출물**
- 위치: `review/code/2026/06/06/17_27_54/` (RESOLUTION.md, SUMMARY.md, dependency.md, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md, _retry_state.json)
- 상세: 이 디렉토리의 내용은 모두 `exec-park-b2a-followup` PR(B2a follow-up)에 대한 ai-review 산출물이다. `meta.json`에 파일 목록이 `execution-park-resume.e2e-spec.ts`, `docker-compose.e2e.yml`, `spec/5-system/14-external-interaction-api.md` 등으로 명시되어 있어 ef_search 작업과 완전히 별개의 리뷰 세션이다. `rag-followup-efsearch` PR에 이 리뷰 파일들이 포함된 것은 두 worktree의 커밋이 같은 브랜치에 묶였기 때문으로 보인다.
- 제안: 파일 5-6, 파일 9와 같이 커밋 분리 검토.

---

### 파일 24-39: review/consistency/ — 일관성 검토 산출물

**[INFO] review/consistency/2026/06/06/17_13_16/ 및 17_27_55/**
- 위치: `review/consistency/2026/06/06/17_13_16/`, `review/consistency/2026/06/06/17_27_55/`
- 상세: 이 consistency 리뷰 산출물들은 exec-park-b2a-followup worktree의 `--impl-prep`(17_13_16) 및 `--impl-done`(17_27_55) 게이트 결과다. plan 파일(`exec-park-b2a-followup.md`)에서 "게이트: `--impl-prep` BLOCK:NO(`17_13_16`)" 로 언급된 동일 산출물이다. ef_search PR과는 별개 worktree의 산출물.
- 제안: 리뷰 산출물은 해당 worktree 브랜치에만 존재해야 한다. 현재 rag-followup-efsearch 브랜치에 포함된 것은 이종 혼입.

---

### 파일 40-45: spec 변경 (#2 주변 spec 정합)

**[INFO] spec/4-nodes/4-integration/_product-overview.md — KB-AG-04 ragTopK optional 명확화**
- 위치: `spec/4-nodes/4-integration/_product-overview.md`
- 상세: plan `rag-followup-efsearch.md`의 `spec_impact` 목록에 포함된 파일. KB-AG-04 설명에 `ragTopK`가 optional임을 명시하고 §3.4 동적 컷 링크 추가. 변경 범위 내.

**[INFO] spec/5-system/10-graph-rag.md — KB-GR-SR-05 고정 topK → 동적 컷으로 설명 갱신**
- 위치: `spec/5-system/10-graph-rag.md`
- 상세: plan `spec_impact`에 포함. PR #500(D1) 도입 이후 최종 주입 수가 고정 topK가 아니라 동적 컷으로 결정됨을 spec에 반영. 변경 범위 내.

**[INFO] spec/5-system/14-external-interaction-api.md — §8.3 + §10.1 토큰 family 명확화**
- 위치: `spec/5-system/14-external-interaction-api.md`
- 상세: plan `rag-followup-efsearch.md`의 `spec_impact`에 포함되지 않은 파일. 이 변경은 `exec-park-b2a-followup` plan의 item ②③에 해당하며 ef_search 목적과 직접 관련 없다. exec-park-b2a-followup 작업 산출물의 이종 혼입.
- 제안: 파일 5-6, review/code/17_27_54/ 와 같이 커밋 분리 검토.

**[INFO] spec/5-system/7-llm-client.md — §3.6 opts.topK 명확화 + §7.1 LLM_STUB_MODE 신설**
- 위치: `spec/5-system/7-llm-client.md`
- 상세: plan `spec_impact`에 포함된 파일. §3.6(RerankClient opts.topK = candidates.length D1 이후)은 ef_search PR의 spec 정합 범위 내. §7.1(LLM_STUB_MODE)은 exec-park-b2a-followup item ①에 해당하며 ef_search와 무관한 추가. 동일 파일에 서로 다른 PR의 변경이 혼재.
- 제안: §7.1 추가 부분은 exec-park-b2a-followup 커밋에서 왔음을 인식할 것.

**[INFO] spec/5-system/9-rag-search.md — §1 topK 슬라이싱 표현 + §3.3.2 conditional escalate 링크 + §3.4 ef_search recall 보전 + §6 오류 테이블 추가**
- 위치: `spec/5-system/9-rag-search.md`
- 상세: plan `spec_impact`에 포함된 핵심 파일. §3.4의 ef_search 파라미터 설명이 "(follow-up)" 에서 구체적 구현으로 갱신된 것이 본 PR의 주 목적. §3.3.2의 conditional escalate 링크 수정과 §6 오류 테이블 추가는 PR #500(D2) spec 정합의 일환으로 plan `rag-followup-efsearch.md` §범위 "#2 주변 spec 정합" 에 포함됨. 변경 범위 내.

**[INFO] spec/data-flow/3-execution.md — resume_call_stack V087 doc-sync**
- 위치: `spec/data-flow/3-execution.md`
- 상세: plan `rag-followup-efsearch.md`의 `spec_impact`에 포함되지 않은 파일. exec-park-b2a-followup item ③에 해당하며 ef_search와 무관. 이종 혼입.
- 제안: exec-park-b2a-followup 커밋에 속해야 하는 변경.

---

## 요약

본 PR(rag-followup-efsearch)의 핵심 변경(파일 1-4: `hnswEfSearchFor` 함수 + `searchVectorGroup` 트랜잭션 래핑 + 단위 테스트)과 spec 정합(파일 40-41, 44의 일부: 9-rag-search, 10-graph-rag, 4-integration)은 plan이 명시한 ef_search recall 보전 범위에 정확히 부합한다. 그러나 전체 45개 파일 중 상당 부분이 **`exec-park-b2a-followup` worktree의 산출물**(e2e 테스트, docker-compose, review/code/17_27_54/ 리뷰 디렉토리 전체, review/consistency/ 두 세션, spec/14-external-interaction-api.md §8.3, spec/7-llm-client.md §7.1, spec/data-flow/3-execution.md)로 이종 혼입되어 있다. plan 메모의 "orphaned #2/#3 diff → fresh main 적용"에서 언급된 재상륙 과정에서 두 worktree의 커밋이 하나의 브랜치에 묶인 것으로 보인다. ef_search 구현 자체의 불필요한 리팩토링, 포맷팅 변경, 관련 없는 기능 추가는 없으나, PR 범위가 두 별개 작업을 포함하는 구조적 scope creep이 존재한다.

## 위험도

MEDIUM
