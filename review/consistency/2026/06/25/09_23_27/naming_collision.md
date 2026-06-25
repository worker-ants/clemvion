# 신규 식별자 충돌 검토 — refactor 03 C-4 WebsocketGateway auth 보일러플레이트 추출

## 발견사항

### [INFO] `AuthenticatedSocket` 타입 별칭 — 충돌 없음, 기존 유사 패턴과 일관성 확인 필요
- target 신규 식별자: `type AuthenticatedSocket = Socket & { userId?: string; workspaceId?: string }`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-c4-ws-gateway-auth-7a9671/codebase/backend/src/modules/websocket/websocket.gateway.ts` 내 `client as Socket & { userId?, workspaceId? }` 인라인 단언 8회. `channel-authorizer.ts` 의 `ChannelAuthorizerContext` (`{ workspaceId, userId }`) 는 구조적으로 유사하지만 다른 목적(Subscribe 인가 전달 DTO).
- 상세: `AuthenticatedSocket` 이라는 이름은 코드베이스 전체(`codebase/` 포함)에서 현재 사용되지 않는다. 충돌 없음. 단, `ChannelAuthorizerContext` 와 필드 교집합(`workspaceId`, `userId`)이 있어 혼동 소지가 있지만 양자의 역할이 다르다(Socket 타입 단언 vs 인가 함수 인수 DTO).
- 제안: 충돌 없이 도입 가능. 파일 내 module-private 주석으로 `ChannelAuthorizerContext` 와의 역할 구분을 명시하면 충분.

### [INFO] `getCommandAuthContext(client)` private helper — 충돌 없음
- target 신규 식별자: `private getCommandAuthContext(client: Socket): { userId: string; workspaceId: string } | null`
- 기존 사용처: 코드베이스 전체에 동일 이름 없음. `AuthContext` (`codebase/backend/src/modules/auth/types/auth-context.ts`) 는 전혀 다른 개념(HTTP 요청의 IP/UserAgent 전달용 인터페이스).
- 상세: `AuthContext` 와 명칭 충돌 없음(`CommandAuthContext` 반환 객체 vs `AuthContext` 인터페이스, 역할·필드 모두 다름). 충돌 없음.
- 제안: 도입 가능. 반환하는 익명 객체를 전용 내부 타입(`CommandAuthCtx` 등)으로 명명하면 자기설명적이나 필수 아님.

### [INFO] `verifyExecutionOwnership(executionId, workspaceId)` private helper — 충돌 없음, 중복 패턴 주의
- target 신규 식별자: `private async verifyExecutionOwnership(executionId: string, workspaceId: string): Promise<boolean>`
- 기존 사용처: `ExecutionsService.verifyOwnership(executionId, workspaceId)` 가 이미 존재하며 gateway 내부에서 직접 호출 중. `ExecutionChannelAuthorizer.authorize` (`codebase/backend/src/modules/executions/execution-channel-authorizer.ts:35-39`) 도 동일 `verifyOwnership` 을 `then(() => true).catch(() => false)` 로 래핑.
- 상세: 명칭 충돌 없음(private helper vs public service method). 단, `ExecutionChannelAuthorizer` 가 이미 동일 `verifyOwnership → boolean` 래핑 패턴을 구현 중이라 구현 중복이 발생한다. 이는 명칭 충돌이 아니라 구현 일관성 사항.
- 제안: 충돌 없음. `ExecutionChannelAuthorizer` 와의 래핑 중복을 향후 통합 후보로 주석에 남길 것을 권장.

### [INFO] 메시지 문자열 상수화 — 충돌 없음, 배포 범위 제한 주의
- target 신규 식별자: 상수 이름 미결정 (예: `WS_MSG_NOT_AUTHENTICATED`, `WS_MSG_NOT_AUTHORIZED_EXECUTION`)
- 기존 사용처: 현재 리터럴 `'Not authenticated'` / `'Not authorized for this execution'` 이 `websocket.gateway.ts` (8회), `execution-channel-authorizer.ts:33,39` (2회), 테스트 파일 `toBe(...)` 단언에 사용 중.
- 상세: 상수 이름은 코드베이스에 기존 정의 없음. 충돌 없음. 단, 상수를 `websocket.gateway.ts` 내 파일 내부 상수로만 정의하면 `execution-channel-authorizer.ts` 의 동일 문자열 하드코딩은 그대로 남아 drift 잔존. `ws-error-codes.ts` 에 `WsErrorMessage` 오브젝트를 병기하거나 별도 `ws-messages.ts` 로 공유하면 단일 진실 확보.
- 제안: C-4 scope 내에서는 충돌 없이 도입 가능. authorizer 파일까지 함께 참조하도록 배포 범위 확장 권장.

## 요약

refactor 03 C-4 가 도입하는 신규 식별자(`AuthenticatedSocket`, `getCommandAuthContext`, `verifyExecutionOwnership`, 문자열 상수)는 코드베이스 전체에서 동일 이름으로 다른 의미로 사용되는 기존 정의가 없다. 기존 `AuthContext`(HTTP 요청 컨텍스트 DTO, `/codebase/backend/src/modules/auth/types/auth-context.ts`)와 표면적 유사성이 있으나 명칭·역할 모두 다르다. 주목할 점은 `verifyOwnership → boolean` 래핑 중복(`ExecutionChannelAuthorizer` 와 동일 패턴)과 메시지 상수의 배포 범위 제한(`execution-channel-authorizer.ts` 미포함 가능성)이나, 이는 충돌이 아니라 일관성 보완 권고 사항이다. 신규 식별자 충돌 관점에서 차단 요소는 없다.

## 위험도

NONE
