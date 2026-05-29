# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (`--impl-prep`)
대상 경로: `spec/4-nodes/7-trigger/providers/`
검토 시각: 2026-05-29

---

## 발견사항

### [WARNING] `chat-channel-form-native-modal` plan 의 미결 체크리스트 항목이 target spec 에서 이미 결정됨

- **target 위치**: `spec/4-nodes/7-trigger/providers/discord.md` R-D-6 (2026-05-28 갱신) / `spec/4-nodes/7-trigger/providers/slack.md` R-S-6 (2026-05-28 갱신)
- **관련 plan**: `plan/in-progress/chat-channel-form-native-modal.md` — 진입 조건 체크리스트 전체 및 산출물 항목 "R-S-6 / R-D-6 의 'v2 옵션' → 'v2 채택' 으로 갱신"
- **상세**: `chat-channel-form-native-modal` plan 은 `status: backlog` 이고 `worktree: (assigned at impl-start)` 로 아직 착수 전 상태다. 그런데 target spec 인 `discord.md` 와 `slack.md` 의 Changelog 를 보면 2026-05-28 에 이미 native form modal 이 채택되어 spec 에 기록되어 있다: discord.md §5.3 의 formMode 분기, §3.3 MODAL 구체, R-D-6 "v2 채택"; slack.md §3.3 views.open 구체, §5.3 formMode 분기, R-S-6 "v2 채택". Convention `chat-channel-adapter.md` 의 §4.1 native modal 경로 / R-CCA-8 도 동반 신설되었다 (discord.md / slack.md Rationale 내 인라인 참조). 즉 plan 의 핵심 산출물 (1번 spec 변경 + 2번 slack.md/discord.md §5.3 갱신) 이 이미 spec 에 반영된 상태다. Plan 의 나머지 체크리스트 (Convention R4 번복 정당화, 5 fields 한계 대응, Telegram 영향 확인) 도 target spec 내에서 implicit 하게 해소되어 있다 (R-D-6 / R-S-6 본문에 근거 기술됨). Backend 구현 (항목 3) 과 테스트 (항목 4) 만 미완으로 남아 있다.
- **제안**: `plan/in-progress/chat-channel-form-native-modal.md` 를 갱신하여 (a) spec 변경 완료 항목 체크 표시, (b) status 를 `backlog` → `in-progress (impl phase)` 로 갱신, (c) worktree 를 현재 작업 worktree `chat-channel-form-native-modal-c021b9` 로 업데이트, (d) 잔여 작업 = backend 구현 + 테스트로 범위 명확화. 이렇게 해야 다음 developer 가 착수 시 spec 변경을 중복 수행하지 않는다.

---

### [INFO] `spec-draft-chat-channel-error-notify` plan 이 동일 provider spec 파일을 target 으로 함

- **target 위치**: `spec/4-nodes/7-trigger/providers/discord.md`, `slack.md`, `telegram.md` 전체
- **관련 plan**: `plan/in-progress/spec-draft-chat-channel-error-notify.md` — frontmatter `target_specs` 에 세 파일 모두 명시, `worktree: chat-channel-error-notify-6d37ec`
- **상세**: error notify draft plan 은 `status: draft (consistency-check pending)` 이고, 세 provider spec 파일에 CCH-ERR-* 절을 추가하는 작업을 예정하고 있다. 현재 target spec (`discord.md` §5.6, `slack.md` §5.6) 에는 이미 `execution.failed` 처리 매핑 표가 있다. error notify plan 이 실제 착수 시 §5.6 과 overlap 될 가능성이 있다. 단, error notify plan 은 추가 삽입 (§3.5 CCH-ERR-* 절 신설) 이 주이고 §5.6 의 provider 구체 매핑은 그대로이므로 충돌보다는 보완 관계. `chat-channel-error-notify-6d37ec` worktree 가 git worktree list 에 존재하지 않아 실제 경합은 현재 없다.
- **제안**: 두 plan 의 편집 영역이 명시적으로 겹치지 않으므로 즉각 차단 불필요. 단 error notify plan 착수 시 `discord.md §5.6` 과의 중복 여부 재확인 필요. Plan frontmatter 에 상호 참조 주석 추가 권장.

---

### [INFO] `chat-channel-discord-gateway` plan 이 discord.md 를 참조하나 target spec 과 충돌 없음

- **target 위치**: `spec/4-nodes/7-trigger/providers/discord.md` R-D-3 / §5.1 CCH-MP-01 inbound
- **관련 plan**: `plan/in-progress/chat-channel-discord-gateway.md` — R-D-3 번복을 진입 조건 `[사용자 결정 필요]` 로 명시
- **상세**: target spec 의 `discord.md` §5.1 이 "Gateway 도입은 별 plan `chat-channel-discord-gateway` 로 분리" 라고 명시하고 있고, plan 은 R-D-3 번복을 `[사용자 결정 필요]` 체크로 차단하고 있다. Target spec 은 R-D-3 의 v1 한계를 인정하면서 gateway plan 을 앞으로 미루는 구조로, 두 문서가 정합하다. 단, target spec 의 §5.1 링크 (`../../../../plan/in-progress/chat-channel-discord-gateway.md`) 는 worktree 내 상대경로로 유효한지 착수 전 확인 권장.
- **제안**: 현재는 충돌 없음. Gateway plan 착수 시 discord.md R-D-3 번복 정당화 절차를 별도로 밟아야 한다.

---

### [INFO] `chat-channel-visual-ssr-png` plan 이 discord.md / slack.md §5.4 를 후속 대상으로 명시

- **target 위치**: `spec/4-nodes/7-trigger/providers/discord.md` §5.4, `slack.md` §5.4
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` — "Out of Scope: 다른 chat channel provider (Slack/KakaoTalk) 의 PNG 발송" 로 명시; discord.md §5.4 는 v2 SSR PNG 격상 plan 을 참조
- **상세**: target spec 의 discord.md §5.4 가 `plan/in-progress/chat-channel-visual-ssr-png.md` 를 참조하고 있고, visual-ssr-png plan 은 "Out of Scope: Slack / KakaoTalk" 로 명시해 현재 Telegram 한정이다. Discord/Slack 의 §5.4 v2 SSR 행은 "v2 별 plan 공유" 라는 메모만 있어 실제 착수 방식(별도 plan 분리 vs visual-ssr-png 확장)이 미결이다. 구현 착수 전 결정 필요. 현재 plan 간 충돌은 없으나 후속 항목 추적이 누락된 상태.
- **제안**: `chat-channel-visual-ssr-png` plan 의 "Out of Scope" 에 Discord/Slack 확장 시 별도 plan 이 필요하다는 메모를 추가하거나, 혹은 이 plan 의 범위를 provider-neutral 로 확대하는 결정을 문서화. 현재로서는 구현 차단 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `fix-mail-send-status-59d3b3` (branch `claude/fix-mail-send-status-59d3b3`) — Step 1: ancestor 검사 → STALE (exit 0). PR 조회: 결과 없음 (Step 2 음성 → Step 3 fallback. Step 1 STALE 신호로 stale 판정). 이 worktree 는 main 에 이미 포함된 commit 을 가리킨다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.
- `llm-model-select-followup-refactor-4a3d96` (branch `claude/llm-model-select-followup-refactor-4a3d96`) — Step 1: STALE. PR 조회: 없음 (Step 3 fallback. Step 1 STALE). 정리 권장.
- `spec-ai-error-output-c2c13d` (branch `claude/spec-ai-error-output-c2c13d`) — Step 1: STALE. PR 조회: 없음 (Step 3 fallback. Step 1 STALE). 정리 권장.
- `spec-update-ai-error-output-fields-594d0a` (branch `claude/spec-update-ai-error-output-fields-594d0a`) — Step 1: STALE. PR 조회: 없음 (Step 3 fallback. Step 1 STALE). 정리 권장.
- `telegram-chat-channel-spec-polish-49c49b` (worktree 부재) — Step 1: ACTIVE (exit 1). Step 2: PR #281 `MERGED` → **stale** (squash merge 케이스). 현재 git worktree list 에 없으므로 이미 cleanup 된 것으로 보임. Plan `spec-telegram-chat-channel-ui-polish.md` 는 `plan/complete/` 이동 필요.
- `trigger-list-chat-channel-ui-d0c4a3` (worktree 부재) — Step 1: ACTIVE. Step 2: PR #283 `MERGED` → **stale**. 마찬가지로 git worktree 에 없음. Plan `trigger-list-chat-channel-ui.md` 는 `plan/complete/` 이동 필요.
- `docs-mobile-sidebar-complete-8659c2` (branch `claude/docs-mobile-sidebar-complete-8659c2`) — Step 1: ACTIVE (exit 1). Step 2: PR #344 `MERGED` → **stale**. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

target 과 직접 동일 파일을 손대는 active worktree 는 현재 `chat-channel-form-native-modal-c021b9` (본 worktree 자체) 뿐이다. 다른 active worktree (`eia-jti-tracking-7e68c5`, `triggers-auth-column-a80393`) 는 provider spec 파일과 무관한 영역이므로 §5번 worktree 충돌 해당 없음.

---

## 요약

Target `spec/4-nodes/7-trigger/providers/` 문서군은 `plan/in-progress/chat-channel-form-native-modal` plan 의 spec 산출물 (Convention §4.1 신설, slack.md / discord.md §5.3 / R-S-6 / R-D-6 갱신) 을 이미 반영하고 있어 spec 변경 측면에서는 plan 과 정합하다. 그러나 plan 파일 자체는 여전히 `status: backlog` 이고 체크리스트가 미갱신 상태로 남아, 다음 developer 가 착수 시 "spec 변경 아직 안 됨" 으로 오인할 위험이 있다 (WARNING 1건). 나머지 발견사항은 INFO 3건 — 현재 구현 차단 없음. worktree 충돌 후보 8건 분석 결과 stale 7건 skip (Step 1 ancestor 4건, Step 2 PR MERGED 3건), active 1건 (본 worktree 자체).

---

## 위험도

**LOW** — 구현을 즉각 차단하는 CRITICAL 항목 없음. spec 자체는 plan 의 의도와 정합하며 미해결 결정 우회도 없다. 단, `chat-channel-form-native-modal` plan 파일의 상태 불일치가 후속 developer 혼선을 유발할 수 있어 plan 갱신이 권장된다.
