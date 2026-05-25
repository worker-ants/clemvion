# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 모드: `--spec`
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] target plan 의 §영향 평가 에 `renderPresentationNode` 잔존 — C-6 해소 결정과 불일치

- **target 위치**: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md` §영향 평가 (line 228) + §Consistency-check 회차 Round 1 표 C-3 행
- **관련 plan**: 동일 target plan 내부
- **상세**: §결정 1 본문 (Round 2 C-6 해소 후 최종) 은 "**6함수 유지**, `renderNode` 시그니처를 union 입력으로 확장" 으로 확정하고, §기각 대안 의 대안 2 에서 "7번째 함수 `renderPresentationNode` 신설" 을 명시 기각한다. 그러나 §영향 평가 의 "chat-channel 어댑터 구현" 목록 세 번째 항목에 "새 함수 `renderPresentationNode` 추가 — Telegram/Slack/Discord adapter 모두 구현 의무" 가 여전히 남아 있다. 또한 §Consistency-check 회차 Round 1 표의 C-3 해소 설명도 "새 함수 `renderPresentationNode` 신설 (§1.1 7함수 표)" 라고 구(旧) 채택안을 적고 있어, 열람자가 현재 채택 방향(6함수 유지 + union 확장)인지 구 방향(7함수)인지 혼동할 수 있다.
- **제안**: §영향 평가 의 `renderPresentationNode` 항목을 "`renderNode` 시그니처 union 확장 (`EiaEvent | ChatChannelInternalEvent`) — 새 함수 추가 없음, 6함수 그대로"로 교체. Round 1 표의 C-3 해소 열도 "→ `renderNode` union 입력 확장 (Round 2 C-6 재논의 후 최종 채택). 7함수 신설 방향은 C-6 에서 기각." 로 갱신.

---

### [WARNING] telegram.md §7 동반 갱신 의무 명시 있으나 갱신 내용 미정의

- **target 위치**: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md` §영향 평가 마지막 bullet (`spec/4-nodes/7-trigger/providers/telegram.md §7 변경 관리 의무에 따라 동반 갱신 — CCH-MP-06 / CCH-AD-07 cross-ref 추가`)
- **관련 plan**: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (stale worktree 이나 해당 spec 파일의 §5.4 / §6 / §7 를 이미 최종 갱신 완료)
- **상세**: target plan 의 §Spec 갱신안 (A/B/C/D) 에는 `telegram.md` 의 실제 변경 내용이 정의되어 있지 않다. §영향 평가의 한 줄 언급만 있을 뿐 어느 단락에 어떤 줄을 추가할지 명세가 없다. spec PR 실행 시점에 누락 리스크가 존재한다. (현재 main 의 `telegram.md §5.4` 에는 CCH-MP-06 / CCH-AD-07 cross-ref 가 없다.)
- **제안**: §Spec 갱신안 에 `spec/4-nodes/7-trigger/providers/telegram.md` 갱신 섹션(E 항목)을 추가해 §5.4 의 어느 표 또는 행에 cross-ref 를 삽입할지 구체화한다.

---

### [INFO] R-CC-13 보강 대상 Rationale 의 R-CC 번호 — 현재 main 에서 R-CC-15 까지 사용 중

- **target 위치**: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md` §Spec 갱신안 B, §Rationale R-CC-13 보강
- **관련 plan**: `plan/in-progress/spec-draft-chat-channel-error-notify.md` (PR #323 MERGED) — 동 PR 이 R-CC-15 를 추가함
- **상세**: target plan 이 "R-CC-13 마지막에 한 줄 추가" 를 명시하는데, 현재 main 의 `spec/5-system/15-chat-channel.md` 에는 R-CC-15 까지 정의되어 있다. R-CC-13 자체가 여전히 존재하고 갱신 대상 위치로 유효한지 확인이 필요하다. 현재 main 에서 R-CC-13 은 "Discord v1 의 CCH-MP-01 부분 유예" 로 존재한다. target plan 의 보강 내용(Discord v1 의 `presentations[]` 처리)은 R-CC-13 의 원 취지와 정합하므로 보강 자체는 적절하나, 다른 plan 들이 R-CC-14 / R-CC-15 를 추가한 이후의 현재 위치를 확인 후 보강 범위 명시 권장.
- **제안**: plan 에 "(현재 main 기준 R-CC-13 은 line X 에 위치, 본 변경은 해당 절 말미 추가)" 주석 추가.

---

### [INFO] `WebsocketService.executionEvents$` 구독 경로 — `chat-channel-outbound-still-broken` plan 과 인접 영역이나 충돌 없음

- **target 위치**: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md` §결정 1 (`WebsocketService.executionEvents$` Subject 단일 구독 + sub-filter)
- **관련 plan**: `plan/in-progress/chat-channel-outbound-still-broken.md` (stale — PR #319, #320 MERGED)
- **상세**: `chat-channel-outbound-still-broken` plan 은 `WebsocketService.executionEvents$` 의 subscriber (ChatChannelDispatcher) 에 flat→nested 변환 fix 를 실시했다. target plan 은 동일 Subject 에 `execution.node.completed` sub-filter 를 추가 구독하는 것을 제안한다. 구독 경로 자체는 이미 PR 에서 안정화되었으므로 두 plan 간 의미 충돌은 없다. 단, 해당 worktree 가 git worktree 목록에 아직 남아 있어 cleanup 대상.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 5건 중 Step 2 (GitHub PR state) 에서 stale 판정 5건 모두 skip.

| worktree | branch | stale 판정 |
|---|---|---|
| `telegram-chat-channel-spec-polish-49c49b` | `claude/telegram-chat-channel-spec-polish-49c49b` | Step 2 — PR MERGED (동일 spec 파일 `chat-channel-adapter.md` / `15-chat-channel.md` / `telegram.md` 수정 완료) |
| `.claude/worktrees/chat-channel-outbound-still-broken-afe293` | `claude/chat-channel-outbound-still-broken-afe293` | Step 2 — PR MERGED |
| `.claude/worktrees/fix-chat-channel-dispatcher-and-cafe24-warn-68da78` | `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78` | Step 2 — PR MERGED |
| `.claude/worktrees/chat-channel-error-notify-6d37ec` | `claude/chat-channel-error-notify-6d37ec` | Step 2 — PR #323 MERGED (chat-channel-adapter.md §3.1 신설 완료 — target plan 이 §3.1 충돌 C-5 해소의 선행 조건으로 인용하는 바로 그 결과) |
| `.claude/worktrees/chat-channel-runtime-fix-ed7061` | `claude/chat-channel-runtime-fix-ed7061` | Step 2 — PR #324 MERGED |
| `.claude/worktrees/telegram-carousel-button-click-5b52c1` | `claude/telegram-carousel-button-click-5b52c1` | Step 2 — PR #326 MERGED |

위 6개 worktree 가 활성으로 남아 있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan (`spec-draft-chat-channel-template-render-outbound.md`) 은 2회의 consistency-check round (C-1 ~ C-6) 를 거쳐 결정이 상당 부분 안정화된 상태이며, 다른 in-progress plan 과의 CRITICAL 수준의 미해결 결정 우회, 동일 spec 영역의 active worktree 충돌, 또는 선행 조건 미해소 문제는 발견되지 않았다. 검토된 worktree 충돌 후보 6건 전부 PR MERGED stale 으로 skip 되었다. 다만 WARNING 2건이 존재한다: (1) §영향 평가 의 `renderPresentationNode` 잔존 문구가 C-6 최종 채택(6함수 유지 + union 확장)과 불일치해 구현 단계에서 혼동을 유발할 수 있고, (2) `telegram.md §7` 동반 갱신 의무가 언급되어 있으나 §Spec 갱신안 에 구체 내용이 미정의 상태다. 두 WARNING 은 spec PR 실행 전 target plan 내 교정으로 해결 가능하며, 별도 plan 갱신 불필요. worktree 충돌 후보 6건 중 stale 6건 skip, active 0건 분석.

---

## 위험도

LOW
