---
worktree: .claude/worktrees/webchat-usewidget-split-5e9d26
started: 2026-06-28
owner: developer
spec_impact: []  # behavior-preserving 리팩터 — spec 변경 없음
---

# Channel Web Chat — B1: useWidget God hook 분리

> 출처: `web-chat-quality-backlog.md §B` 헤드라인. 선행 #737(B+C)·#744(A) 머지 완료 기준.
> **behavior-preserving** — UI/EIA/네트워크 동작 불변, 토큰 갱신·큐 flush 시맨틱 보존.

## 추출 설계
- **`use-token-refresh.ts` → `useTokenRefresh({sessionRef,clientRef,configRef})`**: refreshTimerRef·clearRefreshTimer·
  scheduleRefresh(재귀 재예약·cancelled 가드)·unmount cleanup 캡슐화. 반환 `{scheduleRefresh, clearRefreshTimer}`.
  scheduleRefreshRef(간접 ref) 제거 — scheduleRefresh 가 stable(refs+clearRefreshTimer deps)이라 start()·applyConfig 가 직접 호출.
- **`use-pending-message-queue.ts` → `usePendingMessageQueue({phase,pending,sessionRef,sendCommand,dispatch})`**:
  pendingSendRef·C1 flush effect 캡슐화. 반환 `{enqueue, clearQueue}`. submitMessage else 분기 → enqueue, newChat → clearQueue.
- `SessionRef` = session-store `PersistedSession`(동일 shape) 재사용 — 새 공유 타입 없이 import.

## 작업
- [x] /consistency-check --impl-prep spec/7-channel-web-chat/ → **BLOCK: NO** (`review/consistency/2026/06/28/00_48_37/`, WARNING 3 전부 pre-existing/planner).
- [x] `use-token-refresh.ts` 신설 + 단위 테스트(refreshDelayMs + fake timer: refresh 발화·재예약·clear·cancelled·no-session).
- [x] `use-pending-message-queue.ts` 신설 + 단위 테스트(enqueue→flush / buttons 폐기 / clearQueue / no-session).
- [x] `use-widget.ts`: 두 hook 채택, scheduleRefreshRef·인라인 scheduleRefresh·refreshTimerRef·pendingSendRef·flush effect 제거. SessionRef=PersistedSession. refresh 헬퍼 re-export 하위호환.
- [x] 기존 테스트(use-widget-eager-start·commands·state·panel) 전부 green 유지 — **243 tests green**(동작 불변 검증).
- [x] TEST WORKFLOW — lint·unit(243)·build PASS. **e2e = 환경 차단**(docker registry DeadlineExceeded: flyway/node 이미지 pull timeout, 2회 재시도 동일. 프론트 전용 변경이라 backend e2e 무관).
- [ ] /ai-review + Critical/Warning 0.
- [ ] /consistency-check --impl-done spec/7-channel-web-chat/ → BLOCK: NO.
