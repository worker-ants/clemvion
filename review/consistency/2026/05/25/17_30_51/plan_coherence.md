# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target: `spec/5-system/15-chat-channel.md`
검토 시각: 2026-05-25
검토 worktree: `chat-channel-template-render-outbound-2f8164` (branch `claude/chat-channel-template-render-outbound-2f8164`, PR #328 OPEN)

---

## 발견사항

### [INFO] chat-channel-error-notify worktree (PR #323) stale skip
- target 위치: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` — `chat-channel-error-notify.md`
- 관련 plan: `plan/in-progress/chat-channel-error-notify.md` (frontmatter `worktree: chat-channel-error-notify-6d37ec`)
- 상세: worktree `chat-channel-error-notify-6d37ec` (branch `claude/chat-channel-error-notify-6d37ec`) 는 Step 1 (git merge-base) 에서 ACTIVE 신호이나, Step 2 (PR state) 에서 PR #323 MERGED 확인 → stale 판정. target 문서의 CCH-ERR-* 절 (`§3.5`)·R-CC-15·`§4.1.1 languageHints default` 는 해당 PR 에서 이미 적용된 내용이 main 에 존재하며 본 PR #328 의 diff 는 그 위에 추가 변경만 포함. 경합 없음.
- 제안: stale worktree cleanup 권장 (`./cleanup-worktree-all.sh --yes --force`).

### [INFO] chat-channel-runtime-fix worktree (PR #324) stale skip
- target 위치: `spec/conventions/chat-channel-adapter.md` — runtime drift fix (§1.2 `ai_form_render` 확장, §3 silent 정책)
- 관련 plan: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md` (frontmatter `worktree: .claude/worktrees/chat-channel-runtime-fix-ed7061`)
- 상세: branch `claude/chat-channel-runtime-fix-ed7061` — Step 1 ACTIVE, Step 2 PR #324 MERGED → stale 판정. 해당 fix 내용은 이미 main 에 반영되어 있고 본 PR #328 의 Convention diff 는 그 위의 추가 변경.
- 제안: stale worktree cleanup 권장.

### [INFO] chat-channel-outbound-still-broken worktree (PR #318) stale skip
- target 위치: `spec/5-system/15-chat-channel.md` §3, `spec/5-system/14-external-interaction-api.md`
- 관련 plan: `plan/in-progress/chat-channel-outbound-still-broken.md` (worktree `chat-channel-outbound-still-broken-afe293`)
- 상세: branch `claude/chat-channel-outbound-still-broken-afe293` — Step 1 ACTIVE, Step 2 PR #318 MERGED → stale 판정. 경합 없음.
- 제안: stale worktree cleanup 권장.

### [INFO] spec-telegram-chat-channel-ui-polish worktree (PR #281) stale skip
- target 위치: `spec/5-system/15-chat-channel.md` 다수
- 관련 plan: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree `telegram-chat-channel-spec-polish-49c49b`)
- 상세: branch `claude/telegram-chat-channel-spec-polish-49c49b` — Step 1 ACTIVE, Step 2 PR #281 MERGED → stale 판정.
- 제안: stale worktree cleanup 권장.

### [INFO] trigger-list-chat-channel-ui worktree (PR #283) stale skip
- target 위치: `spec/5-system/15-chat-channel.md` (chat channel config UI)
- 관련 plan: `plan/in-progress/trigger-list-chat-channel-ui.md` (worktree `trigger-list-chat-channel-ui-d0c4a3`)
- 상세: branch `claude/trigger-list-chat-channel-ui-d0c4a3` — Step 1 ACTIVE, Step 2 PR #283 MERGED → stale 판정.
- 제안: stale worktree cleanup 권장.

### [INFO] fix-chat-channel-dispatcher worktree (PR #314) stale skip
- target 위치: `spec/5-system/15-chat-channel.md` §3
- 관련 plan: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md` (worktree `fix-chat-channel-dispatcher-and-cafe24-warn-68da78`)
- 상세: branch `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78` — Step 1 ACTIVE, Step 2 PR #314 MERGED → stale 판정.
- 제안: stale worktree cleanup 권장.

### [INFO] spec-harness-impl-coverage worktree (PR #287) stale skip
- target 위치: `spec/5-system/15-chat-channel.md` (chat channel UI 약속 언급)
- 관련 plan: `plan/in-progress/spec-harness-impl-coverage.md` (worktree `harness-spec-impl-coverage-befc2f`)
- 상세: branch `claude/harness-spec-impl-coverage-befc2f` — Step 1 ACTIVE, Step 2 PR #287 MERGED → stale 판정.
- 제안: stale worktree cleanup 권장.

### [INFO] backlog 상태 plan 들의 spec 영향 — 충돌 없음
- target 위치: `spec/5-system/15-chat-channel.md` §3.5 CCH-ERR-05 언급 `chat-channel-form-native-modal` / CCH-MP-04 v2 언급 `chat-channel-visual-ssr-png` / CCH-SE-03 언급 `chat-channel-secret-store-infra`
- 관련 plan: `plan/in-progress/chat-channel-form-native-modal.md`, `plan/in-progress/chat-channel-visual-ssr-png.md`, `plan/in-progress/chat-channel-secret-store-infra.md`
- 상세: 세 plan 모두 frontmatter `status: backlog`, worktree 미할당 (`(assigned at impl-start)` 또는 미기재). 진행 중인 worktree 없음. target PR #328 이 이들과 동일 spec 영역을 일부 참조하지만, 해당 plan 의 결정 사항 (`render_form` 처리는 `chat-channel-form-native-modal` 추적, v2 SSR PNG 는 `chat-channel-visual-ssr-png` 추적, secret store 는 별도 인프라 결정) 을 일방적으로 번복하지 않고 명시적으로 "별 plan" 으로 defer 하고 있어 정합.
- 제안: 변경 불필요.

### [INFO] `pending_plans` frontmatter 에 `chat-channel-error-notify.md` 잔존 — 정리 권장
- target 위치: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 6번째 항목
- 관련 plan: `plan/in-progress/chat-channel-error-notify.md` (PR #323 MERGED)
- 상세: PR #323 이 MERGED 되어 CCH-ERR-* 구현이 완료된 상태이므로 `pending_plans` 에서 해당 항목을 제거하는 것이 자연스럽다. 단, 이 항목은 spec 검토 차단 조건이 아니며 plan 의 미해결 결정과도 관계없음.
- 제안: 본 PR 또는 후속 commit 에서 `pending_plans` 에서 `chat-channel-error-notify.md` 항목 제거 + `plan/in-progress/chat-channel-error-notify.md` → `plan/complete/` 이동 (`git mv`) 처리 권장.

---

## 관점별 결론

### 1. 미해결 결정과의 충돌
plan 에서 "결정 필요" 로 표시된 항목과의 충돌 없음. `chat-channel-form-native-modal`·`chat-channel-visual-ssr-png`·`chat-channel-secret-store-infra`·`chat-channel-discord-gateway`·`chat-channel-slack-socket-mode` 의 미결 결정 사항을 본 target PR 은 일방적으로 번복하지 않으며 해당 영역을 명시적으로 "별 plan" 으로 defer.

### 2. 중복 작업 / 병렬 worktree 경합
동일 spec 파일을 손대는 ACTIVE worktree 는 현재 PR #328 (본 PR) 1개뿐. 다른 chat-channel 관련 worktree 는 모두 Step 2 (PR state) 에서 MERGED 판정 → stale.

### 3. 선행 plan 미해소
본 target 이 가정하는 선행 조건:
- CCH-AD-05 (EIA 5종 이벤트 구독) — 이미 구현 완료 (PR #281 포함 기존 PR)
- CCH-MP-04 v1 MarkdownV2 fallback (`renderCarouselFallback` / `renderTableFallback` / `renderChartFallback`) — PR #261 에서 완료
- `presentations?: PresentationPayload[]` 필드의 EIA §6.5 약속 — 이미 EIA spec 에 명시 (diff 가 보여주는 drift 는 convention 파일에서 해당 필드가 누락된 것을 수정하는 형태)
- R8 per-trigger `ChannelListenerRegistry` — `plan/complete/chat-channel-dispatcher-split.md` (2026-05-24 완료)

모두 해소된 상태. 미해소 선행 조건 없음.

### 4. 후속 항목 누락
- CCH-AD-07 / CCH-MP-06 신설은 backend 구현 (`chat-channel/types.ts` 타입 보강, dispatcher SUBSCRIBED_EVENTS 확장, 3 provider renderer 갱신) 을 후속 developer PR 로 분리. target spec 의 R-CC-16 `(d)` 에 "구현: 본 spec 결정 머지 후 별도 PR (developer skill)" 명시 — 후속 추적 의무 인지됨.
- 단, 이 후속 구현 plan 파일 (`plan/in-progress/` 내)이 아직 존재하지 않음. spec PR merge 전에 plan 파일을 준비해두지 않으면 implementation drift 재발 위험.
- 제안: 본 spec PR merge 후 developer plan 파일 (`chat-channel-template-render-outbound-impl.md` 또는 유사 이름) 신설 의무 — R-CC-16 `(d)` 의 "별도 PR" 약속을 추적할 plan 이 없으면 해당 구현이 누락될 수 있음. 단 이는 CRITICAL 차단 사유가 아닌 WARNING 수준.

### 5. worktree 충돌
active worktree 간 동시 경합 없음 (상기 모두 stale 판정). 본 PR #328 이 유일한 active worktree.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 `§worktree stale 판정` 으로 skip 된 항목 7건:

- `chat-channel-error-notify-6d37ec` (branch `claude/chat-channel-error-notify-6d37ec`) — Step 1 ACTIVE, Step 2 PR #323 MERGED
- `chat-channel-runtime-fix-ed7061` (branch `claude/chat-channel-runtime-fix-ed7061`) — Step 1 ACTIVE, Step 2 PR #324 MERGED
- `chat-channel-outbound-still-broken-afe293` (branch `claude/chat-channel-outbound-still-broken-afe293`) — Step 1 ACTIVE, Step 2 PR #318 MERGED
- `telegram-chat-channel-spec-polish-49c49b` (branch `claude/telegram-chat-channel-spec-polish-49c49b`) — Step 1 ACTIVE, Step 2 PR #281 MERGED
- `trigger-list-chat-channel-ui-d0c4a3` (branch `claude/trigger-list-chat-channel-ui-d0c4a3`) — Step 1 ACTIVE, Step 2 PR #283 MERGED
- `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` (branch `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78`) — Step 1 ACTIVE, Step 2 PR #314 MERGED
- `harness-spec-impl-coverage-befc2f` (branch `claude/harness-spec-impl-coverage-befc2f`) — Step 1 ACTIVE, Step 2 PR #287 MERGED

모두 squash/rebase merge 로 인해 Step 1 (ancestor 검사) 은 통과하지 못했으나 Step 2 (PR state) 에서 MERGED 확인. 활성 이유 없음.

`./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/15-chat-channel.md` target (PR #328) 은 비-blocking presentation 노드의 채널 발화 누락 회귀 (CCH-AD-07·CCH-MP-06 신설) 와 AI Agent `render_*` presentations[] 발화 누락 (CCH-MP-01 보강) 을 spec 에 정식화하는 변경이다. 미해결 결정과의 충돌 없고, active worktree 경합도 없으며, 선행 조건도 모두 해소된 상태. 유일한 주의 사항은 (a) `pending_plans` 에 MERGED PR #323 의 plan 항목이 잔존해 cleanup 권장, (b) R-CC-16 `(d)` 에 언급된 후속 구현 PR 을 추적할 plan 파일이 아직 미작성으로 implementation drift 위험이 있어 WARNING 수준 보완 권장. worktree 충돌 후보 7건 전원 stale (Step 2 MERGED) skip, active 0건.

---

## 위험도

LOW

---

STATUS: SUCCESS
