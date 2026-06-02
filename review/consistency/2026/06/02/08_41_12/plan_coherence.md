# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-error-codes.md`
검토 시각: 2026-06-02
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] F-3 open decision 과의 선행 미해소

- **target 위치**: `spec-draft-error-codes.md` header — `"본 문서는 spec/conventions/error-codes.md 로 신설될 draft 다 (F-3)"`
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` §잔여항목 `F-3 follow-up` ([ ] 미완, main 및 worktree 양쪽 모두)
- **상세**: `cafe24-backlog-residual.md` 의 F-3 항목은 `"spec/conventions/error-codes.md(또는 naming.md) 신설 여부 결정"` 을 명시적으로 미결 게이트로 두고 있다. "신설 여부" 결정이 아직 체크오프되지 않은 상태에서 target 이 신설을 기정사실로 draft 를 진행한다. F-3 체크박스를 ✅ 로 닫고 "신설로 결정" 을 결정 로그에 기록한 뒤 본 draft 를 열었어야 한다. 단, target 은 이미 해당 draft 를 작성하는 행위 자체가 실질적 결정 실행이므로, 결정이 이루어진 것으로 볼 수 있다. 그러나 `cafe24-backlog-residual.md` 의 F-3 체크박스가 열려 있어 인덱스 동기화가 되지 않은 상태다.
- **제안**: `plan/in-progress/cafe24-backlog-residual.md` 의 F-3 항목을 `[x]` 로 닫고, "결정: 신설 — spec-draft-error-codes.md 초안 작성 및 consistency-check 진행 중" 한 줄을 추가한다. target plan 자체는 변경 불요.

---

### [WARNING] 후속 항목 누락 — cafe24-install-ratelimit-2891d1 분기에서 신설한 CAFE24_INSTALL_RATE_LIMITED 가 error-codes.md 에 언급되지 않음

- **target 위치**: `spec-draft-error-codes.md §4 Historical-artifact 예외 레지스트리`
- **관련 plan/worktree**: `claude/cafe24-install-ratelimit-2891d1` 분기 — `spec/2-navigation/4-integration.md` 에 `CAFE24_INSTALL_RATE_LIMITED`(429) 신규 추가 (diff 확인됨)
- **상세**: `CAFE24_INSTALL_RATE_LIMITED` 는 의미 기반 명명(§2 준거)으로 예외 레지스트리 등재 대상이 아니다. 따라서 §4 에 미등재는 옳다. 그러나 target 인 `spec/conventions/error-codes.md` 가 공식 SoT 가 된 후 신규 코드 추가 시 "convention 준수 여부 확인" 절차가 없다. `cafe24-install-ratelimit-2891d1` PR 이 merge 될 때 error-codes.md 규약과의 정합을 확인했는지 기록이 없으므로, error-codes.md 가 공식화되면 해당 PR 의 RESOLUTION 또는 ai-review 에 "error-codes convention §2 준수 확인됨" 한 줄을 추가하는 것이 좋다. 아직 두 PR 이 독립 진행 중이므로 merge 순서에 따라 cross-check 누락 위험이 있다.
- **제안**: `cafe24-install-ratelimit-2891d1` 의 RESOLUTION.md (또는 본 error-codes spec PR 의 Rationale) 에 "CAFE24_INSTALL_RATE_LIMITED 는 의미 기반 명명 §2 준수 — 예외 등재 불요" 를 한 줄 명기. target 자체는 변경 불요.

---

### [INFO] target frontmatter 에 `worktree` 필드 누락

- **target 위치**: `spec-draft-error-codes.md` frontmatter (lines 1-7)
- **관련 plan**: `plan-lifecycle.md` frontmatter 스키마, CLAUDE.md worktree 정책
- **상세**: frontmatter 에 `worktree:` 필드가 없다. 현재 worktree 는 `cafe24-error-codes-convention-523e2d` 에서 작업 중이므로 `worktree: .claude/worktrees/cafe24-error-codes-convention-523e2d` 추가가 권장된다. spec-draft 플랜에 worktree 필드 의무 여부에 대한 명시적 예외 규칙이 없으므로 누락으로 분류.
- **제안**: `spec-draft-error-codes.md` frontmatter 에 `worktree: .claude/worktrees/cafe24-error-codes-convention-523e2d` 추가.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보:

1. `cafe24-followups-decisions-a38f26` (branch `claude/cafe24-followups-decisions-a38f26`)
   - **Step 1**: `git merge-base --is-ancestor` → exit 1 (ACTIVE — main 에 없음)
   - **Step 2**: `gh pr list --head claude/cafe24-followups-decisions-a38f26` → PR 없음 (empty)
   - **Step 3**: fallback — **active 로 처리**
   - 실제 diff 확인: `plan/in-progress/cafe24-backlog-residual.md`, `plan/in-progress/cafe24-restricted-scopes-followups.md`, `k8s/README.md` 만 변경 — `spec/conventions/` 미접촉. worktree 충돌 해당 없음.

2. `cafe24-install-ratelimit-2891d1` (branch `claude/cafe24-install-ratelimit-2891d1`)
   - **Step 1**: exit 1 (ACTIVE)
   - **Step 2**: PR 없음 (empty)
   - **Step 3**: fallback — **active 로 처리**
   - 실제 diff: `spec/2-navigation/4-integration.md` 수정 (CAFE24_INSTALL_RATE_LIMITED 추가). target 이 생성하는 `spec/conventions/error-codes.md` 와 동일 파일 미겹침 — **write 충돌 아님**. target 은 4-integration.md 를 cross-reference 만 하고 수정하지 않는다.

나머지 active worktree (`channel-web-chat-followups-1feff2`, `close-cross-node-warning-c4c4d9`, `continuation-worker-concurrency-env`, `eia-distributed-seq-1319a0`, `mermaid-lint-f4943c`, `parallel-p2-graphval-docs`) 는 모두 `spec/conventions/error-codes.md` 및 target plan 연관 파일을 접촉하지 않으므로 §5 분석 대상 제외.

**stale cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장** (cafe24-followups-decisions-a38f26, cafe24-install-ratelimit-2891d1 양쪽).

**stale skip 0건** (worktree 충돌 후보 2건 모두 active 로 분류, §5 worktree write 충돌 없음).

---

## 요약

target `plan/in-progress/spec-draft-error-codes.md` 는 `spec/conventions/error-codes.md` 신설 draft 로, 기존 SoT(`4-integration.md` Rationale) 를 공식 규약 파일로 격상하는 작업이다. 주요 정합성 문제는 두 가지다. 첫째, `cafe24-backlog-residual.md` 의 F-3 항목이 "신설 여부 결정" 을 미결 게이트로 명시하고 있으나 체크오프 없이 draft 작성이 진행됐다 — 실질적 결정이 이미 이루어진 것이지만 인덱스 동기화가 누락된 WARNING. 둘째, active worktree `cafe24-install-ratelimit-2891d1` 이 `spec/2-navigation/4-integration.md` 에 `CAFE24_INSTALL_RATE_LIMITED` 를 추가하고 있어, error-codes convention 이 공식화된 후 해당 신규 코드의 convention 준수 확인 기록이 필요하다 — 직접 충돌은 아니나 후속 누락 위험의 WARNING. worktree 충돌 후보 2건은 `spec/conventions/error-codes.md` 를 접촉하지 않아 §5 write 충돌 없음. stale skip 0건, active worktree 2건 분석.

---

## 위험도

LOW
