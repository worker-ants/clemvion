# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
실제 변경 파일: `spec/5-system/15-chat-channel.md` (3곳 수정)
소유 plan: `plan/in-progress/chat-channel-workspace-code-unify.md` (worktree `code-node-cleanup-45ffef`)

---

## 발견사항

- **[INFO]** `spec-sync-chat-channel-gaps.md` 의 §5.4 열린 항목과 target 변경의 관계 확인
  - target 위치: `spec/5-system/15-chat-channel.md §5.4` 에러 응답 표
  - 관련 plan: `plan/in-progress/spec-sync-chat-channel-gaps.md` — §5.4 rotate-bot-token 성공 응답 3필드(`triggerId`/`chatChannelHealth`/`botIdentity`) 동봉이 열린 항목
  - 상세: target 이 수정한 §5.4 에러 응답 표의 `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 행은 spec-sync-chat-channel-gaps 의 "rotate-bot-token 성공 응답 3필드" 미구현과 **다른 행**이다. 양쪽 항목이 §5.4 를 공유하지만 서로 독립적인 행을 다루므로 충돌 없음. 다만 두 작업이 같은 표 영역을 순차적으로 손댈 예정이라는 점을 추적하면 유용하다.
  - 제안: 현재 상태 유지. 추적 메모 수준.

- **[INFO]** `EiaAiMessageEvent` → `EiaEvent` 명칭 정정(R-CC-16)이 refactor/03-maintainability `m-2` 계획과 부분 교차
  - target 위치: `spec/5-system/15-chat-channel.md §R-CC-16` line 654 (현재 line 652)
  - 관련 plan: `plan/in-progress/refactor/03-maintainability.md` §m-2 — `toEiaEvent` 별칭·dead symbol 삭제 계획 (사용자 승인, 미착수, worktree 미배정)
  - 상세: `m-2` 는 `chat-channel.dispatcher.ts:632-636` 의 `toEiaEvent` 코드 심볼 삭제를 다루며 spec 문서 변경은 범위 밖이다. target 이 spec 내 문자열 `EiaAiMessageEvent`→`EiaEvent` 로 정정한 것은 `spec/conventions/chat-channel-adapter.md §1.2` 에서 이미 `EiaEvent` 가 canonical 이름으로 확립된 사실을 spec 본문에 반영한 것으로, m-2 의 코드 심볼 삭제와 충돌하지 않는다. `m-2` 는 아직 worktree 미배정(unstarted)이라 경합 위험 없음.
  - 제안: 추적 메모 수준. m-2 착수 시 spec 이 이미 `EiaEvent` 로 정정돼 있음을 확인하면 충분.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보:

1. `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: exit 1(ACTIVE), Step 2: PR #443 MERGED, PR #440 MERGED → **stale** (squash merge)
   - 이 worktree 는 `plan/in-progress/spec-sync-chat-channel-gaps.md` 의 worktree 로 등록돼 있었으나 해당 브랜치는 이미 두 PR(#443, #440)로 머지됨. `spec-sync-chat-channel-gaps.md` frontmatter 의 `worktree: spec-sync-audit` 는 stale 참조.
   - cleanup 권장: `./cleanup-worktree-all.sh --yes --force` 실행 후 `spec-sync-chat-channel-gaps.md` frontmatter `worktree` 필드 정리.

2. `code-node-followups-close` (branch `claude/code-node-followups-close-a30e7c`) — Step 1: exit 1(ACTIVE), Step 2: PR #565 MERGED → **stale**
3. `code-node-followups-finalize` (branch `claude/code-node-followups-finalize-f50a7d`) — Step 1: exit 1(ACTIVE), Step 2: PR #564 MERGED → **stale**

worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석. `15-chat-channel.md` 를 동시에 손대는 active worktree 없음.

---

## 요약

`spec/5-system/15-chat-channel.md` 의 3개 변경 (①§5.4 에러 코드 `401 WORKSPACE_REQUIRED`→`400 WORKSPACE_ID_REQUIRED`, ②R-CC-16 `EiaAiMessageEvent`→`EiaEvent`, ③`botIdentity.teamId` 예제 추가) 은 모두 소유 plan `chat-channel-workspace-code-unify.md` 의 명시적 체크리스트 항목에 대응하며, 미해결 결정을 일방적으로 우회하거나 active worktree 와 경합하는 사항이 없다. `spec-sync-chat-channel-gaps.md` 의 §5.4 열린 항목(성공 응답 3필드)은 target 변경과 독립적인 행이라 충돌 없음. `refactor/03-maintainability.md` `m-2` 의 dead symbol 삭제 계획과 R-CC-16 명칭 정정은 서로 다른 표면(코드 vs spec 문자열)을 다루어 충돌 없음. worktree 충돌 후보 3건은 모두 squash-merged PR 을 가진 stale 브랜치로 판정해 skip 했으며 cleanup 을 권장한다.

---

## 위험도

NONE
