# Plan 정합성 검토 결과

대상 문서: `spec/conventions/chat-channel-adapter.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

- **[INFO]** 세 개의 pending_plans 모두 backlog/unstarted — 현재 충돌 없음
  - target 위치: frontmatter `pending_plans` 3건 (chat-channel-discord-gateway / chat-channel-slack-socket-mode / chat-channel-visual-ssr-png)
  - 관련 plan: 각 plan frontmatter `worktree: (unstarted)`, `status: backlog`
  - 상세: target 문서의 frontmatter 에 등재된 세 plan 은 모두 진입 조건 미충족 backlog 상태이며 worktree 가 배정되지 않았다. 현재 target 과의 구체적 충돌(미해결 결정 우회·동시 파일 편집 경합)은 없다.
  - 제안: 조치 불요.

- **[INFO]** `spec-sync-chat-channel-gaps.md` 와 `spec-sync-discord-gaps.md` / `spec-sync-slack-gaps.md` 의 미구현 항목이 target 인터페이스와 간접 관련
  - target 위치: `§1.1 ackInteraction` 책임 표 / `§4.1 native modal 경로` / `ChatChannelConfig`
  - 관련 plan: `plan/in-progress/spec-sync-chat-channel-gaps.md` (CCH-CV-03, §5.5 비활성 처리, CCH-NF-03, rotate-bot-token 응답 필드), `plan/in-progress/spec-sync-discord-gaps.md` (§5.1(b) AI Reply Modal, §3.1 verify_key, §3.3 modal title/length), `plan/in-progress/spec-sync-slack-gaps.md` (file_shared 경로, filesUploadV2 스텁, response_url)
  - 상세: target 의 chat-channel-adapter 컨벤션은 이 gap plan 들이 추적하는 미구현 구현체를 **설명**하는 인터페이스 spec 이다. target 자체가 미구현 항목을 일방적으로 결정하거나 이미 결정된 정책을 번복하지는 않는다. 단, 이 gap plan 들이 `status: partial` 로 지정한 spec 들(`spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/slack.md`, `providers/discord.md`)을 target 이 cross-reference 한다 — target 의 §7 변경 관리 요건("본 인터페이스 변경은 두 spec 동시 갱신 의무")이 해당 spec 의 gap plan 해소 전에도 target 변경이 가능하나, gap plan 완료 시 target 과의 §7 동기화 의무가 발생함을 유의.
  - 제안: 조치 불요 (현 target 범위에서 충돌 없음). gap plan 을 완료할 때 §7 동시 갱신 의무를 각 plan 체크리스트에 명시 권장.

- **[INFO]** `spec-sync-structural-followups.md` (worktree: spec-sync-audit) 의 스펙 승격 위임 항목
  - target 위치: target 문서 전반 (chat-channel-adapter.md 는 15-chat-channel.md 와 양방향 링크)
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` §C "스펙 승격 위임 (planner)" — C-11(Discord)/C-12(Slack) 구현 완료, 해당 spec frontmatter `partial → implemented` 승격이 외부 검증 후 위임 중
  - 상세: target 의 provider spec cross-link(`providers/discord.md`, `providers/slack.md`)가 이 plan 의 승격 대상 spec 과 겹친다. target 이 해당 spec 을 "실 provider 검증 대기" 상태로 참조하고 있으므로, 승격 전 단계에서 target 기술이 "미구현 Planned" 표기와 일관해야 한다 — target §3 표 해당 행(`§5.1(b) AI Multi Turn reply` / `views.open` / `files.uploadV2`)은 이미 provider spec 에 "Planned" 로 표기됐으므로 정합.
  - 제안: 조치 불요.

- **[INFO]** `code-node-isolated-vm-followups.md` 의 잔여 spec 항목 — target 과 무관하나 동일 세션 내 진행 중
  - target 위치: 해당 없음 (target 은 chat-channel-adapter.md)
  - 관련 plan: `plan/in-progress/code-node-isolated-vm-followups.md` §Spec 미완 항목 (`memoryLimit:128` 예시값 정합화 — planner 위임, 비차단 INFO)
  - 상세: 현재 세션의 작업 파일(`spec/4-nodes/5-data/2-code.md`)이 code-node followups 전용이며, target(`spec/conventions/chat-channel-adapter.md`)과 다른 파일이다. 파일 경합 없음.
  - 제안: 조치 불요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

target 문서 `spec/conventions/chat-channel-adapter.md` 를 동시 편집할 가능성이 있는 worktree 후보:

- `spec-sync-audit` branch (worktrees: `spec-sync-chat-channel-gaps.md` / `spec-sync-discord-gaps.md` / `spec-sync-slack-gaps.md` 참조) — 실제 git worktree 목록에 `spec-sync-audit` 체크아웃은 없고, Step 1(merge-base) ACTIVE, Step 2(PR state) empty(PR 없음)로 판정. 해당 branch 의 worktree 가 현재 체크아웃 상태가 아니므로 CRITICAL 분류에서 제외하고 INFO 기록.

worktree 충돌 후보 중 stale 판정(Step 2 MERGED)으로 skip 된 항목:

- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `plan-cleanup-impl-done-4c9d96` (branch `claude/plan-cleanup-impl-done-4c9d96`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `spec-audit-action-prose` (branch `claude/spec-audit-action-prose`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `spec-auth-hygiene` (branch `claude/spec-auth-hygiene`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `spec-ragsources-content` (branch `claude/spec-ragsources-content`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `test-code-http-hardening-10aad3` (branch `claude/test-code-http-hardening-10aad3`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `unified-model-mgmt-plan-close` (branch `claude/unified-model-mgmt-plan-close`) — Step 1 ACTIVE, Step 2 PR MERGED → stale skip
- `code-node-followups-close-a30e7c` (branch `claude/code-node-followups-close-a30e7c`) — Step 2 PR MERGED → 현재 세션의 작업 worktree이나 이미 머지됨. 단, 현재 세션에서 활성 사용 중이므로 진행 중 작업으로 취급.
- `code-node-followups-finalize-f50a7d` (branch `claude/code-node-followups-finalize-f50a7d`) — Step 2 PR MERGED → stale skip

위 worktree 들은 이미 머지된 PR 의 정리되지 않은 worktree 이므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/conventions/chat-channel-adapter.md` 는 `plan/in-progress/` 의 미해결 결정과 충돌하지 않는다. 세 개의 `pending_plans`(Discord Gateway, Slack Socket Mode, Visual SSR PNG)은 모두 backlog/unstarted 상태로 worktree 경합이 없으며, target 이 일방적으로 결정하는 항목도 없다. `spec-sync-*-gaps.md` plan 들이 추적하는 미구현 항목(CCH-CV-03, Discord Reply Modal, Slack filesUploadV2 등)은 target 의 인터페이스 계약에 의존하나, target 이 그 결정을 우회하거나 선행 조건을 가정하지 않는다. 단, 이 gap plan 들이 완료될 때 target §7 의 "두 spec 동시 갱신 의무"가 적용되므로 각 plan 완료 시점에 chat-channel-adapter.md 도 함께 검토해야 한다. worktree 충돌 후보 10건 중 MERGED PR 을 가진 8건을 stale skip 처리했고, 현 시점 active worktree 와 target 파일 간 동시 편집 경합은 없다.

---

## 위험도

NONE
