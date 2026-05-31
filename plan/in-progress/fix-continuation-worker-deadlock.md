---
worktree: .claude/worktrees/fix-continuation-worker-deadlock-5fa7f7
branch: claude/fix-continuation-worker-deadlock-5fa7f7
status: in-progress
---

# continuation worker deadlock 수정 (slow-path resume detach)

## 증상 (운영)
워크플로우 수동 실행 → presentation(carousel) 버튼 클릭 → UI 만 비활성, 무응답.
WS: `click_button.ack { queued:true, resumed:true }` 이후 `node.completed`/`execution.resumed` 없음.
운영 Redis: `bull:execution-continuation:wait` 에 클릭 job 9건 적체 + `active`=1 (워커가 1건에 물려 영구 점유).

## 근본 원인
`ExecutionEngineService.resumeFromCheckpoint` (slow-path rehydration, BullMQ
continuation worker 의 `process()` 안에서 실행) 가 현재 대기 노드 재개 후
`await this.runNodeDispatchLoop(...)` 로 **남은 그래프 전체를 동기 await**.
그래프에 다음 대기 노드(presentation/form/ai_conversation)가 있으면 그 노드에서
무한 대기 → `WorkerHost` concurrency=1 슬롯 영구 점유 → 이후 모든 continuation
job 이 wait 큐에 적체 (deadlock).

fast-path(`runExecution` 백그라운드 코루틴이 그래프 구동)는 worker 를 안 막지만
slow-path 는 막는 비대칭이 결함. PR #321 Phase 2.3a durable-continuation 재구조화
회귀. 단일 인스턴스(로컬)는 fast-path 라 안 보이고, 멀티 인스턴스(운영)는 slow-path
가 흔해 발현. spec §7.4/§7.5 "이후 그래프 순회를 평소대로 진행" = 백그라운드 진행
(worker 점유 아님) 이므로 **spec 변경 불필요 — 구현 버그픽스**.

## 수정
- `resumeFromCheckpoint` 를 Phase 1(현재 노드 입력 전달, worker 가 await) / Phase 2
  (그래프 순회+종결, **detach**) 로 분리.
- Phase 2 → 신규 `driveGraphAfterResume` 로 추출, `void ...catch()` 로 fire-and-forget.
  worker `process()` 는 Phase 1 까지만 await 후 반환 → 슬롯 즉시 해제.
- 단말 처리/cleanup 공통화: `finalizeResumedExecutionOutcome`(cancelled/failed),
  `finalizeRehydrationCleanup`(pendingContinuations/context/cache).
- detach 후에도 다음 대기 노드는 DB `waiting_for_input` 으로 남아 다음 입력이 다시
  rehydrate → 안전(멱등 가드 NodeExecution.status 유지).

## 회귀 테스트
`execution-engine.service.spec.ts` §7.5 블록: Phase 2(`runNodeDispatchLoop`)가 영구
미완료(unresolved promise)여도 `rehydrateAndResume` 가 resolve 됨을 검증. 수정 전이면
hang → jest 타임아웃 실패.

## 체크리스트
- [x] 근본 원인 진단 (운영 로그 + Redis 큐 확인)
- [x] resumeFromCheckpoint Phase 1/2 분리 + detach 구현
- [x] 회귀 테스트 추가
- [x] /ai-review (4 reviewer, Critical 0) + Warning fix(A 로그·B firePayload 가드·C 테스트 timeout) + RESOLUTION.md
- [~] TEST WORKFLOW — lint(변경파일 0err)/unit(235)/build 통과, e2e 진행 중
- [ ] 운영 임시 완화 안내 (큐 정리 + 재기동; 코드 배포 전까지 multi-step interactive 회피)

## 후속 항목 (별도 PR — 본 PR 범위 밖)
- `updateExecutionStatus(RUNNING)` 성공 후 RehydrationError → Execution `RUNNING` 고착
  (markExecutionCancelled 가드가 WAITING_FOR_INPUT 만 매칭). **pre-existing**, deadlock 과 직교.
  markExecutionCancelled 가드를 RUNNING 도 포함하도록 확장 검토 (타 caller 영향 주의).
- form / ai_agent 경로 deadlock-prevention 테스트 (현재 buttons 만; 셋 다 동일 split 코드 공유).
- Phase 2 실패→FAILED / COMPLETED emit 단위 assertion 보강.
- 멀티 인스턴스 double-drive: NodeExecution.status optimistic lock 강화 (pre-existing).

## 운영 메모
- 임시 완화: 백엔드 중지 → `bull:execution-continuation:*` 키 정리 → 재기동.
  코드 배포 전까지 다단계 인터랙티브 워크플로우는 재 wedge 가능.
