# Plan 정합성 검토 — spec/7-channel-web-chat (impl-prep)

검토 모드: 구현 착수 전 (`--impl-prep`)
Target spec 영역: `spec/7-channel-web-chat` (0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security, _product-overview)
Target plan: `plan/in-progress/channel-web-chat-demo.md` (worktree: `.claude/worktrees/feat-web-chat-demo`)
검토 일시: 2026-06-03

---

## 발견사항

- **[INFO]** `channel-web-chat-demo.md` 가 spec/7 `pending_plans` 에 미등재
  - target 위치: `spec/7-channel-web-chat/*.md` frontmatter `pending_plans:` 목록
  - 관련 plan: `plan/in-progress/channel-web-chat-demo.md` — worktree `feat-web-chat-demo`
  - 상세: spec/7 전 파일의 `pending_plans:` 는 `channel-web-chat-impl.md` + `channel-web-chat-followups.md` 만 등재한다. 본 데모 plan 은 `codebase/channel-web-chat/` 에 `/demo` 라우트를 추가하는 구현 작업이나 spec frontmatter `pending_plans` 에 없다. 단, 데모 라우트는 spec/7 의 규정 대상(운영 위젯 기능) 밖의 dev-only 하니스이며 spec 본문 변경 의무가 없으므로 등재 누락이 spec 정합성 BLOCK 사유는 아니다.
  - 제안: 선택 사항. 데모가 `codebase/channel-web-chat/` 에 영구 코드를 추가하는 만큼 추적 목적으로 spec/7 중 하나(예: `1-widget-app.md`)의 `pending_plans:` 에 `plan/in-progress/channel-web-chat-demo.md` 를 추가하는 것을 권장하나 필수 아님.

- **[INFO]** `channel-web-chat-impl.md` 및 `channel-web-chat-followups.md` 의 `worktree` 필드가 소멸된 worktree(`channel-web-chat-followups-1feff2`) 를 가리킴
  - target 위치: `plan/in-progress/channel-web-chat-impl.md` frontmatter `worktree:` / `plan/in-progress/channel-web-chat-followups.md` frontmatter `worktree:`
  - 관련 plan: 위 두 파일 frontmatter
  - 상세: 두 plan 모두 `worktree: .claude/worktrees/channel-web-chat-followups-1feff2` 를 가리키지만 해당 브랜치 `claude/channel-web-chat-followups-1feff2` 의 PR #414 는 `MERGED` 상태이고 worktree 디렉토리도 실제로 존재하지 않는다. 이 두 plan 의 잔여 체크박스(`[ ] /ai-review + PR` 등)가 아직 남아 있어, 차기 착수자가 stale worktree 를 신규 worktree 로 교체해야 한다.
  - 제안: `channel-web-chat-impl.md` / `channel-web-chat-followups.md` 의 `worktree:` 필드를 다음 착수 시점에 신규 worktree 로 갱신. 현재 `feat-web-chat-demo` 의 작업 범위와는 충돌 없음 — 현재 target plan 은 별도 worktree(`feat-web-chat-demo`)에서 진행하므로 경합 없음.

- **[INFO]** `show`/`hide`/`updateProfile` command 위젯 핸들러 미구현 — 데모 host 와 interface 불일치 잠재
  - target 위치: `spec/7-channel-web-chat/2-sdk.md §3` `wc:command` 표, `plan/in-progress/channel-web-chat-followups.md §4 [연관]`
  - 관련 plan: `channel-web-chat-followups.md §4` "show/hide/updateProfile command 위젯 SPA 핸들러 미구현"
  - 상세: spec `2-sdk §3` 은 `wc:command` 로 `show`/`hide`/`updateProfile` 을 명시하지만, 위젯 SPA 의 `use-widget.ts` `onCommand` 핸들러에 이 3개는 미구현 상태다(followups §4 기록). 데모 host(`demo-host.tsx`)가 `wc:boot` 전송 및 `wc:event` 수신만 한다면 문제 없으나, 데모가 `show`/`hide` 명령을 발송하면 위젯이 무시한다. 데모 plan 비목표("위젯 본체 동작 변경 없음") 와 일치하므로 현재는 수용 가능한 known gap 이다.
  - 제안: 데모 `demo-host.tsx` 구현 시 `show`/`hide`/`updateProfile` 버튼을 노출한다면 "현재 위젯 미구현(forward-compat 버튼)" 주석을 명시하거나 해당 버튼을 비활성 처리해 사용자 혼동 방지. plan 변경 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석:

- `channel-web-chat-followups-1feff2` (branch `claude/channel-web-chat-followups-1feff2`) — Step 1: ACTIVE (merge-base ancestor 음성), Step 2: PR #414 MERGED → **stale skip**. 해당 worktree 디렉토리도 이미 제거됨.
- `code-node-sandbox-979a97` (branch `claude/code-node-sandbox-979a97`) — Step 1: STALE (HEAD == main HEAD `93847f73`, ancestor 검사 성공) → **stale skip**. spec/7 또는 channel-web-chat 에 미접촉.
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: STALE (HEAD == main HEAD `93847f73`) → **stale skip**. spec/7 접촉 없음.

active 로 처리한 worktree (spec/7 충돌 검사 대상):

- `plan-grooming-2ec306` — ACTIVE. 변경 파일: `plan/complete/`, `plan/in-progress/` 일부(`node-output-redesign`, `parallel-p2-followups`, `node-cancellation-infrastructure`, `auth-config-webhook-followups`). `spec/7-channel-web-chat` 접촉 없음. 충돌 없음.
- `spec-drift-resolve-efb608` — ACTIVE. 변경 파일: `spec/4-nodes/1-logic/10-parallel.md`, `spec/5-system/6-websocket-protocol.md`, `plan/`, `review/`. `spec/7-channel-web-chat` 접촉 없음. 충돌 없음.
- `system-status-recent-failed-86831b` — ACTIVE. 변경 파일: `spec/2-navigation/15-system-status.md`, `spec/5-system/16-system-status-api.md`, `spec/2-navigation/_product-overview.md`, `spec/5-system/_product-overview.md`. `spec/7-channel-web-chat` 접촉 없음. 충돌 없음.

stale skip: 총 3건 skip (channel-web-chat-followups-1feff2 PR MERGED, code-node-sandbox-979a97 ancestor, spec-sync-audit ancestor). active 3건 분석, spec/7 충돌 없음.

`./cleanup-worktree-all.sh --yes --force` 실행으로 code-node-sandbox-979a97 및 spec-sync-audit worktree 정리 권장.

---

## 요약

`spec/7-channel-web-chat` 에 대한 `channel-web-chat-demo.md` 의 impl-prep 정합성 검토 결과, CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다. 데모 plan 은 spec/7 의 어떤 "결정 필요" 항목도 일방적으로 우회하지 않으며(dev-only `/demo` 라우트 추가로 spec 본문 변경 없음), 다른 active worktree(`plan-grooming-2ec306`, `spec-drift-resolve-efb608`, `system-status-recent-failed-86831b`)는 spec/7 과 무관한 영역을 작업 중이라 병렬 경합 위험 없음. `channel-web-chat-impl` + `channel-web-chat-followups` 두 plan 이 소멸된 worktree(`channel-web-chat-followups-1feff2`, PR #414 MERGED)를 가리키는 stale frontmatter 갱신이 필요하지만 이는 현재 데모 작업과 충돌하지 않는다. worktree 충돌 후보 6건 중 stale 3건 skip, active 3건 분석.

---

## 위험도

NONE
