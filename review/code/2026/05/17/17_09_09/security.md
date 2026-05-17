# 보안(Security) 리뷰 결과

## 발견사항

### 인젝션 취약점

- **[INFO]** SQL 쿼리는 TypeORM QueryBuilder 의 파라미터 바인딩(`:status`, `:threshold` 등)을 일관되게 사용하고 있어 SQL 인젝션 위험 없음
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions`, V055/V056 마이그레이션 파일
  - 상세: `.where('status = :status', { status: ... })`, `.andWhere('started_at < :threshold', { threshold: ... })` 패턴이 모든 동적 SQL 조건에 적용됨. 마이그레이션 SQL도 고정 DDL만 포함.
  - 제안: 현재 수준 유지

- **[INFO]** `integration-oauth.service.ts`의 raw query는 파라미터 바인딩 사용 확인
  - 위치: `handleCallback` 내 `DELETE FROM integration_oauth_state WHERE state = $1 RETURNING *`, `consumePreviewToken`
  - 상세: positional parameter `$1` 을 통해 state 값을 안전하게 바인딩. 상태값이 직접 SQL 문자열에 삽입되지 않음.
  - 제안: 현재 수준 유지

### 하드코딩된 시크릿

- **[INFO]** 테스트 파일에 테스트용 하드코딩 값이 존재하나 실제 시크릿 아님
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `clientSecret = 'test-private-secret'`, `process.env.CAFE24_CLIENT_ID = 'test-cafe24-client-id'`
  - 상세: 단위 테스트 환경에서만 사용되는 더미값. `afterEach`에서 `delete process.env.CAFE24_CLIENT_ID` 로 정리됨. 프로덕션 시크릿 아님.
  - 제안: 현재 수준 유지

- **[WARNING]** `integration-oauth.service.ts`의 `normalizeTokenResponse` 변경: `parseTokenExpiresAt` 삭제 후 Cafe24의 `expires_at` ISO 문자열 파싱 로직이 제거됨
  - 위치: `integration-oauth.service.ts` diff — `parseTokenExpiresAt` 함수 전체 삭제 및 `normalizeTokenResponse` 내 단순 `expires_in`만 사용으로 대체
  - 상세: 이번 변경으로 Cafe24 전용 `expires_at` ISO 파싱 및 2h 기본값 fallback 로직이 제거됐다. Cafe24 토큰의 `tokenExpiresAt`이 다시 null이 될 수 있어 `Cafe24ApiClient.ensureFreshToken`의 proactive refresh 게이트가 다시 우회될 위험이 있다. 이는 이전 버전에서 명시적으로 수정한 보안/기능 회귀다 (diff 주석에서 "사용자 보고 2026-05-17"로 기재된 401 오류 재발 가능). 해당 테스트 2개도 함께 삭제됨.
  - 제안: `parseTokenExpiresAt` 삭제 또는 그 로직의 인라인 복원 여부를 재검토하거나, 다른 경로(예: `Cafe24ApiClient`)에서 이 처리가 보장되는지 확인 필요. 보안 관점에서는 토큰 만료 추적 실패가 비인가 접근 토큰 사용 연장으로 이어지므로 WARNING 등급.

### 인증/인가

- **[INFO]** Workspace 격리(W-6) 검증 로직이 잘 구현되어 있음
  - 위치: `execution-engine.service.ts` `assertSameWorkspace`, `executeInline`, `executeSync`, `executeAsync`
  - 상세: `WORKFLOW_FORBIDDEN_WORKSPACE` 에러로 cross-workspace 서브워크플로 호출을 차단. 테스트도 `ws-attacker` vs `ws-target` 시나리오로 검증됨.
  - 제안: `callerWorkspaceId`가 비어있을 때 경고만 남기고 통과시키는 현재 정책(점진적 도입)을 추후 fail-closed로 전환 시점 관리 필요

- **[WARNING]** `assertSameWorkspace`에서 `callerWorkspaceId`가 없을 때 fail-open 처리
  - 위치: `execution-engine.service.ts` `assertSameWorkspace` 메서드 (라인: `if (!callerWorkspaceId) { ... return; }`)
  - 상세: 호출자가 `parentWorkspaceId`를 전달하지 않으면 경고 로그만 남기고 workspace 격리 검증을 건너뜀. 옛 진입점이나 트리거 경로에서 이 분기를 탈 경우 cross-workspace 접근이 허용될 수 있음. 이번 PR의 변경은 아니지만 보안 취약점으로 명시.
  - 제안: 모든 호출 경로가 `parentWorkspaceId`를 전달하도록 마이그레이션 완료 후 즉시 fail-closed로 전환

- **[INFO]** Cafe24 HMAC 검증이 정상적으로 구현됨
  - 위치: `integration-oauth.service.ts` `handleInstall` — `timingSafeEqual` 사용, 타임스탬프 replay 방지(5분 창), 진단 로그에 `client_secret` 미포함
  - 상세: timing-safe 비교로 timing attack 방어, 토큰 전체를 로그에 노출하지 않음(`(present)`로 표기), `client_secret`이 authorize URL에 포함되지 않음을 테스트로 검증.
  - 제안: 현재 수준 유지

- **[INFO]** OAuth state 소비 원자성 보장
  - 위치: `integration-oauth.service.ts` `handleCallback` — `DELETE … RETURNING`
  - 상세: state row를 atomic하게 소비해 재사용 공격(replay attack) 방지. concurrent callback 중 단일 winner만 처리됨.
  - 제안: 현재 수준 유지

- **[INFO]** Sub-workflow 재귀 깊이 제한
  - 위치: `execution-engine.service.ts` `executeSync`, `executeAsync` — `MAX_RECURSION_DEPTH = 10`
  - 상세: 무한 재귀로 인한 메모리/DB 폭주 방어
  - 제안: 현재 수준 유지

### 입력 검증

- **[INFO]** Cafe24 `mall_id` 입력 검증이 정규식으로 강제됨
  - 위치: `integration-oauth.service.ts` `CAFE24_MALL_ID_PATTERN = /^[a-z0-9-]{3,50}$/`
  - 상세: mall_id가 이 패턴을 통과하지 않으면 즉시 `BadRequestException`. 테스트에서 잘못된 문자, 짧은 길이 모두 검증됨.
  - 제안: 현재 수준 유지

- **[INFO]** AI 대화 메시지 최대 길이(10,000자) 검증
  - 위치: `execution-engine.service.ts` `continueAiConversation` 및 `ai_message` 버스 핸들러 내부 이중 검증
  - 상세: 서비스 계층 + 버스 핸들러 두 곳에서 길이 초과 메시지를 거부해 Redis 직접 publish 우회 시에도 방어됨. 테스트로 검증됨.
  - 제안: 현재 수준 유지

- **[INFO]** `previewToken` 소비 시 workspace+user 소유권 검증
  - 위치: `integration-oauth.service.ts` `consumePreviewToken` — WHERE 절에 `workspace_id`, `user_id` 포함
  - 상세: 토큰 값을 알더라도 비소유자는 소비 불가. 실패 시 존재/소유 여부를 노출하지 않는 동일 에러 메시지 반환.
  - 제안: 현재 수준 유지

### OWASP Top 10

- **[INFO]** `dismissAll` / `dismiss` 메서드가 mock surface에 추가됨 (테스트 파일)
  - 위치: `alerts-evaluator.service.spec.ts`, `integration-expiry-scanner.service.spec.ts`
  - 상세: 테스트 mock 표면 동기화 목적. 실제 dismiss 로직의 인가 검증은 이번 변경 diff에서 확인 불가 (구현 파일 미포함). Dismiss API가 올바른 사용자/workspace 검증을 수행하는지 구현 코드에서 별도 확인 필요.
  - 제안: `NotificationsService.dismiss` / `dismissAll` 구현 파일에서 workspace 격리 및 소유권 검증 확인

- **[INFO]** `RECOVERY_CANDIDATE_LIMIT = 5` — DoS amplification 방어
  - 위치: `integration-oauth.service.ts`
  - 상세: install_token 회복 흐름에서 후보 수를 5개로 제한해 HMAC trial 루프를 통한 DoS 증폭 방지
  - 제안: 현재 수준 유지

### 에러 처리

- **[INFO]** `sanitizeLastErrorMessage`가 에러 메시지의 시크릿 패턴 마스킹
  - 위치: `integration-oauth.service.ts` `SECRET_LEAK_PATTERNS`, `sanitizeLastErrorMessage`
  - 상세: Bearer 토큰, client_secret, access_token 등 민감 패턴을 `***`로 치환 후 200자로 잘라 DB에 저장. Cafe24가 에러 응답에 시크릿을 echo하는 사례에 대응.
  - 제안: 현재 수준 유지

- **[INFO]** 타입 에러 클래스(`WorkflowNotFoundError`, `SubWorkflowTimeoutError`) 삭제로 제네릭 `Error`로 대체
  - 위치: `workflow-errors.ts` 전체 삭제, `execution-engine.service.ts` 해당 throw 지점들
  - 상세: 에러 타입 정보 손실로 인해 `instanceof` 분기를 사용하던 핸들러가 있다면 silent regression 위험. 그러나 `workflow.handler.ts`가 이를 어떻게 처리하는지 이번 diff에 포함되지 않아 전체 영향 불명. 에러 메시지 형식은 보존되므로 기존 문자열 매칭은 호환되나 타입 안전성은 저하됨.
  - 제안: `workflow.handler.ts` 등 `instanceof WorkflowNotFoundError`나 `instanceof SubWorkflowTimeoutError`를 사용하던 코드가 없는지 확인 필요

- **[INFO]** 에러 로그에서 `error.message`만 기록하며 stack trace를 선택적으로 노출
  - 위치: `execution-engine.service.ts` background catch blocks
  - 상세: `error instanceof Error ? error.message : String(error)` 패턴으로 내부 stack trace가 로그 외부로 노출되지 않음
  - 제안: 현재 수준 유지

### 암호화

- **[INFO]** HMAC-SHA256 사용으로 안전한 해시 알고리즘 적용
  - 위치: `integration-oauth.service.ts` `computeTestHmac`, `integration-oauth.service.cafe24.spec.ts`
  - 상세: `createHmac('sha256', secret)` 사용. `timingSafeEqual`로 timing attack 방어.
  - 제안: 현재 수준 유지

- **[INFO]** `randomBytes`로 암호학적으로 안전한 토큰 생성
  - 위치: `integration-oauth.service.ts` — state: `randomBytes(24).toString('hex')`, previewToken: `randomBytes(16).toString('hex')`
  - 제안: 현재 수준 유지

### 의존성 보안

- **[INFO]** 이번 변경에서 새로운 외부 의존성 추가 없음
  - 상세: 기존 NestJS, TypeORM, BullMQ, `crypto` (Node.js 내장) 모두 기존 의존성

---

## 요약

이번 변경은 알림 dismiss 기능 도입(V055/V056 마이그레이션, mock surface 동기화), 실행 엔진의 output 구조 단순화(D6 롤백), 그리고 Cafe24 OAuth 관련 리팩토링이 주를 이룬다. 전반적으로 SQL 인젝션 방어, HMAC 검증, workspace 격리, OAuth state 원자 소비, 입력 길이 제한 등 핵심 보안 통제가 잘 유지되고 있다. 다만 두 가지 사항에 주의가 필요하다: (1) `parseTokenExpiresAt` 삭제로 Cafe24 토큰 만료 추적이 다시 누락될 수 있으며, 이는 이전에 사용자 보고된 401 오류의 원인이었던 proactive refresh 미동작을 재발시킬 잠재적 위험이 있다; (2) `assertSameWorkspace`의 fail-open 처리는 호출자가 `parentWorkspaceId`를 전달하지 않을 때 cross-workspace 접근을 허용할 수 있으므로, 모든 호출 경로의 마이그레이션 완료 후 fail-closed 전환이 필요하다. `WorkflowNotFoundError` 클래스 삭제로 인한 타입 에러 처리 회귀 가능성도 확인이 필요하다.

## 위험도

MEDIUM
