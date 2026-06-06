# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

검토 모드: `--impl-done`
Scope: `spec/5-system/9-rag-search.md` (RAG 동적 점수 컷 D1/D2 구현)
diff-base: `origin/main`
검토일: 2026-06-06

---

## 전체 위험도
**HIGH** — Critical 1건(식별자 의미 충돌) + Warning 6건(spec 미갱신, 규약 위반, 수치 혼동)

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `cross_encoder_llm` 모드 식별자 의미 충돌 — spec은 "항상 LLM grading"으로 정의하나 구현은 `shouldEscalateGrading()`으로 conditional 동작. 동일 식별자에 spec/구현 간 다른 의미 공존. 외부 노출 API `ragDiagnostics.rerank.mode` 에도 영향 | `rerank.service.ts:793-797` (`shouldEscalateGrading`, `ESCALATE_TOP_SCORE_FLOOR`, `ESCALATE_FLAT_REL_GAP`) | `spec/5-system/9-rag-search.md:180,188,195` §3.3.1/§3.3.2 — "항상 listwise LLM grading 1콜 수행", "conditional escalate는 후속 도입" | spec §3.3.1/§3.3.2를 conditional escalate 동작에 맞게 갱신(전자) 또는 conditional escalate 구현을 revert하고 후속 plan으로 이동(후자). 전자 선택 시 `ESCALATE_TOP_SCORE_FLOOR`/`ESCALATE_FLAT_REL_GAP` provisional 값을 spec §3.3.2에 명시 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/data-flow/6-knowledge-base.md` §1.3 시퀀스 다이어그램이 폐기된 `LIMIT topK` 선차단 모델을 기술 — 구현은 wide 회수(`RAG_RECALL_K=50`) + `applyDynamicCut()` 으로 교체됨 | `rag-search.service.ts` (wide 회수 경로) | `spec/data-flow/6-knowledge-base.md:116,119` — `search(kbId, query, topK)` + `SELECT ... LIMIT topK` | `spec/data-flow/6-knowledge-base.md` §1.3 시퀀스를 `search(kbId, query, threshold?)` + `LIMIT RAG_RECALL_K(50)` + `applyDynamicCut()` 흐름으로 갱신 |
| 2 | Cross-Spec | `spec/1-data-model.md` §2.x `rerank_score_threshold` NULL 케이스를 "top-k" 슬라이스로 묘사 — 구현은 이미 `applyDynamicCut(tokenBudget, injectCap)` 으로 교체됨 | 구현 diff — `RerankParams.topK` → `injectCap + tokenBudget` 교체 | `spec/1-data-model.md:346` — "NULL 이면 컷 없이 점수순 정렬 후 top-k" | 라인 346을 "NULL 이면 점수 θ 컷 없이 token-budget + inject-cap 동적 컷(§3.4)만 적용"으로 수정 |
| 3 | Convention Compliance | `spec/5-system/9-rag-search.md` frontmatter `code:` 에 핵심 구현 파일 누락 — `dynamic-cut.util.ts`(§3.4 단일 구현체), `rerank.service.ts`(§3.3 직접 구현체) 미등재 | `spec/5-system/9-rag-search.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md §2.1` — code: 는 본 spec이 약속한 surface의 구현 경로 열거 의무 | `code:` 에 `rerank.service.ts`, `dynamic-cut.util.ts` 두 경로 추가 |
| 4 | Convention Compliance | `plan/in-progress/rag-dynamic-cut.md` `spec_impact: yes` — Gate C 비표준 값. 유효 값은 spec 경로 목록 또는 no-op sentinel(`none`/`없음`/`n/a`/`na`)만 허용. 완료 이동 시 `spec-plan-completion.test.ts` 실패 위험 | `plan/in-progress/rag-dynamic-cut.md` frontmatter | `spec/conventions/spec-impl-evidence.md §4.2 Gate C`, `.claude/docs/plan-lifecycle.md §Gate C` | `spec_impact: - spec/5-system/9-rag-search.md` 형태(실제 변경된 spec 경로 목록)로 수정 |
| 5 | Naming Collision | `RAG_RECALL_K=50` 과 `rerankCandidateK` (default 50) — 수치·개념 유사하나 독립 코드패스. 후속 개발자 혼동 위험 | `dynamic-cut.util.ts:123` | `knowledge-base.entity.ts:102`, `spec/1-data-model.md:345`, `spec/5-system/9-rag-search.md:185` | `RAG_RECALL_K` 주석에 "`rerank_mode=off` 전용 wide 회수 LIMIT — KB 엔티티 `rerankCandidateK`와 값이 같지만 별개 제어 지점" 명시. spec §3.1 테이블에 두 경로 명시적 분리 문서화 |
| 6 | Naming Collision | `gradingNoGrounding` 필드 — 구현 `RerankDiagnostics` 에 추가됐으나 spec §4.2 `rerank` 서브객체 스키마에 미정의 | `rerank.service.ts:812` (`RerankDiagnostics` 인터페이스) | `spec/5-system/9-rag-search.md:252-264` — `rerank` 서브객체 스키마 (해당 필드 없음) | spec §4.2 `rerank` 서브객체 스키마에 `gradingNoGrounding: boolean` 필드 추가 및 의미 기술 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/10-graph-rag.md` — `ragTopK` "그대로 유지" 표현이 optional화 이후 구 기본값(5) 연상 여지 | `spec/5-system/10-graph-rag.md:124,158,193,606` | `ragTopK`는 선택적 상한 override(미지정 시 동적 컷 §3.4 적용)임을 짧게 명기 또는 §3.4 링크 추가 |
| 2 | Cross-Spec | `spec/5-system/7-llm-client.md` `RerankClient.rerank()` `opts.topK` — 구현은 `candidates.length` 로 항상 전체 전달. inject-cap 슬라이스는 `applyDynamicCut` 이 담당 | `spec/5-system/7-llm-client.md:192` | §3.6 에 "inject-cap 슬라이스는 `RerankService.applyDynamicCut` 이 담당, `rerank()` 호출 시 `topK = candidates.length` 로 전체 전달" 주석 추가 |
| 3 | Rationale Continuity | `plan/complete/spec-draft-rag-reranking.md §Rationale` ② — "항상 grading(v1)" 결정 번복 표시 없이 잔존. spec에는 번복 근거 명시됨 | `plan/complete/spec-draft-rag-reranking.md §Rationale` | `[2026-06-06 번복 — conditional escalate로 대체, 근거: 9-rag-search.md §Rationale]` 주석 추가 (`project-planner` 위임) |
| 4 | Rationale Continuity | `plan/complete/spec-draft-rag-reranking.md` — "byte-identical 조항" 선언이 폐기 표시 없이 잔존. `9-rag-search.md §Rationale` 에서 폐기 선언됨 | `plan/complete/spec-draft-rag-reranking.md §3.1, §Rationale` | 문서 상단에 `[SUPERSEDED 2026-06-06] byte-identical 조항 폐기됨. 최신 정의: spec/5-system/9-rag-search.md §Rationale` 주석 추가 (`project-planner` 위임) |
| 5 | Rationale Continuity | `plan/in-progress/rag-rerank-followup.md` — 코드 주석 및 spec이 참조하는 파일. 실제 생성 여부 확인 필요 | 코드 주석 (`rerank.service.ts` 상수 주석) | 파일 미생성 시 plan stub 생성을 `project-planner` 에 위임 |
| 6 | Rationale Continuity | `spec/4-nodes/` 하위 AI Agent 노드 config 문서 — `ragTopK` default 값 5 잔존 가능성 | `spec/4-nodes/3-ai/1-ai-agent.md` (추정) | `ragTopK: optional, default 없음, 미지정 시 동적 컷 적용` 반영 확인 |
| 7 | Convention Compliance | `spec/4-nodes/3-ai/1-ai-agent.md` `ragTopK` 기본값 기술 동기화 확인 | `spec/4-nodes/3-ai/1-ai-agent.md` | "optional, default 없음, 미지정 시 동적 컷 적용" 반영 여부 검토 |
| 8 | Convention Compliance | `grounding: "none"` 출력 필드 — spec §2.2 에 정의됨, node-output.md 규약 적용 대상 아님 | `kb-tool-provider.ts` + `spec/5-system/9-rag-search.md §2.2` | 별도 조치 불필요 |
| 9 | Plan Coherence | D2 conditional escalate 정량 임계 `rag-rerank-followup.md` — `[~]` 상태로 정합. 현재 유지 | `plan/in-progress/rag-rerank-followup.md:18` | 현재 상태 유지 |
| 10 | Plan Coherence | `backend-labels.ts` 편집 영역 `impl-exec-concurrency-cap` 브랜치와 중첩 — 행 수준 충돌 없음 | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 머지 시 양 변경이 모두 보존되는지 확인 권장 |
| 11 | Naming Collision | `RAG_INJECT_TOKEN_BUDGET=8000` 과 `DEFAULT_MEMORY_TOKEN_BUDGET=8000` — 값·단위 동일, 의미 상이(KB 주입 vs working-memory 압축) | `dynamic-cut.util.ts:126` vs `agent-memory-schema.ts:29` | spec §3.4 또는 Rationale에 "두 예산은 별개 상수이며 값 일치는 초기 calibration 우연의 일치" 명시 |
| 12 | Naming Collision | `RerankParams.topK` → `injectCap + tokenBudget` 분리 — spec §3.3.2 step 5 가 여전히 단순 top_k slice 기술. 코드 곳곳이 미존재 `spec §3.4` 를 참조 | `rerank.service.ts RerankParams` | spec §3.3.2 step 5를 `applyDynamicCut(tokenBudget, injectCap)` 으로 갱신 + §3.4 신설 (RAG_INJECT_TOKEN_BUDGET, RAG_MAX_INJECT_COUNT, 최소 1개 보장 규칙 정의) |
| 13 | Naming Collision | `SearchWithMetaResult` 타입 — 익명 인라인 타입을 named export 로 승격. spec 미정의나 내부 구현 타입으로 충돌 없음 | `rag-search.service.ts:268` | 외부 모듈 import 시 spec 타입 계약 상향 여부 검토. v1 INFO 수준 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `spec/data-flow/6-knowledge-base.md` §1.3 다이어그램 + `spec/1-data-model.md` rerank_score_threshold NULL 케이스에 폐기된 topK 개념 잔존 |
| Rationale Continuity | LOW | `plan/complete/spec-draft-rag-reranking.md` 에 번복 표시 없는 구 결정("항상 grading", "byte-identical") 잔존. spec에는 번복 근거 명시됨 |
| Convention Compliance | MEDIUM | `spec/5-system/9-rag-search.md` code: 핵심 파일 누락 + `rag-dynamic-cut.md` spec_impact 비표준 값(Gate C 차단 위험) |
| Plan Coherence | NONE | 활성 worktree 5개 모두 행 수준 충돌 없음. plan 체크리스트 정합 |
| Naming Collision | HIGH | `cross_encoder_llm` 모드 식별자 spec/구현 의미 충돌(CRITICAL) + `gradingNoGrounding` spec 미정의 + 수치 충돌 WARNING 2건 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/5-system/9-rag-search.md` §3.3.1 및 §3.3.2 를 conditional escalate 동작에 맞게 갱신 — "항상 LLM grading" 서술을 `shouldEscalateGrading()` 조건부 로직으로 교체, `ESCALATE_TOP_SCORE_FLOOR`/`ESCALATE_FLAT_REL_GAP` provisional 값 명시. 대안: conditional escalate 구현 revert 후 후속 plan으로 분리. (`project-planner` 위임)
2. **(WARNING — Gate C 차단 방지)** `plan/in-progress/rag-dynamic-cut.md` `spec_impact: yes` → `spec_impact: - spec/5-system/9-rag-search.md` 등 실제 경로 목록으로 수정. plan complete 이동 전 필수.
3. **(WARNING — spec-impl-evidence 정합)** `spec/5-system/9-rag-search.md` frontmatter `code:` 에 `rerank.service.ts`, `dynamic-cut.util.ts` 두 경로 추가.
4. **(WARNING)** `spec/data-flow/6-knowledge-base.md` §1.3 시퀀스 다이어그램을 wide 회수 + `applyDynamicCut()` 흐름으로 갱신. (`project-planner` 위임)
5. **(WARNING)** `spec/1-data-model.md:346` `rerank_score_threshold` NULL 케이스 서술을 "token-budget + inject-cap 동적 컷만 적용"으로 수정. (`project-planner` 위임)
6. **(WARNING)** spec §4.2 `rerank` 서브객체 스키마에 `gradingNoGrounding: boolean` 필드 추가. (`project-planner` 위임)
7. **(WARNING)** `RAG_RECALL_K` 와 `rerankCandidateK` 의 독립성을 코드 주석 및 spec §3.1 테이블에 명시적으로 문서화.
8. **(INFO — Rationale 정합)** `plan/complete/spec-draft-rag-reranking.md` §Rationale ② 항에 번복 주석 추가, byte-identical 조항 폐기 안내 상단 추가. (`project-planner` 위임)
9. **(INFO)** spec §3.3.2 step 5 를 `applyDynamicCut` 으로 갱신 + §3.4 신설 (코드 참조 "spec/…§3.4" 의 404 해소). (`project-planner` 위임)
10. **(INFO)** `plan/in-progress/rag-rerank-followup.md` 파일 실제 생성 여부 확인 — 없다면 stub 생성. (`project-planner` 위임)