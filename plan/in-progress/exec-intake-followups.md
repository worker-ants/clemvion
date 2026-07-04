---
worktree: exec-intake-plan-complete-877df0
started: 2026-07-04
owner: developer
---

# 후속 — exec-intake 큐 (PR1~PR4·PR2b 완료 후 잔여)

exec-intake 큐 백로그(`exec-intake-queue-impl.md`, PR1~PR4 + PR2b)는 **완료·complete 이동**됨. 본 plan 은 그 과정에서 명시적으로 **후속 분리**된 잔여 항목만 추적한다. 각 항목은 독립 착수 가능.

## PR2b 후속 (#801 RESOLUTION 기록)

- [x] **priority 3-tier (webhook/schedule 세분화)** — 완료(2026-07-04). `ExecuteOptions.triggerType`(`ExecutionRunTriggerType`) 신설 + execute() 가 `executedBy` 우선 판정(미전달 트리거는 webhook fallback) → `resolveExecutionRunPriority(triggerType)`. 호출부 threading: hooks(webhook/chat-channel)·schedule-runner(schedule). spec §4.3/§8/§9.3 + data-flow 3·10 3-tier 반영. TDD unit + e2e(230), 10-reviewer ai-review(Critical/Warning 0, doc/comment WARNING fix 반영).
- [ ] **workflow-level cap validated write DTO** — `Workflow.settings.maxConcurrentExecutions` 는 현재 `PATCH /api/workflows/:id` 의 unvalidated `settings` Record 로 저장(admission 의 `resolveConcurrencyCap` 이 양의 정수만 채택하는 방어로 hard-break 없음). Workspace 는 이미 validated DTO(`@IsInt @Min(1)`) 제공 — workflow 도 nested validated DTO 로 대칭화(spec §8 "Editor+ validated write" 정합).
- [ ] **곁들임 INFO 리팩터 묶음** (ai-review 누적):
  - ARCH#4: `resolveExecutionRunWorkerConcurrency` 를 `execution-run.queue.ts` → `execution-limits.ts` 로 이관(동시성 한도 로직 응집).
  - ARCH#5: `error-codes.ts` 엔진 레벨 에러코드 레이어 분리(노드 핸들러 코드와 혼재 정리; `EXECUTION_QUEUE_WAIT_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED` 등).
  - ARCH#6: `execution-limits.ts` 모듈 경계 JSDoc.
  - MAINT#9: `system-status.constants.ts` concurrency 파싱 일원화(getter 패턴, `16-system-status-api.md §3` 정합).
- [ ] **admission 회귀 보강 (ai-review testing INFO)** — deferred/cancelled 시 `releaseExecutionRouting`·`runExecution` 미호출 통합 유닛, workspace-cap 초과 e2e 시나리오, admission raw SQL 파라미터 순서 assert. (원자성·기능은 unit+e2e 로 실증됨 — 회귀 방지 보강 성격.)
- [ ] **orphan pending backstop** — job 소실(Redis 비영속 등)로 admission 재큐 job 이 사라진 pending 회수. `recoverStuckExecutions`(§7.4)는 stale `running` 만 스캔 — `pending AND queued_at stale` 확장 검토(낮은 확률 엣지, best-effort). spec §8 명시.

## exec-engine 무관 (별도 트랙)

- [ ] **(분리·무관) auth Critical 2건** — `spec/5-system/1-auth.md`(초대 에러코드 casing·WebAuthn 응답 포맷). exec-intake `--impl-prep spec/5-system/` 광범위 scope 가 걸러낸 **기존 auth spec 이슈**로 execution-engine 과 무관. project-planner 트랙으로 위임(본 exec-intake 후속과 별개).
