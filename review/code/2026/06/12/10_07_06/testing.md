# 테스트(Testing) 리뷰

## 발견사항

### - **[CRITICAL]** `DB_HOST_BLOCKED` SSRF 가드 테스트 전체 삭제 — 커버리지 공백
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` (130줄 삭제)
  - 상세: 이번 변경으로 `database-query.handler.spec.ts` 에서 `SSRF host guard (DB_HOST_BLOCKED)` describe 블록이 완전히 제거되었다. 삭제된 테스트는 다음 케이스를 커버했다:
    - IPv4 loopback(`127.0.0.1`), RFC1918(`10.0.0.5`), cloud IMDS(`169.254.169.254`), `localhost` 이름 차단
    - MySQL 드라이버에서도 가드가 driver 분기 전에 실행됨을 검증
    - `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 시 차단 면제
    - 차단 시 메시지에 실제 host/IP가 포함되지 않는 일반화 문구 검증
    - `logUsage` 에 차단 에러 코드가 기록됨을 검증
    동시에 구현(`database-query.handler.ts`)에서는 `DB_HOST_BLOCKED` 전용 승격 로직(catch -> `IntegrationError('DB_HOST_BLOCKED', ...)`)이 삭제되고 `assertSafeOutboundHostResolved` 예외가 `mapDbError` fallback(`INTEGRATION_CALL_FAILED`)으로 흐르도록 변경되었다. 즉 DB SSRF 차단이 이제 `DB_HOST_BLOCKED` 대신 `INTEGRATION_CALL_FAILED` 로 나오는 동작 변경이 있음에도 이 동작을 검증하는 테스트가 전혀 없다.
  - 제안: 최소한 다음을 커버하는 테스트를 복원해야 한다:
    1. `127.0.0.1` 등 사설 host -> `port: 'error'` + `output.error.code`가 무엇인지 검증
    2. `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 시 가드 통과 검증
    3. 가드 실행 시 DB 연결 풀이 생성되지 않음을 검증(`connectMock` not called)

### - **[CRITICAL]** `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` / `DB_HOST_BLOCKED` `INTERNAL_CODES` 등재 테스트 삭제 — no-warn 로그 경로 미검증
  - 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` (W1 describe 블록 삭제)
  - 상세: 삭제된 테스트는 `CODE_MEMORY_LIMIT`, `HTTP_BLOCKED`, `DB_HOST_BLOCKED` 세 코드가 `INTERNAL_CODES` Set에 등재되어 `executionFailedInternal`로 분류되면서 `CCH-ERR-04 warn` 로그를 남기지 않는다는 것을 명시적으로 검증했다. 이번 변경으로 이 세 코드가 `INTERNAL_CODES`에서 제거되었으므로, 이제 이 코드들이 들어올 때 warn 로그를 남기는지(unknown fallback 경로) 혹은 어느 분기로 처리되는지 테스트가 전혀 없다. 특히 `HTTP_BLOCKED`는 HTTP 노드에서 실제로 발생하는 코드인데 chat-channel 분류 경로의 동작이 검증되지 않은 상태다.
  - 제안: `HTTP_BLOCKED`, `CODE_MEMORY_LIMIT`이 현재 `execution-failure-classifier`에서 어느 경로(unknown fallback -> `executionFailedInternal`? 혹은 다른 분기?)로 처리되는지 검증하는 테스트를 추가해야 한다. warn 로그 발생 여부도 포함.

### - **[WARNING]** `LEGACY_TO_NORMALIZED` 폴백 변경 — 미등재 에러 코드 pass-through 테스트 없음
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 420
  - 상세: 변경 전 코드는 `LEGACY_TO_NORMALIZED[errorCode] ?? ErrorCode.CODE_EXECUTION_FAILED`(미등재 시 `CODE_EXECUTION_FAILED` 고정)였다. 변경 후 `LEGACY_TO_NORMALIZED[errorCode] ?? errorCode`(미등재 시 raw 코드 pass-through)이다. 이 변경은 `classifyError`가 `CodeNodeInternalErrorCode` 타입 대신 `string` 반환으로 느슨해진 것과 맞물린다. 현재 테스트는 미등재 에러 코드가 `failure()`를 통해 `output.error.code`에 어떤 값으로 노출되는지 검증하지 않는다. 만약 `classifyError`가 예상치 못한 문자열을 반환하면 그대로 클라이언트에 노출될 수 있다.
  - 제안: `failure()` 경로에서 미등재 내부 에러 코드(예: 임의 문자열)가 `output.error.code`에 그대로 노출되는지 또는 fallback 코드로 대체되는지 검증하는 단위 테스트 추가.

### - **[WARNING]** `classifyError` 이름 변경 — 이전 `classifyCodeNodeError` 명칭 선택 이유 소멸
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` line 473, `code.handler.spec.ts` line 1
  - 상세: 이전 코드는 함수명을 `classifyCodeNodeError`로 정하면서 JSDoc에 "grep 충돌 회피 목적 (cafe24/makeshop 의 동명 private 메서드와 구별)"이라고 명시했다. 이번 변경으로 `classifyError`로 이름을 변경했는데, 같은 파일에서 `makeshop-mcp-tool-provider.ts:714`와 `cafe24-mcp-tool-provider.ts:726`에도 동명의 `private classifyError` 메서드가 존재한다. 모듈 스코프이므로 실제 충돌은 없지만, 이름 변경 이유가 테스트나 코멘트에 기록되지 않았다.
  - 제안: `code.handler.spec.ts`의 W9 describe 코멘트를 갱신해 이름 변경 이유를 명시. 이전 코드의 JSDoc 이유가 왜 더 이상 유효하지 않은지 기록.

### - **[WARNING]** `DB_HOST_BLOCKED` ErrorCode enum 삭제 — SSRF 차단 경로 타입 안전성 테스트 부재
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (line 30 삭제)
  - 상세: `ErrorCode.DB_HOST_BLOCKED` 상수가 `error-codes.ts`에서 삭제되었다. `database-query.handler.ts`는 이제 `assertSafeOutboundHostResolved`의 예외를 catch하지 않고 plain Error가 `mapDbError`로 흐르는데, 이 경로에서 어떤 코드가 출력되는지 테스트 없이는 검증되지 않는다. `http-request.handler.ts`도 `ErrorCode.HTTP_BLOCKED` -> `'HTTP_BLOCKED'` 문자열 리터럴로 변경되어 컴파일 타임 타입 체크를 우회한다.
  - 제안: `assertSafeOutboundHostResolved` 예외 발생 시 `database-query` 출력 `output.error.code`가 특정 값임을 검증하는 통합 테스트 또는 단위 테스트 추가. 현재는 이 경로의 결과가 전혀 검증되지 않는다.

### - **[INFO]** `execution-failure-classifier.spec.ts` `.each` 배열 축소 후 unknown fallback 경로 미검증
  - 위치: `execution-failure-classifier.spec.ts` line 105 근방
  - 상세: `INTERNAL_CODES` Set에서 제거된 세 코드를 `.each` 배열에서 삭제한 것은 구현과 일치한다. 그러나 이 세 코드가 이제 `classifyExecutionFailure`에 들어오면 unknown fallback 경로로 처리된다. 이 경로가 여전히 올바른 `key: 'executionFailedInternal'`를 반환하는지, warn 로그는 발생하는지 검증하는 테스트가 빠져있다.
  - 제안: `HTTP_BLOCKED`, `CODE_MEMORY_LIMIT`을 입력으로 주면 `key: 'executionFailedInternal'`가 반환되되 warn 로그도 발생함을 검증하는 테스트 추가.

### - **[INFO]** `http-request.handler.ts` `ErrorCode.HTTP_BLOCKED` -> `'HTTP_BLOCKED'` 문자열 리터럴 변경 — 기존 테스트는 통과하나 타입 안전성 약화
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 354, 363
  - 상세: `ErrorCode.HTTP_BLOCKED` 참조를 문자열 리터럴 `'HTTP_BLOCKED'`로 대체하였다. 기존 http-request spec은 `output.error.code === 'HTTP_BLOCKED'`를 검증하므로 테스트는 통과한다. 그러나 `ErrorCode` enum의 `HTTP_BLOCKED` 상수값이 나중에 변경되면 이 하드코딩 문자열과 불일치가 발생할 수 있다. 현재 테스트가 이 동작을 커버하므로 CRITICAL은 아니지만, 장기적 유지보수 위험이 있다.
  - 제안: 특별한 추가 조치는 불필요하나, `ErrorCode` enum 참조를 유지하거나 문자열 상수를 `http-safety.ts`에 집중 정의하는 것이 더 안전하다.

---

## 요약

이번 변경의 테스트 관점 핵심 문제는 두 가지 CRITICAL 커버리지 공백이다. 첫째, DB SSRF 가드 테스트 전체(130줄)가 삭제되면서 구현도 동시에 변경(`DB_HOST_BLOCKED` 전용 승격 -> `INTEGRATION_CALL_FAILED` fallback)되었으나 새 동작을 검증하는 테스트가 전혀 없다. 이는 보안 가드의 실제 동작이 미검증된 상태임을 의미한다. 둘째, `execution-failure-classifier`에서 `HTTP_BLOCKED`·`CODE_MEMORY_LIMIT`·`DB_HOST_BLOCKED`의 `INTERNAL_CODES` 등재 제거와 함께 이 코드들의 chat-channel 분류 경로 검증 테스트가 삭제되었다. `LEGACY_TO_NORMALIZED` 폴백 완화(`CODE_EXECUTION_FAILED` 고정 -> raw pass-through)도 미등재 코드 노출 가능성을 테스트 없이 도입했다. 반면 `classifyError` 단위 테스트 자체는 이름 변경만 반영해 내용은 유효하게 유지되고 있으며, http-request SSRF 테스트는 기존 커버리지를 그대로 보유하고 있다.

## 위험도

HIGH

---

STATUS: SUCCESS
