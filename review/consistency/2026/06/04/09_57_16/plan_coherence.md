# Plan 정합성 분석 — spec/5-system/4-execution-engine.md (impl-done, PR1)

분석 대상: 구현 완료 후 검토 (--impl-done)
Target spec 영역: `spec/5-system/4-execution-engine.md`
Target worktree: `impl-exec-intake-queue`
기준 diff: `origin/main...HEAD`

---

## 발견사항

### [INFO] spec-sync-execution-engine-gaps.md — §4 항목 미닫힘

- target 위치: `exec-intake-queue-impl.md` §G2 관계, `spec-draft-exec-intake-queue.md` §후속 "side-effect — spec-sync plan 정리"
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` — §4 Worker 모델·§7.1 Worker Heartbeat·§8 동시 실행 제한 3건이 미체크 상태
- 상세: `spec-sync-execution-engine-gaps.md` 는 §4 Worker 모델("per-node task-queue, 현 in-process 확인")을 미구현 TODO 로 추적 중이다. PR1 구현은 그 per-node 모델을 폐기하고 execution-level intake 큐로 대체했으므로, §4 항목은 "per-node 모델 폐기로 대체됨 → exec-intake-queue-impl.md 로 forwarding" 으로 명시 닫기가 필요하다. `spec-draft-exec-intake-queue.md §후속` 에 "side-effect — spec-sync plan 정리" 가 TODO 로 있으나, PR1 구현 완료 시점까지 미처리됨.
- 제안: `spec-sync-execution-engine-gaps.md` 의 §4 항목에 "(per-node 모델 폐기 — exec-intake-queue-impl.md PR1 으로 대체됨, 2026-06-04)" 마커 추가. §7.1·§8 항목은 PR2-4 에서 처리 예정이므로 그대로 유지. `spec-draft-exec-intake-queue.md §후속` "side-effect" TODO 체크.

---

### [INFO] spec-sync-execution-engine-gaps.md worktree — stale 판정 불가

- target 위치: `spec-sync-execution-engine-gaps.md` frontmatter `worktree: spec-sync-audit`
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md`
- 상세: frontmatter `worktree: spec-sync-audit` 로 명시되어 있으나, `git worktree list` 에 `spec-sync-audit` 가 존재하지 않는다. 이는 이미 정리된(cleanup 된) worktree 로, 이 plan 자체는 `plan/in-progress/` 에 활성 추적자로 남아있다. worktree 부재이므로 §5 worktree 충돌 대상 아님.
- 제안: 추적 메모만. `spec-sync-audit` worktree 가 정리됐다면 이 plan 을 이어받을 별도 worktree 가 없는 상태 — 닫기 또는 재배정.

---

### [WARNING] spec-draft-exec-intake-queue.md §후속 — data-flow/3-execution.md 미반영 후속 누락

- target 위치: `exec-intake-queue-impl.md` §SPEC-DRIFT 반영 후속 WARNING #1·#2
- 관련 plan: 없음 (현재 plan 에만 TODO 로 존재)
- 상세: impl plan 은 "`spec/data-flow/3-execution.md` §1.1 시퀀스 다이어그램 + §2.2 BullMQ 표에 `execution-run` 반영" 을 별도 project-planner 후속으로 남겼다. 현재 어떤 in-progress plan 도 이 파일을 갱신하는 작업을 추적하지 않는다. PR1 의 `execution-run` 큐 도입이 `spec/data-flow/3-execution.md` 의 시퀀스 다이어그램(old in-process 흐름 기술)을 stale 로 만들었으나, 후속 작업이 plan 으로 등록되지 않았다.
- 제안: `spec/data-flow/3-execution.md` 갱신을 project-planner 후속 plan 또는 기존 plan 의 체크박스 항목으로 등록. 또는 `exec-intake-queue-impl.md` §SPEC-DRIFT 반영 후속 항목을 별도 planner-track plan 으로 승격.

---

### [WARNING] spec/data-flow/0-overview.md §4 + spec/5-system/16-system-status-api.md §1 미반영 후속 누락

- target 위치: `exec-intake-queue-impl.md` §consistency-check --impl-prep 후속 첫 번째 항목
- 관련 plan: 없음 (현재 어떤 plan 도 이 파일들을 다루지 않음)
- 상세: `--impl-prep` 산출(2026-06-04)에서 식별된 두 문서 미등재: `spec/data-flow/0-overview.md §4` 와 `spec/5-system/16-system-status-api.md §1` 에 `execution-run` 큐가 등록되지 않았다. impl plan 은 "(project-planner)" 후속으로 표기만 했을 뿐 plan 파일이 없다.
- 제안: 위 WARNING 항목과 묶어 project-planner 후속 plan 또는 기존 spec-sync plan 에 등재.

---

### [INFO] exec-intake-queue-impl.md §PR TEST WORKFLOW — /ai-review + --impl-done 미완

- target 위치: `exec-intake-queue-impl.md` §PR1 TEST WORKFLOW — `[ ] /ai-review + resolution`, `[ ] /consistency-check --impl-done spec/5-system/`
- 관련 plan: 없음 (본 검토가 --impl-done 의 일부)
- 상세: TEST WORKFLOW 의 lint/unit/build/e2e 는 완료됐으나 `/ai-review + resolution` 과 `/consistency-check --impl-done` 이 아직 체크되지 않은 상태다. 본 파일이 `--impl-done` 분석의 일부이므로, 본 검토 완료 후 해당 항목을 닫아야 한다.
- 제안: 본 분석 결과 write 완료 후 `exec-intake-queue-impl.md` 에서 `--impl-done` 항목을 체크. `/ai-review` 도 동일 턴에 진행 예정이라면 순서대로 닫기.

---

### [INFO] spec-update-exec-intake-queue-pr1.md 적용 절차 완료 여부 확인 필요

- target 위치: `spec-update-exec-intake-queue-pr1.md` §적용 절차 — step 3/4 (spec Edit + 재호출)
- 관련 plan: `plan/in-progress/spec-update-exec-intake-queue-pr1.md` (worktree: `impl-exec-intake-queue`)
- 상세: `spec-update-exec-intake-queue-pr1.md` 는 §4 배너·§9.3 표·§11 표 3곳을 수정하는 draft 다. `exec-intake-queue-impl.md §SPEC-DRIFT 반영` 에서 "PR1 구현 후 spec 반영 완료 (commit 별도)" 로 기술됐고, 실제 diff 를 보면 3곳 모두 이미 갱신됐다. 따라서 이 draft 는 이미 적용 완료된 것으로 보인다. draft plan 파일 자체는 완료 처리(complete/ 이동)가 필요하다.
- 제안: `spec-update-exec-intake-queue-pr1.md` 를 `plan/complete/` 로 이동 또는 `exec-intake-queue-impl.md` 의 SPEC-DRIFT 완료 마커 확인.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 목록 및 stale 판정 결과:

| worktree | branch | step 1 | step 2 | 판정 |
|---|---|---|---|---|
| `spec-exec-intake-queue` | `claude/spec-exec-intake-queue` | ACTIVE (squash merge → hash 불일치) | PR #458 MERGED | **stale** |
| `spec-inprogress-groom-c7568b` | `claude/spec-inprogress-impl2` | STALE | PR MERGED | **stale** |
| `rag-rerank-impl` | `claude/rag-rerank-impl` | STALE | empty (PR 없음) | Step 3 fallback → **active 로 보수 처리**. 단, Step 1 ancestor 음성이고 PR 도 없어 실제 stale 일 가능성 높음 — `./cleanup-worktree-all.sh --yes --force` 실행 후 재확인 권장 |
| `fix-bg-context-followups` | `claude/fix-bg-context-followups` | ACTIVE | OPEN | **active** — `spec/5-system/4-execution-engine.md` §5.5 ForEach 변수 명명 변경만, impl-exec-intake-queue 의 §4/§9.3/§11 변경과 **hunk 비겹침**. merge 시 충돌 위험 없음 (단, 두 worktree 가 같은 파일을 수정하므로 PR 순서 조율 권장) |

stale skip: `spec-exec-intake-queue` (Step 2 PR #458 MERGED), `spec-inprogress-impl2` (Step 1+2 STALE/MERGED) — 2건 skip.

`spec-exec-intake-queue` 및 `spec-inprogress-groom-c7568b` worktree 는 머지 완료된 branch 의 정리되지 않은 worktree. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

Plan 정합성 관점에서 CRITICAL 충돌 없음. PR1 구현은 spec 에서 "Planned" 로 표기됐던 §4.1–4.3 을 구현 완료로 flip 했고, spec SPEC-DRIFT 반영(§4 배너·§9.3·§11 3곳)도 완료됐다. 주요 후속 누락은 두 가지: `spec/data-flow/3-execution.md` + `spec/data-flow/0-overview.md §4` + `16-system-status-api.md §1` 갱신이 plan 에 미등재된 상태(WARNING 2건), `spec-sync-execution-engine-gaps.md` §4 항목 닫기 미완(INFO). `fix-bg-context-followups` worktree 는 동일 파일을 수정하나 hunk 비겹침으로 CRITICAL 아님. worktree 충돌 후보 4건 중 stale 2건 skip, active 2건(`fix-bg-context-followups`, `rag-rerank-impl(fallback)`) 분석.

---

## 위험도

LOW
