---
worktree: .claude/worktrees/fix-resume-worker-full-detach-19de68
branch: claude/fix-resume-worker-full-detach-19de68
status: in-progress
---

# continuation worker deadlock — full detach (PR #399 후속)

## 배경
PR #399 는 slow-path resume 의 **그래프 구동(waitForX 이후)** 만 detach 했다.
배포 후에도 운영에서 버튼 클릭 무응답 지속.

## 운영 로그 진단 (재발)
- `[ai_message] pick up` → `Rehydration start (ai_agent)` (slow path, 텔레그램).
- AI 턴 처리(LLM ~20s) → 응답 전송 → `waiting_for_input (seq=7)`.
- 이후 continuation pickup 없음 → 워커가 `await waitForAiConversation` 에서
  **다음 메시지를 기다리며 점유**.

## 근본 원인 (PR #399 가 못 잡은 잔여)
slow-path 의 `await waitForX` **자체**가 worker(process()) 안에서 블로킹.
특히 `waitForAiConversation` 은 `while (!conversationEnded)` 멀티턴 루프로
**대화 종료까지 다음 메시지를 차례로 await** → concurrency=1 worker 가 대화
수명 내내 점유 → 버튼 클릭 등 모든 continuation 이 wait 큐 적체.
PR #399 는 waitForX **이후** graph 만 detach 해 buttons/form(단일 상호작용 후
반환)에는 부분 효과였으나, ai_agent(장수 루프)에는 무효.

fast-path(runExecution 백그라운드 코루틴이 waitForX 루프 구동)는 worker 비점유.
slow-path 도 동일해야 함.

## 수정 (full detach)
worker 는 setup(graph load + invariant 검증)까지만 await. **전체 resume 구동
(updateStatus RUNNING + waitForX + 그래프 순회 + 종결)을 `driveResumeDetached`
로 detach**, 즉시 반환.
- `resumeFromCheckpoint`: setup 후 `driveResumeDetached(...).catch()` launch.
- `driveResumeDetached`: 옛 waitForX dispatch + 옛 driveGraphAfterResume 통합 +
  RehydrationError(unsupported/ai 재구성 실패) graceful 처리(markExecutionCancelled
  + node failed → 텔레그램 "세션 만료" 안내 도달, #398 routing 보존).
- firePayload: phase1Settled 제거 → 순수 single-shot (후속 turn 은 새 continuation
  job 으로 fast-path).
- PR #399 의 partial detach(driveGraphAfterResume) 를 본 full detach 가 대체.

## 회귀 테스트
- buttons: waitForX + graph 구동 detach — rehydrateAndResume 즉시 반환.
- **ai_agent: waitForAiConversation 영구 미반환(진행 중 대화)이어도 worker 반환**
  (운영 실측 버그 직접 가드).
- Phase 2.7 통합 테스트: full detach 로 완료가 백그라운드 진행 → real-timer polling
  으로 완료 대기하도록 갱신.

## 체크리스트
- [x] 운영 로그 재진단 (ai_agent waitForAiConversation 점유)
- [x] full detach 구현 (driveResumeDetached)
- [x] 회귀 테스트 (buttons + ai_agent) + Phase 2.7 갱신
- [x] lint(0err)/unit(240)/build 통과
- [ ] e2e
- [ ] /ai-review + fix + RESOLUTION.md

## 후속 (선택)
- continuation worker concurrency 상향(현재 1) — full detach 로 process() 가 빨라져
  필수 아님. 대량 동시 resume 의 setup(rehydrateContext/loadAndBuildGraph) 직렬화
  latency 가 문제되면 검토.
