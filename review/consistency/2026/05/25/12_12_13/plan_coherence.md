# Plan 정합성 검토 — chat-channel-error-notify-6d37ec

검토 모드: `--impl-prep` (구현 착수 전)
대상 spec: `spec/5-system/15-chat-channel.md`
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] trigger-list-chat-channel-ui plan 의 `languageHints (5 키)` 가정이 target 변경 후 stale — 그러나 plan 자체는 MERGED (stale 여부 판정 필요)

- **target 위치**: `spec/5-system/15-chat-channel.md §4.1 languageHints` 객체 및 `§4.1.1 default 문구 표`
- **관련 plan**: `plan/in-progress/trigger-list-chat-channel-ui.md` Commit 3 항목 — "Chat Channel 카드 편집 모드 | `chat-channel-card.tsx` | uiMapping 3개 / rateLimit / **languageHints (5 키)**. editor 이상 권한"
- **상세**: target 변경은 `languageHints` 에 신규 6 키 (`executionFailedThirdParty4xx` / `*5xx` / `*Timeout` / `*RateLimit` / `*ThirdParty` / `*Internal`) 와 최상위 `languageLocale: "ko" | "en"` 필드를 추가한다. `trigger-list-chat-channel-ui.md` 는 "5 키" 로 고정한 카드 편집 UI 를 약속하고 있었다. 그러나 Step 2 (GitHub PR state 검사) 에서 해당 plan 의 branch `claude/trigger-list-chat-channel-ui-d0c4a3` 의 PR #283 이 `MERGED` 상태임을 확인 — plan 파일이 `plan/in-progress/` 에 남아 있을 뿐, 실제 worktree 는 stale. 따라서 구현 충돌 경합 위험은 없다.
- **잔여 후속 의무**: trigger-list UI 의 languageHints 편집 form 이 이미 merge 된 상태라면, 신규 6 키와 `languageLocale` 필드가 UI 에 노출되지 않는 갭이 생길 수 있다. `plan/in-progress/chat-channel-error-notify.md §Frontend` 항목이 이 갭을 인식하고 있음 ("languageHints 편집 form 이 존재하면 신규 6 키 추가. 미존재 시 본 plan 범위 밖") — 수용 기준에 `trigger-list-chat-channel-ui` PR 의 frontend 편집 form 존재 여부 확인 + 필요 시 follow-up plan 추가 권장.
- **제안**: `plan/in-progress/trigger-list-chat-channel-ui.md` 를 `plan/complete/` 로 `git mv` 정리 (`cleanup-worktree-all.sh` 실행). 신규 6 키 UI gap 은 `chat-channel-error-notify` plan 의 Frontend 절에 "PR #283 편집 form 실재 여부 확인 → 실재 시 follow-up PR" 체크박스로 명시 보강 권장.

---

### [INFO] spec-telegram-chat-channel-ui-polish plan 이 in-progress 에 잔존 — stale 판정 완료

- **target 위치**: 해당 없음 (직접 충돌 없음)
- **관련 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree `telegram-chat-channel-spec-polish-49c49b`, PR #281)
- **상세**: PR #281 이 `MERGED` — Step 2 에서 확인. `plan/in-progress/` 에 파일이 남아 있으나 실제 작업은 완료된 stale worktree. target 과 파일 단위 충돌 없음.
- **제안**: `plan/complete/` 로 이동 + worktree 정리 (`cleanup-worktree-all.sh --yes --force`) 권장.

---

### [INFO] fix-chat-channel-dispatcher-and-cafe24-warn plan 이 in-progress 에 잔존 — stale 판정 완료

- **target 위치**: 해당 없음 (직접 충돌 없음)
- **관련 plan**: `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md` (worktree `fix-chat-channel-dispatcher-and-cafe24-warn-68da78`, PR #314)
- **상세**: PR #314 이 `MERGED` — Step 2 에서 확인. `spec/5-system/15-chat-channel.md` 를 `related_specs` 로 참조하고 있으나 이미 merge 완료. target 의 spec 변경과 파일 단위 경합 없음.
- **제안**: `plan/complete/` 로 이동 + worktree 정리 권장.

---

### [INFO] chat-channel-outbound-still-broken plan 이 in-progress 에 잔존 — stale 판정 완료

- **target 위치**: 해당 없음 (직접 충돌 없음)
- **관련 plan**: `plan/in-progress/chat-channel-outbound-still-broken.md` (worktree `.claude/worktrees/chat-channel-outbound-still-broken-afe293`, branch `claude/chat-channel-outbound-still-broken-afe293`)
- **상세**: Step 1 (git merge-base ancestor 검사) 에서 ACTIVE 가 나왔으나, Step 2 (GitHub PR state) 에서 PR state = `MERGED` — squash merge 케이스. stale 로 판정. `spec/5-system/15-chat-channel.md` 를 `related_specs` 로 참조하지만 spec 을 직접 수정하지는 않으므로 target 과 충돌 없음.
- **제안**: `plan/complete/` 로 이동 + worktree 정리 권장.

---

### [INFO] chat-channel-error-notify plan 이 pending_plans 로 spec frontmatter 에 추가 — chat-channel-dispatcher-split 제거와 균형

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 섹션
- **관련 plan**: `plan/complete/chat-channel-dispatcher-split.md` (이미 complete 로 이동된 plan)
- **상세**: target diff 에서 `plan/in-progress/chat-channel-dispatcher-split.md` 항목이 제거되고 `plan/in-progress/chat-channel-error-notify.md` 가 추가된다. `chat-channel-dispatcher-split` 은 `plan/complete/` 에 위치하므로 제거는 정합. 신규 plan 추가도 자기 worktree 의 plan 파일과 일치.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

| worktree | branch | Step 1 | Step 2 |
|---|---|---|---|
| `chat-channel-outbound-still-broken-afe293` | `claude/chat-channel-outbound-still-broken-afe293` | ACTIVE (non-ancestor) | PR state: `MERGED` → stale |
| `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` | `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78` | ACTIVE (non-ancestor) | PR #314 state: `MERGED` → stale |
| `telegram-chat-channel-spec-polish-49c49b` | `claude/telegram-chat-channel-spec-polish-49c49b` | ACTIVE (non-ancestor) | PR #281 state: `MERGED` → stale |
| `trigger-list-chat-channel-ui-d0c4a3` | `claude/trigger-list-chat-channel-ui-d0c4a3` | ACTIVE (non-ancestor) | PR #283 state: `MERGED` → stale |

위 4개 worktree 는 모두 squash merge 로 main 에 반영됨 (Step 1 통과 못하는 이유). 활성으로 남아 있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/15-chat-channel.md` 에 대한 target 변경 (CCH-ERR-* 요구사항 5종 신설, `languageLocale` 필드 도입, `languageHints` 6 신규 키, `classifyExecutionFailure` 분류 알고리즘 Convention §3.1 위임) 은 in-progress plan 들의 미해결 결정과 충돌하거나 병렬 worktree 와 경합하는 부분이 없다. worktree 충돌 후보 4건 모두 squash-merged PR 의 stale worktree 로 판정해 skip. 유일한 WARNING 은 `trigger-list-chat-channel-ui` (PR #283, MERGED) 가 "languageHints 5 키" 를 편집 form 으로 약속했는데 이제 6 신규 키 + `languageLocale` 가 추가되어 UI gap 이 생길 수 있다는 점이나, 해당 plan 자체는 이미 stale 이어서 경합 위험은 없고 후속 follow-up 추가로 해소 가능하다. stale worktree 4건 skip, active worktree 분석 결과 충돌 없음.

## 위험도

LOW
