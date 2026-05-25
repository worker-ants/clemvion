# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/conventions/chat-channel-adapter.md`
Target 내용: `(없음)` — 구현 착수 전 점검이므로 target 파일 자체에 변경 없음.

---

## 발견사항

### [INFO] chat-channel-error-notify 및 spec-draft-chat-channel-error-notify plan — stale worktree 이후 plan/complete 미이동
- **target 위치**: 해당 없음 (plan 파일 관리 문제)
- **관련 plan**: `plan/in-progress/chat-channel-error-notify.md` (worktree `chat-channel-error-notify-6d37ec`), `plan/in-progress/spec-draft-chat-channel-error-notify.md` (동일 worktree)
- **상세**: 두 plan 이 계획한 `spec/conventions/chat-channel-adapter.md` 변경 (§3.1 신설, §3 매핑 표 `execution.failed` 행 격상, Rationale R5/R-CCA-5, Changelog 3건) 은 target 문서의 Changelog (2026-05-25 항목) 에 모두 반영 완료. worktree `claude/chat-channel-error-notify-6d37ec` 의 PR 은 MERGED 확인. 그러나 두 plan 파일이 `plan/in-progress/` 에 잔류 중.
- **제안**: `git mv plan/in-progress/chat-channel-error-notify.md plan/complete/` 및 `git mv plan/in-progress/spec-draft-chat-channel-error-notify.md plan/complete/` 로 이동. spec-draft 파일은 draft 완료·반영 완료이므로 complete 이동이 적합.

---

### [INFO] chat-channel-outbound-still-broken plan — stale worktree 이후 plan/complete 미이동
- **target 위치**: 해당 없음 (plan 파일 관리 문제)
- **관련 plan**: `plan/in-progress/chat-channel-outbound-still-broken.md` (worktree `.claude/worktrees/chat-channel-outbound-still-broken-afe293`)
- **상세**: plan 의 전체 체크박스 (11개) 가 [x] 완료 표시. worktree `claude/chat-channel-outbound-still-broken-afe293` 의 PR 은 MERGED 확인 (Step 2). 그러나 plan 파일이 `plan/in-progress/` 에 잔류 중. 본 plan 은 `spec/conventions/chat-channel-adapter.md` 를 직접 수정하는 plan 은 아니었으나 (outbound dispatcher 코드 진단·fix), in-progress 가 완료 plan 으로 정리되지 않으면 인덱스 오염 발생.
- **제안**: `git mv plan/in-progress/chat-channel-outbound-still-broken.md plan/complete/` 이동.

---

### [INFO] spec-telegram-chat-channel-ui-polish 및 trigger-list-chat-channel-ui plan — stale worktree 이후 plan/complete 미이동
- **target 위치**: 해당 없음 (plan 파일 관리 문제)
- **관련 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree `telegram-chat-channel-spec-polish-49c49b`), `plan/in-progress/trigger-list-chat-channel-ui.md` (worktree `trigger-list-chat-channel-ui-d0c4a3`)
- **상세**: 두 worktree 의 PR 모두 MERGED 확인 (Step 2). `spec-telegram-chat-channel-ui-polish` 는 `spec/conventions/chat-channel-adapter.md` §2.3 의 `visualNode` enum 변경을 담당했으며 target 문서의 Changelog (2026-05-23 항목) 에 반영 완료. `trigger-list-chat-channel-ui` 는 frontend 구현 plan 으로 target 문서 직접 수정은 없었으나 Convention §2.3 를 SoT 로 참조함. 두 plan 모두 `plan/in-progress/` 잔류.
- **제안**: `git mv` 로 두 plan 을 `plan/complete/` 로 이동.

---

### [INFO] chat-channel-form-native-modal plan — spec/conventions/chat-channel-adapter.md §4 변경 예고 (backlog, 미착수)
- **target 위치**: `spec/conventions/chat-channel-adapter.md` §4 Form 다단계 시퀀스 규약, Rationale R4
- **관련 plan**: `plan/in-progress/chat-channel-form-native-modal.md` (worktree: assigned at impl-start, status: backlog)
- **상세**: 본 plan 은 Convention §4 의 "v1 다단계 텍스트 시퀀스 통일" 결정 (R4) 번복을 진입 조건 1번으로 명시하고 있어, R4 가 현재 spec 에 그대로 유지되는 한 착수할 수 없다. target 문서의 현재 R4 상태 (v1 다단계 강제, native UI 분기는 v2 옵션) 와 plan 이 충돌하지 않음 — plan 이 R4 의 존재를 알고 있으며 이를 먼저 번복해야 한다고 명시. 즉, 미해결 결정이 plan 안에 올바르게 기재됨. 구현 착수 전 사전 결정 합의 절차가 진입 조건으로 강제되어 있으므로 현 시점에서 충돌은 없음.
- **제안**: impl-prep 시작 전 `chat-channel-form-native-modal` plan 의 진입 조건이 여전히 열려 있음을 인지할 것. 해당 plan 이 실제로 착수되면 target 파일 §4 / R4 는 `project-planner` 사이클에서 변경되어야 하므로 개발자 단독 착수 불가.

---

### [WARNING] 다수의 stale plan 이 plan/in-progress/ 에 잔류 — impl-prep 시 plan 맵 신뢰도 저하
- **target 위치**: `plan/in-progress/` 디렉토리 전반
- **관련 plan**: `chat-channel-error-notify.md`, `spec-draft-chat-channel-error-notify.md`, `chat-channel-outbound-still-broken.md`, `spec-telegram-chat-channel-ui-polish.md`, `trigger-list-chat-channel-ui.md` (모두 PR MERGED, plan/in-progress 잔류)
- **상세**: impl-prep 시점에 개발자가 `plan/in-progress/` 를 보면 이미 완료된 5개 plan 이 현재 진행 중인 작업인 것처럼 보임. target 문서 (`spec/conventions/chat-channel-adapter.md`) 의 변경 이력과 plan 목록이 불일치 — 잘못된 "진행 중 작업과의 중복 경합" 오판 위험. 직접적 spec 충돌은 없으나 작업 가시성 신뢰도 손상.
- **제안**: 위 5개 plan 을 `git mv` 로 `plan/complete/` 로 이동 후 impl 착수. `0-unimplemented-overview.md` 의 `plan/in-progress` 디렉토리 목록 섹션도 동기화 필요.

---

### [INFO] 현재 worktree (chat-channel-renderer-tech-debt-49d0e5) 자체가 stale
- **target 위치**: 해당 없음
- **관련 plan**: 해당 없음 (본 worktree 에 대응하는 plan 파일 미확인)
- **상세**: 현재 작업 worktree `claude/chat-channel-renderer-tech-debt-49d0e5` 는 Step 1 (ancestor 검사) 에서 ACTIVE 이나 Step 2 (PR state) 에서 PR #325 MERGED 확인 — squash merge 케이스로 stale. 본 review 의 output 을 받는 worktree 자체가 stale 이므로, review 완료 후 cleanup 권장.
- **제안**: `./cleanup-worktree-all.sh --yes --force` 실행으로 stale worktree 정리.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 중 §worktree stale 판정 cascade 를 적용한 결과:

| worktree | branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `chat-channel-error-notify-6d37ec` | `claude/chat-channel-error-notify-6d37ec` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `chat-channel-outbound-still-broken-afe293` | `claude/chat-channel-outbound-still-broken-afe293` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `telegram-chat-channel-spec-polish-49c49b` | `claude/telegram-chat-channel-spec-polish-49c49b` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `trigger-list-chat-channel-ui-d0c4a3` | `claude/trigger-list-chat-channel-ui-d0c4a3` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `chat-channel-renderer-tech-debt-49d0e5` | `claude/chat-channel-renderer-tech-debt-49d0e5` | ACTIVE (Step 1 음성) | PR #325 MERGED | stale (Step 2) |
| `chat-channel-runtime-fix-ed7061` | `claude/chat-channel-runtime-fix-ed7061` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `chat-channel-template-render-outbound-2f8164` | `claude/chat-channel-template-render-outbound-2f8164` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `telegram-carousel-button-click-5b52c1` | `claude/telegram-carousel-button-click-5b52c1` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |
| `update-logo-and-favicon-cb7b91` | `claude/update-logo-and-favicon-cb7b91` | ACTIVE (Step 1 음성) | PR MERGED | stale (Step 2) |

worktree 충돌 후보로 분석한 active 워크트리:

| worktree | branch | Step 1 | Step 2 | 판정 |
|---|---|---|---|---|
| `chat-channel-form-template-render-fix-82662a` | `claude/chat-channel-form-template-render-fix-82662a` | ACTIVE | PR OPEN | **active** |
| `execution-context-rehydration-race-b9093d` | `claude/execution-context-rehydration-race-b9093d` | ACTIVE | PR OPEN | **active** |

`chat-channel-form-template-render-fix-82662a` 는 PR OPEN 이므로 active worktree. 해당 worktree 의 in-progress plan 목록 (`spec-drift-parallel-count`, `trigger-drawer-refactor-async`, `ai-agent-tool-connection-rewrite` 등) 중 `spec/conventions/chat-channel-adapter.md` 를 직접 수정하는 plan 은 확인되지 않음 — 충돌 없음.

stale 판정으로 skip 한 worktree 9건. `./cleanup-worktree-all.sh --yes --force` 실행 강력 권장.

---

## 요약

`spec/conventions/chat-channel-adapter.md` 는 2026-05-25 기준으로 최신 변경 (ChatChannelInternalEvent §1.3 신설, renderNode union 확장, ai_conversation/ai_form_render silent 정책, classifyExecutionFailure §3.1, Rationale R-CCA-5~7) 이 모두 반영된 완결된 상태다. impl-prep 관점에서 target 문서 자체에 미해결 결정·spec 충돌·선행 plan 미해소 항목은 없다. 주요 문제는 plan 파일 관리: 이미 MERGED 된 PR 에 대응하는 5개 plan 이 `plan/in-progress/` 에 잔류해 작업 맵 신뢰도를 낮추고 있으며, `chat-channel-form-native-modal` plan 은 향후 §4/R4 를 수정할 예정이나 진입 조건을 올바르게 명시한 backlog 상태라 현시점 충돌 없음. worktree 충돌 후보 총 11건 중 stale 9건 skip, active 2건 (`chat-channel-form-template-render-fix-82662a`, `execution-context-rehydration-race-b9093d`) 분석 — target 파일 접촉 없어 충돌 아님.

---

## 위험도

LOW
