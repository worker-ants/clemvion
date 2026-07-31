# Security Review — retry 재진입 짝 전이 DB 가드 정합화 (8R CRITICAL fix)

대상 커밋: `2ca44b769` "fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)"
대상 파일: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`,
`engine-driver.interface.ts`, `retry-turn.service.ts` (+ 대응 `*.spec.ts`, `spec/5-system/4-execution-engine.md`).

## 발견사항

- **[INFO]** 이번 fix 는 새 취약점을 도입하지 않으며, 오히려 기존의 결정적 정보 노출/오분류 결함을 제거한다
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:63-83`(`canTransition`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8168-8184`(`lockNonTerminalExecutionRow`), `:8224-8253`(`tryLockActiveExecutionAndSaveNodeExec`), `:8354-8493`(`updateExecutionStatus`), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:430-467`(`reparkAiResumeTurn`), `:1426-1629`(`finalizeAiNode`)
  - 상세: 이 커밋은 in-memory 상태머신 게이트(`assertTransition`)와 DB 레벨 가드(`lockNonTerminalExecutionRow` FOR UPDATE 조회 / `updateExecutionStatus` else 분기 guarded UPDATE / `tryLockActiveExecutionAndSaveNodeExec`) 사이에 있던 불일치를 닫는다. `allowRetryReentry` 플래그가 전파되는 전체 경로를 프로덕션 소스 전수 grep(`allowRetryReentry` 참조 전체)으로 추적한 결과, 이 boolean 은 오직 `RetryTurnService.applyRetryLastTurn` → `AiTurnOrchestrator.processAiResumeTurn(..., { retryReentry: true })` 호출 체인에서만 리터럴 `true` 로 세팅되며, 사용자 입력(`data.executionId`/`data.nodeExecutionId` 등)이 이 boolean 에 직접 도달하는 경로는 없다. `execution.retry_last_turn` WS 진입점(`websocket.gateway.ts:787` `handleRetryLastTurn`)은 이번 diff 로 변경되지 않은 기존 인증(`getCommandAuthContext`)/소유권(`verifyExecutionOwnership`) 게이트를 그대로 통과해야 도달 가능하다.
    `ALLOWED_TRANSITIONS[ExecutionStatus.FAILED]` 는 여전히 `[]` 로 유지되고, opt-in 대상도 `RUNNING`/`WAITING_FOR_INPUT` 두 값으로만 명시적으로 제한된다 — 신규 `state-machine.spec.ts` 테스트("should keep failed terminal for every other target even with opt-in")가 opt-in 상태에서도 `COMPLETED`/`CANCELLED`/`PENDING` 으로의 전이가 여전히 거부됨을 검증한다. DB 레벨의 `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(`execution-engine.service.ts:534-543`)도 동일하게 `COMPLETED`/`CANCELLED` 를 계속 배제하므로, "실패 종결 실행의 우발적 부활 차단"이라는 핵심 방어 경계는 좁게 유지된 채 FAILED 한 값만 정확히 열렸다.
    부수적으로, 수정 전에는 이 두 레이어(상태머신 vs DB 가드)의 불일치 때문에 재진입 시 (a) 살아있는 spawn row 가 "동시 cancel 선점" 으로 오판돼 정상 재실패가 취소로 오분류되거나, (b) `assertTransition` 이 결정적으로 throw 하고 그 일반 예외 메시지(`Invalid state transition: cannot transition from "failed" to "waiting_for_input"`)가 `EXECUTION_FAILED` WS payload 로 그대로 노출되는 문제가 있었다(CWE-209 계열의 경미한 내부 구현 노출). 이번 수정으로 이 경로 자체가 사라져 노출 표면이 줄었다.
  - 제안: 조치 불필요.

- **[WARNING]** 보안/무결성에 관여하는 `allowRetryReentry` 게이트가 3곳 이상의 개별 SQL 조립 지점에 손으로 fan-out 되는 구조 — 이미 한 번 재발한 이력이 있어 향후에도 회귀 위험이 남는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8173-8175`(`lockNonTerminalExecutionRow` 내부 삼항 선택), `:8459-8461`(`updateExecutionStatus` else 분기 인라인 삼항 선택), `:8224-8253`(`tryLockActiveExecutionAndSaveNodeExec` — 위 helper 호출부)
  - 상세: 이번 커밋 자체의 커밋 메시지가 이 fan-out 구조의 취약성을 실증한다 — "리뷰어는 2경로만 지목했으나 실측으로 3곳임을 확인해 함께 수정" 이라고 명시돼 있다. 즉 "FAILED 상태를 되살릴 수 있는 조건"을 판정하는 로직이 (1) `state-machine.ts` 의 `canTransition` opt-in 분기, (2) `lockNonTerminalExecutionRow` 내부 SQL 리스트 선택, (3) `updateExecutionStatus` else 분기의 별도 인라인 삼항식, (4) 그 둘을 각각 소비하는 `tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` 호출부들로 분산돼 있다. 이런 구조에서는 향후 (i) 이 가드를 쓰는 4번째 소비처가 추가되거나, (ii) 기존 3곳 중 하나가 리팩터링되면서 `opts` 전달을 빠뜨리면 — 이번처럼 fail-closed 방향(가용성 저하, 지금 이 버그)으로 재발하거나, 반대로 opts 체크 없이 FAILED 를 무조건 포함하도록 잘못 고치면 fail-open 방향(진짜 보안/무결성 문제 — "실패 종결 실행의 우발적 부활 차단"이 뚫림)으로도 재발할 수 있다. 이번 라운드는 mutation testing(5/5 RED, 정방향+역방향 뮤턴트 모두 커버)으로 현재 3+1 지점을 모두 회귀 테스트로 잠갔으나, 구조적 fan-out 자체는 그대로 남아 있어 다음 변경에서 동일 클래스의 실수가 또 나올 수 있다.
  - 제안: `updateExecutionStatus` else 분기의 `elseStatusesSql` 삼항(8459-8461)을 `lockNonTerminalExecutionRow` 와 동일하게 단일 `private static resolveGuardStatusesSql(opts)` 헬퍼로 추출해 3곳 모두 이 한 함수만 호출하도록 통합할 것을 권장한다. 최소한 "opts.allowRetryReentry 를 받아야 하는 모든 가드 함수" 목록을 타입 또는 JSDoc 한 곳에 열거해, 새 소비처 추가 시 체크리스트로 쓸 수 있게 하는 것을 고려.

- **[INFO]** Raw SQL 문자열 보간 재확인 — 인젝션 벡터 아님 (전 라운드 결론과 일치)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:505-518`(`NON_TERMINAL_STATUSES_SQL`), `:520-543`(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`, 이번 diff 신설), `:8176-8181`, `:8462-8473`
  - 상세: 신설된 `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 을 포함해 두 상수 모두 `Object.values(ExecutionStatus)`(`execution.entity.ts` 의 고정 6-값 TS enum: `pending/running/completed/failed/cancelled/waiting_for_input`)에서만 파생돼 raw SQL 문자열에 보간된다 — enum 정의를 직접 열어 사용자 입력으로 값이 추가/변경될 수 없음을 확인했다. 실제 가변 입력(`executionId` 등)은 전부 파라미터 바인딩(`$1`, `:id`)으로 처리된다. 인젝션 위험 없음.
  - 제안: 조치 불필요.

- **[INFO]** 인증/인가 경로 무변경 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:787-841`(`handleRetryLastTurn`)
  - 상세: 이번 diff 는 `execution.retry_last_turn` 의 인증(`getCommandAuthContext`) / 소유권(`verifyExecutionOwnership`, 실패 시 FORBIDDEN 대신 NOT_FOUND 로 통일해 존재 여부 추론을 차단하는 IDOR 방어) 게이트를 전혀 건드리지 않는다. `retryLastTurn`/`applyRetryLastTurn` 내부의 `nodeExec.executionId !== executionId`, `spawnedRow.executionId !== executionId` cross-execution 소유 검증도 이번 diff 범위 밖(무변경)으로 그대로 유지된다. 인가 회귀 없음.
  - 제안: 조치 불필요.

- **[INFO]** 이미 추적 중인 잔여 하우스키핑 갭 재확인 (보안 사안 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:485-537`(`claimSpawnedRetryRow` JSDoc "알려진 백스톱 갭")
  - 상세: 문서화된 대로 `claimSpawnedRetryRow` 2차 claim 이 실패해 discard 되면, 그 spawn 된 `NodeExecution` 이 RUNNING orphan 으로 남을 수 있다 — 부모 Execution 이 이미 `failed`(terminal) 라 `recoverStuckExecutions` 의 stale-RUNNING-**Execution** 재구동 대상이 아니기 때문이다. 이번 커밋이 새로 만든 문제가 아니라 이전 라운드에 실측·문서화되어 `plan/in-progress/retry-turn-terminal-guard.md` 후속 항목으로 이미 등재된 하우스키핑 성격의 갭이며, 인증/인가 우회나 데이터 노출로 이어지지 않는다(영향은 진행률/타임라인 집계 왜곡 정도).
  - 제안: 이번 라운드 추가 조치 불요 — 기존 plan 항목 진행으로 충분.

## 검증한 항목 (문제 없음 확인)

- **하드코딩된 시크릿**: 이번 diff 5개 소스 파일 + 3개 spec 파일에서 API 키/비밀번호/토큰/인증서 패턴 없음.
- **XSS/커맨드 인젝션/경로 탐색/LDAP 인젝션**: 해당 없음 — 이번 diff 는 상태 전이 게이트/SQL 가드/orchestrator 위임 로직만 다루며 HTML 렌더링·셸 실행·파일시스템 경로 조작 코드 없음.
- **암호화**: 해당 없음.
- **의존성 보안**: 신규 의존성 추가 없음.
- **에러 처리**: `state-machine.ts` 의 `assertTransition` 예외 메시지는 상태 enum 리터럴(`from`/`to`)만 포함하고 스택트레이스·DB 세부정보·시크릿을 포함하지 않는다. `retryLastTurn`/`RetryTurnService` 가 던지는 도메인 에러(`RetryLastTurnError.*`, `InvalidExecutionStateError`)도 호출자가 이미 아는 ID 만 echo — 이번 diff 범위에서 새로운 민감정보 노출 없음 (오히려 위 첫 INFO 항목대로 노출 경로 하나가 사라짐).
- **로깅**: 이번 diff 가 추가한 로그(`applyRetryLastTurn` 관련 debug/warn/error)는 ID·상태값만 포함하며 `_retryState`/대화 메시지 등 PII 가능 필드를 남기지 않는다(기존 로깅 관례와 일치).

## 요약

이 변경(8R CRITICAL fix)은 `execution.retry_last_turn` 재진입의 FAILED→RUNNING/FAILED→WAITING_FOR_INPUT 짝 전이가 in-memory 상태머신(opt-in 허용)과 DB 레벨 가드(FAILED 무조건 배제) 사이의 불일치로 인해 구조적으로 절대 persist 되지 않던 기능 결함을 닫는다. `allowRetryReentry` 게이트는 인증·소유권 검증을 통과한 내부 서버 코드 경로에서만 리터럴로 세팅되고, 사용자 입력이 직접 이 boolean 에 도달할 수 없음을 전체 참조 추적으로 확인했다. `ALLOWED_TRANSITIONS[FAILED]` 는 여전히 빈 배열로 유지되고 DB 가드도 COMPLETED/CANCELLED 를 계속 배제하므로 "실패 종결 실행의 우발적 부활 차단"이라는 핵심 방어 경계는 정확히 FAILED→{RUNNING,WAITING_FOR_INPUT} 두 전이로만 좁게 확장됐다 — 신규 정방향/역방향 mutation 테스트(state-machine.spec.ts, execution-engine.service.spec.ts)가 이를 회귀 잠금했다. SQL 문자열 보간은 여전히 고정 TS enum 값만 사용해 인젝션 벡터가 아니며, 인증/인가 경로도 무변경이다. 부수적으로 이번 수정은 재진입 실패가 취소로 오분류되거나 내부 상태전이 예외 메시지가 WS payload 로 노출되던 기존 결함도 함께 제거해 보안적으로 순개선이다. 다만 이번 커밋의 커밋 메시지 자체가 인정하듯 이 보안/무결성 게이트가 이미 한 번(2곳→3곳) fan-out 누락으로 재발한 이력이 있어, 동일 로직을 단일 헬퍼로 통합할 것을 유지보수성/향후 회귀 방지 차원에서 WARNING 으로 권고한다. 새로 도입된 인젝션·시크릿·인가 우회 취약점은 없다.

## 위험도

LOW
