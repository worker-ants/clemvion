# Plan 정합성 검토 결과

**Target plan**: `plan/in-progress/spec-slack-discord-chat-channel.md`
**Worktree**: `spec-slack-discord-chat-channel-bb4d35`
**검토 일시**: 2026-05-24

---

## 발견사항

### [WARNING] dispatcher-split plan 의 trigger 조건 충족 — 후속 항목 누락

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` §6 후속 plan / §0 배경
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md` (status: backlog)
- **상세**: `chat-channel-dispatcher-split.md` 의 in-progress 진입 조건은 "Telegram 외 두 번째 chat channel provider (Slack / KakaoTalk 등) 도입 결정" 이다. 본 target plan 이 Slack 의 spec 을 정식 신설하는 것 자체가 "도입 결정" 에 해당할 수 있다. target plan 의 §6 후속 plan 목록에 `chat-channel-slack-impl.md` / `chat-channel-discord-impl.md` 스켈레톤은 포함되어 있으나, dispatcher-split plan 의 trigger 충족 여부 및 진입 시점에 대한 언급이 없다. 의도적으로 "구현 착수" 시점(impl plan 이 실제 in-progress 진입 시점)을 trigger 로 해석할 경우 문제없지만, spec-only 완료만으로도 trigger 로 해석될 여지가 있어 모호하다.
- **제안**: target plan §6 또는 §4 위험/결정 보류 절에 한 줄 추가 — "chat-channel-dispatcher-split.md trigger 조건이 본 plan 의 spec 완료로 충족되는지, 또는 Slack impl plan (`chat-channel-slack-impl.md`) 이 in-progress 진입 시점을 trigger 로 할지 명확화 필요". dispatcher-split plan 자체의 trigger 조건 주석에도 "spec 완료 vs impl 착수" 중 어느 쪽인지 명시하도록 plan 갱신 권장.

---

### [INFO] secret-store-infra plan 의 미해결 인프라 결정과 target plan 의 secret-store.md 갱신 범위

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` §1 산출물 목록 (`spec/conventions/secret-store.md` "검토 후 최소 갱신") + §Phase 4
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` (status: backlog, "사용자 결정 필요")
- **상세**: `chat-channel-secret-store-infra.md` 는 AWS Secrets Manager vs Vault vs DB 암호화 중 인프라 구현 방식을 사용자 escalate 상태로 보류 중이다. target plan 이 `spec/conventions/secret-store.md` §1 예시 표에 `slack-signing-secret` / `discord-public-key` 행만 추가하는 것은 URI scheme 예시 확장이며, 인프라 구현 선택과 독립적이다 — 충돌 없음. 단, target plan 의 §Phase 4 설명이 이 구분을 명시하지 않아 추적 시 혼동 가능성이 있다.
- **제안**: target plan §Phase 4 의 `secret-store.md` 갱신 설명에 "URI scheme 예시 표 확장만 — 인프라 구현 선택 (`chat-channel-secret-store-infra.md`) 과 독립" 한 줄 추기 권장 (추적 명확화).

---

### [INFO] 3개 backlog plan (dispatcher-split / secret-store-infra / visual-ssr-png) 에 worktree 미설정 — 점검 후 확인

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` §Phase 0 확인된 점 (동시 작업 plan 5건 충돌 없음)
- **관련 plan**: `plan/in-progress/chat-channel-dispatcher-split.md`, `plan/in-progress/chat-channel-secret-store-infra.md`, `plan/in-progress/chat-channel-visual-ssr-png.md`
- **상세**: 위 3건은 모두 status=backlog 이고 frontmatter 에 `worktree` 필드 없음 — 활성 worktree 가 없어 파일 단위 충돌 없음. target plan §Phase 0 의 "다른 영역" 주장 재확인 완료. dispatcher-split 은 `spec/5-system/15-chat-channel.md` / codebase 만 영향, secret-store-infra 는 인프라 구현 계획만, visual-ssr-png 는 `spec/4-nodes/7-trigger/providers/telegram.md §5.4` / codebase 만 영향 — 모두 target 의 신규 파일(`providers/slack.md` / `providers/discord.md`) 및 `_overview.md` 갱신과 라인 단위 충돌 없음.
- **제안**: 현 상태 OK. 추가 action 불필요.

---

### [INFO] D-1 (Form modal vs 다단계 텍스트) — convention R4 와 일치하는 잠정 채택 확인

- **target 위치**: `plan/in-progress/spec-slack-discord-chat-channel.md` §4 D-1
- **관련 plan**: `spec/conventions/chat-channel-adapter.md` §4 + Rationale R4 (기존 결정)
- **상세**: `chat-channel-adapter.md` R4 는 이미 "v1 은 다단계 텍스트 시퀀스로 통일 — native UI 분기는 v2 옵션" 으로 명문화되어 있다. target plan D-1 의 잠정 채택 (C) + "Phase 2/3 에서는 (A) 준수 path 로 작성" 은 기존 결정과 정합한다. consistency-check 를 최종 판단자로 삼는 구조도 적절.
- **제안**: target plan 의 D-1 에 `chat-channel-adapter.md §R4` 를 명시적으로 cross-ref 추가 권장 ("기존 R4 결정 참조 — v2 옵션만 허용") — 검토자 탐색 비용 절감.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보는 아래 4건이다. 전부 stale 판정으로 §5번 검토에서 제외.

- `telegram-chat-channel-spec-polish-49c49b` (branch `claude/telegram-chat-channel-spec-polish-49c49b`) — Step 1: ACTIVE (ancestor 아님), Step 2: PR MERGED. **stale**.
- `trigger-list-chat-channel-ui-d0c4a3` (branch `claude/trigger-list-chat-channel-ui-d0c4a3`) — Step 1: ACTIVE, Step 2: PR MERGED. **stale**.
- `harness-spec-impl-coverage-befc2f` (branch `claude/harness-spec-impl-coverage-befc2f`) — Step 1: ACTIVE, Step 2: PR MERGED. **stale**.
- `apply-brand-logo-049314` (branch `claude/apply-brand-logo-049314`) — Step 1: ACTIVE, Step 2: PR CLOSED. **stale** (CLOSED = squash merge 또는 폐기; 어느 쪽이든 활성 작업 없음). 대응 in-progress plan 파일도 없음.

위 4건 worktree 는 이미 머지·종결된 PR 의 잔존 local worktree 로 cleanup 권장. `./cleanup-worktree-all.sh --yes --force` 실행으로 일괄 제거 가능.

---

## 요약

target plan `spec-slack-discord-chat-channel.md` 의 산출물 범위 (신규 파일 `providers/slack.md` / `providers/discord.md`, `_overview.md` 갱신, 컨벤션 파일 최소 갱신) 는 현재 active in-progress plan 들과 파일·라인 단위 충돌이 없다. 미해결 결정 D-1/D-2/D-3 은 target plan 안에 명시적으로 보류 처리되어 있고, 잠정 채택 방향이 기존 convention R4 결정과 정합한다. 주요 후속 항목 누락 사항 1건 (dispatcher-split trigger 충족 시점 명확화) 이 WARNING 으로 발견됐으며, target plan 이나 dispatcher-split plan 중 하나에 한 줄 추기로 해소 가능하다. worktree 충돌 후보 4건 모두 stale 판정 (PR MERGED/CLOSED) 으로 active 충돌 0건.

---

## 위험도

LOW
