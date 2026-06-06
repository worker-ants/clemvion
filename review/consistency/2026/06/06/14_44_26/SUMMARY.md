# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**HIGH** — plan frontmatter 누락으로 build 차단 확실 (Convention Compliance CRITICAL). 그 외 cross-spec/rationale 영역에서 복수 WARNING 존재.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `plan/in-progress/spec-draft-rag-dynamic-cut.md` 에 `worktree`·`started`·`owner` frontmatter 3필드 전면 부재 — `plan-frontmatter.test.ts` build 차단 확실 | 문서 최상단 (frontmatter 없음) | `.claude/docs/plan-lifecycle.md §4` | 문서 최상단에 `---\nworktree: rag-dynamic-cut-12fac1\nstarted: 2026-06-06\nowner: project-planner\n---` 추가 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `§A1` 이 `pending_plans:` 에 `plan/in-progress/rag-dynamic-cut.md` 기재를 지시하나 해당 파일이 실존하지 않음 — `spec-pending-plan-existence.test.ts` 차단 가능 | §A1 frontmatter 갱신 지시 | `spec/conventions/spec-impl-evidence.md §2.1·§3` | 경로를 실존 파일 `plan/in-progress/spec-draft-rag-dynamic-cut.md` 로 수정하거나 `plan/in-progress/rag-dynamic-cut.md` 별도 생성 |
| 2 | Convention Compliance | spec `status: partial` 전이 지시 누락 — `§A1` 이 `pending_plans:` 추가를 지시하지만 `spec/5-system/9-rag-search.md` 의 `status` 를 `partial` 로 변경하라는 지시 없음 | §A1 | `spec/conventions/spec-impl-evidence.md §3 전이 규칙` | §A1 에 `status: partial` 변경 지시 추가 |
| 3 | Convention Compliance | 문서 구조 — `## Rationale (draft 자체)` 섹션에서 "spec 에 반영할 Rationale 내용" 과 "plan 자체의 근거" 가 혼재 | 문서 전체 구조 | CLAUDE.md `§정보 저장 위치` | draft Rationale 은 plan 근거로만, spec Rationale 내용은 §A8 에 통합하거나 두 섹션을 제목으로 명확히 분리 |
| 4 | Cross-Spec | `ragTopK` optional 화에 따른 KB tool JSON schema(`§2.1`) `top_k.description` 갱신 누락 — `ragTopK` 미지정 시 fallback 값이 무엇인지 LLM 에 미전달 | §A2~A5 (동적 컷 도입), §B1 | `spec/5-system/9-rag-search.md` 라인 80 `"Default: <ragTopK>"` | §A2 또는 §2.1 갱신 항목에 `top_k` description 을 "If omitted, the system applies a dynamic token-budget cut (internal ceiling 12)" 류로 갱신 명시 |
| 5 | Cross-Spec | graph-rag.md SQL `LIMIT $5 = ragTopK` 하드코딩을 "동적 컷 참조로 교체" 라고만 지시하며 실제 SQL LIMIT 값 변경(wide 회수로 전환 여부) 미명시. `expanded_chunk_limit` 필드와의 우선순위 관계도 기술 없음 | §E graph-rag.md 라인 417/471 갱신 지시 | `spec/5-system/10-graph-rag.md` 라인 417, 471 | §E 에서 `LIMIT $5` 를 `RAG_RECALL_K`(wide 회수) 로 교체할지 또는 `expanded_chunk_limit` 상한을 유지할지 명시적으로 결정하고, `expanded_chunk_limit` vs 동적 컷 우선순위 관계를 기술 |
| 6 | Cross-Spec | §3.1 파라미터 표에서 `off`/`≠off` 경로 모두 `$4` 를 공유하는 구조 — `off` 에서는 `RAG_RECALL_K`, `≠off` 에서는 `rerank_candidate_k` 를 따르는데 단일 행 교체만으로는 이원화 불해소 | §A2 — `$4` 행을 `RAG_RECALL_K(50)` 으로 교체 지시 | `spec/5-system/9-rag-search.md §3.1` 파라미터 표 | 파라미터 표에 `rerank_mode = off 시`/`≠ off 시` 각각의 `$4` 의미를 분기 주석·각주로 명시 |
| 7 | Rationale Continuity | `cross_encoder_llm` v1 "항상 grading" 결정(2026-06-04 확정) 번복 시, 새 Rationale 이 draft 내에 있으나 기존 Rationale(`spec-draft-rag-reranking.md §4.2`, `rag-search.md §3.3.2`)을 명시적으로 참조·폐기 선언하지 않아 연속성 체인 불완전 | §A3/A4 cross_encoder_llm 행 신규 기술, §A8 Rationale | `plan/complete/spec-draft-rag-reranking.md §4.2`, `spec/5-system/9-rag-search.md §3.3.2 v1 결정` | §A8 "왜 D2 conditional escalate 를 지금 도입하나" 항목에 "기존 v1 결정(spec-draft-rag-reranking.md §4.2) 대비 번복 이유" 와 기존 결정 출처를 명시적으로 연결 |
| 8 | Rationale Continuity | `off` 모드 "byte-identical 하위호환" invariant 파기 — A8 에 갱신 의도는 있으나 기존 Rationale 의 "(a) 하위호환 byte-identical" 조항 폐기 사실을 해당 항목 내에서 명시적으로 기록하지 않음 | §A3 off 행 재서술, §A8 "왜 완전 선택적(off 기본)인가" | `plan/complete/spec-draft-rag-reranking.md §1`, `spec/5-system/9-rag-search.md §3.3.1 byte-identical` | §A8 에 "리랭킹 spec 기록 byte-identical 조항(spec-draft-rag-reranking.md §1 / rag-search.md §3.3.1)을 본 D1 개정으로 폐기" 를 명시하고 새 하위호환 정의를 서술 |
| 9 | Plan Coherence | `rag-quality-improvement.md §6` line 172 의 "2026-06-04 확정: 항상 LLM grading(v1)" 결정 기록이 §F 갱신 대상에서 누락 — D2 재결정 후에도 기존 결정 기록이 SoT 로 남아 후속 작업자가 번복된 결정을 따르는 오류 발생 가능 | §F plan 갱신 항목 | `plan/in-progress/rag-quality-improvement.md §6` line 172 | §F 에 `rag-quality-improvement.md §6` line 172 갱신 항목 추가 (2026-06-06 재결정 내용으로 교체) |
| 10 | Naming Collision | `§3.4` 신설 섹션이 target 내 여러 교차 참조에서 사용되나 현행 spec 에 미존재 — spec 반영 전까지 dead-link 상태 | target 내 `RAG 검색 §3.4` 교차 참조 다수 | `spec/5-system/9-rag-search.md` (§3.3 다음 §4 로 바로 이어짐) | spec 편집 시 §3.4 삽입 위치(기존 §3.3 바로 아래)와 앵커를 A1 과 동시에 확정하여 dead-link 방지 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `llmGradingApplied=false` 가 `cross_encoder` 와 escalate 미발생 `cross_encoder_llm` 두 케이스를 포함하게 되어 진단 값만으로 구분 불가 | §A6 | §A6 에서 `ragDiagnostics.rerank.mode` 로 구분 가능함을 한 줄 추가 |
| 2 | Cross-Spec | KB tool `top_k` description `"Default: <ragTopK>"` fallback 표현 미결 — `RAG_MAX_INJECT_COUNT(12)` 노출 여부 결정 필요 | §A2~A5, §B1 | A2 또는 §2.1 에서 "Number of chunks to inject. If omitted, the system applies a dynamic token-budget cut (internal ceiling 12)." 형태로 명시 |
| 3 | Cross-Spec | `RAG_RECALL_K=50` 과 `rerank_candidate_k` 기본값 `50` 수치 일치 — 독립적 코드패스(내부 상수 vs KB 필드) 명문화 미비 | §A5 `RAG_RECALL_K` 정의 | §A5 또는 §A8 에 "off 모드의 `RAG_RECALL_K=50` 은 `rerank_candidate_k` 기본값과 수치는 동일하나 독립 코드패스" 명시 |
| 4 | Cross-Spec | `memoryTopK=5` 와 `ragTopK=5` 의 "RAG 정합을 위해 동일" 문구 — `ragTopK` optional 화로 근거 소멸 | §D `spec/5-system/17-agent-memory.md` 라인 83 수정 | "RAG 정합을 위해 동일" 문구 전체 제거 + `memoryTopK`/`ragTopK` 독립성·각자 기준 재서술 |
| 5 | Rationale Continuity | `ragTopK` 기본값 제거 Rationale — 이전 리랭킹 spec 에서 기본값 5 를 유지한 이유(의미 보강)와 이번 번복(D1 귀결) 연결 체인 보강 가능 | §A8 "왜 ragTopK 기본값(5)을 제거했나" | §A8 에 "이전 spec(spec-draft-rag-reranking.md §5) 기본값 5 유지는 리랭크 후 최종 슬라이스 의미 보강에 그쳤으며, D1 동적 컷 도입으로 고정 기본 주입수 개념 자체가 소거되므로 자연스러운 귀결" 한 문장 추가 |
| 6 | Rationale Continuity | `off` 경로의 cosine θ SQL 단계 유지 이유 — "rerank ≠ off 에서 기각된 대안(cosine 임계 유지한 채 리랭크)과는 별개" 임을 명문화 필요 | §A5 §3.4, §A8 | §A5 또는 §A8 에 "off 경로 cosine θ 는 리랭커 없는 관련성 게이트로 제거 대상이 아님" 명기 |
| 7 | Convention Compliance | 새 내부 상수(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`) 가 환경변수로 노출되는지 모듈 내 리터럴인지 spec 본문에 미명시 | §A5 상수 정의 | §A5 또는 §A8 에 "코드 상수(module-level constant), 환경변수 미노출" 명기 |
| 8 | Convention Compliance | `[~]` 마커 — `plan-lifecycle.md §2` 정식 규약에 없는 비표준 마커, `rag-rerank-followup.md` 에서 관행 존재 | §F `rag-rerank-followup.md` 갱신 지시 | `plan-lifecycle.md` 에 `[~]` 의미를 공식 등재하거나 인라인 설명으로 대체 |
| 9 | Convention Compliance | 변경 위치를 라인 번호로 지정 — 순차 편집 시 라인 밀림으로 오적용 가능 | §D 라인 83, §B1 라인 40, 라인 156, 라인 667 부근 | 라인 번호 대신 섹션 헤딩·기존 텍스트 앵커로 통일 |
| 10 | Naming Collision | `RAG_INJECT_TOKEN_BUDGET`(8000) vs `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) — 값 동일, 쓰임새 다름. §A8 에 이미 명시 | §A8 Rationale | spec Rationale 에 두 상수의 차이(working-memory 압축 예산 vs KB 주입 상한) 1줄 추가 |
| 11 | Naming Collision | `cutoffApplied` 기존 의미(rerank_score_threshold 컷 전용) 에 token-budget/inject-cap 컷 포함 의미 확장 — 진단 해석 모호 | §A6 | `cutoffApplied` 가 "rerank 점수 컷 OR token-budget 컷 OR inject-cap 컷 중 하나라도 적용 시 true" 임을 명시하거나, `dynamicCutApplied` 별도 신설 검토 |
| 12 | Plan Coherence | `rag-rerank-followup.md` 완료 기준 비고("모든 surface 구현 완료") 의 미충족 상태 — 설계 의도와 일치하나 후속 작업자 전달 명확성 확인 필요 | §F `rag-rerank-followup.md` `[~]` 전환 | 현행 draft "[~] conditional escalate — 메커니즘은 구현, 정량 임계 A/B는 후속" 으로 충분. 추가 조치 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | KB tool §2.1 `top_k` description 갱신 누락(W), graph-rag SQL LIMIT 변경 방향 미결(W), §3.1 `$4` 이원화(W) |
| Rationale Continuity | MEDIUM | D2 escalate 번복 연속성 체인 불완전(W), `off` byte-identical 폐기 선언 미명시(W) |
| Convention Compliance | HIGH | plan frontmatter 3필드 전면 부재 → build 차단(C), `pending_plans:` 경로 불일치(W), spec status 전이 미명시(W) |
| Plan Coherence | LOW | `rag-quality-improvement.md §6` 결정 기록 갱신 누락(W), stale worktree 3건 확인 |
| Naming Collision | LOW | `§3.4` dead-link(W), `ragTopK` 기본값 미갱신 참조 2곳(W), `cutoffApplied` 의미 확장 모호성(INFO) |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `plan/in-progress/spec-draft-rag-dynamic-cut.md` 최상단에 frontmatter 추가 (`worktree: rag-dynamic-cut-12fac1` / `started: 2026-06-06` / `owner: project-planner`).
2. **(BLOCK 해소 필수)** §A1 `pending_plans:` 경로를 실존 파일 경로(`plan/in-progress/spec-draft-rag-dynamic-cut.md`)로 수정하거나 `plan/in-progress/rag-dynamic-cut.md` 별도 생성.
3. §A1 에 `spec/5-system/9-rag-search.md` `status: partial` 변경 지시 추가.
4. §A2 또는 §2.1 갱신에 `top_k` tool description 갱신("If omitted, dynamic token-budget cut applies, internal ceiling 12") 명시.
5. §E 에서 graph-rag.md SQL `LIMIT $5` 처리 방향(wide 회수 전환 여부, `expanded_chunk_limit` 우선순위) 명시적 결정.
6. §A8 에 D2 conditional escalate 번복 이유를 기존 결정 출처(`spec-draft-rag-reranking.md §4.2`) 명시 연결 형식으로 보강.
7. §A8 에 `off` 모드 byte-identical 조항 폐기 사실을 명시 기록.
8. §F 에 `rag-quality-improvement.md §6` line 172 갱신 항목 추가 (D2 재결정 내용 반영).
9. spec 편집 시 §3.4 삽입 위치·앵커를 A1 과 동시에 확정하여 dead-link 방지.
10. §3.1 파라미터 표에 `rerank_mode = off`/`≠ off` 경로별 `$4` 의미 분기 주석 추가.