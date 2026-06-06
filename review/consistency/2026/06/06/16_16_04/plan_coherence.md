# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target: `spec/5-system/4-execution-engine.md` 및 관련 codebase 변경 (worktree `exec-park-b2b-04a2f8`, branch `claude/exec-park-b2b-04a2f8`)
기준 plan: `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-exec-park-b2-durable.md`

---

## 발견사항

### [INFO] PR-B2b 구현 완료 — plan 항목과 완전 정합

- target 위치: 전체 diff (execution-engine.service.spec.ts, execution-engine.service.ts, park-release-signal.ts 등)
- 관련 plan: `exec-park-durable-resume.md` §PR-B2b 진행 상태 (L204~215)
- 상세: plan 의 PR-B2b 체크리스트(8a stage·8a call-stack·8d executeInline park-release·8c 중첩 재개·B3 제거·e2e·spec flip)가 모두 `[x]` 완료로 기록되어 있으며, diff 내용(processAiResumeTurn 직접 처리·pendingContinuations 제거·driveCallStackResume 신설·runExecutionFromQueue await 직접화 등)이 plan 설계와 정합한다. 미해결 결정(D1~D6)은 모두 확정 완료이며, target 변경이 미확정 결정을 일방적으로 내리는 사례 없음.
- 제안: 무조치.

---

### [INFO] B3 항목 형식적 미완료 ([ ] 잔존) — 실질 완료, plan 미갱신

- target 위치: 해당 없음(plan 내 형식 문제)
- 관련 plan: `exec-park-durable-resume.md` §B1(L93·L94), §B3(L102·L103)
- 상세: plan 본문 상단 B1/B3 섹션의 `[ ]` 항목들(PR-B2 멀티턴 AI, pendingContinuations 제거 등)이 `[x]`로 갱신되지 않았으나, L204~215 진행 메모 블록에서 해당 작업이 완료되었음이 명기되어 있다. 구조적 불일치이나 plan 본문 서두의 미완료 표기는 독자를 혼동시킬 수 있다.
- 제안: plan 파일 §B1(L93·L94)·§B3(L102·L103)의 `[ ]`를 `[x]`(PR-B2b, commit 2dbb31b6)로 갱신 권장. 기능 블로킹은 아님.

---

### [INFO] 잔여 umbrella 항목 — 별도 처리로 명시 분리

- target 위치: `exec-park-durable-resume.md` L213~L214
- 관련 plan: 동일
- 상세: plan 에 `[ ]`로 남은 두 항목 (a) PR-B2a follow-up(LLM_STUB_MODE 문서화·EIA §8.3·doc-sync·e2e ENCRYPTION_KEY), (b) umbrella 잔여(Phase 0 PR3 rehydration 일반화·node-cancellation §2·W4 cross-worktree rebase·W11/W12 아키텍처 추출)은 "본 PR 범위 밖 — 별도 처리" 로 plan 에 명시되어 있다. target diff 는 이 항목들을 건드리지 않으며 충돌 없음.
- 제안: umbrella 잔여 항목들은 별도 plan 또는 후속 worktree 로 이관 시 plan 완료 처리(plan-lifecycle §3) 수행 권장.

---

### [WARNING] impl-concurrency-cap-pr2b worktree 의 spec 덮어쓰기 리스크 미해소

- target 위치: `exec-park-durable-resume.md` L220 (W4 항목)
- 관련 plan: `exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b`)
- 상세: plan W4 가 "impl-concurrency-cap-pr2b worktree 가 spec/5-system/4-execution-engine.md 를 Phase B 이전 모델로 수정 중 → PR-B2 머지 후 해당 브랜치가 spec push 시 Phase B 서술 덮어쓰기 위험"을 명기하고 있다. `impl-concurrency-cap-pr2b` 브랜치는 Step 1(git merge-base)·Step 2(gh pr list) 모두 ACTIVE(PR 미개설·미머지). 해당 worktree 의 `exec-intake-queue-impl.md` 수정 외 spec 직접 수정은 현재 미착수(diff 확인)이지만, 착수 시 origin/main(now has PR-B2a #494 + PR-B2b의 변경)을 rebase 하지 않으면 spec 서술 역행 위험이 존재한다. exec-park-durable-resume.md 는 이를 "타 worktree 책임·본 plan 단독 해소 불가"로 기록하였으나, PR-B2b 완료 후 해당 rebase 의무 명기가 `exec-intake-queue-impl.md` 착수조건에 반영되었는지 확인이 필요하다.
- 제안: `exec-intake-queue-impl.md` PR2b 착수조건에 "origin/main rebase(PR-B2b 포함) 선행" 명기 여부 확인. `impl-concurrency-cap` worktree owner 가 PR2b 착수 전 rebase 수행하도록 조율.

---

### [INFO] exec-park-durable-resume worktree (branch claude/exec-park-pr-b2) — stale, 동일 spec 파일 중복 보유

- target 위치: 해당 없음
- 관련 plan: `exec-park-durable-resume.md` (worktree 이름 `exec-park-durable-resume`, 실제 branch `claude/exec-park-pr-b2`)
- 상세: `git worktree list` 결과 `.claude/worktrees/exec-park-durable-resume` 이 `claude/exec-park-pr-b2`(PR #494 MERGED, §worktree stale 판정 Step 2 stale 확인)를 체크아웃하고 있으며, `spec/5-system/4-execution-engine.md`·`spec/1-data-model.md` 등을 수정한 상태다. PR #494 가 main 에 머지되었으므로 이 worktree 는 stale — target(exec-park-b2b-04a2f8)과 동일 spec 파일 경합은 없음(branch 는 다르고 PR-B2a 코드는 이미 main에 반영). 단, stale worktree 미정리 시 혼동 가능.
- 제안: `./cleanup-worktree-all.sh --yes --force` 또는 `git worktree remove .claude/worktrees/exec-park-durable-resume` 실행 권장.

---

## Stale 으로 skip 한 worktree (의무 보고)

worktree 충돌 후보:
1. `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 2 PR #494 MERGED. `spec/5-system/4-execution-engine.md` 보유하나 stale로 판정. **CRITICAL 분류 제외, INFO 보고.**

skip 되지 않은 active worktree 충돌 후보:
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1 ACTIVE, Step 2 PR 미존재 → Step 3 fallback = active. 단, 현재 `spec/5-system/4-execution-engine.md` 에 대한 committed 변경 없음 → 현재 시점 실제 파일 경합 없음. 미착수 위험으로 WARNING 분류.

---

## 요약

PR-B2b(exec-park-b2b-04a2f8) 구현은 plan `exec-park-durable-resume.md`의 PR-B2b 설계(D4 turn-park·D6 중첩 call stack durable·full B3 제거·spec flip)와 완전 정합한다. 모든 미해결 결정(D1~D6)은 사전 확정되었으며 target이 미결정 사항을 일방적으로 결정하거나 다른 plan의 진행 중인 코드 영역과 충돌하는 사례는 없다. 주요 주의 사항은: (1) plan 상단 B1/B3 체크리스트가 형식적으로 미갱신(INFO), (2) `impl-concurrency-cap-pr2b` worktree 가 spec 착수 시 Phase B 이전 서술 역행 위험(WARNING — 현재 착수 전이라 즉각 블로킹 아님), (3) exec-park-durable-resume worktree가 stale 미정리 상태(INFO). worktree 충돌 후보 2건 중 stale 1건 skip, active 1건(현재 spec 미수정)은 WARNING으로 보고.

---

## 위험도

LOW
