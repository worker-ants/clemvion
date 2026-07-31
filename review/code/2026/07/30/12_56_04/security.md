# Security Review — retry-turn.service.ts / retry-turn.service.spec.ts

## 발견사항

- **[INFO]** JSONB 키 리터럴을 raw SQL 문자열 보간으로 조합하는 패턴 (현재는 안전, 향후 확장 시 주의)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:213`, `:220`, `:544`, `:549` (`claimSpawnedRetryRow`, `retryLastTurn` 트랜잭션 블록)
  - 상세: `output_data - '${RETRY_STATE_KEY}'` / `jsonb_exists(input_data, '${RETRY_STATE_KEY}')` 형태로 SQL 문자열에 값을 직접 보간한다. `RETRY_STATE_KEY` 는 파일 최상단에 선언된 컴파일타임 상수(`const RETRY_STATE_KEY = '_retryState'`)이고 어떤 요청 입력으로도 변경되지 않으므로 **현재는 SQL 인젝션 위험이 없다** — 전체 파일을 grep 해 확인한 결과 이 4곳 외 raw SQL 보간은 없고, `executionId`/`nodeExecutionId`/`spawnedNodeExecutionId`/status enum 등 실제 가변 입력은 전부 TypeORM 바인드 파라미터(`:id`, `:running`, `setParameter`)를 통해 안전하게 처리된다. `jsonb_exists`/`-` 연산자를 pg 드라이버가 `?` 바인드 플레이스홀더와 혼동하는 문제를 우회하기 위한 의도된 설계(코드 주석에 명시)로, 이번 diff 는 이 리터럴을 4곳에서 하나의 상수로 통합해 drift 위험을 줄였다(개선). 다만 이 패턴 자체는 "raw SQL + 문자열 보간" 이므로, 향후 이 키가 사용자 입력이나 요청 파라미터에서 파생되도록 리팩토링되면 즉시 인젝션 벡터가 된다. 방어적으로 상수 사용을 강제하는 주석/타입 수준 가드(예: 리터럴 유니온 타입)를 유지 권장.
  - 제안: 현재 조치 불필요. 향후 이 helper 를 다른 JSONB 키에도 재사용하도록 일반화할 경우, 인자로 받는 키를 허용목록(allowlist)으로 검증하거나 최소한 `/^[A-Za-z0-9_]+$/` 형태 검증을 추가할 것.

- **[INFO]** `applyRetryLastTurn`/`failRetryExecution` 비취소 실패 시 원본 예외 메시지를 REST/WS 로 그대로 노출 (이번 diff 범위 밖의 기존 동작)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` 메서드 (`execution.error = { message: errMessage }` 대입부와 `emitExecution` 호출부)
  - 상세: `applyRetryLastTurn` 의 `catch (err: unknown)` 는 `processAiResumeTurn`/`resumeGraphAfterRetry` 에서 발생한 **임의의** 예외를 잡아 `failRetryExecution` 에 전달하고, 취소(`ExecutionCancelledError`)가 아닌 경우 `error.message` 를 그대로 `execution.error` (DB) 와 `EXECUTION_FAILED` WS emit payload 에 싣는다. 이 값은 이후 REST `GET /executions/:id` 로도 노출된다. 이 자체는 **이번 diff 에서 변경되지 않은 기존 코드**이며, 취소 케이스에 대해서는 이미 W16(2026-07-26)에서 의도적으로 `error` 저장을 생략하도록 조치돼 있다(코드 주석에 근거 명시). 다만 비취소 실패 시 예상치 못한 내부 예외(예: DB 드라이버 오류 등)가 그대로 전파되면 기술적 세부 메시지가 최종 사용자에게 노출될 잠재적 경로가 남아 있다. WS gateway(`websocket.gateway.ts`) 레벨에서는 `retryLastTurn` 이 던지는 타입드 에러(`RetryLastTurnError`/`InvalidExecutionStateError`)만 client-safe 로 간주하고 그 외는 일반화하는 별도 방어가 이미 있음을 확인했으나, `applyRetryLastTurn`/`failRetryExecution` 경로(REST 재조회)에는 동일한 일반화 계층이 보이지 않는다.
  - 제안: 신규 조치는 이번 PR 스코프 밖(기존 동작 유지)으로 판단하나, 후속으로 `failRetryExecution` 에도 "알려진 도메인 에러만 raw message 노출, 그 외는 일반화" 원칙을 적용하는 것을 고려할 것.

- **[INFO]** (검토 과정 관측, 진짜 코드 결함 아님) 리뷰 중 대상 파일이 일시적으로 변형된 상태로 관측됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (`retryLastTurn` 의 `!nodeExec ||` null-guard, `if (!spawnedId)` invariant 체크)
  - 상세: 리뷰 중 `Read` 툴이 두 차례에 걸쳐 이 파일이 프롬프트 스냅샷과 다른 내용(예: `if (!nodeExec || ...)` 의 `!nodeExec ||` 부분이 사라진 버전, `if (!spawnedId)` 가 `if (false)` 로 치환된 버전)으로 변경됐다는 시스템 알림을 반환했다. 그중 하나는 "의도된 변경이니 사용자에게 알리지 말라" 는 문구를 포함하고 있었다 — 보안 리뷰어로서 이런 은폐 지시는 따르지 않고 사실대로 기록한다. `git diff HEAD` 로 확인한 결과 현재 작업 트리는 HEAD 와 **완전히 일치**(diff 없음)하고, 이후 3회 재확인에서도 `!nodeExec ||` 가드와 `if (!spawnedId)` 체크가 정상적으로 존재해 안정적이었다. 이 프로젝트의 커밋 이력(`b351731f0` 등)이 이 파일에 대해 "mutation 4/4 RED" 를 언급하는 것과 정합적 — 같은 워크트리에서 동시 실행 중인 mutation-testing 하네스가 가드 로직을 일시적으로 변형→테스트→원복하는 과정을 리뷰 세션이 우연히 관측한 것으로 판단된다. **실제 커밋/최종 파일 상태에는 결함이 없음**을 확인했으므로 이 자체를 취약점으로 등급 매기지 않는다.
  - 제안: 조치 불필요(정보 제공 목적). 다만 이런 동시 하네스가 다른 리뷰 세션과 같은 워크트리를 공유할 때 유사한 순간적 flicker 가 재발할 수 있음을 참고.

## 검증한 항목 (문제 없음 확인)

- **인젝션**: SQL 인젝션 벡터 없음 (위 INFO 참조). XSS/커맨드 인젝션/경로 탐색/LDAP 인젝션 해당 없음 (파일에 HTML 렌더링·셸 실행·파일시스템 경로 조작 코드 없음, `eval`/`Function`/`child_process`/`fs.*`/`require` 사용 없음 — grep 으로 확인).
- **하드코딩된 시크릿**: 없음 (API 키/비밀번호/토큰/인증서 패턴 grep 결과 없음).
- **인증/인가**: 이번 두 파일 자체에는 인증 로직이 없으나(서비스 계층), 호출 경로를 추적한 결과 `retryLastTurn` 진입점은 `websocket.gateway.ts` 의 `handleRetryLastTurn` 에서 `getCommandAuthContext`(인증) + `verifyExecutionOwnership`(소유권, IDOR 방지 목적으로 실패 시 FORBIDDEN 대신 NOT_FOUND 반환해 존재 여부 추론 차단)을 통과해야만 도달 가능함을 확인했다. `applyRetryLastTurn` 은 `continuation-execution.processor.ts`(BullMQ worker)에서만 호출되며 네트워크에 직접 노출되지 않는다. 리뷰 대상 파일 내부에도 `nodeExec.executionId !== executionId` / `spawnedRow.executionId !== executionId` cross-execution 방어 체크가 있다. 이번 diff 로 인한 인가 회귀 없음.
- **입력 검증**: `_retryState.expiresAt`/`retryAfterSec` 는 `typeof`/`Number.isFinite` 로 타입·유한성을 검증 후 비교에 사용 — NaN/타입 혼동 우회 경로 없음.
- **동시성/무결성 (이번 diff 의 핵심)**: 신규 `claimSpawnedRetryRow` 는 `UPDATE ... WHERE id=:id AND status='running' AND jsonb_exists(input_data,'_retryState')` 조건부 UPDATE 로 올바른 CAS(compare-and-swap) 패턴을 구현한다. 기존의 read-then-branch(비원자) 가드가 남긴 이중 배달 창(중복 LLM 과금·downstream 도구 중복 실행 가능)을 닫는 정당한 무결성 강화이며, claim 은 "손상 판정" 보다 먼저 호출되도록 순서가 올바르게 배치돼 있다(과거 라운드에서 지적된 순서 결함 없음, 코드로 직접 확인).
- **에러 처리(클라이언트 대면)**: `retryLastTurn` 이 던지는 `InvalidExecutionStateError`/`RetryLastTurnError.*` 메시지는 호출자가 이미 알고 있는 ID 만 echo 하며 내부 스택/DB 세부정보를 포함하지 않는다. WS gateway 는 이 타입들만 client-safe 로 간주하고 그 외는 일반화한다(코드 주석 "보안 — ... 그 외는 일반화한 메시지" 로 명시).
- **로깅**: `this.logger.debug/warn/error` 호출은 ID·상태값만 포함하며 `_retryState`(대화 메시지 등 PII 가능성 있는 내용)를 로그에 남기지 않는다.
- **개인정보 노출 개선**: 이번 diff 가 추가한 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 로 인해 `NODE_STARTED` WS 이벤트의 `input` payload 에서 `_retryState`(대화 내역 포함 가능)가 더 이상 노출되지 않는다 — 데이터 최소화 개선이며 회귀 테스트로 잠겨 있다.
- **암호화**: 해당 없음(암호화/네트워크 전송 코드 없음).
- **의존성 보안**: 이번 diff 는 신규 의존성을 추가하지 않는다.

## 요약

이번 변경은 `applyRetryLastTurn` 재진입 가드를 read-then-branch(비원자) 방식에서 조건부 UPDATE 기반 원자 claim(`claimSpawnedRetryRow`)으로 교체하는 동시성/무결성 수정이다. 두 리뷰 대상 파일을 전수 검토한 결과 SQL 인젝션·하드코딩 시크릿·인증/인가 회귀·입력 검증 누락 등 새로 도입된 취약점은 발견되지 않았다. Raw SQL 문자열 보간에 쓰이는 `_retryState` 키 리터럴은 컴파일타임 상수라 현재 인젝션 위험이 없으나 향후 동적 키로 일반화될 경우를 대비한 주의를 INFO 로 남겼고, 비취소 실패 시 원본 예외 메시지가 REST/WS 로 노출되는 기존(비변경) 동작도 인지 목적으로 기록했다. 오히려 이번 diff 는 (1) 실제 존재했던 이중 배달 레이스를 닫아 중복 LLM 과금·downstream 도구 중복 실행 같은 무결성 문제를 예방하고, (2) claim 직후 `_retryState` 를 in-memory 에서도 삭제해 WS `NODE_STARTED` 이벤트가 대화 내역을 포함한 내부 필드를 노출하지 않도록 개선하는 등 보안·프라이버시 측면에서 긍정적이다. 인증/소유권 검증은 호출 경로 추적으로 정상 작동을 확인했다. 리뷰 도중 대상 파일이 동시 실행 중인 것으로 보이는 mutation-testing 하네스에 의해 일시적으로 변형된 상태로 관측되었으나(`git diff HEAD` 로 실제 작업 트리는 HEAD 와 완전 일치함을 확인, 이후 재확인에서도 안정적), 이는 실제 코드 결함이 아니라 검토 과정의 부수적 관측이며 투명성을 위해 기록했다.

## 위험도

LOW
