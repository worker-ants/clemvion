# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — D1(`off` 경로 byte-identical 약속 파기), D2(conditional escalate P0 선행조건 우회), ragTopK 기본값 제거 등 spec 선갱신 없이 구현 착수 불가한 충돌이 복수 존재합니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C1 | Rationale Continuity | D1 이 `rerank_mode='off'` 경로의 "byte-identical 하위호환" invariant 를 spec 갱신 없이 파기 | 구현 계획 D1 — off 경로를 wide 회수 + app-layer 동적 컷으로 교체 | `spec/5-system/9-rag-search.md §3.3.1` 표 `off` 행 "현행과 byte-identical (하위호환)" + Rationale "(a) 하위호환 byte-identical" | spec §3.3.1 `off` 행 설명 및 Rationale 을 D1 실제 동작(wide 회수 → app-layer 동적 컷)으로 갱신하거나, D1 을 `off` 경로 외 모드에만 적용하도록 범위 제한 — `project-planner` 선행 처리 필수 |
| C2 | Convention Compliance | `off` 경로 byte-identical 약속이 spec 본문에 존재하는 상태에서 D1 구현 착수 시 spec-impl invariant 파기 | 구현 계획 D1 | `spec/5-system/9-rag-search.md §3.3.1`, §3.1 파라미터 표, Rationale | §3.3.1 `off` 행, §3.1 `$4` 기본값, §3.3.2 흐름, Rationale "byte-identical" 항목 제거를 `project-planner` 가 spec 선갱신 후 `--spec` consistency-check 통과 확인 |
| C3 | Convention Compliance | `ragTopK .default(5)` 제거 → `.optional()` 변경이 spec 두 문서의 "기본값 5" 서술과 충돌 | 구현 계획 — `ai-agent.schema.ts` ragTopK zod 변경 | `spec/4-nodes/3-ai/1-ai-agent.md §1` (기본값 5), `spec/5-system/9-rag-search.md §3.1` ($4 "LLM 호출 인자 또는 5") | `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/0-common.md §2`, `spec/5-system/9-rag-search.md §3.1·§2.1` 총 4개 위치를 `project-planner` 가 선갱신 |
| C4 | Plan Coherence | D2 conditional escalate 도입이 `rag-rerank-followup.md` 의 P0 선행조건 미충족 pending 항목을 일방 우회 | 구현 계획 D2 — cross_encoder_llm "항상 grading" → "conditional escalate" | `plan/in-progress/rag-rerank-followup.md` line 18 `[ ] conditional escalate 정량 임계 — P0 평가셋 보정 후 도입`, `rag-quality-improvement.md §6`, spec §3.3.2 v1 결정 | P0 baseline(`rag-quality-improvement.md §7.B`) 완료 후 착수하거나, D2 범위를 "conditional escalate 진입점 구조 추가 + 임계 상수 TBD" 로 제한해 plan 미결 항목과 합의 후 착수 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | D1 off 경로 변경이 spec §3.3.1 "byte-identical" 약속과 의미 충돌 | D1 구현 계획 off 경로 wide 회수 교체 | `spec/5-system/9-rag-search.md §3.3.1` | spec 먼저 갱신(C1 해소 참고) |
| W2 | Cross-Spec | `ragTopK .default(5)` 제거 시 spec 4개 위치 기본값 불일치 | 구현 계획 ragTopK 의미 변경 | `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/0-common.md §2`, `spec/5-system/9-rag-search.md §2.1·§3.1` | C3 해소와 동일 — spec 4개 위치 선갱신 |
| W3 | Cross-Spec | D2 listwise conditional escalate 도입이 spec §3.3.1 v1 결정 및 plan pending 선결조건과 충돌 | D2 구현 계획 | `spec/5-system/9-rag-search.md §3.3.1·§3.3.2`, `rag-rerank-followup.md` pending | C4 해소 절차 후 착수 |
| W4 | Rationale Continuity | `ragTopK .default(5)` 제거 — 기존 config 표 및 Rationale I4 "사용자/LLM 노출 유지" 의미 경계 모호, 새 Rationale 부재 | 구현 계획 ragTopK optional 화 | `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/5-system/9-rag-search.md §3.1·§3.3.2` Rationale | spec 갱신 시 "왜 v1 기본값(5)을 버리는가" 근거를 Rationale 에 기재 |
| W5 | Rationale Continuity | D2 conditional escalate — spec §3.3.2 v1 결정 "P0 후속"을 번복하나 새 Rationale 부재 | D2 구현 계획 | `spec/5-system/9-rag-search.md §3.3.1·§3.3.2` Rationale | spec §3.3.1·§3.3.2·Rationale 에 "왜 지금 도입하는가, P0 조건이 충족됐는가" 근거 기재 |
| W6 | Convention Compliance | D2 `cross_encoder_llm` "항상 LLM grading" → "conditional escalate" — spec §3.3.1·§3.3.2 v1 결정 서술과 불일치 | D2 구현 | `spec/5-system/9-rag-search.md §3.3.1·§3.3.2` | spec §3.3.1 v1 결정 서술 및 §3.3.2 step 3 "항상" 문구를 conditional escalate 기반으로 갱신 (D1 먼저 착수, D2 는 spec 갱신 후 별도 PR 분리 옵션도 유효) |
| W7 | Convention Compliance | `pending_plans:` 에 D1·D2 를 책임지는 plan 등재 누락 가능성 | `spec/5-system/9-rag-search.md` frontmatter `pending_plans:` | `spec/conventions/spec-impl-evidence.md §2.1` 등재 의무 | D1·D2 구현 plan 경로를 `pending_plans:` 에 명시적으로 추가, `rag-rerank-followup.md` 가 D1·D2 포함 여부 확인 |
| W8 | Convention Compliance | D1 app-layer 동적 컷 실패 케이스의 에러 코드가 spec §6 에 정의되지 않음 | D1 `applyDynamicCut` 구현 | `spec/5-system/9-rag-search.md §6` 에러 처리, `spec/conventions/error-codes.md §1` | "동적 컷 실패 시 기존 `search_failed` fallback 처리" 또는 신규 에러 코드를 spec §6 에 명시 후 구현 |
| W9 | Plan Coherence | `rag-quality-improvement.md §3 P1` spec 갱신 phase 가 미완(`[ ]`) 상태에서 구현 착수 예정 | 전체 D1·D2 구현 착수 선언 | `plan/in-progress/rag-quality-improvement.md §3 P1` spec 갱신 체크박스 | spec 갱신 완료(C1~C4 해소) 후 해당 체크박스 완료 표시 → developer 착수 |
| W10 | Naming Collision | `tokenBudget` (~8000) 이름·값이 기존 working-memory 압축용 `tokenBudget` / `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) 과 중복 | `dynamic-cut.ts` 신규 파라미터/상수 | `ai-agent.schema.ts` `DEFAULT_MEMORY_TOKEN_BUDGET`, `agent-memory-injection.ts` 파라미터 `tokenBudget` | `ragTokenBudget` / `RAG_INJECT_TOKEN_BUDGET` 등 RAG prefix 명명으로 구분 |
| W11 | Naming Collision | `ragTopK .default(5)` 제거 후 spec 4개 위치 기본값 표기와 식별자 의미 충돌 | zod schema 변경 | `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/9-rag-search.md §3.1` | C3 와 동일 — spec 선갱신 필수 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | D1 `tokenBudget ~8000` 이 `memoryTokenBudget` 기본값 8000 과 동일 상수 공유 혼선 | `dynamic-cut.ts` 상수, `spec/4-nodes/3-ai/1-ai-agent.md §1 memoryTokenBudget` | spec 갱신 시 RAG token-budget 을 `ragInjectTokenBudget` 등 별도 이름으로 명시 |
| I2 | Cross-Spec | D1 tokenBudget 추정 char/3 균일 방식 vs ai-agent memory language-aware 휴리스틱 불일치 | `dynamic-cut.ts` 추정 로직, `spec/4-nodes/3-ai/1-ai-agent.md §6.1` | spec 갱신 시 dynamic-cut 의 char/3 추정 의도적 분리 근거 명시 |
| I3 | Rationale Continuity | D2 conditional escalate 도입 시 `ragDiagnostics.rerank.llmGradingApplied` 필드 의미 변경 필요 | `spec/5-system/9-rag-search.md §4.2` `llmGradingApplied` | D2 구현 시 §4.2 설명을 "conditional escalate 시 false 가능" 으로 보완 |
| I4 | Convention Compliance | spec 3섹션 구조(Overview/본문/Rationale) 준수 확인 — D1·D2 Rationale 항목 기존 bullet 스타일로 추가 필요 | `spec/5-system/9-rag-search.md` 전체 | D1·D2 관련 Rationale 항목을 I5 이후 연번으로 추가 |
| I5 | Convention Compliance | `spec/5-system/9-rag-search.md` frontmatter `id: rag-search` — kebab-case 규약 준수 확인 | frontmatter | 이상 없음 |
| I6 | Plan Coherence | stale worktree 6건 (merged PR) — cleanup 실행 권장 | `.claude/worktrees/` | `rag-quality-proposal-0c618c`, `rag-rerank-impl`, `plan-complete-p6-043804`, `harden-review-hooks-cb1c84`, `exec-park-durable-resume`, `fix-carousel-waiting-status-4d4ed3` |
| I7 | Naming Collision | `injectCap ~12` 가 rerank 경로 `candidateK`/`top_k` 슬라이스와 역할 혼동 가능 | `dynamic-cut.ts` 내부 상수, `rag-search.service.ts` `candidateK` | `maxInjectCount` / `topKCap` 등 명확한 이름으로 구분 |
| I8 | Naming Collision | D2 `cross_encoder_llm` 동작 변경 시 §3.3.1 테이블 "항상 LLM grading" 문구 불일치 | `spec/5-system/9-rag-search.md §3.3.1·§3.3.2` | W6 와 동일 — spec 동시 갱신 |
| I9 | Naming Collision | `dynamic-cut.ts` 파일명에 type suffix 없음 — 기존 `<role>.<type>.ts` 컨벤션 불일치 | `codebase/backend/src/modules/knowledge-base/search/` | `dynamic-cut.util.ts` 또는 `search/utils/dynamic-cut.ts` 로 컨벤션 준수 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | D1 off 경로 byte-identical 파기 (3개 spec 위치), ragTopK 기본값 4개 위치 충돌, D2 v1 결정 충돌 |
| Rationale Continuity | HIGH | D1 off 경로 byte-identical invariant CRITICAL 파기, D2 새 Rationale 부재, ragTopK 의미 변경 근거 부재 |
| Convention Compliance | HIGH | CRITICAL 2건(off byte-identical 미반영, ragTopK default 미반영), WARNING 3건(D2 spec 불일치, pending_plans 누락, 에러코드 미정의) |
| Plan Coherence | CRITICAL | D2 P0 선행조건 미충족 일방 우회(CRITICAL), D1 spec 선갱신 미완(WARNING), rag-quality-improvement §3 P1 미완(WARNING) |
| Naming Collision | MEDIUM | `tokenBudget` 이름·값 중복(WARNING), `ragTopK` spec 불일치(WARNING), INFO 3건 |

---

## 권장 조치사항

1. **(BLOCK 해소 최우선 — C1·C2) `off` 경로 byte-identical 약속 해소**: `project-planner` 가 `spec/5-system/9-rag-search.md §3.3.1` 표의 `off` 행, §3.1 `$4` 파라미터 설명, §3.3.2 흐름, Rationale "byte-identical" 항목을 D1 실제 동작(wide 회수 → app-layer 동적 컷)으로 갱신 후 `--spec` consistency-check BLOCK:NO 확인.
2. **(BLOCK 해소 — C3) `ragTopK` 기본값 변경 spec 선갱신**: `project-planner` 가 `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/0-common.md §2`, `spec/5-system/9-rag-search.md §2.1·§3.1` 4개 위치에서 기본값 `5` 를 제거하고 "미지정 시 dynamic cut inject-cap(12) ceiling 지배, 명시 시 ceiling override" 로 갱신. Rationale 에 "왜 v1 기본값을 버리는가" 근거 추가.
3. **(BLOCK 해소 — C4) D2 착수 선결조건 해소**: `rag-quality-improvement.md §7.B` P0 baseline 먼저 완료해 실 골든셋 기반 임계를 확정하거나, D2 범위를 "conditional escalate 진입점 구조 추가 + 임계 TBD·플래그-off" 로 제한해 `rag-rerank-followup.md` pending 항목과 합의. `rag-rerank-followup.md` line 18 항목 상태를 `[~]` 또는 범위 제한 내용으로 갱신.
4. **(BLOCK 해소 후 — W5·W6) D2 spec 선갱신**: D2 착수 전 spec §3.3.1·§3.3.2 "항상 LLM grading" 문구를 "conditional escalate(정량 임계 A/B 는 후속 확정)" 로 갱신, Rationale 에 도입 근거 추가. D1 을 먼저 착수하고 D2 는 이 spec 갱신 완료 후 별도 PR 분리 옵션도 유효.
5. **(구현 착수 전 정비 — W7~W9)**: spec `pending_plans:` 에 D1·D2 plan 경로 등재, `rag-quality-improvement.md §3 P1` spec 갱신 체크박스 완료 후 developer 착수 순서 준수.
6. **(구현 중 — W10·I9)**: `dynamic-cut.ts` 내 `tokenBudget` 파라미터/상수를 `ragTokenBudget`/`RAG_INJECT_TOKEN_BUDGET` 으로 명명, 파일명은 `dynamic-cut.util.ts` 로 type suffix 추가.
7. **(정리 — I6)**: stale worktree 6건 `./cleanup-worktree-all.sh --yes --force` 실행.