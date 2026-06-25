# Testing Review — websocket.gateway.ts (C-4 refactor)

## 발견사항

### [INFO] handleClickButton 핸들러: 전용 테스트 describe 블록 부재
- 위치: `websocket.gateway.spec.ts` 전체
- 상세: `handleSubmitForm`(9개), `handleRetryLastTurn`(8개), `handleSubmitMessage`(2개), `handleEndConversation`(1개)는 각자 describe 블록이 있으나, `handleClickButton`은 전용 describe 블록이 없다. 이번 C-4 리팩터에서 5개 핸들러 모두 `getCommandAuthContext` + `verifyExecutionOwnership` 헬퍼로 통합되었으므로, `handleClickButton`의 (1) 미인증 거부 ack `execution.click_button.ack`, (2) IDOR 소유권 거부 ack, (3) 성공 케이스, (4) `queued=false` 케이스가 미검증 상태다.
- 제안: `handleClickButton` 전용 describe 블록을 추가하고, 최소 unauthenticated 거부 / ownership 거부 / 성공 / queued=false 케이스를 커버한다.

### [INFO] handleSubmitMessage / handleEndConversation: 인증·IDOR 거부 케이스 미검증
- 위치: `websocket.gateway.spec.ts:1024–1102`
- 상세: `handleSubmitMessage` describe에는 `plain Error 누출 차단` 2건, `handleEndConversation` describe에는 `plain Error 누출 차단` 1건만 있다. 두 핸들러 모두 `getCommandAuthContext` null 경로(미인증 거부)와 `verifyExecutionOwnership` false 경로(IDOR 거부)가 테스트되지 않는다. `handleSubmitForm`과 `handleRetryLastTurn`에는 이 케이스들이 있으므로, 대칭적으로 추가가 필요하다.
- 제안: `handleSubmitMessage`와 `handleEndConversation` 각각에 unauthenticated 거부 케이스와 ownership 거부 케이스를 추가한다.

### [INFO] getCommandAuthContext: workspaceId 누락(undefined) 정규화 엣지 케이스 미검증
- 위치: `websocket.gateway.ts:148–153` (`getCommandAuthContext`)
- 상세: JWT에 `workspaceId`가 없는 소켓(`userId` 존재, `workspaceId` undefined)이 명령 핸들러를 호출하면 `workspaceId: ''`로 정규화되어 `verifyOwnership`에 전달된다. 이 정규화 경로가 테스트되지 않는다. `verifyOwnership`이 ''를 소유 불일치로 처리한다는 계약을 테스트가 단정짓고 있지 않아, 향후 `verifyOwnership` 구현 변경 시 IDOR 구멍이 조용히 생길 수 있다.
- 제안: `userId`는 있고 `workspaceId`는 undefined인 소켓으로 명령 핸들러를 호출했을 때 `verifyOwnership`이 `''`를 인자로 받아 ownership 거부 ack를 반환하는 케이스를 추가한다.

### [INFO] handleRetryLastTurn W3 보상 경로: markSpawnedRowFailedOnPublishError 호출 검증 미흡
- 위치: `websocket.gateway.spec.ts:1008–1021`
- 상세: `publish queued=false` 케이스에서 `markSpawnedRowFailedOnPublishError`가 호출되는지 검증이 없다. mock은 등록되어 있으나(라인 85) 해당 보상 메서드 호출 여부를 단정(expect)하는 케이스가 없다. `publish throw` 케이스(catch 블록 W3)도 마찬가지로 보상 호출이 검증되지 않는다.
- 제안: `queued=false`와 `publishRetryLastTurn throw` 케이스 각각에서 `expect(mockEngine.markSpawnedRowFailedOnPublishError).toHaveBeenCalledWith('ne-spawned', ...)` 검증을 추가한다.

### [INFO] MSG_NOT_AUTHENTICATED / MSG_NOT_AUTHORIZED_EXECUTION 상수값 회귀 가드 — 부분 커버
- 위치: `websocket.gateway.ts:442–443` (상수 정의); `websocket.gateway.spec.ts` 전반
- 상세: `handleSubmitForm`의 unauthenticated 케이스(라인 692)는 `'Not authenticated'` 정확 값을 검증하고, ownership 거부 케이스(라인 747)는 `'Not authorized for this execution'` 정확 값을 검증한다. 그러나 `handleClickButton`, `handleSubmitMessage`, `handleEndConversation`의 동일 경로는 테스트가 없으므로 상수 변경 시 wire shape 회귀를 잡지 못한다. 상수 주석에 "테스트가 정확한 값을 검증"이라고 명시되어 있으므로 커버 범위를 일관되게 확장해야 한다.
- 제안: 각 핸들러의 unauthenticated/ownership 거부 케이스에서 error 필드 정확 값을 검증한다.

### [INFO] handleConnection: invalid token 에러 emit 메시지 검증 부재
- 위치: `websocket.gateway.spec.ts:645–668`
- 상세: `should accept client with valid token` / `should disconnect client without token` 2건만 있다. invalid token(JWT verify throw) 경로의 emit `{ message: 'Invalid token' }` 과 disconnect 호출은 테스트되지 않는다. 이번 C-4 리팩터 직접 변경 범위는 아니지만, `handleConnection`의 `AuthenticatedSocket` 단언 적용 대상 코드 경로라 회귀 위험이 있다.
- 제안: invalid token 경우 `emit('error', { message: 'Invalid token' })` + `disconnect()` 검증 케이스를 추가한다.

## 요약

C-4 리팩터의 핵심인 `getCommandAuthContext` + `verifyExecutionOwnership` 두 헬퍼에 대한 테스트 구조는 전반적으로 양호하다. `handleSubmitForm`(9건)과 `handleRetryLastTurn`(8건)은 인증 거부, IDOR 거부, typed/untyped 에러 누출 차단, W3 보상, spec wire shape 등을 충실히 커버하고 있고, 상수 값 회귀 가드도 해당 핸들러 범위 내에서는 유지된다. 그러나 `handleClickButton`은 전용 테스트 describe 블록 자체가 없고, `handleSubmitMessage`/`handleEndConversation`은 에러 누출 차단 케이스만 있어 공통 helper로 추출된 인증·IDOR 경로가 2~3개 핸들러에서 미검증 상태다. 또한 `workspaceId` undefined 정규화 엣지 케이스와 `markSpawnedRowFailedOnPublishError` 보상 호출 검증이 빠져 있어, behavior-preserving 리팩터 보장을 일부 테스트가 뒷받침하지 못하는 상황이다. 이는 수정 우선도 낮은 INFO 수준이나, 5개 핸들러가 동일 helper를 공유하는 만큼 커버리지 대칭성을 갖추는 것이 유지보수성에 유리하다.

## 위험도

LOW
