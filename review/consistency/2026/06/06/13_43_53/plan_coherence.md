# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target: `spec/5-system/4-execution-engine.md` (scope 기준)
실제 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 외 코드 파일만 — `spec/5-system/4-execution-engine.md` 자체는 이번 브랜치에서 수정 없음.

## 발견사항

### [INFO] target 구현이 spec 의 "PR-B2b 구현 예정" 표식을 실현함 — spec flip 미포함은 계획된 분리

- target 위치: `exec-park-durable-resume.md §PR-B2b 진행 상태` — "spec flip (남음, project-planner)" 항목
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` §PR-B2b 진행 상태 + `plan/in-progress/spec-draft-exec-park-b2-durable.md` C3/C5
- 상세: `spec/5-system/4-execution-engine.md §7.5 중첩 sub-workflow 재개` 절은 "설계 확정, PR-B2 후속 커밋에서 구현 예정"으로 표기되어 있으나, 본 브랜치가 step 8(D6) 구현을 완료했다. target 브랜치는 spec flip 을 의도적으로 포함하지 않았고 plan 에도 "spec flip (남음, project-planner)" 로 명시되어 있으므로 충돌이 아니다. spec 과 구현이 일시 불일치하나 plan 에 후속 단계로 추적되고 있음.
- 제안: 이번 PR 머지 후 `spec-draft-exec-park-b2-durable.md` C3/C5 와 `spec-update-exec-park-d6-rehydration-step2.md` 를 project-planner 가 일괄 spec flip 할 때 §7.5 "구현 예정" 표식 제거 + step 2 문구 갱신을 병행해야 한다. 두 plan 모두 `worktree: exec-park-b2b-04a2f8` 와 `worktree: exec-park-durable-resume` 로 인지된 상태.

---

### [WARNING] full B3 제거(pendingContinuations·firstSegmentBarriers·firePayload 제거)가 이번 브랜치에서 미완료 — plan 후속 항목 추적 필요

- target 위치: `exec-park-durable-resume.md §PR-B2b 진행 상태` — "full B3 제거 (남음)" 체크박스
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md §B3` + §PR-B2 구현 설계 변경 단위 6항
- 상세: plan 은 "step 8(중첩 durable resume) → 그 위에 B3 제거(pendingContinuations/barriers/firePayload/detached 제거 + detached→await + applyContinuation 일원화)" 순서를 명시했고, 현재 이번 브랜치는 step 8 까지만 구현(unit green)한 상태다. B3 제거가 plan 에 후속 항목으로 남아 있으므로 미해결 결정과의 충돌은 아니나, 이번 PR 머지 후 동일 worktree 에서 이어서 B3 제거 및 dockerized e2e 를 수행해야 한다는 후속이 plan 에 명확히 남아 있다. 현재 이를 다루는 plan 항목은 존재하나, PR 제목이 "PR-B2b step 8" 로 한정돼 있어 B3 미포함 사실이 PR 설명에서 명확하지 않을 경우 리뷰어가 완료로 오인할 수 있다.
- 제안: PR description 에 "step 8(D6 durable resume) 완료 / B3(in-memory 머신 제거)·dockerized e2e·spec flip 은 후속 커밋에서 동일 worktree 계속 진행" 을 명기하는 것 권장. plan 의 체크박스 상태는 이미 정확히 반영되어 있음.

---

### [INFO] `impl-concurrency-cap-pr2b` worktree 가 `spec/5-system/4-execution-engine.md` 를 동시에 수정 중 — 그러나 target 브랜치는 해당 spec 파일을 수정하지 않으므로 이번 PR 에서는 무충돌

- target 위치: N/A (target 브랜치 변경 파일 목록에 `spec/5-system/4-execution-engine.md` 없음)
- 관련 plan: `exec-park-durable-resume.md §진행 메모 W4` — "impl-concurrency-cap-pr2b worktree 가 spec/5-system/4-execution-engine.md 를 Phase B 이전 모델로 수정 중" 경고
- 상세: `impl-concurrency-cap-pr2b` 브랜치는 git Step 1(non-ancestor, ACTIVE), Step 2(PR 없음, fallback ACTIVE) 기준 active. 해당 브랜치는 `spec/5-system/4-execution-engine.md` 를 수정하고 있으나, 본 target 브랜치(`exec-park-b2b-04a2f8`)는 동 파일을 수정하지 않으므로 이번 머지 자체에서는 spec 경합이 없다. 그러나 이후 spec flip PR(B3 + project-planner)이 해당 파일을 수정할 때 `impl-concurrency-cap-pr2b` 와 rebase 충돌 가능성은 plan W4 에 이미 기록되어 있으며 exec-intake-queue-impl.md PR2b 착수조건에 명기됨.
- 제안: 현 상태에서 조치 불요. spec flip PR 착수 전 `impl-concurrency-cap-pr2b` rebase 선행 확인(기존 W4 조치 그대로).

---

### [INFO] `exec-park-pr-b2`(PR-B2a) worktree — Step 2 PR MERGED, stale skip

- 관련 worktree: `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`)
- 상세: gh pr list Step 2 결과 state=MERGED. PR-B2a(top-level AI turn-park) 는 이미 main 에 머지됨(#494 `8538ed8a`). 이 worktree 가 `exec-park-durable-resume` 로 mapping 되어 있으나, 기반 브랜치 자체는 MERGED — plan 이 명기한 후속(B3, spec flip)을 진행하려면 fresh worktree 또는 신규 branch 를 사용하는 것이 권장됨(plan 진행 메모에서 이미 fresh worktree `claude/exec-park-b2b-04a2f8` 로 분리).

---

### [INFO] `spec-update-exec-park-d6-rehydration-step2.md` — 본 worktree 내 생성, spec 갱신 대기 중

- target 위치: `/plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` (worktree: exec-park-b2b-04a2f8)
- 관련 plan: `spec-draft-exec-park-b2-durable.md` C3/C5 (worktree: exec-park-durable-resume)
- 상세: ai-review SUMMARY INFO#16/17 기반으로 생성된 spec drift 초안이 본 worktree 에 존재한다. `spec/5-system/4-execution-engine.md §7.5 step 2` 의 "executeInline 재호출" 기술이 실제 구현(driveResumeFrame 직접 그래프 구동) 과 다르다는 내용. project-planner 가 spec flip 시 함께 처리해야 하는 항목으로 plan 에서 이미 인지된 상태.

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 전체 목록 및 판정:

- `rag-dynamic-cut-12fac1` (branch `claude/rag-dynamic-cut-12fac1`) — Step 1 ancestor check: STALE (branch HEAD 가 origin/main 의 조상). 검토 대상에서 제외.
- `harden-review-hooks-cb1c84` (branch `claude/harden-review-hooks-cb1c84`) — Step 1 ACTIVE, Step 2 PR #493 MERGED → stale (squash merge). 검토 대상에서 제외.
- `plan-complete-p6-043804` (branch `claude/plan-complete-p6-043804`) — Step 1 ACTIVE, Step 2 PR MERGED → stale. 검토 대상에서 제외.
- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 1 ACTIVE, Step 2 PR MERGED(#494) → stale. 검토 대상에서 제외. (단 plan 파일 `exec-park-durable-resume.md` 는 target worktree 에서도 수정 중 — plan 파일 동기화는 plan 에서 이미 인지된 패턴.)
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 ACTIVE, Step 2 PR 없음(empty) → Step 3 fallback: ACTIVE. 위 §INFO 참조. target 브랜치가 동 spec 파일을 수정하지 않으므로 이번 PR 에서는 CRITICAL 해당 없음.
- `fix-carousel-waiting-status-4d4ed3` (branch `claude/fix-carousel-waiting-status-4d4ed3`) — Step 1 ACTIVE, Step 2 PR MERGED → stale. 검토 대상에서 제외.

stale skip 4건: `rag-dynamic-cut-12fac1` (Step 1), `harden-review-hooks-cb1c84` (PR #493 MERGED), `plan-complete-p6-043804` (PR MERGED), `fix-carousel-waiting-status-4d4ed3` (PR MERGED), `exec-park-durable-resume`/`exec-park-pr-b2` (PR #494 MERGED).

stale worktree 가 남아 있을 이유 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

## 요약

target 브랜치(`exec-park-b2b-04a2f8`)의 구현은 `exec-park-durable-resume` plan 의 D6/PR-B2b step 8 항목(`resume_call_stack` stage + `driveCallStackResume`/`driveResumeFrame`/`injectInvokerOutput` + executeInline park-release)을 정확히 이행하고 있으며, plan 의 미해결 결정·미해소 선행 조건과 충돌하는 일방적 결정이 없다. `spec/5-system/4-execution-engine.md` 자체는 이번 브랜치에서 수정되지 않아 타 worktree 와의 spec 파일 경합이 없다. spec flip 미포함·full B3 미완료·dockerized e2e 미완료는 plan 에 후속 항목으로 명시되어 있어 누락이 아닌 계획된 분리다. worktree 충돌 후보 7건 중 stale 5건 skip, active 2건 분석(exec-park-pr-b2=PR MERGED→stale; impl-concurrency-cap-pr2b=no PR→active, 단 spec 파일 경합 없음).

## 위험도

LOW
