# 요구사항(Requirement) 리뷰 — node-cancellation-propagation e2e

## 발견사항

- **[CRITICAL]** e2e 테스트의 핵심 단언("하류 노드는 절대 실행되지 않는다")이 실제 엔진 구현으로 보장되지 않는다 — 선형(비-parallel) 디스패치 경로에서 `context.abortSignal` 은 구조적으로 항상 `undefined` 이므로, 발생 즉시 노드 B(`MustNotRun`)가 `completed` 로 끝날 가능성이 높다.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:274`~`276` (`const downstream = await nodeStatus(...)`, `expect(downstream).not.toBe('completed')`) 및 JSDoc 근거 주석 `:23`~`:24` (`context.abortSignal?.throwIfAborted()` 를 전파 확정 메커니즘으로 지목).
  - 상세(검증 체인, 전부 `Read`/`Grep` 으로 직접 확인):
    1. `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:21`~`47` (`CreateContextOptions`) 과 `:83`~`128` (`createContext`) — 최초 `ExecutionContext` 생성 시 `abortSignal` 필드는 **존재하지 않고 항상 undefined** 로 남는다.
    2. 전체 backend 소스에서 `context.abortSignal = ...` / `abortSignal:` 을 **값으로 할당**하는 유일한 지점은 `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:245` (`abortSignal: branchSignal`) — **parallel 분기 컨텍스트에만** 적용된다. 단일 트리거 → code → code 같은 선형 그래프에는 어디에서도 set 되지 않는다(전수 grep 확인).
    3. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6058` 의 `context.abortSignal?.throwIfAborted();` (`executeWithRetry` 진입부, 모든 노드 dispatch 직전 호출)는 위 1·2 때문에 **선형 실행에서는 언제나 no-op**이다.
    4. 사용자 `stop()` 은 `codebase/backend/src/modules/executions/executions.service.ts:732`~`793` — RUNNING/PENDING 상태의 경우 **DB 행에 대한 조건부 UPDATE 하나**로 끝난다. 실행 중인 in-process 코루틴(`runExecution`)에 신호를 보내는 `AbortController`/registry/pub-sub 는 어디에도 없다(`AbortController` 전수 grep 결과 `parallel-executor.ts` 외 프로덕션 코드에는 없음).
    5. `runExecution` 자체 디스패치 루프(`execution-engine.service.ts:4252`~`4454`, `runExecutionFromQueue` 가 `:3563` 에서 `await this.runExecution(execution, input, true)` 로 단일 호출)는 노드 A→B 사이에 Execution 의 최신 DB 상태를 재조회하거나 취소 여부를 확인하는 코드가 **전혀 없다**. `assertActiveTimeWithinLimit`(시간 한도 전용, 취소와 무관) 하나뿐이다.
    6. 노드 성공 시 완료 기록은 `execution-engine.service.ts:5645`~`5651` — `nodeExecution.status = NodeExecutionStatus.COMPLETED` 를 **부모 Execution 의 현재 상태와 무관하게 무조건 저장**한다.
    7. 결과적으로 시나리오는: A(5초 busy-wait, isolated-vm `.run()` 은 event loop 논블로킹이라 그 사이 `stop()` HTTP 요청은 정상 처리돼 Execution 행만 `cancelled` 로 바뀜) 완료 → 같은 콜스택이 그대로 B 를 dispatch → B(`return {reached:true}`, 즉시 완료) → `nodeExecution.status='completed'` 무조건 저장. Execution 전체 상태는 (guarded UPDATE 가 `status IN ('pending','running','waiting_for_input')` 만 매치해 이미 `cancelled` 인 행을 덮어쓰지 않으므로) `cancelled` 로 올바르게 남지만(테스트 항목 (3) `finalStatus==='cancelled'` 는 참일 수 있음), **노드 B 는 실제로 `completed` 로 끝난다** — 테스트 항목 (4) `expect(downstream).not.toBe('completed')` 이 실패할 것으로 강하게 예상된다.
  - 이 코드 변경(diff)에는 프로덕션 코드 수정이 전혀 없고(테스트 파일 + plan 문서 + spec frontmatter 뿐), plan 문서(`plan/complete/node-cancellation-inflight-followups.md:56` `e2e 259 green`)는 이 3건이 모두 통과했다고 기술한다. 정적 분석 결과가 옳다면 이 주장은 사실이 아니거나(실제로는 RED), 혹은 테스트가 **다른 이유로 우연히 통과**(예: 타이밍 상 B 의 dispatch 시점에 뭔가 다른 경합이 있어 A 자체가 아직도 실행 중으로 오검출)하고 있을 가능성이 있다 — 어느 쪽이든 이 e2e 가 실제로 검증하려는 "in-flight cancel propagation" 을 검증하지 못하고 있다는 뜻이다.
  - 제안: 병합 전 이 파일 하나만 격리 실행(`make e2e-up` 후 `backend-e2e-runner` 에 `-t 'node-cancellation-propagation'` 또는 동등 필터)해 실제 통과/실패를 재확인할 것. 만약 예상대로 하류 노드가 `completed` 로 관측되면: (a) 엔진에 실제 in-flight 전파 체크(다음 노드 dispatch 직전 Execution 의 최신 DB 상태 재조회 또는 `context.abortSignal` 을 선형 실행에도 배선)를 추가하거나, (b) 이 e2e 단언과 관련 spec 문서(§5.1 dispatch 사전 체크 서술)를 "Execution 레벨 최종 상태만 보장, 이미 트리거된 하류 노드의 개별 완료까지는 막지 않음" 으로 정정해야 한다. 현재 상태로는 "완료" 로 표시하고 커버리지 0 을 닫았다고 선언하기엔 이르다.

- **[WARNING]** `spec/conventions/node-cancellation.md` 의 `status: partial` → `implemented` 승격이 문서 §6 구현 현황 표의 잔여 미구현 항목과 상충한다.
  - 위치: `spec/conventions/node-cancellation.md:3` (frontmatter `status: implemented`) vs 본문 §6 표(`chat-channel 노드 signal 전파 | —`, `MakeShop 노드 signal 전파 | —`, `Cafe24 노드 signal 전파 | —`, `Workflow 단위 timeout / graceful shutdown 의 노드 abort | —`) — 실제 파일 라인 135~139 부근(`Read` 로 확인).
  - 상세: `spec/conventions/spec-impl-evidence.md` §3 은 `implemented` 를 "모든 약속 구현 완료" 로 정의한다. 이번 diff 는 `pending_plans:`(followups plan 1건)이 전부 `complete/` 로 이동했다는 이유로 가드 조건(§3 "마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격")을 기계적으로 만족시켜 상태를 승격했지만, 본문 §6 표는 여전히 chat-channel/MakeShop/Cafe24 signal 전파와 workflow-timeout 의 노드 abort 통합을 "미구현(Planned)" 으로 명시하고 있고, 이 잔여 항목들을 추적하는 `pending_plans` 엔트리는 frontmatter 어디에도 없다(추적 plan 으로 언급되는 `node-cancellation-infrastructure.md` 는 이미 `plan/complete/` 로 이동해 닫혀 있음 — 확인함). 즉 가드는 통과하지만 "모든 약속 구현 완료" 라는 `implemented` 의 의미론과 문서 본문이 어긋난다. 이 부정합은 diff 이전부터 존재하던 구현 갭(chat-channel/MakeShop/Cafe24 자체는 이번 PR 범위 밖)이지만, `status: implemented` 로 승격시킨 것은 이번 diff 의 결정이라 지금 review 대상이다.
  - 제안: `project-planner` 위임 — (a) 잔여 4개 항목을 추적할 새 `pending_plans` 엔트리(plan)를 만들고 `status: partial` 을 유지하거나, (b) 그 항목들이 이 컨벤션의 "약속"에서 애초에 제외된다는 근거를 §6 표/§1 목적에 명시하고 `implemented` 승격을 정당화할 것. 이번 리뷰 대상 diff 만으로는 코드가 틀렸다고 볼 수는 없어 SPEC-DRIFT 로 단정하지 않음 — 사람 판단 필요.

- **[INFO]** 새 e2e 파일 자체의 코드 스타일/엣지 케이스 처리는 양호함. 확인된 사항:
  - 코드 노드 하드닝 delete 목록(`setTimeout`/`setInterval`/`setImmediate`/`queueMicrotask`, `Date` 는 미포함) — `codebase/backend/src/nodes/data/code/code.handler.ts:272`~`276` 과 정확히 일치.
  - 출력 포트 `success`/`error` — `codebase/backend/src/nodes/data/code/code.schema.ts:77`~`78` 과 일치. (대조군 테스트가 애초에 `'out'` 오탈자를 잡아냈다는 plan 서술도 타당함.)
  - `timeout`(config, 초) → `timeoutMs` 변환 및 isolated-vm 의 wall-clock `timeout` 옵션 — `code.handler.ts:424`~`426`, `:610`~`613` 과 일치. `INFLIGHT_WINDOW_MS(5s) < CODE_TIMEOUT_SEC(30s)` 관계도 올바름.
  - `POST /workflows/:id/execute` → 202, `POST /executions/:id/stop` → 200(성공)/400(이미 terminal) — `workflows.controller.ts:232`~`233`, `executions.controller.ts:119`~`142`, `executions.service.ts:741`~`750` 과 일치.
  - `node_execution` 테이블/컬럼명(`execution_id`/`node_id`/`status`), `NodeExecutionStatus` enum 값(`running`/`completed`/`cancelled`) 확인됨 — 일치.
  - 두 번째(대조군)·세 번째(재-stop 거부) 테스트의 단언은 위 CRITICAL 항목과 무관한 Execution-레벨 상태 전이(정상 완료·`stop()` 의 상태-가드 400)에만 의존하므로, 실제로 통과할 가능성이 높다고 판단됨.

## 요약

새로 추가된 `node-cancellation-propagation.e2e-spec.ts` 는 의도(다단계 워크플로우에서 진행 중 노드를 지나 cancel 이 전파되는지)를 검증하려는 설계 자체는 견고하다(고정 sleep 대신 관측, vacuous-pass 방지 대조군 등). 그러나 정적 분석 결과, 이 테스트가 검증하려는 핵심 계약("하류 노드는 dispatch 되지 않는다")은 현재 엔진 구현에서 실제로 성립하지 않을 가능성이 높다 — `context.abortSignal` 은 parallel 분기 밖에서는 어디에서도 설정되지 않고, `stop()` 은 순수 DB 상태 갱신일 뿐 진행 중인 in-process 디스패치 루프에 아무 신호도 보내지 않으며, 노드 완료 기록은 부모 Execution 상태를 확인하지 않고 무조건 저장된다. Execution 전체의 최종 상태(`cancelled`)는 guarded UPDATE 덕에 올바르게 나올 수 있지만, 이미 dispatch 된 하류 노드 자체의 완료까지 막지는 못한다. 이 PR 은 프로덕션 코드 변경 없이 테스트+문서만 추가했으므로, "실행이 cancelled 로 확정되고 하류 노드가 실행되지 않는다" 는 plan 상의 "green" 주장은 실제 실행으로 재확인이 필요하다. 부수적으로 spec frontmatter 의 `status: implemented` 승격이 본문 §6 의 잔여 미구현 항목(chat-channel/MakeShop/Cafe24/timeout 노드 abort)과 의미상 상충한다.

## 위험도

CRITICAL
