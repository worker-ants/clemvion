# Security Review — retry 재진입 짝 전이 DB 가드 수정 (8R/9R CRITICAL 계열)

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

`main...HEAD` diff 기준(5개 파일, +283/-48)으로 `execution.retry_last_turn` 재진입의
`FAILED → RUNNING` / `FAILED → WAITING_FOR_INPUT` 짝 전이가 DB 가드(`lockNonTerminalExecutionRow`
FOR UPDATE 조회 + guarded UPDATE)에서 항상 0행이 되어 persist 되지 못하던 결함(8R CRITICAL)과,
그 수정이 새로 도달 가능하게 만든 re-park 경로의 회귀 테스트/spec 반영(9R CRITICAL 2건)을
대상으로 분석했다. `opts.allowRetryReentry` / `opts.retryReentry` 플래그가 상태머신·DB 가드·
DI 인터페이스 전체에 걸쳐 정확히 같은 의미로 전파되는지, 그리고 이 opt-in이 인가되지 않은
경로로 새어나가는지를 중점 검증했다.

## 발견사항

- **[INFO]** `allowRetryReentry` opt-in의 도달 경로가 하드코딩 리터럴 1곳뿐임을 확인 — 현재는 안전
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:466` (`{ retryReentry: true }` 호출부), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1439`(`finalizeAiNode` 내부 `const allowRetryReentry = opts?.retryReentry === true;`), `codebase/backend/src/modules/execution-engine/state/state-machine.ts:63-83`(`canTransition`)
  - 상세: `FAILED → RUNNING/WAITING_FOR_INPUT` 전이를 여는 `allowRetryReentry` 불리언이 실제로 `true`로 세팅되는 지점은 코드베이스 전체에서 `RetryTurnService.applyRetryLastTurn` → `this.aiTurnOrchestrator.processAiResumeTurn(..., { retryReentry: true })` 단 한 곳(hard-coded literal)이며, 이 메서드는 인증된 WS 커맨드 `execution.retry_last_turn`(`websocket.gateway.ts`의 `getCommandAuthContext` + `verifyExecutionOwnership`으로 인증·workspace 소유권 검증을 거친 뒤에만 호출됨, 이번 diff의 리뷰 대상 파일 밖이지만 기존 인프라로 확인)로만 도달 가능하다. `reparkAiResumeTurn`/`finalizeAiNode`/`updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 전 구간에서 이 플래그는 항상 위 리터럴에서 파생된 값만 전달되고, 요청 바디·WS payload 등 외부 입력이 직접 이 불리언에 도달하는 경로는 없다. `opts` 미전달(기본값)인 모든 다른 호출부는 종전과 동일하게 `NON_TERMINAL_STATUSES_SQL`(FAILED 배제)을 그대로 사용해 "실패 종결된 실행의 우발적 부활 차단" 방어가 유지된다 — `execution-engine.service.spec.ts:5140-5156`/`5186-`(대조 테스트, opt-in 없으면 persist 안 됨)와 `state-machine.spec.ts`의 양성/음성 테스트로 회귀 확인됨.
  - 제안: 현재 안전하나, 향후 이 opt-in을 다른 소비처로 확장할 때는 반드시 "호출부가 신뢰된 내부 리터럴에서만 파생되는가"를 동일하게 검증할 것 — JSDoc(`execution-engine.service.ts:530` 등)이 이미 이 불변식을 명시하고 있어 유지보수 시 참조하기 쉽다.

- **[INFO]** enum 기반 SQL 리스트·raw 문자열 보간 패턴은 현재 안전하나 구조적으로 취약한 패턴
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-518`(`NON_TERMINAL_STATUSES_SQL`), `:534-543`(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`), `:8176-8182`(`lockNonTerminalExecutionRow`의 `status IN (${statusesSql})`), `:8462-8473`(else 분기 guarded UPDATE); `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42`(`RETRY_STATE_KEY`), `:212-220`(`output_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(output_data, '${RETRY_STATE_KEY}')`), `:538-551`(`claimSpawnedRetryRow`의 `input_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(input_data, '${RETRY_STATE_KEY}')`)
  - 상세: `NON_TERMINAL_(OR_FAILED_)STATUSES_SQL`은 `Object.values(ExecutionStatus)`(고정 TS enum, `'pending'|'running'|'completed'|'failed'|'cancelled'|'waiting_for_input'`)에서만 파생되고, `RETRY_STATE_KEY`는 `'_retryState'` 리터럴 상수다. 둘 다 사용자 입력이 아니라 SQL 인젝션 실경로는 없다(주석도 "enum 값 기반이라 인젝션 우려 없음"으로 명시). 다만 이 값들이 파라미터 바인딩(`$1` 등) 대신 template literal로 쿼리 텍스트에 직접 삽입되는 패턴 자체는, 향후 이 상수의 출처가 실수로 사용자/설정값으로 바뀌면 조용히 인젝션 표면이 될 수 있는 구조다.
  - 제안: 현 상태 변경 불필요. 다만 이 두 상수(`NON_TERMINAL_STATUSES_SQL`류, `RETRY_STATE_KEY`)의 값을 앞으로 절대 런타임/사용자 입력에서 파생시키지 않는다는 불변식을 유지·문서화(이미 JSDoc에 일부 명시)하는 것을 권장.

- **[INFO]** `_retryState` 노출 축소는 보안 관점에서 개선 — 새 결함 아님
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:369`(`delete spawnedRow.inputData[RETRY_STATE_KEY];`), `:447`(`NODE_STARTED` emit의 `input: spawnedRow.inputData`)
  - 상세: 2차 원자 claim(`claimSpawnedRetryRow`) 도입 이후 in-memory `spawnedRow.inputData`에서 `_retryState` 키를 명시적으로 delete해, 뒤이은 `NODE_STARTED` WS emit의 `input` 페이로드에 더 이상 `_retryState`가 포함되지 않는다. `_retryState`는 `resume-state.schema.ts`의 credential-strip 부분집합(`llmConfigId`/`workspaceId`/`rawConfig` 등 이미 제외)이라 종전에도 민감 정보 노출 위험은 낮았지만, 이번 변경으로 internal 필드 비노출 원칙이 한 단계 더 강화됐다(회귀 테스트로 고정됨). 새로운 취약점이 아니라 개선 사항으로 기록.

- **[INFO]** 2차 claim 실패 시 FAILED 미마킹 — 알려진 가용성 트레이드오프(신규 아님, 이미 추적됨)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:341-355`(claim 실패/방어 분기), `claimSpawnedRetryRow` JSDoc(`:485-536`)
  - 상세: `claimSpawnedRetryRow`가 affected=0을 반환하면(동시 배달/이미 종결) 이전 코드처럼 spawn row를 FAILED로 마킹하지 않고 ack-and-discard한다 — "살아있는 턴을 오판해 죽이는" 활성 피해(과거 CRITICAL)를 재도입하지 않기 위한 의도적 트레이드오프다. 그 대가로 진짜 corruption(구조적으로 발생 안 함) 케이스는 RUNNING orphan row로 잔류할 수 있고, `recoverStuckExecutions`/`failOrphanRunningNodeExecutions` 백스톱이 Execution이 이미 `failed`(terminal)라 이 케이스에 닿지 않는다는 점까지 JSDoc이 실측으로 명시한다. `plan/in-progress/retry-turn-terminal-guard.md` #15(P2)에 후속으로 이미 등재돼 있어 별도 조치 요구 없이 인지 사항으로만 기록한다. 보안 취약점이라기보다 관측성/정합성 gap이며 신규 도입이 아니다.

- **[INFO]** `execution.error`에 원시 예외 메시지 저장 — 코드베이스 전역 기존 관행(diff 밖)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:926-934`(`failRetryExecution`의 `execution.error = { message: errMessage }`)
  - 상세: `error instanceof Error ? error.message : String(error)`를 그대로 `Execution.error`에 저장하고, 이는 `EXECUTION_FAILED` WS emit과 REST `GET /executions/:id`로 해당 워크스페이스 소유자에게 노출된다. 이 함수 자체는 이번 diff의 변경 대상이 아니고(git diff 무변경), `execution-engine.service.ts`의 형제 메서드(`failFirstSegmentSetup` 등)에도 동일 패턴이 있어 코드베이스 전역 기존 관행이다. 노출 대상이 이미 인증+소유권 검증을 거친 실행 소유자로 한정되므로(권한 없는 제3자 노출 아님) 심각도는 낮다. 이번 리뷰 대상 diff가 새로 유발한 문제는 아니라 조치 불요, 점검 관점 커버리지를 위해 기록만 남긴다.

## 요약

이번 diff는 `execution.retry_last_turn` 재진입의 `FAILED → RUNNING`/`FAILED → WAITING_FOR_INPUT`
짝 전이가 DB 가드에 막혀 절대 persist되지 않던 기능적 결함(8R CRITICAL)을 고치면서, 상태머신
opt-in(`allowRetryReentry`)과 DB 가드(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)를 정확히 대칭
전파했다. 이 opt-in이 열어주는 예외는 FAILED→RUNNING/WAITING_FOR_INPUT 두 전이로 좁게 한정되고,
`true`로 세팅되는 유일한 지점이 인증·workspace 소유권 검증을 통과한 `execution.retry_last_turn`
내부 경로의 하드코딩 리터럴뿐임을 호출 그래프 추적으로 확인했다 — 외부 입력이 이 플래그에
직접 도달하는 경로는 없다. SQL 구성에 쓰인 두 상수(`NON_TERMINAL_(OR_FAILED_)STATUSES_SQL`,
`RETRY_STATE_KEY`)는 모두 고정 enum/리터럴에서만 파생돼 인젝션 표면이 없다. 2차 원자 claim
(`claimSpawnedRetryRow`)은 BullMQ 재배달로 인한 AI turn 중복 실행을 CAS 패턴으로 올바르게
차단하며, 부수적으로 `_retryState`가 WS emit에서 완전히 제거돼 노출 표면이 줄었다. 남은 항목은
전부 INFO 수준으로, 이미 별도 plan에 추적 중인 가용성 트레이드오프이거나 diff 범위 밖의 기존
관행이다. Critical/Warning급 신규 보안 결함은 발견되지 않았다.

## 위험도

LOW
