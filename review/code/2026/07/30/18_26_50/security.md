# Security Review — retry_last_turn `allowRetryReentry` 재진입 가드 (2026-07-30)

## 검토 범위

- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`

`origin/main` 대비 diff 확인(`git diff origin/main -- <3 files>`) 결과, 이번 라운드의
실제 변경은 (1) `EngineDriver` 인터페이스에 `opts?: { allowRetryReentry?: boolean }`
JSDoc/파라미터 보강, (2) `RetryTurnService` 의 `_retryState` 키 리터럴 상수화
(`RETRY_STATE_KEY`) + 2차 원자 claim 헬퍼(`claimSpawnedRetryRow`) 신설 + "claim 을
손상 판정보다 먼저 실행" 순서 정정, (3) `state-machine.ts` 의 `allowRetryReentry`
opt-in 대상을 `FAILED → RUNNING` 단일에서 `FAILED → RUNNING | WAITING_FOR_INPUT`
2개로 확장. 아래는 이 변경 및 인접 로직에 대한 보안 관점 분석이다.

호출 체인 교차검증(파일 밖, 컨텍스트 확인용): `allowRetryReentry`/`retryReentry` 플래그는
`retry-turn.service.ts` → `AiTurnOrchestrator.processAiResumeTurn(..., { retryReentry:
true })` 호출부(리터럴 `true`, 유일한 호출자) 한 곳에서만 세팅되며, WS 요청 바디의
어떤 필드로도 유입되지 않는다(`websocket.gateway.ts` 의 `handleRetryLastTurn` 은
`{ executionId, nodeExecutionId }` 만 받는다). 또한 동일 핸들러는 `getCommandAuthContext`
+ `verifyExecutionOwnership` 로 인증·소유권(IDOR) 가드를 이미 통과시킨 뒤에만
`retryTurnService.retryLastTurn` 을 호출한다. 즉 이번에 넓어진 상태전이 우회는
**클라이언트가 직접 트리거할 수 없는 내부 전용 opt-in**이며, COMPLETED/CANCELLED 는
계속 배제되므로 진짜 동시 취소·완료 실행의 "부활" 경로는 없다 — 권한 우회/인증
우회 관점에서 새로 열린 구멍은 확인되지 않았다.

## 발견사항

- **[INFO]** JSONB 키 리터럴을 파라미터 바인딩 없이 raw SQL 문자열에 직접 삽입
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:213`, `:220`, `:544`, `:549` (상수 정의는 `:42`)
  - 상세: `output_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(output_data, '${RETRY_STATE_KEY}')` / `input_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(input_data, '${RETRY_STATE_KEY}')` 4곳 모두 `RETRY_STATE_KEY` 를 TypeORM 파라미터 바인딩(`:key` + `setParameter`) 대신 템플릿 리터럴로 SQL 텍스트에 직접 삽입한다. **현재는 익스플로잇 불가능** — `RETRY_STATE_KEY` 는 파일 최상단에서 `const RETRY_STATE_KEY = '_retryState'` 로 고정된 컴파일타임 상수이고 사용자 입력·설정값에서 파생되지 않는다(그 외 `nodeExecutionId`/`spawnedNodeExecutionId`/`status` 는 모두 `:id`/`:running` named parameter 로 정상 바인딩됨). 다만 "raw 문자열 삽입" 패턴 자체는 향후 이 상수가 설정 가능/동적 값으로 바뀌거나 유사 헬퍼가 복제될 때 인젝션 벡터로 전환될 수 있는 코드 냄새다.
  - 제안: `jsonb_exists(output_data, :key)` / `output_data - :key`(가능하다면) 형태로 바인딩 파라미터화해 상수-불변 전제에 의존하지 않는 방어적 패턴으로 굳히는 것을 권장(필수는 아님).

- **[INFO]** retry 재실패 시 원본 예외 `message` 를 그대로 client 에 노출(기존 코드, 이번 diff 로 변경되지 않음)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` 함수 — `:926`(`errMessage` 캡처), `:933`(`execution.error` DB 저장), `:959`(`emitExecution` WS 페이로드)
  - 상세: `catch (err: unknown)` 로 잡은 임의 예외의 `error.message` 를 타입 구분 없이 그대로 `execution.error.message` 에 저장(REST `GET /executions/:id` 로 노출)하고 WS `EXECUTION_FAILED` 이벤트로도 그대로 emit 한다. 이 파일의 다른 경로(`InvalidExecutionStateError`/`RetryLastTurnError`)는 `ExecutionError.serverDetail` 로 내부 진단 문자열을 분리하고 `.message` 는 고정 client-safe 문자열만 노출하도록 명시적으로 설계돼 있는데(위치: `workflow-errors.ts:33-43,109-111,134-135` — "message 는 client 에 그대로 노출되므로 내부 식별자를 담지 않는 고정 문자열" 주석), `failRetryExecution` 경로는 이 정책이 적용되지 않아 LLM SDK/DB 계층에서 올라온 임의 오류 메시지가 그대로 새어나갈 수 있다. 다만 수신자는 해당 execution 을 소유한 workspace 사용자로 한정되어(교차 테넌트 노출 아님) 심각도는 낮다. `origin/main` 대비 diff 에서 이 함수 본문은 변경되지 않은 기존 코드이므로 이번 라운드가 새로 도입한 결함은 아니다.
  - 제안: `failRetryExecution` 도 동일한 client-safe/serverDetail 분리 정책(이미 `markNodeCancelled` 의 W15/W19, `RetryLastTurnError`/`InvalidExecutionStateError` 의 W-5 에서 확립된 패턴)을 적용해 타입화되지 않은 예외의 원본 메시지는 서버 로그로만 보내고 client 에는 일반화된 문구를 보내는 것을 검토.

## 요약

이번 라운드(`allowRetryReentry` 를 `FAILED → RUNNING` 에서 `FAILED → RUNNING | WAITING_FOR_INPUT` 로 확장 + `retry-turn.service.ts` 2차 원자 claim 헬퍼 도입)는 보안 관점에서 새로 열린 취약점이 없다. 상태전이 우회 플래그는 클라이언트가 절대 직접 지정할 수 없는 내부 전용 리터럴이고, `retry_last_turn` 진입점은 인증(`getCommandAuthContext`)과 소유권(`verifyExecutionOwnership` + `nodeExec.executionId !== executionId` 크로스체크) 가드를 이미 통과한 뒤에만 도달하며, COMPLETED/CANCELLED 는 opt-in 이후에도 계속 배제된다. SQL 실행은 전부 TypeORM 파라미터 바인딩(id/status) 이거나, 유일하게 raw 삽입되는 값(`RETRY_STATE_KEY`)은 사용자 입력과 무관한 컴파일타임 상수라 실질적 SQL 인젝션 벡터는 아니다. 다만 (1) 그 raw-삽입 패턴 자체의 방어적 경화 여지, (2) `failRetryExecution` 의 원본 예외 메시지가 이 코드베이스 자체가 다른 곳에서 이미 확립한 "client-safe message vs serverDetail 분리" 정책을 따르지 않는 기존 비일관성 — 두 가지를 INFO 로 기록해 후속 하드닝 대상으로 남긴다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 신규 의존성 취약점은 발견되지 않았다.

## 위험도

LOW
