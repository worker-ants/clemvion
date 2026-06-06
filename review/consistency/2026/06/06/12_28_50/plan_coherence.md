# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
대상 spec: `spec/5-system/4-execution-engine.md`
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] exec-park-durable-resume plan — PR-B2b(중첩 D6) 미완 surface 가 spec 에 "구현 예정" 표식으로 대기 중
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x banner / §7.5 rehydration / §6.2 durable park 스냅샷 목록
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` §Phase B → PR-B2b, `plan/in-progress/spec-draft-exec-park-b2-durable.md`
- **상세**: PR-B2a(top-level 멀티턴 AI turn-park)는 PR #494 로 머지 완료(2026-06-06). PR-B2b(중첩 sub-workflow D6 + full B3)는 미착수. `spec-draft-exec-park-b2-durable.md` 의 C1(`Execution.resume_call_stack`)/C3(중첩 durable)/C4(full B3 제거)/C5(spec 완료형 전환)는 PR-B2b 코드와 함께 적용 예정. 현재 spec §4.x 의 PR-B2a/B2b 롤아웃 표식이 PR-B2a 머지를 반영해 부분 갱신된 상태이나, B2b 관련 서술은 "구현 예정"으로 표시되어 있다. 충돌·일방 결정 없음 — plan 이 예고한 범위를 spec 도 그대로 명시.
- **제안**: 조치 불요. PR-B2b 착수 시 `spec-draft-exec-park-b2-durable.md` C5 절차(spec 재전환)를 따른다.

### [INFO] exec-intake-queue-impl — PR2b(동시성 cap) 착수 전 PR-B2(exec-park-pr-b2) rebase 선행 조건 충족됨
- **target 위치**: `spec/5-system/4-execution-engine.md` §4.x / §8 / §7.4 / §Rationale
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수 조건
- **상세**: PR2b 착수 전 필수 조건으로 "PR-B2 머지 후 `origin/main` rebase" 가 명기되어 있었다. PR-B2a(#494)가 2026-06-06 머지됨으로써 이 조건이 충족됐다. `impl-concurrency-cap-pr2b` 브랜치는 1개의 docs-only 커밋(`1d66eaa4`, PR2b 결정 기록)만 보유하고 rebase 미완료 상태이므로, PR2b 실착수 전 `origin/main` 으로 rebase 후 spec 두 파일(`spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`) 충돌 해소가 필요하다. 충돌·결정 우회 없음 — plan 에서 이미 예고한 대기 상태.
- **제안**: 조치 불요. PR2b 착수 시 plan 이 명기한 rebase 절차를 따른다.

### [INFO] spec-update-pr2a-active-running-invariants / spec-update-pr2a-timeout — 이미 spec 에 반영됐으나 plan 이 `in-progress` 유지
- **target 위치**: `spec/5-system/4-execution-engine.md` §8, Rationale
- **관련 plan**: `plan/in-progress/spec-update-pr2a-active-running-invariants.md`, `plan/in-progress/spec-update-pr2a-timeout.md`
- **상세**: 두 plan 모두 `worktree: impl-exec-concurrency-cap` 로 frontmatter 에 명시되어 있고, `spec-update-pr2a-timeout.md` 는 본문 말미에 "전부 반영 완료 (PR2a, 2026-06-04)" 로 기록되어 있다. 실제 spec 본문도 해당 갱신이 반영된 상태다. 두 plan 이 여전히 `plan/in-progress/` 에 남아 있으나 target spec 과는 정합 충돌이 없다.
- **제안**: plan-lifecycle 규약에 따라 두 plan 을 `plan/complete/` 로 이동 고려 (project-planner 판단).

### [WARNING] impl-concurrency-cap-pr2b worktree 가 spec/5-system/4-execution-engine.md 를 동시 편집할 위험
- **target 위치**: `spec/5-system/4-execution-engine.md` 전반 (§8, §4, §Rationale)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` PR2b — `worktree: impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`)
- **상세**: `impl-exec-concurrency-cap` worktree(branch `claude/impl-concurrency-cap-pr2b`)는 PR-B1/B2 이전 모델의 서술을 보유한 채 rebase 미완료 상태다(`exec-intake-queue-impl.md` PR2b 착수조건 명기). 이 브랜치가 PR-B2 rebase 없이 `spec/5-system/4-execution-engine.md` 를 수정·push 하면 PR-B2a 가 반영한 §4.x/§7.4/§Rationale 의 phase-B1 완료·멀티턴 turn-park 서술을 덮어쓸 위험이 있다. PR-B2b가 미착수인 현재는 잠정 무해하나, PR2b 착수 시 rebase 선행이 필수다. `exec-intake-queue-impl.md` 이미 이 위험을 착수조건에 명기했으므로 설계 결함은 없으나, 현재 worktree 가 stale 서술을 보유한 채 활성화된 상태임은 추적 필요.
- **제안**: PR2b 착수 담당자가 `origin/main` rebase 를 첫 작업으로 수행하고 `spec/5-system/4-execution-engine.md` 충돌을 수동 해소한다. 현시점 spec 직접 편집 작업을 수행하는 경우라면 이 worktree 의 rebase 완료를 먼저 확인한다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 제외된 항목:

- `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) — Step 1: ACTIVE (exit 1, branch HEAD 가 main 조상 아님) → Step 2: PR #494 MERGED → **STALE (squash merge)**.
  - 이 worktree 는 PR-B2a 머지 완료 후 정리되지 않은 상태. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 여러 진행 중 plan 의 SoT 로 활발히 참조되고 있다. 미해결 결정 우회·일방 결정 충돌은 발견되지 않았다. 주목할 사항은 `impl-exec-concurrency-cap` worktree(PR2b 트랙)가 PR-B2 이전 spec 서술을 보유한 채 rebase 미완료 상태로 활성화되어 있어, 해당 worktree 가 spec 파일을 수정할 경우 PR-B2a 완료형 서술과 충돌할 위험(WARNING 1건)이 있다는 점이다. 이는 plan 에 이미 착수조건으로 명기된 알려진 위험이며 즉각 차단 사유는 아니다. worktree 충돌 후보 2건 중 stale 1건(`exec-park-pr-b2` — PR #494 MERGED) skip, active 1건(`impl-concurrency-cap-pr2b`) 분석.

## 위험도

LOW
