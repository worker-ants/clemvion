---
worktree: .claude/worktrees/webchat-widget-refactor-ff484f
started: 2026-06-27
owner: developer
spec_impact: []  # behavior-preserving 리팩터 — spec 변경 없음
---

# Channel Web Chat — 위젯 리팩터(B) + 테스트 보강(C)

> 출처: `plan/in-progress/web-chat-quality-backlog.md` §B·§C. D(spec polish)는 PR #732 로 종결.
> 본 PR 은 **behavior-preserving** 리팩터 + 테스트 보강만 (UI/EIA surface 변경 없음).

## 범위 결정 (scoping)

§B 의 헤드라인인 **B1(useWidget God hook 분리 → useTokenRefresh/usePendingMessageQueue)** 은
542-line hook 의 ref·effect·cancellation 시맨틱을 재구성하는 **가장 크고 회귀 위험이 높은** 항목이라
**별도 후속 PR 로 분리**(focused review 확보). 본 PR 은 나머지 안전한 helper 추출 + 테스트 보강.

## 작업 (이 PR)
- [x] B2/B5: `isTextInputSurface(pending)` 헬퍼 추출(widget-state.ts) — 텍스트표면 판정 3중 중복 제거
      (use-widget submitMessage·flush effect, panel.tsx composer disabled). composer 는 denylist→allowlist 전환.
- [x] B6: SSE terminal 이벤트명 배열(`TERMINAL_EVENTS`) 파생 — handleEiaEvent 문자열 3중 비교 제거.
- [x] B3: `clearRefreshTimer` + `teardownSession` 헬퍼 추출 — handleEiaEvent 종료분기·newChat·mount cleanup 중복 제거.
- [x] B4: `start()` check-then-set — 현 코드가 이미 check-then-set(startedRef 가드 + 첫 await 이전 set). 확인·유지(변경 없음).
- [x] C: 테스트 보강 — ended Composer 미렌더(panel) · C1 buttons/form 폐기(hook) · ended 재open reducer ·
      ERROR→ended reducer 강화 · 토큰 refresh fake-timer 결정적 테스트. (channel-web-chat 225 tests green)
- [x] TEST WORKFLOW (lint·unit·build·e2e) — 전부 PASS (e2e 218 passed).
- [x] /ai-review (--branch main) — RISK=LOW, Critical/Warning 0. INFO 자율반영(helper 단위테스트·주석·backlog). `review/code/2026/06/27/22_08_42/` (SUMMARY+RESOLUTION).
- [x] (spec 연결 코드 변경) /consistency-check --impl-done spec/7-channel-web-chat/ BLOCK: NO. `review/consistency/2026/06/27/22_09_19/`.

## 후속 (별도 PR)
- [x] B1: `useWidget` God hook 분리 → `useTokenRefresh` / `usePendingMessageQueue`. — PR `webchat-usewidget-split`.
- [x] A: per_execution 토큰 localStorage→sessionStorage + start() 에러메시지 일반화. — PR #744.
