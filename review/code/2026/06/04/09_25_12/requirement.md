# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [SPEC-DRIFT] [WARNING] §9.3 BullMQ 큐 목록에 `execution-run` 미등재
- 위치: `spec/5-system/4-execution-engine.md` §9.3 (line 981–986)
- 상세: 코드에서 새 `execution-run` 큐를 추가했으나, spec §9.3 "BullMQ 큐 목록" 표에는 `execution-continuation`·`background-execution` 두 항목만 있다. 해당 절 하단 NOTE(line 986)는 여전히 "별도 `task-queue` 는 존재하지 않는다" 는 구 문구만 남아 있고 `execution-run` 행 자체가 없다. 코드 구현은 의도적이고 명백히 옳다(spec-draft-exec-intake-queue.md §후속 목록에 "§9.3 큐 목록에 `execution-run` 행" 명시).
- 제안: 코드 유지 + spec 갱신. `spec/5-system/4-execution-engine.md §9.3` 큐 목록 표에 `execution-run` 행 추가 (jobId=executionId·attempts=1·역할="실행 시작 intake / work-stealing 첫 active 세그먼트"). §9.3 하단 NOTE의 "별도 `task-queue` 는 존재하지 않는다" 표현도 "실행 시작 intake 는 `execution-run` 큐로 분산, per-node task-queue 는 없음" 으로 정정 필요. 담당: spec-draft-exec-intake-queue.md §후속 항목에서 이미 명시됨 → project-planner 반영 대상.

### [SPEC-DRIFT] [WARNING] §11 Graceful Shutdown ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 미등재
- 위치: `spec/5-system/4-execution-engine.md` §11 (line 1077–1081)
- 상세: §11 ENV 표에는 `SIGTERM_GRACE_MS`·`RESUME_BULLMQ_ATTEMPTS`·`CONTINUATION_WORKER_CONCURRENCY` 3개만 있다. 코드가 추가한 `EXECUTION_RUN_WORKER_CONCURRENCY` (기본값 1, 비양수·비정수·비숫자 fallback)는 동 표에 없다. `.env.example`·`execution-run.queue.ts` 주석에서 spec §11 을 SoT 로 인용하나, spec 본문에 행이 없어 불일치.
- 제안: 코드 유지 + spec 갱신. `spec/5-system/4-execution-engine.md §11` ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY | 1 | execution-run intake worker 인스턴스당 동시 처리 active 세그먼트 수 (§4.3)` 행 추가. spec-draft-exec-intake-queue.md §후속 목록에 이미 명시된 항목.

### [SPEC-DRIFT] [WARNING] §4.1–4.3 "미구현(Planned)" banner 가 여전히 구 per-node 모델을 기술
- 위치: `spec/5-system/4-execution-engine.md` §4 (line 348–390)
- 상세: §4 배너(line 348)는 여전히 "§4.1~4.3 은 미구현(Planned)" 이며 §4.1–4.3 본문은 per-node task queue(1 Worker = 1 NodeExecution, `taskId`/`nodeId`/`nodeType`/`timeout`/`retryCount` 태스크 JSON) 아키텍처를 기술한다. 코드는 execution-level intake 큐로 per-node 모델을 폐기하고 구현을 완료했다. 코드 구현은 의도적이며 spec-draft-exec-intake-queue.md 에서 사용자 확정 완료.
- 제안: 코드 유지 + spec 갱신. §4 배너를 "PR1 구현됨" 으로 갱신하고 §4.1–4.3 본문을 spec-draft-exec-intake-queue.md §1 의 내용(execution-level intake 큐, 세그먼트 모델, 수평 확장 표, ENV 포함)으로 교체. 담당: spec-draft-exec-intake-queue.md §1 이 본문 draft 를 이미 제공함 → project-planner 반영 대상.

### [INFO] spec §4.3 draft 에 `triggerType` 필드가 job payload 에 명시되나 코드는 미포함
- 위치: `spec-draft-exec-intake-queue.md §4.2` job 메시지 JSON (line 46–53), `execution-run.queue.ts` line 117–120
- 상세: spec draft 의 `execution-run` job 메시지 형식에는 `triggerType` 필드가 포함돼 있다(`"triggerType": "webhook"`). 구현된 `ExecutionRunJob` 인터페이스는 `executionId`·`input` 만 가지며 `triggerType` 를 싣지 않는다. plan(`exec-intake-queue-impl.md` line 32)에서 "webhook/schedule 세부 3-tier 는 ExecuteOptions 가 trigger type 미보유 → 후속" 으로 명시적으로 의도한 미구현이다. spec draft 가 아직 spec 본문에 반영 전이므로 권위 spec 이 존재하지 않는 영역이며, 코드도 의도적이다.
- 제안: 코드 유지. spec draft §4.2 job 메시지 형식을 spec 본문 반영 시 PR1 실제 구현(triggerType 없음, 후속 PR 에서 추가)에 맞게 조정하거나, `triggerType` 를 optional 로 명시. 담당: project-planner.

### [INFO] `chatChannel.conversationKey` 빈 문자열 엣지케이스 테스트 제거
- 위치: `execution-engine.service.spec.ts` diff — 이전 코드에 있던 `chatChannel.conversationKey 가 빈 문자열이면 chatChannel 등록 제외` 테스트 케이스가 제거됨
- 상세: 이전 `execute()` 기반 테스트에서 `conversationKey = ''` 케이스를 테스트하던 것이 PR1 리팩터링으로 삭제되고, 새 `runExecutionFromQueue` describe 블록에 동등 케이스가 추가되지 않았다. `extractChatChannelFromInput` 의 경계값 검증(`provider` 또는 `conversationKey` 비어있으면 통과 안 함)이 `provider=''` 케이스만 커버되고 `conversationKey=''` 케이스는 미커버.
- 제안: `runExecutionFromQueue — routing context 재등록` describe 블록에 `chatChannel.conversationKey 가 빈 문자열이면 chatChannel 등록 제외` 케이스 추가 권장. 기존 동작의 regression guard 로서 낮은 비용으로 추가 가능.

---

## 요약

PR1(execution-run intake 큐) 구현은 spec-draft-exec-intake-queue.md 의 설계 의도와 exec-intake-queue-impl.md 의 PR1 범위를 충실히 구현하고 있다. `execute()` 의 fire-and-forget in-process 호출을 BullMQ `execution-run` 큐 enqueue 로 교체하고, `ExecutionRunProcessor` + `runExecutionFromQueue` 진입점을 통해 work-stealing 분산 처리, routing context 의 consumer 측 재등록, PENDING 재검증(멱등성), setup 실패 시 routing release 까지 일관되게 구현했다. 테스트 스위트도 인라인 worker 브릿지 패턴으로 기존 execute() 계약을 보존하면서 새 진입점 격리 테스트를 추가해 커버리지를 유지한다. 주요 요구사항(즉시 executionId 반환, PENDING 상태 저장, enqueue 후 반환, priority 3-tier 첫 단계, attempts:1 + maxStalledCount:0 비멱등 보호) 모두 충족된다. 발견된 이슈는 전부 코드가 옳고 spec 본문이 아직 갱신되지 않은 SPEC-DRIFT 로, 코드 수정이 아닌 spec 반영이 필요하다. `chatChannel.conversationKey=''` 엣지케이스 테스트 누락은 minor INFO 수준이다.

## 위험도

LOW

---
STATUS: SUCCESS
