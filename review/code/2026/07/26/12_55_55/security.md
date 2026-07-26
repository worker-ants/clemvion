# 보안(Security) Review — linear-cancel-mechanism (2R, RESOLUTION 검증)

대상: `review/code/2026/07/26/11_48_55` 라운드에서 이 reviewer가 낸 WARNING(`executeInline` 가드 흡수
+ 내부 전용 `ExecutionCancelledError` message 의 client 노출)의 해소 여부 검증. 아울러 이번 diff(§2.3
node-boundary cancel 가드 + C1~C4/W1~W8 조치)를 전통적 보안 관점(인젝션·시크릿·인증/인가·입력검증·
암호화·에러노출·의존성)으로 재검토.

## 검증 결과 — 직전 WARNING(`executeInline` 흡수)

**해소 확인.** `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` 의 `executeInline` 호출을
감싸는 catch(직접 파일을 열어 확인, 게이트 184-198)에 `ParkReleaseSignal` 과 대칭으로
`if (err instanceof ExecutionCancelledError) { throw err; }` 가 `buildSubWorkflowError(...)` 호출보다
먼저 배치됐다. 즉 `ExecutionCancelledError` 는 더 이상 `output.error.message` (client-visible 노드 출력)
로 변환되지 않고 그대로 상위 dispatch loop 로 재throw 되어, `runExecution`/`finalizeResumedExecutionOutcome`
의 `instanceof ExecutionCancelledError` catch(C4 로 guarded UPDATE 로 전환됨, 아래 참고)가 `CANCELLED`
로 정확히 마감한다. 회귀 테스트(`workflow.handler.spec.ts` 게이트 737-777, "ExecutionCancelledError
re-throw" describe 2건)가 이를 고정하며, RESOLUTION.md 가 주장하는 mutation 검증(가드 제거 시 2건
RED → 복원 GREEN)도 코드 배치와 일치한다. `mode: 'async'` 경로(같은 파일 `execute()` 상단, 게이트
~113-121)는 검토 결과 영향 없음 — `executeAsync` 는 `savedExecution` 을 생성해 새 `executionId` 를
발급하고 `runExecution(...).catch(...)` 를 fire-and-forget 으로 던진 뒤 즉시 반환하므로, 부모 노드
호출부(`WorkflowHandler.execute`)로 `ExecutionCancelledError` 가 동기적으로 도달할 경로 자체가 없다.

이와 함께, `runExecution`/`finalizeResumedExecutionOutcome` 의 두 catch(C4)가 공용
`emitCancellationEvent` 헬퍼로 통일되면서(W3) 그 emit payload 에는 `cancelledBy` 만 실리고
`error.message` 필드는 아예 넘기지 않는다 — 이 두 catch 경로 자체에서는 `Execution ${executionId}
cancelled externally` 문자열이 WS 로 나가지 않는다(직접 코드 확인, `execution-engine.service.ts:4524-4537`,
`:2619-2637`).

`ForEachExecutor`(errorPolicy `skip`/`continue`)의 C3 재throw 가드(`foreach-executor.ts:99-101`) 도
부수적으로 같은 클래스의 노출을 막는다 — 가드가 없었다면 `ExecutionCancelledError.message` 가
`skipped[].error.message` (client-visible ForEach/Map 노드 출력)에 실릴 뻔했다.

## 발견사항

- **[WARNING]** 같은 정보노출 취약점 클래스(`@internal` sentinel 의 client 노출 + `cancelled`→`failed`
  오분류)가 **컨테이너(ForEach/Loop/Map) 경로에서 미해소로 재발**한다 — `executeInline` 은 고쳐졌지만
  `runContainer` 의 범용 catch 는 이번 C3 변경으로 처음 살아난 `ExecutionCancelledError` 도달을 전혀
  구분하지 않는다.
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6480` — C3 가 신설한
      `executeContainerBody` 상단의 `await this.assertExecutionNotCancelled(executionId)` (아이템 경계
      마다 호출, ForEach/Loop/Map 3종 컨테이너 공용).
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7511-7568` —
      `runContainer`. `runContainerInner(...)` (내부에서 `foreachExecutor.execute`/`loopExecutor.execute`
      호출, `:7617`·`:7664`·`:7722`)를 감싸는 `try { ... } catch (err) { ... }` (게이트 7530-7567). 이
      catch 는 `err` 의 타입을 전혀 분기하지 않는 **완전 범용** catch다.
    - 게이트 7536: `const message = err instanceof Error ? err.message : String(err);` — `err` 가
      `ExecutionCancelledError` 여도 그대로 `message` 에 담긴다(그 내용은 `assertExecutionNotCancelled`
      가 만든 `Execution ${executionId} cancelled externally`, 정의부 `:7847-7861`).
    - 게이트 7542-7549: `nodeExec.status = NodeExecutionStatus.FAILED; nodeExec.error = { message };` 후
      `nodeExecutionRepository.save(nodeExec)` — **DB 에 영속**된다. 이 컨테이너 노드(예: `foreach`)는
      Execution 이 결국 `cancelled` 로 마감되는 것과 별개로, 자신의 `NodeExecution.status` 는
      **`failed`** 로 잘못 남는다 — §5.1 "cancelled 로 분류돼야 한다" 원칙 위반이자, 직전 라운드
      WARNING 이 지적한 "`SUB_WORKFLOW_FAILED` 오분류"와 동일한 클래스의 오분류가 컨테이너에도 있다.
    - 게이트 7551-7566: `this.eventEmitter.emitNode(executionId, containerNode.id, NodeEventType.NODE_FAILED, { ..., error: message, ... })`
      — `ExecutionEventEmitter.emitNode` → `WebsocketService.emitNodeEvent` (직접 확인,
      `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:51-60`)
      로 이어져 **구독 중인 client 에게 실시간 WS 로 그대로 방출**된다. `workflow-errors.ts:311-319` 의
      JSDoc 이 "`workflow.handler.ts` 만 동일한 이유로 sanctioned 예외이고 그 외 모듈 외부 직접 참조는
      금지" 라고 명시한 바로 그 계약을, `runContainer` 의 이 경로가 (의도치 않게) 어긴다 — 이 catch
      는 `err instanceof` 분기를 아예 안 하므로 "sanctioned" 여부와 무관하게 항상 노출된다.
    - 게이트 7567: `throw err;` — 이후 `ExecutionCancelledError` 는 상위 dispatch loop(`runExecution`
      /`runNodeDispatchLoop`, C4 로 guarded UPDATE 전환됨)로 올바르게 전파돼 **Execution 수준**에서는
      결국 `cancelled` 로 정확히 마감된다. 문제는 그 사이 이미 발생한 **node 수준**의 DB 오염 +
      WS 노출이 되돌려지지 않는다는 점이다.
  - 상세: 이번 PR(C3) 이전에는 `ExecutionCancelledError` 를 프로덕션에서 실제로 throw 하는 지점이
    없었으므로(직전 라운드 security.md 가 이미 확인) `runContainer` 의 이 catch 도 사실상
    `CONTAINER_MISSING_EMIT` 류의 **구조적 설정 오류**만 받는 경로였다. C3 가 `executeContainerBody`
    에 `assertExecutionNotCancelled` 를 추가하면서 이 catch 로 `ExecutionCancelledError` 가 처음
    도달하게 됐는데(=`executeInline`/`workflow.handler.ts` 에서 있었던 것과 정확히 동일한 "새로
    깨어난 미분기 catch" 패턴), 이번 라운드의 C1 수정은 `workflow.handler.ts` 한 곳만 고쳤고
    `runContainer` 는 감사 대상에서 빠졌다. `ExecutionCancelledError` 를 프로덕션에서 던지는
    유일한 생성자(`assertExecutionNotCancelled`, `execution-engine.service.ts:7858-7860`)의 메시지는
    executionId 를 원문 그대로 담고 있어(같은 workspace 사용자 본인의 실행이라 크로스테넌트 유출은
    아니지만), "내부 식별자를 client 메시지에 담지 않는다"는 이웃 클래스들의 정책(`workflow-errors.ts`
    의 `InvalidExecutionStateError`/`RetryLastTurnError`/`ExecutionTimeLimitError` 패턴, 직전 라운드
    security.md 가 이미 인용)과 여전히 어긋난다.
  - 재현 조건: Stop 이 눌린 시점에 `foreach`/`loop`/`map` 컨테이너의 body 가 아이템 사이 경계에
    있을 때(=`assertExecutionNotCancelled` 가 다음 아이템 진입 전에 CANCELLED 를 관측). 신규 회귀
    테스트(`execution-engine.service.spec.ts:9950`, "노드 경계가 아니라 아이템 경계에서...(C3)")가
    바로 이 시나리오를 구성하지만, 단언은 `bodyCalls` 횟수와 `execution.cancelled` WS emit
    **발생 여부**(`toHaveBeenCalledWith`, 존재만 확인 — 호출 횟수·다른 emit 과의 배타성은 불검증)뿐이라
    같은 테스트 실행 중에 `NODE_FAILED`(`error` 필드에 executionId 포함 메시지) 가 함께 emit 됐는지도,
    `foreach` 노드의 `NodeExecution.status` 가 `failed` 로 잘못 저장됐는지도 검증하지 않는다 — 즉 이
    갭은 mutation 검증 표(RESOLUTION.md "7개 지점 전부 RED→GREEN")에도 잡히지 않는 사각지대다.
  - 제안: `runContainer` 의 catch 최상단에 `workflow.handler.ts`/`executeBackgroundSubgraph` 와
    대칭으로 `if (err instanceof ExecutionCancelledError) throw err;` (FAILED 마킹·NODE_FAILED emit
    이전에) 를 추가해 그대로 상위로 전파시킨다 — 컨테이너 노드의 `NodeExecution` 은 FAILED 로
    마킹하지 않고(§2.3 상위 catch 가 Execution 을 CANCELLED 로 마감하므로 굳이 컨테이너 노드를
    별도로 CANCELLED 마킹할 필요가 있는지도 함께 검토), 최소한 지금처럼 FAILED + 내부 메시지 노출은
    막는다. 회귀 테스트에 `mockNodeExecutionRepo.save`/`emitNode` 호출 인자를 단언해 (a)
    `NodeExecutionStatus.FAILED` 로 저장되지 않음, (b) `NODE_FAILED` 이벤트가 발생하지 않음(또는
    발생 시 `error` 필드에 원본 message 가 아니라 안전한 고정 문구가 실림)을 고정할 것.

- **[INFO]** `ParallelExecutor`/`runParallel` 은 동일 결함 클래스에서 안전 — 대조군으로 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:277-287`,
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7302` (`runParallel`,
    자체 wrapping try/catch 없음).
  - 상세: `errorPolicy: 'stop'`/`'cancel-others-on-fail'` 인 Parallel 은 `ParallelExecutor.execute()`
    가 `ExecutionCancelledError` 를 (변형 없이) 그대로 재throw 하고, `runParallel` 자신은
    `runContainer` 와 달리 감싸는 catch가 없어 상위 dispatch loop 의 정식 catch 로 곧장 전달된다 —
    `NodeExecution` 오염·메시지 노출이 없다. `errorPolicy: 'continue'` 인 경우는 실패가
    `ParallelResult.failures[]` 에 담겨 조용히 삼켜지지만(`execute()` 가 throw 하지 않음),
    `runParallel` 은 `parallelResult.failures` 를 어디에서도 읽지 않으므로(grep 확인, 전체 파일에서
    `.failures` 참조는 이 한 곳뿐) 현재는 노출 경로가 없다 — 다만 각 branch 가 자기 노드 경계마다
    독립적으로 `assertExecutionNotCancelled` 를 통과하므로 dispatch 자체는 정상적으로 멎는다(부수효과
    지속 문제는 없음). 향후 `failures[]` 를 소비하는 코드가 추가되면 재검토 필요.

- **[INFO]** 전통적 항목(SQL/커맨드 인젝션, 하드코딩 시크릿, 인증/인가, 암호화, 의존성) — 문제 없음.
  이번 diff 의 신규 DB 접근(`assertExecutionNotCancelled` 의 `findOne({where:{id: executionId}, select:
  {id:true, status:true}})`)은 TypeORM 파라미터 바인딩을 사용해 SQL 인젝션 위험이 없고, executionId
  는 호출부(URL 경로 파라미터가 아니라 엔진 내부에서 전달되는 UUID)라 외부 입력 검증 이슈도 없다.
  하드코딩된 시크릿·인증 우회·평문 전송·구식 해시 알고리즘은 diff 전체(엔진·테스트·plan/spec 문서)에
  없다. `package.json` 의존성 변경도 없다(router 결정과 일치).

## 요약

직전 라운드 WARNING(`executeInline` 흡수로 인한 부수효과 재현 + `SUB_WORKFLOW_FAILED` 오분류 +
내부 전용 `ExecutionCancelledError.message` 의 client 노출)은 `workflow.handler.ts` 의 재throw 추가로
**정확히, 회귀 테스트와 함께** 해소됐다 — 이 경로는 더 이상 문제가 없다. 다만 검증 과정에서 **같은
정보노출·오분류 클래스의 재발 인스턴스**를 새로 발견했다: C3 가 `executeContainerBody` 에
`assertExecutionNotCancelled` 를 추가하면서 ForEach/Loop/Map 컨테이너 경로에서도 처음으로
`ExecutionCancelledError` 가 실전 발생하게 됐는데, 그 예외를 받는 `runContainer` 의 기존 범용 catch
(원래는 `CONTAINER_MISSING_EMIT` 류 구조적 오류만 받던 경로)는 `instanceof` 분기 없이 컨테이너
`NodeExecution` 을 `failed` 로 마킹하고 내부 전용 메시지(`Execution ${executionId} cancelled
externally`)를 DB 에 영속 + `NODE_FAILED` WS 이벤트로 client 에 실시간 방출한다 — `workflow-errors.ts`
의 JSDoc 이 "`workflow.handler.ts` 만 sanctioned, 그 외 모듈 외부 직접 참조 금지" 라고 명시한 계약을
어기는 두 번째 도달 경로다. executionId 자체는 사용자 본인 소유 실행의 식별자라 크로스테넌트
유출이나 비밀 노출은 아니므로 CRITICAL 로는 보지 않지만, (a) 문서화된 내부전용 계약 위반, (b) Execution
은 `cancelled` 인데 마지막 컨테이너 노드는 `failed` 로 남는 상태 불일치, (c) 신규 회귀 테스트가 이
경로를 검증하지 않는 사각지대라는 세 가지 이유로 반드시 후속 수정이 필요하다. Parallel 경로는 구조가
달라(별도 wrapping catch 없음) 동일 결함에서 자유롭다는 것도 대조군으로 확인했다. 그 외 전통적 보안
항목(인젝션·시크릿·인증·암호화·의존성)은 이번 diff 전체에서 문제가 없다.

## 위험도

MEDIUM — CRITICAL 급이었던 원 WARNING(`executeInline`)은 해소됐으나, 동일 클래스의 새 WARNING
(`runContainer` 미분기 catch)이 미해소 상태로 남아 있다.
