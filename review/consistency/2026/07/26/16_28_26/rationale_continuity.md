# Rationale 연속성 검토 — node-cancellation 노드 경계 취소 가드 (2026-07-26)

> 검토 모드: `--impl-done`, diff-base `origin/main`, 대상 worktree
> `/Volumes/project/private/clemvion/.claude/worktrees/linear-cancel-mechanism-28dea4`
>
> 참고: 프롬프트 payload 의 target 문서 목록(`spec/conventions/*.md`)은 이번 diff 의
> 실제 변경 범위와 다르다 — 이번 세션의 실 변경분은 `codebase/backend/src/modules/execution-engine/**`
> (+ `nodes/flow/workflow/workflow.handler.ts`) 와 `plan/in-progress/node-cancellation-residual-signal-propagation.md`
> · `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 두 plan 문서다.
> `spec/conventions/node-cancellation.md` 자체는 이번 diff 에서 **아직 갱신되지 않았다**
> (developer 는 spec 쓰기 권한이 없어 두 plan 문서에 갱신 제안만 남긴 상태 — 정상 워크플로).
> payload 에는 두 plan 파일도, `spec/conventions/node-cancellation.md` 본문도, `spec/5-system/4-execution-engine.md`
> 도 컨텍스트 예산 초과로 빠져 있어 위 절대경로 워크트리를 직접 열어 재구성했다.

## 발견사항

### [INFO] (a) per-node task-queue 재도입 아님 — 확인됨, 위반 없음

- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1662-1665`(선형)
  · `:4283-4286`(재개 세그먼트) · `:7219-7223`(Parallel 브랜치) · `:6564-6577`(컨테이너 아이템,
  `executeContainerBody`) — `assertExecutionNotCancelled(executionId[, {throttle}])` 호출부
- 과거 결정 출처: `plan/complete/spec-draft-exec-intake-queue.md` `## Rationale` "per-node task queue → execution-level intake 큐" 절 — "개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext 를 직렬화/rehydration 해야 하고 ... 엔진 재작성급 변경 + 고위험" 으로 **기각**.
- 상세: 이번 PR 이 도입한 `assertExecutionNotCancelled()` 는 **기존 in-process dispatch loop 내부**에서 Execution 행을 재조회하는 단순 가드 호출일 뿐, per-node BullMQ job 발행·워커 간 노드 핸드오프·`ExecutionContext` 직렬화를 전혀 도입하지 않는다. "1 Worker = 1 active 세그먼트, 세그먼트 내부는 in-process dispatch" 라는 채택된 아키텍처(`spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"`, `execution-engine.service.ts` 자체)를 그대로 유지한 채 그 루프 안에 검사 1회를 추가한 것으로, 기각된 대안(per-node task queue)의 어떤 구성요소도 재도입하지 않는다.
- 제안: 조치 불요. (parent 요청에 대한 명시적 확인 결과로 기록)

### [INFO] (b) send-email in-flight 미채택 선례와 정합 — 확인됨, 위반 없음

- target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:203-205`
  (`## 선행 판단 (착수 전)` "best-effort 경계 재확인") · `execution-engine.service.ts:527-538`
  (`CONTAINER_CANCEL_CHECK_THROTTLE_MS` JSDoc)
- 과거 결정 출처: `plan/complete/node-cancellation-inflight-followups.md:42-47`
  "Send Email (SMTP) in-flight connection close — 🚫 won't-do (best-effort 유지, 2026-07-08 결정)"
  + `spec/conventions/node-cancellation.md §2.1` Email row("의도적 best-effort — in-flight 미채택")
  · `§2.2`(CPU 바운드/즉시 완료 노드 best-effort 원칙)
- 상세: 이번 plan 은 착수 전 판단 절에서 send-email 선례를 **명시적으로 인용**해 "driver/transport 가 in-flight 중단을 지원하지 않으면 사전 체크까지만 하고 spec 에 best-effort 로 남기는 것이 이 저장소의 확립된 처분" 이라고 재확인했고, MakeShop/Cafe24 signal 전파 항목에서도 같은 원칙을 그대로 따랐다(§4 cascade + §5.1 재throw, in-flight 미지원 driver 는 건드리지 않음). 노드 경계 판정(§2.2·§2.1)과 이번 아이템 경계 판정(§2.3 확장) 모두 "완전한 실시간 보장이 아니라 best-effort" 라는 동일 원칙 위에서 설계됐다 — 과거 결정을 무시하지 않고 오히려 근거로 재사용했다.
- 제안: 조치 불요.

### [WARNING] (c-1) 컨테이너 아이템 250ms 스로틀의 Rationale 이 위임 spec 초안에 반영되지 않음

- target 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:228-297`
  (`## 추가 위임 (2026-07-26 #6)` — §2.3/§5.1/§6 spec 반영 제안 전문)
- 과거/병행 결정 출처: `plan/in-progress/node-cancellation-residual-signal-propagation.md:164-189`
  (`### 트레이드오프 — 아이템 경계 cancel 가드 스로틀 (W10, 2026-07-26)`) — 여기엔 스로틀 채택 근거·대안 비교(카운트 기반 기각)·상태 관리·누수 방지가 상세히 기록돼 있다.
- 상세: 두 plan 문서는 **같은 날 같은 기능**(§2.3 노드 경계 Execution-cancel 재확인 가드)을 다루는데, `spec-update-...md` 의 위임 절(§6 표에 추가할 행 초안, `:278-283`)은 "컨테이너(`executeContainerBody`, 아이템 경계)/Parallel(`executeParallelBranchBody`, 노드 경계)" 라고 경계 구분만 언급할 뿐, **250ms 시간 스로틀 자체·`CONTAINER_CANCEL_CHECK_THROTTLE_MS`·best-effort 대안 비교는 전혀 언급하지 않는다**(`grep -c "250\|스로틀\|throttle"` = 0). 시간상 위임 #6 이 먼저(`review/code/.../11_48_55` 근거) 작성되고 스로틀은 그다음 라운드(`.../12_55_55`, W10)에서 추가됐는데, planner 가 실제로 spec 을 병합할 때 참조하는 문서는 위임 절(spec 반영 제안의 SoT)이라 **정작 스로틀의 Rationale 은 옆 파일의 "트레이드오프" 절에만 있고 병합 대상 제안문에는 없다.** 이 상태로 planner 가 §6 표를 그대로 옮기면, "아이템 경계도 매번 실제 조회" 로 읽힐 수 있는 문구만 spec 에 남고 250ms 최적화·best-effort 근거는 spec Rationale 에 영영 누락될 위험이 있다.
- 제안: planner 턴에서 위임 #6 반영 시, §6 표 행 비고에 "아이템 경계는 `CONTAINER_CANCEL_CHECK_THROTTLE_MS=250ms` 시간 스로틀 적용(§2.2 best-effort 원칙 하)" 을 추가하고, `node-cancellation.md §Rationale` 에도 "왜 아이템 경계만 스로틀하는가"(카운트 기반 대안 기각 이유 포함) 절을 이관할 것 — 원본은 `node-cancellation-residual-signal-propagation.md:164-189`.

### [WARNING] (c-2) `ExecutionCancelledError` 의 무조건적 `errorPolicy` 우회가 §5.2 문면과 명시적으로 조율되지 않음

- target 위치: `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:99-108`(skip/continue 우회) ·
  `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:273-283`(continue/stop/cancel-others-on-fail 우회) ·
  `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:184-195`(C1) ·
  `execution-engine.service.ts:1335, 5854, 7644`(W9/W15 우회 재throw 지점들)
- 과거 결정 출처: `spec/conventions/node-cancellation.md §5.2` (":111-117") — "노드 상태가 `cancelled` 여도 dispatch 루프 진행은 노드의 `errorPolicy` 가 결정한다" · "`errorPolicy === 'continue'` — 그 노드 `cancelled` 기록 후 후속 분기 계속."
- 상세: §5.2 는 **§5.1 이 정의하는 `AbortError`(핸들러가 던지는, 표준 `AbortSignal` 기반) 취소**를 전제로 "cancelled 여도 errorPolicy 가 계속 여부를 결정" 한다고 명시한다 — 즉 `errorPolicy='continue'`/`'skip'` 이면 취소된 노드가 있어도 **워크플로는 계속 진행**하는 것이 현재 spec 문면상 정답이다. 그런데 이번 PR 이 신설한 `ExecutionCancelledError`(엔진이 Execution 행을 재조회해 스스로 발생시키는 별도 sentinel, §5.1 의 `AbortError` 와는 다른 발생원)는 ForEach/Loop `skip`·`continue`, Parallel `continue`·`stop`·`cancel-others-on-fail` **전 정책에서 예외 없이 우회 재throw** 되어 워크플로를 무조건 종료시킨다(C1·C3·C5·W9·W15, 위 지점들). 이는 사용자가 Stop 을 누른 실행이 `errorPolicy=continue` 설정 때문에 계속 도는 것을 막는 **올바른 설계 판단**으로 보이지만, §5.2 의 현재 문면은 "cancelled 상태에서의 계속 여부는 errorPolicy 가 결정한다" 는 원칙을 `AbortError`/`ExecutionCancelledError` 구분 없이 일반화한 것처럼 읽힌다. `spec-update-node-cancellation-shutdown-classification.md` 의 위임 #6(`:274-277`)은 §5.1 에 "두 에러가 동일하게 `cancelled` 로 귀결됨" 만 명시할 뿐, **§5.2 의 errorPolicy governance 가 `ExecutionCancelledError` 에는 적용되지 않는다(무조건 우회)는 사실은 어디에도 명시 제안돼 있지 않다.** 결정 자체를 뒤집은 것은 아니지만(§5.2 는 여전히 `AbortError` 에 대해서는 유효), "cancelled 면 errorPolicy 가 결정" 이라는 §5.2 원칙에 **새 예외가 생겼는데 그 예외가 어디에도 문서화되지 않은 상태**로 spec 반영을 기다리고 있다.
- 제안: 위임 #6 초안에 "§5.2 예외" 단락을 추가 — `ExecutionCancelledError`(엔진 자체 발생, §2.3 신규 가드)는 `errorPolicy` 값과 무관하게 항상 dispatch 를 종료한다(사용자 Stop 의도를 `continue`/`skip` 정책이 무효화하지 못하도록). §5.1 의 `AbortError`(핸들러 발생, 개별 노드/branch 스코프)는 기존 §5.2 표대로 `errorPolicy` 가 계속 여부를 결정한다 — 두 sentinel 의 governance 차이를 §5.2 표에 행으로 명시할 것.

## 요약

이번 구현(node-cancellation 노드 경계 취소 가드 + 아이템 스로틀)은 검토 대상으로 지목된 세 축 중 (a) per-node task-queue 재도입, (b) send-email best-effort 선례 위반은 실측 결과 **모두 위반 없음** — 오히려 두 결정을 명시적으로 인용하며 그 위에서 설계됐다. (c) 250ms 스로틀 자체도 `node-cancellation.md §2.2` 의 best-effort 원칙과 상충하지 않고, 채택 당시 대안 비교(카운트 기반 기각)를 포함한 새 Rationale 을 갖추고 있어 "무근거 번복" 은 아니다. 다만 그 Rationale 이 실제로 spec 에 병합될 통로인 `spec-update-node-cancellation-shutdown-classification.md` 위임 절에는 아직 이관되지 않아, planner 병합 시 스로틀 근거가 누락될 실질적 위험이 있다(c-1). 또한 신설된 `ExecutionCancelledError` 가 §5.2 의 "cancelled 여도 errorPolicy 가 계속 여부를 결정" 원칙을 전 정책에서 예외 없이 우회하는 설계 판단이, 그 예외 자체로서 위임 초안에 명시되지 않은 채 남아 있다(c-2) — 결정은 타당해 보이나 문서화 공백이 있다. 둘 다 코드 정합성 문제가 아니라 **아직 spec 에 반영되지 않은 pending 제안의 완결성** 문제이며, 같은 PR 안에서 developer 가 spec 쓰기 권한 없이 위임하는 정상 흐름 중에 생긴 갭이라 CRITICAL 로 보지 않는다.

## 위험도

LOW
