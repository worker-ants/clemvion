# 보안(Security) 리뷰

## 발견사항

### 인증/인가

- **[INFO]** `handleSubscribe` 에서 `workspaceId` 가 빈 문자열인 경우 즉시 거부하는 가드가 존재하나, `notifications:` 채널은 `workspaceId` 가 아닌 `userId` 로 인가를 수행한다. 현재 코드는 `workspaceId` 가 없으면 거부하므로, JWT 에 `workspaceId` 가 항상 포함되어 있어야 한다는 가정에 의존한다. 이 가정이 깨질 경우 notifications 채널 구독이 차단되나, 이는 정책적으로 안전한 쪽(fail-closed)이다.
  - 위치: `websocket.gateway.ts` `handleSubscribe` 내 `if (!workspaceId)` 블록
  - 상세: `notifications:` 는 userId 비교만 필요하므로 workspaceId 가 없어도 인증된 사용자가 자신의 알림을 구독하는 데 실패할 수 있다. 그러나 현재 주석("정상 경로를 막지 않는다 — JWT 에 workspaceId 를 함께 담으므로")에서 설계 전제가 명시되어 있고, 구독 차단은 정보 유출보다 낫다.
  - 제안: 설계 전제(JWT 에 항상 workspaceId 포함)가 변경될 경우 해당 가드를 채널별로 세분화할 것. 현재로서는 INFO 수준.

- **[INFO]** `KbChannelAuthorizer` 는 `kb:` 채널에 대해 UUID 형식 검증을 수행하지 않는다. `execution:` 및 `background:run:`, `workflow:` 채널은 isValidUuid 로 사전 차단하지만, `kb:` 의 documentId 는 UUID가 아닐 수 있어 형식 검증 없이 곧바로 DB 조회로 진입한다.
  - 위치: `/codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` 전체
  - 상세: `verifyDocumentOwnership` 가 임의 문자열을 받아 DB 에 직접 조회한다. documentId 가 UUID 형식이 아닌 경우 SQL/ORM 에서 안전하게 처리되더라도, 불필요한 DB 조회가 발생한다. 만약 documentId 가 UUID 형식을 사용하지 않는다면 현재 구조가 올바르나, UUID 를 사용한다면 동일 정책(W-6) 적용이 일관성 면에서 바람직하다.
  - 제안: documentId 가 UUID 형식인 경우 `isValidUuid` 검증을 추가해 다른 authorizer 와 정책을 통일할 것. documentId 가 UUID 가 아닌 슬러그 등이라면 해당 형식에 맞는 입력 검증을 추가할 것.

### 입력 검증

- **[INFO]** `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation`, `handleRetryLastTurn` 핸들러에서 `data.executionId` 에 대해 UUID 형식 검증이 없다. `verifyOwnership` 이 DB 레벨에서 차단하겠지만, 비-UUID 입력이 DB 쿼리로 직접 전달된다.
  - 위치: `websocket.gateway.ts` 각 `@SubscribeMessage` 핸들러 내 `verifyOwnership` 호출 전
  - 상세: 채널 구독(authorize 경로)은 UUID 검증이 있으나, inbound command 핸들러(form/button/message/retry)는 isValidUuid 를 거치지 않고 `executionsService.verifyOwnership` 에 임의 문자열을 전달한다. TypeORM/PostgreSQL 은 UUID 형식이 아닌 값에 대한 파라미터화 쿼리를 안전하게 처리하지만, 의도하지 않은 DB 오류나 성능 비용이 발생할 수 있다.
  - 제안: 각 inbound command 핸들러에서 `executionId`/`nodeExecutionId` 에 `isValidUuid` 검증을 추가해 subscribe 경로와 정책을 통일할 것.

### 에러 처리

- **[INFO]** `emitExecutionSnapshot` 의 catch 블록에서 `error.message` 를 debug 로그에 출력한다. 이는 서버 측 로그이므로 클라이언트에 노출되지 않으며, 이미 `buildContinuationErrorAck` 에서 client-safe 분리가 잘 되어 있다.
  - 위치: `websocket.gateway.ts` `emitExecutionSnapshot` catch 블록 (라인 약 2119)
  - 상세: `error instanceof Error ? error.message : String(error)` 가 debug 레벨로 기록된다. 민감 정보가 에러 메시지에 포함될 가능성이 있으나, debug 로그는 프로덕션에서 비활성화되고 클라이언트에 전달되지 않으므로 INFO 수준이다.
  - 제안: debug 로그에 executionId 를 포함해 추적성을 확보하는 것은 현재도 되어 있다. 프로덕션 debug 로그 비활성화 정책을 환경 설정으로 보장할 것.

### 하드코딩된 시크릿

- **[INFO]** `websocket.module.ts` 에서 `configService.get<string>('jwt.secret') ?? 'dev-jwt-secret'` 형태의 개발용 fallback 이 존재한다.
  - 위치: `websocket.module.ts` JwtModule.registerAsync useFactory
  - 상세: 주석에 "production 부팅 가드(assertProductionConfig)가 차단하는 값"이라고 명시되어 있어, 운영 환경에서 이 sentinel 값이 실제로 사용되지 않도록 보호되어 있다. 이는 기존 코드의 내용이며 본 변경에서 신규 도입한 것이 아니다.
  - 제안: 현재 구조 유지. assertProductionConfig 가 실제로 이 sentinel 을 차단하는지 별도 테스트로 검증할 것.

### OWASP Top 10 (기타)

- **[INFO]** Race condition 방어가 handleSubscribe 내 "원자 블록" 주석으로 명시되어 있다. JavaScript 의 단일 이벤트 루프 특성상 실제 경쟁 조건은 발생하지 않으나, tentative-add + rollback 패턴으로 향후 리팩토링 안전성을 확보한 점은 긍정적이다.

## 요약

본 변경은 WebSocket 채널 authorizer 를 gateway 인라인에서 각 도메인 모듈 소유로 역전한 아키텍처 리팩토링이다. 보안 관점에서 UUID 형식 검증(W-6), IDOR 차단(ownership verify before join), notifications 채널의 JWT sub 기반 user-scoped 인가, 에러 메시지 client-safe 분리 등 핵심 보안 통제가 잘 유지·강화되었다. `KbChannelAuthorizer` 에 UUID 검증이 없는 점과 inbound command 핸들러에서 `executionId` UUID 형식 검증이 누락된 점이 개선 여지로 남아 있으나, 이는 현행 ORM 파라미터화 쿼리가 실질적 인젝션을 차단하고 있고 ownership verify 가 최종 방어선으로 작동하므로 즉각적인 취약점이 아닌 정책 일관성 문제다. 하드코딩된 시크릿은 없으며, 에러 정보 누출 통제도 적절히 구현되어 있다.

## 위험도

LOW
