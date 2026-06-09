# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)
Target 문서: `spec/5-system` (영향 spec: `9-rag-search.md`, `2-navigation/5-knowledge-base.md`, `8-embedding-pipeline.md`)
검토 worktree: `.claude/worktrees/kb-unsearchable-warning-b47e20` (branch `claude/kb-unsearchable-warning-b47e20`)

---

## 발견사항

### [INFO] spec 변경이 이미 origin/main 에 머지됨 — 본 worktree 의 target diff 는 codebase 전용

- target 위치: `plan/in-progress/kb-unsearchable-warning.md` 체크리스트 §spec 변경 항목
- 관련 plan: `plan/in-progress/kb-unsearchable-warning.md` — spec 변경(project-planner) phase 완료 표기 (`[x]`)
- 상세: PR #508 (`docs(spec): rag-search/KB — 검색 불가(embedding_dimension NULL) 신호화 + 목록 경고`)가 `origin/main` 커밋 `37ebd640` 로 머지됨. 현재 worktree 의 `spec/5-system/9-rag-search.md` / `spec/5-system/8-embedding-pipeline.md` / `spec/2-navigation/5-knowledge-base.md` 는 origin/main 과 diff 없음(`git diff origin/main -- spec/` 출력 0). worktree 는 codebase 구현 커밋(`1b41ec56` feat + `bd9a8d98` ai-review WARNING 반영)만 보유. spec 구현 분리 패턴이 정상 동작 중.
- 제안: 현 상태 정상. 별도 조치 불요.

---

### [WARNING] `kb-model-change-reembed-followup.md` — "결정 필요" 선택지가 열려 있는 동안 후속 구현 착수 가능성

- target 위치: `plan/in-progress/kb-unsearchable-warning.md` §결정 → "follow-up 분리 → plan/in-progress/kb-model-change-reembed-followup.md"
- 관련 plan: `plan/in-progress/kb-model-change-reembed-followup.md` §검토할 선택지 (3가지 미결정)
- 상세: `kb-model-change-reembed-followup.md` 는 `KnowledgeBaseService.update()` 의 모델 변경 시 재임베딩 정책(자동 트리거 / 저장 차단+모달 / 경고 강화)을 미결 상태로 열어두고 있다. 이는 현재 spec(`8-embedding-pipeline §7.3` / `2-navigation/5-knowledge-base §2.2` 임베딩 모델 변경 경고 / `9-rag-search §5 임베딩 모델 일관성`) 이 아직 정의하지 않은 정책 영역이다. `kb-unsearchable-warning` worktree 의 구현(A 백엔드 신호 + B 프론트 카드 경고)은 이 미결 결정과 충돌하지 않는다 — 신호·경고 노출은 어떤 선택지가 선택되어도 유효. 단, 후속 plan 착수 시 spec 변경이 선행되지 않으면 `developer` 가 `update()` 자동 트리거를 구현하고 spec 과 diverge 하는 시나리오를 방지해야 한다.
- 제안: `kb-model-change-reembed-followup.md` 에 명시적으로 "착수 전 project-planner spec 선갱신 의무" 조항을 1줄 추가 권장. (현재 §비고에 "spec 변경이 필요하므로 착수 시 project-planner 선행"이라는 문장이 있어 의도는 명시됨. 추가 조치 불요이면 무시 가능.)

---

### [INFO] `rag-dynamic-cut.md` 의 비차단 후속 advisory 항목이 target spec 과 겹침

- target 위치: `spec/5-system/9-rag-search.md` (KB-GR-SR-05, §3.4 동적 점수 컷 cross-ref 등)
- 관련 plan: `plan/in-progress/rag-dynamic-cut.md` §비차단 후속 (advisory) — "주변 spec 보강: 7-llm-client §3.6 / 10-graph-rag KB-GR-SR-05 / 4-integration KB-AG-04"
- 상세: PR #503 (`feat(rag-search): P1 후속 — pgvector HNSW ef_search recall 보전 + 주변 spec 정합`) 이 `origin/main` 에 머지되어(`18edfea0`) `10-graph-rag KB-GR-SR-05`·`9-rag-search §3.3.2`·`7-llm-client §3.6` 등을 이미 갱신했다. `rag-followup-efsearch.md` 의 step 4(push + PR)가 미체크 상태이나 실제로는 PR #503 으로 이미 반영됨. `rag-dynamic-cut.md` 에 advisory 항목이 일부 잔류하나 git 기준 spec 은 정합. `kb-unsearchable-warning` target 과 직접 충돌 없음.
- 제안: `rag-followup-efsearch.md` step 4 체크 및 plan complete/ 이동, `rag-dynamic-cut.md` advisory 항목 정리를 별도 plan-housekeeping 로 처리 권장. `kb-unsearchable-warning` 진행 차단 아님.

---

### [INFO] `rag-rerank-followup.md` — `spec/5-system/1-auth.md §3.2` 에 RerankConfig RBAC 행 추가 완료 (충돌 없음)

- target 위치: `spec/5-system/1-auth.md §3.2` 리소스별 권한 매트릭스 (target 문서에 포함)
- 관련 plan: `plan/in-progress/rag-rerank-followup.md` — RerankConfig RBAC 행 `[x]` 완료 표기
- 상세: `1-auth.md §3.2` 에 `Rerank Config | CRUD | CRUD | R | R` 행이 존재하며 audit log §4.1 에 `rerank_config.create/update/delete` 도 추가 완료됨. `kb-unsearchable-warning` target 은 `1-auth.md` 를 수정하지 않으므로 충돌 없음.
- 제안: 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석:

target plan `kb-unsearchable-warning.md` 의 `spec_impact`: `spec/5-system/9-rag-search.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/8-embedding-pipeline.md`.

동일 spec 을 수정하는 다른 plan frontmatter 의 `worktree` 필드를 확인:

| plan | worktree 필드 | spec 중첩 여부 |
|---|---|---|
| `rag-dynamic-cut.md` | `rag-dynamic-cut-12fac1` | `9-rag-search.md` 중첩 |
| `rag-followup-efsearch.md` | `rag-followup-efsearch-b6c8e8` | `9-rag-search.md` 중첩 |
| `rag-rerank-followup.md` | `rag-rerank-impl` | `9-rag-search.md` 참조 |

각 후보에 대해 stale 판정 cascade 수행:

### `rag-dynamic-cut-12fac1` (plan: `rag-dynamic-cut.md`)

- Step 1: `git merge-base --is-ancestor rag-dynamic-cut-12fac1 origin/main` → exit 1 (ACTIVE)
- Step 2: `gh pr list --state all --head rag-dynamic-cut-12fac1` → `[]` (PR 없음)
- Step 3 fallback: **active 로 처리**. 그러나 git worktree list 에 `.claude/worktrees/` 하위 해당 경로가 존재하지 않음. PR #500 (`feat(rag-search): P1 D1 점수 기반 동적 컷 + D2 conditional escalate`) 이 `adfb10de` 로 squash merge 됨 — Step 1 음성은 squash merge 로 인한 케이스. Step 2 PR 조회 실패는 remote branch 부재 또는 PR title 불일치 가능성. 물리 worktree 부재로 실제 파일 경합 없음.
  - stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `cleanup-worktree-all.sh` 실행 후 재검토 권장. 물리 worktree 없으므로 파일 경합 없음, CRITICAL 미해당.

### `rag-followup-efsearch-b6c8e8` (plan: `rag-followup-efsearch.md`)

- Step 1: `git merge-base --is-ancestor rag-followup-efsearch-b6c8e8 origin/main` → exit 1 (ACTIVE)
- Step 2: `gh pr list --state all --head rag-followup-efsearch-b6c8e8` → `[]`
- Step 3 fallback: active 로 처리. 그러나 PR #503 commit log (`18edfea0`) 로 확인 — 내용이 main 에 반영됨. squash merge 로 hash 변경. 물리 worktree 부재.
  - stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup 권장. 물리 worktree 없으므로 파일 경합 없음, CRITICAL 미해당.

### `rag-rerank-impl` (plan: `rag-rerank-followup.md`)

- Step 1: `git merge-base --is-ancestor rag-rerank-impl origin/main` → exit 1 (ACTIVE)
- Step 2: `gh pr list --state all --head rag-rerank-impl` → `[]`
- Step 3 fallback: active 로 처리. 물리 worktree 부재 (`.claude/worktrees/` 에 없음).
  - stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — cleanup 권장. 물리 worktree 없으므로 파일 경합 없음, CRITICAL 미해당.

worktree 충돌 후보 3건 전부: 물리 worktree 부재 확인, 실제 파일 경합 없음. stale 가능성 높으나 Step 1/2 cascade 양성 신호 없어 INFO 로 기록.

---

## 요약

`spec/5-system` 범위에서 plan 정합성 관점의 주요 충돌·미해소 선행 조건·후속 항목 누락은 발견되지 않았다. spec 변경(PR #508)은 이미 `origin/main` 에 반영되어 있고, 현재 worktree 의 변경 내용은 codebase 구현 전용으로 `spec/` 파일과 diff 없다. `kb-model-change-reembed-followup.md` 의 정책 미결 선택지(3가지)는 본 구현 범위(경고 노출 한정)와 충돌하지 않으며, follow-up plan 이 착수 전 project-planner 선행을 명시하고 있다. worktree 충돌 후보 3건(rag-dynamic-cut-12fac1 / rag-followup-efsearch-b6c8e8 / rag-rerank-impl)은 물리 worktree 미존재 확인으로 실제 파일 경합 없음; stale cascade Step 1/2 모두 음성이어서 active 처리하되 cleanup 권장. 전체 위험도: LOW.

### Stale skip 개수 요약
worktree 충돌 후보 3건 중 stale 확정 0건 (cascade Step 1/2 음성 — fallback active 처리), 물리 worktree 부재로 경합 없음 확인. `./cleanup-worktree-all.sh --yes --force` 실행으로 참조 정리 권장.

---

## 위험도

LOW
