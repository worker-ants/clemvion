# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
검토 일시: 2026-06-05

---

## 발견사항

### [WARNING] `spec/5-system/4-execution-engine.md` 동시 편집 — `impl-exec-concurrency-cap` worktree와 충돌 후보

- **target 위치**: `spec/5-system/4-execution-engine.md` 전반 (§1.1 전이표, §4.x park 구현 메모, §6.1 variables 행, §6.2 `waiting_for_input` 진입 시 storage 행, §7.4 Worker 동작, §7.5 rehydration case diagram, §Rationale "park 즉시 해제")
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)
- **상세**:
  - `exec-park-durable-resume` (target) 는 `spec/5-system/4-execution-engine.md` 에 Phase B(park=세그먼트 종료, slow-path 일원화)를 반영한다 — `Execution.conversation_thread`(V084) + `Execution.user_variables`(V085) 를 `waiting_for_input` 진입 시 storage 행에 추가, Worker 동작 행을 "항상 rehydration 단일 경로"로 교체, §4.x 구현 메모를 "park=세그먼트 종료(Phase B)"로 교체, `information_extractor` A2b 지원 반영.
  - `impl-exec-concurrency-cap` worktree (`claude/impl-concurrency-cap-pr2b`, 아직 PR 없음 — Step 1 ACTIVE, Step 2 PR 없어 Step 3 conservative ACTIVE)는 동일 파일을 기준선 대비 독립적으로 수정 중이다. 해당 diff 를 보면 여전히 "ai_agent 한정" 서술(A2b 이전 상태), `Execution.conversation_thread`/`user_variables` 컬럼이 없는 `waiting_for_input` storage 행, "코루틴이 in-process 로 살아있어 fast-path" 언어(Phase B 이전 상태)가 남아있다.
  - 즉 두 worktree 가 동일 파일의 **동일 섹션 여러 군데**를 서로 다른 모델로 수정하고 있어, `impl-concurrency-cap-pr2b` 브랜치가 `exec-park-durable-resume` 의 PR 이후 rebasing 없이 spec 변경을 push 하면 **target 의 Phase B 서술이 부분 또는 전면 덮어씌워지는 merge conflict 위험**이 있다.
  - `exec-park-durable-resume` plan 은 이미 이 상황을 인지하고 있다("PR2b 실착수 시 V086+ renumber 조율(현재 V085 자유)"), 그러나 spec 파일 충돌 조율 절차는 명시적으로 기재되지 않았다.
- **제안**:
  - `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수 전에 `exec-park-durable-resume` PR-B1(branch `claude/exec-park-b1`, 현재 작업 중)이 main 에 머지된 후 `impl-concurrency-cap-pr2b` 브랜치를 rebase 해 최신 `spec/5-system/4-execution-engine.md` 를 베이스로 삼아야 한다. PR2b 의 spec 변경 범위가 §8(동시성 cap)·§4.2 active-running invariant 이고 target 의 §4.x/§7.4/§7.5/§6.2 Phase B 서술과 섹션이 달라 충돌은 기계적이더라도, merge 후 일관성 확인이 필요하다. `exec-intake-queue-impl.md` 에 "PR2b spec 수정 전 `exec-park-durable-resume` PR-B1 머지 확인 후 rebase" 선행 조건을 명기 권장.

---

### [INFO] `impl-exec-concurrency-cap` worktree 의 `_resumeCheckpoint` 범위 서술이 A2b 이전 상태

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.3 `_resumeCheckpoint` 보존 예외 절
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`)
- **상세**: `impl-concurrency-cap-pr2b` diff 는 `_resumeCheckpoint` 적용 범위를 "ai_agent 한정"으로 되돌리는 변경을 포함한다. target (`exec-park-durable-resume`) 은 A2b 에서 `information_extractor` 를 포함한 합집합 서술로 이미 갱신했다. 이 역행은 위 WARNING 에서 설명한 동일 파일 충돌의 일부이며, PR-B1 머지+rebase 이후 자연 해소된다.
- **제안**: 별도 조치 불필요. 위 WARNING 의 rebase 조치로 함께 해소된다.

---

### [INFO] `plan/in-progress/exec-park-durable-resume.md` Phase 0 항목 미완료 — cross-link 표기 대기 중

- **target 위치**: `plan/in-progress/exec-park-durable-resume.md` Phase 0 체크리스트
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (PR3 이관), `plan/in-progress/node-cancellation-infrastructure.md` (§2 직렬화 순서)
- **상세**: Phase 0 의 "(planner) 출처 plan 항목 이관 표기 + cross-link" 항목이 체크되지 않은 채로 남아있다. 이는 project-planner 트랙 미완료로, Phase A2/B2 착수 전에 수행해야 한다는 plan 의 자체 기술과 일치한다. target spec (`spec/5-system/4-execution-engine.md`) 과 직접 충돌은 없으나, plan 추적 정합성 차원에서 기록한다.
- **제안**: project-planner 가 Phase B2 착수 전에 `exec-intake-queue-impl.md` PR3 항목과 `node-cancellation-infrastructure.md §2` 에 이관 표기 + cross-link 를 추가한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

`spec/5-system/` 파일을 수정하는 worktree 후보 전체 목록과 stale 판정 결과:

| worktree | branch | stale 판정 |
|---|---|---|
| `agent-a382d5fc6d0ac5aca` | `claude/agent-a382d5fc6d0ac5aca` | Step 2 PR MERGED → **stale skip** |
| `agent-a78619aab700d87a4` | `claude/agent-a78619aab700d87a4` | Step 2 PR MERGED → **stale skip** |
| `competitive-analysis-e0569b` | `claude/competitive-analysis-e0569b` | Step 2 PR MERGED → **stale skip** |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | Step 2 PR MERGED → **stale skip** |
| `fix-spec-frontmatter-catalog` | `claude/fix-spec-frontmatter-catalog` | Step 2 PR MERGED → **stale skip** |
| `impl-exec-concurrency-cap` | `claude/impl-concurrency-cap-pr2b` | Step 1 ACTIVE, Step 2 PR 없음 → Step 3 보수적 ACTIVE — **분석 대상** (위 WARNING 참조) |
| `impl-exec-intake-queue` | `claude/impl-exec-intake-queue` | Step 2 PR #463 MERGED → **stale skip** |
| `integration-index-unify-2c7973` | `claude/integration-index-unify-2c7973` | Step 2 PR MERGED → **stale skip** |
| `kb-quality-fba2f2` | `claude/kb-quality-fba2f2` | Step 2 PR MERGED → **stale skip** |
| `makeshop-api-catalog-730deb` | `claude/makeshop-api-catalog-730deb` | Step 2 PR MERGED → **stale skip** |
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | Step 2 PR MERGED → **stale skip** |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | Step 1 STALE → **stale skip** |

stale skip 11건 중 정리되지 않은 worktree 가 다수 존재한다. `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다.

---

## 요약

`spec/5-system/` 전반에 대해 주요 충돌 위험은 **`spec/5-system/4-execution-engine.md` 한 파일에 집중**된다. target (`exec-park-durable-resume`)은 Phase B(park=세그먼트 종료, slow-path 일원화)·A2b(`information_extractor` checkpoint)·A3(user_variables durable commit) 을 spec 에 반영했고, 유일하게 ACTIVE 상태인 병렬 worktree `impl-exec-concurrency-cap`(`claude/impl-concurrency-cap-pr2b`)이 동일 파일을 Phase B 이전 모델 상태로 수정 중이어서, PR-B1 머지 이전에 `impl-concurrency-cap-pr2b` 가 spec 변경을 push 하면 merge conflict 또는 Phase B 서술 덮어쓰기 위험이 있다. 미해결 결정 우회나 독립적 의사결정 충돌은 없으며, `exec-park-durable-resume` plan 의 모든 결정(D1~D5)은 확정·이행 완료 상태다. worktree 충돌 후보 12건 중 stale 11건 skip, active 1건(`impl-exec-concurrency-cap`) 분석.

---

## 위험도

MEDIUM
