# Plan 정합성 검토 결과

**검토 모드**: 구현 착수 전 (`--impl-prep`)
**Target**: `spec/4-nodes/7-trigger/providers/slack.md`
**검토 일시**: 2026-05-24
**Worktree**: `spec-slack-discord-chat-channel-bb4d35` (branch `claude/spec-slack-discord-chat-channel-bb4d35`)

---

## 발견사항

### [WARNING] chat-channel-dispatcher-split 의 진입 조건이 본 spec 결정으로 충족됨 — plan 상태 전환 누락

- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` 전체 (Slack 어댑터 spec 신설)
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` — Trigger 조건 절 "Telegram 외 두 번째 chat channel provider (Slack / KakaoTalk 등) 도입 결정"
- **상세**: `chat-channel-dispatcher-split.md` 는 `status: backlog` 이며 진입 트리거를 "두 번째 chat channel provider 도입 결정" 으로 명시한다. `spec/4-nodes/7-trigger/providers/slack.md` 의 신설은 Slack 을 두 번째 provider 로 결정한 공식 spec 이므로 이 진입 조건을 충족한다. 그러나 dispatcher-split plan 의 `status` 가 여전히 `backlog` 이고 본 worktree 내 어디에도 상태 전환 기록이 없다. `chat-channel-slack-impl.md` 가 실제 구현을 담당하며 구현 착수 시 `NotificationDispatcher` 에 두 번째 in-process listener 가 추가된다 — 이 시점이 dispatcher 분리 의무 시점이다.
- **제안**: `plan/in-progress/chat-channel-dispatcher-split.md` frontmatter 의 `status: backlog` 를 `status: pending-trigger-met` 또는 메모 형식으로 갱신하고, "Slack spec 신설 (2026-05-24) 이 trigger 조건 충족. `chat-channel-slack-impl` 구현 착수 시 본 plan 동시 in-progress 진입 권장" 주석을 추가. 또는 `chat-channel-slack-impl.md` Phase 1 의 Foundation 항목에 "dispatcher-split plan 병행 진입 검토" todo 를 추가한다.

---

### [WARNING] spec-telegram-chat-channel-ui-polish — 이미 머지됐으나 plan/in-progress 에서 미이동 (stale plan)

- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` §6 보안 (inboundSigningRef 사용) + §5.4 시각형 노드 매핑 (visualNode 분기 인용)
- **관련 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree: `telegram-chat-channel-spec-polish-49c49b`)
- **상세**: 이 plan 의 결정 2 에서 `secretTokenRef` 를 언급하고, 결정 3 에서 `visualNode` enum 변경을 정의하며 `spec/conventions/chat-channel-adapter.md` 를 수정 대상으로 열거한다. 실제로는 PR #281 이 2026-05-23 에 `MERGED` 됐고 (Step 2 확인), 그 변경 내용 (visualNode enum, hasBotToken, §5.5 Inbound HTTP Contract) 이 이미 main 에 반영되어 있다. 그러나 plan 파일은 `plan/in-progress/` 에 그대로 남아 있어 active worktree 충돌로 오해될 수 있다. target slack.md 는 이 plan 의 결정 4 에서 정의된 §5.5 Inbound HTTP Contract 를 기준으로 Slack-specific 200 OK 예외를 서술하고 있어 stale plan 이 남아 있을 경우 리뷰어가 "결정 4 가 미해결" 로 오독할 위험이 있다.
- **제안**: `git mv plan/in-progress/spec-telegram-chat-channel-ui-polish.md plan/complete/spec-telegram-chat-channel-ui-polish.md` 로 이동. (PR #281 기준 — 실제 plan 라이프사이클 정책 준수)

---

### [WARNING] trigger-list-chat-channel-ui — 이미 머지됐으나 plan/in-progress 에서 미이동 (stale plan)

- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` §6 보안 + §3.1 setupChannel (hasBotToken 파생 필드 관련 cross-ref)
- **관련 plan**: `plan/in-progress/trigger-list-chat-channel-ui.md` (worktree: `trigger-list-chat-channel-ui-d0c4a3`)
- **상세**: PR #283 (closed) 으로 머지 완료. hasBotToken derived 필드, botToken single-path, secretTokenRef 차단 등 결정 1·2 가 이미 구현됐다. slack.md §6 의 `inboundSigningRef` 처리 패턴은 이 plan 의 PATCH 차단 정책 + hasBotToken 패턴을 그대로 이어받는 구조이므로, stale plan 이 남아 있으면 slack impl 착수 시 "inboundSigningRef 를 PATCH 로 받아야 하나?" 혼동이 생길 수 있다.
- **제안**: `git mv plan/in-progress/trigger-list-chat-channel-ui.md plan/complete/trigger-list-chat-channel-ui.md`

---

### [INFO] spec-harness-impl-coverage — 이미 머지됐으나 plan/in-progress 에서 미이동

- **target 위치**: 해당 없음 (target 과 직접 관련 없음)
- **관련 plan**: `plan/in-progress/spec-harness-impl-coverage.md` (worktree: `harness-spec-impl-coverage-befc2f`)
- **상세**: PR #287 (`MERGED`, Step 2 확인). 내용적으로 target 과 충돌 없음. plan 문서 미이동 상태.
- **제안**: `git mv plan/in-progress/spec-harness-impl-coverage.md plan/complete/spec-harness-impl-coverage.md`

---

### [INFO] chat-channel-secret-store-infra — backlog plan 이 이미 구현된 인프라를 "결정 필요" 로 기술

- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md` §6 보안 (`inboundSigningRef` → `secret://triggers/{id}/inbound-signing`)
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` (status: backlog)
- **상세**: 이 plan 은 SecretResolver 인프라를 AWS Secrets Manager / Vault / pgcrypto 중에서 결정해야 한다는 가정으로 작성됐다. 그러나 `spec/conventions/secret-store.md` Rationale R1 (채택 2026-05-22) 에서 application-side AES-256-GCM + env var 마스터키가 이미 결정됐고, `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 로 구현 완료된 상태다. target slack.md 가 사용하는 `secret://triggers/{id}/inbound-signing` ref 는 이미 작동하는 `SecretResolver.store()` / `resolve()` 경로를 통해 처리된다. plan 은 사실상 "migration backfill + rotation automation" 작업만 남은 상태이나 제목이 "인프라 도입" 으로 되어 있어 target impl plan 진입 시 혼동 여지가 있다.
- **제안**: plan 제목과 배경을 "migration / secret rotation 자동화" 로 한정해 재서술. 또는 완료된 인프라 도입 부분을 plan 서두에 "인프라 도입 완료" 절로 명시하고 잔여 작업(backfill, rotation 자동화)만 추적.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 중 §worktree stale 판정 cascade 를 통해 skip 된 항목:

| worktree | branch | 판정 근거 |
|---|---|---|
| `telegram-chat-channel-spec-polish-49c49b` | (git branch 미존재) | Step 1: branch 없음 (skip). Step 2: `gh pr list --state all --head` → PR #281 state=`MERGED` → **stale**. `spec/conventions/chat-channel-adapter.md` 등 4개 spec 파일 터치. |
| `trigger-list-chat-channel-ui-d0c4a3` | (git branch 미존재) | Step 1: branch 없음 (skip). Step 2: PR #283 state=`CLOSED` (closed=merged) → **stale**. `spec/2-navigation/2-trigger-list.md` 등 터치. |
| `harness-spec-impl-coverage-befc2f` | `claude/harness-spec-impl-coverage-befc2f` | Step 1: `merge-base --is-ancestor` → ACTIVE (squash merge). Step 2: PR #287 state=`MERGED` → **stale**. target 파일 overlap 없음. |
| `apply-brand-logo-049314` | `claude/apply-brand-logo-049314` | Step 1: `merge-base --is-ancestor` → ACTIVE (PR 미머지). Step 2: `gh pr list ... --jq '.[0].state'` → `CLOSED` → **stale** (PR #274 closed without merge). 물리적 worktree 는 존재하나 PR 이 abandoned 상태. `spec/conventions/chat-channel-adapter.md` / `spec/5-system/15-chat-channel.md` / `spec/conventions/secret-store.md` 터치하나 stale skip. |

총 4개 후보 중 4건 stale skip, active 0건.

위 worktree 들이 활성으로 남아있을 이유가 없다 — 특히 `apply-brand-logo-049314` 는 물리적 worktree 가 남아 있으면서 PR 도 abandoned 상태이므로 cleanup 권장:
```bash
./cleanup-worktree-all.sh --yes --force
```
또는 `git worktree remove .claude/worktrees/apply-brand-logo-049314` + stale plan 파일 git mv 를 묶어 진행.

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 는 이 worktree 안에서 이미 완료된 선행 spec 작업 (`spec-slack-discord-chat-channel` + `spec-chat-channel-inbound-signing-rename`) 의 내용과 정합한다. `inboundSigningRef`, `secret://triggers/{id}/inbound-signing`, §5.5 Inbound HTTP Contract 참조, visualNode 분기 등 모두 이 worktree 의 최신 spec 과 일치한다. 충돌하는 active plan 은 없다. 발견된 WARNING 2건은 이미 머지된 plan 의 lifecycle 미정리 (in-progress 에서 complete 로 미이동) 및 `chat-channel-dispatcher-split` 진입 조건 충족 미반영이며, 어느 것도 구현 착수를 차단하지 않는다. worktree 충돌 후보 4건 전부 stale 판정으로 skip됐으며 active 충돌 없음.

---

## 위험도

LOW
