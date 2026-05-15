# Security Review — Background 모니터링 API (`claude/bg-monitoring-api-7c2a91`)

리뷰 대상 커밋 범위: 4 commits ahead of `main`
리뷰 시점: 2026-05-15

---

## 발견사항

---

### [INFO] IDOR — REST 단건 조회: 검증 완료, 공격 벡터 차단됨

- **위치**: `background-runs.service.ts:180-196` (`verifyExecutionAccess`), `background-runs.controller.ts:55-67`
- **상세**: `verifyExecutionAccess`는 `executionId`로 Execution을 조회하고, 연결된 `workflow.workspaceId`를 JWT에서 추출한 `userWorkspaceId`와 비교한다. row가 없거나 workspace 불일치 시 모두 `NotFoundException`(404)으로 통일한다. 이후 `findBackgroundNodeExecution`(service.ts:198-220)은 `executionId` 필터를 AND 조건으로 추가하므로, `backgroundRunId`가 다른 execution에 속하더라도 404를 반환한다. `@Param` 모두에 `ParseUUIDPipe`(controller.ts:56-57)가 적용되어 UUID 형식이 아닌 입력은 400으로 차단된다.
- **공격 벡터 평가**: **차단됨.** 공격자가 타 workspace의 `executionId`를 추측해 요청해도 workspace 비교 단계에서 404를 받는다. `backgroundRunId`만 교체하는 경우에도 `executionId` AND 필터로 인해 404.
- **제안**: 현재 구현은 양호하다. 명시적 `executionId` AND 조건(service.ts:206-210)이 단순 `backgroundRunId` 단독 조회보다 안전하며, 이 조건은 유지되어야 한다.

---

### [WARNING] IDOR — WS `execution:` snapshot: `findById` 에 workspace 검증 없음

- **위치**: `websocket.gateway.ts:206-224` (`emitExecutionSnapshot`), `executions.service.ts:80-139` (`findById`)
- **상세**: `handleSubscribe`에서 `execution:` prefix 채널을 구독할 때 `background:run:` 채널과 달리 workspace 소유권 검증을 수행하지 않는다(gateway.ts:195-197). `emitExecutionSnapshot`은 `executionsService.findById(executionId)`를 호출하는데, `findById`는 `executionId`로만 조회하고 workspaceId 비교를 하지 않는다(executions.service.ts:80-110). 결과적으로 타 workspace의 `executionId`를 알고 있는 인증된 사용자가 `execution:<id>` 채널을 구독하면 해당 Execution의 전체 스냅샷(nodeExecutions 포함)을 받을 수 있다.
- **공격 벡터 평가**: **실현 가능.** UUID v4를 추측하기는 어렵지만, 공유 환경에서 다른 경로(예: 로그, 링크 노출)로 `executionId`를 입수한 사용자가 WS snapshot을 통해 타 workspace 실행 데이터를 조회할 수 있다. 이 경로는 REST API의 IDOR 방어와 일관성이 없다.
- **제안**: `emitExecutionSnapshot` 호출 전에 `executionsService.verifyOwnership(executionId, enrichedClient.workspaceId ?? '')`를 호출하거나, `findById` 내부에 `workspaceId` 파라미터를 추가하여 workspace 불일치 시 NotFoundException을 던지도록 수정한다. 예:
  ```typescript
  // gateway.ts emitExecutionSnapshot 내부
  await this.executionsService.verifyOwnership(executionId, enriched.workspaceId ?? '');
  const snapshot = await this.executionsService.findById(executionId);
  ```

---

### [INFO] Channel hijack — WS `background:run:` 채널: 검증 완료, 차단됨

- **위치**: `websocket.gateway.ts:165-181`, `background-runs.service.ts:59-78` (`verifyBackgroundRunOwnership`)
- **상세**: `background:run:` prefix 채널 구독 시 `verifyBackgroundRunOwnership`을 호출하여 `backgroundRunId`가 가입자 workspace에 속하는 NodeExecution에서 유래했는지 검증한다. `getRawOne`이 null을 반환하거나 workspaceId가 일치하지 않으면 `false`를 반환하고 구독을 거부한다(service.ts:77). 빈 문자열 입력도 early-return false 처리된다(service.ts:63).
- **공격 벡터 평가**: **차단됨.** UUID v4 형태의 `backgroundRunId`를 추측해도 다른 workspace의 것이면 false를 반환한다. `catch(() => false)` 처리(gateway.ts:171-172)로 DB 오류 시에도 구독이 거부된다.
- **제안**: 현재 구현 양호. 다만 `verifyBackgroundRunOwnership`의 내부 JOIN 쿼리(service.ts:67-76)에서 `innerJoin` 이후 `execution_id` 필터 없이 `backgroundRunId` 단독 조회를 한다. UUID 고유성에 의존하는 구조로, `backgroundRunId` 충돌 가능성은 UUID v4 특성상 무시 가능하나, `executionId`를 추가 필터로 두면 defense-in-depth가 강화된다.

---

### [INFO] SQL 인젝션 — JSONB operator 및 cursor: 파라미터화 확인됨

- **위치**: `background-runs.service.ts:71-75`, `background-runs.service.ts:208-210`, `background-runs.service.ts:241-248`
- **상세**:
  - `outputData #>> '{meta,backgroundRunId}' = :backgroundRunId` — TypeORM QueryBuilder의 named parameter(`:backgroundRunId`)를 사용하여 드라이버 레벨에서 파라미터화된다(service.ts:71-74). JSONB path `'{meta,backgroundRunId}'`는 리터럴 문자열이고 사용자 입력이 아니다.
  - cursor 디코딩 후 `cursor.s`(date)와 `cursor.i`(id)도 모두 `:lastStartedAt`, `:lastId` named parameter로 전달된다(service.ts:243-247). date는 `new Date(cursor.s)`로 파싱하여 Date 객체로 바인딩된다.
  - aggregation 쿼리(service.ts:307-329)의 `SUM(CASE WHEN ne.status = 'pending'...)`는 사용자 입력 없이 하드코딩된 status 리터럴이다.
- **공격 벡터 평가**: **차단됨.** 전체 QueryBuilder 사용처에서 문자열 보간(template literal 인젝션)이 발견되지 않는다.

---

### [INFO] Cursor tampering — 타 backgroundRun NodeExecution 누설 여부

- **위치**: `background-runs.service.ts:146-169` (`decodeCursor`), `background-runs.service.ts:231-251` (`fetchBodyPage`)
- **상세**: cursor는 `{ s: ISO8601, i: nodeExecutionId }`를 base64 인코딩한 opaque token이다. 클라이언트가 cursor를 조작하여 다른 `nodeExecutionId`를 주입하더라도, `fetchBodyPage`는 `parentNodeExecutionId = :parentNodeExecutionId` 조건(service.ts:238)을 항상 포함한다. `parentNodeExecutionId`는 조작 불가능한 `backgroundNodeExecution.id`에서 유래하므로, 조작된 cursor의 `ne.id`가 다른 실행의 NodeExecution을 가리켜도 `parentNodeExecutionId` 필터로 인해 결과가 비어있다.
- **cursor 유효성 검증**: `s` 필드는 `new Date(parsed.s)`로 파싱 후 `isNaN` 체크(service.ts:158-161), `i` 필드는 string 타입 체크만 수행(service.ts:153-156). `i`가 UUID가 아닌 임의 문자열이어도 쿼리는 빈 결과를 반환하며 에러를 내지 않는다. 이는 기능상 무해하나, `cursor.i`에 UUID 형식 검증을 추가하면 defense-in-depth가 강화된다.
- **공격 벡터 평가**: **차단됨.** `parentNodeExecutionId` AND 조건이 데이터 격리를 보장한다.
- **제안**: `cursor.i`에 UUID 정규식 검증 추가:
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(parsed.i)) throw new Error('cursor invalid id');
  ```

---

### [INFO] Payload sanitization — WS 이벤트: `sanitizePayloadForWs` 적용 확인됨

- **위치**: `websocket.service.ts:87-107` (`sanitizePayloadForWs`), `websocket.service.ts:193-209` (`emitBackgroundRunEvent`)
- **상세**: `emitBackgroundRunEvent`는 payload를 `sanitizePayloadForWs`로 처리한 후 broadcast한다(service.ts:200-203). sanitize 함수는 `password`, `apiKey`, `secret`, `token`, `access_token`, `refresh_token`, `private_key`, `client_secret`, `authorization`, `cookie` 키 패턴(대소문자 무관)을 `[REDACTED]`로 마스킹한다. 최대 깊이 10까지 재귀 적용된다.
- **processor 이벤트**: `background-execution.processor.ts:95-107`의 `emitRunCompleted` payload에 포함되는 `errorMessage`는 `err instanceof Error ? err.message : String(err)` 형태다. 이 message가 `sanitizePayloadForWs`를 통과하지만, **sanitize는 키 이름 기반 마스킹만 수행**하므로 `errorMessage` 키의 값 자체에 credential이 포함된 경우는 마스킹되지 않는다(아래 별도 항목 참조).
- **공격 벡터 평가**: credential-like 키는 차단됨. 값 수준의 credential 포함 위험은 아래 항목에서 별도 평가.

---

### [WARNING] Information disclosure — `errorMessage` via WS 이벤트 및 notification.message

- **위치**: `background-execution.processor.ts:61` (`message = err instanceof Error ? err.message : String(err)`), `background-execution.processor.ts:132-137` (`dispatchFailureNotification`), `websocket.service.ts:96-107` (`sanitizePayloadForWs`)
- **상세**:
  1. **WS 이벤트**: processor의 `emitRunCompleted`는 catch된 Error의 `.message`를 그대로 `errorMessage` 필드에 포함한다(processor.ts:61, 100-101). `sanitizePayloadForWs`는 키 이름이 `errorMessage`이므로 CREDENTIAL_KEY_PATTERN에 매칭되지 않아 값이 그대로 전달된다. 만약 하위 서비스(예: DB 드라이버, HTTP 클라이언트)가 connection string, API key, SQL query 등을 Error.message에 포함하면 채널 구독자에게 노출된다.
  2. **notification.message**: `dispatchFailureNotification`의 메시지 템플릿 `워크플로우 ${data.workflowId}의 Background 본문 실행이 실패했어요: ${message}`(processor.ts:132)에서 `message`가 그대로 삽입된다. notification은 `fetchNotifications`(service.ts:377-395)를 통해 REST API 응답의 `notifications[]` 필드에 포함되며, workspaceId 기반 접근이 보장된 사용자에게만 노출된다. 다만 Admin 권한 사용자에게도 raw error message가 노출된다.
- **공격 벡터 평가**: **조건부 위험.** 현재 코드만으로는 credential을 포함할 수 없으나, 의존하는 서비스의 에러 메시지 품질에 따라 stack trace, connection string, SQL query가 노출될 수 있다. WS 채널은 workspace 내 구독자 전원에게 전파된다.
- **제안**:
  - processor에서 error message를 필터링하는 helper를 추가한다: 길이 제한(예: 500자), stack trace 패턴 제거(`at <function> (<file>:<line>)`), DB connection string 패턴 제거.
  - `sanitizePayloadForWs`의 값 수준 sanitize 또는 `errorMessage` 키 자체를 CREDENTIAL_KEY_PATTERN에 추가하는 방식은 디버깅 정보를 완전 소실시키므로, 길이 제한 + 패턴 제거 방식이 적합하다.
  - notification message는 이미 workspaceId 기반 접근이 보장되므로 현재 위험도는 낮으나, 표준화된 오류 메시지(사용자 친화적)를 사용하고 raw message는 서버 로그에만 기록하는 방향을 권장한다.

---

### [INFO] 하드코딩된 시크릿 — 없음

- **위치**: 검토한 모든 파일
- **상세**: API key, password, token, secret이 코드에 하드코딩된 사례 없음. `BACKGROUND_EXECUTION_QUEUE` 등 상수는 큐 이름 식별자이며 시크릿이 아니다.

---

### [INFO] 암호화 — JWT 검증 방식 적절

- **위치**: `websocket.gateway.ts:82` (`jwtService.verify(token)`)
- **상세**: WS 연결 시 JWT를 `JwtService.verify()`로 검증한다. `@nestjs/jwt`의 `verify`는 서명 검증을 수행하므로 토큰 위조는 불가능하다. `workspaceId`는 JWT payload에서 추출되며(gateway.ts:88), 클라이언트가 임의로 조작할 수 없다.

---

### [INFO] 입력 검증 — DTO 레벨 검증 양호, 일부 보강 여지

- **위치**: `query-background-run.dto.ts`, `background-runs.controller.ts:56-57`
- **상세**: `QueryBackgroundRunDto`는 `class-validator`의 `@IsInt`, `@Min(1)`, `@Max(200)`, `@IsString`, `@IsOptional`을 사용한다. `@Type(() => Number)`로 query string에서 number 변환도 처리된다. Path parameter는 `ParseUUIDPipe`로 UUID v4 형식을 강제한다.
- **보강 여지**: `cursor` 필드에 `@MaxLength` 제한이 없다. base64 인코딩된 cursor가 매우 긴 경우 서비스 레이어의 `decodeCursor`에서 BadRequestException을 던지지만(service.ts:163-165), DTO 레벨에서 먼저 차단하면 더 명확하다. 예: `@MaxLength(512)`.

---

### [INFO] 인가 계층 — 권한 거부 케이스 단위 테스트 충분성 평가

- **위치**: `background-runs.service.spec.ts:266-296`, `background-runs.service.spec.ts:449-496`
- **상세**: 단위 테스트는 다음 케이스를 커버한다:
  - 타 workspace의 executionId → NotFoundException (service.spec.ts:266-273) ✓
  - 존재하지 않는 executionId → NotFoundException (service.spec.ts:276-283) ✓
  - 올바른 workspace지만 execution에 없는 backgroundRunId → NotFoundException (service.spec.ts:286-296) ✓
  - workspace 일치 → true (service.spec.ts:461-467) ✓
  - workspace 불일치 → false (service.spec.ts:469-476) ✓
  - 존재하지 않는 backgroundRunId → false (service.spec.ts:478-485) ✓
  - 빈 문자열 입력 → false (service.spec.ts:487-495) ✓
- **미커버 케이스**: WS `execution:` snapshot의 workspace 미검증 경로(위 WARNING 항목)에 대한 테스트가 없다. 또한 `verifyBackgroundRunOwnership`에서 DB가 throw할 때의 동작(catch → false)에 대한 테스트가 없다.
- **제안**: `emitExecutionSnapshot` IDOR 수정 후 해당 경로에 대한 단위/integration 테스트 추가. `verifyBackgroundRunOwnership` DB 오류 시 false 반환 케이스 단위 테스트 추가.

---

### [INFO] Migration V047 — 인덱스 안전성

- **위치**: `V047__node_execution_background_run_id_index.sql`
- **상세**: `CREATE INDEX CONCURRENTLY IF NOT EXISTS`를 사용하여 운영 테이블 쓰기 락을 회피한다. 부분 인덱스 조건(`WHERE output_data #>> '{meta,backgroundRunId}' IS NOT NULL`)으로 인덱스 크기를 최소화한다. 보안 관점에서 인덱스 생성 자체는 정보 노출이나 인젝션 위험이 없다.

---

## 요약

Background 모니터링 API의 REST 경로(`GET /executions/:executionId/background-runs/:backgroundRunId`)는 2단계 workspace 검증(executionId → workspaceId, backgroundRunId → executionId AND 조건)으로 IDOR를 효과적으로 차단하고 있다. WebSocket의 `background:run:` 채널도 `verifyBackgroundRunOwnership`을 통해 동일한 보호를 받는다. SQL 인젝션은 TypeORM named parameter 일관 사용으로 차단된다. 그러나 두 가지 주요 약점이 발견되었다: (1) WS `execution:` 채널 구독 시 snapshot을 전송하는 `emitExecutionSnapshot`이 workspaceId 검증을 수행하지 않아 인증된 타 workspace 사용자가 snapshot을 수신할 수 있고, (2) BullMQ processor의 catch된 Error.message가 필터링 없이 WS 이벤트 payload와 notification.message에 삽입되어 하위 서비스가 connection string이나 SQL query를 Error.message에 포함할 경우 정보 노출이 발생할 수 있다. `sanitizePayloadForWs`는 키 이름 기반 마스킹만 수행하므로 값 수준의 credential 포함에 대한 방어가 없다.

## 위험도

**MEDIUM**

> 주요 근거: REST IDOR는 완전히 차단되나, WS snapshot의 workspace 미검증(실현 가능한 IDOR 경로)이 존재하고, error message 필터링 부재가 의존 서비스의 구현 품질에 따른 정보 노출 위험을 내포한다.
