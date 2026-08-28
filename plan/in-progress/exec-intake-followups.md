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
        > ⚠️ **서술 정정 필요 (2026-08-28 `plan-audit`)** — 항목 자체는 **유효**하다.
        > **무엇이 낡았나**: 차단 근거 절반이 사라졌다. "타 in-progress plan(http-ssrf·node-output-redesign)이 error-codes.ts 에 항목 추가 중" 중 http-ssrf 는 두 문서 모두 이미 완료 이동됨(plan/complete/http-ssrf-all-auth.md, plan/complete/http-ssrf-all-auth-followups.md). 게다가 `git log -- codebase/backend/src/nodes/core/error-codes.ts` 최신 커밋은 537c930b0(#693, 2026-06)로 2개월 넘게 무변경 — "지금 재편 시 충돌" 전제를 착수 전 재측정할 것. 남은 in-progress 는 node-output-redesign 뿐이고 error-codes 언급은 그 디렉터리 2파일(text-classifier.md·send-email.md)에 그친다.
        > **실측**: 작업은 미착수: nodes/core/error-codes.ts 단일 파일에 HTTP(:10~)·DB·LLM 노드 코드와 엔진 코드(:73 EXECUTION_TIME_LIMIT_EXCEEDED, EXECUTION_INTERNAL_ERROR 등)가 여전히 혼재. `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 execution-engine.service.ts:2872 하드코딩 문자열.
  - [x] ARCH#6: `execution-limits.ts` 모듈 경계 JSDoc. 완료(2026-07-04).
  - [x] MAINT#9: `system-status.constants.ts` concurrency 파싱 일원화 — continuation 을 canonical `resolveContinuationWorkerConcurrency`(strict) 재사용으로 통일(inline loose `Number()||1` 은 §11 계약과 drift 였음). 완료(2026-07-04). (getter 전환은 스코프 밖 — 두 concurrency 상수는 모듈-로드 1회 평가가 spec 의도.)
> **⚠ 소급 정정 (2026-08-14)** — 아래 "admission 회귀 보강" 이 GREEN 이던 근거는
> `execution-engine.service.spec.ts` 의 admission mock 이 `[{ id: 'eSQL' }]`(INSERT 형태)로
> 세팅돼 있었기 때문이다. **실제 `UPDATE … RETURNING` 은 `[rows, rowCount]` 튜플**이라
> `rows.length === 1` 이 프로덕션에서 영원히 거짓이었고, admission 은 우연히(재큐된 job 을
> RUNNING arm 이 "stalled 재배달" 로 오인해 rehydration) 동작했다.
>
> 즉 **테스트가 검증한 파라미터 순서·cap 매핑은 유효하지만, "admission 이 실제로 승인한다"
> 는 부분은 그 mock 위에서만 참**이었다. `8332d9a20`(2026-08-13)에서 수정.
> 근본 원인: [`update-returning-tuple-shape.md`](./update-returning-tuple-shape.md).

- [x] **admission 회귀 보강 (ai-review testing INFO)** — 완료(2026-07-04). unit(runExecutionFromQueue): admission deferred/cancelled → `runExecution` 미호출(+deferred 만 `releaseExecutionRouting`), admitted → `runExecution(exec,input,true)`. unit(admitExecutionOrDefer): 원자 UPDATE 파라미터 순서·cap 매핑 `[executionId,workspaceId,wsCap,workflowId,wfCap]` + advisory lock 키(workspace 범위). e2e: workspace-level cap 단독 gating(다른 workflow running 이 workspace 슬롯 소비 — 헬퍼 workspace 파라미터화). production 코드 무변경. TEST WORKFLOW: lint·unit(신규 4)·build·e2e(231). ai-review 8-reviewer Critical/Warning 0.
- [x] **orphan pending backstop** — 완료(2026-07-04). `recoverStuckExecutions`(§7.4 부팅+test-hook)에 `recoverOrphanPendingExecutions` 추가 — `status='pending' AND queued_at < now − EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 인 orphan(admission 재큐 job 소실)을 기존 `markQueueWaitTimeout`(멱등)으로 §8 wait-timeout `cancelled` 마감. RUNNING re-drive/PENDING cancel(진행 흔적 유무). early-return 제거로 running 재점유 무관 항상 스캔. 신규 migration/env/에러코드 없음. spec §8/§7.1/§7.4+Rationale+data-flow 반영. TDD 유닛 3+e2e 2, e2e(234). impl-prep 5/5·ai-review 9-reviewer(doc/db WARNING 조치).

## exec-engine 무관 (별도 트랙)

- [x] **(분리·무관) auth Critical 2건** — `spec/5-system/1-auth.md`(초대 에러코드 casing·WebAuthn 응답 포맷). 완료(2026-07-05). **Issue 1(초대 에러코드 casing)**: 재확인 결과 이미 해결됨 — `workspace-invitations.service.ts` 11개 코드 전부 `error-codes.md §3` 에 historical-artifact 예외로 명문화(2026-06-28). 조치 불필요. **Issue 2(WebAuthn 응답 포맷)**: 코드 버그 아니라 spec 텍스트 불일치 — `{data:{items}}` 는 sessions·webauthn 양쪽 백엔드+프런트가 의존하는 load-bearing 계약이나 `1-auth.md:469` 만 bare-array 로 오기. project-planner 트랙으로 spec 을 실제 계약에 맞춤(Option A, non-breaking): 1-auth.md:469 정정 + api-convention §5.2 note/Rationale + swagger.md "유일한 예외"→2사례 정정 + 9-user-profile.md sessions 동기화. consistency-check --spec BLOCK: NO(10_42_09, cross_spec CRITICAL→swagger 동시갱신으로 해소). ~~Follow-up(developer): `webauthn-response.dto.ts:77` stale 주석 정정.~~ **완료 (2026-07-17)**: 해당 주석("credential 목록 응답. SessionListDto 의 이중 중첩 패턴은 피한다.")은 **실재하지 않는 구분을 주장**하고 있었다 — `WebAuthnCredentialListDto` 와 `SessionListDto` 는 둘 다 `{ items: T[] }` 로 **shape 이 동일**하고 같은 인터셉터를 거쳐 `{ data: { items } }` 로 나간다. 즉 webauthn 이 그 패턴을 "피하는" 것이 아니라 **똑같이 따른다**. 주석을 실제 계약(load-bearing `{data:{items}}`, bare array 로 낮추지 않음) + spec cross-ref 로 교체.
