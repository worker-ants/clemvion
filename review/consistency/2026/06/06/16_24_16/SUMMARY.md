# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 모드: `--impl-done`
검토 대상 scope: `spec/5-system/9-rag-search.md` + RAG 동적 컷 구현 diff (origin/main...HEAD)
검토 일시: 2026-06-06

---

## 전체 위험도

**LOW** — Critical/BLOCK 없음. WARNING 3건(spec_impact 과선언 가능성, i18n 키 교체 merge 후 자동 해소, ragTopK 기본값 제거로 인한 테스트 의미 불명확). 주요 spec 동기화 및 구현 정합성 확보됨.

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `cross_encoder_llm` "항상 grading(v1)" → conditional escalate 즉시 도입으로 번복 — archive 문서와 최신 spec Rationale 이 모순처럼 보이는 구조 | `spec/5-system/9-rag-search.md §3.3.2 v1 결정` + `## Rationale "왜 D2 conditional escalate 를 지금 도입하나"` | `plan/complete/spec-draft-rag-reranking.md §4.2` "항상 grading(v1)" 합의 | `§3.3.2 v1 결정` 항 바로 뒤에 "spec-draft §4.2 항상 grading 결정을 2026-06-06 번복" cross-reference 1줄 추가 |
| 2 | Plan Coherence | `rag-dynamic-cut.md` frontmatter `spec_impact` 에 `spec/1-data-model.md` 등 포함 — 이번 구현 diff 에 해당 파일 변경 없음. 과선언 가능성. | `plan/in-progress/rag-dynamic-cut.md` frontmatter `spec_impact` | 실제 구현 diff (spec/1-data-model.md 미변경) | step 10(plan 정리) 시 실제 변경 파일 목록과 `spec_impact` 대조 후 불필요 항목 제거 |
| 3 | Naming Collision | `ragTopK` 기본값 5 → optional(undefined) 변경 이후 비변경 테스트 파일 4곳에 `ragTopK: 5` 하드코드 잔존 — 테스트 의미 불명확(기본값 검증인지 cap=5 케이스인지 구분 불가) | `node-component.registry.spec.ts` lines 163/171, `ai-agent.cleanup.spec.ts` line 133, `workflows.service.spec.ts` lines 800/825 | `ai-agent.schema.ts` `ragTopK` optional 변경 | 해당 fixture 에서 `ragTopK: 5` 가 "명시적 cap=5 케이스" 인지 재확인 후, 동적 컷 경로(`ragTopK: undefined`) 별도 케이스 추가 권장 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `RerankClient.rerank()` `topK` 의미 변경(v1 이후 전체 후보 수 전달 = 내부 컷 무력화) — `spec/5-system/7-llm-client.md` §3.6 미갱신 | `spec/5-system/7-llm-client.md §3.6` | `topK` 주석에 "v1 이후 RerankService 는 candidates.length 전달, 최종 주입 수는 applyDynamicCut 결정" 추가 |
| 2 | Cross-Spec | `spec/5-system/10-graph-rag.md` KB-GR-SR-05 의 `topK` 표현이 동적 컷 도입 후 모호해짐("상위 topK 반환"이 고정 K처럼 읽힘) | `spec/5-system/10-graph-rag.md` KB-GR-SR-05 | "graph 내부 정렬 후 §3.4 동적 점수 컷으로 최종 주입 수 결정" 명시 |
| 3 | Cross-Spec | `spec/4-nodes/4-integration/_product-overview.md` KB-AG-04 에 `ragTopK` optional 변경 미반영 | `spec/4-nodes/4-integration/_product-overview.md` line 153 | `ragTopK` optional 변경 간단 반영 또는 `1-ai-agent.md` 참조 포인터 추가 |
| 4 | Cross-Spec | `spec/data-flow/6-knowledge-base.md` `applyDynamicCut` 참조 이미 동기화됨 — 충돌 없음 | `spec/data-flow/6-knowledge-base.md` line 121 | 불요 |
| 5 | Rationale Continuity | byte-identical 하위호환 조항 폐기 — off 경로 결과 수량/순서 변화에 영향받는 downstream 에 대한 migration 안내 spec 본문 미포함 | `spec/5-system/9-rag-search.md §3.4` 또는 `§6` | `off 경로 하위호환 변화 범위` 단락 추가 권장(예: "기존 ragTopK=5 사용자는 D1 이후 최대 12건까지 주입될 수 있음") |
| 6 | Rationale Continuity | `gradingNoGrounding` 신설 — spec-draft 에 없던 항목. Rationale 명시됐으나 진단 schema 증식 회피 원칙과 신설 근거가 분산됨 | `spec/5-system/9-rag-search.md §4.2` | `§4.2` 또는 Rationale 에 "spec-draft 에 없었으나 환각 억제 목적으로 신설" 한 줄 집약 |
| 7 | Convention Compliance | `spec/5-system/9-rag-search.md` frontmatter `status: partial` 유지 적절 — `rag-dynamic-cut.md` 완료 시 `pending_plans` 갱신 필요 | `spec/5-system/9-rag-search.md` frontmatter | plan `rag-dynamic-cut.md` 완료 후 `pending_plans` 갱신(자동 가드 오탐 방지) |
| 8 | Plan Coherence | `rag-rerank-followup.md` worktree `rag-rerank-impl` — branch/worktree 미존재(stale). `plan/complete/` 이동 검토 필요 | `plan/in-progress/rag-rerank-followup.md` | stale worktree 참조 정리 후 `complete/` 이동 검토 |
| 9 | Plan Coherence | `rag-quality-improvement.md` — 본 PR 이 P1 D1/D2 구현 완료. P1 spec 갱신 체크박스 `[x]` 갱신 권장 | `plan/in-progress/rag-quality-improvement.md` | P1 항목 완료 체크박스 갱신 |
| 10 | Naming Collision | `tokenBudget` 필드명이 working-memory 영역(`agent-memory-injection.ts`)과 중복 — 의미 다름(RAG 주입 상한 vs working-memory 압축 임계), scope 별개라 충돌 아님 | `dynamic-cut.util.ts`, `rerank.service.ts` | 현 설계 유지 가능. 명확성 원한다면 `ragInjectTokenBudget` 르네임 옵션 있음 |
| 11 | Naming Collision | `RAG_INJECT_TOKEN_BUDGET = 8000` 과 `DEFAULT_MEMORY_TOKEN_BUDGET = 8000` 값 동일 — 별개 상수, 이름 충돌 없음. 값 동기화 위험만 존재 | `dynamic-cut.util.ts` line 126, `agent-memory-schema.ts` line 29 | 현 설계 유지. 두 값 함께 변경 시 동기화 필요 |
| 12 | Naming Collision | i18n 키 `"RAG Top-K (default)"` → `"RAG Top-K (cap)"` 교체 — origin/main 에 구키 잔존하나 이 diff 의 의도된 삭제 대상. merge 후 자동 해소 | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 이 diff 내 변경으로 충분. merge 후 해소 |
| 13 | Naming Collision | `ai-agent.handler.spec.ts` line 325 `RerankDiagnostics` fixture 에 `gradingNoGrounding` 누락 — 컴파일 오류 없으나 신규 필드 검증 안됨 | `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.spec.ts` line 325 | fixture 에 `gradingNoGrounding: false` 추가 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 핵심 spec(9-rag-search.md, 1-ai-agent.md) 동기화 완료. 주변 spec 3건(7-llm-client.md, 10-graph-rag.md, 4-integration/_product-overview.md) 명시 보강 필요(INFO) |
| Rationale Continuity | LOW | 번복 근거(conditional escalate 즉시 도입)가 target spec + plan 재결정 로그에 이중 기록됨. spec-draft archive 와의 외관상 모순을 해소할 cross-reference 1줄 추가 권고(WARNING) |
| Convention Compliance | NONE | 에러코드 UPPER_SNAKE_CASE, 진단 페이로드 스키마 1:1 일치, i18n Principle 3-B/5 동시 갱신 모두 준수. 위반 없음 |
| Plan Coherence | LOW | D1/D2 구현이 rag-dynamic-cut.md 설계와 정합. spec_impact 과선언 가능성(WARNING 1건), stale worktree 2건 확인 |
| Naming Collision | LOW | 신규 식별자 12개 중 실제 심볼 충돌 없음. ragTopK 의미 변경 후 테스트 fixture 의미 불명확(WARNING 1건), tokenBudget 중복 필드명(INFO) |

---

## 권장 조치사항

1. **(BLOCK 없음, 즉시 merge 가능)**

2. **[WARNING 해소 — 우선순위 높음]** `spec/5-system/9-rag-search.md §3.3.2 v1 결정` 항 바로 뒤에 "spec-draft-rag-reranking §4.2 '항상 grading' 결정을 2026-06-06 번복" cross-reference 1줄 추가 — 신규 코드 독자의 Rationale 혼선 방지.

3. **[WARNING 해소 — plan step 10]** `plan/in-progress/rag-dynamic-cut.md` 완료 처리 시 frontmatter `spec_impact` 를 실제 변경 파일 목록과 대조, 미변경 파일(`spec/1-data-model.md` 등) 제거.

4. **[WARNING 해소 — 테스트 품질]** `ragTopK: 5` 하드코드 4곳(`node-component.registry.spec.ts`, `ai-agent.cleanup.spec.ts`, `workflows.service.spec.ts`)에서 "명시적 cap=5 케이스" 임을 주석으로 명시하고, 동적 컷 위임 경로(`ragTopK: undefined`) 테스트 케이스를 별도 추가.

5. **[INFO — 주변 spec 보강]** `spec/5-system/7-llm-client.md §3.6` `topK` 주석 갱신 + `spec/5-system/10-graph-rag.md` KB-GR-SR-05 `topK` 표현 명확화 + `spec/4-nodes/4-integration/_product-overview.md` KB-AG-04 `ragTopK optional` 반영 — 세 spec 문서 소규모 보강.

6. **[INFO — plan 정리]** `plan/in-progress/rag-rerank-followup.md` stale worktree 참조 정리 후 `plan/complete/` 이동 검토. `plan/in-progress/rag-quality-improvement.md` P1 체크박스 `[x]` 갱신.

7. **[INFO — 테스트 보강]** `ai-agent.handler.spec.ts` line 325 `RerankDiagnostics` fixture 에 `gradingNoGrounding: false` 추가.