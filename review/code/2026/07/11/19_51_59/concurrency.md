# 동시성(Concurrency) 리뷰 — EIA-RL-07 webchat-idle-reaper

## 발견사항

- **[WARNING]** `markWebchatIdleTimeout` 의 다단계 DB 변경이 원자적이지 않아 부분 실패 시 불일치 상태를 남길 수 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:981-1043` (`markWebchatIdleTimeout`)
  - 상세: 이 메서드는 (1) Execution `waiting_for_input→cancelled` 조건부 UPDATE → (2) 짝 NodeExecution `waiting_for_input→cancelled` UPDATE → (3) `finalizeRehydrationCleanup` → (4) `EXECUTION_CANCELLED` emit → (5) `releaseExecutionRouting` 순서를, 단일 트랜잭션이 아닌 개별 `execute()` 호출로 순차 실행한다. (1)이 `affected:1` 로 커밋된 뒤 (2)~(5) 구간에서 예외(일시적 DB 커넥션 오류 등)가 발생하면 바깥 `catch` 로 빠져 `false` 를 반환하는데, 이 시점엔 이미 **Execution 은 CANCELLED 로 실제 커밋**돼 있다. 결과:
    - 호출자인 `WebchatIdleReaperService.reapOne` 은 `cancelled=false` 로 판단해 `revokeAllForExecution` 을 건너뛴다. (다행히 `TerminalRevokeReconcilerService`(EIA-RL-06)가 `execution.status IN terminal` 을 이벤트와 무관하게 별도로 스윕하므로 토큰 회수 자체는 ~1분 뒤 self-heal 된다.)
    - 짝 NodeExecution 은 `waiting_for_input` 에 영구 잔류한다 — 이는 바로 위 형제 함수 `cancelParkedExecution` 의 주석(898-900행)이 명시한 정확히 그 불변식("Execution 만 CANCELLED 로 전이하고 NodeExecution 이 WAITING_FOR_INPUT 으로 잔류하면 UI 가 영구 WAITING 을 표시")을 위반하는 상태가 되며, 이를 되돌리는 별도 리컨실러가 없다.
    - `EXECUTION_CANCELLED` emit 자체가 발생하지 않으므로 (a) 연결된 SSE/WS 클라이언트가 실시간 알림을 못 받고, (b) `emitExecutionEvent` 내부의 terminal-event 자동 `releaseExecutionRouting` 도 트리거되지 않으며 코드 하단의 명시적 `releaseExecutionRouting` 호출(1033행)도 도달하지 못해 `WebsocketService.executionRouting` Map 엔트리가 영구 누수된다(해당 executionId 로는 더 이상 terminal 이벤트가 발생하지 않으므로 프로세스 재시작 전까지 회수되지 않음).
    - 재시도도 없다: 다음 tick 의 `findIdleWebchatExecutionIds` 는 `e.status = waiting_for_input` 로 필터링하는데 이미 CANCELLED 이므로 후보에서 영구 제외된다.
  - 이 패턴 자체는 기존 `cancelParkedExecution`(910-964행)에서도 동일하게 존재하는 기존 설계이나, 본 PR 은 그 패턴을 **무인(unattended) 백그라운드 reaper** 경로에 새로 복제해 노출 표면을 넓혔고, docstring(974-976행)은 "멱등·race-safe" 만 강조할 뿐 이 부분 실패 경로는 언급하지 않는다.
  - 제안: `claimResumeEntry`(1066행 이하)가 이미 사용 중인 `this.dataSource.transaction(...)` 패턴을 그대로 적용해 Execution UPDATE + NodeExecution UPDATE 를 단일 트랜잭션으로 묶으면, 두 UPDATE 사이의 부분 실패 창을 원천적으로 제거할 수 있다(둘 중 하나라도 실패하면 전체 롤백 → 다음 tick 에 정상 재시도). emit/`finalizeRehydrationCleanup`/routing-release 는 DB 커밋 이후에도 여전히 best-effort 로 유지 가능.

- **[INFO]** `waiting_for_input` 조건부 UPDATE 기반 경합 처리는 견고함 (긍정 확인)
  - 위치: `execution-engine.service.ts:981-1002`, `claimResumeEntry` 1066-1123행
  - 상세: reaper 의 `markWebchatIdleTimeout` 과 사용자 트리거 `cancelParkedExecution`, 그리고 재개 경로 `claimResumeEntry` 가 모두 `status = WAITING_FOR_INPUT` 를 조건으로 하는 조건부 UPDATE(check-then-act 창 없음)로 상태를 놓고 경쟁하며, `claimResumeEntry` 는 Execution 이 이미 non-resumable 로 전이된 경우 `ResumeClaimExecTerminalError` 로 트랜잭션을 롤백해 NodeExecution claim 도 함께 취소한다(1090-1109행 주석이 이 정확한 race window 를 명시적으로 문서화·처리). reaper vs 사용자 cancel 의 동시 실행도 먼저 커밋한 쪽만 `affected:1` 을 얻고 나머지는 `affected:0` no-op 이 되어 이중 처리·이중 emit 이 없다. 또한 어느 경로로 terminal 에 도달하든 `NotificationFanout` live 구독 + `TerminalRevokeReconcilerService`(EIA-RL-06) 이중 백스톱이 토큰 회수를 담보하므로, 위 WARNING 의 토큰 누수 리스크는 실질적으로 낮다.

- **[INFO]** reap 배치 처리의 bounded concurrency·중복 실행 방지 설계는 적절함
  - 위치: `webchat-idle-reaper.service.ts` `reap()` (925-959행), `@Processor(..., { concurrency: 1 })` (885행), `onModuleInit` `upsertJobScheduler` (901-915행)
  - 상세: `REAP_CONCURRENCY=10` 청크 단위 `Promise.allSettled` 로 커넥션 폭주를 막고, 큐 레벨 `concurrency:1` + Redis 단일 repeatable scheduler entry 로 멀티 인스턴스에서도 동시 tick 실행이 겹치지 않는다(reconciler 형제 패턴과 동형). 개별 execution 실패는 `fail-open` 으로 다른 candidate 처리를 막지 않으며 스웝 실패(쿼리 자체 실패)도 swallow 되어 다음 tick 재시도 — 정상적인 워커 생존성 설계다. 다만 극단적으로 후보가 지속적으로 batchLimit(500)에 가깝게 쌓이고 처리 시간이 1분을 초과하는 경우, 스케줄러가 매분 새 job 을 enqueue 하면서 대기열이 누적될 수 있다 — 정상 운영 범위에서는 문제가 되지 않을 backstop 성격의 낮은 우선순위 관찰 사항.

## 요약
신규 `WebchatIdleReaperService`/`markWebchatIdleTimeout`(EIA-RL-07)의 핵심 경쟁조건 방어(단일 조건부 UPDATE gate, 멀티 인스턴스 repeatable scheduler 중복 방지, bounded concurrency 배치 처리, 토큰 회수의 이벤트-독립 이중 백스톱)는 기존 `cancelParkedExecution`/`claimResumeEntry`/`terminal-revoke-reconciler` 패턴을 정확히 재사용해 견고하다. 다만 `markWebchatIdleTimeout` 자체는 Execution UPDATE 와 NodeExecution UPDATE 를 트랜잭션으로 묶지 않아, 첫 UPDATE 커밋 후 이어지는 단계에서 예외가 발생하면 "Execution=CANCELLED 이나 NodeExecution=WAITING_FOR_INPUT 잔류·이벤트 미발행·routing 누수"라는 불일치 상태를 함수가 `false`(=아무 일도 없었음)로 보고하며 남길 수 있다. 토큰 회수는 별도 리컨실러가 self-heal 하지만 NodeExecution 잔류·WS 라우팅 누수는 회수 경로가 없어, `claimResumeEntry` 가 이미 쓰고 있는 트랜잭션 패턴을 이 함수에도 적용할 것을 권장한다.

## 위험도
LOW
