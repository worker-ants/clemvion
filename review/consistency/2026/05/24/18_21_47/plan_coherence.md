# Plan 정합성 검토 결과

- 검토 대상 plan: `plan/in-progress/trigger-create-multi-provider-ui.md` (commit 885a9742)
- 검토 모드: `--impl-prep` (구현 착수 전)
- 검토 일시: 2026-05-24

---

## 발견사항

### [WARNING] spec/5-system/15-chat-channel.md CCH-AD-01 이 `_overview.md §1` 갱신을 미반영 — spec 내부 drift

- **target 위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` 배경 표 (Spec 행)
- **관련 spec**: `spec/5-system/15-chat-channel.md` §3.1 CCH-AD-01 (line 35) vs `spec/4-nodes/7-trigger/providers/_overview.md` §1 (line 9-17)
- **상세**: `_overview.md §1` 은 PR #300 이후 `telegram` / `slack` / `discord` 셋 다 `supported (v1)` 로 표기되어 있다. 그러나 `15-chat-channel.md` CCH-AD-01 은 여전히 `v1 supported: telegram / v1 spec-defined: slack, discord — impl pending` 이라고 기술되어 있다. 두 spec 파일이 같은 사실에 대해 다른 상태를 표기 중이다. target plan 은 `_overview.md §1` 만 인용하고 CCH-AD-01 의 stale 진술을 인식하지 못한 상태로 구현에 진입한다. 구현 완료 후 CCH-AD-01 이 "impl pending" 을 그대로 두면 spec-impl evidence 체계가 오염된다.
- **제안**: 본 plan 의 commit 1 착수 전 (또는 완료 직후, developer 권한 밖이므로 project-planner 위임) CCH-AD-01 의 `v1 spec-defined: slack, discord — impl pending` 진술을 `_overview.md §1` 과 정합하도록 갱신. 단, spec 변경은 developer 권한 밖이므로 plan 의 §후속 항목에 "CCH-AD-01 갱신 — project-planner 위임" 을 명시하거나, 본 plan 의 완료 기준에 추가 권장.

---

### [WARNING] chat-channel-dispatcher-split 진입 결정이 본 plan 완료 시점에 걸리나 plan 상에서 명시적 결정 경로가 없음

- **target 위치**: `trigger-create-multi-provider-ui.md` §의식적 boundary (line 130) 및 §후속 plan (line 159)
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` frontmatter (`status: backlog`, trigger 조건: "Telegram 외 두 번째 chat channel provider 도입 결정")
- **상세**: target plan 은 "본 plan 완료 시점에 `chat-channel-dispatcher-split` 의 trigger 조건이 GUI 관점에서 실질 충족된다"고 본문에 명시하고 있다 (§의식적 boundary line 130, §후속 plan line 159). 그러나 dispatcher-split 은 backend 아키텍처 변경을 수반하는 별도 plan 이고, 진입 결정 자체는 "본 plan 완료 후 진입 검토" 수준에만 머물고 있다. 누가 어느 시점에 진입 여부를 결정하는지, 결정 후 어떻게 backlog → in-progress 전환을 할지가 명시되어 있지 않다. 이 decision point 가 모호한 채로 본 plan 이 완료되면 R8 의 listener dedup/teardown 정책 적용이 무기한 표류할 가능성이 있다.
- **제안**: target plan 의 완료 기준 또는 후속 plan 절에 "본 plan 머지 완료 후 사용자와 dispatcher-split 진입 여부를 명시적으로 결정하고 plan frontmatter 를 `status: in-progress` 로 전환한다" 를 추가. 결정이 필요한 주체를 명시 (project-planner 또는 사용자).

---

### [WARNING] trigger-list-chat-channel-ui plan 이 in-progress 에 잔존 — stale plan 정리 필요 (본 plan 정합성 범위 내)

- **target 위치**: `plan/in-progress/trigger-create-multi-provider-ui.md` §선행 PR (line 35)
- **관련 plan**: `plan/in-progress/trigger-list-chat-channel-ui.md` (worktree `trigger-list-chat-channel-ui-d0c4a3`)
- **상세**: `trigger-list-chat-channel-ui.md` 의 선행 PR #283 은 MERGED 상태이고, 해당 worktree 의 branch `claude/trigger-list-chat-channel-ui-d0c4a3` 는 `origin/main` 의 ancestor 가 아니지만 (squash merge) PR 상태는 MERGED 이다. 해당 plan 파일은 여전히 `plan/in-progress/` 에 남아 있고 `plan/complete/` 에 없다. target plan 이 "PR #283 머지 완료" 를 전제로 하므로 정합성 체계 관점에서 stale 이다. 직접적인 구현 차단 요소는 아니나, in-progress 목록 오염이 다음 plan 정합성 검토의 false-positive 원인이 된다.
- **제안**: 본 plan 착수 전 또는 착수 직후, `trigger-list-chat-channel-ui.md` 를 `plan/complete/` 로 `git mv` 처리 (developer 권한 내). 동반 worktree `trigger-list-chat-channel-ui-d0c4a3` 도 cleanup.

---

### [INFO] chat-channel-secret-store-infra plan 의 v1 stub 가정과 본 plan 의 SecretResolver.store 사용이 정합함 — 충돌 없음

- **target 위치**: `trigger-create-multi-provider-ui.md` Commit 1 (line 60)
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` (status: backlog)
- **상세**: `chat-channel-secret-store-infra` 는 bot token / inbound signing secret 을 `config JSONB 평문 stub` 에서 본격 secret store 로 마이그레이션하는 v2 계획이다. 그런데 target plan 의 Commit 1 이 이미 `SecretResolverService.store()` (AES-256-GCM, 현재 codebase 에 존재) 를 통해 `inboundSigningRef` 를 저장하도록 설계되어 있다. 즉 target plan 은 이미 v1 단계의 "proper secret store" 경로를 사용하는 것이며, `chat-channel-secret-store-infra` plan 의 Phase 3/4 (기존 plaintext stub → secret store backfill) 와는 직교한다. 충돌 없음. 다만 target plan 의 §의식적 boundary (line 131) 에서 이 관계를 명시하고 있어 정합함.
- **제안**: 추적 메모 권장. `chat-channel-secret-store-infra` 의 Phase 3/4 가 실제로 남아있는 기존 telegram `botTokenRef` 의 평문 잔류 여부를 다시 확인하는 것이 적절하다. target plan 범위 밖이므로 기록만.

---

### [INFO] trigger-drawer-refactor-async / trigger-drawer-tests / trigger-drawer-copy-hook 세 plan 과 파일 경합 없음 — 단 triggers/page.tsx 동시 수정 주의

- **target 위치**: `trigger-create-multi-provider-ui.md` Commit 2 (line 69-75)
- **관련 plan**: `plan/in-progress/trigger-drawer-refactor-async.md`, `trigger-drawer-tests.md`, `trigger-drawer-copy-hook.md`
- **상세**: 세 plan 모두 worktree 가 `미정 — 신규 worktree 생성 필요` 이고 현재 활성 worktree 가 없다. target plan 의 Commit 2 는 `triggers/page.tsx` 를 수정하는데, `trigger-drawer-refactor-async` 는 `trigger-detail-drawer.tsx` (다른 파일), `trigger-drawer-tests` 는 `__tests__/trigger-detail-drawer.test.tsx` (신규 파일), `trigger-drawer-copy-hook` 는 훅 추출 (신규 파일 + 기존 컴포넌트 내 변경) 이다. target plan 의 직접 작업 파일과 겹치지 않는다. 단, trigger-drawer-copy-hook 이 `WebhookConfigCard` + `ExternalInteractionCard` 를 건드리는데, target plan 은 이 파일들을 명시적으로 수정하지 않으므로 경합 없음.
- **제안**: 추적 메모. 세 plan 이 동시에 진입 시 `triggers/page.tsx` 주변 코드에서 minor merge conflict 가능성 있으나, 현재 active worktree 없으므로 즉각적 차단은 아님.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 5건 중 Step 1/2 cascade 결과:

| worktree | branch | stale 판정 |
|---|---|---|
| `chat-channel-e2e-hardening-5ff799` | `claude/chat-channel-e2e-hardening-5ff799` | Step 1 ACTIVE → Step 2 PR #303 MERGED — **stale** (squash merge) |
| `chore-stale-plan-cleanup-c7e170` | `claude/chore-stale-plan-cleanup-c7e170` | Step 1 ACTIVE → Step 2 PR #302 MERGED — **stale** (squash merge) |
| `fix-secret-store-root-entities-6aa869` | `claude/fix-secret-store-root-entities-6aa869` | Step 1 ACTIVE → Step 2 PR #304 MERGED — **stale** (squash merge) |
| `ai-agent-formdata-size-limit-2ad8ff` | `claude/ai-agent-formdata-size-limit-2ad8ff` | Step 1 ACTIVE → Step 2 PR #305 MERGED — **stale** (squash merge) |
| `trigger-list-chat-channel-ui-d0c4a3` | `claude/trigger-list-chat-channel-ui-d0c4a3` | Step 1 ACTIVE → Step 2 PR #283 MERGED — **stale** (squash merge) |

모든 active worktree 후보 5건이 stale 판정. target plan 의 worktree (`trigger-create-multi-provider-ui-plan-677f12`) 만 실제 active.

위 5건의 stale worktree 가 남아 있다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `trigger-create-multi-provider-ui.md` 는 backend adapter 가 이미 3 provider 를 등록·동작 중인 상태에서 DTO 제한과 UI 진입점만 열어주는 구현-only plan 으로, 미해결 결정 우회나 선행 plan 미해소는 없다. 주요 정합성 이슈는 두 가지다. 첫째, `spec/5-system/15-chat-channel.md` CCH-AD-01 이 PR #300 이후 업그레이드된 `_overview.md §1` 의 "supported (v1)" 상태를 반영하지 않고 "impl pending" 으로 stale 표기 중이며, 본 plan 완료 후에도 방치되면 spec-impl evidence 체계가 오염된다. 둘째, `chat-channel-dispatcher-split` 진입 trigger 조건이 본 plan 완료로 충족되는데 진입 여부를 결정하는 명시적 경로가 plan 에 없다. 추가로 `trigger-list-chat-channel-ui` plan 이 PR #283 MERGED 후에도 in-progress 에 잔존하는 stale 문제가 있다. worktree 충돌 후보 5건 모두 squash merge stale 판정으로 skip, active 충돌은 0건.

---

## 위험도

**LOW**

spec 내부 drift (CCH-AD-01 stale 진술) 와 dispatcher-split 결정 경로 미명시는 구현 차단 요소가 아니라 완료 후 정합성 손상 위험이다. 즉시 구현을 차단할 CRITICAL 이슈는 없다.
