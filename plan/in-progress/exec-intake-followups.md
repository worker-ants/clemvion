---
worktree: exec-intake-plan-complete-877df0
started: 2026-07-04
owner: developer
---

# 후속 — exec-intake 큐 (PR1~PR4·PR2b 완료 후 잔여)

exec-intake 큐 백로그(`exec-intake-queue-impl.md`, PR1~PR4 + PR2b)는 **완료·complete 이동**됨. 본 plan 은 그 과정에서 명시적으로 **후속 분리**된 잔여 항목만 추적한다. 각 항목은 독립 착수 가능.

## PR2b 후속 (#801 RESOLUTION 기록)

- [x] **priority 3-tier (webhook/schedule 세분화)** — 완료(2026-07-04). `ExecuteOptions.triggerType`(`ExecutionRunTriggerType`) 신설 + execute() 가 `executedBy` 우선 판정(미전달 트리거는 webhook fallback) → `resolveExecutionRunPriority(triggerType)`. 호출부 threading: hooks(webhook/chat-channel)·schedule-runner(schedule). spec §4.3/§8/§9.3 + data-flow 3·10 3-tier 반영. TDD unit + e2e(230), 10-reviewer ai-review(Critical/Warning 0, doc/comment WARNING fix 반영).
- [x] **workflow-level cap validated write DTO** — 완료(2026-07-04). `WorkflowSettingsDto`(`@IsOptional @IsInt @Min(1) maxConcurrentExecutions`) 신설, `UpdateWorkflowDto.settings` opaque `@IsObject Record` → `@ValidateNested @Type(() => WorkflowSettingsDto)`. 전역 pipe(whitelist+forbidNonWhitelisted)로 미지 settings 키·비양수·비정수 → 400 (§2.4 가 이미 settings 를 이 키로 스코프 → 계약 정합). service.update 는 settings spread-merge(DB 잔여 키 보존, workspace 대칭). TDD DTO 검증 9 + service merge 3 + e2e 검증 게이트. CHANGELOG 등재. impl-prep 5/5·impl-done 5/5 BLOCK:NO·ai-review 8-reviewer Critical/Warning 0. 후속(별도): ImportWorkflowDto.settings opaque 비대칭.
- [ ] **곁들임 INFO 리팩터 묶음** (ai-review 누적):
  - [x] ARCH#4: `resolveExecutionRunWorkerConcurrency` 를 `execution-run.queue.ts` → `execution-limits.ts` 로 이관(동시성 한도 로직 응집). 완료(2026-07-04).
  - [ ] ARCH#5: `error-codes.ts` 엔진 레벨 에러코드 레이어 분리(노드 핸들러 코드와 혼재 정리; `EXECUTION_QUEUE_WAIT_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED` 등). **별도 후속** — 공용 `ErrorCode` 재편+하드코딩 문자열 enum 편입+소비처 리다이렉트로 blast radius 큼. 타 in-progress plan(http-ssrf·node-output-redesign)이 error-codes.ts 에 항목 추가 중이라 지금 재편 시 충돌 → 그 PR 들 정착 후 착수.
  - [x] ARCH#6: `execution-limits.ts` 모듈 경계 JSDoc. 완료(2026-07-04).
  - [x] MAINT#9: `system-status.constants.ts` concurrency 파싱 일원화 — continuation 을 canonical `resolveContinuationWorkerConcurrency`(strict) 재사용으로 통일(inline loose `Number()||1` 은 §11 계약과 drift 였음). 완료(2026-07-04). (getter 전환은 스코프 밖 — 두 concurrency 상수는 모듈-로드 1회 평가가 spec 의도.)
- [x] **admission 회귀 보강 (ai-review testing INFO)** — 완료(2026-07-04). unit(runExecutionFromQueue): admission deferred/cancelled → `runExecution` 미호출(+deferred 만 `releaseExecutionRouting`), admitted → `runExecution(exec,input,true)`. unit(admitExecutionOrDefer): 원자 UPDATE 파라미터 순서·cap 매핑 `[executionId,workspaceId,wsCap,workflowId,wfCap]` + advisory lock 키(workspace 범위). e2e: workspace-level cap 단독 gating(다른 workflow running 이 workspace 슬롯 소비 — 헬퍼 workspace 파라미터화). production 코드 무변경. TEST WORKFLOW: lint·unit(신규 4)·build·e2e(231). ai-review 8-reviewer Critical/Warning 0.
- [x] **orphan pending backstop** — 완료(2026-07-04). `recoverStuckExecutions`(§7.4 부팅+test-hook)에 `recoverOrphanPendingExecutions` 추가 — `status='pending' AND queued_at < now − EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 인 orphan(admission 재큐 job 소실)을 기존 `markQueueWaitTimeout`(멱등)으로 §8 wait-timeout `cancelled` 마감. RUNNING re-drive/PENDING cancel(진행 흔적 유무). early-return 제거로 running 재점유 무관 항상 스캔. 신규 migration/env/에러코드 없음. spec §8/§7.1/§7.4+Rationale+data-flow 반영. TDD 유닛 3+e2e 2, e2e(234). impl-prep 5/5·ai-review 9-reviewer(doc/db WARNING 조치).

## exec-engine 무관 (별도 트랙)

- [x] **(분리·무관) auth Critical 2건** — `spec/5-system/1-auth.md`(초대 에러코드 casing·WebAuthn 응답 포맷). 완료(2026-07-05). **Issue 1(초대 에러코드 casing)**: 재확인 결과 이미 해결됨 — `workspace-invitations.service.ts` 11개 코드 전부 `error-codes.md §3` 에 historical-artifact 예외로 명문화(2026-06-28). 조치 불필요. **Issue 2(WebAuthn 응답 포맷)**: 코드 버그 아니라 spec 텍스트 불일치 — `{data:{items}}` 는 sessions·webauthn 양쪽 백엔드+프런트가 의존하는 load-bearing 계약이나 `1-auth.md:469` 만 bare-array 로 오기. project-planner 트랙으로 spec 을 실제 계약에 맞춤(Option A, non-breaking): 1-auth.md:469 정정 + api-convention §5.2 note/Rationale + swagger.md "유일한 예외"→2사례 정정 + 9-user-profile.md sessions 동기화. consistency-check --spec BLOCK: NO(10_42_09, cross_spec CRITICAL→swagger 동시갱신으로 해소). Follow-up(developer): `webauthn-response.dto.ts:77` stale 주석 정정.
