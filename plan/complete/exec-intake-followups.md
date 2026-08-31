---
worktree: exec-intake-plan-complete-877df0
started: 2026-07-04
owner: developer
status: complete
spec_impact: none
---

# 후속 — exec-intake 큐 (PR1~PR4·PR2b 완료 후 잔여)

exec-intake 큐 백로그(`exec-intake-queue-impl.md`, PR1~PR4 + PR2b)는 **완료·complete 이동**됨. 본 plan 은 그 과정에서 명시적으로 **후속 분리**된 잔여 항목만 추적한다. 각 항목은 독립 착수 가능.

## PR2b 후속 (#801 RESOLUTION 기록)

- [x] **priority 3-tier (webhook/schedule 세분화)** — 완료(2026-07-04). `ExecuteOptions.triggerType`(`ExecutionRunTriggerType`) 신설 + execute() 가 `executedBy` 우선 판정(미전달 트리거는 webhook fallback) → `resolveExecutionRunPriority(triggerType)`. 호출부 threading: hooks(webhook/chat-channel)·schedule-runner(schedule). spec §4.3/§8/§9.3 + data-flow 3·10 3-tier 반영. TDD unit + e2e(230), 10-reviewer ai-review(Critical/Warning 0, doc/comment WARNING fix 반영).
- [x] **workflow-level cap validated write DTO** — 완료(2026-07-04). `WorkflowSettingsDto`(`@IsOptional @IsInt @Min(1) maxConcurrentExecutions`) 신설, `UpdateWorkflowDto.settings` opaque `@IsObject Record` → `@ValidateNested @Type(() => WorkflowSettingsDto)`. 전역 pipe(whitelist+forbidNonWhitelisted)로 미지 settings 키·비양수·비정수 → 400 (§2.4 가 이미 settings 를 이 키로 스코프 → 계약 정합). service.update 는 settings spread-merge(DB 잔여 키 보존, workspace 대칭). TDD DTO 검증 9 + service merge 3 + e2e 검증 게이트. CHANGELOG 등재. impl-prep 5/5·impl-done 5/5 BLOCK:NO·ai-review 8-reviewer Critical/Warning 0. 후속(별도): ImportWorkflowDto.settings opaque 비대칭.
- [x] **곁들임 INFO 리팩터 묶음** (ai-review 누적):
  - [x] ARCH#4: `resolveExecutionRunWorkerConcurrency` 를 `execution-run.queue.ts` → `execution-limits.ts` 로 이관(동시성 한도 로직 응집). 완료(2026-07-04).
  - [x] ARCH#5: `error-codes.ts` 엔진 레벨 에러코드 레이어 분리(노드 핸들러 코드와 혼재 정리; `EXECUTION_QUEUE_WAIT_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED` 등). **별도 후속** — 공용 `ErrorCode` 재편+하드코딩 문자열 enum 편입+소비처 리다이렉트로 blast radius 큼.

        > **완료 (2026-08-31). 단 "파일 분리" 는 하지 않았다 — 측정이 그 처방을 반증했다.**
        >
        > **① "노드 핸들러 코드와 혼재" 는 과장이었다.** 저장소 전체에서 `code:` 리터럴
        > **201개**가 `ErrorCode` 밖에 있는데, 그 대다수(`ACCOUNT_LOCKED`·`WORKSPACE_NOT_FOUND`·
        > `TOTP_INVALID`…)는 **API 예외 코드**로 애초에 이 enum 소관이 아니다 — enum docstring
        > 이 스스로 범위를 *"node handlers' `output.error.code`"* 로 못박고 있다.
        >
        > **② 파일 분리는 그 파일이 명시한 원칙과 충돌한다.** 같은 파일이 WS ack 용 `RETRY_*`
        > 를 두면서 *"canonical code strings 는 **one source of truth**"* 라고 근거를 적어
        > 뒀다. 나누면 SoT 가 둘이 된다. 그래서 **파일은 하나, const 는 둘** — `EngineErrorCode`
        > 를 신설해 레이어는 타입에 드러내고 SoT 는 유지했다.
        >
        > **③ 진짜 결함은 다른 것이었다 — 엔진 레이어가 반만 들어와 있었다.** 넷이 상수도
        > 타입도 없는 **맨 문자열**이었다(5지점). DB 에 영속되고 FE·알림이 값으로 분기하는데
        > **오탈자를 잡는 것이 아무것도 없었다**:
        >
        > | 코드 | 위치 | 형태 |
        > |---|---|---|
        > | `EXECUTION_QUEUE_WAIT_TIMEOUT` | `execution-engine.service.ts` | `const code = '…'` |
        > | `WEBCHAT_IDLE_TIMEOUT` | `execution-engine.service.ts` | `const code = '…'` |
        > | `WORKER_HEARTBEAT_TIMEOUT` | `execution-engine.service.ts` | `code: '…'` |
        > | `SERVER_INTERRUPTED` | `shutdown-state.service.ts` | `code: '…'` ×2 |
        >
        > 여기에 `ai-turn-orchestrator.service.ts` 의 `LLM_*` 4지점(값은 enum 에 있는데 상수를
        > 안 거침)을 더해 **총 9지점**을 리다이렉트했다.
        >
        > **④ 옮기지 않은 것과 그 이유 — 세 카테고리.**
        > (a) `INVALID_EXECUTION_STATE`·`ERROR_PORT_FALLBACK` (에러 클래스 `readonly code`)
        > (b) trigger 파라미터 검증 4종 (`TriggerParameterErrorDetail['code']` 유니온,
        > 규약 §4.2 의 `details[].code` 레이어)
        > (c) `RESUME_CHECKPOINT_MISSING`·`RESUME_INCOMPATIBLE_STATE`
        > (`RehydrationError.code` 리터럴 유니온, **생성자 positional 인자** — 리뷰 2R 이
        > 드러낸 형태). `RESUME_FAILED` 는 일반 메서드 인자로만 쓰여 가드 스캔 표면 밖이라
        > 예외 목록에 두지 않았다.
        >
        > 셋 다 **이미 타입 앵커가 있다.** 상수로 또 옮기면 앵커가 둘이 되어 갈라진다. 가드의
        > `ANCHORED_ELSEWHERE` 에 **사유와 함께** 등재했다.
        >
        > > **이 문단이 세 번째로 고쳐졌다 (리뷰 4R).** 같은 사실이 `error-codes.ts` JSDoc ·
        > > `CHANGELOG.md` · 이 plan 세 곳에 있는데, 2R fix 를 3R 에서 앞의 둘에만 반영하고
        > > 여기를 빠뜨렸다. **미러가 셋이면 셋을 다 세야 한다** — 지적받은 자리만 고치면
        > > 남은 자리가 다음 라운드에 그대로 나온다(실제로 그렇게 됐다).
        >
        > **⑤ 2026-06-14 "중앙 enum 확장" 결정과의 관계** (consistency `21_34_02`
        > `rationale_continuity` WARNING 반영 — 지어내지 않고 정확히).
        >
        > `4-execution-engine.md` §Rationale 에 사용자 확정 결정이 있다 — *"신규 `EXEC_*`
        > prefix 를 만들지 않고 중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 확장. `EXEC_*` 는
        > 기존 `EXECUTION_*` 과 **이중 표기**라 기각."*
        >
        > - **기각된 것은 값 레벨 prefix 다.** 사유가 "이중 표기" 이므로 대상은 **코드
        >   문자열**이다. 이 변경은 값을 한 글자도 바꾸지 않았다 — 새 prefix 도 이중 표기도
        >   생기지 않았으므로 그 결정의 **문면은 건드리지 않는다**.
        > - **그러나 형태는 선례와 어긋난다.** `ErrorCode` 의 `RETRY_*` 는 주석이 스스로
        >   *"노드 `output.error.code` 가 아니다"* 라고 적으면서도 *"canonical code strings 는
        >   one source of truth"* 를 이유로 **같은 enum 안에** 남았다. 즉 이 저장소의 선례는
        >   "레이어가 달라도 한 enum" 이고, 나는 **자매 const** 를 택했다.
        > - **왜 그래도 이렇게 했나**: 선례가 지키려던 것은 *"canonical string 의 SoT 가
        >   하나"* 이고 그건 **같은 파일**이면 유지된다(그래서 파일을 나누지 않았다). 그 위에서
        >   `ErrorCode` 의 자기 선언 범위(*node handlers' `output.error.code`*)를 넓히지
        >   않으려면 자매 const 가 필요했다.
        > - **다만 이 논리는 `RETRY_*` 에도 똑같이 적용될 수 있었고 그때는 채택되지 않았다.**
        >   즉 중립적 선택이 아니라 **형태의 의식적 이탈**이다. 그렇게 적어 둔다 — 다음 사람이
        >   "언제 central enum 을 확장하고 언제 자매 const 를 만드는가" 를 판단할 때, 내
        >   근거가 선례를 이겼다고 읽지 않도록.
        > - **되돌리는 비용은 낮다**: 엄격히 선례를 따르려면 넷을 `ErrorCode` 로 옮기면 되고
        >   **값은 움직이지 않는다**.
        >
        > ⚠️ 완화 요인도 적어 둔다 — 그 결정의 표제는 *"Continuation ack client-safe typed
        > error"* 로 **WS ack 경계 코드**에 한정된 맥락일 수 있다(이 const 는 DB 영속
        > `Execution.error` 봉투다). checker 도 그래서 CRITICAL 이 아니라 WARNING 을 냈다.
        > 해석의 여지가 있다는 사실 자체를 여기 남긴다.
        >
        > **후속 (planner 트랙)**: `spec/conventions/error-codes.md` §Overview 가 대표 surface
        > 를 `ErrorCode` 단수로 서술한다 — `EngineErrorCode` 병기 1줄이 필요하다.
        > → [`spec-conventions-engine-error-code-surface.md`](../in-progress/spec-conventions-engine-error-code-surface.md)

        > **재발 방지**: `repo-guards/__tests__/engine-error-code-anchor-guard.ts` (AST).
        > 관례대로 TS 소스는 정규식이 아니라 파서로 읽는다 — 실제로 내 1차 정규식 스캔이
        > `code:` 만 봐서 `const code = 'X'` 를 통째로 놓쳤고, `workflow-errors.ts` 의
        > **주석 속 예시**를 위반으로 오탐했다. AST 가 둘 다 해결했다.
        >
        > **뮤테이션 (예측 / 실측), 테스트 14건**(초판 11 → 리뷰 2R 의 생성자-인자 형태
        > 커버리지 + positive-path 추가로 증가):
        >
        > | 뮤턴트 | 예측 | 실측 |
        > |---|---|---|
        > | 리다이렉트 1곳을 맨 문자열로 되돌림 | RED | **RED** |
        > | 수집기에서 `VariableDeclaration` 제거 | RED | **RED** |
        > | `UPPER_SNAKE` 필터 무력화 | RED | **RED** |
        > | 예외 목록 1건 제거 | RED | **RED** |
        >
        > - **첫 판은 핵심 축이 생존했다 — 뮤테이션이 설계 결함을 잡았다.** 가드를
        >   *"모르는 코드 **값**"* 으로 정의했더니, 이미 enum 에 있는 값을 맨 문자열로
        >   되돌려도 통과했다. 막으려는 것은 값이 아니라 **"상수를 안 거치는 사이트"** 라
        >   판정을 **형태**로 옮겼다.
        > - **자멸하는 테스트 2건도 뮤테이션 전에 잡혔다.** 리터럴을 없애는 것이 목적인데
        >   라이브 소스로 "리터럴이 있다" 를 단언하면 성공하는 순간 테스트가 죽는다. 형태
        >   커버리지는 **불변 픽스처**로, 공허 방지 하한은 **예외 목록 크기**로 묶었다.
        >
        > 검증: backend **437 suites / 9108 tests**(CI 와 같은 범위) · `tsc` 변경 파일 0 에러 ·
        > prettier 통과.
        >
        > **자매 항목 I6 도 같은 편집으로 닫혔다.**
        > [`spec-draft-webchat-execution-residuals.md`](../complete/spec-draft-webchat-execution-residuals.md)
        > 의 *"error-code 등록(I6): `WEBCHAT_IDLE_TIMEOUT` 은 `error-codes.ts` 편집 — ARCH#5
        > 동시 편집 대기열과 겹침(충돌 아님, 착수 시 순서만 조율)"* 이 그것이다. 순서를
        > 조율할 일 없이 **한 편집에 같이 들어갔다** — `EngineErrorCode.WEBCHAT_IDLE_TIMEOUT`.
        > **차단 근거의 절반이 사라졌다 (2026-08-29 재측정).** 원래 근거는 "타 in-progress
        > plan(**http-ssrf**·node-output-redesign)이 `error-codes.ts` 에 항목 추가 중이라
        > 지금 재편하면 충돌" 이었는데:
        >
        > - **http-ssrf 는 둘 다 이미 `complete/` 로 이동**했다
        >   (`plan/complete/http-ssrf-all-auth.md` · `…-followups.md`).
        > - 남은 것은 `node-output-redesign` 뿐이고 그 디렉터리에서 `error-codes` 를
        >   언급하는 것은 2파일(`text-classifier.md`·`send-email.md`)이다.
        >
        > 즉 **"충돌한다" 는 전제 자체를 착수 전에 다시 재야 한다** — 남은 근거는 blast
        > radius 뿐이고, 그건 "미루는" 이유이지 "막힌" 이유가 아니다.
        >
        > ~~작업은 여전히 미착수임을 확인했다(2026-08-29): `nodes/core/error-codes.ts` 한
        > 파일에 HTTP·DB·LLM 노드 코드와 엔진 코드가 그대로 혼재하고,
        > `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 `execution-engine.service.ts` 의 하드코딩
        > 문자열이다.~~ → **위 "완료 (2026-08-31)" 기록으로 대체됨.**
        >
        > 그 관측 자체는 그때 참이었고 지금은 아니다 — `EXECUTION_QUEUE_WAIT_TIMEOUT` 은
        > `EngineErrorCode` 참조가 됐다. 다만 *"한 파일에 혼재"* 는 **끝까지 참이다**:
        > 파일은 일부러 나누지 않았고 const 를 둘로 갈랐다(위 ② 참조). 그 판단이 이 항목의
        > 결론이므로 원문을 지우지 않고 취소선으로 남긴다.
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
> 근본 원인: [`update-returning-tuple-shape.md`](../in-progress/update-returning-tuple-shape.md).

- [x] **admission 회귀 보강 (ai-review testing INFO)** — 완료(2026-07-04). unit(runExecutionFromQueue): admission deferred/cancelled → `runExecution` 미호출(+deferred 만 `releaseExecutionRouting`), admitted → `runExecution(exec,input,true)`. unit(admitExecutionOrDefer): 원자 UPDATE 파라미터 순서·cap 매핑 `[executionId,workspaceId,wsCap,workflowId,wfCap]` + advisory lock 키(workspace 범위). e2e: workspace-level cap 단독 gating(다른 workflow running 이 workspace 슬롯 소비 — 헬퍼 workspace 파라미터화). production 코드 무변경. TEST WORKFLOW: lint·unit(신규 4)·build·e2e(231). ai-review 8-reviewer Critical/Warning 0.
- [x] **orphan pending backstop** — 완료(2026-07-04). `recoverStuckExecutions`(§7.4 부팅+test-hook)에 `recoverOrphanPendingExecutions` 추가 — `status='pending' AND queued_at < now − EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 인 orphan(admission 재큐 job 소실)을 기존 `markQueueWaitTimeout`(멱등)으로 §8 wait-timeout `cancelled` 마감. RUNNING re-drive/PENDING cancel(진행 흔적 유무). early-return 제거로 running 재점유 무관 항상 스캔. 신규 migration/env/에러코드 없음. spec §8/§7.1/§7.4+Rationale+data-flow 반영. TDD 유닛 3+e2e 2, e2e(234). impl-prep 5/5·ai-review 9-reviewer(doc/db WARNING 조치).

## exec-engine 무관 (별도 트랙)

- [x] **(분리·무관) auth Critical 2건** — `spec/5-system/1-auth.md`(초대 에러코드 casing·WebAuthn 응답 포맷). 완료(2026-07-05). **Issue 1(초대 에러코드 casing)**: 재확인 결과 이미 해결됨 — `workspace-invitations.service.ts` 11개 코드 전부 `error-codes.md §3` 에 historical-artifact 예외로 명문화(2026-06-28). 조치 불필요. **Issue 2(WebAuthn 응답 포맷)**: 코드 버그 아니라 spec 텍스트 불일치 — `{data:{items}}` 는 sessions·webauthn 양쪽 백엔드+프런트가 의존하는 load-bearing 계약이나 `1-auth.md:469` 만 bare-array 로 오기. project-planner 트랙으로 spec 을 실제 계약에 맞춤(Option A, non-breaking): 1-auth.md:469 정정 + api-convention §5.2 note/Rationale + swagger.md "유일한 예외"→2사례 정정 + 9-user-profile.md sessions 동기화. consistency-check --spec BLOCK: NO(10_42_09, cross_spec CRITICAL→swagger 동시갱신으로 해소). ~~Follow-up(developer): `webauthn-response.dto.ts:77` stale 주석 정정.~~ **완료 (2026-07-17)**: 해당 주석("credential 목록 응답. SessionListDto 의 이중 중첩 패턴은 피한다.")은 **실재하지 않는 구분을 주장**하고 있었다 — `WebAuthnCredentialListDto` 와 `SessionListDto` 는 둘 다 `{ items: T[] }` 로 **shape 이 동일**하고 같은 인터셉터를 거쳐 `{ data: { items } }` 로 나간다. 즉 webauthn 이 그 패턴을 "피하는" 것이 아니라 **똑같이 따른다**. 주석을 실제 계약(load-bearing `{data:{items}}`, bare array 로 낮추지 않음) + spec cross-ref 로 교체.
