# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-error-codes.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-02

---

## 발견사항

### [WARNING] `cafe24-backlog-residual.md` F-3 항목 — 동시 수정 경합 (active worktree)
- **target 위치**: 격상(promotion) 체크리스트 5번째 항목 — `plan/in-progress/cafe24-backlog-residual.md` F-3 체크박스 `[x]` + 결정 로그
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` (F-3 follow-up 행)
- **상세**: `cafe24-install-ratelimit-2891d1` worktree (branch `claude/cafe24-install-ratelimit-2891d1`) 가 `plan/in-progress/cafe24-backlog-residual.md` 를 이미 수정했고 아직 main 에 머지되지 않았다 (PR 없음, branch 6 commits ahead of main). 해당 브랜치는 A-3 항목을 `[x]`로 갱신하고 A-3 follow-up 을 추가하는 변경을 담고 있다. target plan 도 동일 파일의 F-3 행을 `[x]`로 갱신한다. 두 worktree 가 같은 파일의 다른 행을 동시에 수정 예정이라 머지 시 충돌 가능성이 있다. 단, 서로 다른 행(A-3 vs F-3)이라 실제 git 충돌 가능성은 낮으나, 어느 쪽이 먼저 머지되느냐에 따라 rebase 필요.
- **제안**: `cafe24-install-ratelimit-2891d1` 가 먼저 머지되면 target plan 의 promotion 단계에서 rebase 후 F-3 행 체크만 추가하면 된다. 충돌을 피하려면 해당 branch 의 머지 타이밍을 확인하거나 promotion 시 rebase 를 수행한다. CRITICAL 분류를 피한 이유: 동일 섹션이 아닌 다른 행 수정이므로 자동 merge 가능 범위.

---

### [WARNING] `cafe24-backlog-residual.md` F-3 항목 — "결정 필요" 상태와 target 의 일방적 결정 간 불일치
- **target 위치**: `plan/in-progress/spec-draft-error-codes.md` § 결정·맥락 전체 및 격상 체크리스트
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` F-3 follow-up 행 (`[ ] 에러 코드 의미 기반 명명 원칙의 정식 규약화 — ... 신설 여부 결정.`)
- **상세**: 현재 disk 의 `plan/in-progress/cafe24-backlog-residual.md` (main 기준) F-3 항목은 아직 `[ ]` 미결 상태이며 "신설 여부 결정" 을 요구하고 있다. target plan 은 이미 "사용자 결정 2026-06-02 신설" 로 결정을 내리고 spec draft 를 작성했다. 결정 자체는 cafe24-backlog-residual.md 의 `[x]` 갱신으로 결국 반영 예정이나(격상 체크리스트 5번), **현재 main 기준 plan 문서에서 F-3 은 미결**이다. target 이 미결 항목에 대해 일방적으로 결정을 내리는 구조이지만, 사용자 결정(2026-06-02)이 있었음이 target draft 에 명시되어 있으므로 결정의 정당성은 있다. 다만 cafe24-backlog-residual.md 의 미결 상태가 아직 갱신되지 않았다는 점에서 plan 문서 간 불일치가 존재한다.
- **제안**: target plan 의 promotion 체크리스트 5번(`cafe24-backlog-residual.md` F-3 `[x]`) 을 실행할 때 이 불일치가 해소된다. 단, `cafe24-install-ratelimit-2891d1` 보다 먼저 promotion 을 실행하면 해당 branch 의 차후 rebase 시 F-3 행이 이미 체크된 상태로 충돌 없이 진행 가능하다. 조기 갱신을 권장.

---

### [INFO] `cafe24-backlog-residual.md` 가 두 active worktree 에서 동시 수정 중
- **target 위치**: 격상 체크리스트 5번
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md`, worktree `cafe24-install-ratelimit-2891d1`
- **상세**: `cafe24-install-ratelimit-2891d1` 는 `plan/complete/cafe24-install-ratelimit.md` 을 신설하고 `cafe24-backlog-residual.md` 를 수정했다. 해당 branch 의 변경이 main 에 없는 이유가 PR 생성 전 단계인지 확인 필요. plan 에는 `plan/complete/cafe24-install-ratelimit.md` 가 이미 있다.
- **제안**: `cafe24-install-ratelimit-2891d1` 의 머지 여부를 확인한다. 미머지라면 빠른 PR 생성·머지 후 target worktree 가 rebase 하는 순서가 적절하다.

---

### [INFO] `spec/conventions/error-codes.md` 신설 — 다른 plan 과의 중복 없음 확인
- **target 위치**: 격상 체크리스트 1번
- **관련 plan**: 전 in-progress plan 검토 결과
- **상세**: `spec/conventions/` 아래 `error-codes.md` 를 신설하는 계획을 가진 다른 active plan 은 없다. 같은 디렉토리를 수정하는 plan 중 활성인 것은 `node-cancellation-infrastructure.md` (이미 완료, `spec/conventions/node-cancellation.md`) 이나 본 target 과 파일 경합 없다.
- **제안**: 이상 없음. 단순 추적 메모.

---

### [INFO] `cafe24-install-ratelimit-2891d1` RESOLUTION 메모 (격상 체크리스트 7번)
- **target 위치**: 격상 체크리스트 마지막 항목 (`cafe24-install-ratelimit-2891d1` RESOLUTION 메모)
- **관련 plan**: `plan/in-progress/spec-draft-error-codes.md` 격상 체크리스트
- **상세**: target 은 "`CAFE24_INSTALL_RATE_LIMITED` 는 §1 의미 기반 명명 준수 — 예외 불요" 를 `cafe24-install-ratelimit-2891d1` RESOLUTION 에 메모하도록 명시했다. 해당 worktree 는 active 상태이며 `plan/complete/cafe24-install-ratelimit.md` 를 포함한다. 머지 전 이 메모를 RESOLUTION 에 추가해야 하나 시점 조율이 필요하다.
- **제안**: `cafe24-install-ratelimit-2891d1` 가 머지되기 전 해당 RESOLUTION 파일에 메모를 추가하거나, 머지 후 후속 커밋으로 추가한다. 해당 worktree 의 별 branch 라 target worktree 에서 직접 수정 불가 — 머지 시점 참고 메모로만 처리하는 것이 맞다(체크리스트 문구 그대로 적절).

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `cafe24-followups-decisions-a38f26` (branch `claude/cafe24-followups-decisions-a38f26`) — Step 1: ACTIVE (squash merge로 ancestor 아님), Step 2: PR #410 MERGED. **stale skip.** 해당 branch 의 `cafe24-backlog-residual.md` 수정(A-2/D-2 결정 기록)은 이미 main 에 squash-merged 됨.
- `channel-web-chat-followups-1feff2` (branch `claude/channel-web-chat-followups-1feff2`) — Step 1: ACTIVE, Step 2: PR #411 MERGED. **stale skip.** `spec/conventions/cross-node-warning-rules.md` 만 수정, target 과 경합 없음.
- `continuation-worker-concurrency-env` (branch `claude/continuation-worker-concurrency-env`) — Step 1: ACTIVE, Step 2: PR #411 MERGED. **stale skip.** 동일 PR 로 머지됨.
- `mermaid-lint-f4943c` (branch `claude/mermaid-lint-f4943c`) — Step 1: ACTIVE, Step 2: PR #410 MERGED. **stale skip.**
- `parallel-p2-w1w2` (branch `claude/spec-backend-msg-i18n`) — Step 1: STALE (ancestor of main). **stale skip (Step 1).**

stale skip 된 worktree 5건은 모두 PR 이 MERGED 또는 branch 가 ancestor 상태이나 `git worktree list` 에서 정리되지 않았다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `plan/in-progress/spec-draft-error-codes.md` 는 plan 정합성 관점에서 전반적으로 양호하다. 핵심 미해결 항목은 두 가지다: (1) `cafe24-backlog-residual.md` F-3 행이 현재 main 기준 미결(`[ ]`)인데 target 은 결정을 이미 내린 상태 — promotion 체크리스트 실행 시 해소된다. (2) `cafe24-install-ratelimit-2891d1` (active, 6 commits ahead, 아직 PR 없음) 이 동일 파일의 다른 행을 수정하고 있어 경합 가능성이 있으나 행이 달라 자동 merge 가능 범위다. 두 항목 모두 promotion 시 rebase 또는 순서 조율로 해소 가능하므로 작업 차단 수준은 아니다. worktree 충돌 후보 7건 중 stale 5건 skip, active 2건 분석 (cafe24-install-ratelimit-2891d1 + 본 target 자체).

---

## 위험도

LOW
