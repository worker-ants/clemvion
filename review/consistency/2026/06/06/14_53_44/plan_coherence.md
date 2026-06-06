# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-rag-dynamic-cut.md`
검토 모드: `--spec`

---

## 발견사항

### [WARNING] rag-quality-improvement.md §6 `[x]` 결정 항목이 이번 PR 로 번복되지만 `pending_plans` 갱신 누락
- target 위치: `spec-draft-rag-dynamic-cut.md §F (W9)`
- 관련 plan: `plan/in-progress/rag-quality-improvement.md §6` 라인 172
- 상세: `rag-quality-improvement.md §6` line 172는 `[x] P1 cross_encoder_llm escalate — 2026-06-04 확정: 항상 LLM grading(v1)` 로 **확정(체크)된 결정**이다. target plan §F (W9) 가 이를 "conditional escalate 메커니즘 도입(rag-dynamic-cut PR)" 으로 갱신한다고 명시하고 있으므로 해당 갱신 자체는 계획에 포함되어 있다. 그러나 `rag-quality-improvement.md` 의 frontmatter `worktree: rag-quality-proposal-0c618c` 는 MERGED PR #455 에 대응하는 stale 참조이며, 현재 이 파일을 실제로 수정하는 worktree 가 없다. target plan 이 §F 에서 plan 파일 편집을 자신의 작업 범위로 선언했으나 **결정 번복(D2 메커니즘 포함 결정)에 대해 `rag-quality-improvement.md §6` 내 "다음 결정" 미해결 항목 `[ ] P0 conditional escalate 임계 튜닝`(§7.C) 과의 관계를 명시하지 않는다.** §7.C 는 하베스 P0 이후 조건이고 target plan 이 "메커니즘 도입, 정량 임계 후속" 으로 구분하므로 실제 충돌은 없지만, §7.C 항목을 "메커니즘 구현 완료(rag-dynamic-cut), 정량 임계 A/B 후속" 으로 갱신하는 작업이 §F 에 명시되어야 한다.
- 제안: `spec-draft-rag-dynamic-cut.md §F` 에 `rag-quality-improvement.md §7.C` (D2 conditional escalate 임계 튜닝 항목) 에 "메커니즘 구현 완료" 상태 표기 1줄을 추가한다.

### [WARNING] `9-rag-search.md` pending_plans에 본 draft의 파일 경로가 불일치
- target 위치: `spec-draft-rag-dynamic-cut.md §A1`
- 관련 plan: `spec/5-system/9-rag-search.md` frontmatter
- 상세: `spec/5-system/9-rag-search.md` frontmatter `pending_plans` 에는 현재 `plan/in-progress/rag-rerank-followup.md` 만 등록되어 있다. §A1 은 `plan/in-progress/rag-dynamic-cut.md` 를 추가하라고 명시하는데, 실제 본 plan 파일의 이름은 `spec-draft-rag-dynamic-cut.md` 이다(동명의 `rag-dynamic-cut.md` 가 존재하는지 repo 에서 확인 불가). 만약 별도의 `rag-dynamic-cut.md` 구현 plan 이 없다면, `pending_plans` 에 등록해야 할 파일명은 `plan/in-progress/spec-draft-rag-dynamic-cut.md` 또는 향후 생성될 `plan/in-progress/rag-dynamic-cut-impl.md` 이어야 한다.
- 제안: §A1 의 `pending_plans` 추가 파일명을 실제 plan 파일(`spec-draft-rag-dynamic-cut.md` 또는 별도 impl plan) 로 정정하거나, `rag-dynamic-cut.md` 파일이 별도로 생성될 계획임을 본 draft 에 명시한다.

### [WARNING] `1-ai-agent.md` · `0-common.md` · `17-agent-memory.md` · `10-graph-rag.md` 에 본 draft가 `pending_plans` 미등록
- target 위치: `spec-draft-rag-dynamic-cut.md §B · §C · §D · §E`
- 관련 plan: 해당 spec 파일들의 frontmatter
- 상세: target plan 은 `spec/4-nodes/3-ai/1-ai-agent.md` (§B), `spec/4-nodes/3-ai/0-common.md` (§C), `spec/5-system/17-agent-memory.md` (§D), `spec/5-system/10-graph-rag.md` (§E) 를 모두 편집 예정이다. 그러나 §A1 에서 `9-rag-search.md` 에만 `pending_plans` 추가를 명시하고 위 4개 파일에 대한 `pending_plans` 갱신은 명시하지 않는다. 이 중 `1-ai-agent.md` / `0-common.md` / `17-agent-memory.md` 는 이미 다른 plan 들이 `pending_plans` 에 등록된 `status: partial` 파일이다. `10-graph-rag.md` 는 `status: implemented` 인데 spec 내용이 변경된다.
- 제안: spec 편집 전 각 파일 frontmatter `pending_plans` 에 본 plan 을 추가하는 단계를 draft §A1 에 병기하거나 §B~§E 각 섹션에 "frontmatter `pending_plans` 추가" 1행을 추가한다.

### [INFO] `10-graph-rag.md` 는 `status: implemented` — 변경 시 status 재검토 필요
- target 위치: `spec-draft-rag-dynamic-cut.md §E`
- 관련 plan: `spec/5-system/10-graph-rag.md` frontmatter (`status: implemented`)
- 상세: §E 는 `10-graph-rag.md` 두 라인을 수정한다(seed 회수 주석 + 동적 컷 주입 흐름). 변경이 경미한 주석/설명 수준이라 `status: implemented` 를 `partial` 로 격하할 필요는 없을 가능성이 높지만, 프로젝트 lifecycle 규약(spec-status-lifecycle guard)이 `implemented` 파일에 대한 편집 후 status 재검토를 요구하는지 확인이 필요하다. 현재 draft 에는 이에 대한 언급이 없다.
- 제안: §E 에 "`10-graph-rag.md` 는 `status: implemented` — 주석/흐름 설명 수정이므로 status 유지, spec-status-lifecycle 가드 통과 예상" 을 1줄 명기해 의도를 문서화한다.

### [INFO] `rag-rerank-followup.md` worktree 참조(`rag-rerank-impl`)는 MERGED 상태 — stale 참조
- target 위치: `plan/in-progress/rag-rerank-followup.md` frontmatter `worktree: rag-rerank-impl`
- 관련 plan: `plan/in-progress/rag-rerank-followup.md`
- 상세: `rag-rerank-followup.md` 의 `worktree: rag-rerank-impl` 은 PR #465 (MERGED) 의 브랜치를 가리킨다. 실제 worktree 폴더도 존재하지 않는다. 본 target plan 의 §F 에서 이 파일을 편집하므로, plan-coherence 관점에서 이 파일의 worktree 필드가 stale 임을 확인한다. target plan 의 §F 편집 자체에는 영향이 없다.
- 제안: `rag-rerank-followup.md` worktree 를 `(unstarted)` 또는 해당 후속 작업 전용 worktree sentinel 로 정정하는 것을 권장 (별도 cleanup 작업으로 처리 가능).

### [INFO] `ai-context-memory-followup-v2.md` 는 `17-agent-memory.md §3 AGM-04` 에 미해소 SPEC-DRIFT 보유 — 섹션 분리로 충돌 없음
- target 위치: `spec-draft-rag-dynamic-cut.md §D`
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` line 71
- 상세: `ai-context-memory-followup-v2.md` 는 `spec/5-system/17-agent-memory.md §3 AGM-04` (BullMQ 큐 설명 텍스트)의 SPEC-DRIFT 항목을 미해소 상태로 보유한다. target plan §D 는 `17-agent-memory.md` 라인 83 (`memoryTopK`/`ragTopK` 독립성 서술) 만 수정하므로 섹션이 다르다. 직접 충돌은 없다.
- 제안: 추적 메모 수준. target plan 진행 시 `17-agent-memory.md` 편집 전 해당 SPEC-DRIFT 가 동시에 처리되지 않는지 확인하면 된다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

| worktree 참조 | plan 파일 | Step 1 결과 | Step 2 결과 | 판정 |
|---|---|---|---|---|
| `rag-rerank-impl` | `rag-rerank-followup.md` | branch 미존재 (ACTIVE_OR_NOTEXIST) | PR #465 MERGED | **stale skip** |
| `rag-quality-proposal-0c618c` | `rag-quality-improvement.md` | branch 미존재 | PR #455 MERGED | **stale skip** |
| `ai-context-memory-9c7e6e` | `ai-context-memory-followup-v2.md` | ACTIVE (branch 존재) | PR #459 MERGED | **stale skip** |

- `rag-rerank-impl` (branch `claude/rag-rerank-impl`) — Step 2: PR #465 MERGED
- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 2: PR #455 MERGED
- `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) — Step 1 ACTIVE (branch HEAD not ancestor of main due to squash), Step 2: PR #459 MERGED

위 3건 모두 stale. 해당 plan 들이 follow-up 백로그 추적 용도로 `in-progress/` 에 남아 있는 경우 worktree 필드를 `(unstarted)` sentinel 로 갱신 권장. 물리 worktree 폴더가 존재하지 않으므로 `cleanup-worktree-all.sh` 대상은 없다.

---

## 요약

target plan `spec-draft-rag-dynamic-cut.md` 는 D1(동적 컷) + D2(conditional escalate) 설계를 5개 spec 파일에 반영하는 작업으로, `rag-rerank-followup.md` 의 "conditional escalate 정량 임계 후속" 결정과 정합하며 일방적 결정 우회는 없다. `rag-quality-improvement.md §6` 의 기존 "항상 grading(v1)" 확정 항목 번복은 §F (W9) 가 갱신을 명시하고 있으나, 동일 파일 §7.C (임계 튜닝 backlog 항목) 에 메커니즘 완료 표기가 누락되어 있다. 또한 수정 대상 4개 spec 파일(`1-ai-agent.md` · `0-common.md` · `17-agent-memory.md` · `10-graph-rag.md`) 에 대한 `pending_plans` 등록 누락과 `10-graph-rag.md` (status: implemented) 변경에 대한 status 검토 언급 부재가 WARNING/INFO 급으로 발견된다. Active worktree 충돌은 없다. worktree 충돌 후보 3건은 stale 판정(MERGED PR)으로 skip, active 0건 분석.

---

## 위험도

LOW
